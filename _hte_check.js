
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

/* ============================================================
   MAP + hour-1 target calculator
   ============================================================ */
function calcMap(){
  var s=parseFloat(document.getElementById('mapSBP').value);
  var d=parseFloat(document.getElementById('mapDBP').value);
  var out=document.getElementById('map-out'), det=document.getElementById('map-detail');
  if(!s||!d||s<=0||d<=0||d>=s){
    out.textContent='—';
    det.textContent = (s&&d&&d>=s) ? 'Diastolic should be below systolic — check the values.' : 'Enter a blood pressure to compute MAP and the first-hour target.';
    return;
  }
  var map=Math.round((s+2*d)/3);
  var floorMap=Math.round(map*0.75);          // ≤25% reduction in hour 1
  var phase2lo=140, phase2hi=Math.min(160, s); // 160/100-110 phase target (SBP anchor)
  out.textContent='MAP '+map+' mmHg';
  det.innerHTML='General emergency plan: in <b>hour 1</b> do not drop MAP below ~<b>'+floorMap+' mmHg</b> (a 25% reduction). '
    +'Then over <b>2–6 h</b> aim ~<b>160/100–110</b>, and normalize over <b>24–48 h</b>. '
    +'<span style="color:var(--muted)">Syndrome exceptions apply — dissection wants SBP &lt;120 fast; ischemic stroke (no reperfusion) is permissive to 220/120.</span>';
}
/* ============================================================
   Syndrome target selector
   ============================================================ */
var SYNDROMES={
  general:['General emergency','↓MAP ≤25% in hour 1 → ~160/100–110 over 2–6 h → normal over 24–48 h','Nicardipine or clevidipine','Don’t normalize fast (watershed hypoperfusion)','#38bdf8'],
  dissection:['Aortic dissection','SBP &lt;120 AND HR &lt;60 within ~20 min','β-blocker FIRST (esmolol/labetalol) → then nicardipine/nitroprusside','Never vasodilate before rate control; no hydralazine','#f43f5e'],
  strokeTpa:['Ischemic stroke — tPA/thrombectomy','&lt;185/110 before lytic, then &lt;180/105 × 24 h','Labetalol or nicardipine','Aggressive drops','#f59e0b'],
  strokeNo:['Ischemic stroke — no reperfusion','Permissive: treat only if &gt;220/120 (↓~15% over 24 h)','Labetalol or nicardipine','Lowering BP can extend the infarct','#34d399'],
  ich:['Intracerebral hemorrhage','Smoothly lower to SBP 130–140 (INTERACT3 bundle)','Nicardipine or clevidipine','Overshoot &lt;130 or drop &gt;60 mmHg/h; nitroprusside (↑ICP)','#a78bfa'],
  edema:['Acute pulmonary edema','Rapid preload/afterload reduction','Nitroglycerin (± nitroprusside) + loop diuretic + NIV','β-blockers acutely (negative inotropy)','#f43f5e'],
  acs:['ACS / myocardial ischemia','Relieve ischemia, ↓ demand','Nitroglycerin + β-blocker','Hydralazine (reflex tachy); NTG if RV infarct/recent PDE5-i','#f59e0b'],
  sympathetic:['Sympathetic crisis (cocaine/pheo)','Control the adrenergic surge','Phentolamine + benzodiazepines; nicardipine/nitroprusside','UNOPPOSED β-blockade → paradoxical crisis','#f43f5e'],
  preeclampsia:['Pre-eclampsia / eclampsia','Treat sustained ≥160/110 → &lt;160/&lt;110; add magnesium (seizure ppx)','IV labetalol, IV hydralazine, or nicardipine + MgSO₄','ACEi/ARB (fetal toxicity); nitroprusside','#a78bfa']
};
function selSyn(el){
  document.querySelectorAll('.calc-opt[data-syn]').forEach(function(o){o.classList.remove('sel');});
  el.classList.add('sel');
  var s=SYNDROMES[el.dataset.syn]; if(!s) return;
  var out=document.getElementById('syn-out'), det=document.getElementById('syn-detail');
  out.innerHTML=s[0]; out.style.color=s[4];
  det.innerHTML='<b>Target:</b> '+s[1]+'<br><b>First-line:</b> '+s[2]+'<br><b style="color:var(--danger)">Avoid:</b> '+s[3];
}
(function(){
  try{ if(localStorage.getItem('sg_theme')==='light') document.body.classList.add('light'); }catch(e){}
  var start='clinic';
  try{ var s=localStorage.getItem('ctx'); if(s) start=s; }catch(e){}
  setCtx(start);
  initNotes();
})();
