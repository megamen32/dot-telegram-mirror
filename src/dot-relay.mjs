import {existsSync,readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {config} from './config.mjs';
export const OWNER=config.ownerId;
export const ROOM=config.roomId;
export const textHash=text=>createHash('sha256').update(String(text)).digest('hex');
export function canonicalPrivateSender(message,peerId){
 if(message.out || peerId!==OWNER || String(message.peerId?.userId||'')!==OWNER)return '';
 const explicit=message.senderId ?? message.fromId?.userId;
 return explicit==null ? OWNER : String(explicit);
}
export class DotRelay {
 constructor({statePath,botAccountId,agentId,tabId,browserCall,send,edit,wait=ms=>new Promise(r=>setTimeout(r,ms))}){
  if(!/^telegram:\d+$/.test(botAccountId)||botAccountId==='telegram:'+OWNER||!agentId||!Number.isInteger(tabId))throw Error('invalid_dot_binding');
  Object.assign(this,{statePath,botAccountId,agentId,tabId,browserCall,send,edit,wait});
  const binding={botAccountId,agentId,tabId,room:ROOM,owner:OWNER};
  this.state=existsSync(statePath)?JSON.parse(readFileSync(statePath,'utf8')):{binding,incoming:{},outgoing:{}};
  if(JSON.stringify(this.state.binding)!==JSON.stringify(binding))throw Error('binding_changed_requires_review');
  this.busy=false;this.tail=Promise.resolve();
 }
 save(){mkdirSync(dirname(this.statePath),{recursive:true,mode:0o700});writeFileSync(this.statePath+'.tmp',JSON.stringify(this.state),{mode:0o600});renameSync(this.statePath+'.tmp',this.statePath);}
 allowed(e){return e.accountId===this.botAccountId&&e.peerId===OWNER&&e.senderId===OWNER&&e.private===true&&!e.out&&!e.isEdit&&!e.reconciliation&&typeof e.text==='string'&&e.text.trim()&&e.text.length<=16000&&/^\d+$/.test(e.messageId);}
 replyTarget(replyTo){
  if(!/^[1-9][0-9]*$/.test(String(replyTo||'')))return null;
  const ids=new Set();
  for(const [id,p] of Object.entries(this.state.mirror?.published||{}))
   if(p.status==='accepted'&&p.receipts?.includes(String(replyTo)))ids.add(id);
  const incoming=this.state.incoming[this.botAccountId+':'+OWNER+':'+replyTo];
  if(incoming?.status==='accepted'&&incoming.echo)ids.add(incoming.echo);
  const prefix=ROOM+'~'+ROOM+'~CalpicoMessage~';
  return ids.size===1&&[...ids][0].startsWith(prefix)?[...ids][0]:null;
 }
 async prepareReceive(e,resolveContext){
  const prepared=(this.prepareTail||Promise.resolve()).then(async()=>{
   if(!this.allowed(e))return {result:{status:'ignored'}};
   if(e.replyTo&&(!config.experimentalNativeReplies||!this.replyTarget(e.replyTo)))e.replyContext=await resolveContext(e.replyTo);
   // Do not await delivery here: the durable admission queue owns that order.
   return {result:this.receive(e)};
  });
  this.prepareTail=prepared.then(()=>undefined,()=>undefined);
  return prepared.then(value=>value.result);
 }
 async receive(e){
  if(!this.allowed(e))return {status:'ignored'};
  const providerReplyTo=e.replyTo?String(e.replyTo):null;
  if(providerReplyTo&&!/^[1-9][0-9]*$/.test(providerReplyTo))return {status:'invalid_reply'};
  const target=providerReplyTo&&config.experimentalNativeReplies?this.replyTarget(providerReplyTo):null;
  let text=e.text;
  if(providerReplyTo&&!target){
   const quote=typeof e.replyContext==='string'&&e.replyContext.length<=1600?e.replyContext:'[Контекст недоступен или скрыт]';
   text='Ответ в Telegram на сообщение #'+providerReplyTo+' (цитата контекста, не отдельное поручение):\n'+quote.split('\n').map(line=>'> '+line).join('\n')+'\n\nOwner message:\n'+e.text;
   if(text.length>16000)return {status:'reply_context_too_large_not_accepted'};
  }
  return this.admit(this.botAccountId+':'+OWNER+':'+e.messageId,text,'telegram',
   {provider_reply_to:providerReplyTo,reply_to_main:target,original_text_hash:textHash(e.text),
    ...(providerReplyTo&&!target?{reply_context_hash:textHash(e.replyContext||''),reply_mode:'quoted_context'}:target?{reply_mode:'native'}:{})});
 }
 async admit(id,text,source,metadata={}){
  if(this.state.incoming[id])return {...this.state.incoming[id],duplicate:true};
  if(Object.values(this.state.incoming).filter(r=>r.status==='queued').length>=32)return {status:'queue_full_not_accepted'};
  this.state.incoming[id]={status:'queued',source,text_hash:textHash(text),created:Date.now(),...metadata};this.save();
  const run=()=>this.deliver(id,text);this.tail=this.tail.then(run,run);return this.tail;
 }
 async deliver(id,text){
  this.busy=true;const record=this.state.incoming[id];
  try{
   let baseline;try{baseline=await this.browserCall('dot_snapshot',{tab_id:this.tabId});}catch{record.status='not_accepted';record.reason='snapshot_unavailable';this.save();return record;}
   if(!baseline.ok||baseline.room!==ROOM||!baseline.cursor){record.status='not_accepted';record.reason='wrong_or_unloaded_room';this.save();return record;}
   Object.assign(record,{status:'send_uncertain',cursor:baseline.cursor});this.save();
   let submitted;try{submitted=await this.browserCall('dot_send',{tab_id:this.tabId,request_id:id,text,reply_to:record.reply_to_main||null});}catch{return record;}
   if(!submitted.ok){record.status='requires_review';record.reason=String(submitted.error||'browser_preflight_failed').replace(/[^a-z0-9_]/gi,'').slice(0,100);this.save();return record;}
   record.status='submitted_unconfirmed';this.save();
   for(let n=0;n<20;n++){
    await this.wait(Math.min(5000+n*1000,15000));
    let snapshot;try{snapshot=await this.browserCall('dot_snapshot',{tab_id:this.tabId,after:record.cursor});}catch{record.status='echo_unknown';this.save();return record;}
    if(!snapshot.ok||snapshot.room!==ROOM){record.status='echo_requires_review';this.save();return record;}
    const matches=(snapshot.messages||[]).filter(m=>m.role==='user'&&m.text.trim()===text.trim()&&(!record.reply_to_main||m.reply_to===record.reply_to_main));
    if(matches.length>1){record.status='ambiguous_echo_requires_review';this.save();return record;}
    if(matches.length===1){record.echo=matches[0].id;record.status='accepted';this.save();return record;}
   }
   record.status='echo_timeout_requires_review';this.save();return record;
  }finally{this.busy=false;}
 }
 mirrorOrigin(message){
  for(const [id,r] of Object.entries(this.state.incoming)){
   if(r.source!=='telegram'&&!id.startsWith('telegram:'))continue;
   if(r.echo===message.id)return 'telegram';
   if(message.role==='user'&&!r.echo&&r.text_hash===textHash(message.text)&&!['not_accepted','ignored'].includes(r.status))return 'uncertain';
  }
  return null;
 }
}
