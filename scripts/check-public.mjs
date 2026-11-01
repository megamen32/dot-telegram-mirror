import {readdirSync,readFileSync} from 'node:fs';import {join} from 'node:path';
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>['.git','node_modules'].includes(e.name)?[]:e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);}
const patterns=[/192\.168\.\d+\.\d+/,/\/(?:home|Users)\/[A-Za-z][A-Za-z0-9_-]*\//,/ghp_[A-Za-z0-9]{20,}/];
const bad=files('.').filter(f=>!f.endsWith('check-public.mjs')&&patterns.some(p=>p.test(readFileSync(f,'utf8'))));
if(bad.length){console.error('Review required: '+bad.join(', '));process.exit(1);}
console.log('Known private-pattern scan passed; not a complete secret audit.');
