// Shared track rendering + telemetry widgets (race, practice, qualifying).
import { trackPoints, lapProfile, sampleAt, trackPath } from '../data/tracks.js';

const SECTOR_COL = ['#ff3b5c', '#29b6ff', '#ffd23b'];
// Point on the circuit polyline at distance fraction d (0..1).
export function pointAt(pts, d) {
  const n = pts.length; const x = (((d % 1) + 1) % 1) * n; const i = Math.floor(x); const u = x - i;
  const a = pts[i % n], b = pts[(i + 1) % n];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}
function sub(pts, a, b) { const n = pts.length; const o = []; for (let i = Math.floor(a * n); i <= Math.ceil(b * n); i++) o.push(pts[i % n]); return 'M' + o.map((p) => p.map((v) => v.toFixed(2)).join(',')).join('L'); }

// Full circuit map with sector colouring, start line and a <g id="{id}-cars"> layer.
export function mapSvg(t, id = 'map', { sectors = true } = {}) {
  const pts = trackPoints(t); const s = pts[0], s2 = pts[2];
  const ang = Math.atan2(s2[1] - s[1], s2[0] - s[0]) + Math.PI / 2;
  const lx = Math.cos(ang) * 2.6, ly = Math.sin(ang) * 2.6;
  return `<svg viewBox="-3 -3 106 82" id="${id}" class="trackmap" aria-label="Map of ${t.name}">
    <defs><filter id="${id}-glow"><feGaussianBlur stdDeviation="0.9"/></filter></defs>
    <path d="${trackPath(t)}" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="6.5" stroke-linejoin="round" transform="translate(.6,.9)"/>
    <path d="${trackPath(t)}" fill="none" stroke="#1f2638" stroke-width="5" stroke-linejoin="round"/>
    ${sectors ? [0, 1, 2].map((k) => `<path d="${sub(pts, k / 3, (k + 1) / 3)}" fill="none" stroke="${SECTOR_COL[k]}" stroke-opacity=".75" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"/>`).join('') : `<path d="${trackPath(t)}" fill="none" stroke="#9aa5bb" stroke-width="1"/>`}
    <line x1="${s[0] - lx}" y1="${s[1] - ly}" x2="${s[0] + lx}" y2="${s[1] + ly}" stroke="#fff" stroke-width="1.1"/>
    <g id="${id}-cars"></g></svg>`;
}
export const sectorLegend = () => `<div class="row tiny muted" style="gap:.8rem">${SECTOR_COL.map((c, i) => `<span><span class="sw" style="background:${c}"></span>Sector ${i + 1}</span>`).join('')}<span>▏start/finish</span></div>`;

export function carDots(cars) {
  return cars.map((c) => `<g id="m_${c.id}" class="cdot"><circle r="${c.isPlayer ? 2.1 : 1.5}" fill="${c.color}" stroke="${c.isPlayer ? '#fff' : '#05070b'}" stroke-width="${c.isPlayer ? 0.6 : 0.35}"/>${c.isPlayer ? `<text y="-3" font-size="3" text-anchor="middle" fill="#fff" font-weight="800" paint-order="stroke" stroke="#000" stroke-width=".6">${c.tag}</text>` : ''}</g>`).join('');
}
export function placeCar(pts, id, d, hidden = false) {
  const g = document.getElementById('m_' + id); if (!g) return;
  if (hidden) { g.style.display = 'none'; return; } g.style.display = '';
  const [x, y] = pointAt(pts, d); g.setAttribute('transform', `translate(${x.toFixed(2)},${y.toFixed(2)})`);
}

// ---------- telemetry panel ----------
export function teleHtml(t, id = 'tele') {
  const prof = lapProfile(t); const W = 300, H = 70;
  const vmax = Math.max(...prof.v) * 3.6, vmin = Math.min(...prof.v) * 3.6;
  const pts = prof.v.map((v, i) => `${((i / prof.N) * W).toFixed(1)},${(H - 6 - ((v * 3.6 - vmin + 10) / (vmax - vmin + 20)) * (H - 12)).toFixed(1)}`).join(' ');
  const brk = prof.phase.map((p, i) => (p === 'brake' ? `<rect x="${((i / prof.N) * W).toFixed(1)}" y="${H - 4}" width="${(W / prof.N + 0.3).toFixed(2)}" height="4" fill="#ff3b5c"/>` : '')).join('');
  return `<div class="tele" id="${id}">
    <div class="tele-top"><div class="tele-who" id="${id}-who">—</div><span class="sp"></span>
      <div class="gauge"><b id="${id}-spd" class="mono">0</b><span>km/h</span></div><div class="gauge gear"><b id="${id}-gear" class="mono">N</b><span>gear</span></div></div>
    <div class="tele-bars"><div><span>THR</span><div class="tb"><i id="${id}-thr" style="background:#2ecc71"></i></div></div><div><span>BRK</span><div class="tb"><i id="${id}-brk" style="background:#ff3b5c"></i></div></div><div><span>DRS</span><div class="tb"><i id="${id}-drs" style="background:#4aa3ff"></i></div></div></div>
    <svg viewBox="0 0 ${W} ${H}" class="trace" preserveAspectRatio="none">
      <line x1="${W / 3}" x2="${W / 3}" y1="0" y2="${H}" stroke="#2a3346" stroke-dasharray="2 2"/><line x1="${(2 * W) / 3}" x2="${(2 * W) / 3}" y1="0" y2="${H}" stroke="#2a3346" stroke-dasharray="2 2"/>
      <polyline points="${pts}" fill="none" stroke="#4aa3ff" stroke-width="1.6" stroke-linejoin="round"/>${brk}
      <line id="${id}-cur" x1="0" x2="0" y1="0" y2="${H}" stroke="#fff" stroke-width="1.2"/>
      <text x="3" y="10" font-size="8" fill="#8d98ad">${Math.round(vmax)} km/h</text><text x="3" y="${H - 7}" font-size="8" fill="#8d98ad">${Math.round(vmin)}</text></svg>
    <div class="row tiny muted"><span>S1</span><span class="sp"></span><span>S2</span><span class="sp"></span><span>S3</span></div></div>`;
}
// f = lap time fraction; k = speed multiplier (e.g. out-lap slower); state: 'track'|'pit'|'garage'
export function updateTele(t, id, who, f, { k = 1, state = 'track', drs = false } = {}) {
  const $ = (x) => document.getElementById(id + '-' + x); if (!$('spd')) return;
  $('who').innerHTML = who;
  if (state !== 'track') { $('spd').textContent = state === 'pit' ? '80' : '0'; $('gear').textContent = state === 'pit' ? '2' : 'N'; $('thr').style.width = '0%'; $('brk').style.width = '0%'; $('drs').style.width = '0%'; return; }
  const prof = lapProfile(t); const s = sampleAt(prof, f);
  const v = s.v / k;
  $('spd').textContent = Math.round(v); $('gear').textContent = Math.max(1, Math.min(8, Math.ceil(v / 42)));
  $('thr').style.width = (k > 1.1 && s.throttle === 100 ? 70 : s.throttle) + '%'; $('brk').style.width = s.brake + '%';
  $('drs').style.width = drs && s.throttle === 100 && s.v > 250 ? '100%' : '0%';
  const c = $('cur'); const x = (s.d * 300).toFixed(1); c.setAttribute('x1', x); c.setAttribute('x2', x);
}
export { lapProfile, sampleAt };
