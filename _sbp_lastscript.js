
/* ============================================================
   CONTEXT SWITCHER  — swaps panels, retints accent, rebuilds nav
   ============================================================ */
var CTX_COLOR = {clinic:'#14b8a6', wards:'#3b82f6', icu:'#f43f5e'};
var CTX_SOFT  = {clinic:'rgba(20,184,166,.14)', wards:'rgba(59,130,246,.14)', icu:'rgba(244,63,94,.14)'};
function setCtx(ctx){
  document.querySelectorAll('.ctx-btn').forEach(b=>b.classList.toggle('active', b.dataset.ctx===ctx));
  document.querySelectorAll('.ctx-panel').forEach(p=>p.classList.toggle('active', p.dataset.context===ctx));
  document.documentElement.style.setProperty('--ctx', CTX_COLOR[ctx]);
  document.documentElement.style.setProperty('--ctx-soft', CTX_SOFT[ctx]);
  buildNav();
  try{ localStorage.setItem('ctx', ctx); }catch(e){}
  window.scrollTo({top:0, behavior:'smooth'});
}

/* ============================================================
   BUILD TOC RAIL for the active context (shared + context sections)
   ============================================================ */
function buildNav(){
  var links = document.getElementById('railLinks');
  if(!links) return;
  links.innerHTML='';
  // shared sections above the panels
  var shared = document.querySelectorAll('.content > .sec[data-shared], .content > #snapshot');
  var active = document.querySelector('.ctx-panel.active');
  var items = [];
  document.querySelectorAll('.sec[data-shared]').forEach(s=>items.push({s:s,shared:true}));
  if(active){ active.querySelectorAll('.sec').forEach(s=>items.push({s:s,shared:false})); }
  document.querySelectorAll('#references').forEach(s=>items.push({s:s,shared:true}));
  items.forEach(function(it){
    var h=it.s.querySelector('.sec-head h2'); if(!h) return;
    var a=document.createElement('a');
    a.href='#'+it.s.id; a.className = it.shared?'shared':'';
    a.innerHTML='<span class="dot"></span>'+h.textContent;
    a.addEventListener('click', function(){ if(window.innerWidth<=920) closeSheet(); });
    links.appendChild(a);
  });
  observeSections();
}

/* ============================================================
   SCROLL-SPY
   ============================================================ */
var _obs;
function observeSections(){
  if(_obs) _obs.disconnect();
  var links = document.querySelectorAll('#railLinks a');
  var map={}; links.forEach(l=>map[l.getAttribute('href')]=l);
  _obs=new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(e.isIntersecting){
        links.forEach(l=>l.classList.remove('active'));
        var l=map['#'+e.target.id]; if(l) l.classList.add('active');
      }
    });
  },{rootMargin:'-25% 0px -65% 0px'});
  document.querySelectorAll('.sec[id]').forEach(s=>_obs.observe(s));
}

/* ============================================================
   THEME
   ============================================================ */
function toggleTheme(){
  document.body.classList.toggle('light');
  try{ localStorage.setItem('sg_theme', document.body.classList.contains('light')?'light':'dark'); }catch(e){}
}

/* ============================================================
   OSMOSIS LOGIN — app-bar key button (click to copy password)
   ============================================================ */
function copyOsmo(b){
  try{ navigator.clipboard.writeText('Skanda123!'); b.textContent='✓';
       setTimeout(function(){ b.innerHTML='&#128273;'; },1200); }catch(e){}
}

/* ============================================================
   LADDER ACCORDION
   ============================================================ */
/* ============================================================
   SCORE CALCULATORS
   ============================================================ */
function scoreToggle(el){
  var box=el.closest('.calc'); var grp=el.dataset.group;
  if(grp){ box.querySelectorAll('.calc-opt[data-group="'+grp+'"]').forEach(function(o){o.classList.remove('sel');}); el.classList.add('sel'); }
  else el.classList.toggle('sel');
  computeScore(box);
}
function computeScore(box){
  var t=0; box.querySelectorAll('.calc-opt.sel').forEach(function(o){t+=parseInt(o.dataset.pts||'0',10);});
  var tot=box.querySelector('.score-total'); if(tot) tot.textContent=t;
  var fn=window[box.dataset.interp]; if(fn) fn(t,box);
}
function interpChildPugh(t,box){
  var col,cls,rec;
  if(t<=6){col='#34d399';cls='Class A (5–6)';rec='Well-compensated — ~100% 1-yr survival.';}
  else if(t<=9){col='#f59e0b';cls='Class B (7–9)';rec='Significant compromise — ~81% 1-yr survival. CTP ≥9 + bilirubin ≥3 meets a primary-prophylaxis trigger.';}
  else {col='#f43f5e';cls='Class C (10–15)';rec='Decompensated — ~45% 1-yr survival. Prioritize transplant evaluation.';}
  box.querySelector('.score-total').style.color=col;
  box.querySelector('.score-interp').innerHTML='<b style="color:'+col+'">'+cls+'</b><br>'+rec;
}
/* Ascitic fluid analyzer */
function calcAscites(){
  var wbc=parseFloat(document.getElementById('af_wbc').value);
  var pct=parseFloat(document.getElementById('af_pct').value);
  var rbc=parseFloat(document.getElementById('af_rbc').value);
  var salb=parseFloat(document.getElementById('af_salb').value);
  var aalb=parseFloat(document.getElementById('af_aalb').value);
  var out=document.getElementById('af_out'), det=document.getElementById('af_detail');
  var parts=[];
  if(!isNaN(wbc)&&!isNaN(pct)){
    var pmn=wbc*pct/100;
    var corr=pmn;
    if(!isNaN(rbc)&&rbc>0){ corr=pmn-(rbc/250); }
    corr=Math.max(0,Math.round(corr));
    var sbp=corr>=250;
    out.textContent='Corrected PMN '+corr+'/mm³';
    out.style.color=sbp?'#f43f5e':'#34d399';
    parts.push('<b style="color:'+(sbp?'#f43f5e':'#34d399')+'">'+(sbp?'PMN ≥250 → SBP — tap-confirmed; start antibiotics + albumin now.':'PMN <250 — not neutrocytic; if culture positive = bacterascites, treat if symptomatic.')+'</b>');
    parts.push('Raw PMN = '+Math.round(pmn)+'/mm³'+((!isNaN(rbc)&&rbc>0)?(' − RBC correction ('+Math.round(rbc/250)+') = '+corr):''));
  } else {
    out.textContent='—'; out.style.color='';
    parts.push('Corrected PMN = (WBC × %PMN/100) − (RBC ÷ 250). SBP if ≥250/mm³.');
  }
  if(!isNaN(salb)&&!isNaN(aalb)){
    var saag=(salb-aalb);
    parts.push('SAAG = '+saag.toFixed(1)+' g/dL → '+(saag>=1.1?'<b>≥1.1 = portal-hypertensive ascites</b> (the SBP substrate)':'<1.1 = non-portal (carcinomatosis/TB/pancreatic) — reconsider the frame'));
  }
  det.innerHTML=parts.join('<br>');
}
function toggleRung(h){ h.parentElement.classList.toggle('open'); }

/* ============================================================
   TABS
   ============================================================ */
document.addEventListener('click', function(e){
  var t=e.target.closest('.tab'); if(!t) return;
  var wrap=t.closest('.module')||document;
  wrap.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  wrap.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  var p=wrap.querySelector('#'+t.dataset.panel); if(p) p.classList.add('active');
});

/* ============================================================
   LIGHTBOX
   ============================================================ */
(function(){
  var lb=document.getElementById('lightbox'), im=document.getElementById('lbimg'), x=document.getElementById('lbx');
  document.addEventListener('click', function(e){
    var img=e.target.closest('.fig img, .svg-wrap img');
    if(img && !lb.classList.contains('on')){ im.src=img.src; im.alt=img.alt; lb.classList.add('on'); document.body.style.overflow='hidden'; return; }
  });
  function close(){ lb.classList.remove('on'); document.body.style.overflow=''; im.src=''; }
  lb.addEventListener('click', function(e){ if(e.target!==im) close(); });
  x.addEventListener('click', close);
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') close(); });
})();

/* ============================================================
   MOBILE TOC SHEET
   ============================================================ */
function toggleSheet(){ document.getElementById('rail').classList.toggle('sheet'); }
function closeSheet(){ document.getElementById('rail').classList.remove('sheet'); }

/* ============================================================
   INIT
   ============================================================ */
// ============================================================
// PER-DISEASE NOTES — auto-saved to localStorage, timestamped
// ============================================================
var NOTE_KEY='sgnotes_'+(location.pathname.split('/').pop()||'guide');
function loadNotes(){try{return JSON.parse(localStorage.getItem(NOTE_KEY)||'[]');}catch(e){return[];}}
function saveNotes(a){try{localStorage.setItem(NOTE_KEY,JSON.stringify(a));}catch(e){}}
function renderNotes(){var a=loadNotes(),el=document.getElementById('noteList');if(!el)return;el.innerHTML='';a.forEach(function(n,i){var c=document.createElement('div');c.className='note-card';var m=document.createElement('div');m.className='note-meta';var ts=document.createElement('span');ts.textContent=n.ts;var d=document.createElement('span');d.className='note-del';d.textContent='✕';d.addEventListener('click',function(){delNote(i);});m.appendChild(ts);m.appendChild(d);var t=document.createElement('div');t.className='note-text';t.textContent=n.text;c.appendChild(m);c.appendChild(t);el.appendChild(c);});}
function addNote(){var ta=document.getElementById('noteInput'),v=ta.value.trim();if(!v)return;var a=loadNotes();a.unshift({text:v,ts:new Date().toLocaleString()});saveNotes(a);ta.value='';try{localStorage.removeItem(NOTE_KEY+'_draft');}catch(e){}renderNotes();}
function delNote(i){var a=loadNotes();a.splice(i,1);saveNotes(a);renderNotes();}
function initNotes(){var ni=document.getElementById('noteInput');if(ni){try{ni.value=localStorage.getItem(NOTE_KEY+'_draft')||'';}catch(e){}ni.addEventListener('input',function(){try{localStorage.setItem(NOTE_KEY+'_draft',ni.value);}catch(e){}});}renderNotes();}

(function(){
  try{ if(localStorage.getItem('sg_theme')==='light') document.body.classList.add('light'); }catch(e){}
  var start='clinic';
  try{ var s=localStorage.getItem('ctx'); if(s) start=s; }catch(e){}
  setCtx(start);
  document.querySelectorAll('.calc[data-interp]').forEach(computeScore);
  initNotes();
})();
