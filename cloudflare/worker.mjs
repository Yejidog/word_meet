const TTL=7*86400000;
const hex=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),b=>b.toString(16).padStart(2,'0')).join('');
const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
const error=(status,message)=>{throw Object.assign(new Error(message),{status})};
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const norm=s=>s.normalize('NFKC').trim().toLowerCase();
function nameOf(value){const n=String(value||'').trim();if(!n||n.length>16)error(400,'昵称请填写 1–16 个字');return n}
function view(r,seat){const words=r.words,revealed=words.every(w=>w!==null);return {id:r.id,seat,round:r.round,game:r.game,won:revealed&&norm(words[0])===norm(words[1]),revealed,myWord:words[seat]||'',players:r.players.map((p,i)=>({seat:i,name:p.name,online:Date.now()-p.seen<20000,vote:p.vote,submitted:words[i]!==null})),history:[...r.history,...(revealed?[{round:r.round,words:[...words]}]:[])]}}
export class Room {
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.cached=null;this.saved=0;this.alarmed=0;this.requests=new Map()}
 async fetch(request){return this.ctx.blockConcurrencyWhile(async()=>{
  try{
   const now=Date.now(),url=new URL(request.url),action=url.pathname.split('/').at(-1);
   let r=structuredClone(this.cached||await this.ctx.storage.get('room'));
   if(r&&now-r.updated>TTL){await this.ctx.storage.deleteAll();this.cached=null;r=null}
   let body={};if(request.method==='POST'){const text=await request.text();if(text.length>4096)error(413,'内容太长');try{body=JSON.parse(text||'{}')}catch{error(400,'请求格式不正确')}}
   let output,changed=false;
   if(action==='create'&&request.method==='POST'){
    if(r)error(409,'房间已存在');const token=hex(24),invite=hex(24);
    r={id:body.id,invite:await digest(invite),updated:now,game:1,round:1,history:[],words:[null,null],players:[{name:nameOf(body.name),token:await digest(token),seen:now,vote:0}]};
    output={id:r.id,invite,token};changed=true;
   }else{
    if(!r)error(404,'房间不存在或已过期');
    if(action==='join'&&request.method==='POST'){
     if(await digest(String(body.invite))!==r.invite)error(404,'邀请链接无效');if(r.players.length>=2)error(409,'房间已有两人');
     const token=hex(24);r.players.push({name:nameOf(body.name),token:await digest(token),seen:now,vote:0});output={id:r.id,token};changed=true;
    }else{
     const auth=request.headers.get('Authorization')||'';const hashed=await digest(auth.replace(/^Bearer /,''));const seat=r.players.findIndex(p=>p.token===hashed);if(seat<0)error(401,'玩家身份失效，请使用原浏览器进入');
     const key=seat+':'+Math.floor(now/60000);const count=(this.requests.get(key)||0)+1;this.requests.set(key,count);if(count>100)error(429,'操作过快，请稍后再试');if(this.requests.size>8)this.requests=new Map([[key,count]]);
     if(action==='state'&&request.method==='GET'){}
     else if(action==='word'&&request.method==='POST'){
      if(body.game!==r.game||body.round!==r.round)error(409,'轮次已更新，请稍后重试');if(r.players.length!==2)error(409,'请等朋友加入');
      const word=String(body.word||'').normalize('NFKC').trim();if(!word||Array.from(word).length>20||/[\p{Cc}\p{Cf}]/u.test(word))error(400,'请输入 1–20 个字');
      if(r.words[seat]!==null&&r.words[seat]!==word)error(409,'词语已锁定，不能修改');r.words[seat]=word;changed=true;
     }else if(action==='next'&&request.method==='POST'){
      if(body.game===r.game&&body.round===r.round){
       const s=view(r,seat);if(!s.revealed)error(409,'双方写好后才能继续');if(!s.won&&r.round>=100)error(400,'本局已达100轮，请创建新房间');
       r.players[seat].vote=1;if(r.players.every(p=>p.vote===1)){if(s.won){r.game++;r.round=1;r.history=[]}else{r.history.push({round:r.round,words:[...r.words]});r.round++}r.words=[null,null];r.players.forEach(p=>p.vote=0)}changed=true;
      }
     }else error(404,'接口不存在');
     r.players[seat].seen=now;r.updated=now;output=view(r,seat);
    }
   }
   r.updated=now;
   if(changed||now-this.saved>30000){await this.ctx.storage.put('room',r);this.saved=now}
   this.cached=r;
   if(changed||now-this.alarmed>3600000){await this.ctx.storage.setAlarm(now+TTL+3600000);this.alarmed=now}
   return json(output);
  }catch(e){return json({error:e.status?e.message:'服务暂时不可用，请重试'},e.status||500)}
 })}
 async alarm(){const r=await this.ctx.storage.get('room');if(!r||Date.now()-r.updated>=TTL){await this.ctx.storage.deleteAll();this.cached=null}else await this.ctx.storage.setAlarm(r.updated+TTL+3600000)}
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),origin=request.headers.get('Origin');
  const allowed=(env.ALLOWED_ORIGIN||'https://yejidog.github.io').split(',').map(s=>s.trim());
  const same=origin===url.origin,permit=!origin||same||allowed.includes(origin);
  const headers={'Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  if(origin&&permit){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS';headers['Access-Control-Allow-Headers']='Content-Type, Authorization, X-Room-ID';headers['Access-Control-Max-Age']='86400'}
  if(!permit)return new Response('Forbidden',{status:403,headers});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(!url.pathname.startsWith('/api/'))return new Response('Word Meet backend is ready. Open the GitHub game to play.',{headers});
  try{
   if(url.pathname==='/api/health')return new Response(JSON.stringify({ok:true,service:'word-meet',version:1}),{headers:{...headers,'Content-Type':'application/json'}});
   const action=url.pathname.slice(5);if(!['create','join','state','word','next'].includes(action))error(404,'接口不存在');
   if(request.method!==(action==='state'?'GET':'POST'))error(405,'请求方法错误');
   let body=null,id=request.headers.get('X-Room-ID');let forwarded=request;
   if(action==='create'||action==='join'){
    const text=await request.text();if(text.length>4096)error(413,'内容太长');try{body=JSON.parse(text)}catch{error(400,'请求格式不正确')}
    if(action==='create')nameOf(body.name);
    id=action==='create'?hex(16):body.id;
    forwarded=new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify({...body,id})});
   }
   if(!/^[a-f0-9]{32}$/.test(id||''))error(400,'房间编号无效');
   const stub=env.ROOMS.get(env.ROOMS.idFromName(id));const result=await stub.fetch(forwarded);
   const combined=new Headers(result.headers);for(const [k,v]of Object.entries(headers))combined.set(k,v);
   return new Response(result.body,{status:result.status,headers:combined});
  }catch(e){return new Response(JSON.stringify({error:e.status?e.message:'连接暂时不可用'}),{status:e.status||500,headers:{...headers,'Content-Type':'application/json'}})}
 }
};
