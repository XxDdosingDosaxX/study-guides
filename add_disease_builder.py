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
# Strict-config Claude wrapper (avoids cloud-MCP session spam). Falls back to PATH 'claude'.
CLAUDE_CMD = os.path.expanduser(r"~\.local\bin\claude.cmd")
if not os.path.exists(CLAUDE_CMD):
    CLAUDE_CMD = "claude"
BUILD_TIMEOUT = 3600  # 60 min per disease

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
        prompt = '/add-disease "%s"' % nxt["disease"].replace('"', "")
        cmd = '"%s" -p %s --dangerously-skip-permissions' % (CLAUDE_CMD, json_arg(prompt))
        print("[%s] building: %s" % (now(), nxt["disease"]))
        rc = -1
        try:
            with open(logpath, "w", encoding="utf-8", errors="ignore") as lf:
                lf.write("CMD: %s\nSTART: %s\n\n" % (cmd, now()))
                lf.flush()
                p = subprocess.run(cmd, cwd=REPO, shell=True, stdout=lf,
                                   stderr=subprocess.STDOUT, timeout=BUILD_TIMEOUT)
                rc = p.returncode
        except subprocess.TimeoutExpired:
            rc = -2
        except Exception as e:
            with open(logpath, "a", encoding="utf-8") as lf:
                lf.write("\nEXC: %s\n" % e)
        # reload (queue may have changed via API) and update this item
        q = load_queue()
        for i in q:
            if i["disease"] == nxt["disease"] and i["status"] == "building":
                i["status"] = "done" if rc == 0 else "error"
                i["finished"] = now()
                i["rc"] = rc
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
