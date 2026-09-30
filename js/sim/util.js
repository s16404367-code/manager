export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const round = (v, d = 0) => { const m = 10 ** d; return Math.round(v * m) / m; };
export const sum = (a) => a.reduce((s, x) => s + x, 0);
export const avg = (a) => (a.length ? sum(a) / a.length : 0);
export const safe = (v, f = 0) => (Number.isFinite(v) ? v : f);
export const money = (m) => { const a = Math.abs(m); const s = m < 0 ? '-' : ''; return a >= 1e6 ? `${s}$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${s}$${(a / 1e3).toFixed(0)}k` : `${s}$${a.toFixed(0)}`; };
export const fmtTime = (t) => { if (!Number.isFinite(t)) return '--'; const m = Math.floor(t / 60); const s = t - m * 60; return m > 0 ? `${m}:${s.toFixed(3).padStart(6, '0')}` : s.toFixed(3); };
export const fmtGap = (g) => (Number.isFinite(g) ? `+${g.toFixed(1)}` : '--');
export const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 9)}`;
export const deepClone = (o) => JSON.parse(JSON.stringify(o));
export const band = (v, unc) => `${Math.round(v - unc)}–${Math.round(v + unc)}`;
// Uncertain display: returns a qualitative word to avoid false precision.
export const qual = (v) => (v >= 85 ? 'Elite' : v >= 72 ? 'Strong' : v >= 58 ? 'Good' : v >= 45 ? 'Average' : v >= 32 ? 'Weak' : 'Poor');
