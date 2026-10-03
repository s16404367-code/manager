// Power-unit & gearbox component pool per car (career + quick). Wear raises failure risk; exceeding the
// season allocation earns grid penalties (10 places for the first extra element of a type, 5 after).
import { clamp } from '../sim/util.js';
// 2026 rules (re-checked): per driver per season ICE 4, turbo 4, exhaust 4, MGU-K 3, energy store 3, control electronics 3
// (base 3/3/3/2/2/2 + one extra each for the first year of the new PU). MGU-H is gone. There is NO season gearbox allocation
// in 2026 — a gearbox only costs money, but changing it under parc fermé (quali→race) means a pit-lane start.
export const COMP = { ICE: { name: 'Engine (ICE)', life: 16, pool: 4 }, TC: { name: 'Turbocharger', life: 15, pool: 4 }, EX: { name: 'Exhaust', life: 15, pool: 4 },
  MGUK: { name: 'MGU-K', life: 12, pool: 3 }, ES: { name: 'Energy store (battery)', life: 12, pool: 3 }, CE: { name: 'Control electronics', life: 11, pool: 3 },
  GB: { name: 'Gearbox (no season limit)', life: 11, pool: Infinity } };
export const COMP_KEYS = Object.keys(COMP);
export function allowance(state, key) { const n = state.calendar?.length || 12; const p = COMP[key]?.pool ?? 3; return p === Infinity ? Infinity : Math.max(2, Math.ceil(p * n / 24)); }
export function ensurePC(team) {
  if (!Array.isArray(team.pc) || team.pc.length !== 2) team.pc = [0, 1].map(() => ({}));
  for (const pc of team.pc) { // migrate old saves (ERS → MGU-K + ES + CE, add exhaust)
    if (pc.ERS) { for (const k of ['MGUK', 'ES', 'CE']) pc[k] ||= { ...pc.ERS }; delete pc.ERS; }
    for (const k of COMP_KEYS) pc[k] ||= { wear: 0, used: 1, pens: 0 };
  }
  return team.pc;
}
export function maxWear(team, slot) { const pc = ensurePC(team)[slot]; return Math.max(...COMP_KEYS.map((k) => pc[k].wear)); }
// Wear added by one race weekend (full-distance equivalent × raceLength-share)
export function wearRace(state, team, slot, t, share = 1, dnfText = '') {
  const pc = ensurePC(team)[slot]; const out = [];
  for (const k of COMP_KEYS) {
    pc[k].wear = clamp(pc[k].wear + COMP[k].life * (0.7 + 0.6 * t.eng) * (0.6 + 0.4 * share), 0, 100);
    if (k === 'ICE' && /Power unit/.test(dnfText)) pc[k].wear = 100;
    if (k === 'GB' && /Gearbox/.test(dnfText)) pc[k].wear = 100;
    if (['MGUK', 'ES', 'CE'].includes(k) && /ERS|electr|battery|MGU/i.test(dnfText)) pc[k].wear = Math.max(pc[k].wear, 85);
    if (pc[k].wear >= 100) out.push(k);
  }
  return out; // components that must be replaced
}
export function fitNew(state, team, slot, key) {
  const pc = ensurePC(team)[slot][key]; const did = team.drivers[slot];
  pc.used++; pc.wear = 0; let pen = 0;
  if (key === 'GB') { const wk = state.weekend; if (wk?.parcFerme && did && Array.isArray(wk.grid) && wk.grid.includes(did) && !wk.race) { wk.grid.splice(wk.grid.indexOf(did), 1); wk.grid.push(did); (wk.gridPens ||= {})[did] = 99; return 99; } if (wk?.parcFerme && did) { pen = 99; state.gridPenalties = { ...(state.gridPenalties || {}), [did]: ((state.gridPenalties || {})[did] || 0) + 99 }; } return pen; } // 99 = pit-lane start
  if (pc.used > allowance(state, key)) { pen = pc.pens === 0 ? 10 : 5; pc.pens++; state.gridPenalties = { ...(state.gridPenalties || {}), [did]: ((state.gridPenalties || {})[did] || 0) + pen }; }
  return pen;
}
export function resetSeason(team) { team.pc = null; ensurePC(team); }
