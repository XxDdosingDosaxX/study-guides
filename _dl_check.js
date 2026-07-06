
var CTX_COLOR={clinic:'#14b8a6',wards:'#3b82f6',icu:'#f43f5e'};
var CTX_SOFT={clinic:'rgba(20,184,166,.14)',wards:'rgba(59,130,246,.14)',icu:'rgba(244,63,94,.14)'};
function setCtx(ctx){
  document.querySelectorAll('.ctx-btn').forEach(b=>b.classList.toggle('active',b.dataset.ctx===ctx));
  document.querySelectorAll('.ctx-panel').forEach(p=>p.classList.toggle('active',p.dataset.context===ctx));
  document.documentElement.style.setProperty('--ctx',CTX_COLOR[ctx]);
  document.documentElement.style.setProperty('--ctx-soft',CTX_SOFT[ctx]);
  buildNav();
  try{localStorage.setItem('ctx',ctx);}catch(e){}
  window.scrollTo({top:0,behavior:'smooth'});
}
function buildNav(){
  var links=document.getElementById('railLinks');
  if(!links)return;
  links.innerHTML='';
  var active=document.querySelector('.ctx-panel.active');
  var items=[];
  document.querySelectorAll('#snapshot').forEach(s=>items.push({s:s,shared:true}));
  document.querySelectorAll('#pathophys').forEach(s=>items.push({s:s,shared:true}));
  if(active){active.querySelectorAll('.sec').forEach(s=>items.push({s:s,shared:false}));}
  document.querySelectorAll('#pearls,#comorbid,#notes,#references').forEach(s=>items.push({s:s,shared:true}));
  items.forEach(function(it){
    var h=it.s.querySelector('.sec-head h2');
    var label=h?h.textContent:(it.s.id==='snapshot'?'Snapshot':it.s.id);
    var a=document.createElement('a');
    a.href='#'+it.s.id; a.className=it.shared?'shared':'';
    a.innerHTML='<span class="dot"></span>'+label;
    a.addEventListener('click',function(){if(window.innerWidth<=920)closeSheet();});
    links.appendChild(a);
  });
  observeSections();
}
var _obs;
function observeSections(){
  if(_obs)_obs.disconnect();
  var links=document.querySelectorAll('#railLinks a');var map={};links.forEach(l=>map[l.getAttribute('href')]=l);
  _obs=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){links.forEach(l=>l.classList.remove('active'));var l=map['#'+e.target.id];if(l)l.classList.add('active');}});},{rootMargin:'-25% 0px -65% 0px'});
  document.querySelectorAll('.sec[id]').forEach(s=>{if(s.offsetParent!==null||s.dataset.shared||s.id==='references')_obs.observe(s);});
}
function toggleTheme(){document.body.classList.toggle('light');try{localStorage.setItem('sg_theme',document.body.classList.contains('light')?'light':'dark');}catch(e){}}
function copyOsmo(b){try{navigator.clipboard.writeText('Skanda123!');b.textContent='✓';setTimeout(function(){b.innerHTML='&#128273;';},1200);}catch(e){}}
function toggleRung(h){h.parentElement.classList.toggle('open');}

/* generic additive score calculator */
function scoreToggle(el){
  var box=el.closest('.calc');var grp=el.dataset.group;
  if(grp){box.querySelectorAll('.calc-opt[data-group="'+grp+'"]').forEach(function(o){o.classList.remove('sel');});el.classList.add('sel');}
  else el.classList.toggle('sel');
  computeScore(box);
}
function computeScore(box){
  var t=0;box.querySelectorAll('.calc-opt.sel').forEach(function(o){t+=parseInt(o.dataset.pts||'0',10);});
  var st=box.querySelector('.score-total');if(st)st.textContent=t;
  var fn=window[box.dataset.interp];if(fn)fn(t,box);
}
function interp4at(t,box){
  var col,rec;
  if(t>=4){col='#f43f5e';rec='Possible delirium (± cognitive impairment) — confirm clinically, hunt the precipitant.';}
  else if(t>=1){col='#f59e0b';rec='Possible cognitive impairment — evaluate; does not exclude delirium if fluctuating.';}
  else {col='#34d399';rec='Delirium or severe cognitive impairment unlikely on this screen — re-screen if course fluctuates.';}
  box.querySelector('.score-total').style.color=col;
  box.querySelector('.score-interp').innerHTML='<b style="color:'+col+'">'+rec+'</b><br>4AT range 0–12; cutoff ≥4. Source: the4at.com; MacLullich 2014.';
}

/* CAM Boolean-logic diagnostic */
function camToggle(el){el.classList.toggle('sel');evalCAM();}
function evalCAM(){
  var box=document.getElementById('camCalc');
  var f={};box.querySelectorAll('.calc-opt.sel').forEach(function(o){f[o.dataset.feat]=true;});
  var out=document.getElementById('camOut'),det=document.getElementById('camDetail');
  var positive=(f['1']&&f['2'])&&(f['3']||f['4']);
  if(positive){
    out.textContent='CAM POSITIVE';out.style.color='#f43f5e';
    det.innerHTML='<b style="color:#f43f5e">Delirium diagnosed</b> — features (1 AND 2) AND (3 OR 4) satisfied. Search for and treat the precipitant; start the non-pharmacologic bundle.';
  } else {
    out.textContent='CAM negative';out.style.color='#34d399';
    var need=[];
    if(!f['1'])need.push('acute onset/fluctuation');
    if(!f['2'])need.push('inattention');
    if(!f['3']&&!f['4'])need.push('disorganized thinking OR altered LOC');
    det.innerHTML='<b style="color:#34d399">Criteria not met.</b> '+(need.length?'Still need: '+need.join(', ')+'. ':'')+'Delirium fluctuates — re-assess if the picture changes.';
  }
}

/* tabs */
document.addEventListener('click',function(e){
  var t=e.target.closest('.tab');if(!t)return;var wrap=t.closest('.module')||document;
  wrap.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  wrap.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');var p=wrap.querySelector('#'+t.dataset.panel);if(p)p.classList.add('active');
});
/* lightbox */
(function(){
  var lb=document.getElementById('lightbox'),im=document.getElementById('lbimg'),x=document.getElementById('lbx');
  document.addEventListener('click',function(e){var img=e.target.closest('.fig img');if(img&&!lb.classList.contains('on')){im.src=img.src;im.alt=img.alt;lb.classList.add('on');document.body.style.overflow='hidden';}});
  function close(){lb.classList.remove('on');document.body.style.overflow='';im.src='';}
  lb.addEventListener('click',function(e){if(e.target!==im)close();});x.addEventListener('click',close);
  document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
})();
function toggleSheet(){document.getElementById('rail').classList.toggle('sheet');}
function closeSheet(){document.getElementById('rail').classList.remove('sheet');}
/* notes */
var NOTE_KEY='sgnotes_'+(location.pathname.split('/').pop()||'guide');
function loadNotes(){try{return JSON.parse(localStorage.getItem(NOTE_KEY)||'[]');}catch(e){return[];}}
function saveNotes(a){try{localStorage.setItem(NOTE_KEY,JSON.stringify(a));}catch(e){}}
function renderNotes(){var a=loadNotes(),el=document.getElementById('noteList');if(!el)return;el.innerHTML='';a.forEach(function(n,i){var c=document.createElement('div');c.className='note-card';var m=document.createElement('div');m.className='note-meta';var ts=document.createElement('span');ts.textContent=n.ts;var d=document.createElement('span');d.className='note-del';d.textContent='✕';d.addEventListener('click',function(){delNote(i);});m.appendChild(ts);m.appendChild(d);var t=document.createElement('div');t.className='note-text';t.textContent=n.text;c.appendChild(m);c.appendChild(t);el.appendChild(c);});}
function addNote(){var ta=document.getElementById('noteInput'),v=ta.value.trim();if(!v)return;var a=loadNotes();a.unshift({text:v,ts:new Date().toLocaleString()});saveNotes(a);ta.value='';try{localStorage.removeItem(NOTE_KEY+'_draft');}catch(e){}renderNotes();}
function delNote(i){var a=loadNotes();a.splice(i,1);saveNotes(a);renderNotes();}
function initNotes(){var ni=document.getElementById('noteInput');if(ni){try{ni.value=localStorage.getItem(NOTE_KEY+'_draft')||'';}catch(e){}ni.addEventListener('input',function(){try{localStorage.setItem(NOTE_KEY+'_draft',ni.value);}catch(e){}});}renderNotes();}
/* init */
(function(){
  try{if(localStorage.getItem('sg_theme')==='light')document.body.classList.add('light');}catch(e){}
  var start='clinic';
  try{var s=localStorage.getItem('ctx');if(s)start=s;}catch(e){}
  setCtx(start);
  initNotes();
  document.querySelectorAll('.calc[data-interp]').forEach(function(b){computeScore(b);});
})();
