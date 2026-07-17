"""
Inject the Firebase cross-device sync block into the template and every *_Study_Guide.html.

- Wraps each guide's existing saveNotes() to mirror notes to Firestore (collection 'notes',
  doc id = sgnotes_<filename>) and subscribes via onSnapshot so notes sync across PCs.
- Exposes window.SGSync.requestBuild()/watchBuilds() for the homepage add-box.
- DORMANT until fb_config.json exists with a real apiKey -> guides still work offline
  (localStorage) if config is absent or the device is offline.

Idempotent: re-running refreshes the injected config line in place.
Usage: python inject_sync.py
"""
import os, re, glob, json

REPO = os.path.dirname(os.path.abspath(__file__))
CFG_PATH = os.path.join(REPO, "fb_config.json")

def load_cfg():
    if os.path.exists(CFG_PATH):
        try:
            c = json.load(open(CFG_PATH, encoding="utf-8"))
            if c.get("apiKey"):
                return c
        except Exception as e:
            print("  (fb_config.json unreadable:", e, ")")
    return {}

CFG = load_cfg()
CFG_JSON = json.dumps(CFG)

MARKER = "SG_FB_SYNC"

BLOCK = """<!-- {marker}: cross-device notes + build requests via Firestore -->
<script>window.SG_FB_CONFIG = {cfg};</script>
<script>
(function(){{
  var cfg = window.SG_FB_CONFIG || {{}};
  if(!cfg || !cfg.apiKey){{ return; }}            // sync disabled -> localStorage only
  function load(src){{return new Promise(function(res,rej){{var s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s);}});}}
  var V='10.12.2', B='https://www.gstatic.com/firebasejs/'+V+'/';
  load(B+'firebase-app-compat.js')
    .then(function(){{return load(B+'firebase-auth-compat.js');}})
    .then(function(){{return load(B+'firebase-firestore-compat.js');}})
    .then(function(){{
      if(!firebase.apps.length) firebase.initializeApp(cfg);
      var db=firebase.firestore(), auth=firebase.auth();
      window.SGSync={{ready:false,db:db}};
      auth.signInAnonymously().catch(function(e){{console.warn('SG anon auth',e);}});
      auth.onAuthStateChanged(function(u){{
        if(!u) return;
        window.SGSync.ready=true;
        window.SGSync.requestBuild=function(name){{return db.collection('buildRequests').add({{disease:name,status:'requested',createdAt:firebase.firestore.FieldValue.serverTimestamp(),source:'web'}});}};
        window.SGSync.watchBuilds=function(cb){{return db.collection('buildRequests').orderBy('createdAt','desc').limit(40).onSnapshot(function(s){{var r=[];s.forEach(function(x){{var o=x.data();o.id=x.id;r.push(o);}});cb(r);}});}};
        if(document.dispatchEvent) document.dispatchEvent(new Event('sgsync-ready'));
        // ---- per-disease notes sync (only on guide pages that have a notes widget) ----
        var key='sgnotes_'+(location.pathname.split('/').pop()||'guide');
        if(typeof window.saveNotes!=='function' && !document.getElementById('noteList')) return;
        var ref=db.collection('notes').doc(key);
        var origSave=window.saveNotes;
        window.saveNotes=function(a){{ if(origSave) origSave(a); try{{ref.set({{items:a,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),device:(navigator.platform||'')}});}}catch(e){{}} }};
        ref.get().then(function(doc){{
          var local=[]; try{{local=JSON.parse(localStorage.getItem(key)||'[]');}}catch(e){{}}
          var remote=(doc.exists && doc.data().items)||[];
          var seen={{}}, merged=[];
          remote.concat(local).forEach(function(n){{var k=(n.ts||'')+'|'+(n.text||'');if(!seen[k]){{seen[k]=1;merged.push(n);}}}});
          if(merged.length!==remote.length){{ try{{ref.set({{items:merged,updatedAt:firebase.firestore.FieldValue.serverTimestamp()}});}}catch(e){{}} }}
          try{{localStorage.setItem(key,JSON.stringify(merged));}}catch(e){{}}
          if(window.renderNotes) renderNotes();
          ref.onSnapshot(function(d){{ if(!d.exists) return; var dd=d.data(); if(!dd||!dd.items) return; try{{localStorage.setItem(key,JSON.stringify(dd.items));}}catch(e){{}} if(window.renderNotes) renderNotes(); }});
        }}).catch(function(e){{console.warn('SG notes sync',e);}});
      }});
    }}).catch(function(e){{console.warn('SG firebase load failed (offline?)',e);}});
}})();
</script>
""".format(marker=MARKER, cfg=CFG_JSON)


def inject(path):
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()
    if MARKER in html:
        # refresh the config line only
        new = re.sub(r"window\.SG_FB_CONFIG = .*?;", "window.SG_FB_CONFIG = %s;" % CFG_JSON, html, count=1)
        action = "refreshed"
    else:
        if "</body>" not in html:
            print("  ! no </body> in", os.path.basename(path)); return
        new = html.replace("</body>", BLOCK + "</body>", 1)
        action = "injected"
    if new != html:
        with open(path, "w", encoding="utf-8") as f:
            f.write(new)
    return action


def main():
    targets = [os.path.join(REPO, "disease_template_v2.html"),
               os.path.join(REPO, "index.html")]
    targets += sorted(glob.glob(os.path.join(REPO, "*_Study_Guide.html")))
    print("Firebase config:", "PRESENT (sync ON)" if CFG.get("apiKey") else "absent (sync dormant)")
    n = 0
    for t in targets:
        if not os.path.exists(t):
            continue
        a = inject(t)
        if a:
            n += 1
    print("Processed %d files." % n)


if __name__ == "__main__":
    main()
