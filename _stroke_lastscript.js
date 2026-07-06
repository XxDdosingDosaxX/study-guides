
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
   ABCD² CALCULATOR (TIA 2-day stroke risk)
   ============================================================ */
function initABCD2(){
  var root=document.getElementById('abcd2'); if(!root) return;
  function recalc(){
    var t=0;
    root.querySelectorAll('.calc-opt').forEach(function(o){
      var inp=o.querySelector('input');
      o.classList.toggle('sel', inp.checked);
      if(inp.checked) t+=parseInt(o.dataset.v,10);
    });
    document.getElementById('abcd2Total').textContent=t;
    var msg;
    if(t<=3) msg='Low risk — 2-day stroke risk ~1.0%';
    else if(t<=5) msg='Moderate risk — 2-day stroke risk ~4.1%';
    else msg='High risk — 2-day stroke risk ~8.1%';
    document.getElementById('abcd2Interp').textContent=msg;
  }
  root.querySelectorAll('.calc-opt input').forEach(function(inp){ inp.addEventListener('change',recalc); });
  recalc();
}

/* ============================================================
   NIHSS CALCULATOR (15 items, 0–42)
   ============================================================ */
var NIHSS_ITEMS=[
  {k:'1a LOC responsiveness',o:[['Alert',0],['Drowsy',1],['Obtunded',2],['Coma',3]]},
  {k:'1b LOC questions (month, age)',o:[['Both correct',0],['One correct',1],['Neither',2]]},
  {k:'1c LOC commands (eyes, grip)',o:[['Both tasks',0],['One task',1],['Neither',2]]},
  {k:'2 Best gaze',o:[['Normal',0],['Partial palsy',1],['Forced deviation',2]]},
  {k:'3 Visual fields',o:[['No loss',0],['Partial hemianopia',1],['Complete hemianopia',2],['Bilateral (cortical)',3]]},
  {k:'4 Facial palsy',o:[['Normal',0],['Minor (flat NLF)',1],['Partial (lower face)',2],['Complete',3]]},
  {k:'5a Motor — left arm',o:[['No drift',0],['Drift',1],['Some effort vs gravity',2],['No effort vs gravity',3],['No movement',4]]},
  {k:'5b Motor — right arm',o:[['No drift',0],['Drift',1],['Some effort vs gravity',2],['No effort vs gravity',3],['No movement',4]]},
  {k:'6a Motor — left leg',o:[['No drift',0],['Drift',1],['Some effort vs gravity',2],['No effort vs gravity',3],['No movement',4]]},
  {k:'6b Motor — right leg',o:[['No drift',0],['Drift',1],['Some effort vs gravity',2],['No effort vs gravity',3],['No movement',4]]},
  {k:'7 Limb ataxia',o:[['Absent',0],['One limb',1],['Two limbs',2]]},
  {k:'8 Sensory',o:[['Normal',0],['Mild-moderate loss',1],['Severe/total loss',2]]},
  {k:'9 Best language',o:[['No aphasia',0],['Mild-moderate',1],['Severe aphasia',2],['Mute/global',3]]},
  {k:'10 Dysarthria',o:[['Normal',0],['Mild-moderate',1],['Severe/anarthric',2]]},
  {k:'11 Extinction/inattention',o:[['None',0],['One modality',1],['Profound/multiple',2]]}
];
function initNIHSS(){
  var wrap=document.getElementById('nihssItems'); if(!wrap) return;
  NIHSS_ITEMS.forEach(function(it,idx){
    var box=document.createElement('div');
    var h=document.createElement('h4'); h.style.color='var(--muted)'; h.textContent=it.k; box.appendChild(h);
    var sel=document.createElement('select');
    sel.style.cssText='width:100%;padding:8px 10px;border-radius:9px;border:1px solid var(--border);background:var(--card2);color:var(--text);font-family:inherit;font-size:13px';
    sel.dataset.idx=idx;
    it.o.forEach(function(opt){ var op=document.createElement('option'); op.value=opt[1]; op.textContent=opt[0]+' ('+opt[1]+')'; sel.appendChild(op); });
    sel.addEventListener('change',recalcNIHSS);
    box.appendChild(sel); wrap.appendChild(box);
  });
  recalcNIHSS();
}
function recalcNIHSS(){
  var t=0;
  document.querySelectorAll('#nihssItems select').forEach(function(s){ t+=parseInt(s.value,10)||0; });
  document.getElementById('nihssTotal').textContent=t;
  var msg;
  if(t===0) msg='No stroke symptoms';
  else if(t<=4) msg='Minor stroke (NIHSS ≤3 → candidate for short-course DAPT)';
  else if(t<=15) msg='Moderate stroke (≥6 with LVO favors thrombectomy)';
  else if(t<=20) msg='Moderate–severe stroke — watch for malignant edema';
  else msg='Severe stroke — airway / ICU considerations';
  document.getElementById('nihssInterp').textContent=msg;
}

(function(){
  try{ if(localStorage.getItem('sg_theme')==='light') document.body.classList.add('light'); }catch(e){}
  var start='clinic';
  try{ var s=localStorage.getItem('ctx'); if(s) start=s; }catch(e){}
  setCtx(start);
  initNotes();
  initABCD2();
  initNIHSS();
})();
