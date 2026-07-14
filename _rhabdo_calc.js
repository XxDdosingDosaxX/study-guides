
/* ============================================================
   CALCULATORS — McMahon score · fluid/UOP helper · delta pressure
   ============================================================ */
(function(){

  /* single-select within a data-g group, scoped to its .calc container */
  document.addEventListener('click', function(e){
    var opt = e.target.closest('.calc-opt');
    if(!opt || !opt.dataset.g) return;
    var calc = opt.closest('.calc'); if(!calc) return;
    calc.querySelectorAll('.calc-opt[data-g="'+opt.dataset.g+'"]').forEach(function(o){ o.classList.remove('sel'); });
    opt.classList.add('sel');
    if(calc.id === 'mcmahonCalc') scoreMcMahon();
    if(calc.id === 'fluidCalc')   calcFluid();
  });

  /* ---------- McMahon Score (McMahon, JAMA Intern Med 2013; points per MDCalc) ---------- */
  var MCM_GROUPS = ['age','sex','cr','ca','ck','phos','bicarb','cause'];
  function scoreMcMahon(){
    var calc = document.getElementById('mcmahonCalc'); if(!calc) return;
    var total = 0, done = 0;
    MCM_GROUPS.forEach(function(g){
      var s = calc.querySelector('.calc-opt[data-g="'+g+'"].sel');
      if(s){ total += parseFloat(s.dataset.v); done++; }
    });
    var t = document.getElementById('mcmTotal'), i = document.getElementById('mcmInterp');
    if(!t || !i) return;
    var shown = (Math.round(total*10)/10).toString();
    t.textContent = shown;
    if(done < MCM_GROUPS.length){
      t.style.color = 'var(--ctx)';
      i.innerHTML = '<span style="color:var(--muted)">' + done + ' of ' + MCM_GROUPS.length +
        ' categories selected — complete all eight for a valid score (max 19).</span>';
      return;
    }
    var col, html;
    if(total < 5){
      col = 'var(--ok)';
      html = '<strong style="color:var(--ok)">Low risk.</strong> Approximately <strong>2.3%</strong> risk of death or AKI requiring renal replacement therapy (validation cohort). At a cutoff of 5 the score carries a <strong>97% negative predictive value</strong> — ruling patients OUT is what it does best.';
    } else if(total < 6){
      col = 'var(--warn)';
      html = '<strong style="color:var(--warn)">Grey zone (5 to just under 6).</strong> The original paper used a cutoff of <strong>5</strong>; MDCalc and the external validation use <strong>≥6</strong> as the action threshold. Both are defensible — <strong>use clinical judgment</strong> and weight the other red flags (the limb, the potassium, the urine output).';
    } else if(total <= 10){
      col = 'var(--warn)';
      html = '<strong style="color:var(--warn)">NOT low risk (≥6).</strong> Admit, resuscitate with isotonic crystalloid titrated to urine output, and involve nephrology early. At ≥6 the score is ~<strong>86% sensitive / 68% specific</strong> for needing RRT — better than CK alone (83%/55%).';
    } else {
      col = 'var(--danger)';
      html = '<strong style="color:var(--danger)">High risk (&gt;10): approximately 61% risk of death or RRT</strong> in the validation cohort. Aggressive early resuscitation, early nephrology involvement, anticipate dialysis, and manage in a high-acuity setting.';
    }
    t.style.color = col;
    i.innerHTML = html;
  }

  /* ---------- Fluid / urine-output helper (arithmetic on published targets) ---------- */
  function calcFluid(){
    var calc = document.getElementById('fluidCalc'); if(!calc) return;
    var wtEl = document.getElementById('fcWt');
    var out  = document.getElementById('fcUop');
    var det  = document.getElementById('fcDetail');
    if(!wtEl || !out || !det) return;
    var wt = parseFloat(wtEl.value);
    var sevEl = calc.querySelector('.calc-opt[data-g="sev"].sel');
    var sev = sevEl ? sevEl.dataset.v : null;

    if(!wt || wt <= 0){
      out.textContent = '—';
      out.style.color = 'var(--ctx)';
      det.innerHTML = '<span style="color:var(--muted)">Enter a weight and pick a severity.</span>';
      return;
    }
    var lo = Math.round(wt * 1), hi = Math.round(wt * 2);   /* 1–2 mL/kg/h */
    out.textContent = lo + '–' + hi + ' mL/h';
    out.style.color = 'var(--ctx)';

    var html = '<div><strong>Weight-based target (1–2 mL/kg/h):</strong> ' + lo + '–' + hi + ' mL/h.</div>' +
               '<div style="margin-top:6px"><strong>Absolute crush-syndrome target (ISN): 200–300 mL/h.</strong> In severe disease, aim for whichever of the two is higher.</div>';

    if(sev === 'crush'){
      html += '<div style="margin-top:8px;color:var(--danger)"><strong>Crush / severe:</strong> isotonic <strong>0.9% saline</strong> — <em>not</em> lactated Ringer\'s, which contains potassium — at <strong>1,000 mL/h</strong>, started before extrication if at all possible. Reduce to <strong>≤500 mL/h</strong> if extrication takes more than 2 hours. <strong>Target 3–6 L within the first 6 hours of contact.</strong></div>' +
              '<div style="margin-top:6px">Total 24-hour volumes of 6–12 L are described. <strong>Reassess volume status hourly</strong>, insert a urinary catheter, and anticipate a potassium surge at reperfusion.</div>';
    } else if(sev === 'standard'){
      html += '<div style="margin-top:8px;color:var(--ok)"><strong>Non-crush rhabdomyolysis:</strong> isotonic crystalloid titrated to the urine-output target above. A <strong>balanced crystalloid</strong> (LR / Plasma-Lyte) is reasonable — and avoids hyperchloremic acidosis — <em>provided the potassium is normal</em>. Switch to <strong>0.9% saline</strong> if K⁺ is high or rising.</div>' +
              '<div style="margin-top:6px">Titrate to urine output and fluid balance, <strong>not</strong> to a fixed rate. If the patient stays oliguric despite adequate resuscitation and is becoming overloaded, <strong>that is a dialysis conversation — not a reason for more fluid.</strong></div>';
    } else {
      html += '<div style="margin-top:8px;color:var(--muted)">Pick a severity for the fluid recommendation.</div>';
    }
    det.innerHTML = html;
  }

  /* ---------- Delta pressure (compartment syndrome) ---------- */
  function calcDelta(){
    var dEl = document.getElementById('dpDbp'), cEl = document.getElementById('dpCp');
    var t = document.getElementById('dpTotal'), i = document.getElementById('dpInterp');
    if(!dEl || !cEl || !t || !i) return;
    var dbp = parseFloat(dEl.value), cp = parseFloat(cEl.value);
    if(isNaN(dbp) || isNaN(cp)){
      t.textContent = '—';
      t.style.color = 'var(--ctx)';
      i.innerHTML = '<span style="color:var(--muted)">Enter a diastolic BP and a compartment pressure.</span>';
      return;
    }
    var d = dbp - cp;
    t.textContent = d + ' mmHg';
    if(d <= 30){
      t.style.color = 'var(--danger)';
      i.innerHTML = '<strong style="color:var(--danger)">≤30 mmHg — FASCIOTOMY INDICATED.</strong> The muscle is being infarcted right now. <strong>Call surgery immediately</strong> — this is a limb-threatening emergency that does not wait until morning.';
    } else {
      t.style.color = 'var(--ok)';
      i.innerHTML = '<strong style="color:var(--ok)">&gt;30 mmHg — above the fasciotomy threshold.</strong> But this is a <em>single snapshot</em>, and compartment syndrome evolves. Re-measure serially, keep examining the limb, and remember that pressure thresholds are <strong>not absolute — clinical findings override the number.</strong> If the compartment is tense and the pain is out of proportion, escalate anyway.';
    }
  }

  /* live inputs */
  ['fcWt'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.addEventListener('input', calcFluid);
  });
  ['dpDbp','dpCp'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.addEventListener('input', calcDelta);
  });

})();
