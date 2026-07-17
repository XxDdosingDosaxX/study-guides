
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
  try{ localStorage.setItem('cs_ctx', ctx); }catch(e){}
  window.scrollTo({top:0, behavior:'smooth'});
}

/* ============================================================
   TOC RAIL
   ============================================================ */
function buildNav(){
  var links = document.getElementById('railLinks');
  if(!links) return;
  links.innerHTML = '';
  var items = [];
  document.querySelectorAll('.sec[data-shared]').forEach(function(s){ items.push({s:s, shared:true}); });
  var active = document.querySelector('.ctx-panel.active');
  if(active){ active.querySelectorAll('.sec').forEach(function(s){ items.push({s:s, shared:false}); }); }
  document.querySelectorAll('#references').forEach(function(s){ items.push({s:s, shared:true}); });
  items.forEach(function(it){
    var h = it.s.querySelector('.sec-head h2'); if(!h) return;
    var a = document.createElement('a');
    a.href = '#' + it.s.id;
    a.className = it.shared ? 'shared' : '';
    a.innerHTML = '<span class="dot"></span>' + h.textContent;
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
  var map = {}; links.forEach(function(l){ map[l.getAttribute('href')] = l; });
  _obs = new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(e.isIntersecting){
        links.forEach(function(l){ l.classList.remove('active'); });
        var l = map['#' + e.target.id]; if(l) l.classList.add('active');
      }
    });
  }, {rootMargin:'-25% 0px -65% 0px'});
  document.querySelectorAll('.sec[id]').forEach(function(s){
    if(s.offsetParent !== null || s.dataset.shared || s.id === 'references') _obs.observe(s);
  });
}

/* ============================================================
   THEME
   ============================================================ */
function toggleTheme(){
  document.body.classList.toggle('light');
  try{ localStorage.setItem('sg_theme', document.body.classList.contains('light') ? 'light' : 'dark'); }catch(e){}
}

/* ============================================================
   OSMOSIS LOGIN
   ============================================================ */
function copyOsmo(b){
  try{ navigator.clipboard.writeText('Skanda123!'); b.textContent = '✓';
       setTimeout(function(){ b.innerHTML = '&#128273;'; }, 1200); }catch(e){}
}

/* ============================================================
   LADDER ACCORDION
   ============================================================ */
function toggleRung(h){ h.parentElement.classList.toggle('open'); }

/* ============================================================
   TABS
   ============================================================ */
document.addEventListener('click', function(e){
  var t = e.target.closest('.tab'); if(!t) return;
  var wrap = t.closest('.module') || document;
  wrap.querySelectorAll('.tab').forEach(function(x){ x.classList.remove('active'); });
  wrap.querySelectorAll('.panel').forEach(function(x){ x.classList.remove('active'); });
  t.classList.add('active');
  var p = wrap.querySelector('#' + t.dataset.panel); if(p) p.classList.add('active');
});

/* ============================================================
   GENERIC POINT-SCORE CALCULATOR
   ============================================================ */
function scoreToggle(el){
  var box = el.closest('.calc');
  var grp = el.dataset.group;
  if(grp){
    box.querySelectorAll('.calc-opt[data-group="' + grp + '"]').forEach(function(o){ o.classList.remove('sel'); });
    el.classList.add('sel');
  } else {
    el.classList.toggle('sel');
  }
  computeScore(box);
}
function computeScore(box){
  var t = 0;
  box.querySelectorAll('.calc-opt.sel').forEach(function(o){ t += parseInt(o.dataset.pts || '0', 10); });
  box.querySelector('.score-total').textContent = t;
  var fn = window[box.dataset.interp];
  if(fn) fn(t, box);
}

/* ============================================================
   IABP-SHOCK II RISK SCORE
   Points & tiers: Pöss et al., JACC 2017 (IABP-SHOCK II derivation)
   Age >73 (1) · prior stroke (2) · glucose >191 mg/dL (1) ·
   creatinine >1.5 mg/dL (1) · lactate >5 mmol/L (2) · TIMI <3 post-PCI (2)
   ============================================================ */
function interpIabp(t, box){
  var col, tier, mort;
  if(t <= 2){ col = '#34d399'; tier = 'LOW risk (0–2)';          mort = '23.8%'; }
  else if(t <= 4){ col = '#f59e0b'; tier = 'INTERMEDIATE risk (3–4)'; mort = '49.2%'; }
  else { col = '#f43f5e'; tier = 'HIGH risk (5–9)';               mort = '76.6%'; }
  box.querySelector('.score-total').style.color = col;
  box.querySelector('.score-interp').innerHTML =
    '<b style="color:' + col + '">' + tier + '</b><br>' +
    '<span style="font-size:22px;font-weight:800;color:' + col + '">' + mort + '</span> observed 30-day mortality in the derivation cohort<br>' +
    '<span style="color:var(--muted);font-size:12px">Validated for <b>AMI-related</b> cardiogenic shock (AUC 0.79). Prognostic only — never a reason to withhold revascularisation.</span>';
}

/* ============================================================
   SCAI SHOCK STAGE CLASSIFIER
   Criteria per Table 3, SCAI SHOCK Expert Consensus Update (JSCAI 2022)
   Assigns the HIGHEST stage for which any criterion is met.
   ============================================================ */
var SCAI_INFO = {
  A: { name:'At risk',      col:'#34d399', mort:'3.0%',
       txt:'Not currently in shock but at risk (large MI, acute or acute-on-chronic HF). Normal lactate, warm and well-perfused, normotensive.',
       act:'Monitor closely on telemetry. Re-stage with any change — Stage A is "not yet", not "fine".' },
  B: { name:'Beginning CS (pre-shock)', col:'#38bdf8', mort:'7.1%',
       txt:'Haemodynamic instability — relative hypotension or tachycardia — <b>without</b> hypoperfusion. Lactate still normal.',
       act:'The last cheap moment. Find and fix the precipitant, hold negative inotropes, consider step-down/CICU. Low threshold to escalate.' },
  C: { name:'Classic CS',   col:'#f59e0b', mort:'12.4%',
       txt:'Hypoperfusion requiring <b>one</b> intervention (vasoactive drug or MCS) beyond volume resuscitation. Lactate ≥2. Hypotension is <b>not required</b>.',
       act:'CICU/ICU. Arterial line. Echo. Norepinephrine first if MAP &lt;65. Emergent angiography if AMI-CS. Activate the shock team.' },
  D: { name:'Deteriorating', col:'#f43f5e', mort:'40.4%',
       txt:'Failure of the initial support strategy — escalating doses, a second vasoactive agent, or an added device, with worsening haemodynamics or a rising lactate.',
       act:'<b>SCAI\'s explicit transfer trigger — move to a shock hub NOW, before Stage E.</b> Consider MCS. Decide the destination: recovery, LVAD, transplant, or palliation.' },
  E: { name:'Extremis',     col:'#f43f5e', mort:'67.0%',
       txt:'Actual or impending circulatory collapse. Lactate ≥8, pH &lt;7.2, base deficit &gt;10, profound hypotension despite maximal support, or ongoing CPR.',
       act:'Immediate MCS/ECMO decision if there is a recovery path. Honest futility assessment — transfers for futile care deny capacity to those who might benefit.' }
};
function scaiToggle(el){
  var box = el.closest('.calc');
  var grp = el.dataset.group;
  if(grp === 'amod'){
    el.classList.toggle('sel');
  } else {
    box.querySelectorAll('.calc-opt[data-group="' + grp + '"]').forEach(function(o){ o.classList.remove('sel'); });
    el.classList.add('sel');
  }
  computeScai(box);
}
function pick(box, grp){
  var el = box.querySelector('.calc-opt[data-group="' + grp + '"].sel');
  return el ? parseInt(el.dataset.scai || '0', 10) : 0;
}
function computeScai(box){
  var bp   = pick(box, 'bp');    // 0 none · 1 hypotension/tachycardia · 2 profound despite max support
  var perf = pick(box, 'perf');  // 0 intact · 1 hypoperfusion · 2 worsening · 3 extremis biochemistry
  var rx   = pick(box, 'rx');    // 0 none · 1 one intervention · 2 escalating/2nd agent/device · 3 refractory
  var col  = pick(box, 'col');   // 0 awake · 1 collapse/CPR
  var amod = box.querySelector('.calc-opt[data-group="amod"].sel') ? true : false;

  var stage = 'A';
  if(perf >= 1 || rx >= 1) stage = 'C';
  else if(bp >= 1)         stage = 'B';

  if(rx >= 2 || perf === 2) stage = 'D';
  if(bp === 2 || perf === 3 || rx === 3 || col === 1) stage = 'E';

  var info = SCAI_INFO[stage];
  var tot = box.querySelector('.score-total');
  tot.textContent = stage + (amod ? 'A' : '');
  tot.style.color = info.col;
  box.querySelector('.score-interp').innerHTML =
    '<b style="color:' + info.col + ';font-size:15px">SCAI SHOCK Stage ' + stage + (amod ? ' (A-modifier)' : '') + ' — ' + info.name + '</b><br>' +
    '<span style="color:var(--muted)">' + info.txt + '</span><br>' +
    '<div style="margin-top:8px"><b>What to do:</b> ' + info.act + '</div>' +
    (amod ? '<div style="margin-top:6px;color:#f43f5e"><b>A-modifier:</b> post-arrest with potential anoxic brain injury (GCS &lt;9 or not following commands). Independently worsens prognosis and weighs heavily in candidacy decisions for MCS, LVAD and transplant.</div>' : '') +
    '<div style="margin-top:8px;font-size:12px;color:var(--muted)">Reference in-hospital mortality at this stage: <b style="color:' + info.col + '">' + info.mort + '</b> (Jentzer et al., JACC 2019; mixed CICU cohort of 10,004 — a risk gradient, not an individual prediction).</div>';
}

/* ============================================================
   LIGHTBOX
   ============================================================ */
(function(){
  var lb = document.getElementById('lightbox'), im = document.getElementById('lbimg'), x = document.getElementById('lbx');
  document.addEventListener('click', function(e){
    var img = e.target.closest('.fig img, .svg-wrap img');
    if(img && !lb.classList.contains('on')){
      im.src = img.src; im.alt = img.alt; lb.classList.add('on'); document.body.style.overflow = 'hidden'; return;
    }
  });
  function close(){ lb.classList.remove('on'); document.body.style.overflow = ''; im.src = ''; }
  lb.addEventListener('click', function(e){ if(e.target !== im) close(); });
  x.addEventListener('click', close);
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') close(); });
})();

/* ============================================================
   MOBILE TOC SHEET
   ============================================================ */
function toggleSheet(){ document.getElementById('rail').classList.toggle('sheet'); }
function closeSheet(){ document.getElementById('rail').classList.remove('sheet'); }

/* ============================================================
   PER-DISEASE NOTES — localStorage, timestamped
   ============================================================ */
var NOTE_KEY = 'sgnotes_' + (location.pathname.split('/').pop() || 'guide');
function loadNotes(){ try{ return JSON.parse(localStorage.getItem(NOTE_KEY) || '[]'); }catch(e){ return []; } }
function saveNotes(a){ try{ localStorage.setItem(NOTE_KEY, JSON.stringify(a)); }catch(e){} }
function renderNotes(){
  var a = loadNotes(), el = document.getElementById('noteList');
  if(!el) return;
  el.innerHTML = '';
  a.forEach(function(n, i){
    var c = document.createElement('div'); c.className = 'note-card';
    var m = document.createElement('div'); m.className = 'note-meta';
    var ts = document.createElement('span'); ts.textContent = n.ts;
    var d = document.createElement('span'); d.className = 'note-del'; d.textContent = '✕';
    d.addEventListener('click', function(){ delNote(i); });
    m.appendChild(ts); m.appendChild(d);
    var t = document.createElement('div'); t.className = 'note-text'; t.textContent = n.text;
    c.appendChild(m); c.appendChild(t); el.appendChild(c);
  });
}
function addNote(){
  var ta = document.getElementById('noteInput'), v = ta.value.trim();
  if(!v) return;
  var a = loadNotes();
  a.unshift({text:v, ts:new Date().toLocaleString()});
  saveNotes(a); ta.value = '';
  try{ localStorage.removeItem(NOTE_KEY + '_draft'); }catch(e){}
  renderNotes();
}
function delNote(i){ var a = loadNotes(); a.splice(i, 1); saveNotes(a); renderNotes(); }
function initNotes(){
  var ni = document.getElementById('noteInput');
  if(ni){
    try{ ni.value = localStorage.getItem(NOTE_KEY + '_draft') || ''; }catch(e){}
    ni.addEventListener('input', function(){ try{ localStorage.setItem(NOTE_KEY + '_draft', ni.value); }catch(e){} });
  }
  renderNotes();
}

/* ============================================================
   INIT
   ============================================================ */
(function(){
  try{ if(localStorage.getItem('sg_theme') === 'light') document.body.classList.add('light'); }catch(e){}
  var start = 'clinic';
  try{ var s = localStorage.getItem('cs_ctx'); if(s) start = s; }catch(e){}
  setCtx(start);
  initNotes();
  document.querySelectorAll('.calc').forEach(function(box){
    if(box.id === 'scaiCalc') computeScai(box);
    else computeScore(box);
  });
})();
