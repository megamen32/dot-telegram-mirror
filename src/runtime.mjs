import {DotRelay} from './dot-relay.mjs';
import {DotMirror,safeReplyContext} from './dot-mirror.mjs';
export function createRuntime({statePath,botAccountId,pageId,browserCall,telegram,now,stableMs}) {
 if(!telegram||typeof telegram.send!=='function'||typeof telegram.edit!=='function')throw Error('authorized_telegram_adapter_required');
 const relay=new DotRelay({statePath,botAccountId,agentId:'configured-browser',tabId:pageId,browserCall,
 send:(owner,text)=>telegram.send(owner,text),edit:(owner,id,text,hash)=>telegram.edit(owner,id,text,hash)});
 const mirror=new DotMirror(relay,{now,stableMs});
 return {
 receive:event=>relay.prepareReceive(event,async id=>typeof telegram.readReplyContext==='function'?safeReplyContext(await telegram.readReplyContext(id),id):'[Reply context unavailable]'),
 tick:()=>mirror.tick(),
 status:()=>({incomingBusy:relay.busy,status:relay.state.mirror?.status||'not_started',blocked:relay.state.mirror?.blocked||null})
 };
}
