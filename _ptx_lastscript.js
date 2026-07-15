
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
   PNEUMOTHORAX SIZE / VOLUME CALCULATORS
   ============================================================ */
function ptxNum(id){ var el=document.getElementById(id); if(!el) return NaN; var v=parseFloat(el.value); return isFinite(v)?v:NaN; }
function ptxSize(){
  var lung=ptxNum('li_lung'), hemi=ptxNum('li_hemi');
  var a=ptxNum('co_a'), b=ptxNum('co_b'), c=ptxNum('co_c');
  var rim=ptxNum('bts_rim');
  var out=document.getElementById('ptx_size'), note=document.getElementById('ptx_size_note');
  if(!out) return;
  var lines=[];
  var light=null, collins=null;
  if(isFinite(lung)&&isFinite(hemi)&&hemi>0&&lung<=hemi&&lung>=0){
    light=100-100*(Math.pow(lung,3)/Math.pow(hemi,3));
    light=Math.max(0,Math.min(100,light));
    lines.push('Light index ≈ <strong>'+light.toFixed(0)+'%</strong>');
  }
  if(isFinite(a)&&isFinite(b)&&isFinite(c)){
    collins=4.2+4.7*(a+b+c);
    collins=Math.max(0,Math.min(100,collins));
    lines.push('Collins ≈ <strong>'+collins.toFixed(0)+'%</strong>');
  }
  var cls='';
  if(isFinite(rim)){ cls = rim>=2 ? 'BTS: <strong>large</strong> (≥2 cm at hilum)' : 'BTS: <strong>small</strong> (&lt;2 cm at hilum)'; lines.push(cls); }
  var shown = (light!=null)?light:collins;
  out.innerHTML = (shown!=null)? shown.toFixed(0)+'%' : '—';
  note.innerHTML = lines.length? lines.join(' · ') + '<br><span style="font-size:11.5px">Size guides safety of intervention &amp; tracks resolution — it does <em>not</em> by itself dictate treatment (BTS 2023).</span>' : 'Enter measurements above.';
}

function btsSelect(){
  var box=document.getElementById('bts_opts'); if(!box) return;
  var get=function(k){ var el=box.querySelector('[data-k="'+k+'"] input'); return el&&el.checked; };
  var tension=get('tension'), hr=get('hr'), sympt=get('sympt');
  var out=document.getElementById('bts_out'), note=document.getElementById('bts_note');
  if(tension){
    out.textContent='EMERGENCY decompression';
    note.innerHTML='Immediate needle/finger decompression (5th ICS anterior axillary line, ≥8 cm catheter) then chest drain. Do not wait to image.';
  } else if(hr){
    out.textContent='Chest drain + admit';
    note.innerHTML='High-risk characteristic present → small-bore (≤14F) chest drain, admit, high-flow O₂ (caution in COPD).';
  } else if(sympt){
    out.textContent='Ambulatory device / aspiration / drain';
    note.innerHTML='Symptomatic, no high-risk features → patient-centred choice: 8F ambulatory device, needle aspiration, or small-bore drain.';
  } else {
    out.textContent='Conservative (observe)';
    note.innerHTML='Minimally symptomatic, no high-risk features → conservative management regardless of size; analgesia, cessation, planned CXR review.';
  }
}

function initPtxCalc(){
  ['li_lung','li_hemi','co_a','co_b','co_c','bts_rim'].forEach(function(id){
    var el=document.getElementById(id); if(el){ el.addEventListener('input', ptxSize); }
  });
  var box=document.getElementById('bts_opts');
  if(box){
    box.querySelectorAll('.calc-opt').forEach(function(opt){
      opt.addEventListener('click', function(e){
        var cb=opt.querySelector('input');
        if(e.target!==cb){ cb.checked=!cb.checked; }
        opt.classList.toggle('sel', cb.checked);
        btsSelect();
      });
    });
  }
  ptxSize(); btsSelect();
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
  initPtxCalc();
})();
