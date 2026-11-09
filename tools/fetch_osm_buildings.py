"""Downloads OpenStreetMap building footprints around Plaza de Lavapies and prepares data/buildings_osm.json.
Run from the demo folder:  python -I -X utf8 tools/fetch_osm_buildings.py [--half 1000] [--raw ../demo_raw/osm_buildings_raw.json] [--reuse]
 - One Overpass request (curl, normal certificate checking). --reuse skips the download and rebuilds from the saved raw file.
 - Inside the municipal footprint area (data/buildings.json) the official footprints are kept and OSM buildings are dropped,
   so OSM only fills the surroundings. Each OSM building is stored as a MultiPolygon like data/buildings.json.
 - Writes data/buildings_osm.json and data/osm_meta.json (query, OSM timestamp, counts, SHA-256 of the raw response).
Data: (c) OpenStreetMap contributors, ODbL. Footprints are drawn by volunteers: not the same definition as roof-derived municipal outlines."""
import sys, os, json, math, time, hashlib, subprocess
from shapely.geometry import Polygon, LineString, box
from shapely.ops import polygonize, unary_union
from shapely.validation import make_valid

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
arg = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
HALF = float(arg("--half", 1000)); RAW = os.path.abspath(os.path.join(ROOT, arg("--raw", "../demo_raw/osm_buildings_raw.json")))
LAT0, LON0, KX, KY = 40.4088, -3.7, 111320 * math.cos(math.radians(40.4088)), 110574   # same local frame as src/isovist.js
CENTER = (40.4088, -3.7007)
xy = lambda lon, lat: ((lon - LON0) * KX, (lat - LAT0) * KY)

dlat, dlon = HALF / KY, HALF / (111320 * math.cos(math.radians(CENTER[0])))
S, W, N, E = CENTER[0] - dlat, CENTER[1] - dlon, CENTER[0] + dlat, CENTER[1] + dlon
QUERY = f'[out:json][timeout:180];(way["building"]({S:.5f},{W:.5f},{N:.5f},{E:.5f});relation["building"]({S:.5f},{W:.5f},{N:.5f},{E:.5f}););out geom;'

if "--reuse" not in sys.argv:
    os.makedirs(os.path.dirname(RAW), exist_ok=True)
    for attempt in range(4):
        r = subprocess.run(["curl", "-sS", "--max-time", "240", "-A", "mva-isovist-demo (research)", "--data-urlencode", "data=" + QUERY,
                            "-o", RAW, "-w", "%{http_code}", "https://overpass-api.de/api/interpreter"], capture_output=True, text=True)
        ok = r.stdout.strip() == "200" and open(RAW, "rb").read(1) == b"{"
        print(f"attempt {attempt + 1}: http {r.stdout.strip()} {'ok' if ok else r.stderr.strip()[:120]}")
        if ok: break
        time.sleep(20 * (attempt + 1))
    else:
        sys.exit("download failed")
raw_bytes = open(RAW, "rb").read(); data = json.loads(raw_bytes)
print("raw bytes", len(raw_bytes), "elements", len(data["elements"]), "osm timestamp", data["osm3s"].get("timestamp_osm_base"))

def ring_ll(geom): return [(g["lon"], g["lat"]) for g in geom]
def to_m(q):  # lon/lat polygon -> local metres
    return Polygon([xy(*c) for c in q.exterior.coords], [[xy(*c) for c in h.coords] for h in q.interiors])
polys, skipped = [], {"no_geometry": 0, "invalid_or_tiny": 0, "building_no": 0}
for el in data["elements"]:
    if el.get("tags", {}).get("building") == "no": skipped["building_no"] += 1; continue
    try:
        if el["type"] == "way":
            g = el.get("geometry") or []
            if len(g) < 4 or g[0] != g[-1]: skipped["no_geometry"] += 1; continue
            p = Polygon(ring_ll(g))
        else:
            outer, inner = [], []
            for m in el.get("members", []):
                if m.get("type") != "way" or not m.get("geometry"): continue
                (inner if m.get("role") == "inner" else outer).append(ring_ll(m["geometry"]))
            o = unary_union(list(polygonize(unary_union([LineString(c) for c in outer if len(c) > 1])))) if outer else None
            if o is None or o.is_empty: skipped["no_geometry"] += 1; continue
            i = unary_union(list(polygonize(unary_union([LineString(c) for c in inner if len(c) > 1])))) if inner else None
            p = o.difference(i) if i is not None and not i.is_empty else o
        if not p.is_valid: p = make_valid(p)
        parts = [q for q in (p.geoms if hasattr(p, "geoms") else [p]) if q.geom_type == "Polygon" and not q.is_empty and to_m(q).area >= 3.0]
        if not parts: skipped["invalid_or_tiny"] += 1; continue
        polys.append((el["type"] + "/" + str(el["id"]), parts))
    except Exception:
        skipped["invalid_or_tiny"] += 1

# municipal footprints (lon/lat) -> local metres
mun = json.load(open(os.path.join(ROOT, "data", "buildings.json"), encoding="utf-8"))
mun_polys = [Polygon([xy(*c) for c in poly[0]], [[xy(*c) for c in h] for h in poly[1:]]) for mp in mun for poly in mp]
mun_union = unary_union([p if p.is_valid else make_valid(p) for p in mun_polys])
mb = mun_union.bounds; mun_box = box(*mb)
kept, dropped_inside, dropped_overlap = [], 0, 0
for oid, parts in polys:
    pm = [to_m(q) for q in parts]; pm = [q if q.is_valid else make_valid(q) for q in pm]
    total = sum(q.area for q in pm)
    if mun_box.contains(pm[0].representative_point()): dropped_inside += 1; continue
    if total > 0 and sum(q.intersection(mun_union).area for q in pm) / total > 0.10: dropped_overlap += 1; continue
    kept.append((oid, parts))

def fmt_ring(r): return [[round(x, 6), round(y, 6)] for x, y in r.coords]
out = []
for oid, parts in kept:
    mp = []
    for q in parts:
        q = q.simplify(0.0000018, preserve_topology=True)
        if q.is_empty or q.geom_type != "Polygon": continue
        mp.append([fmt_ring(q.exterior)] + [fmt_ring(h) for h in q.interiors])
    if mp: out.append(mp)
json.dump(out, open(os.path.join(ROOT, "data", "buildings_osm.json"), "w"), separators=(",", ":"))
meta = dict(source="OpenStreetMap via Overpass API (overpass-api.de)", licence="ODbL, (c) OpenStreetMap contributors", query=QUERY,
            osm_timestamp=data["osm3s"].get("timestamp_osm_base"), fetched_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            bbox_lonlat=dict(south=S, west=W, north=N, east=E), half_side_m=HALF, raw_sha256=hashlib.sha256(raw_bytes).hexdigest(), raw_bytes=len(raw_bytes),
            counts=dict(raw_elements=len(data["elements"]), valid_buildings=len(polys), dropped_inside_municipal_area=dropped_inside,
                        dropped_overlapping_municipal=dropped_overlap, kept=len(out), skipped=skipped),
            municipal_box_m=dict(minx=mb[0], miny=mb[1], maxx=mb[2], maxy=mb[3]),
            note="OSM footprints are volunteer-drawn and differ in definition from the roof-derived municipal outlines; used only outside the municipal area.")
json.dump(meta, open(os.path.join(ROOT, "data", "osm_meta.json"), "w"), indent=1)
print(json.dumps(meta["counts"], indent=1)); print("buildings_osm.json bytes", os.path.getsize(os.path.join(ROOT, "data", "buildings_osm.json")))
