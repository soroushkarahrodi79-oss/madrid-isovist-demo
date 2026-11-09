// Checks src/isovist.js against the Phase 2A / 2B results computed with Shapely (stored in data/observers.json).
// Run from the demo folder:  node tests/test_isovist.js
const fs = require("fs"), path = require("path");
const M = require("../src/isovist.js");
const root = path.join(__dirname, "..");
const B = JSON.parse(fs.readFileSync(path.join(root, "data", "buildings.json"), "utf8"));
const OBS = JSON.parse(fs.readFileSync(path.join(root, "data", "observers.json"), "utf8")).observers;
const ed = M.buildEdges(B);
console.log(`edges ${ed.n}, observers ${OBS.length}`);
let worst = { area: 0, ap: 0, mean: 0, e05: 0, e10: 0 }, fail = 0;
const rows = [];
for (const o of OBS) {
  const [x, y] = M.toXY(o.lon, o.lat);
  const t0 = process.hrtime.bigint();
  const b = M.isovist(ed, x, y);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const a05 = M.isovist(ed, x, y, { margin: 0.5 }), a10 = M.isovist(ed, x, y, { margin: 1.0 });
  const dA = 100 * (b.area - o.area) / o.area, dAp = b.aperture - o.aperture, dM = b.mean - o.mean_ray;
  const s05 = a05.invalid ? NaN : 100 * (a05.area - b.area) / b.area, s10 = a10.invalid ? NaN : 100 * (a10.area - b.area) / b.area;
  const e05 = s05 - o.d_area_exp05, e10 = s10 - o.d_area_exp10;
  worst.area = Math.max(worst.area, Math.abs(dA)); worst.ap = Math.max(worst.ap, Math.abs(dAp)); worst.mean = Math.max(worst.mean, Math.abs(dM));
  if (!isNaN(e05)) worst.e05 = Math.max(worst.e05, Math.abs(e05)); if (!isNaN(e10)) worst.e10 = Math.max(worst.e10, Math.abs(e10));
  rows.push([o.id, o.area.toFixed(0), b.area.toFixed(0), dA.toFixed(2) + "%", dAp.toFixed(4), dM.toFixed(2), o.d_area_exp05.toFixed(1), s05.toFixed(1), o.d_area_exp10.toFixed(1), s10.toFixed(1), ms.toFixed(1) + "ms"]);
}
console.log(["id", "area_py", "area_js", "dArea", "dAper", "dMean", "py+0.5", "js+0.5", "py+1.0", "js+1.0", "time"].join("\t"));
rows.forEach(r => console.log(r.join("\t")));
console.log("worst |dArea| %", worst.area.toFixed(3), "| |dAperture|", worst.ap.toFixed(5), "| |dMean| m", worst.mean.toFixed(3));
console.log("margin approximation, worst difference vs Shapely buffer (percentage points): +0.5 m", worst.e05.toFixed(2), "| +1.0 m", worst.e10.toFixed(2));
// hard gates for the exact (margin 0) computation
if (worst.area > 1.0) { console.log("FAIL area differs by more than 1%"); fail = 1; }
if (worst.mean > 0.1) { console.log("FAIL mean ray differs by more than 0.1 m"); fail = 1; }
// the point inside a building must be detected
const [bx, by] = M.toXY(B[0][0][0][0][0], B[0][0][0][0][1]);
console.log("insideBuilding at a footprint vertex neighbourhood:", M.insideBuilding(ed, bx + 0.0, by + 0.0));

// ---- extended area: municipal + OpenStreetMap footprints (data/buildings_osm.json)
const osmPath = path.join(root, "data", "buildings_osm.json");
if (fs.existsSync(osmPath)) {
  const O = JSON.parse(fs.readFileSync(osmPath, "utf8")), ed2 = M.buildEdges(B.concat(O));
  console.log(`combined edges ${ed2.n} (municipal ${ed.n} + OSM ${ed2.n - ed.n}), buildings ${B.length + O.length}`);
  let maxd = 0;
  for (const o of OBS) { const [x, y] = M.toXY(o.lon, o.lat); const a = M.isovist(ed, x, y), b2 = M.isovist(ed2, x, y); maxd = Math.max(maxd, Math.abs(a.area - b2.area)); }
  console.log("observers: max |area| change when OSM footprints are added (they lie beyond the 100 m discs):", maxd.toExponential(2), "m2");
  if (maxd > 1e-6) { console.log("FAIL adding OSM footprints changed a pilot observer"); fail = 1; }
  // every observer is outside buildings; a point inside a building polygon is detected
  for (const o of OBS) { const [x, y] = M.toXY(o.lon, o.lat); if (M.insideBuilding(ed2, x, y)) { console.log("FAIL observer inside a building", o.id); fail = 1; } }
  const ring = O[0][0][0], cxy = ring.slice(0, -1).map(c => M.toXY(c[0], c[1])), mx = cxy.reduce((a, c) => a + c[0], 0) / cxy.length, my = cxy.reduce((a, c) => a + c[1], 0) / cxy.length;
  console.log("centroid of the first OSM building reported inside:", M.insideBuilding(ed2, mx, my), "(can be false for non-convex shapes)");
  // timing over scattered points in open space
  let n = 0, tot = 0, worstMs = 0; const ex = ed2.bbox;
  for (let i = 0; i < 300; i++) {
    const x = ex[0] + 150 + Math.random() * (ex[2] - ex[0] - 300), y = ex[1] + 150 + Math.random() * (ex[3] - ex[1] - 300);
    if (M.insideBuilding(ed2, x, y)) continue;
    const t0 = process.hrtime.bigint(); M.isovist(ed2, x, y); const ms = Number(process.hrtime.bigint() - t0) / 1e6; tot += ms; n++; worstMs = Math.max(worstMs, ms);
  }
  console.log(`isovist time over ${n} random open points: mean ${(tot / n).toFixed(1)} ms, worst ${worstMs.toFixed(1)} ms`);
}
console.log(fail ? "FAIL" : "PASS");
process.exit(fail);
