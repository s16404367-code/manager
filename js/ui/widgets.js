// Reusable UI widgets: charts (SVG), bars, tyre badges, help buttons.
import { esc } from './app.js';
import { COMPOUNDS } from '../engines/tyreEngine.js';
export const tyreBadge = (c, extra = '') => `<span class="tyre" style="border-color:${COMPOUNDS[c]?.color || '#888'};color:${COMPOUNDS[c]?.color || '#888'}" title="${COMPOUNDS[c]?.name || c}">${c}</span>${extra}`;
export const bar = (v, max = 100, color = null) => `<div class="bar"><i style="width:${Math.max(0, Math.min(100, (v / max) * 100))}%;${color ? 'background:' + color : ''}"></i></div>`;
export const helpBtn = (k) => `<button class="help" data-act="help" data-arg="${k}" aria-label="Help: ${k}">?</button>`;
export const pill = (t, k = '') => `<span class="pill ${k}">${esc(t)}</span>`;
export const sevColor = (v, good = 65, ok = 45) => (v >= good ? 'var(--good)' : v >= ok ? 'var(--warn)' : 'var(--bad)');

// Multi-series line chart. series: [{name,color,points:[y...],width}]
export function lineChart(series, { w = 600, h = 220, invert = false, yMin = null, yMax = null, xLabel = '', yLabel = '', steps = false } = {}) {
  const all = series.flatMap((s) => s.points.filter(Number.isFinite));
  if (!all.length) return '<div class="empty">No data yet.</div>';
  const mn = yMin ?? Math.min(...all), mx = yMax ?? Math.max(...all);
  const n = Math.max(...series.map((s) => s.points.length));
  const pad = { l: 34, r: 10, t: 10, b: 22 };
  const X = (i) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (w - pad.l - pad.r));
  const Y = (v) => { const t = mx === mn ? 0.5 : (v - mn) / (mx - mn); return pad.t + (invert ? t : 1 - t) * (h - pad.t - pad.b); };
  let grid = '';
  for (let i = 0; i <= 4; i++) { const v = mn + ((mx - mn) * i) / 4; const y = Y(v); grid += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y}" y2="${y}" stroke="#263045" stroke-width="1"/><text x="${pad.l - 4}" y="${y + 3}" fill="#8d98ad" font-size="10" text-anchor="end">${Math.round(v)}</text>`; }
  const lines = series.map((s) => { const pts = s.points.map((v, i) => (Number.isFinite(v) ? `${X(i).toFixed(1)},${Y(v).toFixed(1)}` : null)).filter(Boolean); return `<polyline fill="none" stroke="${s.color}" stroke-width="${s.width || 2}" stroke-linejoin="round" points="${pts.join(' ')}"><title>${esc(s.name)}</title></polyline>`; }).join('');
  const legend = series.length <= 12 ? `<div class="row small" style="gap:.8rem;margin-top:.3rem">${series.map((s) => `<span><span class="sw" style="background:${s.color}"></span>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(yLabel || 'chart')}" style="width:100%;height:auto">${grid}${lines}<text x="${w / 2}" y="${h - 4}" fill="#8d98ad" font-size="10" text-anchor="middle">${esc(xLabel)}</text></svg>${legend}`;
}
export function barChart(items, { w = 600, h = 200, fmt = (v) => v } = {}) {
  if (!items.length) return '<div class="empty">No data.</div>';
  const mx = Math.max(1, ...items.map((i) => Math.abs(i.v)));
  const bw = (w - 20) / items.length;
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto">${items.map((it, i) => { const bh = (Math.abs(it.v) / mx) * (h - 40); return `<rect x="${10 + i * bw + 2}" y="${h - 22 - bh}" width="${bw - 4}" height="${bh}" rx="3" fill="${it.color || '#4aa3ff'}"><title>${esc(it.label)}: ${fmt(it.v)}</title></rect><text x="${10 + i * bw + bw / 2}" y="${h - 8}" font-size="10" fill="#8d98ad" text-anchor="middle">${esc(it.label)}</text>`; }).join('')}</svg>`;
}
export const tabs = (key, items, cur) => `<div class="tabs" role="tablist">${items.map(([k, l]) => `<button role="tab" class="${cur === k ? 'on' : ''}" data-act="tab" data-arg="${key}:${k}">${l}</button>`).join('')}</div>`;
