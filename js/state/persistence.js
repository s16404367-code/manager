// Save system: versioned, validated, with migrations, backups, slot metadata and export/import.
import { SAVE_VERSION } from '../engines/world.js';
import { TRACKS } from '../data/tracks.js';
const KEY = 'f1tp3';
export const SLOTS = ['auto', 'slot1', 'slot2', 'slot3'];
const store = (() => { try { const t = '__t'; localStorage.setItem(t, t); localStorage.removeItem(t); return localStorage; } catch { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; } })();

export function validate(state) {
  const errs = [];
  if (!state || typeof state !== 'object') return ['State missing'];
  if (!state.teams || !state.drivers) errs.push('Missing teams/drivers');
  if (!Array.isArray(state.calendar) || !state.calendar.length) errs.push('Invalid calendar');
  if (!state.teams?.[state.player]) errs.push('Player team missing');
  for (const t of Object.values(state.teams || {})) {
    if (!Array.isArray(t.drivers) || t.drivers.length !== 2) errs.push(`${t.id}: driver lineup invalid`);
    for (const [k, v] of Object.entries(t.car || {})) if (!Number.isFinite(v)) errs.push(`${t.id}.car.${k} NaN`);
    if (!Number.isFinite(t.points)) errs.push(`${t.id}: points NaN`);
    if (t.isPlayer && !Number.isFinite(t.cash)) errs.push('Cash NaN');
  }
  const seen = new Set();
  for (const t of Object.values(state.teams || {})) for (const d of t.drivers || []) { if (seen.has(d)) errs.push(`Driver ${d} in two teams`); seen.add(d); if (!state.drivers?.[d]) errs.push(`Driver ${d} missing`); }
  if (state.round < 0 || state.round > (state.calendar?.length || 0)) errs.push('Round out of range');
  return errs;
}
// Repair common issues instead of failing.
export function repair(state) {
  for (const t of Object.values(state.teams)) {
    for (const k of Object.keys(t.car)) if (!Number.isFinite(t.car[k])) t.car[k] = 65;
    if (!Number.isFinite(t.points)) t.points = 0;
    if (t.isPlayer && !Number.isFinite(t.cash)) t.cash = 0;
    t.carMods ||= [{}, {}];
  }
  return state;
}
export function migrate(data) {
  let s = data;
  if (!s.version) s.version = 1;
  if (s.version < 2) { s.news ||= []; s.version = 2; }
  if (s.version < 3) { s.achievements ||= {}; s.history ||= { seasons: [] }; s.version = 3; }
  if (s.version < 4) {
    // v3.1: real 2026 calendar + 10-parameter setup. Remap unknown circuits, drop an in-progress weekend.
    const ids = TRACKS.map((t) => t.id);
    if (Array.isArray(s.calendar)) s.calendar = s.calendar.map((id, i) => (ids.includes(id) ? id : ids[Math.floor((i * ids.length) / s.calendar.length)]));
    if (s.weekend && (!ids.includes(s.weekend.trackId) || !('toe' in (Object.values(s.weekend.setups || {})[0] || { toe: 1 })))) s.weekend = null;
    s.version = 4;
  }
  return s;
}
function strip(state) {
  // Live race state is transient and heavy: store it only if mid-race (resumable) but trim logs.
  const copy = JSON.parse(JSON.stringify(state));
  if (copy.weekend?.race) { copy.weekend.race.log = copy.weekend.race.log.slice(-80); copy.weekend.race.radio = copy.weekend.race.radio.slice(-30); }
  return copy;
}
export function save(state, slot = 'auto') {
  if (state.ironman && slot !== 'auto') return { ok: false, msg: 'Ironman: manual slots disabled.' };
  const errs = validate(state);
  if (errs.length) { console.warn('Save validation', errs); repair(state); }
  const payload = JSON.stringify({ v: SAVE_VERSION, at: Date.now(), state: strip(state) });
  try {
    const prev = store.getItem(`${KEY}:${slot}`);
    if (prev) store.setItem(`${KEY}:${slot}:bak`, prev);
    store.setItem(`${KEY}:${slot}`, payload);
    return { ok: true };
  } catch (e) { return { ok: false, msg: 'Storage full or unavailable: ' + e.message }; }
}
export function load(slot = 'auto') {
  for (const key of [`${KEY}:${slot}`, `${KEY}:${slot}:bak`]) {
    const raw = store.getItem(key); if (!raw) continue;
    try { const d = JSON.parse(raw); const s = repair(migrate(d.state)); if (!validate(s).length) return { ok: true, state: s, fromBackup: key.endsWith(':bak') }; } catch (e) { console.warn('Corrupt save', key, e); }
  }
  return { ok: false };
}
export function meta(slot) {
  const raw = store.getItem(`${KEY}:${slot}`); if (!raw) return null;
  try { const d = JSON.parse(raw); const s = d.state; const t = s.teams[s.player]; return { at: d.at, mode: s.mode, team: t.name, color: t.color, season: s.season, round: s.round, total: s.calendar.length, diff: s.difficulty }; } catch { return { corrupt: true }; }
}
export function remove(slot) { store.removeItem(`${KEY}:${slot}`); store.removeItem(`${KEY}:${slot}:bak`); }
export function exportJSON(state) { return JSON.stringify({ v: SAVE_VERSION, at: Date.now(), state: strip(state) }, null, 0); }
export function importJSON(text) { const d = JSON.parse(text); const s = repair(migrate(d.state || d)); const e = validate(s); if (e.length) throw new Error(e.join('; ')); return s; }
export function loadSettings() { try { return { ...DEFAULT_SETTINGS, ...JSON.parse(store.getItem(`${KEY}:settings`) || '{}') }; } catch { return { ...DEFAULT_SETTINGS }; } }
export function saveSettings(s) { store.setItem(`${KEY}:settings`, JSON.stringify(s)); }
export const DEFAULT_SETTINGS = { speed: 'normal', autoPause: true, pauseOn: { sc: true, rain: true, dry: true, cliff: true, failure: true, damage: true, orders: true, fuel: true }, reduceMotion: false, textScale: 1, highContrast: false, units: 'metric', showTutorial: true, debug: false, autosave: true, colorblind: false };
