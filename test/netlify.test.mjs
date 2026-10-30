import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeHandler} from '../netlify/functions/game.mjs';
test('Netlify relay forwards game credentials to fixed upstream and preserves errors',async()=>{
 let captured;
 const handler=makeHandler(async(url,options)=>{captured={url,options};return Response.json({error:'房间已有两人'},{status:409})});
 const req=new Request('https://example.netlify.app/api/join',{method:'POST',headers:{Origin:'https://example.netlify.app',Authorization:'Bearer private-token','X-Room-ID':'room-id'},body:JSON.stringify({id:'room-id',invite:'invite'})});
 let res=await handler(req);assert.equal(res.status,409);assert.equal((await res.json()).error,'房间已有两人');assert.equal(captured.url,'https://word-meet.siroooo0502.workers.dev/api/join');assert.equal(captured.options.headers.Authorization,'Bearer private-token');assert.equal(captured.options.headers['X-Room-ID'],'room-id');assert.equal(captured.options.headers.Origin,undefined);
 res=await handler(new Request('https://example.netlify.app/api/state',{headers:{Origin:'https://bad.example'}}));assert.equal(res.status,403);
 res=await handler(new Request('https://example.netlify.app/api/health',{method:'OPTIONS',headers:{Origin:'https://yejidog.github.io'}}));assert.equal(res.status,204);assert.equal(res.headers.get('Access-Control-Allow-Origin'),'https://yejidog.github.io');
 res=await handler(new Request('https://example.netlify.app/api/anything'));assert.equal(res.status,404);
 res=await handler(new Request('https://example.netlify.app/api/health',{method:'POST',body:'{}'}));assert.equal(res.status,405);
 res=await handler(new Request('https://example.netlify.app/api/create',{method:'POST',body:'x'.repeat(8193)}));assert.equal(res.status,413);
 const broken=makeHandler(async()=>{throw Error('network')});res=await broken(new Request('https://example.netlify.app/api/health'));assert.equal(res.status,504);
 const html=makeHandler(async()=>new Response('<html>bad upstream</html>'));res=await html(new Request('https://example.netlify.app/api/health'));assert.equal(res.status,502);
});
