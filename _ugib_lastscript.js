
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
  var st=box.querySelector('.score-total'); if(st) st.textContent=t;
  var fn=window[box.dataset.interp]; if(fn) fn(t,box);
}
function interpGbs(t,box){
  var col,rec;
  if(t<=1){col='#34d399';rec='Low risk (GBS ≤1) — consider OUTPATIENT management with early endoscopy (ACG 2021). ~&lt;1% need intervention.';}
  else if(t<=5){col='#f59e0b';rec='Intermediate risk — admit, IV access, risk-stratify, endoscopy within 24 h.';}
  else {col='#f43f5e';rec='High risk (GBS ≥6) — high likelihood of transfusion/intervention; admit &amp; consider monitored bed.';}
  box.querySelector('.score-total').style.color=col;
  box.querySelector('.score-interp').innerHTML='<b style="color:'+col+'">'+rec+'</b>';
}
var AIMS65_MORT=[0.3,1,3,9,15,25];
function interpAims65(t,box){
  var col=t>=3?'#f43f5e':(t>=2?'#f59e0b':'#34d399');
  var rec=t>=2?'High risk — consider monitored/step-down care; predicts transfusion &amp; ICU need.':'Lower mortality risk.';
  box.querySelector('.score-total').style.color=col;
  box.querySelector('.score-interp').innerHTML='<b style="color:'+col+'">'+rec+'</b><br>~'+AIMS65_MORT[Math.min(t,5)]+'% in-hospital mortality (AIMS65 validation, AJG 2015).';
}

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
