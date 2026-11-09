(function () {
"use strict";
const D = window.MVA_DATA, M = window.MVA, OBS = D.observers.observers, S0 = D.step0;
const $ = id => document.getElementById(id);
const fmt = (n, d = 0) => n.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d });
const safe = f => { try { return f(); } catch (e) { return null; } };
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const NAME = { open_plaza: "Plaza abierta", narrow_street: "Calle estrecha" };
const ROUTE = { "cand-plaza": "Plaza de Lavapiés", "cand-valencia": "Calle de Valencia / plaza", "cand-avemaria": "Calle del Ave María" };
const short = id => id.replace("cand-", "");
const col = ctx => css(ctx === "open_plaza" ? "--plaza" : "--calle");
const ED = M.buildEdges(D.buildings.concat(D.osm || []));
const META = D.osmMeta, MUN = META.municipal_box_m;
const EXT = (() => { const b = META.bbox_lonlat, a = M.toXY(b.west, b.south), c = M.toXY(b.east, b.north); return [a[0], a[1], c[0], c[1]]; })();   // extent of the downloaded area, metres
const ll = p => M.toLL(p[0], p[1]);                       // [x, y] metres -> [lat, lon]

// ---------- theme
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const b = $("theme"); b.textContent = t === "dark" ? "☀" : "☾"; b.setAttribute("aria-pressed", String(t === "dark"));
  b.setAttribute("aria-label", t === "dark" ? "Activar tema claro" : "Activar tema oscuro");
  if (window.__ready) restyle();
}
applyTheme(safe(() => localStorage.getItem("mva-theme")) || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
$("theme").onclick = () => { const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; safe(() => localStorage.setItem("mva-theme", t)); applyTheme(t); };

// ---------- map and static layers
const map = L.map("map", { zoomControl: true, preferCanvas: true, zoomSnap: .25, minZoom: 14, maxZoom: 20 });
map.attributionControl.setPrefix(false);
L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
const bb = EXT, sw = M.toLL(bb[0], bb[1]), ne = M.toLL(bb[2], bb[3]);
map.setMaxBounds(L.latLngBounds(sw, ne).pad(0.6));
const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, className: "basetile", attribution: "© OpenStreetMap contributors" }).addTo(map);
let tileOk = false;
tiles.on("tileload", () => { tileOk = true; $("nt").style.display = "none"; });
tiles.on("tileerror", () => { if (!tileOk && $("t-tile").checked) $("nt").style.display = "block"; });
const canvas = L.canvas({ padding: .5 });
const bld = L.layerGroup();
const bldPoly = L.polygon(D.buildings.flatMap(mp => mp.map(poly => poly.map(r => r.map(c => [c[1], c[0]])))), { renderer: canvas, stroke: true, weight: .8, fillOpacity: .9, interactive: false }).addTo(bld);
bld.addTo(map);
const osmLayer = L.layerGroup();
const osmPoly = L.polygon((D.osm || []).flatMap(mp => mp.map(poly => poly.map(r => r.map(c => [c[1], c[0]])))), { renderer: canvas, stroke: true, weight: .7, fillOpacity: .85, interactive: false }).addTo(osmLayer);
osmLayer.addTo(map); bldPoly.bringToFront();
const isoLayer = L.layerGroup().addTo(map), ringLayer = L.layerGroup(), obsLayer = L.layerGroup().addTo(map);
const isoById = {}, markerById = {}, ringById = {};
OBS.forEach(o => {
  isoById[o.id] = L.polygon(o.poly.map(c => [c[1], c[0]]), { renderer: canvas, weight: 1.6, fillOpacity: .32, interactive: false });
  ringById[o.id] = L.circle([o.lat, o.lon], { radius: 100, weight: 1, dashArray: "4 5", fill: false, interactive: false, renderer: canvas }).addTo(ringLayer);
  markerById[o.id] = L.circleMarker([o.lat, o.lon], { radius: 7, color: "#fff", weight: 2.5, fillOpacity: 1, bubblingMouseEvents: false })
    .bindTooltip(short(o.id), { permanent: true, direction: "right", offset: [8, 0], className: "obs-label" }).addTo(obsLayer);
  markerById[o.id].on("click", () => select(o.id));
});
let sel = OBS[0].id, all = false;

// ---------- probe (live isovist anywhere in the data)
const probeGroup = L.layerGroup().addTo(map);
const probePoly = L.polygon([], { renderer: canvas, weight: 2, fillOpacity: .3, interactive: false }).addTo(probeGroup);
const pinPoly = { A: L.polygon([], { renderer: canvas, weight: 2, fillOpacity: .08, interactive: false }), B: L.polygon([], { renderer: canvas, weight: 2, dashArray: "6 5", fillOpacity: .08, interactive: false }) };
const probeMarker = L.marker([0, 0], { draggable: true, keyboard: true, title: "Punto de la sonda: arrástralo", icon: L.divIcon({ className: "", html: '<div class="probe-pin"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }) });
let probe = null, pins = { A: null, B: null }, raf = 0;
function compute(lat, lon, R, mg) {
  const [x, y] = M.toXY(lon, lat);
  if (M.insideBuilding(ED, x, y)) return { inside: true };
  const res = M.isovist(ED, x, y, { R, margin: mg });
  if (res.invalid) return { invalid: true, clearance: res.clearance };
  res.trunc = x - R < bb[0] || x + R > bb[2] || y - R < bb[1] || y + R > bb[3];
  res.mixed = x - R < MUN.minx || x + R > MUN.maxx || y - R < MUN.miny || y + R > MUN.maxy;   // part of the disc lies outside the municipal footprints
  return { res, x, y, R, mg, lat, lon };
}
function params() { return { R: +$("p-r").value, mg: +$("p-m").value }; }
function setProbe(lat, lon, o) {
  o = o || {}; const { R, mg } = params(), c = compute(lat, lon, R, mg);
  if (c.inside) { toast("Ese punto está dentro de un edificio"); return; }
  probeMarker.setLatLng([lat, lon]); if (!probeGroup.hasLayer(probeMarker)) probeMarker.addTo(probeGroup);
  if (c.invalid) { probe = null; probePoly.setLatLngs([]); renderProbe({ lat, lon, invalid: true, clearance: c.clearance, mg }); writeHash(); return; }
  probe = c; probePoly.setLatLngs(c.res.pts.map(ll)); renderProbe(c); polar(c); writeHash();
}
function renderProbe(c) {
  const box = $("probe");
  if (c.invalid) { box.innerHTML = `<h3>Margen demasiado grande</h3><p class="small">El punto queda a ${fmt(c.clearance, 2)} m de una huella y el margen elegido (${fmt(c.mg, 2)} m) lo dejaría dentro del obstáculo. Reduce el margen o mueve el punto.</p>`; $("polar").hidden = true; return; }
  const r = c.res, mk = (l, v, u) => `<div class="m"><b>${v}</b><span>${l}${u ? ` (${u})` : ""}</span></div>`;
  box.innerHTML = `<h3>Sonda</h3><div class="tag">${fmt(c.lat, 5)}, ${fmt(c.lon, 5)} · R = ${c.R} m${c.mg ? ` · margen ${fmt(c.mg, 2)} m` : ""}</div>
    <div class="metrics">${mk("Área visible", fmt(r.area), "m²")}${mk("Apertura visual", fmt(r.aperture, 3), "0–1")}${mk("Radio medio", fmt(r.mean, 1), "m")}</div>
    <p class="small">Rayos que alcanzan ${c.R} m: ${fmt(r.horizon * 100, 1)} %. Distancia a la huella más cercana: ${r.clearance > 101 ? "más de 100" : fmt(r.clearance, 2)} m. ${r.nv} vértices.</p>
    ${r.mixed ? '<div class="note"><b>Usa huellas de OpenStreetMap:</b> parte del círculo cae fuera del área oficial del Ayuntamiento. OSM dibuja los edificios de otra forma (voluntarios, sin la definición de cubierta), así que este resultado no es comparable con los del piloto.</div>' : ""}
    ${r.trunc ? '<div class="note"><b>Cerca del borde de los datos:</b> el círculo sale del área descargada (2 × 2 km) y la isovista puede estar truncada.</div>' : ""}
    ${r.clearance < 1.5 ? '<div class="frag"><b>Punto frágil:</b> a menos de 1,5 m de una huella; un margen de fachada de 1 m cambiaría mucho su vista.</div>' : ""}`;
}
function polar(c) {
  const sv = $("polar"), R = c.R, r = c.res.ray; let pts = "";
  for (let k = 0; k < r.length; k++) { const a = k * 2 * Math.PI / r.length + 0; pts += (100 * r[k] / R * Math.cos(a)).toFixed(1) + "," + (-100 * r[k] / R * Math.sin(a)).toFixed(1) + " "; }
  sv.innerHTML = `<circle r="100" fill="none" stroke="var(--line)" stroke-dasharray="3 4"/><circle r="50" fill="none" stroke="var(--line)" stroke-width=".6"/>
    <polygon points="${pts}" fill="var(--probe)" fill-opacity=".28" stroke="var(--probe)" stroke-width="1.4" stroke-linejoin="round"/>
    <text x="0" y="-102" text-anchor="middle" font-size="9" fill="var(--muted)">E ▸ (rayos desde el este, sentido antihorario)</text>`;
  sv.hidden = false;
}
map.on("click", e => { if (tab === "explore") setProbe(e.latlng.lat, e.latlng.lng); });
probeMarker.on("drag", e => { if (raf) return; const p = e.latlng; raf = requestAnimationFrame(() => { raf = 0; setProbe(p.lat, p.lng); }); });
["p-r", "p-m"].forEach(id => $(id).oninput = () => {
  $("o-r").textContent = $("p-r").value + " m"; $("o-m").textContent = fmt(+$("p-m").value, 2) + " m"; $("margin-note").hidden = +$("p-m").value === 0;
  if (probeMarker.getLatLng && probeGroup.hasLayer(probeMarker)) { const p = probeMarker.getLatLng(); setProbe(p.lat, p.lng); }
});
function clearProbe() { probeGroup.removeLayer(probeMarker); probePoly.setLatLngs([]); probe = null; $("probe").innerHTML = '<p class="small" style="margin:0">Aún no hay punto. Haz clic en el mapa.</p>'; $("polar").hidden = true; writeHash(); }
$("b-clear").onclick = clearProbe;
document.addEventListener("keydown", e => { if (e.key === "Escape" && tab === "explore") clearProbe(); });
function pin(k) {
  if (!probe) { toast("Primero coloca un punto"); return; }
  pins[k] = { lat: probe.lat, lon: probe.lon, R: probe.R, mg: probe.mg, res: probe.res };
  pinPoly[k].setLatLngs(probe.res.pts.map(ll)); pinPoly[k].addTo(probeGroup); renderPins(); writeHash(); toast("Fijado como " + k);
}
$("b-pa").onclick = () => pin("A"); $("b-pb").onclick = () => pin("B");
function renderPins() {
  const row = (k, p) => p ? `<tr><td>${k}</td><td>${fmt(p.res.area)}</td><td>${fmt(p.res.aperture, 3)}</td><td>${fmt(p.res.mean, 1)}</td><td>${fmt(p.res.horizon * 100, 1)} %</td></tr>` : "";
  if (!pins.A && !pins.B) { $("pins").innerHTML = ""; return; }
  const d = pins.A && pins.B ? `<tr><td>B − A</td><td>${fmt(pins.B.res.area - pins.A.res.area)}</td><td>${fmt(pins.B.res.aperture - pins.A.res.aperture, 3)}</td><td>${fmt(pins.B.res.mean - pins.A.res.mean, 1)}</td><td>${fmt((pins.B.res.horizon - pins.A.res.horizon) * 100, 1)} pp</td></tr>` : "";
  $("pins").innerHTML = `<table class="pins"><thead><tr><th></th><th>Área m²</th><th>Apertura</th><th>Radio medio m</th><th>Horizonte</th></tr></thead><tbody>${row("A", pins.A)}${row("B", pins.B)}${d}</tbody></table>`;
}
$("b-csv").onclick = () => {
  const rows = [["punto", "lat", "lon", "radio_m", "margen_m", "area_m2", "apertura", "radio_medio_m", "horizonte_pct", "distancia_huella_m", "usa_huellas_osm"]];
  [["sonda", probe], ["A", pins.A], ["B", pins.B]].forEach(([k, p]) => { if (p) rows.push([k, p.lat.toFixed(6), p.lon.toFixed(6), p.R, p.mg, p.res.area.toFixed(1), p.res.aperture.toFixed(4), p.res.mean.toFixed(2), (p.res.horizon * 100).toFixed(1), p.res.clearance.toFixed(2), p.res.mixed ? "si" : "no"]); });
  if (rows.length === 1) { toast("No hay puntos que descargar"); return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + rows.map(r => r.join(",")).join("\n") + "\n"], { type: "text/csv" }));
  a.download = "isovistas_mva.csv"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$("b-link").onclick = () => { writeHash(); const u = location.href; (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => toast("Enlace copiado"), () => { prompt("Copia el enlace:", u); }); };
function writeHash() {
  const q = []; if (probeGroup.hasLayer(probeMarker)) { const p = probeMarker.getLatLng(); q.push("p=" + p.lat.toFixed(6) + "," + p.lng.toFixed(6), "r=" + $("p-r").value, "m=" + $("p-m").value); }
  ["A", "B"].forEach(k => { if (pins[k]) q.push(k + "=" + [pins[k].lat.toFixed(6), pins[k].lon.toFixed(6), pins[k].R, pins[k].mg].join(",")); });
  if (tab !== "explore") q.push("t=" + tab);
  safe(() => history.replaceState(null, "", q.length ? "#" + q.join("&") : location.pathname + location.search));
}
let toastT = 0;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 1800); }

// ---------- pilot observers (stored Phase 2A polygons)
function visibleIsos() {
  isoLayer.clearLayers(); const list = all ? OBS.map(o => o.id) : [sel];
  list.forEach(id => { const p = isoById[id]; p.setStyle({ fillOpacity: all ? .22 : .38, weight: id === sel ? 2.6 : 1.4 }); isoLayer.addLayer(p); });
  if (all && isoById[sel]) isoById[sel].bringToFront();
}
const mk = (l, v, u) => `<div class="m"><b>${v}</b><span>${l}${u ? ` (${u})` : ""}</span></div>`;
function renderDetail() {
  const o = OBS.find(x => x.id === sel);
  $("detail").innerHTML = `<h3>${o.id}</h3><div class="tag"><span class="dot" style="background:${col(o.context)}"></span> ${NAME[o.context]} · ${ROUTE[o.route] || o.route} · Fase 2A</div>
    <div class="metrics">${mk("Área visible", fmt(o.area), "m²")}${mk("Apertura visual", fmt(o.aperture, 3), "0–1")}${mk("Radio medio", fmt(o.mean_ray, 1), "m")}</div>
    <p class="small">Rayos que alcanzan 100 m: ${fmt(o.horizon * 100, 1)} %. Distancia a la huella más cercana: ${fmt(o.clearance, 2)} m. Con obstáculos +0,5 m el área cambia ${fmt(o.d_area_exp05, 1)} %; con +1,0 m, ${fmt(o.d_area_exp10, 1)} %.</p>` +
    (o.d_area_exp10 < -30 ? `<div class="frag"><b>Punto frágil:</b> a solo ${fmt(o.clearance, 2)} m de una huella, un margen de fachada de 1 m cierra gran parte de su vista.</div>` : "");
}
function renderChips() {
  [["open_plaza", "chips-plaza", "plaza"], ["narrow_street", "chips-calle", "calle"]].forEach(([ctx, el, cls]) => {
    const box = $(el); box.innerHTML = "";
    OBS.filter(o => o.context === ctx).forEach(o => {
      const b = document.createElement("button"); b.className = "chip " + cls; b.textContent = short(o.id);
      b.setAttribute("aria-pressed", String(o.id === sel)); b.setAttribute("aria-label", `Observador ${o.id}, ${NAME[ctx]}`); b.onclick = () => select(o.id); box.appendChild(b);
    });
  });
}
const maxA = Math.max(...OBS.map(o => o.area));
function renderBars() {
  const box = $("bars"); box.innerHTML = "";
  OBS.forEach(o => {
    const b = document.createElement("button"); b.className = "bar"; b.setAttribute("aria-pressed", String(o.id === sel)); b.setAttribute("aria-label", `${o.id}: ${fmt(o.area)} metros cuadrados`);
    b.innerHTML = `<span>${short(o.id)}</span><span class="t"><i style="width:${o.area / maxA * 100}%;background:${col(o.context)}"></i></span><span class="v">${fmt(o.area)} m²</span>`;
    b.onclick = () => select(o.id); box.appendChild(b);
  });
}
function select(id, fly = true) {
  sel = id; renderChips(); renderBars(); renderDetail(); visibleIsos();
  Object.entries(markerById).forEach(([k, m]) => m.setStyle({ radius: k === id ? 9 : 7, weight: k === id ? 3.5 : 2.5, fillColor: k === id ? col(OBS.find(o => o.id === k).context) : "#222a2e" }));
  if (fly && !all) map.flyToBounds(isoById[id].getBounds().pad(.35), { duration: .8, maxZoom: 19 });
}
function setMode(a) {
  all = a; $("m-one").setAttribute("aria-pressed", String(!a)); $("m-all").setAttribute("aria-pressed", String(a)); visibleIsos();
  if (a) map.flyToBounds(L.featureGroup(OBS.map(o => isoById[o.id])).getBounds().pad(.1), { duration: .8 });
  else map.flyToBounds(isoById[sel].getBounds().pad(.35), { duration: .8, maxZoom: 19 });
}
$("m-one").onclick = () => setMode(false); $("m-all").onclick = () => setMode(true);
function bind(id, layer) { $(id).onchange = e => { if (e.target.checked) layer.addTo(map); else map.removeLayer(layer); if (id === "t-obs") Object.values(markerById).forEach(m => m.bringToFront && m.bringToFront()); }; }
bind("t-bld", bld); bind("t-osm", osmLayer); bind("t-obs", obsLayer); bind("t-ring", ringLayer);
$("t-iso").onchange = e => { if (e.target.checked) isoLayer.addTo(map); else map.removeLayer(isoLayer); };
$("t-tile").onchange = e => { if (e.target.checked) tiles.addTo(map); else { map.removeLayer(tiles); $("nt").style.display = "none"; } };

// ---------- Step 0 layer
const F = Object.fromEntries(S0.fields.map((f, i) => [f, i]));
const SEQ_COL = ["#440154", "#3b528b", "#21908d", "#5dc863", "#fde725"], DIV_COL = ["#2b6cb0", "#8fb8de", "#f1efe9", "#f2b07a", "#c8561c"];
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function ramp(stops, t) { t = Math.max(0, Math.min(1, t)); const x = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = x - i, a = hex(stops[i]), b = hex(stops[i + 1]); return "rgb(" + a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(",") + ")"; }
const MODES = {
  mean_ray: { idx: F.mean_ray, stops: SEQ_COL, d: 1, u: " m", name: "Radio medio" },
  aperture: { idx: F.aperture, stops: SEQ_COL, d: 3, u: "", name: "Apertura" },
  resid_mean_ray: { idx: F.resid_mean_ray, stops: DIV_COL, d: 1, u: " m", name: "Residuo del radio medio", div: true },
  resid_aperture: { idx: F.resid_aperture, stops: DIV_COL, d: 3, u: "", name: "Residuo de la apertura", div: true }
};
Object.values(MODES).forEach(m => { const v = S0.points.map(p => p[m.idx]); m.lo = Math.min(...v); m.hi = Math.max(...v); if (m.div) { const a = Math.max(Math.abs(m.lo), Math.abs(m.hi)); m.lo = -a; m.hi = a; } });
let s0mode = "mean_ray";
const s0Layer = L.layerGroup();
const s0Marks = S0.points.map(p => {
  const m = L.circleMarker([p[F.lat], p[F.lon]], { renderer: canvas, radius: 5, weight: 1, color: "#fff", fillOpacity: .92, bubblingMouseEvents: false });
  m.bindTooltip(() => `Radio medio ${fmt(p[F.mean_ray], 1)} m (predicho ${fmt(p[F.pred_mean_ray], 1)}, residuo ${fmt(p[F.resid_mean_ray], 1)})<br>Apertura ${fmt(p[F.aperture], 3)} (predicha ${fmt(p[F.pred_aperture], 3)}, residuo ${fmt(p[F.resid_aperture], 3)})<br>Edificación a 20 m: ${fmt(p[F.built20] * 100)} %`, { sticky: true });
  s0Layer.addLayer(m); return m;
});
function paintS0() {
  const m = MODES[s0mode];
  s0Marks.forEach((mk, i) => mk.setStyle({ fillColor: ramp(m.stops, (S0.points[i][m.idx] - m.lo) / (m.hi - m.lo)) }));
  $("s0-ramp").style.background = "linear-gradient(90deg," + m.stops.join(",") + ")";
  $("s0-lo").textContent = fmt(m.lo, m.d) + m.u; $("s0-hi").textContent = fmt(m.hi, m.d) + m.u; legend();
}
document.querySelectorAll("input[name=s0]").forEach(r => r.onchange = e => { s0mode = e.target.value; paintS0(); });
function updateS0() { const on = tab === "step0" && $("t-s0").checked; if (on) s0Layer.addTo(map); else map.removeLayer(s0Layer); legend(); }
$("t-s0").onchange = updateS0;

// ---------- walk
let walk = null;
function initWalk() {
  if (walk) return;
  const SEQ = ["cand-016", "cand-015", "cand-002", "cand-001", "cand-022", "cand-023", "cand-024", "cand-025", "cand-026"], byId = Object.fromEntries(OBS.map(o => [o.id, o]));
  const W = SEQ.map(id => M.toXY(byId[id].lon, byId[id].lat)), cum = [0];
  for (let i = 1; i < W.length; i++) cum.push(cum[i - 1] + Math.hypot(W[i][0] - W[i - 1][0], W[i][1] - W[i - 1][1]));
  const LEN = cum[cum.length - 1], STEP = 2, samples = [];
  const posAt = d => { d = Math.max(0, Math.min(LEN, d)); let i = 1; while (i < cum.length - 1 && cum[i] < d) i++; const t = (d - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); return [W[i - 1][0] + (W[i][0] - W[i - 1][0]) * t, W[i - 1][1] + (W[i][1] - W[i - 1][1]) * t]; };
  const walkerPoly = L.polygon([], { renderer: canvas, weight: 2, fillOpacity: .34, interactive: false });
  const trail = L.polyline(SEQ.map(id => [byId[id].lat, byId[id].lon]), { renderer: canvas, weight: 2, dashArray: "2 6", opacity: .7, interactive: false });
  const walker = L.circleMarker([0, 0], { radius: 8, color: "#fff", weight: 3, fillOpacity: 1, interactive: false });
  const grp = L.layerGroup([trail, walkerPoly, walker]);
  const restyleW = () => { [walkerPoly, trail].forEach(x => x.setStyle({ color: css("--walk"), fillColor: css("--walk") })); walker.setStyle({ fillColor: css("--walk") }); };
  restyleW();
  const chart = $("wchart"); let amax = 1, amin = 0, active = false, playing = false, dist = 0, speed = 1, last = 0, rafW = 0, lastDraw = 0, ready = false;
  const drawChart = d => {
    const w = 320, h = 84, pad = 6, x = v => v / LEN * w, y = a => h - pad - (a - amin) / ((amax - amin) || 1) * (h - 2 * pad);
    const pl = samples.map((a, i) => x(i * STEP).toFixed(1) + "," + y(a).toFixed(1)).join(" ");
    chart.innerHTML = cum.map(c => `<line x1="${x(c).toFixed(1)}" x2="${x(c).toFixed(1)}" y1="0" y2="${h}" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join("") +
      `<polyline points="${pl}" fill="none" stroke="var(--ink)" stroke-width="1.6" vector-effect="non-scaling-stroke"/><line id="wcur" x1="${x(d)}" x2="${x(d)}" y1="0" y2="${h}" stroke="var(--walk)" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
  };
  const render = d => {
    dist = Math.max(0, Math.min(LEN, d)); const p = posAt(dist), r = M.isovist(ED, p[0], p[1]);
    walkerPoly.setLatLngs(r.pts.map(ll)); walker.setLatLng(ll(p));
    $("w-area").textContent = fmt(r.area); $("w-ap").textContent = fmt(r.aperture, 3); $("w-dist").textContent = fmt(dist);
    $("wslider").value = Math.round(dist / LEN * 1000); const c = $("wcur"); if (c) { const xx = dist / LEN * 320; c.setAttribute("x1", xx); c.setAttribute("x2", xx); }
  };
  const enter = () => { if (active || !ready) return; active = true; if (map.hasLayer(isoLayer)) map.removeLayer(isoLayer); grp.addTo(map); drawChart(dist); render(dist); map.fitBounds(trail.getBounds().pad(.35), { animate: true }); };
  const pause = () => { playing = false; cancelAnimationFrame(rafW); $("w-play").textContent = "▶ Caminar"; $("w-play").setAttribute("aria-pressed", "false"); };
  const exit = () => { pause(); if (!active) return; active = false; map.removeLayer(grp); if ($("t-iso").checked && tab === "explore") isoLayer.addTo(map); };
  const tick = ts => { if (!playing) return; const dt = Math.min(.1, (ts - last) / 1000); last = ts; const nd = dist + dt * 1.4 * speed; if (nd >= LEN) { render(LEN); pause(); return; } if (ts - lastDraw >= 33) { render(nd); lastDraw = ts; } else dist = nd; rafW = requestAnimationFrame(tick); };
  const play = () => { if (!ready) return; enter(); if (dist >= LEN) dist = 0; playing = true; $("w-play").textContent = "❚❚ Pausa"; $("w-play").setAttribute("aria-pressed", "true"); last = performance.now(); rafW = requestAnimationFrame(tick); };
  $("w-play").onclick = () => playing ? pause() : play(); $("w-exit").onclick = exit;
  $("w-speed").onclick = () => { const S = [1, 3, 8]; speed = S[(S.indexOf(speed) + 1) % S.length]; $("w-speed").textContent = "×" + speed; };
  $("wslider").oninput = e => { enter(); if (ready) render(e.target.value / 1000 * LEN); };
  chart.onclick = e => { if (!ready) return; const r = chart.getBoundingClientRect(); enter(); render((e.clientX - r.left) / r.width * LEN); };
  let d = 0; const t0 = performance.now();
  const chunk = () => { const t = performance.now(); while (d <= LEN && performance.now() - t < 14) { const p = posAt(d); samples.push(M.isovist(ED, p[0], p[1]).area); d += STEP; }
    $("w-status").textContent = d <= LEN ? "Calculando el perfil del recorrido… " + Math.round(Math.min(d, LEN) / LEN * 100) + " %" : "Perfil listo (" + samples.length + " isovistas en " + fmt((performance.now() - t0) / 1000, 1) + " s).";
    if (d <= LEN) requestAnimationFrame(chunk); else { amax = Math.max(...samples); amin = Math.min(...samples); ready = true; drawChart(0); } };
  chunk();
  walk = { exit, restyleW, LEN, samples: () => samples };
}

// ---------- tabs, legend, restyle
let tab = "explore";
const TABS = ["explore", "walk", "step0", "notes"];
function showTab(t, focus) {
  tab = t;
  TABS.forEach(k => { const on = k === t; $("tab-" + k).hidden = !on; const b = $("tb-" + k); b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
  if (t === "explore") { probeGroup.addTo(map); if ($("t-iso").checked) isoLayer.addTo(map); } else { map.removeLayer(probeGroup); }
  if (t === "walk") { initWalk(); if (map.hasLayer(isoLayer)) map.removeLayer(isoLayer); } else if (walk) walk.exit();
  if (t === "step0") { paintS0(); if (map.hasLayer(isoLayer)) map.removeLayer(isoLayer); }
  updateS0(); legend(); writeHash();
}
TABS.forEach((k, i) => { const b = $("tb-" + k); b.onclick = () => showTab(k); b.onkeydown = e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); showTab(TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length], true); } }; });
function legend() {
  const sw = (bg, bc) => `<span class="sw" style="background:${bg};border-color:${bc}"></span>`, items = [];
  if (tab === "explore") items.push(`<div>${sw(css("--probe") + "55", css("--probe"))}Isovista de la sonda</div>`, `<div>${sw(css("--plaza") + "55", css("--plaza"))}Isovista · plaza abierta (2A)</div>`, `<div>${sw(css("--calle") + "55", css("--calle"))}Isovista · calle estrecha (2A)</div>`);
  if (tab === "walk") items.push(`<div>${sw(css("--walk") + "55", css("--walk"))}Isovista del recorrido</div>`);
  if (tab === "step0") items.push(`<div><b>${MODES[s0mode].name}</b></div><div>${$("t-s0").checked ? "Cada punto: 1 de los 250 del cribado" : "Capa de puntos desactivada"}</div>`);
  items.push(`<div>${sw(css("--bld"), css("--bld-line"))}Huella del Ayuntamiento</div>`, `<div>${sw(css("--osm"), css("--osm-line"))}Huella de OpenStreetMap</div>`);
  $("legend").innerHTML = items.join("");
}
$("leg-btn").onclick = () => { const o = $("legend").classList.toggle("open"); $("leg-btn").setAttribute("aria-expanded", String(o)); $("leg-btn").setAttribute("aria-label", o ? "Ocultar leyenda" : "Mostrar leyenda"); };
function restyle() {
  bldPoly.setStyle({ color: css("--bld-line"), fillColor: css("--bld") });
  osmPoly.setStyle({ color: css("--osm-line"), fillColor: css("--osm") });
  probePoly.setStyle({ color: css("--probe"), fillColor: css("--probe") });
  pinPoly.A.setStyle({ color: css("--ink"), fillColor: css("--ink") }); pinPoly.B.setStyle({ color: css("--ink"), fillColor: css("--ink") });
  OBS.forEach(o => { isoById[o.id].setStyle({ color: col(o.context), fillColor: col(o.context) }); ringById[o.id].setStyle({ color: col(o.context) }); });
  Object.values(MODES).length && s0Marks.forEach(m => m.setStyle({ color: css("--panel") }));
  if (walk) walk.restyleW(); renderChips(); renderBars(); renderDetail(); select(sel, false); legend();
}
window.__ready = true; restyle();

// ---------- start (restore from URL if present)
function start() {
  map.invalidateSize();
  const q = Object.fromEntries((location.hash || "").slice(1).split("&").filter(Boolean).map(s => s.split("=")));
  if (q.r) { $("p-r").value = q.r; $("o-r").textContent = q.r + " m"; }
  if (q.m) { $("p-m").value = q.m; $("o-m").textContent = fmt(+q.m, 2) + " m"; $("margin-note").hidden = +q.m === 0; }
  ["A", "B"].forEach(k => { if (q[k]) { const [la, lo, r, m] = q[k].split(",").map(Number); const c = compute(la, lo, r, m); if (c.res) { pins[k] = c; pinPoly[k].setLatLngs(c.res.pts.map(ll)); pinPoly[k].addTo(probeGroup); } } });
  renderPins();
  if (q.p) { const [la, lo] = q.p.split(",").map(Number); map.setView([la, lo], 18); setProbe(la, lo); }
  else { select(OBS[0].id, false); map.fitBounds(isoById[OBS[0].id].getBounds().pad(.6), { animate: false }); }
  if (q.t && TABS.includes(q.t)) showTab(q.t); else showTab("explore");
}
map.setView([OBS[0].lat, OBS[0].lon], 18);
window.addEventListener("load", () => setTimeout(start, 50));
window.__mva = { select, setMode, map, setProbe, compute, showTab, state: () => ({ tab, probe, pins }) };
})();
