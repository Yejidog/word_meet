import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker,{Room} from '../cloudflare/worker.mjs';
test('Cloudflare protocol: CORS, seat limits, hidden words, concurrent submissions and recovery',async()=>{
 const contexts=new Map(),objects=new Map();
 function context(){const values=new Map();let chain=Promise.resolve();return {storage:{async get(k){return structuredClone(values.get(k))},async put(k,v){values.set(k,structuredClone(v))},async deleteAll(){values.clear()},async setAlarm(t){this.alarm=t}},blockConcurrencyWhile(fn){const task=chain.then(fn);chain=task.catch(()=>{});return task}}}
 const env={ALLOWED_ORIGIN:'https://yejidog.github.io',ROOMS:{idFromName:id=>id,get(id){if(!contexts.has(id))contexts.set(id,context());if(!objects.has(id))objects.set(id,new Room(contexts.get(id),env));return {fetch:r=>objects.get(id).fetch(r)}}}};
 async function call(action,body,player,status=200,origin='https://yejidog.github.io'){
 const response=await worker.fetch(new Request('https://example.workers.dev/api/'+action,{method:body?'POST':'GET',headers:{Origin:origin,...(player?{Authorization:'Bearer '+player.token,'X-Room-ID':player.id}:{}),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),env);
 assert.equal(response.status,status);if(status===403)return;assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);return response.json();
 }
 await call('health',null,null,403,'https://other.example');
 const preflight=await worker.fetch(new Request('https://example.workers.dev/api/word',{method:'OPTIONS',headers:{Origin:'https://yejidog.github.io'}}),env);assert.equal(preflight.status,204);assert.match(preflight.headers.get('Access-Control-Allow-Headers'),/X-Room-ID/);
 const a=await call('create',{name:'一'});await call('join',{id:a.id,name:'冒名',invite:'wrong'},null,404);
 const b=await call('join',{id:a.id,invite:a.invite,name:'二'});await call('join',{id:a.id,invite:a.invite,name:'三'},null,409);
 await call('state',null,{id:a.id,token:'invalid'},401);
 const word=(p,w,round=1,game=1,status=200)=>call('word',{word:w,round,game},p,status);
 await word(a,'海浪');let s=await call('state',null,b);assert.equal(s.myWord,'');assert.deepEqual(s.history,[]);assert.ok(!JSON.stringify(s).includes('海浪'));
 await word(a,'海浪');await word(a,'改词',1,1,409);await word(b,'夏天');
 const next=(p,round=1,game=1)=>call('next',{round,game},p);
 await Promise.all([next(a),next(b)]);s=await call('state',null,a);assert.equal(s.round,2);assert.equal(s.history.length,1);
 await next(a);assert.equal((await call('state',null,a)).round,2);
 await word(a,'海边',2);objects.clear();s=await call('state',null,a);assert.equal(s.myWord,'海边');assert.equal(s.round,2);
 await word(b,'海边',2);assert.equal((await call('state',null,b)).won,true);
 await Promise.all([next(a,2),next(b,2)]);s=await call('state',null,a);assert.equal(s.game,2);assert.equal(s.round,1);assert.deepEqual(s.history,[]);
 await word(a,'\u200b',1,2,400);await word(a,'过期',2,1,409);
});
