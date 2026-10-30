const $=id=>document.getElementById(id);
const KEY='word-meet:local-demo:v1';
let game=null,turn=0,handing=false;
function notice(text){$('notice').textContent=text;$('notice').hidden=false;setTimeout(()=>$('notice').hidden=true,5000)}
function save(){try{localStorage.setItem(KEY,JSON.stringify(game))}catch{notice('当前浏览器无法保存进度，请保持页面打开。')}}
function el(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e}
function matches(a,b){return a.normalize('NFKC').trim().toLowerCase()===b.normalize('NFKC').trim().toLowerCase()}
function render(){
 $('lobby').hidden=true;$('room').hidden=false;$('invite').hidden=true;
 $('room-number').textContent='同屏试玩 · 两人轮流使用一部手机';$('network').textContent='● 本机运行，无需联机';
 const revealed=game.words.every(Boolean),won=revealed&&matches(...game.words);
 turn=game.words[0]?1:0;
 $('players').replaceChildren(...game.names.map((name,i)=>{const p=el('div','','player');p.append(el('span',String(i+1),'avatar'));const t=el('div','');t.append(el('strong',name),el('small',game.words[i]?'已写好':!revealed&&i===turn?'轮到你了':'等待接过手机'));p.append(t);return p}));
 $('round-label').textContent='ROUND '+String(game.round).padStart(2,'0');$('phase').textContent=won?'默契达成':game.round===1?'自由联想':'联想靠近';
 $('prompt').textContent=handing?'请把手机交给 '+game.names[1]:won?'我们，在同一个词里相遇了。':revealed?'两个想法，下一站会是哪里？':game.names[turn]+'，你想到了什么？';
 const last=game.history.at(-1);
 $('hint').textContent=handing?'第一位的答案已收好。接过手机后，点击下方按钮。':won?'用了 '+game.round+' 轮，找到属于你们的默契。':last?'联系「'+last.words[0]+'」和「'+last.words[1]+'」，写下新的联想。':'第一轮随心写，不要提前商量。';
 $('word-form').hidden=revealed||handing;$('reveal').hidden=!revealed;$('next').hidden=!(revealed||handing);
 $('word').value='';$('word').disabled=false;$('submit-word').disabled=false;
 if(revealed)$('reveal').replaceChildren(...game.words.map(w=>el('div',w)));
 $('next').textContent=handing?'我接过手机了，开始写词 ↗':won?'再来一局 ↗':'继续靠近 ↗';$('next').disabled=false;
 $('waiting').textContent=handing?'请上一位暂时移开视线。':revealed?'两人都写好后，答案在这里一起揭晓。':'写好后会进入交接页面，不会显示第一位的词。';
 const history=$('history');history.replaceChildren();const rounds=[...game.history,...(revealed?[{round:game.round,words:game.words}]:[])];
 if(!rounds.length)history.append(el('p','这里会记下，你们一步步靠近的过程。','empty-history'));
 for(const h of rounds.reverse()){const row=el('div','','history-row');row.append(el('small',String(h.round).padStart(2,'0')),el('span',h.words[0]),el('i','↔'),el('span',h.words[1]));history.append(row)}
}
$('enter-form').addEventListener('submit',e=>{e.preventDefault();const name=$('nickname').value.trim();if(!name)return;game={names:[name,'朋友'],round:1,history:[],words:['','']};handing=false;save();render()});
$('word-form').addEventListener('submit',e=>{e.preventDefault();const word=$('word').value.normalize('NFKC').trim();if(!word||Array.from(word).length>20||/[\p{Cc}\p{Cf}]/u.test(word)){notice('请输入 1–20 个字');return}game.words[turn]=word;if(turn===0)handing=true;save();render()});
$('next').addEventListener('click',()=>{if(handing){handing=false;render();return}if(matches(...game.words)){game.round=1;game.history=[]}else{game.history.push({round:game.round,words:[...game.words]});game.round++}game.words=['',''];save();render()});
$('leave').addEventListener('click',()=>{$('room').hidden=true;$('lobby').hidden=false});
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&Array.isArray(saved.names)&&saved.names.length===2&&Array.isArray(saved.words)&&saved.words.length===2&&Array.isArray(saved.history)&&Number.isInteger(saved.round)){game=saved;handing=!!game.words[0]&&!game.words[1];render()}}catch{}
