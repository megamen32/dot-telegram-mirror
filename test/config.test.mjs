import test from 'node:test';import assert from 'node:assert/strict';import {validateConfig} from '../src/config.mjs';
const env={DOT_OWNER_ID:'10001',DOT_ROOM_ID:'example-room',DOT_URL:'https://chatgpt.com/dots/example'};
test('explicit scoped config; native reply disabled by default',()=>{assert.equal(validateConfig(env).experimentalNativeReplies,false);
for(const bad of [{},{...env,DOT_OWNER_ID:'-12'},{...env,DOT_URL:'https://evil.example/dots/example'},{...env,DOT_URL:env.DOT_URL+'?token=x'},{...env,DOT_ROOM_ID:'a~b'},{...env,DOT_OWNER_LABEL:'line\nbreak'}])assert.throws(()=>validateConfig(bad));});

test('default quote-only mode resolves context even for a mapped native target',async()=>{
 const {spawnSync}=await import('node:child_process');
 const result=spawnSync(process.execPath,['--input-type=module','-e',`
  import assert from 'node:assert/strict';
  import {DotRelay} from './src/dot-relay.mjs';
  const relay=Object.create(DotRelay.prototype);
  relay.allowed=()=>true;relay.replyTarget=()=> 'mapped-target';
  let resolved=false,context;
  relay.receive=async e=>{context=e.replyContext;return {status:'captured'};};
  await relay.prepareReceive({replyTo:'3'},async()=>{resolved=true;return 'Referenced question';});
  assert.equal(resolved,true);assert.equal(context,'Referenced question');
 `],{cwd:process.cwd(),env:{...process.env,DOT_EXPERIMENTAL_NATIVE_REPLIES:'0'},encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});
