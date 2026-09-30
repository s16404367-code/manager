// Power-unit & gearbox component pool per car (career + quick). Wear raises failure risk; exceeding the
// season allocation earns grid penalties (10 places for the first extra element of a type, 5 after).
import { clamp } from '../sim/util.js';
export const COMP = { ICE: { name: 'Engine (ICE)', life: 16 }, TC: { name: 'Turbocharger', life: 15 }, ERS: { name: 'ERS / battery', life: 17 }, GB: { name: 'Gearbox', life: 11 } };
export const COMP_KEYS = Object.keys(COMP);
export function allowance(state, key) { const n = state.calendar?.length || 12; return key === 'GB' ? Math.max(2, Math.ceil(n / 4)) : Math.max(2, Math.ceil(n / 6)); }
export function ensurePC(team) {
  if (!Array.isArray(team.pc) || team.pc.length !== 2) team.pc = [0, 1].map(() => Object.fromEntries(COMP_KEYS.map((k) => [k, { wear: 0, used: 1, pens: 0 }])));
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
    if (k === 'ERS' && /ERS/.test(dnfText)) pc[k].wear = Math.max(pc[k].wear, 85);
    if (pc[k].wear >= 100) out.push(k);
  }
  return out; // components that must be replaced
}
export function fitNew(state, team, slot, key) {
  const pc = ensurePC(team)[slot][key]; const did = team.drivers[slot];
  pc.used++; pc.wear = 0; let pen = 0;
  if (pc.used > allowance(state, key)) { pen = pc.pens === 0 ? 10 : 5; pc.pens++; state.gridPenalties = { ...(state.gridPenalties || {}), [did]: ((state.gridPenalties || {})[did] || 0) + pen }; }
  return pen;
}
export function resetSeason(team) { team.pc = null; ensurePC(team); }
