
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
   DKA CALCULATORS
   ============================================================ */
function ketoneTriage(){
  var v=parseFloat(document.getElementById('ketoneVal').value);
  var out=document.getElementById('keto-out'), det=document.getElementById('keto-detail');
  if(isNaN(v)){ out.textContent='Enter a value'; out.style.color='var(--ctx)';
    det.textContent='<0.6 normal · 0.6–1.5 recheck & extra fluid/insulin · 1.5–3.0 high, correction insulin + call team · ≥3.0 = go to ED.'; return; }
  var col, msg, detail;
  if(v<0.6){ col='#34d399'; msg='Normal ('+v+' mmol/L)'; detail='Ketones not significantly elevated. Continue usual insulin, treat the illness, hydrate, recheck if symptoms progress.'; }
  else if(v<1.5){ col='#38bdf8'; msg='Mildly elevated ('+v+' mmol/L)'; detail='Follow sick-day rules: extra fluids, do NOT stop basal insulin, give a correction dose (~10–20% of total daily dose), recheck glucose + ketones in 2–4 h.'; }
  else if(v<3.0){ col='#f59e0b'; msg='High ('+v+' mmol/L)'; detail='At risk of DKA. Give correction rapid-acting insulin, hydrate, and contact your diabetes team / seek urgent review. Recheck hourly.'; }
  else { col='#f43f5e'; msg='Very high ('+v+' mmol/L) — go to ED'; detail='βOHB ≥3.0 mmol/L meets the ketosis criterion for DKA. Seek emergency care now, especially with vomiting, breathlessness, or drowsiness.'; }
  out.textContent=msg; out.style.color=col; det.textContent=detail;
}

function calcMetab(){
  var na=parseFloat(document.getElementById('mNa').value),
      cl=parseFloat(document.getElementById('mCl').value),
      hco3=parseFloat(document.getElementById('mHco3').value),
      glu=parseFloat(document.getElementById('mGlu').value),
      ph=parseFloat(document.getElementById('mPh').value);
  var out=document.getElementById('metab-out'), det=document.getElementById('metab-detail');
  if(isNaN(na)||isNaN(cl)||isNaN(hco3)||isNaN(glu)){
    out.textContent='Enter Na, Cl, HCO₃, glucose'; out.style.color='var(--ctx)'; det.innerHTML=''; return; }
  var ag=na-(cl+hco3);
  var corrNa=na+1.6*((glu-100)/100);
  var eosm=2*na+glu/18;
  var parts=[];
  parts.push('<b>Anion gap:</b> '+ag.toFixed(0)+' mmol/L '+(ag>12?'<span style="color:#f43f5e">(elevated — high-gap acidosis)</span>':'<span style="color:#34d399">(normal ≤12)</span>'));
  parts.push('<b>Corrected Na⁺:</b> '+corrNa.toFixed(0)+' mmol/L → choose '+(corrNa>=135?'0.45% NaCl':'0.9% NaCl')+' for maintenance');
  parts.push('<b>Effective osmolality:</b> '+eosm.toFixed(0)+' mOsm/kg '+(eosm>320?'<span style="color:#f43f5e">(&gt;320 — HHS overlap / marked hyperosmolality)</span>':''));
  var sev='', col='var(--ctx)';
  if(!isNaN(ph)){
    if(ph<7.0){ sev='SEVERE DKA (pH <7.0) → ICU, IV insulin, hourly labs'; col='#f43f5e'; }
    else if(ph<7.25){ sev='MODERATE DKA (pH 7.0–7.24)'; col='#f59e0b'; }
    else if(ph<7.30){ sev='MILD DKA (pH 7.25–7.29) → SC protocol often adequate'; col='#34d399'; }
    else { sev='pH ≥7.30 — if ketotic, consider resolving DKA or non-acidotic hyperglycemia'; col='#38bdf8'; }
  } else if(hco3<10){ sev='HCO₃ <10 → severe range (add pH to confirm)'; col='#f43f5e'; }
  out.textContent = sev || ('AG '+ag.toFixed(0)+' · Corr Na '+corrNa.toFixed(0));
  out.style.color=col;
  det.innerHTML=parts.join('<br>');
}

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
  initNotes();
})();
