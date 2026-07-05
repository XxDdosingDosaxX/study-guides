
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
function buildNav(){
  var links = document.getElementById('railLinks');
  if(!links) return;
  links.innerHTML='';
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
function toggleTheme(){
  document.body.classList.toggle('light');
  try{ localStorage.setItem('sg_theme', document.body.classList.contains('light')?'light':'dark'); }catch(e){}
}
function copyOsmo(b){
  try{ navigator.clipboard.writeText('Skanda123!'); b.textContent='✓';
       setTimeout(function(){ b.innerHTML='&#128273;'; },1200); }catch(e){}
}
function toggleRung(h){ h.parentElement.classList.toggle('open'); }

/* ===== Wells calculator ===== */
function tglWells(el){
  el.classList.toggle('sel');
  var total=0;
  document.querySelectorAll('#wellsCalc .calc-opt.sel').forEach(function(o){ total+=parseFloat(o.getAttribute('data-pts'))||0; });
  document.getElementById('wellsTotal').textContent=total;
  var msg;
  if(total<=4){ msg='Two-tier: PE <strong>unlikely</strong> (≤4) → high-sensitivity D-dimer (age-adjusted). Three-tier: '+(total<2?'low (&lt;2)':'moderate (2–6)')+'.'; }
  else { msg='Two-tier: PE <strong>likely</strong> (&gt;4) → CTPA. Three-tier: '+(total>6?'high (&gt;6)':'moderate (2–6)')+'.'; }
  document.getElementById('wellsInterp').innerHTML=msg;
}

/* ===== PERC rule ===== */
function tglPerc(el){
  el.classList.toggle('sel');
  var n=document.querySelectorAll('#percCalc .calc-opt.sel').length;
  document.getElementById('percTotal').textContent=n+'/8';
  var msg;
  if(n===8){ msg='All 8 criteria met → <strong>PE excluded</strong>, no further testing (in a &lt;15% pretest-probability patient).'; }
  else { msg='<strong>'+(8-n)+'</strong> criteria not met → PERC-positive; cannot rule out by PERC — proceed to D-dimer/imaging per probability.'; }
  document.getElementById('percInterp').innerHTML=msg;
}

/* ===== sPESI calculator ===== */
function tglSpesi(el){
  el.classList.toggle('sel');
  var total=0;
  document.querySelectorAll('#spesiCalc .calc-opt.sel').forEach(function(o){ total+=parseInt(o.getAttribute('data-pts'),10)||0; });
  document.getElementById('spesiTotal').textContent=total;
  var msg = total===0
    ? '<strong>Low-risk</strong> (sPESI 0) — 30-day mortality ~1.1%; outpatient candidate if HESTIA-negative &amp; no RV strain/troponin.'
    : '<strong>Higher-risk</strong> (sPESI ≥1) — 30-day mortality ~8.9%; admit and risk-stratify with troponin + RV assessment.';
  document.getElementById('spesiInterp').innerHTML=msg;
}

/* ===== Full PESI calculator ===== */
function tglPesi(el){ el.classList.toggle('sel'); calcPesi(); }
function calcPesi(){
  var age=parseInt(document.getElementById('pesiAge').value,10)||0;
  var total=age;
  document.querySelectorAll('#pesiCalc .calc-opt.sel').forEach(function(o){ total+=parseInt(o.getAttribute('data-pts'),10)||0; });
  document.getElementById('pesiTotal').textContent=total;
  var cls, mort;
  if(total<=65){ cls='I (very low)'; mort='0–1.6%'; }
  else if(total<=85){ cls='II (low)'; mort='1.7–3.5%'; }
  else if(total<=105){ cls='III (intermediate)'; mort='3.2–7.1%'; }
  else if(total<=125){ cls='IV (high)'; mort='4.0–11.4%'; }
  else { cls='V (very high)'; mort='10.0–24.5%'; }
  var low = total<=85;
  document.getElementById('pesiInterp').innerHTML='Class <strong>'+cls+'</strong> — 30-day mortality '+mort+'. '+(low?'Classes I–II = low-risk (outpatient candidate).':'Class III–V — admit for monitoring.');
}

/* ===== Tabs / lightbox / sheet / notes ===== */
document.addEventListener('click', function(e){
  var t=e.target.closest('.tab'); if(!t) return;
  var wrap=t.closest('.module')||document;
  wrap.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  wrap.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  var p=wrap.querySelector('#'+t.dataset.panel); if(p) p.classList.add('active');
});
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
function toggleSheet(){ document.getElementById('rail').classList.toggle('sheet'); }
function closeSheet(){ document.getElementById('rail').classList.remove('sheet'); }
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
