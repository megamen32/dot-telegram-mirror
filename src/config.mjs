export function validateConfig(env) {
 const ownerId=env.DOT_OWNER_ID,roomId=env.DOT_ROOM_ID,dotUrl=env.DOT_URL;
 if(!/^[1-9][0-9]{0,19}$/.test(ownerId||''))throw Error('DOT_OWNER_ID required');
 if(!/^[A-Za-z0-9_-]{1,120}$/.test(roomId||''))throw Error('DOT_ROOM_ID required');
 let url;try{url=new URL(dotUrl);}catch{throw Error('DOT_URL required');}
 if(url.origin!=='https://chatgpt.com'||!url.pathname.startsWith('/dots/')||url.search||url.hash||url.username||url.password)throw Error('invalid_DOT_URL');
 for(const v of [env.DOT_OWNER_LABEL,env.DOT_ASSISTANT_LABEL])if(v!=null&&(!v.trim()||v.length>60||/[\r\n]/.test(v)))throw Error('invalid_label');
 return Object.freeze({ownerId,roomId,dotUrl,ownerLabel:env.DOT_OWNER_LABEL||'Owner',assistantLabel:env.DOT_ASSISTANT_LABEL||'dot',experimentalNativeReplies:env.DOT_EXPERIMENTAL_NATIVE_REPLIES==='1'});
}
export const config=validateConfig(process.env);
