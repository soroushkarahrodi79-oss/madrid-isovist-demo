/* MVA isovist core. Pure functions shared by the page and the Node test (tests/test_isovist.js).
   Mirrors step0/phase2a/isovist.py: R = 100 m, 360 uniform rays, plus one ray at +-1e-9 rad toward every obstacle vertex
   within R, obstacles = footprint edges. mean ray and horizon share use the uniform rays only, as in Python.
   Obstacle margin: approximation (each wall is shifted toward the observer and lengthened by the margin); it is NOT a true
   polygon buffer. The test compares it with the Shapely buffers of Phase 2B. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MVA = Object.assign(root.MVA || {}, factory());
})(typeof self !== "undefined" ? self : this, function () {
  const LON0 = -3.7, LAT0 = 40.4088, KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KY = 110574;
  const toXY = (lon, lat) => [(lon - LON0) * KX, (lat - LAT0) * KY];
  const toLL = (x, y) => [y / KY + LAT0, x / KX + LON0];
  // Uniform rays of the Python run follow the UTM 30N grid; grid convergence at this longitude, radians (set by the test).
  let GRID_ROT = -((LON0 + 3) * Math.sin(LAT0 * Math.PI / 180)) * Math.PI / 180;   // = +0.4538 deg; central meridian of UTM 30N is 3 deg W
  const setGridRot = r => { GRID_ROT = r; };

  // buildings: array of MultiPolygons [[ring,...],...]; ring = [[lon,lat],...]
  function buildEdges(buildings) {
    const out = [];
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    buildings.forEach(mp => mp.forEach(poly => poly.forEach(r => {
      for (let i = 0; i < r.length - 1; i++) {
        const a = toXY(r[i][0], r[i][1]), b = toXY(r[i + 1][0], r[i + 1][1]);
        out.push(a[0], a[1], b[0], b[1]);
        minx = Math.min(minx, a[0]); maxx = Math.max(maxx, a[0]); miny = Math.min(miny, a[1]); maxy = Math.max(maxy, a[1]);
      }
    })));
    const E = Float64Array.from(out), n = out.length / 4, CS = 100, grid = new Map();
    const key = (cx, cy) => (cx + 4000) * 8000 + (cy + 4000);
    for (let i = 0; i < n; i++) {                      // uniform grid: each wall is listed in every 100 m cell its bbox touches
      const o = i * 4, x0 = Math.min(E[o], E[o + 2]), x1 = Math.max(E[o], E[o + 2]), y0 = Math.min(E[o + 1], E[o + 3]), y1 = Math.max(E[o + 1], E[o + 3]);
      for (let cx = Math.floor(x0 / CS); cx <= Math.floor(x1 / CS); cx++) for (let cy = Math.floor(y0 / CS); cy <= Math.floor(y1 / CS); cy++) {
        const k = key(cx, cy); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(i);
      }
    }
    return { E, n, bbox: [minx, miny, maxx, maxy], grid, CS, key, stamp: new Int32Array(n), tag: 0 };
  }

  // even-odd test: horizontal ray toward +x, walls taken from the grid row of the point (buildings do not overlap)
  function insideBuilding(ed, px, py) {
    const E = ed.E, CS = ed.CS, cy = Math.floor(py / CS), cx0 = Math.floor(px / CS), cx1 = Math.floor(ed.bbox[2] / CS), tag = ++ed.tag; let c = false;
    for (let cx = cx0; cx <= cx1; cx++) {
      const l = ed.grid.get(ed.key(cx, cy)); if (!l) continue;
      for (const i of l) {
        if (ed.stamp[i] === tag) continue; ed.stamp[i] = tag;
        const o = i * 4, ax = E[o], ay = E[o + 1], bx = E[o + 2], by = E[o + 3];
        if ((ay > py) !== (by > py)) { const xi = ax + (py - ay) * (bx - ax) / (by - ay); if (xi > px) c = !c; }
      }
    }
    return c;
  }

  function isovist(ed, px, py, opt) {
    opt = opt || {};
    const R = opt.R || 100, NR = opt.NR || 360, M = opt.margin || 0, ROT = opt.rot === undefined ? GRID_ROT : opt.rot, EPS = 1e-9, E = ed.E, lim = R + 1;
    let near = [], clear = Infinity;
    const tag = ++ed.tag, CS = ed.CS;
    for (let cx = Math.floor((px - lim) / CS); cx <= Math.floor((px + lim) / CS); cx++) for (let cy = Math.floor((py - lim) / CS); cy <= Math.floor((py + lim) / CS); cy++) {
      const l = ed.grid.get(ed.key(cx, cy)); if (!l) continue;
      for (const i of l) {
        if (ed.stamp[i] === tag) continue; ed.stamp[i] = tag;
        const o = i * 4, ax = E[o], ay = E[o + 1], bx = E[o + 2], by = E[o + 3];
        const ex = bx - ax, ey = by - ay, L2 = ex * ex + ey * ey;
        let u = L2 > 1e-18 ? ((px - ax) * ex + (py - ay) * ey) / L2 : 0; u = u < 0 ? 0 : u > 1 ? 1 : u;
        const dx = ax + u * ex - px, dy = ay + u * ey - py, d2 = dx * dx + dy * dy;
        if (d2 <= lim * lim) { near.push(ax - px, ay - py, ex, ey); if (d2 < clear * clear) clear = Math.sqrt(d2); }
      }
    }
    if (M > 0 && clear <= M) return { invalid: "inside_expanded", clearance: clear };
    if (M > 0) {
      const t2 = [];
      for (let j = 0; j < near.length; j += 4) {
        let Ax = near[j], Ay = near[j + 1], ex = near[j + 2], ey = near[j + 3];
        const l = Math.hypot(ex, ey) || 1, tx = ex / l, ty = ey / l; let nx = -ty, ny = tx;
        if (nx * (-Ax) + ny * (-Ay) < 0) { nx = -nx; ny = -ny; }
        t2.push(Ax + M * nx - M * tx, Ay + M * ny - M * ty, ex + 2 * M * tx, ey + 2 * M * ty);
      }
      near = t2;
    }
    const ne = near.length, TAU = 2 * Math.PI, NB = 720, BW = TAU / NB, buckets = new Array(NB);
    for (let b = 0; b < NB; b++) buckets[b] = [];
    for (let j = 0; j < ne; j += 4) {            // each wall goes into the angular buckets it spans (padded by one)
      const Ax = near[j], Ay = near[j + 1], Bx = Ax + near[j + 2], By = Ay + near[j + 3];
      const a1 = Math.atan2(Ay, Ax); let d = Math.atan2(By, Bx) - a1;
      if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
      const lo = d >= 0 ? a1 : a1 + d, hi = d >= 0 ? a1 + d : a1;
      for (let b = Math.floor(lo / BW) - 1, b1 = Math.floor(hi / BW) + 1; b <= b1; b++) buckets[((b % NB) + NB) % NB].push(j);
    }
    const cast = a => {
      const dx = Math.cos(a), dy = Math.sin(a), bk = buckets[((Math.floor(a / BW) % NB) + NB) % NB]; let best = R;
      for (let q = 0; q < bk.length; q++) {
        const j = bk[q], Ax = near[j], Ay = near[j + 1], ex = near[j + 2], ey = near[j + 3], den = dx * ey - dy * ex;
        if (Math.abs(den) <= 1e-12) continue;
        const t = (Ax * ey - Ay * ex) / den, u = (Ax * dy - Ay * dx) / den;
        if (t > 1e-9 && t < best && u >= -1e-12 && u <= 1 + 1e-12) best = t;
      }
      return best;
    };
    const ang = [];
    for (let k = 0; k < NR; k++) ang.push((((k * TAU / NR + ROT) % TAU) + TAU) % TAU);
    const seen = new Set();
    for (let j = 0; j < ne; j += 4) {
      for (const [vx, vy] of [[near[j], near[j + 1]], [near[j] + near[j + 2], near[j + 1] + near[j + 3]]]) {
        if (Math.hypot(vx, vy) > R) continue;
        const key = Math.round(vx * 1e6) + "," + Math.round(vy * 1e6); if (seen.has(key)) continue; seen.add(key);
        const ca = Math.atan2(vy, vx);
        ang.push(((ca - EPS) % TAU + TAU) % TAU, ((ca + EPS) % TAU + TAU) % TAU);
      }
    }
    const ray = new Float64Array(NR); let sum = 0, hz = 0;
    for (let k = 0; k < NR; k++) { ray[k] = cast(ang[k]); sum += ray[k]; if (ray[k] >= R - 1e-9) hz++; }
    const all = ang.slice(NR).sort((a, b) => a - b);
    const pairs = [];
    for (let k = 0; k < NR; k++) pairs.push([ang[k], ray[k]]);
    for (const a of all) pairs.push([a, cast(a)]);
    pairs.sort((p, q) => p[0] - q[0]);
    const pts = [], rel = [];
    let last = -1;
    for (const [a, t] of pairs) {
      if (a - last < 1e-13) continue; last = a;
      rel.push([t * Math.cos(a), t * Math.sin(a)]); pts.push([px + t * Math.cos(a), py + t * Math.sin(a)]);
    }
    let area = 0;
    for (let k = 0; k < rel.length; k++) { const a = rel[k], b = rel[(k + 1) % rel.length]; area += a[0] * b[1] - b[0] * a[1]; }
    area = Math.abs(area) / 2;
    return { area, aperture: area / (Math.PI * R * R), mean: sum / NR, horizon: hz / NR, pts, ray, clearance: clear, nv: pts.length };
  }

  return { toXY, toLL, buildEdges, insideBuilding, isovist, setGridRot, LAT0, LON0 };
});
