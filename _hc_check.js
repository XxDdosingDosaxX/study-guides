
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
  document.querySelectorAll('.content > .sec[data-shared], .content > #snapshot').forEach(function(s){ if(s.id!=='comorbid'&&s.id!=='pearls'&&s.id!=='notes') items.push({s:s,shared:true}); });
  if(active){ active.querySelectorAll('.sec').forEach(function(s){items.push({s:s,shared:false});}); }
  document.querySelectorAll('#comorbid, #pearls, #notes, #references').forEach(function(s){items.push({s:s,shared:true});});
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
/* corrected calcium calculator */
function calcCorr(){
  var ca=parseFloat(document.getElementById('ccCa').value);
  var alb=parseFloat(document.getElementById('ccAlb').value);
  var out=document.getElementById('ccOut'), interp=document.getElementById('ccInterp');
  if(isNaN(ca)||isNaN(alb)){ out.textContent='—'; out.style.color='var(--ctx)'; interp.innerHTML='Corrected Ca = measured Ca + 0.8 × (4.0 − albumin).'; return; }
  var corr = ca + 0.8*(4.0-alb);
  out.textContent = corr.toFixed(1)+' mg/dL';
  var band, col, rec;
  if(corr<10.5){ band='Within normal range'; col='#34d399'; rec='Not hypercalcemic once corrected for albumin.'; }
  else if(corr<12){ band='Mild hypercalcemia'; col='#38bdf8'; rec='Usually outpatient; hydrate, find the cause (check PTH), stop offending drugs.'; }
  else if(corr<14){ band='Moderate hypercalcemia'; col='#f59e0b'; rec='Admit if symptomatic/dehydrated: saline + calcitonin + a bisphosphonate.'; }
  else { band='Severe hypercalcemia / crisis'; col='#f43f5e'; rec='Emergency — aggressive saline + calcitonin + zoledronic; ICU / dialysis if end-organ dysfunction.'; }
  out.style.color=col;
  interp.innerHTML='<b style="color:'+col+'">'+band+'</b> &nbsp;(corrected from measured '+ca.toFixed(1)+' at albumin '+alb.toFixed(1)+' g/dL)<br>'+rec;
}
/* calcium/creatinine clearance ratio (FHH vs PHPT) */
function calcCCCR(){
  var uCa=parseFloat(document.getElementById('uCa').value);
  var sCr=parseFloat(document.getElementById('sCr').value);
  var sCa=parseFloat(document.getElementById('sCa').value);
  var uCr=parseFloat(document.getElementById('uCr').value);
  var out=document.getElementById('crOut'), interp=document.getElementById('crInterp');
  if(isNaN(uCa)||isNaN(sCr)||isNaN(sCa)||isNaN(uCr)||sCa<=0||uCr<=0){ out.textContent='—'; out.style.color='var(--ctx)'; interp.innerHTML='Enter all four values.'; return; }
  var r=(uCa*sCr)/(sCa*uCr);
  out.textContent=r.toFixed(3);
  var col,rec;
  if(r<0.01){ col='#f59e0b'; rec='<b style="color:'+col+'">Suggests FHH</b> — do NOT operate; confirm with family history / CASR genetic testing.'; }
  else if(r<=0.02){ col='#38bdf8'; rec='<b style="color:'+col+'">Gray zone (0.01–0.02)</b> — ~20% of FHH sit here; correlate with family history &amp; genetics before surgery.'; }
  else { col='#34d399'; rec='<b style="color:'+col+'">Favors primary hyperparathyroidism</b> — pursue the usual PHPT surgical criteria.'; }
  out.style.color=col;
  interp.innerHTML=rec;
}
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
    var img=e.target.closest('.fig img');
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
