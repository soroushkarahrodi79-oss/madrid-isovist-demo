"""Builds the single-file demo (index.html) from src/ and data/.
Run from the demo folder:  python -I -X utf8 build.py          -> writes index.html
                           python -I -X utf8 build.py --check  -> exits 1 if index.html is not what the sources produce
Everything is inlined so the page also works when opened from disk (no fetch calls)."""
import sys, os, json, hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
rd = lambda *p: open(os.path.join(HERE, *p), encoding="utf-8").read()
js = lambda *p: json.dumps(json.load(open(os.path.join(HERE, *p), encoding="utf-8")), separators=(",", ":"), ensure_ascii=False)

def build():
    t = rd("src", "template.html")
    parts = {
        "leaflet-css": rd("src", "vendor", "leaflet.css"),
        "style": rd("src", "style.css"),
        "leaflet-js": rd("src", "vendor", "leaflet.js"),
        "data": "window.MVA_DATA={buildings:" + js("data", "buildings.json") + ",osm:" + js("data", "buildings_osm.json") + ",osmMeta:" + js("data", "osm_meta.json") + ",observers:" + js("data", "observers.json") + ",step0:" + js("data", "step0_points.json") + "};",
        "isovist": rd("src", "isovist.js"),
        "app": rd("src", "app.js"),
    }
    for k, v in parts.items():
        assert "</script" not in v.lower() or k in ("leaflet-css", "style"), f"{k} contains a closing script tag"
        marker = f"<!--@{k}-->"
        assert marker in t, "missing marker " + marker
        t = t.replace(marker, v)
    return t

if __name__ == "__main__":
    out = build(); path = os.path.join(HERE, "index.html")
    if "--check" in sys.argv:
        cur = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
        same = cur == out
        print("index.html is up to date" if same else "index.html differs from the sources: run build.py")
        sys.exit(0 if same else 1)
    open(path, "w", encoding="utf-8", newline="\n").write(out)
    print(f"index.html written: {len(out.encode('utf-8')):,} bytes, sha256 {hashlib.sha256(out.encode('utf-8')).hexdigest()[:16]}")
