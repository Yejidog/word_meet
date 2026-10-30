import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
test('two players: hidden answers, retries, round transitions and durable restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'word-meet-test-'));let child,base;
 async function start(){child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});let logs='';for await(const chunk of child.stdout){logs+=chunk;const match=logs.match(/listening on (\d+)/);if(match){base='http://127.0.0.1:'+match[1];return}}throw Error('server did not start')}
 async function stop(){const ended=once(child,'exit');child.kill();await ended}
 async function call(path,body,token,status=200){const r=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data}
 try{
 await start();assert.equal((await fetch(base)).status,200);
 const a=await call('create',{name:'小叶'});await call('state',null,null,401);
 await call('join',{id:a.id,invite:'wrong',name:'陌生人'},null,404);
 const b=await call('join',{id:a.id,invite:a.invite,name:'朋友'});
 await call('join',{id:a.id,invite:a.invite,name:'第三人'},null,409);
 const send=(token,word,round=1,game=1,status=200)=>call('word',{word,round,game},token,status);
 await send(a.token,'海浪');let view=await call('state',null,b.token);assert.equal(view.myWord,'');assert.deepEqual(view.history,[]);assert.equal(JSON.stringify(view).includes('海浪'),false);
 await send(a.token,'海浪');await send(a.token,'偷偷换词',1,1,409);
 await send(b.token,'夏天');view=await call('state',null,a.token);assert.equal(view.revealed,true);assert.equal(view.won,false);assert.deepEqual(view.history[0].words,['海浪','夏天']);
 await call('next',{round:1,game:1},a.token);view=await call('state',null,a.token);assert.equal(view.round,1);
 await call('next',{round:1,game:1},b.token);await call('next',{round:1,game:1},a.token);view=await call('state',null,a.token);assert.equal(view.round,2);
 await send(a.token,'海边',1,1,409);await send(a.token,'海边',2);
 await stop();await start();view=await call('state',null,a.token);assert.equal(view.myWord,'海边');assert.equal(view.round,2);assert.equal(view.history.length,1);
 view=await send(b.token,'海边',2);assert.equal(view.won,true);
 await call('next',{round:2,game:1},a.token);view=await call('next',{round:2,game:1},b.token);assert.equal(view.game,2);assert.equal(view.round,1);assert.deepEqual(view.history,[]);
 await send(a.token,'\u200b',1,2,400);
 const other=await call('create',{name:'其他房间'});assert.notEqual(other.id,a.id);view=await call('state',null,other.token);assert.equal(view.players.length,1);
 }finally{if(child?.exitCode===null)await stop();await rm(dir,{recursive:true,force:true})}
});
