// People systems (Round 11): contracts text, reserve driver, academy (scouting pool / sign / release / training),
// driver order swap, engineer–driver rapport and planned staff leave. Same rules for every team.
import { clamp } from '../sim/util.js';
import { RNG, hashStr } from '../sim/rng.js';

const pt = (s) => s.teams[s.player];
import { ledger, note } from './careerEngine.js';

// ---------- Contracts ----------
// contract.years = seasons left INCLUDING the current one → the deal ends when the season (year + years − 1) ends
export function contractEndYear(s, d) { return (s.year || 2027) + Math.max(0, (d.contract?.years || 1) - 1); }
export function contractText(s, d) { return d.contract?.years > 0 ? `until end of ${contractEndYear(s, d)} season` : 'expires this season'; }

// ---------- Academy ----------
export const ACADEMY_MAX = 4;
export const ACADEMY_FEE = 0.3e6; // per junior per season (charged when signing)
export const AC_TRAINING = {
  karting: { label: 'Racecraft camp', stats: ['craft', 'start'], cost: 0.15e6, races: 3, gain: 0.9 },
  sim: { label: 'Simulator programme', stats: ['pace', 'fb'], cost: 0.2e6, races: 3, gain: 0.8 },
  tyre: { label: 'Tyre & consistency school', stats: ['tyre', 'cons'], cost: 0.15e6, races: 3, gain: 0.9 },
  wet: { label: 'Wet-weather camp', stats: ['wet', 'cons'], cost: 0.12e6, races: 2, gain: 1.1 },
};
const FIRST = ['Luca', 'Mateo', 'Arvid', 'Rohan', 'Jules', 'Kai', 'Noah', 'Ilya', 'Tomás', 'Aarav', 'Leo', 'Yuki', 'Sami', 'Oskar', 'Diego', 'Finn'];
const LAST = ['Moretti', 'Lindqvist', 'Rao', 'Hartmann', 'Okafor', 'Duval', 'Sato', 'Kowalski', 'Ferreira', 'Brandt', 'Mehta', 'Novak', 'Castro', 'Ahn'];
const NATS = ['ITA', 'SWE', 'IND', 'GER', 'NGR', 'FRA', 'JPN', 'POL', 'BRA', 'AUT', 'GBR', 'ESP', 'USA', 'KOR'];
function genJunior(s, r, i) {
  const id = `drv_jr_${s.season}_${i}_${r.int(100, 999)}`; const base = r.range(58, 70); const st = () => Math.round(clamp(base + r.range(-7, 7), 45, 80));
  return { id, name: `${r.pick(FIRST)} ${r.pick(LAST)}`, nat: r.pick(NATS), age: r.int(16, 20), pace: st(), craft: st(), cons: st(), tyre: st(), wet: st(), fb: st(), start: st(), pot: r.int(72, 95),
    pers: r.pick(['aggressive', 'conservative', 'teamplayer', 'independent', 'technical']), morale: 70, confidence: 65, form: 0, contract: { years: 1, salary: 0 }, teamId: null, academy: true, acSigned: false, scouted: true };
}
export function ensureAcademy(s) {
  if (s._acInit) return;
  s._acInit = true; const r = new RNG(hashStr('ac' + s.season + (s.seed || 1)));
  const old = Object.values(s.drivers).filter((d) => d.academy && !d.retired);
  if (!old.some((d) => d.acSigned != null)) old.slice(0, 2).forEach((d) => { d.acSigned = true; }); // legacy juniors stay signed
  for (const d of old) if (d.acSigned == null) d.acSigned = false;
  for (let i = 0; i < 4; i++) { const j = genJunior(s, r, i); s.drivers[j.id] = j; }
}
export function refreshScouting(s) { for (const d of Object.values(s.drivers)) if (d.academy && !d.acSigned && d.scouted) delete s.drivers[d.id]; s._acInit = false; ensureAcademy(s); }
export const academyOf = (s) => Object.values(s.drivers).filter((d) => d.academy && d.acSigned && !d.retired);
export const academyPool = (s) => Object.values(s.drivers).filter((d) => d.academy && !d.acSigned && !d.retired);
export function academySign(s, did) {
  const d = s.drivers[did]; if (!d?.academy || d.acSigned) return { ok: false, msg: 'Not available' };
  if (academyOf(s).length >= ACADEMY_MAX) return { ok: false, msg: `The academy is full (${ACADEMY_MAX}). Release someone first.` };
  d.acSigned = true; d.rapport = 0; ledger(s, 'Drivers', -ACADEMY_FEE, `Academy place: ${d.name}`);
  return { ok: true, msg: `${d.name} joins the academy.` };
}
export function academyRelease(s, did) {
  const d = s.drivers[did]; if (!d?.acSigned) return { ok: false, msg: 'Not in the academy' };
  d.acSigned = false; d.acTrain = null; if (s.reserve === did) s.reserve = null;
  return { ok: true, msg: `${d.name} released from the academy.` };
}
export function academyReject(s, did) { const d = s.drivers[did]; if (!d || d.acSigned) return { ok: false, msg: 'Cannot reject' }; d.retired = true; d.rejected = true; return { ok: true, msg: `${d.name} removed from the scouting list.` }; }
export function academyTrain(s, did, k) {
  const d = s.drivers[did]; const T = AC_TRAINING[k]; if (!d?.acSigned || !T) return { ok: false, msg: 'Not possible' };
  if (d.acTrain) return { ok: false, msg: `${d.name} is already training.` };
  ledger(s, 'Drivers', -T.cost, `${T.label}: ${d.name}`); d.acTrain = { k, left: T.races };
  return { ok: true, msg: `${d.name} started ${T.label}.` };
}
// after each race: academy training + natural junior growth; rapport for every race driver of every team
export function peopleAfterRace(s) {
  for (const d of academyOf(s)) {
    const tr = d.acTrain; const coach = 1 + (d.rapport || 0) * 0.5;
    if (tr) { const T = AC_TRAINING[tr.k]; for (const k of T.stats) d[k] = clamp(Math.round((d[k] + T.gain * coach * (d[k] < d.pot ? 1 : 0.3)) * 10) / 10, 40, 99); tr.left--; if (tr.left <= 0) { note(s, 'good', `Academy: ${d.name} finished ${T.label}.`); d.acTrain = null; } }
    d.rapport = clamp((d.rapport || 0) + 0.02, 0, 1);
  }
  for (const t of Object.values(s.teams)) for (const did of t.drivers) {
    const d = s.drivers[did]; if (!d) continue;
    if (d._rapTeam !== t.id) { d._rapTeam = t.id; d.rapport = 0; }
    d.rapport = clamp((d.rapport || 0) + 0.04 * (1 - (d.rapport || 0) * 0.5), 0, 1);
    // a good relationship with the race engineer slowly sharpens feedback, consistency and tyre sense
    for (const k of ['fb', 'cons', 'tyre']) if (d[k] < (d.pot || 90)) d[k] = clamp(Math.round((d[k] + 0.12 * d.rapport) * 100) / 100, 40, 99);
  }
  if (s.reserve) { const d = s.drivers[s.reserve]; if (d) d.carFam = clamp((d.carFam ?? 0.2) + 0.01, 0, 0.9); }
}
export function rapportText(r = 0) { return r > 0.75 ? 'Excellent' : r > 0.5 ? 'Strong' : r > 0.25 ? 'Growing' : 'New'; }

// ---------- Reserve driver ----------
export const RESERVE_FEE = 0.4e6;
export function reserveCandidates(s) { return Object.values(s.drivers).filter((d) => !d.retired && ((d.academy && d.acSigned) || (!d.teamId && !d.academy)) && d.id !== s.reserve); }
export function signReserve(s, did) {
  const d = s.drivers[did]; if (!d) return { ok: false, msg: 'Unknown driver' };
  if (pt(s).drivers.includes(did)) return { ok: false, msg: 'Already a race driver' };
  s.reserve = did; d.reserveOf = s.player; ledger(s, 'Drivers', d.academy ? -0.1e6 : -RESERVE_FEE, `Reserve driver: ${d.name}`);
  return { ok: true, msg: `${d.name} is now the reserve driver. Reserves gain car familiarity in tests and on the simulator.` };
}
export function releaseReserve(s) { const d = s.drivers[s.reserve]; if (d) d.reserveOf = null; s.reserve = null; return { ok: true, msg: 'Reserve released.' }; }
export function swapReserve(s, slot) {
  const P = pt(s); const rid = s.reserve; const d = s.drivers[rid]; if (!d) return { ok: false, msg: 'No reserve driver' };
  if (s.weekend && s.weekend.phase && s.weekend.phase !== 'prep') return { ok: false, msg: 'Not during a race weekend — do it before practice.' };
  const out = P.drivers[slot]; const o = s.drivers[out];
  P.drivers[slot] = rid; d.teamId = P.id; d.academy = false; d.acSigned = false; d.contract = { years: Math.max(1, d.contract?.years || 1), salary: d.contract?.salary || 0.6e6 }; d.reserveOf = null;
  s.reserve = out; o.reserveOf = s.player; o.teamId = null;
  return { ok: true, msg: `${d.name} takes the race seat; ${o.name} becomes the reserve.` };
}

// ---------- Driver order (favourite first / left / top) ----------
export function swapDrivers(s, teamId = s.player) {
  const t = s.teams[teamId]; if (!t || t.drivers.length < 2) return { ok: false };
  t.drivers.reverse();
  if (Array.isArray(t.pc)) t.pc.reverse();
  if (Array.isArray(t.carMods)) t.carMods.reverse();
  for (const p of s.projects || []) if (p.slot === 0 || p.slot === 1) p.slot = 1 - p.slot;
  return { ok: true, msg: `${s.drivers[t.drivers[0]].name} is now shown first.` };
}
export function swapAcademy(s, a, b) { const ord = (s.acOrder ||= []); s.acOrder = [b, a, ...ord.filter((x) => x !== a && x !== b)]; }

// ---------- Planned staff leave ----------
// A department takes one week off: fatigue drops sharply, but its work (design / manufacturing) pauses that week.
export const LEAVE_DROP = 35;
export function planLeave(s, key, inWeeks = 1) {
  const d = pt(s).depts[key]; if (!d) return { ok: false, msg: 'Unknown department' };
  if (d.leave) return { ok: false, msg: 'Leave already planned.' };
  d.leave = { start: (s.week || 0) + Math.max(1, inWeeks), on: false };
  return { ok: true, msg: `Leave booked for week ${d.leave.start}: fatigue −${LEAVE_DROP}, the department's projects pause that week.` };
}
export function cancelLeave(s, key) { const d = pt(s).depts[key]; if (d?.leave && !d.leave.on) d.leave = null; return { ok: true, msg: 'Leave cancelled.' }; }
export const onLeave = (team, key) => !!team?.depts?.[key]?.leave?.on;
// called at the START of each simulated week for every team; AI books leave itself above 60 fatigue
export function leaveWeekStart(s, labelOf) {
  for (const t of Object.values(s.teams)) for (const [k, d] of Object.entries(t.depts)) {
    if (!t.isPlayer && !d.leave && d.fatigue > 60) d.leave = { start: s.week || 0, on: false };
    if (d.leave && !d.leave.on && (s.week || 0) >= d.leave.start) { d.leave.on = true; if (t.isPlayer) note(s, 'info', `🏖 ${labelOf(k)} is on leave this week — their projects pause, fatigue will drop.`); }
  }
}
export function leaveWeekEnd(s, labelOf) {
  for (const t of Object.values(s.teams)) for (const [k, d] of Object.entries(t.depts)) {
    if (!t.isPlayer && !d.leave) d.fatigue = clamp((d.fatigue ?? 20) + (s.week > 6 && s.week < 46 ? 1.2 : -2), 10, 100); // AI staff tire during the season
    if (d.leave?.on) { d.fatigue = clamp(d.fatigue - LEAVE_DROP, 5, 100); d.morale = clamp((d.morale || 60) + 4, 0, 100); if (d.head) { d.head.fatigue = d.fatigue; d.head.morale = d.morale; } d.leave = null; if (t.isPlayer) note(s, 'good', `${labelOf(k)} is back from leave (fatigue ${Math.round(d.fatigue)}).`); }
  }
}
export const aiLeaveFactor = (t) => 1 - Object.values(t.depts).filter((d) => d.leave?.on).length * 0.12;
