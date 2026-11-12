(function(){
'use strict';
const E=globalThis.WordEngine;
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep=ms=>new Promise(r=>setTimeout(r,reduced()?Math.min(ms,30):ms));
const num=n=>Math.round(n).toLocaleString();
function pts(v){const x=v*100;if(x<=0)return '0';if(x<0.1)return '<0.1';if(x>99.9&&x<100)return '>99.9';return x.toFixed(1).replace(/\.0$/,'');}
function oneIn(p){if(!(p>0))return 'never';const n=1/p;return '1 in '+(n<10?n.toFixed(1).replace(/\.0$/,''):num(n));}
function pct(p){const x=p*100;if(x<=0)return '0%';if(x>=10)return Math.round(x)+'%';if(x>=1)return x.toFixed(1)+'%';if(x>=1e-5)return Number(x.toPrecision(2)).toString()+'%';return 'under 0.00001%';}
const q=w=>'“'+esc(w)+'”';
let toastTimer;
function toast(t){const el=$('toast');el.textContent=t;el.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('on'),2600);}

/* ---------- Inspector Spec ---------- */
function specSVG(size=62){return `<svg class="spec" viewBox="0 -10 100 110" width="${size}" height="${size}" aria-hidden="true"><rect x="58" y="60" width="15" height="38" rx="7.5" transform="rotate(-42 65 79)" fill="#F77F00" stroke="#1a1f2e" stroke-width="4"/><circle cx="44" cy="44" r="31" fill="#eaf1ff" stroke="#7B2CBF" stroke-width="8"/><ellipse cx="31" cy="31" rx="8" ry="4.5" fill="#fff" opacity=".95" transform="rotate(-32 31 31)"/><circle cx="34" cy="47" r="5.2" fill="#1a1f2e"/><circle cx="54" cy="47" r="5.2" fill="#1a1f2e"/><circle cx="35.8" cy="45.2" r="1.7" fill="#fff"/><circle cx="55.8" cy="45.2" r="1.7" fill="#fff"/><path d="M27.5 37.5q6-5 12-1.5M48.5 36q6-3.5 12 1.5" stroke="#1a1f2e" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M36 58q8 7 16 0" stroke="#1a1f2e" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M26 11C27-6 61-6 62 11Z" fill="#1a1f2e"/><rect x="27.5" y="3.5" width="33" height="5" rx="1" fill="#FFB703"/><ellipse cx="44" cy="12" rx="27" ry="5.5" fill="#1a1f2e"/></svg>`;}
function fillSpecSlots(root=document){root.querySelectorAll('.spec-slot').forEach(s=>{s.outerHTML=specSVG(+s.dataset.size||62);});}
const specSays=(html)=>`<div class="spec-says">${specSVG(62)}<p><span class="spec-name">Inspector Spec</span>${html}</p></div>`;
const zapSVG='<svg viewBox="0 0 60 44" aria-hidden="true"><path d="M33 2 18 22h11l-6 20 22-26H33l7-14z" fill="#FFB703" stroke="#1a1f2e" stroke-width="2.5" stroke-linejoin="round"/><path d="M6 12l7 4M4 26h8M52 30l-7-3" stroke="#E63946" stroke-width="3" stroke-linecap="round"/></svg>';

/* ---------- Edits: alignment, stories, animation ---------- */
function editOps(from,to){
  const n=from.length,m=to.length,d=Array.from({length:n+1},()=>new Array(m+1).fill(0));
  for(let i=0;i<=n;i++)d[i][0]=i;for(let j=0;j<=m;j++)d[0][j]=j;
  for(let i=1;i<=n;i++)for(let j=1;j<=m;j++){
    d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(from[i-1]===to[j-1]?0:1));
    if(i>1&&j>1&&from[i-1]===to[j-2]&&from[i-2]===to[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
  }
  const ops=[];let i=n,j=m;
  while(i>0||j>0){
    if(i>0&&j>0&&from[i-1]===to[j-1]&&d[i][j]===d[i-1][j-1]){ops.push({t:'keep',c:from[i-1]});i--;j--;continue;}
    if(i>1&&j>1&&from[i-1]===to[j-2]&&from[i-2]===to[j-1]&&from[i-1]!==from[i-2]&&d[i][j]===d[i-2][j-2]+1){ops.push({t:'swap',a:from[i-2],b:from[i-1]});i-=2;j-=2;continue;}
    if(i>0&&j>0&&d[i][j]===d[i-1][j-1]+1){ops.push({t:'sub',a:from[i-1],b:to[j-1]});i--;j--;continue;}
    if(i>0&&d[i][j]===d[i-1][j]+1){ops.push({t:'del',a:from[i-1]});i--;continue;}
    ops.push({t:'ins',b:to[j-1]});j--;
  }
  return ops.reverse();
}
// Story from the meaning side: you meant `meant`, the screen shows `typed`.
function slipStory(meant,typed){
  const ops=editOps(meant,typed).filter(o=>o.t!=='keep');if(!ops.length)return 'no slip';
  const dels=ops.filter(o=>o.t==='del'),ins=ops.filter(o=>o.t==='ins'),parts=[];
  if(dels.length)parts.push('left out '+dels.map(o=>q(o.a)).join(' and '));
  if(ins.length)parts.push('added an extra '+ins.map(o=>q(o.b)).join(' and '));
  ops.forEach(o=>{if(o.t==='sub')parts.push(`hit ${q(o.b)} instead of ${q(o.a)}`);else if(o.t==='swap')parts.push(`swapped ${q(o.a)} and ${q(o.b)}`);});
  return parts.join(' and ');
}
// Story from the detective side: fix the typo to get the suspect.
function fixStory(typo,word){
  const parts=editOps(typo,word).filter(o=>o.t!=='keep').map(o=>o.t==='del'?`take out ${q(o.a)}`:o.t==='ins'?`put in ${q(o.b)}`:o.t==='sub'?`change ${q(o.a)} to ${q(o.b)}`:`swap ${q(o.a)} and ${q(o.b)}`);
  return parts.length?parts.join(', then '):'no change';
}
const tilesHTML=(w,cls='')=>`<span class="tiles ${cls}">${[...w].map(c=>`<span class="tile">${esc(c)}</span>`).join('')}</span>`;
function mkTile(c){const s=document.createElement('span');s.className='tile';s.textContent=c;return s;}
async function animateEdit(host,from,to,mode,alive=()=>true,size=''){
  const ops=editOps(from,to);
  const row=document.createElement('span');row.className=`tiles ${size} ${mode}`;host.innerHTML='';host.appendChild(row);
  const steps=[];
  for(const op of ops){
    if(op.t==='keep')row.appendChild(mkTile(op.c));
    else if(op.t==='sub'){const el=mkTile(op.a);row.appendChild(el);steps.push(async()=>{el.classList.add('flip');await sleep(230);el.textContent=op.b;el.classList.add('changed');el.classList.remove('flip');});}
    else if(op.t==='del'){const el=mkTile(op.a);row.appendChild(el);steps.push(async()=>{el.classList.add('leaving');await sleep(420);el.classList.add('gone');});}
    else if(op.t==='ins'){const el=mkTile(op.b);el.classList.add('hidden-in');row.appendChild(el);steps.push(async()=>{el.classList.remove('hidden-in');el.classList.add('changed','pop');});}
    else{const a=mkTile(op.a),b=mkTile(op.b);row.append(a,b);steps.push(async()=>{const dx=b.offsetLeft-a.offsetLeft;a.classList.add('changed');b.classList.add('changed');a.style.transform=`translate(${dx}px,-12px)`;b.style.transform=`translate(${-dx}px,12px)`;await sleep(560);a.style.transition=b.style.transition='none';a.style.transform=b.style.transform='';a.textContent=op.b;b.textContent=op.a;void a.offsetWidth;a.style.transition=b.style.transition='';});}
  }
  await sleep(500);
  for(const s of steps){if(!alive())return;await s();await sleep(420);}
}

/* ---------- The noisy typist: samples the exact channel the model scores ---------- */
const SYMS='abcdefghijklmnopqrstuvwxyz\'';
function noisyType(w){
  let out='',i=0;const n=w.length,rnd=()=>SYMS[Math.floor(Math.random()*27)];
  for(let guard=0;guard<400;guard++){
    const r=Math.random();
    if(i===n){if(r<.01){out+=rnd();continue;}break;}
    if(r<.01){out+=rnd();continue;}
    if(r<.025){i++;continue;}
    const sw=i+1<n?.035:0;
    if(r<.025+sw){out+=w[i+1]+w[i];i+=2;continue;}
    if(Math.random()<.955)out+=w[i];else{let c;do c=rnd();while(c===w[i]);out+=c;}
    i++;
  }
  return out;
}
function markDiff(meant,typed){ // highlight typed letters that are not kept from `meant`
  let html='';for(const o of editOps(meant,typed)){if(o.t==='keep')html+=esc(o.c);else if(o.t==='sub')html+=`<em>${esc(o.b)}</em>`;else if(o.t==='ins')html+=`<em>${esc(o.b)}</em>`;else if(o.t==='swap')html+=`<em>${esc(o.b)}${esc(o.a)}</em>`;}
  return html||'<em>(nothing)</em>';
}

/* ---------- Model loading ---------- */
let model=null,engine=null;const waiting=[];
function whenReady(fn){if(engine)fn();else waiting.push(fn);}

/* ---------- Tabs ---------- */
const TABS=['journey','studio','teach','flip'];
function showTab(name,scroll=true){
  if(!TABS.includes(name))name='journey';
  TABS.forEach(t=>{$(t).hidden=t!==name;const b=$('tab-'+t);b.setAttribute('aria-selected',String(t===name));b.tabIndex=t===name?0:-1;});
  if(location.hash!=='#'+name){try{history.replaceState(null,'','#'+name);}catch(_){}}
  if(scroll)window.scrollTo({top:0,behavior:reduced()?'auto':'smooth'});
  if(name==='flip')renderChallenge();
}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
$('main').addEventListener('click',e=>{const g=e.target.closest('[data-goto]');if(g){showTab(g.dataset.goto);}});
document.querySelector('.tabs').addEventListener('keydown',e=>{if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;const i=TABS.findIndex(t=>$('tab-'+t).getAttribute('aria-selected')==='true');const n=(i+(e.key==='ArrowRight'?1:-1)+TABS.length)%TABS.length;showTab(TABS[n],false);$('tab-'+TABS[n]).focus();});
window.addEventListener('hashchange',()=>showTab(location.hash.slice(1),false));

/* =================================================================
   1. THE CASE: guided journey
   ================================================================= */
function channelHTML(id,o){
  const {meant='',typed,mystery=false,guess=''}=o;
  return `<div class="channel${mystery?' mystery':''}" id="${id}">
    <div class="station brain"><div class="box">${mystery?'<span class="qmark">?</span>':`<span class="phase p1">${tilesHTML(meant)}</span>`}</div><span class="cap">${mystery?'What you meant: hidden!':'What you mean'}</span></div>
    <div class="pipe"><span class="zap">${zapSVG}</span><svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path class="flow" d="M2 20C30 2 70 38 98 20"/></svg><span class="cap">Noisy fingers</span></div>
    <div class="station screen"><div class="box"><span class="phase p2">${tilesHTML(typed)}</span></div><span class="cap">What the screen shows</span></div>
    <div class="pipe back"><svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path class="flow" d="M2 20H98"/></svg><span class="cap">${mystery?'Work backwards':'Detective reads it'}</span></div>
    <div class="station guess"><div class="box gbox">${specSVG(50)}<span class="phase p3">${guess?tilesHTML(guess,'good-tiles'):'<span class="qmark">?</span>'}</span></div><span class="cap">Best guess</span></div>
    <span class="fall" aria-hidden="true"></span>
  </div>`;
}
async function playChannel(id,meant,typed,alive){
  const ch=$(id);if(!ch)return;
  const p1=ch.querySelector('.p1'),p2=ch.querySelector('.p2'),p3=ch.querySelector('.p3'),fall=ch.querySelector('.fall');
  ch.classList.remove('noisy');fall.classList.remove('go');
  [p2,p3].forEach(p=>p&&p.classList.add('hide'));
  if(p1){p1.classList.remove('hide');p1.querySelectorAll('.tile').forEach((t,i)=>{t.style.animation='none';void t.offsetWidth;t.style.animation=`pop .45s ${i*80}ms both`;});}
  await sleep(1100);if(!alive())return;
  ch.classList.add('noisy');
  const ops=editOps(meant,typed).filter(o=>o.t!=='keep');
  const pipe=ch.querySelector('.pipe'),pr=pipe.getBoundingClientRect(),cr=ch.getBoundingClientRect();
  fall.innerHTML=`<span class="tiles sm">${ops.map(o=>`<span class="tile typo">${esc(o.a||o.b)}</span>`).join('')}</span>`;
  fall.style.left=(pr.left-cr.left+pr.width/2-18)+'px';fall.style.top=(pr.top-cr.top+6)+'px';
  void fall.offsetWidth;fall.classList.add('go');
  await sleep(1200);if(!alive())return;
  if(p2)p2.classList.remove('hide');
  await sleep(900);if(!alive())return;
  ch.classList.remove('noisy');if(p3)p3.classList.remove('hide');
}

const J={i:0,ticket:0,guess:null,guess7:null,data:null,badge:false};
function jd(){
  if(J.data)return J.data;
  const make=text=>{const a=engine.analyze(text),iss=a.issues[0],rows=engine.rank(iss.word,iss.prev,iss.next,null,iss);return {text,iss,rows,by:w=>rows.find(r=>r.word===w)};};
  const main=make('This class is boing.');
  main.lineup=['boring','bowing','going','doing','boiling'].map(main.by).filter(Boolean);
  main.ctx=[main,make('This class is boing to the museum.'),make('The water is boing.')];
  return J.data=main;
}
const STEPS=[
  {lb:'Noise',title:'A word takes a noisy trip',fn:step1},
  {lb:'The problem',title:'The detective only sees the screen',fn:step2},
  {lb:'Suspects',title:'Round up the suspects',fn:step3,model:true},
  {lb:'Spelling clue',title:'Clue 1: the spelling clue',fn:step4,model:true},
  {lb:'Sentence clue',title:'Clue 2: the sentence clue',fn:step5,model:true},
  {lb:'Multiply',title:'Multiply the clues',fn:step6,model:true},
  {lb:'New sentence',title:'Same typo, new sentence',fn:step7,model:true},
  {lb:'Case closed',title:'Case closed!',fn:step8,model:true},
];
function renderJourney(focus){
  const t=++J.ticket,alive=()=>t===J.ticket;
  $('jdots').innerHTML=STEPS.map((s,i)=>`<li><button class="jdot ${i<J.i?'done':''} ${i===J.i?'current':''}" data-j="${i}" ${i===J.i?'aria-current="step"':''}><span class="seg"><i style="background-position:${i/(STEPS.length-1)*100}% 0"></i></span><span class="lb">${i+1}. ${esc(s.lb)}</span></button></li>`).join('');
  const s=STEPS[J.i];
  $('jstage').innerHTML=`<div class="step step-enter"><span class="step-kicker">Step ${J.i+1} of ${STEPS.length}</span><h2>${esc(s.title)}</h2><div id="sbody"></div></div>`;
  $('jcount').textContent=`Step ${J.i+1} of ${STEPS.length}: ${s.lb}`;
  $('jprev').disabled=J.i===0;
  $('jnext-label').textContent=J.i<STEPS.length-1?`Next: ${STEPS[J.i+1].lb}`:'Try your own sentences';
  if(s.model&&!engine){$('sbody').innerHTML=`<div class="empty">${specSVG(110)}<h3 class="loading-dots">Opening my library of 2 million sentences</h3><p>This takes a moment the first time.</p></div>`;whenReady(()=>{if(alive())renderJourney(false);});}
  else s.fn($('sbody'),alive);
  if(focus){$('jstage').focus({preventScroll:true});const top=document.querySelector('.journey').getBoundingClientRect().top+window.scrollY-80;if(window.scrollY>top)window.scrollTo({top,behavior:reduced()?'auto':'smooth'});}
}
function goStep(i){J.i=Math.max(0,Math.min(STEPS.length-1,i));renderJourney(true);}
$('jprev').onclick=()=>goStep(J.i-1);
$('jnext').onclick=()=>{if(J.i<STEPS.length-1)goStep(J.i+1);else showTab('studio');};
$('jdots').addEventListener('click',e=>{const b=e.target.closest('[data-j]');if(b)goStep(+b.dataset.j);});
document.addEventListener('keydown',e=>{if($('journey').hidden||e.altKey||e.ctrlKey||e.metaKey)return;const tag=(e.target.tagName||'').toLowerCase();if(tag==='input'||tag==='textarea'||document.querySelector('dialog[open]'))return;if(e.key==='ArrowRight'&&J.i<STEPS.length-1)goStep(J.i+1);if(e.key==='ArrowLeft'&&J.i>0)goStep(J.i-1);});

/* ---- Step 1: noise ---- */
function step1(el,alive){
  el.innerHTML=specSays(`Every typo starts as a word someone <i>meant</i>. Let's follow one word on its trip from a brain to a screen, and watch what can go wrong.`)+
  `${channelHTML('ch1',{meant:'boring',typed:'boing'})}<div style="display:flex;justify-content:flex-end;margin:-4px 0 10px"><button class="btn small" id="ch1-replay">Play the trip again</button></div>
  <div class="step-text"><p>You meant <b>boring</b>. Your fingers raced across the keys, and one letter got lost on the way. The screen shows <span class="typo-word">boing</span>.</p>
  <p>Scientists call this trip a <span class="term">noisy channel</span>. A message goes in, a little <b>noise</b> gets mixed in, and something slightly different comes out. For typing, the noise is small slips: a letter left out, an extra letter, a wrong key, or two neighbouring letters swapped.</p></div>
  <div class="activity-box"><div class="activity-head"><span class="activity-badge">Try it</span><span class="activity-title">Be a noisy typist</span></div>
    <p>This typist follows the lab's slip rules (you'll meet them in step 4). Most words come out fine. Sometimes, noise sneaks in. Every press is random, just like real slips.</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:12px"><label class="inline-field">Word to type <input id="nt-word" value="boring" maxlength="14" autocomplete="off" spellcheck="false"></label><button class="btn sun" id="nt-go">Type it 12 times</button></div>
    <div class="typed-grid" id="nt-out"></div><p class="fine" id="nt-sum" style="margin-top:10px"></p></div>`;
  playChannel('ch1','boring','boing',alive);
  $('ch1-replay').onclick=()=>playChannel('ch1','boring','boing',alive);
  const go=()=>{
    const w=($('nt-word').value.toLowerCase().match(/[a-z']+/g)||[]).join('');
    if(!w){toast('Type a word first, using letters a to z.');$('nt-word').focus();return;}
    $('nt-word').value=w;
    const outs=Array.from({length:12},()=>noisyType(w));const ok=outs.filter(o=>o===w).length;
    $('nt-out').innerHTML=outs.map((o,i)=>o===w?`<div class="typed ok" style="animation-delay:${i*60}ms"><div class="w">${esc(o)}</div><div class="why">came out right</div></div>`:`<div class="typed bad" style="animation-delay:${i*60}ms"><div class="w">${markDiff(w,o)}</div><div class="why">${slipStory(w,o)}</div></div>`).join('');
    $('nt-sum').textContent=`${ok} of 12 came out right and ${12-ok} picked up some noise. Press again: you'll get different slips each time. Under these rules, “${w}” comes out perfectly about ${Math.round(E.channel(w,w)*100)}% of the time.`;
  };
  $('nt-go').onclick=go;$('nt-word').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();go();}};
}

/* ---- Step 2: work backwards ---- */
function step2(el){
  el.innerHTML=specSays(`Here's my problem. I can see <span class="typo-word">boing</span> on the screen, but I can't see inside your head. So I work <b>backwards</b>, from the noisy result to the word you most likely meant.`)+
  channelHTML('ch2',{typed:'boing',mystery:true})+
  `<p class="big-q">Which word, sent through noisy fingers, most likely came out as <span class="typo-word">boing</span> in “This class is boing.”?</p>
  <h3>My plan has four moves</h3>
  <ol class="plan"><li><b><span class="section-number s1">1</span>Suspects</b>Find dictionary words close to “boing”.</li><li><b><span class="section-number s3">2</span>Spelling clue</b>For each suspect: how likely is this slip?</li><li><b><span class="section-number s2">3</span>Sentence clue</b>For each suspect: does the sentence sound normal?</li><li><b><span class="section-number s5">4</span>Multiply</b>Combine both clues. The biggest score wins.</li></ol>
  <div class="predict" id="pred"><span class="lbl">Make your own guess first:</span>${['boring','going','bowing','boxing'].map(w=>`<button class="chip-btn" data-g="${w}" aria-pressed="${J.guess===w}">${w}</button>`).join('')}<div class="predict-result" id="pred-r">${J.guess?`Locked in: <b>${esc(J.guess)}</b>. I'll tell you at the end whether I agree.`:''}</div></div>`;
  $('pred').addEventListener('click',e=>{const b=e.target.closest('[data-g]');if(!b)return;J.guess=b.dataset.g;$('pred').querySelectorAll('[data-g]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('pred-r').innerHTML=`Locked in: <b>${esc(J.guess)}</b>. I'll tell you at the end whether I agree.`;});
}

/* ---- Step 3: suspects ---- */
function step3(el,alive){
  const d=jd(),one=d.rows.filter(r=>r.distance===1),two=d.rows.filter(r=>r.distance===2);
  const kinds=[['Put a letter back','boing','boring'],['Take a letter out','boing','bong'],['Change a letter','boing','going'],['Swap two neighbours','thier','their']];
  el.innerHTML=specSays(`My dictionary has ${num(model.meta.vocabulary)} words. Comparing every one with the sentence would take ages, so first I keep only words that are <b>1 or 2 small changes</b> away from “boing”. Those are my <b>suspects</b>.`)+
  `<h3>Four kinds of small change</h3><div class="edit-kinds">${kinds.map((k,i)=>`<button class="edit-kind" data-k="${i}" style="cursor:pointer"><h4>${k[0]}</h4><div class="stage-tiles" id="ek${i}">${tilesHTML(k[1])}</div><div class="fine">${esc(k[1])} → ${esc(k[2])}</div></button>`).join('')}</div>
  <div class="counter"><div class="cbox"><span class="big" id="c-all">0</span><small>words in the dictionary</small></div><span class="arrow" aria-hidden="true">→</span><div class="cbox hot"><span class="big" id="c-sus">0</span><small>suspects within 2 changes</small></div><div class="cbox"><span class="big">${one.length}</span><small>are just 1 change away</small></div></div>
  <p class="step-text">The number of changes between two words is called the <span class="term">edit distance</span>. Tap any suspect to see which change turns “boing” into it. Big tiles are 1 change away; small ones are 2.</p>
  <div class="cloud" id="cloud" style="margin-top:12px">${one.map((r,i)=>`<button class="sus" data-w="${esc(r.word)}" style="animation-delay:${i*40}ms" aria-pressed="false">${esc(r.word)}</button>`).join('')}${two.slice(0,34).map((r,i)=>`<button class="sus two" data-w="${esc(r.word)}" style="animation-delay:${(one.length+i)*25}ms" aria-pressed="false">${esc(r.word)}</button>`).join('')}${two.length>34?`<span class="more-count">and ${two.length-34} more</span>`:''}</div>
  <div class="fix-panel" id="fixp"><span class="fine">Tap a suspect to see the change.</span></div>
  <div class="callout did-you-know"><span class="callout-tag">Did you know?</span><p>In 1964, a computer scientist called Fred Damerau studied real spelling mistakes. He found that more than 80% of them were just one slip: one letter missing, added or changed, or two letters swapped. That's why detectives like me start with the closest words.</p></div>`;
  const runKind=i=>{const k=kinds[i];animateEdit($('ek'+i),k[1],k[2],'fix',alive,'');};
  (async()=>{for(let i=0;i<4;i++){if(!alive())return;runKind(i);await sleep(500);}})();
  el.querySelectorAll('.edit-kind').forEach(b=>b.onclick=()=>runKind(+b.dataset.k));
  const count=async(id,to,ms)=>{const node=$(id);const t0=performance.now();while(alive()){const f=Math.min(1,(performance.now()-t0)/(reduced()?1:ms));node.textContent=num(to*(1-Math.pow(1-f,3)));if(f>=1)break;await new Promise(r=>requestAnimationFrame(r));}};
  (async()=>{await count('c-all',model.meta.vocabulary,1100);await count('c-sus',d.rows.length,700);})();
  $('cloud').addEventListener('click',e=>{const b=e.target.closest('[data-w]');if(!b)return;$('cloud').querySelectorAll('[data-w]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));const r=d.by(b.dataset.w);
    $('fixp').innerHTML=`<span id="fixt"></span><span><b style="font-family:var(--sans);font-size:20px">${esc(r.word)}</b><br><span class="fine">From “boing”: ${fixStory('boing',r.word)}. ${r.distance} change${r.distance>1?'s':''}.</span></span>`;
    animateEdit($('fixt'),'boing',r.word,'fix',alive,'sm');});
}

/* ---- Step 4: spelling clue ---- */
function step4(el,alive){
  const d=jd(),L=d.lineup,[a,b]=[d.by('boring'),d.by('bowing')];
  const tied=a&&b&&Math.abs(a.channel-b.channel)/a.channel<1e-9;
  el.innerHTML=specSays(`For each suspect I ask one question: <b>if you had meant this word, how often would noisy fingers turn it into exactly “boing”?</b> That's the <span class="term term-orange">spelling clue</span>. I work it out with slip rules.`)+
  `<h3>The lab's slip rules</h3>
  <div class="slip-rules">
    <div class="rule"><div class="pc">1.5%</div><div class="nm">Leave a letter out</div><div class="ex">for each letter you type. boring → boing</div></div>
    <div class="rule"><div class="pc">3.5%</div><div class="nm">Swap two neighbours</div><div class="ex">form → from</div></div>
    <div class="rule"><div class="pc">1%</div><div class="nm">Add an extra letter</div><div class="ex">shared by 27 keys, so about 0.04% for one particular letter</div></div>
    <div class="rule"><div class="pc">about 4%</div><div class="nm">Hit a wrong key</div><div class="ex">shared by 26 other keys, so about 0.16% for one particular wrong key</div></div>
  </div>
  <p class="fine">These are teaching rules picked for this lab, not measured from real keyboards. Notice the surprise: one <i>particular</i> wrong key is much rarer than leaving a letter out.</p>
  <h3 style="margin-top:22px">What the rules say about each suspect</h3>
  <p class="step-text">The big number is the chance. The orange bar shows <span class="k-spell">spelling points</span>: all ${d.rows.length} suspects share 100 points, in proportion to their chances.</p>
  <div class="clue-table">${L.map(r=>`<div class="clue-row"><div class="wd">${esc(r.word)}<small>If you meant it: ${slipStory(r.word,'boing')}</small></div><div class="barcell"><div class="bar spell"><i data-w="${r.channelShare*100}"></i></div></div><div class="val">${oneIn(r.channel)}<small>${pts(r.channelShare)} spelling pts</small></div></div>`).join('')}</div>
  ${a&&b?`<div class="callout careful"><span class="callout-tag">A tie!</span><p><b>boring</b> and <b>bowing</b> are ${tied?'exactly tied':'almost tied'}: each needs just one letter left out. The spelling clue can't crack this case on its own. I need a second clue.</p></div>`:''}
  <div class="activity-box experiment"><div class="activity-head"><span class="activity-badge">Experiment</span><span class="activity-title">Check the maths with the noisy typist</span></div>
    <p>Let the noisy typist type each suspect 5,000 times. How often does exactly “boing” come out?</p>
    <button class="btn sun" id="exp-go" style="margin-top:10px">Run 5,000 typings of each</button>
    <div class="exp-grid" id="exp-out"></div></div>`;
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.querySelectorAll('.bar>i[data-w]').forEach((i,k)=>setTimeout(()=>{i.style.width=i.dataset.w+'%';},k*150))));
  $('exp-go').onclick=async()=>{
    $('exp-go').disabled=true;$('exp-out').innerHTML=L.map(r=>`<div class="exp-cell"><div class="w">${esc(r.word)}</div><div class="n" data-w="${esc(r.word)}">0</div><div class="fine">times out of 5,000. The rules predict about ${(5000*r.channel).toFixed(1)}.</div></div>`).join('');
    for(const r of L){let c=0;for(let k=0;k<5000;k++)if(noisyType(r.word)==='boing')c++;const node=$('exp-out').querySelector(`[data-w="${r.word}"]`);for(let s=0;s<=c;s+=Math.max(1,Math.ceil(c/12))){if(!alive())return;node.textContent=s;await sleep(35);}node.textContent=c;await sleep(120);}
    $('exp-go').disabled=false;$('exp-go').textContent='Run it again';
  };
}

/* ---- sentence-window helpers (shared by The case and Spell studio) ---- */
function historyTotal(clue,m){
  const t=clue.tokens;
  if(clue.order===3){const h=m.historyIndex(t[0],t[1]);return h<0?-1:m.tt[h];}
  if(m instanceof E.ContextModel)return m.bt[m.id(t[0])];
  return m.out.get(m.norm(t[0]))||0;
}
function tokChip(w,hl){return w===E.START?'<span class="tok edge">start</span>':w===E.END?'<span class="tok edge">end</span>':`<span class="tok${hl?' hl':''}">${esc(w)}</span>`;}
function windowSay(clue,total,who='I',m=null){
  const t=clue.tokens,w=t[t.length-1],hist=t.slice(0,-1);
  const unk=m?[...new Set(t.filter(x=>x!==E.START&&x!==E.END&&!m.known(x)))]:[],nm=x=>unk.includes(x)?'[unknown word]':x;
  const real=hist.filter(x=>x!==E.START).map(nm);
  let h=hist.every(x=>x===E.START)?'At the very start of a sentence':hist[0]===E.START?`At the start of a sentence, after ${q(real.join(' '))}`:`After ${q(real.join(' '))}`;
  const what=w===E.END?'the sentence ended':`the next word was ${q(nm(w))}`;
  const me=who==='I',tail=unk.length?` ${me?"I don't":"It doesn't"} know ${unk.map(x=>q(x)).join(' or ')}, so ${me?'I count':'it counts'} ${unk.length>1?'them':'it'} as an unknown word.`:'';
  if(total<0)return `${me?'I have':'It has'} never read ${q(real.join(' '))} together, so ${me?'I use':'it uses'} the shorter two-word pattern instead.${tail}`;
  if(total===0)return `${me?'I have':'It has'} never read anything after ${real.length?q(real.join(' ')):'the start of a sentence'}, so ${me?'I borrow':'it borrows'} from shorter patterns.${tail}`;
  return `${h}, ${what} <b>${num(clue.count)}</b> time${clue.count===1?'':'s'} out of <b>${num(total)}</b>.${clue.count===0?` Never seen! So ${me?'I borrow':'it borrows'} a small chance from shorter patterns.`:''}${tail}`;
}
function windowsHTML(row,m,word,who='I'){
  return row.clues.map((c,k)=>`<div class="window" data-k="${k}" role="button" tabindex="0" aria-pressed="false"><div>${c.tokens.map(x=>tokChip(x,x===word)).join('')}</div><div class="say">${windowSay(c,historyTotal(c,m),who,m)}</div><div class="chance">${pct(c.probability)}<small>${who==='I'?'my':'its'} chance</small></div></div>`).join('');
}
function strip(text,iss,word){
  const toks=E.tokenize(text),i=iss.tokenIndex;
  // same sentence only
  const ctx=iss.sentenceTokens.length,start=i-iss.sentenceIndex;
  const words=toks.slice(start,start+ctx).map((t,k)=>start+k===i?`<span class="w slot" data-p="${k+2}">${esc(word)}</span>`:`<span class="w" data-p="${k+2}">${esc(t.raw)}</span>`);
  return `<span class="w edge" data-p="0">start</span><span class="w edge" data-p="1" style="display:none"></span>${words.join('')}<span class="w edge" data-p="${ctx+2}">end</span>`;
}

/* ---------- Clipping file: real sentences from the training text ----------
   The counts above come from every training sentence. This file also carries a
   kid-friendly selection of those sentences (2 to 14 words, dictionary words
   only, front-coded token ids). Searching it shows where a count comes from. */
const CLIP={ready:false,error:'',tok:null,starts:null,n:0,cache:new Map(),next:new Map(),wait:[]};
function whenClips(fn){if(CLIP.ready||CLIP.error)fn();else CLIP.wait.push(fn);}
async function loadClips(){
  try{
    const d=globalThis.CLIP_DATA;if(!d)throw new Error('The clipping file is missing from this page.');
    const raw=atob(d.gzip),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    const buf=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    const n=d.sentences,tok=new Uint16Array(d.tokens+n+1),starts=new Uint32Array(n+1);
    let p=n,w=1,prev=1; // tok[0] = 0 marks the edge before the first sentence
    for(let s=0;s<n;s++){
      const same=buf[s];starts[s]=w;if(same){tok.copyWithin(w,prev,prev+same);w+=same;}
      for(;;){let x=0,sh=0,b;do{b=buf[p++];x|=(b&127)<<sh;sh+=7;}while(b&128);if(!x)break;tok[w++]=x;}
      prev=starts[s];tok[w++]=0; // 0 = sentence edge: the end of this one, the start of the next
    }
    starts[n]=w;
    if(w!==tok.length||p!==buf.length)throw new Error('The clipping file is incomplete.');
    Object.assign(CLIP,{tok,starts,n,ready:true});globalThis.CLIP_DATA=null;
  }catch(err){console.error(err);CLIP.error=err.message||'The clipping file could not open.';}
  CLIP.wait.splice(0).forEach(f=>f());
}
function seeded(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return()=>{h=h+0x6D2B79F5|0;let t=Math.imul(h^h>>>15,1|h);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
// Pattern of word ids, 0 = sentence edge. Returns how many places match and a fair random sample of them.
function clipSearch(ids){
  const key=ids.join(' ');if(CLIP.cache.has(key))return CLIP.cache.get(key);
  const {tok,starts}=CLIP,L=ids.length,last=ids[L-1],R=60,rnd=seeded(key),keep=[];let m=0;
  outer:for(let i=L-1;i<tok.length;i++){
    if(tok[i]!==last)continue;
    for(let k=1;k<L;k++)if(tok[i-k]!==ids[L-1-k])continue outer;
    m++;if(keep.length<R)keep.push(i);else{const j=Math.floor(rnd()*m);if(j<R)keep[j]=i;}
  }
  const hits=keep.map(i=>{
    const first=i-L+1+(ids[0]===0?1:0),lastW=i-(ids[L-1]===0?1:0);
    let lo=0,hi=CLIP.n-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(starts[mid]<=first)lo=mid;else hi=mid-1;}
    const words=Array.from(tok.subarray(starts[lo],starts[lo+1]-1),x=>model.words[x]);
    return {words,spans:[{a:first-starts[lo],b:lastW-starts[lo],start:ids[0]===0,end:ids[L-1]===0}],r:Math.abs(words.length-7)+rnd()*5};
  }).sort((x,y)=>x.r-y.r);
  // spread out sentences that open the same way, so each page shows some variety
  const varied=[];let pool=hits;
  while(pool.length){const used=new Set(),rest=[];for(const h of pool){const k=h.words.slice(0,2).join(' ');if(used.has(k))rest.push(h);else{used.add(k);varied.push(h);}}pool=rest;}
  const res={m,hits:varied};CLIP.cache.set(key,res);return res;
}
// Same idea for a mini detective's own reading list (arrays of words). One hit per sentence.
function miniSearch(sents,pat){
  const L=pat.length,hits=[];let m=0;
  for(const s of sents){
    const seq=[E.START,...s,E.END],spans=[];
    for(let k=0;k+L<=seq.length;k++){let ok=true;for(let j=0;j<L;j++)if(seq[k+j]!==pat[j]){ok=false;break;}
      if(ok){const st=pat[0]===E.START,en=pat[L-1]===E.END;spans.push({a:k-1+(st?1:0),b:k+L-2-(en?1:0),start:st,end:en});}}
    if(spans.length){m+=spans.length;hits.push({words:s,spans});}
  }
  return {m,hits};
}
const bigSrc=()=>({kind:'big',model});
function ph(t,m){
  const st=t[0]===E.START,en=t[t.length-1]===E.END,w=t.filter(x=>x!==E.START&&x!==E.END).map(x=>m&&!m.known(x)?'[unknown word]':x),s=q(w.join(' '));
  return st&&en?`${s} as a whole sentence`:st?`${s} at the start of a sentence`:en?`${s} at the end of a sentence`:s;
}
function ordinal(n){const v=n%100,s=v>=11&&v<=13?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th');return num(n)+s;}
const times=n=>`<b>${num(n)}</b> time${n===1?'':'s'}`;
function clipIds(t){const out=[];for(const x of t){if(x===E.START||x===E.END){if(out[out.length-1]!==0)out.push(0);continue;}const id=model.id(x);if(id===1)return null;out.push(id);}return out;}
function levelCount(t,src){
  const m=src.model;
  if(t.length===3)return m.count3(t[0],t[1],t[2]);
  if(t.length===2)return m.count(t[0],t[1]);
  return src.kind==='big'?m.u[m.id(t[0])]:(m.uni.get(m.norm(t[0]))||0);
}
// Which words followed this history, most common first.
function nextList(hist,src){
  const m=src.model,key=src.kind+'|'+hist.join('\t');
  if(src.kind==='big'&&CLIP.next.has(key))return CLIP.next.get(key);
  let total=0,out=[];
  if(src.kind==='big'){
    if(hist.length===2){const h=m.historyIndex(hist[0],hist[1]);if(h<0)return null;total=m.tt[h];for(let i=m.tp[h];i<m.tp[h+1];i++)out.push([m.words[m.tw[i]],m.tc[i]]);}
    else{const x=m.id(hist[0]);total=m.bt[x];for(let i=m.bp[x];i<m.bp[x+1];i++)out.push([m.words[m.bw[i]],m.bc[i]]);}
  }else{const p=m.norm(hist[0])+'\t';total=m.out.get(m.norm(hist[0]))||0;for(const [k,c] of m.bi)if(k.startsWith(p))out.push([k.slice(p.length),c]);}
  out.sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:1));
  const res={total,out};if(src.kind==='big')CLIP.next.set(key,res);return res;
}
function nextHTML(t,n,src,exact=true){
  const hist=t.slice(0,-1),target=t[t.length-1],nl=nextList(hist,src);if(!nl||!nl.out.length)return '';
  const big=src.kind==='big',chip=([w,c],me,rank)=>`<span class="nw${me?(exact?' me':' me p'):''}${w===E.END||w===E.UNK?' end':''}">${esc(w===E.END?'end of sentence':w===E.UNK?'unknown word':w)}<small>${num(c)}${rank?`, ${rank}`:''}</small></span>`;
  const top=nl.out.slice(0,5),inTop=top.some(e=>e[0]===target);
  const lbl=hist.every(x=>x===E.START)?(big?'Words I read first in a sentence, most common first:':'Words your list starts sentences with:'):`${big?'What I read':'What your list has'} after ${ph(hist,src.model)}, most common first:`;
  let html=top.map(e=>chip(e,e[0]===target)).join('');
  if(!inTop&&n>0){const rank=1+nl.out.filter(e=>e[1]>n).length,tied=nl.out.filter(e=>e[1]===n).length>1;html+=`<span class="more-count">…</span>`+chip([target,n],true,(tied?'tied ':'')+ordinal(rank));}
  const rest=nl.out.length-top.length-(!inTop&&n>0?1:0);
  if(rest>0)html+=`<span class="more-count">and ${num(rest)} other${rest===1?'':'s'}</span>`;
  return `<div class="nextw"><span class="lbl">${lbl}</span>${html}</div>`;
}
function clipHTML(h,cls,focus,i){
  const hl=new Set();let st=false,en=false;
  for(const s of h.spans){for(let k=s.a;k<=s.b;k++)hl.add(k);if(s.start)st=true;if(s.end)en=true;}
  const items=[];if(st)items.push({t:'start',h:true});h.words.forEach((w,k)=>items.push({w,h:hl.has(k)}));if(en)items.push({t:'end',h:true});
  let html='',run=null,buf=[];
  const flush=()=>{if(buf.length)html+=(html?' ':'')+(run?`<mark class="${cls}">${buf.join(' ')}</mark>`:`<span class="cx">${buf.join(' ')}</span>`);buf=[];};
  for(const it of items){if(it.h!==run){flush();run=it.h;}buf.push(it.t?`<span class="edge">${it.t}</span>`:it.h&&it.w===focus?`<span class="sx">${esc(it.w)}</span>`:esc(it.w));}
  flush();
  return `<p class="clip" style="--d:${i*140}ms">${html}</p>`;
}
// Which pattern the clue really rests on: the full window, or the shorter one it borrows from.
function pileLevel(clue,src){
  const full=clue.tokens;let t=full,n=levelCount(t,src);const skipped=[];
  while(n===0&&t.length>1){const p=ph(t,src.model);if(!skipped.includes(p))skipped.push(p);t=t.slice(1);n=levelCount(t,src);}
  return {t,n,skipped,exact:t===full,uni:t.length===1};
}
// The panel under a window: the exact pattern, or the shorter one it borrows from, plus real sentences.
function renderPile(el,clue,word,src){
  if(!el)return;
  const big=src.kind==='big',full=clue.tokens,key=full.join('\u0001')+'|'+word;el._want=key;
  if(big&&!CLIP.ready&&!CLIP.error){el.innerHTML=`<p class="pile-say loading-dots">Opening my clipping file</p>`;whenClips(()=>{if(el.isConnected&&el._want===key)renderPile(el,clue,word,src);});return;}
  const {t,n,skipped,exact,uni}=pileLevel(clue,src),target=t[t.length-1];
  const cls=exact?'':'p',per=big?3:4;
  let say='',res=null,note='';
  const shorter=uni?`how often ${ph(t,src.model)} shows up on its own`:`the shorter pattern ${ph(t,src.model)}`;
  const never=big?`I never read ${skipped.join(' or ')}`:`Your reading list never has ${skipped.join(' or ')}`;
  if(uni&&target===E.END){
    say=`${never}. So ${big?'I borrow':'it borrows'} a little chance from how often <i>any</i> sentence ends. ${big?'I read':'Your list has'} ${num(n)} sentence ends.`;
  }else if(n===0){
    say=`${never}, and ${big?'I never read':'it never has'} ${ph(t,src.model)} at all. So it only gets the tiny chance that every word starts with.`;
  }else{
    if(big){const ids=clipIds(t);if(ids)res=clipSearch(ids);else{const unk=t.find(x=>x!==E.START&&x!==E.END&&model.id(x)===1);note=`${q(unk)} isn't in my dictionary, so I count it as an “unknown word”. My clipping file leaves out sentences with unknown words, so there are no clippings for this one.`;}}
    else res=miniSearch(src.sents,t);
    const has=res&&res.hits.length,k=has?Math.min(per,res.hits.length):0;
    const here=!has?'':big?(n===k&&res.hits.length===k?(k===1?' Here it is:':' Here they are:'):` Here ${k===1?'is one':`are ${k}`} of those sentences:`):(res.hits.length===1?' Here is the sentence:':' Here are the sentences:');
    say=exact?`${big?'I read':'Your reading list has'} ${ph(t,src.model)} ${times(n)}.${here}`:`${never}. So ${big?'I borrow':'it borrows'} a little chance from ${shorter}. ${big?'I read':'Your list has'} ${uni?'it':'that'} ${times(n)}.${here}`;
    if(big&&res&&!has)note=`None of those sentences are in this lab's clipping file. They were too long, used words outside my dictionary, or weren't right for a classroom.`;
  }
  el.innerHTML=`<p class="pile-say">${say}</p><div class="clips"></div>${note?`<p class="pile-note">${note}</p>`:''}<div class="pile-foot"></div>${uni?'':nextHTML(t,n,src,exact)}`;
  const box=el.querySelector('.clips'),foot=el.querySelector('.pile-foot');
  if(!res||!res.hits.length){box.remove();foot.remove();return;}
  let off=0;
  const draw=()=>{
    const page=[];for(let i=0;i<Math.min(per,res.hits.length);i++)page.push(res.hits[(off+i)%res.hits.length]);
    box.innerHTML=page.map((h,i)=>clipHTML(h,cls,word,i)).join('');
  };
  draw();
  const more=res.hits.length>per;
  foot.innerHTML=(more?`<button class="btn small" type="button">Show other sentences</button>`:'')+`<span class="fine">${big?'Real sentences I learned from, shown the way I read them: lowercase, no punctuation.':'Shown the way the mini detective reads them: lowercase, no punctuation.'}${exact?'':big?' Pink means a shorter pattern I borrow from.':' Pink means a shorter pattern it borrows from.'}</span>`;
  if(more)foot.querySelector('button').onclick=()=>{off=(off+per)%res.hits.length;draw();};
}
// Flip challenge: mark the word pairs the sentence clue counts, right inside the reading list.
function hlPairs(text,L){
  const low=text.toLowerCase().replace(/’/g,"'");if(low.length!==text.length)return esc(text);
  const toks=Array.from(low.matchAll(/[a-z]+(?:'[a-z]+)?/g),m=>({w:m[0],s:m.index,e:m.index+m[0].length}));
  const gap=i=>/[.!?;\n]/.test(text.slice(toks[i-1].e,toks[i].s));
  const groups=[];let g=[];toks.forEach((t,i)=>{if(i&&gap(i)){groups.push(g);g=[];}g.push(i);});if(g.length)groups.push(g);
  const cls=new Array(toks.length).fill(''),mark=(i,c)=>{cls[i]=cls[i]&&cls[i]!==c?'mix':c;};
  const pairs=[[L.prev,L.A,'a'],[L.A,L.next,'a'],[L.prev,L.B,'b'],[L.B,L.next,'b']];
  for(const grp of groups){const seq=[E.START,...grp.map(i=>toks[i].w),E.END];
    for(let k=0;k<seq.length-1;k++)for(const [x,y,c] of pairs)if(seq[k]===x&&seq[k+1]===y){if(k>0)mark(grp[k-1],c);if(k<grp.length)mark(grp[k],c);}}
  let html='',last=0,i=0;
  while(i<toks.length){if(!cls[i]){i++;continue;}let j=i;while(j+1<toks.length&&cls[j+1]===cls[i]&&!gap(j+1))j++;
    html+=esc(text.slice(last,toks[i].s))+`<mark class="lp ${cls[i]}">${esc(text.slice(toks[i].s,toks[j].e))}</mark>`;last=toks[j].e;i=j+1;}
  return html+esc(text.slice(last));
}
document.addEventListener('keydown',e=>{const w=e.target.closest&&e.target.closest('.window[role="button"]');if(w&&(e.key==='Enter'||e.key===' ')){e.preventDefault();w.click();}});


/* ---------- Hover cards: every window of a suspect, as clippings ---------- */
const HC={el:null,timer:0,anchor:null,pending:null,onHide:null};
const canHover=()=>window.matchMedia('(hover: hover) and (pointer: fine)').matches;
function hcEl(){if(!HC.el){HC.el=document.createElement('div');HC.el.className='hovercard';HC.el.id='hovercard';HC.el.setAttribute('role','tooltip');HC.el.hidden=true;document.body.appendChild(HC.el);}return HC.el;}
function hideHover(){
  clearTimeout(HC.timer);HC.pending=null;
  if(HC.anchor)HC.anchor.removeAttribute('aria-describedby');HC.anchor=null;
  if(HC.el){HC.el.hidden=true;HC.el.innerHTML='';}
  if(HC.onHide){const f=HC.onHide;HC.onHide=null;f();}
}
function showHover(anchor,build,place,onHide){
  if(HC.anchor===anchor||HC.pending===anchor)return;
  clearTimeout(HC.timer);HC.pending=anchor;
  HC.timer=setTimeout(()=>{
    HC.pending=null;if(!anchor.isConnected)return;
    if(HC.onHide){const f=HC.onHide;HC.onHide=null;f();}
    if(HC.anchor)HC.anchor.removeAttribute('aria-describedby');
    HC.anchor=anchor;HC.onHide=onHide||null;
    const el=hcEl();el.innerHTML=build();el.hidden=false;placeHover(anchor,place);
    anchor.setAttribute('aria-describedby','hovercard');
  },120);
}
function placeHover(anchor,place){
  const el=HC.el,r=anchor.getBoundingClientRect(),vw=window.innerWidth,vh=window.innerHeight,minTop=86,w=Math.min(440,vw-24);
  el.style.width=w+'px';
  const col=place==='left'?anchor.closest('.studio-right'):null,cl=col?col.getBoundingClientRect().left:0,side=col&&cl-14-w>=8;
  let left=side?cl-14-w:Math.min(Math.max(8,r.left),vw-w-8),top=side?r.top-10:r.bottom+8;
  const h=el.offsetHeight;
  if(top+h>vh-8)top=side?vh-8-h:Math.max(minTop,r.top-8-h);
  el.style.left=left+'px';el.style.top=Math.max(minTop,top)+'px';
}
window.addEventListener('scroll',()=>{if(HC.anchor||HC.pending)hideHover();},{passive:true});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(HC.anchor||HC.pending))hideHover();});
function sentHead(lead,text,iss,word){
  let a=iss.start,b=iss.end;
  while(a>0&&!/[.!?;\n]/.test(text[a-1]))a--;
  while(b<text.length&&!/[.!?;\n]/.test(text[b]))b++;
  if(b<text.length&&text[b]!=='\n')b++;
  const shown=E.replace(iss.raw,{start:0,end:iss.raw.length,raw:iss.raw},word);
  return `${lead} <b>${esc(word)}</b><span class="hc-sent">${esc(text.slice(a,iss.start).trimStart())}<span class="hc-sus">${esc(shown)}</span>${esc(text.slice(iss.end,b))}</span>`;
}
function bareClip(t){const w=t.filter(x=>x!==E.START&&x!==E.END);return {words:w,spans:[{a:0,b:w.length-1,start:t[0]===E.START,end:t[t.length-1]===E.END}]};}
function hoverCardHTML(row,word,src,head){
  const big=src.kind==='big',never=big?'Never read':'Your list never has',read=big?'read':'in your list';
  const items=row.clues.map((c,i)=>{
    const L=pileLevel(c,src),endOnly=L.uni&&L.t[0]===E.END;let res=null,unk='';
    if(L.n>0&&!endOnly){
      if(!big)res=miniSearch(src.sents,L.t);
      else if(CLIP.ready){const ids=clipIds(L.t);if(ids)res=clipSearch(ids);else unk=L.t.find(x=>x!==E.START&&x!==E.END&&model.id(x)===1);}
    }
    const h=res&&res.hits[0],cls=L.exact?'':'p';
    const strip=h?clipHTML(h,cls,word,i):clipHTML(bareClip(L.n>0&&!endOnly?L.t:c.tokens),L.n>0&&!endOnly?cls:'none',word,i);
    let cap;
    if(endOnly)cap=`${never} ${L.skipped.join(' or ')}. Borrows from how often any sentence ends.`;
    else if(L.n===0)cap=`${never} ${L.skipped.join(' or ')}, or ${ph(L.t,src.model)} at all.`;
    else cap=`${L.exact?'':`${never} ${L.skipped.join(' or ')}. Borrows `}${ph(L.t,src.model)}: ${read} ${times(L.n)}.${unk?` ${q(unk)} is an unknown word, so no clipping.`:!h&&(!big||CLIP.ready)?' No classroom clipping to show.':''}`;
    return `<div class="hc-item"><div class="clips">${strip}</div><p class="hc-cap">${cap}</p></div>`;
  }).join('');
  return `<p class="hc-head">${head}</p>${items}<p class="hc-foot">${big?'Click the suspect to see every window in full.':'Pick it under “Where the sentence clue came from” to see every sentence.'}</p>`;
}
// Spell studio warms the search cache for the suspects on the board, so hovering feels instant.
function warmHover(rows){
  whenClips(()=>{if(!CLIP.ready)return;const src=bigSrc(),jobs=[];rows.forEach(r=>r.clues.forEach(c=>jobs.push(c)));let i=0;
    const step=()=>{const t0=performance.now();while(i<jobs.length&&performance.now()-t0<12){const L=pileLevel(jobs[i++],src);if(L.n>0&&!(L.uni&&L.t[0]===E.END)){const ids=clipIds(L.t);if(ids)clipSearch(ids);}}if(i<jobs.length)setTimeout(step,0);};
    setTimeout(step,0);});
}

/* ---------- Teach it: highlight the counted words inside the training text itself ---------- */
const TH={sel:null};
function paintCorpus(pats,scroll=true){
  const ta=$('corpus-text'),mir=$('corpus-mirror'),cap=$('corpus-hl');if(!ta||!mir)return;
  const text=ta.value;
  if(!pats||!pats.length||T.trained===null||text!==T.trained){mir.textContent=text+'\n';mir.scrollTop=ta.scrollTop;cap.innerHTML=pats&&pats.length&&text!==T.trained?'Press <b>Teach the model</b> to see the highlighter again.':'';return;}
  const low=text.toLowerCase().replace(/’/g,"'");
  if(low.length!==text.length){mir.textContent=text+'\n';cap.textContent='';return;}
  const toks=Array.from(low.matchAll(/[a-z]+(?:'[a-z]+)?/g),m=>({w:m[0],s:m.index,e:m.index+m[0].length}));
  const gap=i=>/[.!?;\n]/.test(text.slice(toks[i-1].e,toks[i].s));
  const groups=[];let g=[];toks.forEach((t,i)=>{if(i&&gap(i)){groups.push(g);g=[];}g.push(i);});if(g.length)groups.push(g);
  const cls=new Array(toks.length).fill(''),found=pats.map(()=>0);
  for(const grp of groups){const seq=[E.START,...grp.map(i=>toks[i].w),E.END];
    pats.forEach((p,pi)=>{const L=p.t.length;for(let k=0;k+L<=seq.length;k++){let ok=true;for(let j=0;j<L;j++)if(seq[k+j]!==p.t[j]){ok=false;break;}
      if(!ok)continue;found[pi]++;for(let j=0;j<L;j++){const x=k+j-1;if(x>=0&&x<grp.length){const ti=grp[x];if(cls[ti]!=='y')cls[ti]=p.cls;}}}});}
  let html='',last=0,i=0;
  while(i<toks.length){if(!cls[i]){i++;continue;}let j=i;while(j+1<toks.length&&cls[j+1]===cls[i]&&!gap(j+1))j++;
    html+=esc(text.slice(last,toks[i].s))+`<mark class="${cls[i]}">${esc(text.slice(toks[i].s,toks[j].e))}</mark>`;last=toks[j].e;i=j+1;}
  mir.innerHTML=html+esc(text.slice(last))+'\n';
  cap.innerHTML='Highlighted in the training text: '+pats.map((p,pi)=>`<mark class="lp ${p.cls==='y'?'b':'p'}">${esc(p.t.filter(x=>x!==E.START&&x!==E.END).join(' '))}</mark> ${found[pi]===0?'nowhere':`${found[pi]} place${found[pi]===1?'':'s'}`}`).join(', ')+'.';
  const m=mir.querySelector('mark');
  if(scroll&&m){const top=m.offsetTop;if(top<ta.scrollTop+6||top>ta.scrollTop+ta.clientHeight-34)ta.scrollTop=Math.max(0,top-40);}
  mir.scrollTop=ta.scrollTop;
}
const miniSrc=()=>({kind:'mini',model:T.model,sents:T.sents});
function corpusPat(c){const L=pileLevel(c,miniSrc());return L.n>0&&!(L.uni&&L.t[0]===E.END)?{t:L.t,cls:L.exact?'y':'p'}:null;}
function teachHover(el,word){
  const r=T.ranked&&T.ranked.find(x=>x.word===word);if(!r||!T.iss)return;
  showHover(el,()=>{paintCorpus(r.clues.map(corpusPat).filter(Boolean));return hoverCardHTML(r,word,miniSrc(),sentHead('If it meant',T.text,T.iss,word));},'below',()=>paintCorpus(TH.sel,false));
}
/* ---- Step 5: sentence clue ---- */
function step5(el,alive){
  const d=jd(),L=d.lineup;
  el.innerHTML=specSays(`Now I try each suspect inside your sentence. I've read ${num(model.meta.trainingSentences)} example sentences, so I know which word patterns are common. I read <b>three words at a time</b>: each word together with the two words just before it.`)+
  `<p class="fine" style="margin-bottom:6px">Tap a suspect to drop it into the blank:</p>
  <div class="suspect-tabs" id="s5tabs">${L.map(r=>`<button class="chip-btn" data-w="${esc(r.word)}" aria-pressed="false">${esc(r.word)}</button>`).join('')}</div>
  <div class="sentence-strip" id="s5strip"></div>
  <div class="windows" id="s5win"></div>
  <p class="fine">Each window is a pattern I counted in my reading. Tap a window to see real sentences where I found it.</p>
  <div class="pile" id="s5pile"></div>
  <div class="multiply-line" id="s5mul"></div>
  <p class="fine" style="margin-top:10px">“This class” is the same for every suspect, so it can't help me decide. I only compare the windows that touch the blank.</p>
  <h3 style="margin-top:20px">Sentence points for every suspect</h3>
  <p class="step-text">Just like before, all ${d.rows.length} suspects share 100 <span class="k-sent">sentence points</span>, in proportion to their sentence chances.</p>
  <div class="clue-table">${L.map(r=>`<div class="clue-row"><div class="wd">${esc(r.word)}<small>This class is ${esc(r.word)}.</small></div><div class="barcell"><div class="bar sent"><i data-w="${r.lmShare*100}"></i></div></div><div class="val">${pts(r.lmShare)}<small>sentence pts</small></div></div>`).join('')}</div>
  <div class="callout did-you-know"><span class="callout-tag">Did you know?</span><p>When I've never seen a pattern, I don't say “impossible”. I <b>borrow</b> a little chance from shorter patterns: two words, then single words. This is called <span class="term">smoothing</span>. It stops one unseen pattern from wiping out a suspect completely.</p></div>`;
  let sel=0;
  function pick(k){
    const r=L[sel],j=d.iss.sentenceIndex+2+k;
    $('s5strip').querySelectorAll('.w').forEach(w=>{const p=+w.dataset.p;w.classList.toggle('inwin',(p>=j-2&&p<=j)||(p===0&&j-2<=1));});
    [...$('s5win').children].forEach((w,i)=>{w.classList.toggle('active',i===k);w.setAttribute('aria-pressed',String(i===k));});
    renderPile($('s5pile'),r.clues[k],r.word,bigSrc());
  }
  function showMul(){const r=L[sel];[...$('s5win').children].forEach(w=>w.classList.remove('active'));$('s5mul').innerHTML=`Multiply the windows: ${r.clues.map(c=>pct(c.probability)).join(' × ')} = <span class="k-sent">${pct(r.lm)}</span> for “${esc(r.word)}”.`;$('s5mul').style.opacity=1;}
  async function show(i){
    sel=i;const r=L[i],my=++show.t;const ok=()=>alive()&&my===show.t;
    $('s5tabs').querySelectorAll('[data-w]').forEach((b,k)=>b.setAttribute('aria-pressed',String(k===i)));
    $('s5strip').innerHTML=strip(d.text,d.iss,r.word);
    $('s5win').innerHTML=windowsHTML(r,model,r.word);$('s5mul').style.opacity=0;
    $('s5strip').querySelector('.slot').classList.add('pop');
    for(let k=0;k<r.clues.length;k++){if(!ok())return;pick(k);await sleep(k<r.clues.length-1?2200:900);}
    if(!ok())return;
    showMul();
  }
  show.t=0;
  $('s5tabs').addEventListener('click',e=>{const b=e.target.closest('[data-w]');if(b)show([...$('s5tabs').children].indexOf(b));});
  $('s5win').addEventListener('click',e=>{const w=e.target.closest('.window');if(!w)return;show.t++;pick(+w.dataset.k);showMul();});
  show(0);
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.querySelectorAll('.bar>i[data-w]').forEach((i,k)=>setTimeout(()=>{i.style.width=i.dataset.w+'%';},300+k*150))));
}

/* ---- Step 6: multiply ---- */
function scoreFmt(x){if(x>=100)return num(x);if(x>=1)return x.toFixed(1);if(x>=0.01)return x.toFixed(2);return '≈ 0';}
function step6(el,alive){
  const d=jd(),L=d.lineup,win=d.rows[0];
  el.innerHTML=specSays(`A good suspect must pass <b>both</b> tests. You had to mean that word <i>and</i> your fingers had to make that exact slip. When two things both have to happen, their chances <b>multiply</b>.`)+
  `<div class="mult-head"><span>Suspect</span><span class="k-spell">Spelling points</span><span></span><span class="k-sent">Sentence points</span><span></span><span>Score</span><span class="k-final">Final points</span></div>
  <div class="clue-table" id="m6">${L.map(r=>`<div class="mult-row${r===win?' is-win':''}" data-w="${esc(r.word)}"><div class="wdc" style="font-family:var(--sans);font-weight:800;font-size:21px">${esc(r.word)}</div><div class="cell">${pts(r.channelShare)}<div class="bar spell"><i style="width:${r.channelShare*100}%"></i></div></div><div class="op">×</div><div class="cell">${pts(r.lmShare)}<div class="bar sent"><i style="width:${r.lmShare*100}%"></i></div></div><div class="op eq">=</div><div class="score">${scoreFmt(r.channelShare*r.lmShare*1e4)}</div><div class="cell fin">${pts(r.share)} final pts<div class="bar final"><i data-w="${r.share*100}"></i></div></div></div>`).join('')}</div>
  <p class="fine">Then all ${d.rows.length} suspects share 100 <span class="k-final">final points</span>, in proportion to their scores. That's why a big score turns into nearly all the points.</p>
  <div style="margin-top:12px"><button class="btn small" id="m6-add">What if I added instead of multiplying?</button></div><div id="m6-addr"></div>
  <div id="m6-v"></div>`;
  (async()=>{
    const rows=[...$('m6').children];
    await sleep(700);
    for(const r of rows){if(!alive())return;r.classList.add('show-score');await sleep(500);}
    await sleep(400);
    for(const r of rows){if(!alive())return;r.classList.add('show-final');const i=r.querySelector('.bar.final>i');i.style.width=i.dataset.w+'%';await sleep(300);}
    if(!alive())return;
    rows.find(r=>r.classList.contains('is-win'))?.classList.add('win');
    await sleep(500);if(!alive())return;
    let guessLine='';
    if(J.guess){const g=d.by(J.guess);guessLine=J.guess===win.word?`You guessed <b>${esc(win.word)}</b> too. Great detective work!`:g?`You guessed <b>${esc(J.guess)}</b>. It got ${pts(g.channelShare)} spelling points and ${pts(g.lmShare)} sentence points, so its score was much smaller.`:'';}
    $('m6-v').innerHTML=`<div class="verdict"><div class="vk">Case closed</div><div class="vs">This class is <mark>${esc(win.word)}</mark>.</div><p style="margin-top:6px">${esc(win.word)} gets ${pts(win.share)} of the 100 final points. ${guessLine}</p></div>`;
  })();
  $('m6-add').onclick=()=>{
    const added=[...d.rows].map(r=>({r,s:(r.channelShare+r.lmShare)*100})).sort((a,b)=>b.s-a.s);
    const second=added[1];
    $('m6-addr').innerHTML=`<div class="callout connect-it"><span class="callout-tag">What if?</span><p>If I <b>added</b> the points, <b>${esc(second.r.word)}</b> would come second with ${second.s.toFixed(1)} points, even though it has only ${pts(second.r.lmShare)} sentence points. “This class is ${esc(second.r.word)}.” almost never happens! Multiplying stops that: a suspect that fails one test scores almost nothing.</p></div>`;
  };
}

/* ---- Step 7: context ---- */
function step7(el,alive){
  const d=jd(),C=d.ctx,water=C[2],wb=water.by('boiling'),wr=water.by('boring');
  el.innerHTML=specSays(`Here's my favourite trick. Keep the typo <b>exactly</b> the same and change the words around it. The spelling clue can't change, because it's the same typo. Only the sentence clue can.`)+
  `<div class="predict" id="p7"><span class="lbl">Guess first: what did “The water is boing.” mean?</span>${['boring','going','boiling'].map(w=>`<button class="chip-btn" data-g="${w}" aria-pressed="${J.guess7===w}">${w}</button>`).join('')}<button class="link-btn" id="p7-skip">Just show me</button><div class="predict-result" id="p7r"></div></div>
  <div id="ctxwrap" ${J.guess7?'':'hidden'}></div>`;
  const reveal=()=>{
    const cards=C.map((c,k)=>{const w=c.rows[0];const t3=c.rows.slice(0,3);const s=esc(c.text.slice(0,c.iss.start))+`<mark>${esc(w.word)}</mark>`+esc(c.text.slice(c.iss.end));
      return `<div class="ctx" style="animation-delay:${k*220}ms"><div class="s">${s}</div><div class="win">Winner: ${esc(w.word)} (${w.distance} change${w.distance>1?'s':''})</div><table><thead><tr><th>Suspect</th><th class="k-spell">Spelling</th><th class="k-sent">Sentence</th><th class="k-final">Final</th></tr></thead><tbody>${t3.map((r,i)=>`<tr class="${i===0?'w':''}"><td>${esc(r.word)}</td><td>${pts(r.channelShare)}</td><td>${pts(r.lmShare)}</td><td>${pts(r.share)}</td></tr>`).join('')}</tbody></table></div>`;}).join('');
    const spellRatio=wr&&wb?wr.channel/wb.channel:0,sentRatio=wr&&wb?wb.lm/wr.lm:0;
    $('ctxwrap').hidden=false;
    $('ctxwrap').innerHTML=`<div class="ctx-grid">${cards}</div>
    <div class="callout connect-it"><span class="callout-tag">Spot the pattern</span><p>Look down the spelling column: the same suspect always gets the same spelling points, because the typo never changed. Only the sentence clue moved, and it moved the answer.</p>${wb&&wr?`<p style="margin-top:8px">In “The water is boing.”, <b>boiling</b> wins even though it needs 2 changes. Boring's spelling clue is about <b>${num(spellRatio)}×</b> stronger, but boiling's sentence clue is about <b>${num(sentRatio)}×</b> stronger. ${num(sentRatio)} beats ${num(spellRatio)}, so boiling wins. That's multiplication at work.</p>`:''}</div>`;
  };
  if(J.guess7)reveal();
  $('p7').addEventListener('click',e=>{const b=e.target.closest('[data-g]');if(!b)return;J.guess7=b.dataset.g;$('p7').querySelectorAll('[data-g]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));const w=water.rows[0].word;$('p7r').innerHTML=J.guess7===w?`Yes! It's <b>${esc(w)}</b>. Here's how the clues worked out:`:`Good guess, but the detective picks <b>${esc(w)}</b>. Here's why:`;reveal();});
  $('p7-skip').onclick=()=>{J.guess7=J.guess7||'skip';reveal();};
}

/* ---- Step 8: case closed ---- */
function badgeSVG(){return `<svg class="badge" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="rbw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E63946"/><stop offset=".25" stop-color="#F77F00"/><stop offset=".45" stop-color="#FFB703"/><stop offset=".65" stop-color="#06A77D"/><stop offset=".85" stop-color="#2D6CDF"/><stop offset="1" stop-color="#7B2CBF"/></linearGradient></defs><circle cx="60" cy="60" r="57" fill="url(#rbw)"/><circle cx="60" cy="60" r="47" fill="#fff" stroke="#1a1f2e" stroke-width="3"/>${specSVG(64).replace('<svg class="spec"','<svg x="28" y="16"')}<path d="M2 80h116l-9 10 9 10H2l9-10z" fill="#7B2CBF" stroke="#1a1f2e" stroke-width="2.5" stroke-linejoin="round"/><text x="60" y="94" text-anchor="middle" font-family="Source Sans 3, sans-serif" font-weight="800" font-size="10" fill="#fff" letter-spacing=".4">WORD DETECTIVE</text><path d="M95 22l2.6 5.4 6 .8-4.4 4.1 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9-4.4-4.1 6-.8z" fill="#FFB703" stroke="#1a1f2e" stroke-width="1.6"/></svg>`;}
function step8(el){
  el.innerHTML=`<div class="badge-wrap">${badgeSVG()}<div><h3 style="font-size:26px">You earned the Word Detective badge</h3><p>You followed every clue, the same way a real spellchecker does.</p></div></div>
  <h3>The whole secret in one picture</h3>
  <div class="recap"><div class="rb r1"><b>Spelling clue</b>How likely is this slip, if you meant this word?</div><span class="op">×</span><div class="rb r2"><b>Sentence clue</b>How normal is the sentence with this word in it?</div><span class="op">=</span><div class="rb r3"><b>Best guess</b>The suspect with the biggest score wins.</div></div>
  <p class="step-text">Grown-up scientists write it like this. It's called the <span class="term">noisy channel model</span>:</p>
  <div class="formula">best word = the w with the biggest &nbsp;<span class="o">P(typo | w)</span> × <span class="b">P(sentence with w)</span></div>
  <p class="step-text">P means “probability”, which is the chance of something happening. The line | means “if”. So <span class="k-spell">P(typo | w)</span> means “the chance of this typo, if you meant w”.</p>
  <div class="callout did-you-know"><span class="callout-tag">Did you know?</span><p>The same two-clue idea has powered speech recognition (which words would make these sounds × which sentence makes sense) and early computer translation. Whenever a computer has to recover a message that got scrambled, the noisy channel model is a good place to start.</p></div>
  <h3>Where detectives slip up</h3>
  <ul class="miss-list"><li><b>Real-word mistakes.</b> In “I ate there cake” every word is a real word, so nothing gets checked.</li><li><b>Names and new words.</b> A word it has never read looks like a typo, so it may try to “fix” it.</li><li><b>Big typos.</b> If the typo is 3 or more changes away, the right word never becomes a suspect.</li><li><b>Patterns, not meaning.</b> It only knows which words often appear near each other, so it can be confidently wrong.</li></ul>
  <div class="cta-row"><button class="btn primary" data-goto="studio">Solve your own cases</button><button class="btn" data-goto="teach">Teach the detective</button><button class="btn sun" data-goto="flip">Take the flip challenge</button></div>`;
  if(!J.badge){J.badge=true;confetti();}
}

/* =================================================================
   2. SPELL STUDIO
   ================================================================= */
const S={an:null,idx:-1,rows:[],shown:[],stage:0,reached:0,sel:null,detailWord:null,ignored:new Set(),ticket:0};
const STAGES=['Suspects','Spelling clue','Sentence clue','Final points'];
function flipOrder(container,keys,animate){
  const kids=[...container.children],first=new Map(kids.map(k=>[k,k.getBoundingClientRect().top]));
  keys.forEach(key=>{const el=kids.find(k=>k.dataset.key===key);if(el)container.appendChild(el);});
  if(!animate||reduced())return;
  kids.forEach(k=>{const dy=first.get(k)-k.getBoundingClientRect().top;if(Math.abs(dy)>1&&k.animate)k.animate([{transform:`translateY(${dy}px)`},{transform:'none'}],{duration:650,easing:'cubic-bezier(.2,.7,.2,1)'});});
}
function updateMirror(){
  const text=$('sentence').value;$('char-count').textContent=`${text.length} / 300`;
  if(!engine){$('mirror').textContent=text+'\n';return;}
  const issues=engine.analyze(text).issues.filter(t=>!S.ignored.has(t.word));
  const cur=S.an&&S.an.text===text?S.an.issues[S.idx]:null;
  let last=0,html='';
  for(const is of issues){html+=esc(text.slice(last,is.start))+`<mark${cur&&cur.start===is.start?' class="sel"':''}>${esc(is.raw)}</mark>`;last=is.end;}
  $('mirror').innerHTML=html+esc(text.slice(last))+'\n';$('mirror').scrollTop=$('sentence').scrollTop;
}
function boardMessage(title,body,extra=''){$('board').innerHTML=`<div class="empty">${specSVG(110)}<h3>${title}</h3><p>${body}</p>${extra}</div>`;}
function renderIssues(){
  const an=S.an;if(!an||!an.issues.length){$('issues').innerHTML='';return;}
  $('issues').innerHTML=`<span class="lbl">${an.issues.length===1?'Typo found:':'Typos found. Pick one:'}</span>`+an.issues.map((t,i)=>`<button class="issue-chip" data-i="${i}" aria-pressed="${i===S.idx}">${esc(t.raw)}</button>`).join('');
}
function studioCheck(keepIdx=0){
  if(!engine)return;
  const text=$('sentence').value,an=engine.analyze(text);
  an.issues=an.issues.filter(t=>!S.ignored.has(t.word));S.an={...an,text};S.idx=-1;
  if(!an.tokens.length){renderIssues();updateMirror();boardMessage('Give me a sentence to check','Type a short English sentence with a typo or two, or tap one of the examples.');return;}
  if(!an.issues.length){renderIssues();updateMirror();boardMessage('No unknown words found','Every word I checked is in my dictionary (or you chose to keep it). Remember: I only check unknown words, so a real word in the wrong place, like “I ate there cake”, slips past me.');$('board-live').textContent='No unknown words found.';return;}
  openIssue(Math.min(keepIdx,an.issues.length-1));
}
function openIssue(i){
  S.idx=i;const iss=S.an.issues[i];
  S.rows=engine.rank(iss.word,iss.prev,iss.next,null,iss);
  renderIssues();updateMirror();
  if(!S.rows.length){boardMessage(`No suspects for “${esc(iss.raw)}”`,'It may be a name, a brand-new word, or more than two changes away from every word in my dictionary.','<p style="margin-top:14px"><button class="btn small" data-act="keep">Keep my word</button></p>');return;}
  const pick=[],add=r=>{if(r&&!pick.includes(r)&&pick.length<6)pick.push(r);};
  S.rows.slice(0,3).forEach(add);
  [...S.rows].sort((a,b)=>b.channel-a.channel||b.joint-a.joint).slice(0,2).forEach(add);
  [...S.rows].sort((a,b)=>b.lm-a.lm).slice(0,2).forEach(add);
  S.rows.slice(3,8).forEach(add);
  S.shown=pick;S.stage=0;S.reached=0;S.sel=null;S.detailWord=null;
  renderBoard();
  if(window.innerWidth<1060)$('board').scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'});
}
function orderFor(st){
  const a=[...S.shown];
  if(st===0)return a.sort((x,y)=>x.distance-y.distance||y.channel-x.channel||y.joint-x.joint);
  if(st===1)return a.sort((x,y)=>y.channel-x.channel||y.joint-x.joint);
  if(st===2)return a.sort((x,y)=>y.lm-x.lm);
  return a.sort((x,y)=>y.joint-x.joint);
}
function renderBoard(){
  const iss=S.an.issues[S.idx];
  $('board').innerHTML=`<ol class="stages">${STAGES.map((s,i)=>`<li><button class="stage-btn" data-st="${i}"><span class="n">${i+1}</span>${s}</button></li>`).join('')}</ol>
  <div class="stage-say">${specSVG(46)}<p id="ssay"></p></div>
  <div class="board-ctrl"><button class="btn primary small" id="snext" data-act="next">Next clue</button><button class="btn small" data-act="jump">Jump to the answer</button><button class="btn small sun" data-act="clips" id="sclips" hidden>See the sentences I read</button></div>
  <div class="rows-head" aria-hidden="true"><span>Suspect</span><span class="h-spell">Spelling clue</span><span class="h-sent">Sentence clue</span><span class="h-final">Final points</span></div>
  <div class="rows" id="srows">${S.shown.map(r=>`<div class="srow" role="button" tabindex="0" data-key="${esc(r.word)}" aria-pressed="false">
    <div class="first"><div class="wd"><span class="rk"></span><span class="nm">${esc(r.word)}</span></div><div class="story">${r.distance} change${r.distance>1?'s':''}: ${slipStory(r.word,iss.word)}</div></div>
    <div class="m ms locked"><span class="v" data-l="Spelling clue">${oneIn(r.channel)}<small>${pts(r.channelShare)} pts</small></span><div class="bar spell"><i style="width:${r.channelShare*100}%"></i></div></div>
    <div class="m mt locked"><span class="v" data-l="Sentence">${pts(r.lmShare)}<small>pts</small></span><div class="bar sent"><i style="width:${r.lmShare*100}%"></i></div></div>
    <div class="m mf locked"><span class="v" data-l="Final">${pts(r.share)}<small>pts</small></span><div class="bar final"><i style="width:${r.share*100}%"></i></div></div></div>`).join('')}</div>
  <p class="rows-note">The main suspects out of ${S.rows.length}, including the leader of each clue. Points are shared by all ${S.rows.length}.</p>
  <div class="detail" id="sdetail"></div>
  <div id="sverdict"></div>`;
  applyStage(false);
}
function applyStage(animate=true){
  hideHover();
  const st=S.stage,iss=S.an.issues[S.idx],order=orderFor(st),t=++S.ticket;
  if(st>=2)warmHover(S.shown);
  S.reached=Math.max(S.reached,st);
  document.querySelectorAll('#board .stage-btn').forEach(b=>{const i=+b.dataset.st;b.classList.toggle('reached',i<=S.reached);b.classList.toggle('current',i===st);b.disabled=i>S.reached+1;b.setAttribute('aria-current',i===st?'step':'false');});
  flipOrder($('srows'),order.map(r=>r.word),animate);
  [...$('srows').children].forEach((el,i)=>{el.querySelector('.rk').textContent=i+1;el.querySelector('.ms').classList.toggle('locked',st<1);el.querySelector('.mt').classList.toggle('locked',st<2);el.querySelector('.mf').classList.toggle('locked',st<3);el.classList.toggle('winner',st===3&&i===0);});
  const k=iss.word.length<=2?1:2,lead=order[0];
  const chTie=st===1&&order[1]&&Math.abs(order[0].channel-order[1].channel)/order[0].channel<1e-9;
  const say=[
    `“${esc(iss.raw)}” isn't in my dictionary. I found <b>${S.rows.length}</b> suspect${S.rows.length>1?'s':''} within ${k} change${k>1?'s':''}. Here are the main ones. Tap one to see how the slip could happen.`,
    `<span class="k-spell">Spelling clue.</span> If you meant each word, how often would noisy fingers turn it into “${esc(iss.word)}”? ${chTie?`<b>${esc(order[0].word)}</b> and <b>${esc(order[1].word)}</b> are tied, so I need the next clue.`:`<b>${esc(lead.word)}</b> is the likeliest slip.`}`,
    `<span class="k-sent">Sentence clue.</span> Now I put each suspect into your sentence and check the three-word windows around it against everything I've read. <b>${esc(lead.word)}</b> fits best. Press <b>See the sentences I read</b> to check my evidence.`,
    `<span class="k-final">Multiply!</span> Spelling points × sentence points, then all ${S.rows.length} suspects share 100 final points. <b>${esc(S.rows[0].word)}</b> wins with ${pts(S.rows[0].share)}.${S.rows[0].share<.6?' It\'s a close call, so I could be wrong here.':''}`
  ];
  $('ssay').innerHTML=say[st];
  $('sclips').hidden=st<2;
  $('snext').disabled=st===3;$('snext').textContent=st===2?'Multiply the clues':'Next clue';
  if(!S.sel||!S.userSel)S.sel=lead.word;
  [...$('srows').children].forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.key===S.sel)));
  renderDetail(t);
  renderVerdict();
  $('board-live').textContent=`Stage ${st+1}: ${STAGES[st]}. Leader: ${lead.word}.`;
}
function studioWindow(k){
  const r=S.rows.find(x=>x.word===S.sel);if(!r||!$('swin'))return;
  S.win=Math.min(k,r.clues.length-1);
  $('swin').querySelectorAll('.window').forEach((w,i)=>w.setAttribute('aria-pressed',String(i===S.win)));
  renderPile($('spile'),r.clues[S.win],r.word,bigSrc());
}
function renderDetail(t){
  const iss=S.an.issues[S.idx],r=S.rows.find(x=>x.word===S.sel),st=S.stage;if(!r)return;
  const alive=()=>t===S.ticket;
  let html=`<div class="part"><h3>If you meant “${esc(r.word)}”…</h3><div class="row"><span id="dt-tiles">${S.detailWord===r.word?tilesHTML(iss.word,'sm'):''}</span><span class="fine">your fingers ${slipStory(r.word,iss.word)}.${st>=1?` Under the slip rules, that happens <b class="k-spell">${oneIn(r.channel)}</b> times.`:''}</span></div></div>`;
  if(st>=2)html+=`<div class="part"><h3>“${esc(r.word)}” in your sentence</h3><p class="fine" style="margin-bottom:8px">Tap a window to see real sentences where I read that pattern.</p><div class="windows" id="swin">${windowsHTML(r,model,r.word)}</div><div class="pile" id="spile"></div><div class="multiply-line">Windows multiplied: ${r.clues.map(c=>pct(c.probability)).join(' × ')} = <span class="k-sent">${pct(r.lm)}</span>, which earns ${pts(r.lmShare)} sentence points.</div></div>`;
  if(st>=3)html+=`<div class="part"><div class="multiply-line" style="background:var(--purple-t)"><span class="k-spell">${pts(r.channelShare)} spelling pts</span> × <span class="k-sent">${pts(r.lmShare)} sentence pts</span> → shared out → <span class="k-final">${pts(r.share)} final pts</span></div></div>`;
  $('sdetail').innerHTML=html;
  if(st>=2){const wk=S.an.text+'|'+S.idx+'|'+r.word;if(S.winKey!==wk){S.winKey=wk;S.win=0;}studioWindow(S.win);}
  if(S.detailWord!==r.word){S.detailWord=r.word;animateEdit($('dt-tiles'),r.word,iss.word,'slip',alive,'sm');}
}
function renderVerdict(){
  if(S.stage<3){$('sverdict').innerHTML='';return;}
  const iss=S.an.issues[S.idx],w=S.rows[0],text=S.an.text;
  const fixed=E.replace(iss.raw,{start:0,end:iss.raw.length,raw:iss.raw},w.word);
  $('sverdict').innerHTML=`<div class="verdict"><div class="vk">${w.share<.6?'Close call. My best guess:':'Case closed'}</div><div class="vs">${esc(text.slice(0,iss.start))}<mark>${esc(fixed)}</mark>${esc(text.slice(iss.end))}</div>
  <div class="actions"><button class="btn go small" data-act="use">Use “${esc(w.word)}”</button><button class="btn small" data-act="keep">Keep my word</button></div>
  <details class="all"><summary>See all ${S.rows.length} suspects and their numbers</summary><div class="table-wrap"><table class="mini-table"><thead><tr><th>Suspect</th><th>Changes</th><th>Spelling chance</th><th>Spelling pts</th><th>Sentence pts</th><th>Final pts</th></tr></thead><tbody>${S.rows.slice(0,250).map(r=>`<tr><td>${esc(r.word)}</td><td>${r.distance}</td><td>${oneIn(r.channel)}</td><td>${pts(r.channelShare)}</td><td>${pts(r.lmShare)}</td><td>${pts(r.share)}</td></tr>`).join('')}</tbody></table></div>${S.rows.length>250?`<p class="fine">Showing the top 250.</p>`:''}</details></div>`;
}
$('board').addEventListener('click',e=>{
  const wn=e.target.closest('#swin .window');if(wn){studioWindow(+wn.dataset.k);return;}
  const st=e.target.closest('[data-st]');if(st&&!st.disabled){S.stage=+st.dataset.st;applyStage();return;}
  const act=e.target.closest('[data-act]');
  if(act){const a=act.dataset.act,iss=S.an&&S.an.issues[S.idx];
    if(a==='next'&&S.stage<3){S.stage++;S.userSel=false;applyStage();}
    else if(a==='jump'){S.stage=3;S.userSel=false;applyStage();}
    else if(a==='clips'){const part=$('swin')&&$('swin').closest('.part');if(part){part.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'});const w=$('swin').querySelector('.window[aria-pressed="true"]');if(w)w.focus({preventScroll:true});}}
    else if(a==='use'&&iss){const w=S.rows[0].word;$('sentence').value=E.replace(S.an.text,iss,w);toast(`Changed “${iss.raw}” to “${w}”.`);studioCheck(S.idx);}
    else if(a==='keep'&&iss){S.ignored.add(iss.word);toast(`Keeping “${iss.raw}”.`);studioCheck(S.idx);}
    return;}
  const row=e.target.closest('.srow');if(row){S.sel=row.dataset.key;S.userSel=true;[...$('srows').children].forEach(el=>el.setAttribute('aria-pressed',String(el===row)));renderDetail(++S.ticket);}
});
// Spell studio: hover a suspect to see all its windows as clippings (once the sentence clue is open)
function studioHover(row){
  const iss=S.an&&S.an.issues[S.idx],r=iss&&S.rows.find(x=>x.word===row.dataset.key);if(!r)return;
  showHover(row,()=>hoverCardHTML(r,r.word,bigSrc(),sentHead('If you meant',S.an.text,iss,r.word)),'left');
}
$('board').addEventListener('mouseover',e=>{const row=e.target.closest('.srow');if(row&&canHover()&&S.stage>=2)studioHover(row);});
$('board').addEventListener('mouseout',e=>{const row=e.target.closest('.srow');if(row&&!row.contains(e.relatedTarget))hideHover();});
$('board').addEventListener('focusin',e=>{const row=e.target.closest('.srow');if(row&&S.stage>=2&&row.matches(':focus-visible'))studioHover(row);});
$('board').addEventListener('focusout',e=>{if(e.target.closest('.srow'))hideHover();});
$('board').addEventListener('keydown',e=>{const row=e.target.closest('.srow');if(row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();row.click();}});
$('issues').addEventListener('click',e=>{const b=e.target.closest('[data-i]');if(b)openIssue(+b.dataset.i);});
$('check').onclick=()=>studioCheck(0);
$('sentence').addEventListener('input',()=>{updateMirror();if(S.an&&engine){S.an=null;S.idx=-1;renderIssues();boardMessage('New sentence, new case','Press <b>Check my sentence</b> when you are ready.');}});
$('sentence').addEventListener('scroll',()=>{$('mirror').scrollTop=$('sentence').scrollTop;});
$('sentence').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();studioCheck(0);}});
document.querySelectorAll('[data-ex]').forEach(b=>b.addEventListener('click',()=>{$('sentence').value=b.dataset.ex;S.ignored.clear();updateMirror();studioCheck(0);}));

/* =================================================================
   3. TEACH IT: corpus lab (bigram model trained on your text)
   ================================================================= */
const PRESETS={
  pets:{text:'I saw a cat today.\nA cat today was sleeping by the window.\nMy friend has a cat.\nThe cat likes to sit on the mat.\nI saw a cat in the garden.\nA small cat played with a ball.\nWe saw a cat today.\nThe dog chased a ball in the park.\nMy pet cat is very curious.',test:'I saw a dat today.'},
  cricket:{text:'I saw a bat today.\nA bat today was on sale at the sports shop.\nMy friend has a bat.\nThe player hit the ball with a bat.\nI saw a bat at the cricket ground.\nA new bat helped our team.\nWe saw a bat today.\nThe cricket team won the match.\nMy cricket bat is made of wood.',test:'I saw a dat today.'},
  space:{text:'I saw a star in the sky.\nWe saw a star in the sky.\nA bright star shines in the night sky.\nThe star is very far away.\nA star gives off light.\nI watched a star through a telescope.\nThe moon orbits the Earth.\nOur rocket will travel into space.\nThe planet has a rocky surface.',test:'I saw a strr in the sky.'},
  blank:{text:'',test:'I saw a dat today.'}
};
const T={model:null,engine:null,trained:null,last:null,idx:0,ticket:0};
function corpusStats(){
  const v=$('corpus-text').value,ss=E.splitSentences(v),ws=E.words(v);
  $('corpus-stats').textContent=`${ss.length} sentence${ss.length===1?'':'s'} · ${ws.length} words · ${new Set(ws).size} different`;
  const fresh=T.trained!==null&&v===T.trained;$('corpus-dirty').textContent=fresh?'The model has read this':'Changed: press Teach the model';$('corpus-dirty').className=fresh?'fresh':'dirty';
}
async function teach(animate=true){
  if(!model)return;
  const text=$('corpus-text').value,t=++T.ticket;
  T.model=E.LanguageModel.fromText(text,model.vocab);T.engine=new E.SpellEngine(T.model);T.trained=text;T.sents=E.splitSentences(text);TH.sel=null;paintCorpus(null);corpusStats();
  const sents=E.splitSentences(text),pairs=sents.reduce((a,s)=>a+s.length+1,0);
  if(animate&&sents.length){$('teach-btn').disabled=true;const step=Math.max(30,Math.min(140,1400/sents.length));for(let k=1;k<=sents.length;k++){if(t!==T.ticket)return;$('reading').innerHTML=`<span class="spinner"></span> Reading sentence ${k} of ${sents.length}`;await sleep(step);}$('teach-btn').disabled=false;}
  if(t!==T.ticket)return;
  $('reading').innerHTML=sents.length?`Learned from ${sents.length} sentence${sents.length>1?'s':''}: ${pairs} word pairs, ${T.model.bi.size} of them different.`:'Nothing to read yet, so only the spelling clue can help.';
  renderLab(true);
}
const lbl=w=>w===E.START?'(start)':w===E.END?'(end)':w;
function labSuspect(w){
  const r=T.ranked&&T.ranked.find(x=>x.word===w);if(!r)return;T.sw=w;
  $('lab-sus').querySelectorAll('[data-lw]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lw===w)));
  $('lab-win').innerHTML=windowsHTML(r,T.model,w,'It');labWindow(0);
}
function labWindow(k){
  const r=T.ranked.find(x=>x.word===T.sw);if(!r)return;
  $('lab-win').querySelectorAll('.window').forEach((x,i)=>x.setAttribute('aria-pressed',String(i===k)));
  renderPile($('lab-pile'),r.clues[k],r.word,{kind:'mini',model:T.model,sents:T.sents});
  T.win=k;const pat=corpusPat(r.clues[k]);TH.sel=pat?[pat]:[];paintCorpus(TH.sel);
}
function renderLab(compare){
  hideHover();TH.sel=null;paintCorpus(null);
  if(!T.engine){$('lab-msg').innerHTML='<span class="loading-dots">Getting the mini detective ready</span>';return;}
  const text=$('lab-sentence').value,an=T.engine.analyze(text);
  if(!an.tokens.length){$('lab-msg').textContent='Type a test sentence with a typo in it.';$('lab-results').innerHTML='';return;}
  if(!an.issues.length){$('lab-msg').textContent='No unknown words in this sentence. Try a typo, like “dat”.';$('lab-results').innerHTML='';T.last=null;return;}
  T.idx=Math.min(T.idx,an.issues.length-1);const iss=an.issues[T.idx];
  $('lab-msg').innerHTML=esc(text.slice(0,iss.start))+'<mark>'+esc(iss.raw)+'</mark>'+esc(text.slice(iss.end))+(an.issues.length>1?' &nbsp; '+an.issues.map((x,i)=>`<button class="issue-chip" data-li="${i}" aria-pressed="${i===T.idx}">${esc(x.raw)}</button>`).join(' '):'');
  const ranked=T.engine.rank(iss.word,iss.prev,iss.next);
  if(!ranked.length){$('lab-results').innerHTML='<p class="fine">No dictionary word is within two changes of this typo.</p>';T.last=null;return;}
  const win=ranked[0],prev=compare&&T.last&&T.last.text===text&&T.last.start===iss.start?T.last.word:null;
  const pick=[],add=r=>{if(r&&!pick.includes(r)&&pick.length<5)pick.push(r);};
  ranked.slice(0,3).forEach(add);add([...ranked].sort((a,b)=>b.channel-a.channel)[0]);add([...ranked].sort((a,b)=>b.lm-a.lm)[0]);
  const fixed=E.replace(iss.raw,{start:0,end:iss.raw.length,raw:iss.raw},win.word);
  $('lab-results').innerHTML=
    (prev&&prev!==win.word?`<div class="flip-banner">The pick flipped! ${tilesHTML(prev,'sm')} → ${tilesHTML(win.word,'sm')}<span style="font-size:16px">Same typo, new reading list.</span></div>`:'')+
    (T.model.textWords===0?'<p class="fine">It has read nothing yet, so every sentence pattern is equally unknown. Only the spelling clue is helping.</p>':'')+
    `<div class="pick"><div><div class="fine" style="font-weight:800;color:#05795b">The mini detective picks</div><div class="ps">${esc(text.slice(0,iss.start))}<mark>${esc(fixed)}</mark>${esc(text.slice(iss.end))}</div></div><button class="btn go small" id="lab-use">Use it</button></div>
    <div class="legend" style="margin-top:6px"><span class="l-spell"><i></i>Spelling</span><span class="l-sent"><i></i>Sentence</span><span class="l-final"><i></i>Final points</span></div>
    <div class="lab-rows">${pick.map((r,i)=>`<div class="lab-row ${r===win?'top':''}" data-hw="${esc(r.word)}"><div class="wd">${esc(r.word)}</div><div class="m">${pts(r.channelShare)}<div class="bar spell"><i data-w="${r.channelShare*100}"></i></div></div><div class="m">${pts(r.lmShare)}<div class="bar sent"><i data-w="${r.lmShare*100}"></i></div></div><div class="m">${pts(r.share)}<div class="bar final"><i data-w="${r.share*100}"></i></div></div></div>`).join('')}</div>
    <p class="fine">All ${ranked.length} dictionary suspects share each set of points. Spelling points depend only on the typo, so they never change when you teach it. Sentence points come only from your reading list.</p>
    <div class="evidence"><h3>Where the sentence clue came from</h3><p class="fine" style="margin-bottom:8px">Pick a suspect, then tap a word pair. The highlighter marks every place that pair turns up in the reading list.</p><div class="suspect-tabs" id="lab-sus">${pick.map(r=>`<button class="chip-btn" data-lw="${esc(r.word)}" aria-pressed="false">${esc(r.word)}</button>`).join('')}</div><div class="windows" id="lab-win"></div><div class="pile" id="lab-pile"></div></div>`;
  requestAnimationFrame(()=>requestAnimationFrame(()=>$('lab-results').querySelectorAll('.bar>i[data-w]').forEach(i=>{i.style.width=i.dataset.w+'%';})));
  $('lab-use').onclick=()=>{$('lab-sentence').value=E.replace(text,iss,win.word);renderLab(false);};
  T.ranked=ranked;T.iss=iss;T.text=text;labSuspect(win.word);
  T.last={text,start:iss.start,word:win.word};
}
document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{const p=PRESETS[b.dataset.preset];$('corpus-text').value=p.text;$('lab-sentence').value=p.test;T.idx=0;document.querySelectorAll('[data-preset]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));teach(true);if(b.dataset.preset==='blank')$('corpus-text').focus();}));
$('corpus-text').addEventListener('scroll',()=>{$('corpus-mirror').scrollTop=$('corpus-text').scrollTop;});
$('corpus-text').addEventListener('input',()=>{paintCorpus(TH.sel,false);corpusStats();document.querySelectorAll('[data-preset]').forEach(x=>x.setAttribute('aria-pressed','false'));});
$('teach-btn').onclick=()=>teach(true);
$('lab-check').onclick=()=>{T.idx=0;renderLab(false);};
$('lab-sentence').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();T.idx=0;renderLab(false);}});
$('lab-sentence').addEventListener('input',()=>{$('lab-msg').textContent='Press Check to test your new sentence.';$('lab-results').innerHTML='';});
$('lab-msg').addEventListener('click',e=>{const b=e.target.closest('[data-li]');if(b){T.idx=+b.dataset.li;renderLab(false);}});
// Teach it: hover a suspect for its clippings; hover a word pair to light it up in the training text
$('lab-results').addEventListener('mouseover',e=>{
  if(!canHover())return;
  const s=e.target.closest('.lab-row[data-hw],#lab-sus [data-lw]');if(s){teachHover(s,s.dataset.hw||s.dataset.lw);return;}
  const w=e.target.closest('#lab-win .window');
  if(w&&T.ranked){const r=T.ranked.find(x=>x.word===T.sw),pat=r&&corpusPat(r.clues[+w.dataset.k]);if(r){T.hoverWin=w;paintCorpus(pat?[pat]:[]);}}
});
$('lab-results').addEventListener('mouseout',e=>{
  const s=e.target.closest('.lab-row[data-hw],#lab-sus [data-lw]');if(s&&!s.contains(e.relatedTarget)){hideHover();return;}
  const w=e.target.closest('#lab-win .window');if(w&&!w.contains(e.relatedTarget)&&T.hoverWin===w){T.hoverWin=null;paintCorpus(TH.sel,false);}
});
$('lab-results').addEventListener('focusin',e=>{const s=e.target.closest('#lab-sus [data-lw]');if(s&&s.matches(':focus-visible'))teachHover(s,s.dataset.lw);});
$('lab-results').addEventListener('focusout',e=>{if(e.target.closest('#lab-sus [data-lw]'))hideHover();});
$('lab-results').addEventListener('click',e=>{const b=e.target.closest('[data-lw]');if(b){labSuspect(b.dataset.lw);return;}const w=e.target.closest('#lab-win .window');if(w)labWindow(+w.dataset.k);});

/* =================================================================
   4. FLIP CHALLENGE (bigram model, two named suspects)
   ================================================================= */
const LEVELS=[
  {name:'Level 1',sub:'cat or bat?',sentence:'I saw a dat today.',typo:'dat',prev:'a',next:'today',A:'cat',B:'bat',
   seed:['I saw a cat today.','I saw a cat today.','I saw a cat today.','I saw a bat today.'],vocab:['i','saw','a','cat','bat','today'],
   ideas:['I saw a bat today.','We found a bat today.','A bat flew past my window.','The bat was hanging upside down.','Bats sleep in caves.','I saw a cat today.']},
  {name:'Level 2',sub:'palm or plum?',sentence:'We ate a plam for lunch.',typo:'plam',prev:'a',next:'for',A:'palm',B:'plum',
   seed:['We ate a plum for lunch.','We ate a plum for lunch.','We sat under a palm tree.'],vocab:['we','ate','a','plum','palm','for','lunch'],
   ideas:['We ate a plum for lunch.','I had a plum for breakfast.','I ate a plum.','The plum was juicy.','Plums are sweet.','We sat under a palm tree.']}
];
const C={lv:0,adds:[[],[]],won:[false,false],cele:[false,false],prevCounts:null,lastAdded:-1};
function chScore(extra=''){
  const L=LEVELS[C.lv],text=[...L.seed,...C.adds[C.lv].map(a=>a.text),extra].filter(Boolean).join('\n');
  const m=E.LanguageModel.fromText(text,L.vocab),e=new E.SpellEngine(m),r=e.rank(L.typo,L.prev,L.next,[L.A,L.B]);
  const o={m};for(const x of r)o[x.word]=x;return o;
}
const nextName=L=>L.next===E.END?'(end)':L.next;
function svgWord(word,fill){return [...word].map((c,k)=>`<g transform="translate(${k*31} 0)"><rect width="28" height="34" rx="6" fill="${fill}" stroke="#1a1f2e" stroke-width="2.5"/><text x="14" y="25" text-anchor="middle" font-family="Source Sans 3, Segoe UI, sans-serif" font-weight="800" font-size="20" fill="#1a1f2e">${esc(c)}</text></g>`).join('');}
function renderChallenge(){
  const L=LEVELS[C.lv],s=chScore(),ratio=s[L.A].channel/s[L.B].channel;
  $('levels').innerHTML=LEVELS.map((l,i)=>`<button class="level-btn" data-lv="${i}" aria-pressed="${i===C.lv}">${C.won[i]?'<span class="star" aria-label="completed">★</span>':''}<span>${l.name} <small>${l.sub}${i===1?' (harder)':''}</small></span></button>`).join('');
  const typed=esc(L.sentence).replace(esc(L.typo),`<span class="typo-word">${esc(L.typo)}</span>`);
  const story=C.lv===0
    ?`Right now it picks <b>${L.A}</b>. Both suspects are exactly one wrong key away from “${L.typo}”, so their spelling clues are tied. Only the sentence clue can break the tie, and that clue comes from what it has read.`
    :`Right now it picks <b>${L.A}</b>. “${L.A}” → “${L.typo}” is two neighbours swapped, a common slip. “${L.B}” → “${L.typo}” needs one particular wrong key, which is rare. So ${L.A} starts with a <b>${ratio.toFixed(1)}× head start</b> on the spelling clue. Can your sentences beat it?`;
  $('mission').innerHTML=`<div><span class="callout-tag">${L.name}: your mission</span><h2>Make the detective pick <span class="good-word">${L.B}</span></h2><div class="typed-s">${typed}</div><p>${story}</p></div>
    <div class="versus"><div class="side">${tilesHTML(L.A,'sm')}<br>spelling clue<br><b class="k-spell">${oneIn(s[L.A].channel)}</b></div><div class="mid">vs</div><div class="side">${tilesHTML(L.B,'sm')}<br>spelling clue<br><b class="k-spell">${oneIn(s[L.B].channel)}</b></div></div>`;
  $('writer-hint').innerHTML=`For “${L.prev} ___ ${nextName(L)}”, the sentence clue multiplies two chances: which word comes after “${L.prev}”, and whether ${L.next===E.END?'the sentence ends':`“${L.next}” comes`} next.`;
  $('ideas').innerHTML=L.ideas.map(t=>`<button class="chip-btn" data-idea="${esc(t)}">${esc(t)}</button>`).join('');
  $('tally-prev').textContent=L.prev;
  $('lib-key').innerHTML=`The highlighter marks the word pairs the sentence clue counts. <mark class="lp b">Yellow pairs</mark> help ${esc(L.B)}. <mark class="lp a">Blue pairs</mark> help ${esc(L.A)}.`;
  $('seesaw').innerHTML=`<line x1="16" y1="182" x2="424" y2="182" stroke="#1a1f2e" stroke-width="3" stroke-linecap="round"/><path d="M220 122 190 182h60z" fill="#FFB703" stroke="#1a1f2e" stroke-width="3" stroke-linejoin="round"/><g class="plank" id="plank"><rect x="24" y="112" width="392" height="14" rx="7" fill="#7B2CBF" stroke="#1a1f2e" stroke-width="3"/><g transform="translate(34 74)">${svgWord(L.A,'#eef0f5')}</g><g transform="translate(${406-L.B.length*31} 74)">${svgWord(L.B,'#fef3c7')}</g></g><circle cx="220" cy="120" r="6" fill="#1a1f2e"/>`;
  const T=s[L.A].channel/(s[L.A].channel+s[L.B].channel);
  $('splits').innerHTML=['spell','sent','final'].map(k=>`<div class="split ${k}" id="sp-${k}"><div class="lab"><span>${k==='spell'?'Spelling points <span class="fixed">fixed</span>':k==='sent'?'Sentence points':'Final points'}</span><span class="nums"></span></div><div class="track"><div class="a"></div><div class="b"></div>${k==='sent'?`<span class="target" style="left:${(1-T)*100}%"><span>${L.B} must pass ${pts(T)}</span></span>`:''}</div></div>`).join('');
  C.prevCounts=null;C.lastAdded=-1;$('chal-text').value='';$('win-slot').innerHTML='';
  updateChallenge();preview();
}
function cell(id,pair,count,of,p){return `<div class="tcell" data-id="${id}" data-v="${count}"><div class="pair">${pair}</div><div class="cnt">${count}</div><div class="of">${of}</div><div class="of">chance ${pct(p)}</div></div>`;}
function updateChallenge(ev){
  const L=LEVELS[C.lv],s=chScore(),m=s.m,a=s[L.A],b=s[L.B];
  const setSplit=(k,av,bv)=>{const el=$('sp-'+k);el.querySelector('.a').style.width=av*100+'%';el.querySelector('.b').style.width=bv*100+'%';el.querySelector('.a').textContent=av>.14?L.A:'';el.querySelector('.b').textContent=bv>.14?L.B:'';el.querySelector('.nums').textContent=`${L.A} ${pts(av)} · ${L.B} ${pts(bv)}`;};
  setSplit('spell',a.channelShare,b.channelShare);setSplit('sent',a.lmShare,b.lmShare);setSplit('final',a.share,b.share);
  const ang=Math.max(-16,Math.min(16,(b.share-a.share)*16));$('plank').style.transform=`rotate(${ang}deg)`;
  $('seesaw').setAttribute('aria-label',`See-saw: ${L.A} ${pts(a.share)} final points, ${L.B} ${pts(b.share)} final points.`);
  // tallies
  const tp=m.out.get(L.prev)||0,ta=m.out.get(L.A)||0,tb=m.out.get(L.B)||0;
  const pa1=m.probability(L.A,L.prev),pb1=m.probability(L.B,L.prev),pa2=m.probability(L.next,L.A),pb2=m.probability(L.next,L.B);
  const nn=nextName(L);
  $('tally').innerHTML=`<span></span><span class="h ha">${L.A}</span><span class="h hb">${L.B}</span>
    <span class="rl">Word after “${L.prev}”</span>${cell('a1',`${L.prev} → ${L.A}`,m.count(L.prev,L.A),`of ${tp} after “${L.prev}”`,pa1)}${cell('b1',`${L.prev} → ${L.B}`,m.count(L.prev,L.B),`of ${tp} after “${L.prev}”`,pb1)}
    <span class="rl">${L.next===E.END?'Then the sentence ends':`Then “${L.next}”`}</span>${cell('a2',`${L.A} → ${nn}`,m.count(L.A,L.next),`of ${ta} after “${L.A}”`,pa2)}${cell('b2',`${L.B} → ${nn}`,m.count(L.B,L.next),`of ${tb} after “${L.B}”`,pb2)}
    <span class="rl">Both chances multiplied</span><div class="tcell"><div class="pair">sentence clue</div><div class="cnt" style="font-size:20px">${pct(pa1*pa2)}</div></div><div class="tcell"><div class="pair">sentence clue</div><div class="cnt" style="font-size:20px">${pct(pb1*pb2)}</div></div>`;
  const counts={};$('tally').querySelectorAll('.tcell[data-id]').forEach(c=>{counts[c.dataset.id]=c.dataset.v+'/'+c.querySelector('.of').textContent;if(C.prevCounts&&C.prevCounts[c.dataset.id]!==counts[c.dataset.id])c.classList.add('bump');});
  C.prevCounts=counts;
  // library
  const adds=C.adds[C.lv];
  $('lib-list').innerHTML=L.seed.map(t=>`<li class="seed"><span>${hlPairs(t,L)}</span></li>`).join('')+adds.map((x,i)=>{const d=x.delta*100,cls=Math.abs(d)<0.05?'flat':d>0?'up':'down';return `<li class="${i===C.lastAdded?'new':''}"><span>${hlPairs(x.text,L)}</span> <span class="eff ${cls}">${cls==='flat'?'±0':(d>0?'+':'−')+Math.abs(d).toFixed(1)} ${L.B}</span></li>`;}).join('');
  const nS=adds.reduce((t,x)=>t+E.splitSentences(x.text).length,0);
  $('lib-count').textContent=`(${L.seed.length} to start${nS?`, plus ${nS} from you`:''})`;
  // status
  const winNow=b.share>a.share+1e-12,tie=Math.abs(b.share-a.share)<=1e-12;
  let msg;
  if(winNow)msg=`${L.B} leads with ${pts(b.share)} final points. You flipped it!`;
  else if(tie)msg=`A perfect tie at 50–50! One more good sentence will tip the see-saw.`;
  else if(ev){const d=ev.delta*100;msg=Math.abs(d)<0.05?`That sentence barely moved anything. It didn't put “${L.B}” right after “${L.prev}” or right before ${L.next===E.END?'the end of a sentence':`“${L.next}”`}.`:d>0?`Nice! ${L.B} gained ${d.toFixed(1)} final points. ${L.A} still leads, with ${pts(a.share)}.`:`Careful: ${L.B} lost ${Math.abs(d).toFixed(1)} points. That sentence helped ${L.A}, or gave “${L.B}” a different next word.`;}
  else msg=adds.length?`${L.A} leads with ${pts(a.share)} final points. Keep going!`:`${L.A} leads with ${pts(a.share)} final points. Write a sentence for it to read.`;
  $('chal-status').textContent=msg;$('chal-status').className='status'+(winNow?' win':tie?' tie':'');
  $('undo-btn').disabled=!adds.length;
  // win
  if(winNow){
    C.won[C.lv]=true;
    if(!C.cele[C.lv]){C.cele[C.lv]=true;confetti();$('levels').querySelector(`[data-lv="${C.lv}"]`)?.insertAdjacentHTML('afterbegin','<span class="star" aria-label="completed">★</span>');}
    const sneaky=adds.some(x=>E.splitSentences(x.text).some(sn=>{let k=0;for(let i=0;i<sn.length-1;i++)if(sn[i]===L.B&&(sn[i+1]===L.next)||sn[i]===L.prev&&sn[i+1]===L.B)k++;return k>=4;}));
    const T=a.channel/(a.channel+b.channel);
    $('win-slot').innerHTML=`<div class="win-panel"><h3>You flipped it with ${nS} sentence${nS===1?'':'s'}!</h3>${C.lv===0
      ?`<p>Both suspects were one wrong key away from “${L.typo}”, so the spelling clue was a tie. The sentence clue decided everything, and you changed what it read. Changing the reading list changed the answer.</p>`
      :`<p>${L.B} had to beat a ${(a.channel/b.channel).toFixed(1)}× spelling head start, so it needed more than <b>${pts(T)}</b> sentence points, not just 50. When clues multiply, a weak clue needs much stronger evidence from the other one.</p>`}
      ${sneaky?`<p><b>Sneaky!</b> You repeated the pattern inside one sentence. The model can't tell a silly sentence from a real one. It just counts.</p>`:''}
      <div class="callout did-you-know" style="margin:12px 0 0"><span class="callout-tag">Connect it</span><p>Real AI models learn the same way, from huge amounts of text. If that text is unbalanced or silly, the guesses are too. That's why people who build AI check their training data carefully.</p></div>
      <div class="cta-row">${C.lv===0?'<button class="btn primary" data-lv="1">Try Level 2: palm or plum</button>':'<button class="btn primary" data-goto="studio">Solve your own cases</button>'}<button class="btn small" id="win-again">Play this level again</button></div></div>`;
  } else $('win-slot').innerHTML='';
}
function analyzeDraft(draft){
  const L=LEVELS[C.lv],chips=new Map(),add=(cls,text)=>{const k=cls+'|'+text;chips.set(k,{cls,text,n:(chips.get(k)?.n||0)+1});};
  const nn=L.next===E.END?'(end)':L.next;
  for(const s of E.splitSentences(draft)){
    const seq=[E.START,...s,E.END];
    for(let k=0;k<seq.length-1;k++){
      const x=seq[k],y=seq[k+1];
      if(y===L.A||y===L.B){if(x===L.prev)add(y===L.B?'help':'hurt',`${x} → ${y}: helps ${y}`);else add('meh',`${lbl(x)} → ${y}: not the “${L.prev} ___” pattern`);}
      if(x===L.A||x===L.B){if(y===L.next)add(x===L.B?'help':'hurt',`${x} → ${nn}: helps ${x}`);else add('meh',`${x} → ${lbl(y)}: a different word follows ${x}, so “${x} → ${nn}” becomes a smaller share`);}
    }
    for(const w of new Set(s)){
      if(w!==L.A&&w!==L.B&&[L.A,L.B].some(c=>w===c+'s'||w===c+'es'||w===c+"'s"))add('warn',`“${w}” is a different word from “${w.replace(/('s|es|s)$/,'')}” to the model`);
      else if(model&&!model.known(w)&&!L.vocab.includes(w))add('warn',`Is “${w}” spelled right? It will be learned exactly as written`);
    }
  }
  return [...chips.values()];
}
let pvTimer;
function preview(){
  const L=LEVELS[C.lv],draft=$('chal-text').value.trim();
  if(!E.words(draft).length){$('preview').innerHTML=`<span class="fine">Your preview appears here. You'll see what a sentence would do <i>before</i> the model reads it.</span>`;return;}
  const before=chScore(),after=chScore(draft),b0=before[L.B],b1=after[L.B];
  const d=(b1.share-b0.share)*100,cls=Math.abs(d)<0.05?'flat':d>0?'up':'down';
  const sentLine=C.lv===1?` <span class="fine">(sentence points ${pts(b0.lmShare)} → ${pts(b1.lmShare)})</span>`:'';
  const chips=analyzeDraft(draft);
  $('preview').innerHTML=`<div class="pv-num">If it reads this, ${L.B}'s final points go <span class="${cls}">${pts(b0.share)} → ${pts(b1.share)} (${cls==='flat'?'no real change':(d>0?'+':'−')+Math.abs(d).toFixed(1)})</span>${sentLine}</div>`+
    (chips.length?`<div class="pchips">${chips.map(c=>`<span class="pchip ${c.cls}">${esc(c.text)}${c.n>1?` ×${c.n}`:''}</span>`).join('')}</div>`:`<div class="fine" style="margin-top:6px">No “${L.A}” or “${L.B}” in this sentence, so it can only change things a tiny bit (by adding to the word counts).</div>`);
}
$('chal-text').addEventListener('input',()=>{clearTimeout(pvTimer);pvTimer=setTimeout(preview,120);});
$('chal-text').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('add-btn').click();}});
$('ideas').addEventListener('click',e=>{const b=e.target.closest('[data-idea]');if(!b)return;$('chal-text').value=b.dataset.idea;preview();$('chal-text').focus();});
$('add-btn').onclick=()=>{
  const L=LEVELS[C.lv],text=$('chal-text').value.trim().replace(/\s+/g,' ');
  if(!E.words(text).length){toast('Write a sentence first.');$('chal-text').focus();return;}
  if(C.adds[C.lv].length>=25){toast('That is a lot of reading! Undo some, or start the level again.');return;}
  const before=chScore();const entry={text,delta:0};C.adds[C.lv].push(entry);const after=chScore();
  entry.delta=after[L.B].share-before[L.B].share;C.lastAdded=C.adds[C.lv].length-1;
  $('chal-text').value='';preview();updateChallenge(entry);
};
$('undo-btn').onclick=()=>{if(!C.adds[C.lv].length)return;C.adds[C.lv].pop();C.lastAdded=-1;updateChallenge();toast('Removed the last sentence.');};
$('reset-btn').onclick=()=>{C.adds[C.lv]=[];C.cele[C.lv]=false;renderChallenge();toast('Level reset.');};
$('flip').addEventListener('click',e=>{const b=e.target.closest('[data-lv]');if(b){C.lv=+b.dataset.lv;renderChallenge();$('levels').scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'});}if(e.target.id==='win-again'){C.adds[C.lv]=[];C.cele[C.lv]=false;renderChallenge();}});

/* ---------- confetti, dialog ---------- */
function confetti(){if(reduced())return;const cols=['#E63946','#F77F00','#FFB703','#06A77D','#2D6CDF','#7B2CBF'];for(let i=0;i<70;i++){const c=document.createElement('i');c.className='confetti';c.setAttribute('aria-hidden','true');c.style.left=(Math.random()*100)+'vw';c.style.background=cols[i%6];c.style.animationDelay=(Math.random()*.6)+'s';c.style.width=(6+Math.random()*7)+'px';document.body.appendChild(c);setTimeout(()=>c.remove(),3400);}}
const openMaths=()=>$('maths').showModal();
$('open-maths').onclick=openMaths;$('open-maths-2').onclick=openMaths;$('close-maths').onclick=()=>$('maths').close();
$('maths').addEventListener('click',e=>{if(e.target===$('maths'))$('maths').close();});

/* ---------- start ---------- */
if(globalThis.CLIP_DATA)document.querySelectorAll('[data-fill="clips"]').forEach(n=>n.textContent=num(globalThis.CLIP_DATA.sentences));
fillSpecSlots();
showTab(location.hash.slice(1)||'journey',false);
renderJourney(false);
boardMessage('Opening my library','Unpacking more than two million example sentences. This only takes a moment.');
$('lab-msg').innerHTML='<span class="loading-dots">Getting the mini detective ready</span>';
updateMirror();
globalThis.WordLabReady=(async()=>{
  try{
    if(!E||!globalThis.WORD_DATA)throw new Error('The word model did not load. Try opening this file in Chrome, Edge, Firefox or Safari.');
    await new Promise(r=>setTimeout(r,30));
    model=await E.ContextModel.fromPacked(globalThis.WORD_DATA);globalThis.WORD_DATA=null;engine=new E.SpellEngine(model);
    document.querySelectorAll('[data-fill="vocab"]').forEach(n=>n.textContent=num(model.meta.vocabulary));
    document.querySelectorAll('[data-fill="sentences"]').forEach(n=>n.textContent=num(model.meta.trainingSentences));
    document.querySelectorAll('[data-fill="words"]').forEach(n=>n.textContent=(model.meta.wordTokens/1e6).toFixed(1)+' million');
    $('check').disabled=false;$('check-label').textContent='Check my sentence';$('load-banner').hidden=true;
    updateMirror();studioCheck(0);
    $('corpus-text').value=PRESETS.pets.text;await teach(false);
    setTimeout(loadClips,0);
    waiting.splice(0).forEach(f=>f());
    preview();
  }catch(err){
    console.error(err);$('check-label').textContent='Reload to try again';$('check').disabled=false;$('check').onclick=()=>location.reload();
    $('load-banner').innerHTML=esc(err.message);boardMessage('The library could not open',esc(err.message));
  }
})();
})();

