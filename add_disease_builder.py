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


def build_prompt(name):
    n = name.replace('"', "")
    return (
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


def enqueue(name):
    name = (name or "").strip()
    if not name:
        return False, "empty"
    q = load_queue()
    if any(i["disease"].lower() == name.lower() and i["status"] in ("pending", "building", "done") for i in q):
        return False, "already queued"
    q.append({"disease": name, "status": "pending", "added": now(), "started": None, "finished": None})
    save_queue(q)
    return True, "queued"


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
        for i in q:
            if i["disease"] == nxt["disease"] and i["status"] == "building":
                i["status"] = "done" if (rc == 0 or published) else "error"
                i["finished"] = now()
                i["rc"] = rc
                i["published"] = published
                break
        save_queue(q)
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
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("Builder running: http://localhost:%d/  (worker active; laptop must stay on)" % PORT)
    print("Queue file: %s" % QUEUE_FILE)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
