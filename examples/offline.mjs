// Synthetic demonstration: no network, real browser or Telegram client.
import {mkdtempSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {createRuntime} from '../src/runtime.mjs';import {config} from '../src/config.mjs';
let now=0,rows=[{id:'baseline',role:'user',text:'not mirrored'}];const sent=[];
const runtime=createRuntime({statePath:join(mkdtempSync(join(tmpdir(),'mirror-demo-')),'state.json'),botAccountId:'telegram:999999',pageId:1,now:()=>now,stableMs:10,
 browserCall:async()=>({ok:true,room:config.roomId,cursor:rows.at(-1).id,messages:rows}),
 telegram:{send:async(owner,text)=>{sent.push({owner,text});return String(sent.length)},edit:async()=>{}}});
await runtime.tick();rows.push({id:'new',role:'assistant',text:'Hello from the offline mirror demo.'});
await runtime.tick();now=11;await runtime.tick();
console.log(JSON.stringify({status:runtime.status(),syntheticReceipts:sent.length,networkCalls:0},null,2));
