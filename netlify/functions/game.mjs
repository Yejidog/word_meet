// Fixed upstream: this function is not an open proxy. Room credentials are
// forwarded only to the game's existing Cloudflare backend, and never logged.
const UPSTREAM='https://word-meet.siroooo0502.workers.dev';
const ACTIONS=new Set(['health','create','join','state','word','next']);
export function makeHandler(upstreamFetch=fetch){return async function handler(request){
 const url=new URL(request.url),origin=request.headers.get('Origin');
 const permitted=!origin||origin===url.origin||origin==='https://yejidog.github.io';
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
 if(permitted&&origin){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS';headers['Access-Control-Allow-Headers']='Content-Type, Authorization, X-Room-ID';headers['Access-Control-Max-Age']='86400'}
 const reply=(data,status)=>new Response(JSON.stringify(data),{status,headers});
 if(!permitted)return reply({error:'请求来源不受支持'},403);
 const action=url.pathname.split('/').filter(Boolean).at(-1);
 if(!ACTIONS.has(action))return reply({error:'接口不存在'},404);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 const method=action==='health'||action==='state'?'GET':'POST';if(request.method!==method)return reply({error:'请求方法错误'},405);
 let body;
 if(method==='POST'){
  if(Number(request.headers.get('Content-Length')||0)>8192)return reply({error:'内容太长'},413);
  let size=0;const reader=request.body?.getReader(),chunks=[];
  if(reader){while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();return reply({error:'内容太长'},413)}chunks.push(value)}}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}body=new TextDecoder().decode(bytes);
  try{JSON.parse(body)}catch{return reply({error:'请求格式错误'},400)}
 }
 const forwardHeaders={'Content-Type':'application/json'};
 for(const name of ['Authorization','X-Room-ID']){const value=request.headers.get(name);if(value)forwardHeaders[name]=value}
 // CORS Origin is deliberately not forwarded: this is a server-to-server
 // request, authenticated by the per-player bearer token at the upstream.
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const upstream=await upstreamFetch(UPSTREAM+'/api/'+action,{method,headers:forwardHeaders,body,signal:controller.signal,redirect:'error'});
  const raw=await upstream.text();let data;try{data=JSON.parse(raw)}catch{return reply({error:'联机服务返回异常，请稍后再试'},502)}
  return reply(data,upstream.status);
 }catch{return reply({error:'联机服务连接超时，请稍后再试'},504)}finally{clearTimeout(timer)}
}}
export default makeHandler();
export const config={path:'/api/*'};
