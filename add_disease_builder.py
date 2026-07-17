#!/usr/bin/env python3
"""
Local "Add a disease" builder for the Clinical Reference site.

WHAT IT DOES
------------
1. Serves the study-guides folder at http://localhost:8890/  (open the homepage here,
   not the GitHub Pages URL — the "Add disease" button only works against this server).
2. Exposes a tiny API the homepage talks to:
     GET  /api/queue            -> current build queue as JSON
     POST /api/enqueue {disease}-> add a diagnosis to the queue
3. Runs a background WORKER that processes the queue one at a time, invoking the local
   Claude CLI headless:  claude -p '/add-disease "<name>"' --dangerously-skip-permissions
   Each build researches -> builds from disease_template_v2.html -> pushes to GitHub Pages.
   Serial (one at a time) so the git pushes never collide.

REQUIREMENTS: laptop on, gh logged in (git push works), Claude CLI on PATH.
Start it with:  start_builder.bat   (or: python add_disease_builder.py)
Seed the 50 common diagnoses once with:  python add_disease_builder.py --seed
"""
import json, os, sys, time, threading, subprocess, datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
try:
    import firestore_sync as fb
except Exception:
    fb = None

REPO = os.path.dirname(os.path.abspath(__file__))
QUEUE_FILE = os.path.join(REPO, "builder_queue.json")
LOG_DIR = os.path.join(REPO, "builder_logs")
PORT = 8890
# Point at the REAL native Claude binary. The npm `claude.cmd` shim and `bin/claude.exe`
# stub can break after an npm reinstall (--omit=optional leaves a 500-byte placeholder that
# errors "not compatible with this version of Windows"); the win32-x64 native exe still works.
_NPM_PKG = os.path.expanduser(r"~\AppData\Roaming\npm\node_modules\@anthropic-ai\claude-code")
_NATIVE = os.path.join(_NPM_PKG, "node_modules", "@anthropic-ai", "claude-code-win32-x64", "claude.exe")
_SHIM = os.path.expanduser(r"~\AppData\Roaming\npm\claude.cmd")
if os.path.exists(_NATIVE):
    CLAUDE_CMD = _NATIVE
elif os.path.exists(_SHIM):
    CLAUDE_CMD = _SHIM
else:
    CLAUDE_CMD = "claude"
BUILD_TIMEOUT = 7200  # 2 hr per disease (allow a thorough research pass + full-depth build)


def ensure_published(name):
    """Safety net: if the build wrote/updated a guide but didn't finish publishing
    (e.g. it timed out after writing the file), finish update_index + commit + push here."""
    try:
        st = subprocess.run(["git", "status", "--porcelain"], cwd=REPO,
                            capture_output=True, text=True, timeout=60).stdout
        if not any("_Study_Guide.html" in ln for ln in st.splitlines()):
            return False  # nothing new to publish (build already pushed, or produced nothing)
        subprocess.run(["python", "update_index.py"], cwd=REPO, timeout=300)
        subprocess.run(["git", "add", "-A"], cwd=REPO, timeout=60)
        subprocess.run(["git", "commit", "-m", "Add %s clinical reference (Clinic/Wards/ICU)"
                        % name.replace('"', "")], cwd=REPO, timeout=120)
        subprocess.run(["git", "pull", "--rebase", "origin", "main"], cwd=REPO, timeout=180)
        r = subprocess.run(["git", "push", "origin", "HEAD:main"], cwd=REPO, timeout=180)
        return r.returncode == 0
    except Exception:
        return False



# Detailed per-guide requirements. When a queued name matches a key, build_prompt appends it.
SPECS = {
 "Antibiotics":
   "This is an ANTIBIOTIC REFERENCE, not a single disease. Repurpose the 3 contexts as: Clinic = OUTPATIENT infections & ORAL regimens + when outpatient/discharge is safe; Wards = INPATIENT empiric IV regimens by organ system + IV->PO switch + de-escalation; ICU = broad-spectrum / severe sepsis / MRSA / Pseudomonas / ESBL-CRE coverage + source control. Use the shared pathophysiology section for the cross-cutting reference tables. REQUIRED content: "
   "(1) COVERAGE-BY-PATHOGEN table: for each key organism (MSSA, MRSA, Strep pyogenes/pneumoniae, Enterococcus incl VRE, E. coli, Klebsiella, Proteus, Pseudomonas, ESBL & CRE, anaerobes incl B. fragilis, atypicals Mycoplasma/Legionella/Chlamydia, H. influenzae, N. meningitidis, Listeria) list which antibiotics reliably cover it and note resistance rates/odds and caveats. "
   "(2) A SPECTRUM GRID (antibiotic vs Gram+/Gram-/anaerobe/atypical/Pseudomonas/MRSA/enterococcus coverage), color-coded. "
   "(3) CEPHALOSPORIN GENERATIONS memorization aid: 1st-5th generation agents and how coverage shifts (Gram+ -> more Gram- -> Pseudomonas -> MRSA/ceftaroline), with a mnemonic and a color-coded table. "
   "(4) SYSTEM-BASED EMPIRIC THERAPY sections for: cellulitis/SSTI (incl purulent vs non-purulent, diabetic foot, nec fasc), CAP, HAP/VAP, cystitis vs pyelonephritis/complicated UTI, intra-abdominal, bacterial meningitis, bone & joint/septic arthritis, endocarditis, and sepsis/neutropenic fever. For EACH give PREFERRED and ALTERNATIVE regimens/combinations, the TARGET PATHOGENS and WHY each drug is chosen, exact DOSE + FREQUENCY + DURATION for BOTH IV and PO where applicable, and SPECIAL-CASE modifications (e.g., diabetic foot -> add anaerobic +/- Pseudomonas +/- MRSA; explicitly state how DIABETES and other comorbidities change coverage; penicillin allergy alternatives; MDRO risk factors like recent hospitalization/abx; immunocompromise). "
   "(5) IV-to-PO CONVERSION: the switch criteria (afebrile ~24h, hemodynamically stable, tolerating PO & functioning gut, clinically improving, suitable oral agent with good bioavailability) AND a table of specific IV->PO equivalents (e.g., ceftriaxone -> cefpodoxime/cefdinir or amox-clav or cephalexin; and note fluoroquinolones, metronidazole, linezolid, clindamycin, doxycycline, TMP-SMX, fluconazole are ~1:1 IV:PO). "
   "(6) WHEN OUTPATIENT/DISCHARGE IS SAFE: from a CLINICAL standpoint (defervescence, hemodynamic stability, oral tolerance, source controlled, reliable follow-up) AND from a PROCALCITONIN standpoint (baseline + trend; consider stopping when <0.25 ng/mL or >=80% drop from peak; where PCT is unreliable). "
   "(7) ANTIBIOTIC-CLASS overview (penicillins, cephalosporins, carbapenems, aztreonam, vancomycin, lipoglycopeptides, linezolid, daptomycin, fluoroquinolones, macrolides, tetracyclines, aminoglycosides, metronidazole, TMP-SMX) with mechanism, spectrum, and key toxicities/monitoring (vancomycin AUC/trough, aminoglycoside levels, QT, tendinopathy, etc.). "
   "(8) SPECIAL CONSIDERATIONS: penicillin-allergy cross-reactivity and choosing alternatives, renal dose adjustment, C. difficile risk by agent, major drug interactions, pregnancy-unsafe agents, and stewardship/de-escalation. "
   "EVERY antibiotic mentioned MUST have a dose, frequency, and (where relevant) duration for IV and PO. Base regimens on current IDSA guidance and cite sources. The coverage/spectrum/cephalosporin tables are the core teaching artifact.",

 "Inpatient Diabetes Management":
   "This is an INPATIENT HYPERGLYCEMIA / DIABETES MANAGEMENT guide. Contexts: Clinic = home-regimen basics + admission med reconciliation (which home agents to hold and why) + discharge regimen & follow-up; Wards = the CORE inpatient glucose management; ICU = IV insulin infusion protocols & critical-care targets. REQUIRED content: "
   "(1) INPATIENT GLUCOSE TARGETS (non-critical ward ~140-180 mg/dL; ICU ~140-180 on IV insulin; when to individualize) per ADA inpatient Standards of Care. "
   "(2) BASAL-BOLUS (SCHEDULED) INSULIN from scratch: estimate total daily dose (TDD) by weight (~0.3-0.5 U/kg/day; lower for elderly/CKD/insulin-naive/thin, higher for obese/steroids/insulin-resistant), split ~50% basal / 50% prandial divided across meals, PLUS a correction (supplemental) scale on top. Include a fully worked dosing example. "
   "(3) PATIENT ALREADY ON HOME INSULIN (basal +/- prandial): how to continue/convert on admission, when to reduce TDD (~20-25% if reduced intake/NPO/AKI/renal), and daily titration from fingerstick patterns. "
   "(4) NEW-ONSET diabetes / marked hyperglycemia and STEROID-INDUCED hyperglycemia: weight-based starting regimen + titration; NPH timed to the steroid. "
   "(5) SLIDING SCALE vs SCHEDULED - the key teaching point with a decision box: correction ('sliding-scale') insulin is a SUPPLEMENT to scheduled basal-bolus, NOT sole therapy (sliding-scale-alone is reactive and inferior - cite RABBIT-2). State the few times correction-only is acceptable (very short stay, mild/diet-controlled, good monitoring) vs when scheduled basal-bolus is required. "
   "(6) NPO / ENTERAL FEEDS / TPN: continue basal (often reduced), hold prandial when not eating, correction q4-6h; dosing with continuous tube feeds and with steroids. "
   "(7) INSULIN PHARMACOLOGY table: rapid (lispro/aspart/glulisine), short (regular), intermediate (NPH), long/basal (glargine/detemir/degludec) with onset/peak/duration. "
   "(8) TRANSITIONS: IV insulin infusion -> subcutaneous (give basal ~2 h before stopping the drip; estimate TDD from the stable drip rate) and hospital -> home regimen at discharge; when/how to safely resume home oral agents. "
   "(9) HYPOGLYCEMIA protocol (thresholds, 15-15 rule, D50/glucagon, and adjusting the regimen after an event). "
   "(10) NON-INSULIN agents inpatient: why most are held (metformin - AKI/contrast/lactic acidosis; SGLT2i - euglycemic DKA; sulfonylureas - hypoglycemia) and where DPP-4/GLP-1 fit. "
   "Give specific doses and worked examples throughout; cite the ADA Standards of Care (inpatient/hospital) and the RABBIT-2 evidence.",
}


def build_prompt(name):
    n = name.replace('"', "")
    base = (
        "AUTHORIZED AUTOMATED BATCH BUILD — proceed fully autonomously through every step "
        "below without pausing for confirmation. Do NOT email anyone, do NOT generate MP3 audio, "
        "do NOT ask questions. You are building one educational Internal Medicine clinical-reference "
        "HTML guide for the diagnosis: \"" + n + "\".\n\n"
        "Steps:\n"
        "1. Copy disease_template_v2.html to <Name>_Study_Guide.html (underscores). If a guide on "
        "this topic already exists in the folder, suffix the new file _v2 and title it '<Name> (v2)'. "
        "Keep the <!-- data-contexts:clinic,wards,icu | category:X --> marker and set the correct category.\n"
        "2. Fill it to the depth and standards of the reference build Heart_Failure_Study_Guide.html and "
        "the content rules in ~/.claude/commands/add-disease.md — EXCEPT skip the MP3 and email steps. "
        "Required: Presentation table (symptom/sign ~frequency %% color-coded + the pathophysiology of each), "
        "imaging + lab interpretation, full drug dose ladders (start -> titration increments -> target/max) "
        "for every agent, comorbidity-interaction table + drugs-to-avoid, numeric escalate/downgrade thresholds, "
        "validated MDCalc-style calculators only for scores whose exact points you can verify (link out otherwise), "
        "THEME-ADAPTIVE diagrams (either inline SVG using the template's --d-* CSS variables — --d-neutral, --d-blue-bg, "
        "--d-text, --d-line, etc. — so they lighten in light mode, OR Mermaid rendered TWICE: dark (theme 'dark', bgColor 131c30) "
        "AND light (theme 'default', bgColor f6f9fc), each embedded as <div class='dia dia-dark'>...</div><div class='dia dia-light'>...</div> "
        "with unique ids; NEVER leave a diagram baked dark-only), "
        "5+ real CC-licensed Wikimedia images base64-embedded with specific source credits, references + a trials table. "
        "BE EXHAUSTIVE — do not be lazy. Target ~8,000+ words to the depth of the Heart Failure reference. Research thoroughly with "
        "WebSearch/WebFetch against the CURRENT major society guideline (name it with its year, e.g. ADA 2024, KDIGO 2024, IDSA, "
        "ACC/AHA, GOLD) and the landmark trials; cite source URLs in the references and note the source for key doses/thresholds. "
        "Every dose, threshold, and number must trace to an up-to-date, medical-grade source — never invent one.\n"
        "3. Verify: no leftover __IMG_ tokens, valid JS (node --check the last <script>), no horizontal overflow.\n"
        "4. Run: python update_index.py\n"
        "5. git add -A && git commit -m \"Add " + n + " clinical reference (Clinic/Wards/ICU)\" && git push origin HEAD:main\n"
        "Then stop. One guide only."
    )
    spec = SPECS.get(name, "")
    if spec:
        base += "\n\n=== ADDITIONAL GUIDE-SPECIFIC REQUIREMENTS (this guide MUST cover ALL of these) ===\n" + spec
    return base

DEFAULT_50 = [
    "Sepsis and Septic Shock", "Acute Kidney Injury", "Diabetic Ketoacidosis",
    "Hyperglycemic Hyperosmolar State", "Atrial Fibrillation", "Acute Coronary Syndrome",
    "STEMI", "Pulmonary Embolism", "Upper GI Bleed", "Lower GI Bleed",
    "Decompensated Cirrhosis", "Hepatic Encephalopathy", "Acute Pancreatitis",
    "Cellulitis and Skin/Soft Tissue Infection", "Pyelonephritis and Complicated UTI",
    "Hyponatremia", "Hyperkalemia", "Hypercalcemia", "SIADH",
    "Type 2 Diabetes Mellitus", "Hypertensive Emergency", "Asthma Exacerbation",
    "COPD Exacerbation", "Community-Acquired Pneumonia", "Hospital-Acquired Pneumonia",
    "Aspiration Pneumonia", "Acute Ischemic Stroke", "Alcohol Withdrawal", "Delirium",
    "Deep Vein Thrombosis and VTE", "Chronic Kidney Disease", "Thyroid Storm and Hyperthyroidism",
    "Myxedema and Hypothyroidism", "Adrenal Insufficiency", "Anemia Workup",
    "Clostridioides difficile Infection", "Bacterial Meningitis", "Status Epilepticus",
    "Acute Respiratory Failure and ARDS", "Infective Endocarditis", "Osteomyelitis",
    "Gout", "Rhabdomyolysis", "Pericarditis and Cardiac Tamponade", "Aortic Dissection",
    "Small Bowel Obstruction", "Diverticulitis", "Acute Cholecystitis and Cholangitis",
    "Spontaneous Pneumothorax", "Syncope",
]


def now():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def load_queue():
    try:
        with open(QUEUE_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


_lock = threading.Lock()


def save_queue(q):
    with _lock:
        with open(QUEUE_FILE, "w", encoding="utf-8") as f:
            json.dump(q, f, indent=1)


def enqueue(name, fb_id=None):
    name = (name or "").strip()
    if not name:
        return False, "empty"
    q = load_queue()
    if any(i["disease"].lower() == name.lower() and i["status"] in ("pending", "building", "done") for i in q):
        return False, "already queued"
    q.append({"disease": name, "status": "pending", "added": now(), "started": None,
              "finished": None, "fb_id": fb_id})
    save_queue(q)
    return True, "queued"


def firestore_poller():
    """Pull diagnoses requested on the hosted site (Firestore buildRequests) into the local queue."""
    if not (fb and fb.available()):
        print("[%s] cloud queue: disabled (no fb_config.json) — local builder only" % now())
        return
    print("[%s] cloud queue: watching Firestore buildRequests" % now())
    while True:
        try:
            for req in fb.fetch_requested():
                ok, msg = enqueue(req["disease"], fb_id=req["id"])
                # Mark it 'queued' so it isn't re-fetched; if it was a dup, mark done to clear it.
                fb.set_status(req["id"], "queued" if ok else "done")
                if ok:
                    print("[%s] cloud request queued: %s" % (now(), req["disease"]))
        except Exception as e:
            print("[%s] cloud poller error: %s" % (now(), str(e)[:150]))
        time.sleep(30)


def worker():
    os.makedirs(LOG_DIR, exist_ok=True)
    while True:
        q = load_queue()
        nxt = next((i for i in q if i["status"] == "pending"), None)
        if not nxt:
            time.sleep(5)
            continue
        nxt["status"] = "building"; nxt["started"] = now()
        save_queue(q)
        if fb and nxt.get("fb_id"):
            try: fb.set_status(nxt["fb_id"], "building")
            except Exception: pass
        slug = "".join(c if c.isalnum() else "_" for c in nxt["disease"])[:60]
        logpath = os.path.join(LOG_DIR, slug + ".log")
        promptfile = os.path.join(LOG_DIR, slug + "_prompt.txt")
        with open(promptfile, "w", encoding="utf-8") as pf:
            pf.write(build_prompt(nxt["disease"]))
        print("[%s] building: %s" % (now(), nxt["disease"]))
        rc = -1; tail = ""
        # Prefer Fable 5 at MAX effort; if Fable is rate-limited, retry the same build on Opus 4.8.
        for model in ("claude-fable-5", "claude-opus-4-8"):
            try:
                # Prompt via STDIN (multi-line/quotes safe); flags stay on the command line.
                with open(logpath, "w", encoding="utf-8", errors="ignore") as lf, \
                     open(promptfile, "r", encoding="utf-8") as pin:
                    lf.write("CMD: cmd /c %s --dangerously-skip-permissions --model %s "
                             "--fallback-model claude-opus-4-8 --effort max -p  (stdin)\nSTART: %s\n\n"
                             % (CLAUDE_CMD, model, now()))
                    lf.flush()
                    # Don't kill the build's background tasks (research agents etc.) at 600s.
                    env = dict(os.environ, CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS="0")
                    p = subprocess.run(["cmd", "/c", CLAUDE_CMD, "--dangerously-skip-permissions",
                                        "--model", model, "--fallback-model", "claude-opus-4-8",
                                        "--effort", "max", "-p"],
                                       cwd=REPO, stdin=pin, stdout=lf, stderr=subprocess.STDOUT,
                                       timeout=BUILD_TIMEOUT, env=env)
                    rc = p.returncode
            except subprocess.TimeoutExpired:
                rc = -2
            except Exception as e:
                with open(logpath, "a", encoding="utf-8") as lf:
                    lf.write("\nEXC: %s\n" % e)
            try:
                with open(logpath, encoding="utf-8", errors="ignore") as lf:
                    tail = lf.read()[-3000:].lower()
            except Exception:
                tail = ""
            # Fable-specific rate limit -> fall back to Opus 4.8; otherwise stop the model loop.
            if model == "claude-fable-5" and ("fable 5 limit" in tail or "reached your fable" in tail):
                print("[%s] Fable 5 limited — retrying %s on Opus 4.8" % (now(), nxt["disease"]))
                continue
            break
        # Account-level session/usage limit (even on Opus) -> requeue + wait for reset.
        transient = ("session limit" in tail or "usage limit" in tail or "hit your" in tail
                     or "not logged in" in tail or "please run /login" in tail
                     or "connection closed" in tail or "api error" in tail
                     or "background tasks still running" in tail)
        if rc != 0 and transient:
            q = load_queue()
            for i in q:
                if i["disease"] == nxt["disease"] and i["status"] == "building":
                    i["status"] = "pending"; i["started"] = None
                    break
            save_queue(q)
            reason = "auth/logout" if "logged in" in tail or "/login" in tail else "session limit"
            print("[%s] %s on %s — waiting 20 min, then retrying" % (now(), reason, nxt["disease"]))
            time.sleep(1200)
            continue
        # Safety net: publish the guide if the build wrote it but didn't push (e.g. timeout).
        published = ensure_published(nxt["disease"])
        # reload (queue may have changed via API) and update this item
        q = load_queue()
        final = "done" if (rc == 0 or published) else "error"
        for i in q:
            if i["disease"] == nxt["disease"] and i["status"] == "building":
                i["status"] = final
                i["finished"] = now()
                i["rc"] = rc
                i["published"] = published
                break
        save_queue(q)
        if fb and nxt.get("fb_id"):
            try: fb.set_status(nxt["fb_id"], final)
            except Exception: pass
        print("[%s] %s -> %s (rc=%s)" % (now(), nxt["disease"], "done" if rc == 0 else "error", rc))
        time.sleep(3)


def json_arg(s):
    # quote the -p prompt for a Windows shell command line
    return '"' + s.replace('"', '\\"') + '"'


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=REPO, **k)

    def log_message(self, *a):
        pass

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if urlparse(self.path).path == "/api/queue":
            return self._json({"items": load_queue()})
        return super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path == "/api/enqueue":
            ln = int(self.headers.get("Content-Length", 0))
            try:
                data = json.loads(self.rfile.read(ln) or b"{}")
            except Exception:
                data = {}
            ok, msg = enqueue(data.get("disease", ""))
            return self._json({"ok": ok, "msg": msg}, 200 if ok else 400)
        self._json({"ok": False, "msg": "not found"}, 404)


def main():
    if "--seed" in sys.argv:
        for d in DEFAULT_50:
            ok, msg = enqueue(d)
            print(("+ " if ok else "  skip ") + d + (" (%s)" % msg if not ok else ""))
        print("Seeded. %d in queue." % len(load_queue()))
        if "--serve" not in sys.argv:
            return
    threading.Thread(target=worker, daemon=True).start()
    threading.Thread(target=firestore_poller, daemon=True).start()
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("Builder running: http://localhost:%d/  (worker active; laptop must stay on)" % PORT)
    print("Queue file: %s" % QUEUE_FILE)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
