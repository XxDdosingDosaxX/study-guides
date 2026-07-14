
/* ============================================================
   CONTEXT SWITCHER
   ============================================================ */
var CTX_COLOR = {clinic:'#14b8a6', wards:'#3b82f6', icu:'#f43f5e'};
var CTX_SOFT  = {clinic:'rgba(20,184,166,.14)', wards:'rgba(59,130,246,.14)', icu:'rgba(244,63,94,.14)'};
function setCtx(ctx){
  document.querySelectorAll('.ctx-btn').forEach(function(b){ b.classList.toggle('active', b.dataset.ctx===ctx); });
  document.querySelectorAll('.ctx-panel').forEach(function(p){ p.classList.toggle('active', p.dataset.context===ctx); });
  document.documentElement.style.setProperty('--ctx', CTX_COLOR[ctx]);
  document.documentElement.style.setProperty('--ctx-soft', CTX_SOFT[ctx]);
  buildNav();
  try{ localStorage.setItem('ctx', ctx); }catch(e){}
  window.scrollTo({top:0, behavior:'smooth'});
}

/* ============================================================
   TOC RAIL
   ============================================================ */
function buildNav(){
  var links = document.getElementById('railLinks');
  if(!links) return;
  links.innerHTML='';
  var active = document.querySelector('.ctx-panel.active');
  var items = [];
  document.querySelectorAll('.sec[data-shared]').forEach(function(s){ items.push({s:s,shared:true}); });
  if(active){ active.querySelectorAll('.sec').forEach(function(s){ items.push({s:s,shared:false}); }); }
  document.querySelectorAll('#references').forEach(function(s){ items.push({s:s,shared:true}); });
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
  var map={}; links.forEach(function(l){ map[l.getAttribute('href')]=l; });
  _obs=new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(e.isIntersecting){
        links.forEach(function(l){ l.classList.remove('active'); });
        var l=map['#'+e.target.id]; if(l) l.classList.add('active');
      }
    });
  },{rootMargin:'-25% 0px -65% 0px'});
  document.querySelectorAll('.sec[id]').forEach(function(s){ _obs.observe(s); });
}

/* ============================================================
   THEME
   ============================================================ */
function toggleTheme(){
  document.body.classList.toggle('light');
  try{ localStorage.setItem('sg_theme', document.body.classList.contains('light')?'light':'dark'); }catch(e){}
}

/* ============================================================
   OSMOSIS LOGIN
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
  wrap.querySelectorAll('.tab').forEach(function(x){ x.classList.remove('active'); });
  wrap.querySelectorAll('.panel').forEach(function(x){ x.classList.remove('active'); });
  t.classList.add('active');
  var p=wrap.querySelector('#'+t.dataset.panel); if(p) p.classList.add('active');
});

/* ============================================================
   STATUS EPILEPTICUS WEIGHT-BASED DOSE CALCULATOR
   Doses: AES 2016 (Glauser) · NCS 2012 (Brophy, Tables 7-8) · ESETT (Kapur NEJM 2019)
   ============================================================ */
function fmt(n){
  if(!isFinite(n)) return '-';
  if(n>=100) return String(Math.round(n));
  if(n>=10)  return String(Math.round(n*10)/10);
  return String(Math.round(n*100)/100);
}
function calcSE(){
  var el=document.getElementById('seWt');
  var out=document.getElementById('seDoses');
  if(!el||!out) return;
  var wt=parseFloat(el.value);
  if(!(wt>0)){ out.innerHTML='<div class="dose-row"><span class="dz">Enter a weight to see the dose ladder.</span></div>'; return; }

  var rows=[];
  function row(name, value, note, capped){
    rows.push('<div class="dose-row'+(capped?' capped':'')+'">'+
      '<span class="dn">'+name+'</span>'+
      '<span class="dv">'+value+'</span>'+
      '<span class="dz">'+note+'</span></div>');
  }

  rows.push('<div style="font-size:11.5px;text-transform:uppercase;letter-spacing:.6px;color:var(--ok);font-weight:800;margin-top:6px">1 · Benzodiazepine (5–20 min)</div>');

  // Lorazepam 0.1 mg/kg, max 4 mg/dose
  var lzRaw = 0.1*wt, lzCap = lzRaw>4;
  var lz = Math.min(lzRaw, 4);
  row('Lorazepam IV', fmt(lz)+' mg', (lzCap? '<strong>Capped at the 4 mg max per dose</strong> (0.1 mg/kg = '+fmt(lzRaw)+' mg). ' : '0.1 mg/kg. ')+'Give at ≤2 mg/min. <strong>May repeat once in 5–10 min</strong> (total ≈'+fmt(Math.min(lzRaw,4)*2)+' mg).', lzCap);

  // Midazolam IM: 10 mg if >=40 kg, 5 mg if 13-40 kg
  var mzIM = wt>=40 ? 10 : (wt>=13 ? 5 : 0.2*wt);
  var mzNote = wt>=40 ? 'Weight ≥40 kg → the flat 10 mg IM dose (RAMPART).' : (wt>=13 ? 'Weight 13–40 kg → the flat 5 mg IM dose (RAMPART).' : '0.2 mg/kg IM (max 10 mg).');
  row('Midazolam IM', fmt(mzIM)+' mg', mzNote+' <strong>Use this if there is no IV — it is faster and beat IV lorazepam in RAMPART.</strong>', false);

  // Diazepam 0.15-0.2 mg/kg, max 10 mg/dose
  var dzLo=Math.min(0.15*wt,10), dzHi=Math.min(0.2*wt,10), dzCap=(0.2*wt)>10;
  row('Diazepam IV', fmt(dzLo)+'–'+fmt(dzHi)+' mg', (dzCap?'<strong>Capped at the 10 mg max per dose.</strong> ':'0.15–0.2 mg/kg. ')+'Give at ≤5 mg/min. May repeat once in 5 min.', dzCap);

  rows.push('<div style="font-size:11.5px;text-transform:uppercase;letter-spacing:.6px;color:var(--warn);font-weight:800;margin-top:12px">2 · Second-line ASM (20–40 min) — ESETT: all three equivalent</div>');

  // Levetiracetam 60 mg/kg max 4500
  var lvRaw=60*wt, lvCap=lvRaw>4500, lv=Math.min(lvRaw,4500);
  row('Levetiracetam IV', fmt(lv)+' mg', (lvCap?'<strong>Capped at the 4500 mg max</strong> (60 mg/kg = '+fmt(lvRaw)+' mg). ':'60 mg/kg. ')+'Infuse over 10–15 min. <strong>Safest in hypotension, liver disease, pregnancy.</strong>', lvCap);

  // Fosphenytoin 20 mg PE/kg max 1500 PE
  var fpRaw=20*wt, fpCap=fpRaw>1500, fp=Math.min(fpRaw,1500);
  var fpMin = Math.ceil(fp/150);
  row('Fosphenytoin IV', fmt(fp)+' mg PE', (fpCap?'<strong>Capped at the 1500 mg PE max</strong> (20 mg PE/kg = '+fmt(fpRaw)+'). ':'20 mg PE/kg. ')+'Max rate 150 mg PE/min → ≥'+fpMin+' min infusion. <strong>Cardiac monitoring — hypotension &amp; arrhythmia.</strong>', fpCap);

  // Valproate 40 mg/kg max 3000
  var vpRaw=40*wt, vpCap=vpRaw>3000, vp=Math.min(vpRaw,3000);
  row('Valproate IV', fmt(vp)+' mg', (vpCap?'<strong>Capped at the 3000 mg max</strong> (40 mg/kg = '+fmt(vpRaw)+' mg). ':'40 mg/kg. ')+'Infuse over 10 min. <strong>NOT in pregnancy, liver disease, or POLG.</strong>', vpCap);

  // Phenobarbital 15 mg/kg
  row('Phenobarbital IV', fmt(15*wt)+' mg', '15 mg/kg at 50–100 mg/min. An alternative when the others are unavailable. <strong>Expect to intubate.</strong>', false);

  rows.push('<div style="font-size:11.5px;text-transform:uppercase;letter-spacing:.6px;color:var(--danger);font-weight:800;margin-top:12px">3 · Refractory SE (&gt;40 min) — intubate + cEEG first</div>');

  row('Midazolam — load', fmt(0.2*wt)+' mg', '0.2 mg/kg IV at 2 mg/min. Then infuse <strong>'+fmt(0.05*wt)+'–'+fmt(2*wt)+' mg/h</strong> (0.05–2 mg/kg/h). Breakthrough: '+fmt(0.1*wt)+'–'+fmt(0.2*wt)+' mg bolus + raise the rate by '+fmt(0.05*wt)+'–'+fmt(0.1*wt)+' mg/h q3–4h.', false);
  row('Propofol — load', fmt(1*wt)+'–'+fmt(2*wt)+' mg', '1–2 mg/kg IV. Start the infusion at <strong>'+fmt(20*wt*60/1000)+' mg/h</strong> (20 mcg/kg/min); range 30–200 mcg/kg/min = <strong>'+fmt(30*wt*60/1000)+'–'+fmt(200*wt*60/1000)+' mg/h</strong>. <strong>Caution &gt;80 mcg/kg/min ('+fmt(80*wt*60/1000)+' mg/h) for &gt;48 h → PRIS.</strong>', false);
  row('Pentobarbital — load', fmt(5*wt)+'–'+fmt(15*wt)+' mg', '5–15 mg/kg at ≤50 mg/min (may add 5–10 mg/kg). Infuse <strong>'+fmt(0.5*wt)+'–'+fmt(5*wt)+' mg/h</strong> (0.5–5 mg/kg/h). <strong>Expect hypotension and pressors.</strong>', false);
  row('Ketamine — load', fmt(1*wt)+'–'+fmt(3*wt)+' mg', '1–3 mg/kg IV. Infuse <strong>'+fmt(1*wt)+'–'+fmt(5*wt)+' mg/h</strong> (1–5 mg/kg/h). <strong>The NMDA antagonist — does NOT drop the blood pressure.</strong>', false);

  out.innerHTML = rows.join('');
}

/* ============================================================
   LIGHTBOX
   ============================================================ */
(function(){
  var lb=document.getElementById('lightbox'), im=document.getElementById('lbimg'), x=document.getElementById('lbx');
  document.addEventListener('click', function(e){
    var img=e.target.closest('.fig img');
    if(img && !lb.classList.contains('on')){ im.src=img.src; im.alt=img.alt||''; lb.classList.add('on'); document.body.style.overflow='hidden'; return; }
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
   PER-DISEASE NOTES — auto-saved to localStorage, timestamped
   ============================================================ */
var NOTE_KEY='sgnotes_'+(location.pathname.split('/').pop()||'guide');
function loadNotes(){try{return JSON.parse(localStorage.getItem(NOTE_KEY)||'[]');}catch(e){return[];}}
function saveNotes(a){try{localStorage.setItem(NOTE_KEY,JSON.stringify(a));}catch(e){}}
function renderNotes(){var a=loadNotes(),el=document.getElementById('noteList');if(!el)return;el.innerHTML='';a.forEach(function(n,i){var c=document.createElement('div');c.className='note-card';var m=document.createElement('div');m.className='note-meta';var ts=document.createElement('span');ts.textContent=n.ts;var d=document.createElement('span');d.className='note-del';d.textContent='✕';d.addEventListener('click',function(){delNote(i);});m.appendChild(ts);m.appendChild(d);var t=document.createElement('div');t.className='note-text';t.textContent=n.text;c.appendChild(m);c.appendChild(t);el.appendChild(c);});}
function addNote(){var ta=document.getElementById('noteInput'),v=ta.value.trim();if(!v)return;var a=loadNotes();a.unshift({text:v,ts:new Date().toLocaleString()});saveNotes(a);ta.value='';try{localStorage.removeItem(NOTE_KEY+'_draft');}catch(e){}renderNotes();}
function delNote(i){var a=loadNotes();a.splice(i,1);saveNotes(a);renderNotes();}
function initNotes(){var ni=document.getElementById('noteInput');if(ni){try{ni.value=localStorage.getItem(NOTE_KEY+'_draft')||'';}catch(e){}ni.addEventListener('input',function(){try{localStorage.setItem(NOTE_KEY+'_draft',ni.value);}catch(e){}});}renderNotes();}

/* ============================================================
   INIT
   ============================================================ */
(function(){
  try{ if(localStorage.getItem('sg_theme')==='light') document.body.classList.add('light'); }catch(e){}
  var start='clinic';
  try{ var s=localStorage.getItem('ctx'); if(s) start=s; }catch(e){}
  setCtx(start);
  initNotes();
  calcSE();
})();
