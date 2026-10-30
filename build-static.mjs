import {readFileSync,writeFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
let html=read('./public/index.html');
html=html.replace('<link rel="stylesheet" href="/style.css"><script src="/app.js" defer></script>','<style>'+read('./public/style.css')+'</style>');
html=html.replace('href="/"','href="./"').replace('创建我们的房间','开始同屏试玩').replace('把今天的默契，留给一个人。','先用一部手机，试试你们的默契。').replace('无需注册 · 邀请链接加入 · 每个房间仅限两人','同屏试玩：两人轮流使用一部手机 · 异地联机尚未接入').replace('你的昵称','第一位玩家的昵称').replace('朋友怎么称呼你？','输入你的昵称，另一位暂称“朋友”').replace('临时离开没关系，回到此浏览器就能接着玩。<br>房间在连续 7 天未使用后清理；请保留浏览器数据。','这是 GitHub Pages 同屏试玩版，答案和进度只保存在本机浏览器。<br>两部手机暂时不能自动同步；清理浏览器数据会丢失进度。');
html=html.replace('</body>','<script>'+read('./public/demo.js')+'</script></body>');
writeFileSync(new URL('./index.html',import.meta.url),html);
writeFileSync(new URL('./.nojekyll',import.meta.url),'');
console.log('Built standalone index.html for GitHub Pages.');
