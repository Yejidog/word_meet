const $=id=>document.getElementById(id);
const store={get(k){try{return localStorage.getItem('wm:'+k)}catch{return null}},set(k,v){try{localStorage.setItem('wm:'+k,v)}catch{notify('浏览器未允许保存数据，关闭页面后可能无法恢复房间。')}}};
let session=null,current=null,busy=false,polling=false,timer,noticeTimer,signature='',failures=0,revision=0;
const fragment=new URLSearchParams(location.hash.slice(1));
const inviteId=fragment.get('room'),inviteSecret=fragment.get('invite');
function notify(message){$('notice').textContent=message;$('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').hidden=true,6500)}
async function api(path,body,token=session?.token){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);try{const res=await fetch('/api/'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:controller.signal,cache:'no-store'});const data=await res.json();if(!res.ok)throw Object.assign(new Error(data.error||'请求失败'),{status:res.status});return data}catch(e){if(e.name==='AbortError')throw new Error('连接超时，稍后自动重连');throw e}finally{clearTimeout(timeout)}}
function loadSession(id){try{return JSON.parse(store.get('session:'+id)||'null')}catch{return null}}
function remember(s){session=s;store.set('session:'+s.id,JSON.stringify(s));store.set('last',s.id)}
function updateHash(){history.replaceState(null,'','#'+new URLSearchParams({room:session.id,...(session.invite?{invite:session.invite}:{})}))}
function enterRoom(){signature='';$('lobby').hidden=true;$('room').hidden=false;updateHash();schedule(0)}
function schedule(ms=2000){clearTimeout(timer);timer=setTimeout(sync,ms)}
async function sync(){if(!session||polling)return;polling=true;const started=revision;try{const s=await api('state');failures=0;$('network').textContent='● 已同步';if(started===revision&&!busy)render(s)}catch(e){failures++;$('network').textContent=navigator.onLine?'连接中，正在重试…':'网络已断开，等待恢复…';if(e.status===401||e.status===404){notify(e.message);session=null;$('room').hidden=true;$('lobby').hidden=false;configureLobby()}}finally{polling=false;if(session)schedule(document.hidden?10000:Math.min(2000*2**Math.min(failures,3),15000))}}
function draftKey(s){return 'draft:'+s.id+':'+s.game+':'+s.round}
function node(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e}
function render(s){current=s;
 const sig=JSON.stringify({...s,players:s.players.map(({seen,...p})=>p)});if(sig===signature)return;signature=sig;
 $('room-number').textContent='双人私房 · '+s.id.slice(0,6).toUpperCase();$('invite').hidden=!session.invite;
 const me=s.players.find(p=>p.seat===s.seat),friend=s.players.find(p=>p.seat!==s.seat),ready=!!friend;
 const players=$('players');players.replaceChildren();for(let seat=0;seat<2;seat++){const p=s.players.find(p=>p.seat===seat);const card=node('div','','player');card.append(node('span',p?Array.from(p.name)[0]:'?','avatar'));const info=node('div','');info.append(node('strong',p?p.name+(seat===s.seat?' · 你':''):'等待朋友'));info.append(node('small',p?(p.online?'在线':'暂时离开')+' · '+(p.submitted?'已写好':'正在联想'):'邀请后就能开始'));card.append(info);players.append(card)}
 $('round-label').textContent='ROUND '+String(s.round).padStart(2,'0');$('phase').textContent=s.won?'默契达成':s.round===1?'自由联想':'联想靠近';
 $('prompt').textContent=!ready?'留一个位置，给你的朋友。':s.won?'我们，在同一个词里相遇了。':s.revealed?'两个想法，下一站会是哪里？':s.myWord?'你的词，已经悄悄放好了。':'此刻，你想到了什么？';
 const previous=s.history.find(h=>h.round===s.round-1);
 $('hint').textContent=!ready?'复制右上角的邀请链接，发给朋友。':s.won?`用了 ${s.round} 轮，找到属于你们的默契。`:previous?`试着把「${previous.words[0]}」和「${previous.words[1]}」联系起来。`:'第一个词，没有标准答案。';
 $('word-form').hidden=s.revealed;$('reveal').hidden=!s.revealed;$('next').hidden=!s.revealed;
 if(s.revealed){const h=s.history.find(h=>h.round===s.round);$('reveal').replaceChildren(...h.words.map(w=>node('div',w)));$('next').textContent=me.vote?'等朋友准备好…':s.won?'再来一局 ↗':'继续靠近 ↗';$('next').disabled=!!me.vote||busy}
 const word=$('word');const key=draftKey(s);if(word.dataset.key!==key){word.dataset.key=key;word.value=store.get(key)||''}if(s.myWord)word.value=s.myWord;
 word.disabled=!ready||!!s.myWord;$('submit-word').disabled=!ready||!!s.myWord||busy;$('submit-word').textContent=s.myWord?'已锁定 ✓':'写好了 ↗';
 $('waiting').textContent=!ready?'房间已就绪，等朋友赴约。':s.revealed?(me.vote?'你已准备好，等朋友一起继续。':'两人都点击后，再开始下一轮。'):s.myWord?'等朋友写好后，两个词会一起揭晓。':friend.submitted?'朋友已经写好，正在等你。':'不着急，默契值得一点等待。';
 const list=$('history');list.replaceChildren();if(!s.history.length)list.append(node('p','这里会记下，你们一步步靠近的过程。','empty-history'));for(const h of [...s.history].reverse()){const row=node('div','','history-row');row.append(node('small',String(h.round).padStart(2,'0')),node('span',h.words[0]),node('i','↔'),node('span',h.words[1]));list.append(row)}
}
function configureLobby(){const invited=!!(inviteId&&inviteSecret);$('entry-title').textContent=invited?'朋友为你，留了一个位置。':'把今天的默契，留给一个人。';$('enter-button').textContent=invited?'加入朋友的房间 ↗':'创建我们的房间 ↗';$('entry-note').textContent=invited?'输入昵称，就可以赴约。':'无需注册 · 邀请链接加入 · 每个房间仅限两人';$('nickname').value=store.get('name')||''}
$('enter-form').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;busy=true;$('enter-button').disabled=true;try{const name=$('nickname').value.trim();store.set('name',name);const s=inviteId&&inviteSecret?await api('join',{id:inviteId,invite:inviteSecret,name},null):await api('create',{name},null);remember(s);enterRoom()}catch(e){notify(e.message)}finally{busy=false;$('enter-button').disabled=false}});
$('word').addEventListener('input',()=>{if(current)store.set(draftKey(current),$('word').value)});
$('word-form').addEventListener('submit',async e=>{e.preventDefault();if(busy||!current)return;busy=true;revision++;$('submit-word').disabled=true;const payload={word:$('word').value,game:current.game,round:current.round};try{const s=await api('word',payload);busy=false;signature='';render(s)}catch(e){notify(e.message);busy=false;signature='';if(current)render(current);schedule(0)}finally{busy=false}});
$('next').addEventListener('click',async()=>{if(busy||!current)return;busy=true;revision++;$('next').disabled=true;try{const s=await api('next',{game:current.game,round:current.round});busy=false;signature='';render(s)}catch(e){notify(e.message);busy=false;signature='';if(current)render(current);schedule(0)}finally{busy=false}});
$('invite').addEventListener('click',async()=>{const link=location.origin+'/#'+new URLSearchParams({room:session.id,invite:session.invite});try{await navigator.clipboard.writeText(link);notify('邀请链接已复制，发给你的朋友吧。')}catch{$('share-url').value=link;$('share-dialog').showModal();$('share-url').select()}});
$('close-share').addEventListener('click',()=>$('share-dialog').close());
$('leave').addEventListener('click',()=>{store.set('last','');location.href='/'});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session)schedule(0)});window.addEventListener('online',()=>session&&schedule(0));
configureLobby();
const saved=loadSession(inviteId||store.get('last'));if(saved){remember(saved);enterRoom()}
