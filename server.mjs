import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const data=resolve(process.env.DATA_DIR||resolve(root,'data')); mkdirSync(data,{recursive:true});
const db=new DatabaseSync(resolve(data,'rooms.db'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY,invite TEXT NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL,round INTEGER DEFAULT 1,game INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS players(room TEXT,seat INTEGER,token TEXT UNIQUE,name TEXT,seen INTEGER,vote INTEGER DEFAULT 0,PRIMARY KEY(room,seat));
CREATE TABLE IF NOT EXISTS words(room TEXT,game INTEGER,round INTEGER,seat INTEGER,word TEXT,PRIMARY KEY(room,game,round,seat));`);
const run=(q,...p)=>db.prepare(q).run(...p),one=(q,...p)=>db.prepare(q).get(...p),all=(q,...p)=>db.prepare(q).all(...p);
const secret=()=>randomBytes(24).toString('hex'),hash=x=>createHash('sha256').update(x).digest('hex');
const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
const normalize=w=>w.normalize('NFKC').trim().toLocaleLowerCase('zh-CN');
const limits=new Map();
function limit(key,max){const now=Date.now();let x=limits.get(key);if(!x||now-x.t>60000){x={t:now,n:0};limits.set(key,x)}if(++x.n>max)fail(429,'操作太快了，请稍后再试');}
function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const v=fn();db.exec('COMMIT');return v}catch(e){db.exec('ROLLBACK');throw e}}
function state(room,player){
 const ps=all('SELECT seat,name,seen,vote FROM players WHERE room=? ORDER BY seat',room.id);
 const ws=all('SELECT round,seat,word FROM words WHERE room=? AND game=? ORDER BY round,seat',room.id,room.game);
 const current=ws.filter(w=>w.round===room.round),revealed=current.length===2;
 const won=revealed&&normalize(current[0].word)===normalize(current[1].word);
 const history=[];for(let r=1;r<=room.round;r++){const words=ws.filter(w=>w.round===r);if(words.length===2)history.push({round:r,words:words.map(w=>w.word)})}
 return {id:room.id,seat:player.seat,round:room.round,game:room.game,won,revealed,players:ps.map(p=>({...p,online:Date.now()-p.seen<15000,submitted:current.some(w=>w.seat===p.seat)})),myWord:current.find(w=>w.seat===player.seat)?.word||'',history};
}
const files={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8']};
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 try{
 const url=new URL(req.url,'http://localhost');
 if(!url.pathname.startsWith('/api/')){if(req.method!=='GET'&&req.method!=='HEAD')fail(405,'不支持的请求');const f=files[url.pathname];if(!f)fail(404,'页面不存在');res.setHeader('Content-Type',f[1]);res.setHeader('Cache-Control','no-cache');res.end(req.method==='HEAD'?undefined:readFileSync(resolve(root,'public',f[0])));return}
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method==='POST'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)fail(403,'请从本站操作');
 let body={};if(req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192)fail(413,'内容太长')}try{body=JSON.parse(raw||'{}')}catch{fail(400,'请求格式错误')}}
 const ip=req.socket.remoteAddress;limit(ip,300);
 let output;
 if(url.pathname==='/api/create'&&req.method==='POST'){
 limit('create:'+ip,10);
 const name=String(body.name||'').trim();if(!name||name.length>16)fail(400,'昵称请填写 1–16 个字');
 output=transaction(()=>{if(one('SELECT count(*) AS n FROM rooms').n>=10000)fail(503,'房间已满，请稍后再试');const id=randomBytes(8).toString('hex'),invite=secret(),token=secret(),now=Date.now();run('INSERT INTO rooms(id,invite,created,updated) VALUES(?,?,?,?)',id,hash(invite),now,now);run('INSERT INTO players(room,seat,token,name,seen) VALUES(?,0,?,?,?)',id,hash(token),name,now);return {id,invite,token}});
 }else if(url.pathname==='/api/join'&&req.method==='POST'){
 output=transaction(()=>{const room=one('SELECT * FROM rooms WHERE id=?',String(body.id));if(!room||room.invite!==hash(String(body.invite)))fail(404,'邀请链接无效或房间已过期');if(one('SELECT count(*) AS n FROM players WHERE room=?',room.id).n>=2)fail(409,'房间已有两人，无法再加入');const name=String(body.name||'').trim();if(!name||name.length>16)fail(400,'昵称请填写 1–16 个字');const token=secret();run('INSERT INTO players(room,seat,token,name,seen) VALUES(?,1,?,?,?)',room.id,hash(token),name,Date.now());run('UPDATE rooms SET updated=? WHERE id=?',Date.now(),room.id);return {id:room.id,token}});
 }else{
 const token=req.headers.authorization?.replace(/^Bearer /,'')||'';const player=one('SELECT * FROM players WHERE token=?',hash(token));if(!player)fail(401,'房间身份失效，请使用邀请链接重新进入');let room=one('SELECT * FROM rooms WHERE id=?',player.room);if(!room)fail(404,'房间已过期');
 run('UPDATE players SET seen=? WHERE token=?',Date.now(),player.token);run('UPDATE rooms SET updated=? WHERE id=?',Date.now(),room.id);
 if(url.pathname==='/api/state'&&req.method==='GET')output=state(room,player);
 else if(url.pathname==='/api/word'&&req.method==='POST')output=transaction(()=>{
 room=one('SELECT * FROM rooms WHERE id=?',player.room);
 if(body.game!==room.game||body.round!==room.round)fail(409,'轮次已更新，请查看最新进度');
 if(one('SELECT count(*) AS n FROM players WHERE room=?',room.id).n!==2)fail(409,'等朋友加入后再开始');
 const word=String(body.word||'').normalize('NFKC').trim();if(!word||Array.from(word).length>20||/[\p{Cc}\p{Cf}]/u.test(word))fail(400,'请输入 1–20 个字，不要包含控制字符');
 const old=one('SELECT word FROM words WHERE room=? AND game=? AND round=? AND seat=?',room.id,room.game,room.round,player.seat);if(old&&old.word!==word)fail(409,'词语已锁定，不能修改');
 run('INSERT OR IGNORE INTO words(room,game,round,seat,word) VALUES(?,?,?,?,?)',room.id,room.game,room.round,player.seat,word);return state(room,player);
 });
 else if(url.pathname==='/api/next'&&req.method==='POST')output=transaction(()=>{
 room=one('SELECT * FROM rooms WHERE id=?',player.room);if(body.game!==room.game||body.round!==room.round) return state(room,player);
 const s=state(room,player);if(!s.revealed)fail(409,'双方写好词后才能继续');
 run('UPDATE players SET vote=1 WHERE room=? AND seat=?',room.id,player.seat);
 if(one('SELECT count(*) AS n FROM players WHERE room=? AND vote=1',room.id).n===2){if(s.won)run('UPDATE rooms SET game=game+1,round=1 WHERE id=?',room.id);else {if(room.round>=100)fail(400,'本局已达 100 轮，请创建新房间');run('UPDATE rooms SET round=round+1 WHERE id=?',room.id)}run('UPDATE players SET vote=0 WHERE room=?',room.id)}
 return state(one('SELECT * FROM rooms WHERE id=?',room.id),player);
 });else fail(404,'接口不存在');
 }
 res.end(JSON.stringify(output));
 }catch(e){res.statusCode=e.status||500;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify({error:e.status?e.message:'服务暂时不可用，请重试'}));if(!e.status)console.error(e)}
});
const cleanup=setInterval(()=>{const cutoff=Date.now()-7*86400000;transaction(()=>{run('DELETE FROM words WHERE room IN (SELECT id FROM rooms WHERE updated<?)',cutoff);run('DELETE FROM players WHERE room IN (SELECT id FROM rooms WHERE updated<?)',cutoff);run('DELETE FROM rooms WHERE updated<?',cutoff)});for(const [k,v] of limits)if(Date.now()-v.t>60000)limits.delete(k)},60000);cleanup.unref();
server.listen(Number(process.env.PORT||3000),process.env.HOST||'0.0.0.0',()=>console.log(`Word Meet listening on ${server.address().port}`));
