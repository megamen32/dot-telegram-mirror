import {config} from './config.mjs';
import {pageAction} from './dot-browser-page.mjs';
const URL=config.dotUrl;
const ROOM=config.roomId;
export function fixedEvaluation(action,args){
 if(!['dot_snapshot','dot_send'].includes(action)||!Number.isSafeInteger(args.tab_id)||args.tab_id<=0)throw Error('invalid_dot_operation');
 if(action==='dot_send'&&(typeof args.text!=='string'||!args.text.trim()||args.text.length>16000))throw Error('invalid_dot_text');
 if(args.reply_to!=null&&(typeof args.reply_to!=='string'||!args.reply_to.startsWith(ROOM+'~'+ROOM+'~CalpicoMessage~')))throw Error('invalid_dot_reply');
 const values=[URL,ROOM,action==='dot_send'?args.text:null,action==='dot_snapshot'?(args.after||null):null,args.reply_to||null];
 return {pageId:args.tab_id,function:`() => (${pageAction.toString()})(...${JSON.stringify(values)})`};
}
export function parseEvaluation(output){
 const line=output.split('\n').find(s=>s.trim().startsWith('{'));if(!line)throw Error('missing_gateway_response');
 const response=JSON.parse(line);if(response.error||response.result?.isError)throw Error('gateway_failed');
 const text=(response.result?.content||[]).filter(c=>c.type==='text').map(c=>c.text||'').join('\n');
 const start=text.indexOf('```json'),end=text.lastIndexOf('```');if(start<0||end<=start+7)throw Error('invalid_gateway_result');
 return JSON.parse(text.slice(start+7,end).trim());
}

export function discoverDotPage(output){
 const line=output.split('\n').find(s=>s.trim().startsWith('{'));
 const response=JSON.parse(line||'null');
 if(!response||response.error||response.result?.isError)throw Error('dot_discovery_unavailable');
 const text=(response.result?.content||[]).filter(c=>c.type==='text').map(c=>c.text||'').join('\n');
 const matches=text.split('\n').map(line=>line.match(/^(\d+): .*\((https:\/\/[^\s)]+)\)(?: \[selected\])?$/)).filter(m=>m&&m[2]===URL);
 if(matches.length!==1)throw Error('dot_discovery_not_unique');
 return Number(matches[0][1]);
}
export function createDotBrowserCaller(call,now=()=>Date.now()){
 if(typeof call!=='function')throw Error('authorized_mcp_transport_required');
 const pages=new Map();let lastDiscovery=-Infinity;
 return async(action,args)=>{
  // Validate operation before any discovery. A send is NEVER retried.
  fixedEvaluation(action,args);
  const evaluate=async(page)=>parseEvaluation(await call('evaluate_script',fixedEvaluation(action,{...args,tab_id:page})));
  const page=pages.get(args.tab_id)||args.tab_id;
  if(action==='dot_send')return evaluate(page);
  try{const result=await evaluate(page);if(result.ok)return result;
   if(!['wrong_dot_route','wrong_or_unloaded_room'].includes(result.error))return result;
  }catch{}
  if(now()-lastDiscovery<60000)throw Error('dot_discovery_backoff');
  lastDiscovery=now();
  const found=discoverDotPage(await call('list_pages',{}));
  const result=await evaluate(found);
  if(!result.ok||result.room!==ROOM)throw Error('dot_discovery_room_unverified');
  pages.set(args.tab_id,found);
  return result;
 };
}
