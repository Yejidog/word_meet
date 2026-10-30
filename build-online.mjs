import {readFileSync,writeFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const api=process.argv[2];
if(!api||new URL(api).protocol!=='https:')throw Error('Pass the deployed HTTPS Worker origin');
const origin=new URL(api).origin;
let html=read('./public/index.html');
let js=read('./public/app.js');
js=js.replace("fetch('/api/'+path,",'fetch('+JSON.stringify(origin)+"+'/api/'+path,");
js=js.replace("Authorization:'Bearer '+token", "Authorization:'Bearer '+token,'X-Room-ID':session.id");
js=js.replace("location.origin+'/#'", "location.origin+location.pathname+'#'");
js=js.replace("location.href='/'", "location.href=location.pathname");
// Avoid excessive request usage on the free tier.
js=js.replace('schedule(ms=2000)','schedule(ms=3000)').replace('2000*2**','3000*2**');
html=html.replace('<link rel="stylesheet" href="/style.css"><script src="/app.js" defer></script>','<style>'+read('./public/style.css')+'</style>');
html=html.replace('href="/"','href="./"');
html=html.replace('</body>','<script>'+js+'</script></body>');
writeFileSync(new URL('./online.html',import.meta.url),html);
console.log('Built online.html using '+origin);
