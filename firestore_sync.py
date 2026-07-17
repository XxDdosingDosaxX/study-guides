"""
Firestore REST bridge for the local builder (no service-account file needed).

Signs in ANONYMOUSLY with the web API key (same key the site uses), then reads/writes the
`buildRequests` collection so a diagnosis requested on the hosted GitHub Pages site is picked
up and built here. Security rules allow any signed-in (incl. anonymous) user to read/write.

Config comes from fb_config.json ({apiKey, projectId, ...}). If that file is missing or has no
apiKey, every function is a safe no-op and the builder runs purely local.
"""
import os, json, time
try:
    import requests
except Exception:
    requests = None

REPO = os.path.dirname(os.path.abspath(__file__))
CFG_PATH = os.path.join(REPO, "fb_config.json")

def _cfg():
    try:
        c = json.load(open(CFG_PATH, encoding="utf-8"))
        if c.get("apiKey") and c.get("projectId"):
            return c
    except Exception:
        pass
    return None

def available():
    return requests is not None and _cfg() is not None

_tok = {"id": None, "exp": 0}

def _token():
    """Anonymous ID token, cached ~50 min."""
    if _tok["id"] and time.time() < _tok["exp"]:
        return _tok["id"]
    c = _cfg()
    if not c:
        return None
    r = requests.post(
        "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + c["apiKey"],
        json={"returnSecureToken": True}, timeout=20)
    r.raise_for_status()
    j = r.json()
    _tok["id"] = j["idToken"]
    _tok["exp"] = time.time() + 3000
    return _tok["id"]

def _base():
    c = _cfg()
    return "https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents" % c["projectId"]

def _hdr():
    return {"Authorization": "Bearer " + _token()}

def fetch_requested():
    """Return [{id, disease}] for buildRequests with status == 'requested'."""
    if not available():
        return []
    try:
        body = {"structuredQuery": {
            "from": [{"collectionId": "buildRequests"}],
            "where": {"fieldFilter": {"field": {"fieldPath": "status"},
                                      "op": "EQUAL", "value": {"stringValue": "requested"}}},
            "limit": 25}}
        r = requests.post(_base() + ":runQuery", headers=_hdr(), json=body, timeout=25)
        r.raise_for_status()
        out = []
        for row in r.json():
            doc = row.get("document")
            if not doc:
                continue
            name = doc.get("name", "")
            did = name.rsplit("/", 1)[-1]
            fields = doc.get("fields", {})
            disease = fields.get("disease", {}).get("stringValue", "").strip()
            if disease:
                out.append({"id": did, "disease": disease})
        return out
    except Exception as e:
        print("[firestore] fetch_requested error:", str(e)[:150])
        return []

def set_status(doc_id, status, extra=None):
    """Patch buildRequests/<doc_id>.status (+ optional extra string fields)."""
    if not available() or not doc_id:
        return False
    try:
        fields = {"status": {"stringValue": status}}
        for k, v in (extra or {}).items():
            fields[k] = {"stringValue": str(v)}
        mask = "&".join("updateMask.fieldPaths=" + k for k in fields)
        url = "%s/buildRequests/%s?%s" % (_base(), doc_id, mask)
        r = requests.patch(url, headers=_hdr(), json={"fields": fields}, timeout=20)
        r.raise_for_status()
        return True
    except Exception as e:
        print("[firestore] set_status error:", str(e)[:150])
        return False
