
var CTX_COLOR = {clinic:'#14b8a6', wards:'#3b82f6', icu:'#f43f5e'};
var CTX_SOFT  = {clinic:'rgba(20,184,166,.14)', wards:'rgba(59,130,246,.14)', icu:'rgba(244,63,94,.14)'};
function setCtx(ctx){
  document.querySelectorAll('.ctx-btn').forEach(function(b){b.classList.toggle('active', b.dataset.ctx===ctx);});
  document.querySelectorAll('.ctx-panel').forEach(function(p){p.classList.toggle('active', p.dataset.context===ctx);});
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
  document.querySelectorAll('#snapshot').forEach(function(s){items.push({s:s,shared:true});});
  document.querySelectorAll('.content > .sec[data-shared]').forEach(function(s){items.push({s:s,shared:true});});
  if(active){ active.querySelectorAll('.sec').forEach(function(s){items.push({s:s,shared:false});}); }
  var seen={};
  items.forEach(function(it){
    if(!it.s.id || seen[it.s.id]) return; seen[it.s.id]=1;
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
  var map={}; links.forEach(function(l){map[l.getAttribute('href')]=l;});
  _obs=new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(e.isIntersecting){
        links.forEach(function(l){l.classList.remove('active');});
        var l=map['#'+e.target.id]; if(l) l.classList.add('active');
      }
    });
  },{rootMargin:'-25% 0px -65% 0px'});
  document.querySelectorAll('.sec[id]').forEach(function(s){_obs.observe(s);});
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
document.addEventListener('click', function(e){
  var t=e.target.closest('.tab'); if(!t) return;
  var wrap=t.closest('.module')||document;
  wrap.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active');});
  wrap.querySelectorAll('.panel').forEach(function(x){x.classList.remove('active');});
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

/* ===== DKA SEVERITY GRADER (ADA/EASD 2024) ===== */
var _mental='';
function pickMental(el,val){
  _mental=val;
  var opts=el.parentElement.querySelectorAll('.calc-opt');
  opts.forEach(function(o){o.classList.remove('sel');});
  el.classList.add('sel');
  var r=el.querySelector('input'); if(r) r.checked=true;
  gradeSev();
}
function gradeSev(){
  var ph=parseFloat(document.getElementById('sev_ph').value);
  var hco3=parseFloat(document.getElementById('sev_hco3').value);
  var bohb=parseFloat(document.getElementById('sev_bohb').value);
  var out=document.getElementById('sev_out');
  var note=document.getElementById('sev_note');
  var rank=0;
  function bump(n){ if(n>rank) rank=n; }
  if(!isNaN(ph)){ if(ph<7.00) bump(3); else if(ph<7.25) bump(2); else if(ph<7.30) bump(1); }
  if(!isNaN(hco3)){ if(hco3<10) bump(3); else if(hco3<15) bump(2); else if(hco3<=18) bump(1); }
  if(!isNaN(bohb)){ if(bohb>6.0) bump(3); else if(bohb>=3.0) bump(1); }
  if(_mental==='stupor') bump(3); else if(_mental==='drowsy') bump(2);
  if(rank===0){ out.textContent='—'; note.textContent='Enter values — the grader takes the single most severe of the four axes (2024 consensus).'; out.style.color='var(--ctx)'; return; }
  var labels={1:'MILD',2:'MODERATE',3:'SEVERE'};
  var notes={
    1:'Alert, pH 7.25–7.30 / HCO₃ 15–18. Ward or ED observation; SC insulin protocol reasonable.',
    2:'pH 7.00–7.24 / HCO₃ 10 to &lt;15. Ward/step-down with hourly monitoring.',
    3:'pH &lt;7.00 / HCO₃ &lt;10 / β-OHB &gt;6 / stupor-coma. ICU/HDU, IV insulin, watch K⁺ &amp; airway.'
  };
  var colors={1:'#34d399',2:'#f59e0b',3:'#f43f5e'};
  out.textContent=labels[rank];
  out.style.color=colors[rank];
  note.innerHTML=notes[rank];
}

/* ===== ANION GAP / CORRECTED Na / EFFECTIVE OSMOLALITY ===== */
function calcGap(){
  var na=parseFloat(document.getElementById('ag_na').value);
  var cl=parseFloat(document.getElementById('ag_cl').value);
  var hco3=parseFloat(document.getElementById('ag_hco3').value);
  var glu=parseFloat(document.getElementById('ag_glu').value);
  var gapEl=document.getElementById('ag_gap'), cnaEl=document.getElementById('ag_cna'), osmEl=document.getElementById('ag_osm');
  if(!isNaN(na)&&!isNaN(cl)&&!isNaN(hco3)){ gapEl.textContent=(na-(cl+hco3)).toFixed(1); } else { gapEl.textContent='—'; }
  if(!isNaN(na)&&!isNaN(glu)){ cnaEl.textContent=(na+1.6*((glu-100)/100)).toFixed(1); } else { cnaEl.textContent='—'; }
  if(!isNaN(na)&&!isNaN(glu)){ osmEl.textContent=(2*na+glu/18).toFixed(0); } else { osmEl.textContent='—'; }
}

/* ===== NOTES ===== */
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
