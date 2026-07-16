
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
  var items = [];
  document.querySelectorAll('.sec[data-shared]').forEach(function(s){ items.push({s:s, shared:true}); });
  var active = document.querySelector('.ctx-panel.active');
  if(active){ active.querySelectorAll('.sec').forEach(function(s){ items.push({s:s, shared:false}); }); }
  document.querySelectorAll('#references').forEach(function(s){ items.push({s:s, shared:true}); });
  items.forEach(function(it){
    var h = it.s.querySelector('.sec-head h2');
    if(!h) return;
    var a = document.createElement('a');
    a.href = '#'+it.s.id;
    a.className = it.shared ? 'shared' : '';
    a.innerHTML = '<span class="dot"></span>'+h.textContent;
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
  var map = {};
  links.forEach(function(l){ map[l.getAttribute('href')] = l; });
  _obs = new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(e.isIntersecting){
        links.forEach(function(l){ l.classList.remove('active'); });
        var l = map['#'+e.target.id];
        if(l) l.classList.add('active');
      }
    });
  }, {rootMargin:'-25% 0px -65% 0px'});
  document.querySelectorAll('.sec[id]').forEach(function(s){
    if(s.offsetParent!==null || s.dataset.shared || s.id==='references') _obs.observe(s);
  });
}

/* ============================================================
   THEME  (shared key across the library)
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
  var t = e.target.closest('.tab');
  if(!t) return;
  var wrap = t.closest('.module') || document;
  wrap.querySelectorAll('.tab').forEach(function(x){ x.classList.remove('active'); });
  wrap.querySelectorAll('.panel').forEach(function(x){ x.classList.remove('active'); });
  t.classList.add('active');
  var p = wrap.querySelector('#'+t.dataset.panel);
  if(p) p.classList.add('active');
});

/* ============================================================
   GENERIC ADDITIVE SCORE ENGINE
   ============================================================ */
function scoreToggle(el){
  var box = el.closest('.calc');
  var grp = el.dataset.group;
  if(grp){
    box.querySelectorAll('.calc-opt[data-group="'+grp+'"]').forEach(function(o){ o.classList.remove('sel'); });
    el.classList.add('sel');
  } else {
    el.classList.toggle('sel');
  }
  computeScore(box);
}
function computeScore(box){
  var t = 0;
  box.querySelectorAll('.calc-opt.sel').forEach(function(o){ t += parseInt(o.dataset.pts||'0', 10); });
  box.querySelector('.score-total').textContent = t;
  var fn = window[box.dataset.interp];
  if(fn) fn(t, box);
}

/* ============================================================
   PLASMIC  — Bendapudi PK et al, Lancet Haematol 2017;4(4):e157-e164
   Point values verified against Table 3 of the primary paper.
   Risk-band percentages are Bendapudi's own ranges across the
   derivation + internal + external validation cohorts
   (severe ADAMTS13 deficiency defined as <=10% activity).
   ============================================================ */
function interpPlasmic(t, box){
  var col, rec, pct;
  if(t <= 4){
    col = '#34d399';
    rec = 'LOW RISK — consider alternative diagnoses';
    pct = '0–4%';
  } else if(t === 5){
    col = '#f59e0b';
    rec = 'INTERMEDIATE RISK — send ADAMTS13, keep under close observation';
    pct = '5–24%';
  } else {
    col = '#f43f5e';
    rec = 'HIGH RISK — send ADAMTS13, get expert consultation, START PLASMA EXCHANGE NOW';
    pct = '62–82%';
  }
  box.querySelector('.score-total').style.color = col;
  box.querySelector('.score-interp').innerHTML =
    '<b style="color:'+col+'">'+rec+'</b><br>'+
    '<span style="color:var(--muted)">' + pct + ' of patients in this band had severe ADAMTS13 deficiency (&le;10%) across the derivation and validation cohorts. C statistic 0.91–0.96. (Bendapudi, <i>Lancet Haematol</i> 2017)</span>' +
    (t >= 6 ? '<br><b style="color:#f43f5e">Do not wait for the ADAMTS13 result to start plasma exchange.</b>' : '');
}

/* ============================================================
   4Ts — Lo GK, Juhl D, Warkentin TE et al, J Thromb Haemost 2006;4(4):759-65
   Point values verified against the published criteria table.
   Predictive values: Cuker A et al, Blood 2012;120(20):4160 (13 studies, n=3068).
   ============================================================ */
function interp4ts(t, box){
  var col, rec, extra;
  if(t <= 3){
    col = '#34d399';
    rec = 'LOW probability — HIT is extremely unlikely';
    extra = 'Negative predictive value <b>0.998</b> (95% CI 0.970–1.000) — a low score reliably excludes HIT. Heparin can generally continue; look elsewhere for the cause.';
  } else if(t <= 5){
    col = '#f59e0b';
    rec = 'INTERMEDIATE probability — HIT is possible';
    extra = 'Positive predictive value ~<b>0.14</b> (0.09–0.22). Stop heparin, send anti-PF4, start a non-heparin anticoagulant while you wait.';
  } else {
    col = '#f43f5e';
    rec = 'HIGH probability — HIT is likely';
    extra = 'Positive predictive value ~<b>0.64</b> (0.40–0.82). <b>STOP ALL HEPARIN (including flushes and coated lines) and start a non-heparin anticoagulant NOW.</b> Do not give platelets.';
  }
  box.querySelector('.score-total').style.color = col;
  box.querySelector('.score-interp').innerHTML =
    '<b style="color:'+col+'">'+rec+'</b><br><span style="color:var(--muted)">'+extra+'</span>' +
    '<br><span style="font-size:11px;color:var(--muted)">Classic validated version (onset days 5–10). Note the 2018 ASH pocket guide uses an <i>adapted</i> table with a days 5–14 window; the 99.8% NPV above was established with the original definition shown here.</span>';
}

/* ============================================================
   ASH 2019 TREAT-vs-OBSERVE / ADMIT TOOL
   Encodes adult Recommendations 1a/1b and 2a/2b/2c.
   NOT a validated risk score — a faithful encoding of the guideline.
   ============================================================ */
function itpPick(el){
  var box = el.closest('.calc');
  var g = el.dataset.group;
  box.querySelectorAll('.calc-opt[data-group="'+g+'"]').forEach(function(o){ o.classList.remove('sel'); });
  el.classList.add('sel');
  itpDecide(box);
}
function itpVal(box, g){
  var e = box.querySelector('.calc-opt[data-group="'+g+'"].sel');
  return e ? e.dataset.v : null;
}
function itpDecide(box){
  var plt = itpVal(box, 'plt');
  var bl  = itpVal(box, 'bleed');
  var dx  = itpVal(box, 'dx');
  var verdict, detail, col;

  if(bl === 'crit'){
    col = '#f43f5e';
    verdict = 'EMERGENCY · ICU';
    detail = '<b style="color:#f43f5e">Critical bleeding overrides the platelet count entirely.</b><br>' +
      'Go to the ICU tab: <b>high-dose corticosteroid + high-dose IVIG + platelet transfusion + tranexamic acid + a TPO-RA — together or very close together</b> (2026 ASH/McMaster emergency guideline, STRONG recommendations despite low-certainty evidence). ' +
      '<b>Adult mortality in a critical ITP bleed is ~30%.</b> Combination therapy 21.7% vs single intervention 30.2%.<br>' +
      '<span style="color:var(--muted)">Note: ASH 2019 explicitly does NOT cover emergency management.</span>';
  } else if(bl === 'muc'){
    col = '#f59e0b';
    verdict = 'TREAT · Admit';
    detail = '<b style="color:#f59e0b">Mucosal bleeding ("wet purpura") = clinically relevant bleeding.</b> By IWG 2009 this is <b>"severe ITP"</b> regardless of the count — severity is defined by bleeding, not the number.<br>' +
      '<b>Corticosteroid + IVIG</b> (IVIG onset 1–3 d; steroids alone take 4–14 d). Consider tranexamic acid 15–20 mg/kg q8h as an adjunct. Admit.';
  } else if(plt === 'ge30'){
    col = '#34d399';
    verdict = 'OBSERVE · Outpatient';
    detail = '<b style="color:#34d399">ASH 2019 Rec 1b: recommends AGAINST corticosteroids and in favour of observation — a STRONG recommendation</b> (very low certainty).<br>' +
      'This is one of the few STRONG recommendations in the entire guideline. <b>The guideline is more confident you should withhold steroids than that you should give them.</b> The natural history here is good and steroids are not benign.<br>' +
      '<span style="color:var(--muted)">Individualise upward for: occupation/fall risk, anticoagulant need, upcoming procedure, older age, a known bleeding lesion, or poor access to care.</span>';
  } else if(plt === 'p2029'){
    col = '#f59e0b';
    verdict = 'TREAT · Outpatient';
    detail = '<b style="color:#f59e0b">ASH 2019 Rec 1a: suggests corticosteroids rather than observation below 30</b> (conditional, very low certainty).<br>' +
      '<b>Rec 2c: suggests OUTPATIENT management at ≥20</b> (conditional). So: treat, but you do not need a bed.<br>' +
      'Prednisone 1 mg/kg/day (max 80 mg) ×2–3 wk then taper — <b>≤6 weeks TOTAL including taper</b> (STRONG) — OR dexamethasone 40 mg/day ×4 days.';
  } else {
    if(dx === 'new'){
      col = '#f59e0b';
      verdict = 'TREAT · ADMIT';
      detail = '<b style="color:#f59e0b">ASH 2019 Rec 1a: suggests corticosteroids. Rec 2a: suggests HOSPITAL ADMISSION</b> for newly diagnosed adults &lt;20 (both conditional, very low certainty).<br>' +
        '<b>Why admit?</b> The diagnosis is unconfirmed (12.2% of "primary ITP" turns out to be something else), the trajectory is unknown, and they have never been observed on therapy. <b>You are admitting them to find out what they have.</b>';
    } else {
      col = '#34d399';
      verdict = 'TREAT · Outpatient';
      detail = '<b style="color:#34d399">ASH 2019 Rec 2b: suggests OUTPATIENT management</b> for <i>established</i> ITP &lt;20 without bleeding (conditional).<br>' +
        '<b>Same count as the newly diagnosed patient — opposite disposition.</b> They have a secure diagnosis, a known trajectory, a haematologist, and years of evidence they tolerate this count. <b>Experience with one\'s own disease is itself a safety factor.</b><br>' +
        '<span style="color:var(--muted)">Rec 1a still suggests treating below 30 if they need it.</span>';
    }
  }
  var v = document.getElementById('itpdec-verdict');
  var d = document.getElementById('itpdec-detail');
  if(v){ v.textContent = verdict; v.style.color = col; }
  if(d){ d.innerHTML = detail; }
}

/* ============================================================
   ICR 2019 PROCEDURAL PLATELET TARGET  (Table 6 + obstetric recs)
   Consensus-based, evidence level IV, for "typical" bleeding risk.
   ============================================================ */
var ITP_PROC = {
  dentalpro:   {t:'≥20–30', n:'Dental prophylaxis (descaling, deep cleaning). The lowest target on the table — routine dental care does not require a normal count.'},
  simpleext:   {t:'≥30',        n:'Simple dental extraction.'},
  cplxext:     {t:'≥50',        n:'Complex dental extraction.'},
  dentalblock: {t:'≥30',        n:'Regional dental block — the risk is a deep haematoma in the floor of the mouth, not the tooth socket.'},
  minor:       {t:'≥50',        n:'Minor surgery.'},
  major:       {t:'≥80',        n:'Major surgery.'},
  neuro:       {t:'≥100',       n:'Major neurosurgery — the ONLY procedure on the ICR table demanding 100, because a small bleed in a closed box is catastrophic.'},
  single:      {t:'≥30–50', n:'Starting a single antiplatelet agent OR an anticoagulant (1 antiplatelet, warfarin, or a DOAC).'},
  dual:        {t:'≥50–70', n:'Dual antiplatelet therapy, or an antiplatelet PLUS an anticoagulant.'},
  neuraxial:   {t:'≥70',        n:'Obstetric regional/neuraxial anaesthesia — "in the absence of other haemostatic abnormalities" (ICR 2019, Grade C). Contested: the ISTH SSC Delphi consensus says 80; SOAP 2021 supports 70. Below 70 a spinal may be safer than an epidural (smaller needle). Discuss with the obstetric anaesthetist well before the due date.'},
  delivery:    {t:'≥50',        n:'Delivery (ICR 2019, Grade C). Note: 20–30 is considered safe for most of pregnancy in a non-bleeding patient.'}
};
function itpProcPick(el){
  var box = el.closest('.calc');
  box.querySelectorAll('.calc-opt[data-group="proc"]').forEach(function(o){ o.classList.remove('sel'); });
  el.classList.add('sel');
  var v = ITP_PROC[el.dataset.v];
  if(!v) return;
  var tEl = document.getElementById('itpproc-target');
  var nEl = document.getElementById('itpproc-note');
  if(tEl) tEl.innerHTML = v.t;
  if(nEl) nEl.innerHTML = v.n + '<br><span style="font-size:11px;color:var(--muted)">ICR 2019 Table 6 — consensus-based, evidence level IV, adult at typical bleeding risk. The target bends to the clinical situation, urgency, and the consequences of bleeding at that site.</span>';
}

/* ============================================================
   LIGHTBOX
   ============================================================ */
(function(){
  var lb = document.getElementById('lightbox');
  var im = document.getElementById('lbimg');
  var x  = document.getElementById('lbx');
  document.addEventListener('click', function(e){
    var img = e.target.closest('.fig img, .svg-wrap img');
    if(img && !lb.classList.contains('on')){
      im.src = img.src; im.alt = img.alt;
      lb.classList.add('on');
      document.body.style.overflow = 'hidden';
      return;
    }
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
   PER-DISEASE NOTES — localStorage, timestamped
   ============================================================ */
var NOTE_KEY = 'sgnotes_'+(location.pathname.split('/').pop()||'guide');
function loadNotes(){ try{ return JSON.parse(localStorage.getItem(NOTE_KEY)||'[]'); }catch(e){ return []; } }
function saveNotes(a){ try{ localStorage.setItem(NOTE_KEY, JSON.stringify(a)); }catch(e){} }
function renderNotes(){
  var a = loadNotes();
  var el = document.getElementById('noteList');
  if(!el) return;
  el.innerHTML='';
  a.forEach(function(n, i){
    var c = document.createElement('div'); c.className='note-card';
    var m = document.createElement('div'); m.className='note-meta';
    var ts = document.createElement('span'); ts.textContent = n.ts;
    var d = document.createElement('span'); d.className='note-del'; d.textContent='✕';
    d.addEventListener('click', function(){ delNote(i); });
    m.appendChild(ts); m.appendChild(d);
    var t = document.createElement('div'); t.className='note-text'; t.textContent = n.text;
    c.appendChild(m); c.appendChild(t);
    el.appendChild(c);
  });
}
function addNote(){
  var ta = document.getElementById('noteInput');
  var v = ta.value.trim();
  if(!v) return;
  var a = loadNotes();
  a.unshift({text:v, ts:new Date().toLocaleString()});
  saveNotes(a);
  ta.value='';
  try{ localStorage.removeItem(NOTE_KEY+'_draft'); }catch(e){}
  renderNotes();
}
function delNote(i){ var a=loadNotes(); a.splice(i,1); saveNotes(a); renderNotes(); }
function initNotes(){
  var ni = document.getElementById('noteInput');
  if(ni){
    try{ ni.value = localStorage.getItem(NOTE_KEY+'_draft')||''; }catch(e){}
    ni.addEventListener('input', function(){ try{ localStorage.setItem(NOTE_KEY+'_draft', ni.value); }catch(e){} });
  }
  renderNotes();
}

/* ============================================================
   INIT
   ============================================================ */
(function(){
  try{ if(localStorage.getItem('sg_theme')==='light') document.body.classList.add('light'); }catch(e){}
  var start = 'clinic';
  try{ var s = localStorage.getItem('ctx'); if(s) start = s; }catch(e){}
  setCtx(start);
  initNotes();
  document.querySelectorAll('.calc[data-interp]').forEach(function(box){ computeScore(box); });
  var dec = document.getElementById('itpdecide');
  if(dec) itpDecide(dec);
  var proc = document.querySelector('#itpproc .calc-opt.sel');
  if(proc) itpProcPick(proc);
})();
