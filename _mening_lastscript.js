
/* ============================================================
   CALCULATORS — GCS · Bacterial Meningitis Score · CSF helper
   ============================================================ */
/* ---- Glasgow Coma Scale ---- */
function gcsSel(el){
  var box = el.parentElement;
  box.querySelectorAll('.calc-opt').forEach(function(o){ o.classList.remove('sel'); });
  el.classList.add('sel');
  gcsCalc();
}
function gcsCalc(){
  var t = 0, n = 0;
  ['e','v','m'].forEach(function(g){
    var s = document.querySelector('#gcs .calc-opt.sel[data-g="'+g+'"]');
    if(s){ t += parseInt(s.getAttribute('data-p'),10); n++; }
  });
  var out = document.getElementById('gcsOut');
  if(!out) return;
  if(n < 3){ out.innerHTML = '<div class="calc-total">—</div><div class="mini">Select one from each column.</div>'; return; }
  var msg;
  if(t <= 8) msg = 'Severe (coma range) — secure the airway (GCS ≤8 → intubate).';
  else if(t <= 12) msg = 'Moderate impairment — ICU-level monitoring; frequent neuro checks.';
  else msg = 'Mild / near-normal — continue close monitoring.';
  out.innerHTML = '<div class="calc-total">'+t+'</div><div class="mini">GCS '+t+'/15 — '+msg+'</div>';
}

/* ---- Bacterial Meningitis Score (children) ---- */
function bmsTog(el){ el.classList.toggle('sel'); bmsCalc(); }
function bmsCalc(){
  var t = 0;
  document.querySelectorAll('#bms .calc-opt.sel').forEach(function(o){ t += parseInt(o.getAttribute('data-p'),10); });
  var out = document.getElementById('bmsOut');
  if(!out) return;
  var msg = (t === 0)
    ? 'Score 0 — <strong>very low risk</strong> of bacterial meningitis (NPV ~99.9%). Individualize; never override an ill child or a positive Gram stain.'
    : 'Score ≥1 — <strong>not low risk</strong> → treat as bacterial pending cultures.';
  out.innerHTML = '<div class="calc-total">'+t+'</div><div class="mini">'+msg+'</div>';
}

/* ---- CSF pattern helper (heuristic) ---- */
function csfCalc(){
  function val(id){ var v = parseFloat(document.getElementById(id).value); return isNaN(v) ? null : v; }
  var wbc = val('csfWbc'), pmn = val('csfPmn'), ratio = val('csfRatio'), prot = val('csfProt');
  var out = document.getElementById('csfOut');
  if(!out) return;
  if(wbc === null && pmn === null && ratio === null && prot === null){
    out.innerHTML = '<div class="mini">Enter at least one value.</div>'; return;
  }
  var bact = 0, viral = 0, tbfun = 0, flags = [];
  if(wbc !== null){
    if(wbc >= 1000){ bact += 2; flags.push('very high WBC'); }
    else if(wbc >= 100){ bact += 1; }
    else if(wbc > 0){ viral += 1; tbfun += 1; }
  }
  if(pmn !== null){
    if(pmn >= 80){ bact += 2; flags.push('neutrophil-predominant'); }
    else if(pmn < 50){ viral += 1; tbfun += 1; }
  }
  if(ratio !== null){
    if(ratio < 0.4){ bact += 2; tbfun += 1; flags.push('low glucose ratio'); }
    else if(ratio >= 0.6){ viral += 1; }
  }
  if(prot !== null){
    if(prot >= 100){ bact += 1; tbfun += 1; flags.push('high protein'); }
    else if(prot < 50){ viral += 1; }
  }
  var pattern, cls, note;
  if(bact > 0 && bact >= viral && bact >= tbfun){
    pattern = 'Bacterial pattern'; cls = 'var(--danger)';
    note = 'Consistent with bacterial meningitis — do not wait for culture to treat.';
  } else if(tbfun > 0 && tbfun >= bact && tbfun >= viral){
    pattern = 'TB / fungal pattern'; cls = 'var(--warn)';
    note = 'Lymphocytic + low glucose — consider TB / fungal / partially-treated bacterial; send AFB, CrAg, PCR.';
  } else if(viral > 0){
    pattern = 'Viral (aseptic) pattern'; cls = 'var(--info)';
    note = 'Suggests aseptic meningitis — but an early/treated bacterial case can mimic this; correlate clinically.';
  } else {
    pattern = 'Indeterminate'; cls = 'var(--muted)';
    note = 'Pattern unclear — rely on Gram stain, culture, PCR and the clinical picture.';
  }
  out.innerHTML = '<div class="calc-total" style="color:'+cls+';font-size:21px;line-height:1.25">'+pattern+'</div>' +
    (flags.length ? '<div class="mini">Features: '+flags.join(', ')+'</div>' : '') +
    '<div class="mini" style="margin-top:6px">'+note+'</div>';
}
