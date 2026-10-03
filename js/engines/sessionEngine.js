// Live practice & qualifying sessions: every car runs out-laps, flying laps and in-laps on a session clock.
// Pure logic (no DOM). The UI advances the clock; results are committed into the weekend in the same format
// as the instant engines (runPractice / runQualiSession) so everything downstream is unchanged.
import { RNG } from '../sim/rng.js';
import { clamp } from '../sim/util.js';
import { trackById, lapProfile } from '../data/tracks.js';
import { effectiveCar, trackScore, carDeficitSec, setupQuality, setupEffects, DRIVER_W, boostGain, aiBoost } from './carModel.js';
import { COMPOUNDS, wetPenalty, tyrePaceLoss, wearPerLap, bestFor } from './tyreEngine.js';
import { lapProfile as lapProf } from '../data/tracks.js';
import { aiSetupQ, applyProgram, commitQuali, PRACTICE_PROGRAMS, gainKnow, knowOf, AI_KNOW } from './weekendEngine.js';
import { maxWear, ensurePC, COMP } from './components.js';

export const Q_LEN = [720, 600, 480];
export const FP_LEN = 3600; // 60 min per practice session (FP1-FP3)
export const SETUP_CHANGE_S = 30;
const OUT_K = 1.35, IN_K = 1.3, COOL_K = 1.18;

function carBase(state, did, wet, tyre) {
  const wk = state.weekend; const t = trackById(wk.trackId); const d = state.drivers[did]; const team = state.teams[d.teamId];
  const slot = team.drivers.indexOf(did); const car = effectiveCar(team, slot);
  const perf = carDeficitSec(trackScore(car, t).score, t);
  const rng = new RNG((wk.seed ^ (did.length * 7919 + slot * 31 + d.name.charCodeAt(0))) >>> 0);
  const sq = team.isPlayer ? setupQuality(wk.setups[did], wk.opt[did]) : aiSetupQ(team, rng);
  const fx = team.isPlayer ? setupEffects(wk.setups[did], wk.opt[did], t) : { topSpeed: 0, mistakeMult: 1 };
  const lt = t.baseLap - (knowOf(state, did) - AI_KNOW) * 0.3 + perf + (100 - d.pace) * DRIVER_W + (1 - sq) * 0.9 - (wk.qualiPrep[did] || 0) + wetPenalty(tyre, wet) + wet * 6 + wet * (100 - d.wet) * 0.04 - fx.topSpeed * t.drag * 2 + 0.16 - 0.45;
  return { lt, sq, fx };
}

export function createSession(state, kind) {
  const wk = state.weekend; const t = trackById(wk.trackId);
  const idx = kind === 'quali' ? wk.quali.session : wk.practice.done;
  const rng = new RNG((wk.seed + (kind === 'quali' ? 9001 : 5003) * (idx + 1)) >>> 0);
  const wet = kind === 'quali' ? clamp(wk.qWet + rng.normal(0, 0.05) * (wk.qWet > 0 ? 1 : 0), 0, 1) : clamp((wk.days?.[0]?.wet ?? wk.weather.wet[0] * 0.7) + (wk.days?.[0]?.wet ? rng.normal(0, 0.06) : 0), 0, 1);
  const dryTyre = wet > 0.6 ? 'W' : wet > 0.16 ? 'I' : 'S';
  const day = wk.days?.[kind === 'quali' ? 1 : 0];
  if (kind === 'quali') wk.parcFerme = true; // setup frozen from the start of qualifying until the race (parc fermé)
  const sess = { kind, idx, trackTemp: day?.track ?? wk.weather.trackTemp, air: day?.air ?? wk.weather.airTemp, wind: day?.wind ?? 10, len: kind === 'quali' ? Q_LEN[idx] : FP_LEN, clock: 0, wet, flag: false, done: false, rngState: rng.s ?? null, seed: rng.next() * 1e9 >>> 0, cars: [], log: [], bestS: [1e9, 1e9, 1e9], best: 1e9, lapNo: 0 };
  for (const team of Object.values(state.teams)) {
    team.drivers.forEach((did) => {
      if (kind === 'quali' && wk.quali.eliminated.includes(did)) return;
      const d = state.drivers[did];
      const plan = kind === 'quali' ? (wk.quali.plans?.[did] || {}) : {};
      const tyre = team.isPlayer ? (plan.tyre && (wet > 0.16) === !!COMPOUNDS[plan.tyre].wet ? plan.tyre : (wk.qualiTyre && kind === 'quali' && (wet > 0.16) === !!COMPOUNDS[wk.qualiTyre].wet ? wk.qualiTyre : dryTyre)) : (kind === 'practice' && wet < 0.16 ? rng.pick(['S', 'M', 'M', 'H']) : dryTyre);
      sess.cars.push({
        did, teamId: team.id, isPlayer: !!team.isPlayer, color: team.color, short: d.name.split(' ').slice(-1)[0], name: d.name,
        st: 'garage', until: team.isPlayer ? 1e9 : rng.range(15, sess.len * (kind === 'quali' ? 0.45 : 0.3)),
        lapStart: 0, lapLen: t.baseLap, kind: 'out', tyre, push: plan.push || (team.aiStyle === 'aggressive' ? 'max' : 'normal'), boost: team.isPlayer ? (plan.boost || 'balanced') : aiBoost(team, rng),
        prog: 'setup', plannedPush: kind === 'quali' ? 2 : 6, pushLeft: 0, boxReq: false, runs: 0, runPush: 0,
        newSet: kind === 'quali', setId: null, aiWear: 0, laps: [], best: 1e9, bestS: [1e9, 1e9, 1e9], lastS: [null, null, null], sColor: ['', '', ''], cur: null, deleted: 0,
      });
    });
  }
  wk.live = sess;
  return sess;
}

// Tyre sets: pick a new set, or the most-used set of that compound that still has grip
export function pickSet(state, did, c, wantNew) {
  const sets = (state.weekend.sets?.[did] || []).filter((x) => x.c === c); if (!sets.length) return null;
  const fresh = sets.filter((x) => x.laps === 0); const used = sets.filter((x) => x.laps > 0 && x.wear < 70).sort((a, b) => b.wear - a.wear);
  return wantNew ? (fresh[0] || used[used.length - 1] || sets[0]) : (used[0] || fresh[0] || sets.sort((a, b) => a.wear - b.wear)[0]);
}
function setOf(state, c) { return c.setId ? state.weekend.sets?.[c.did]?.find((x) => x.id === c.setId) : null; }
export function setGrip(state, c) { const set = setOf(state, c); return Math.round(100 - (set ? set.wear : c.aiWear || 0)); }
export function setLaps(state, c) { const set = setOf(state, c); return set ? set.laps : c.aiLaps || 0; }
export function setsSummary(state, did) {
  const out = {}; for (const x of state.weekend.sets?.[did] || []) { const o = (out[x.c] ||= { total: 0, fresh: 0, used: [] }); o.total++; if (x.laps === 0) o.fresh++; else o.used.push(x); }
  return out;
}
const rngOf = (sess) => { const r = new RNG((sess.seed + sess.lapNo * 2654435761) >>> 0); sess.lapNo++; return r; };

function startLap(state, sess, c, kind) {
  const t = trackById(state.weekend.trackId); const rng = rngOf(sess);
  const d = state.drivers[c.did];
  const { lt, fx } = carBase(state, c.did, sess.wet, c.tyre);
  const evo = t.evo * 0.55 * (sess.clock / sess.len) + (sess.kind === 'quali' ? sess.idx * t.evo * 0.12 : 0);
  const fuel = sess.kind === 'practice' ? (c.prog === 'longrun' ? 1.6 : c.prog === 'aero' ? 0.5 : 0.8) : 0;
  const set = setOf(state, c); const wearNow = set ? set.wear : c.aiWear;
  const tyreAge = tyrePaceLoss({ c: c.tyre, wear: wearNow, age: set ? set.laps : c.runPush + 1 }, sess.trackTemp) + (kind === 'push' && wearNow < 3 && sess.kind === 'quali' ? -0.12 : 0);
  const pushK = sess.kind === 'quali' ? { safe: 0.08, normal: 0, max: -0.12 }[c.push] : 0.25;
  const team0 = state.teams[c.teamId]; const boostK = sess.kind === 'quali' && kind === 'push' ? boostGain(c.boost, effectiveCar(team0, team0.drivers.indexOf(c.did)), d, t) : 0;
  let time = lt - evo + fuel + tyreAge + pushK + boostK + rng.normal(0, 0.06 + (100 - d.cons) * 0.005);
  const notes = [];
  if (kind === 'push') {
    const near = sess.cars.filter((o) => o !== c && o.st === 'track' && (((sess.clock - o.lapStart) / o.lapLen) < 0.05 || ((sess.clock - o.lapStart) / o.lapLen) > 0.95)).length;
    if (near && rng.chance(0.12 + t.traffic * 0.15 * near)) { time += rng.range(0.25, 0.9); notes.push('traffic'); }
    const mP = { safe: 0.03, normal: 0.06, max: 0.13 }[c.push] * (1 + sess.wet) * (1 + (100 - d.cons) / 60) * (fx.mistakeMult || 1);
    if (rng.chance(mP)) { time += rng.range(0.5, 2); notes.push('mistake'); }
    if (rng.chance(0.03 + (c.push === 'max' ? 0.03 : 0) + t.kerb * 0.02)) notes.push('deleted');
    // Slipstream / dirty air: a car 1–3% of a lap ahead gives a tow on the straights; closer than that = dirty air in corners
    const prof = lapProf(t); const ft = prof.fullThrottle || 0.6;
    const gaps = sess.cars.filter((o) => o !== c && o.st === 'track').map((o) => ((sess.clock - o.lapStart) / o.lapLen));
    if (gaps.some((g) => g > 0.008 && g < 0.03) && rng.chance(0.4)) { time -= ft * rng.range(0.12, 0.35) * (0.6 + t.drag * 0.6); notes.push('tow'); }
    else if (gaps.some((g) => g >= 0 && g <= 0.008) && rng.chance(0.5)) { time += (1 - ft) * t.df * rng.range(0.15, 0.4); notes.push('dirty air'); }
  }
  // reliability: a failure can strike mid-lap (ERS/battery, engine, hydraulics, gearbox)
  const team = state.teams[c.teamId]; const car = effectiveCar(team, team.drivers.indexOf(c.did));
  const wearF = team.isPlayer ? 1 + maxWear(team, team.drivers.indexOf(c.did)) / 70 : 1;
  const failP = 0.0045 * Math.pow(clamp(1.25 - car.reliability / 100, 0.1, 1), 1.3) * wearF * (0.7 + 0.6 * t.eng) * (state.weekend.relBurn?.[c.did] ? 0.85 : 1);
  let fail = null;
  if (rng.chance(failP)) { const ty = rng.pick([['ERS', 'ERS / battery fault'], ['ICE', 'Engine (ICE) issue'], ['HYD', 'Hydraulic leak'], ['GB', 'Gearbox problem']]); fail = { at: rng.range(0.15, 0.9), key: ty[0], text: ty[1], repair: sess.kind === 'quali' ? rng.range(200, 700) : rng.range(420, 1300) }; }
  const lapLen = kind === 'push' ? time : time * (kind === 'out' ? OUT_K : kind === 'in' ? IN_K : COOL_K);
  // Split into sectors via the speed profile, with a little per-sector noise
  const prof = lapProfile(t); const f1 = prof.sectorTf[0], f2 = prof.sectorTf[1];
  const w = [f1, f2 - f1, 1 - f2].map((x) => x * (1 + rng.normal(0, 0.006)));
  const sw = w[0] + w[1] + w[2]; const s = w.map((x) => (x / sw) * lapLen);
  c.st = 'track'; c.kind = kind; c.lapStart = sess.clock; c.lapLen = lapLen; c.cur = { time: lapLen, s, notes, kind, fail };
  if (fail) c.lapLen = lapLen * fail.at;
  c.lastS = [null, null, null]; c.sColor = ['', '', ''];
}

function finishLap(state, sess, c, lines) {
  const cur = c.cur; const t = trackById(state.weekend.trackId);
  if (cur.fail) {
    const f = cur.fail; c.st = 'garage'; c.cur = null; c.runPush = 0; c.pushLeft = 0; c.boxReq = false; c.go = false;
    c.busyUntil = sess.clock + f.repair; c.until = c.isPlayer ? 1e9 : c.busyUntil + 30; c.fails = (c.fails || 0) + 1;
    const team = state.teams[c.teamId];
    if (team.isPlayer && COMP[f.key]) { const pc = ensurePC(team)[team.drivers.indexOf(c.did)][f.key]; pc.wear = Math.min(100, pc.wear + 10); }
    const missing = c.busyUntil > sess.len;
    sess.log.push({ t: sess.clock, text: `⚠️ ${c.name} stops on track — ${f.text}. ${missing ? 'Repair will take beyond the end of the session.' : `Repair ~${Math.round(f.repair / 60)} min.`}`, sev: 'bad', pl: c.isPlayer });
    return;
  }
  if (c.isPlayer && sess.kind === 'practice') gainKnow(state, c.did, cur.kind === 'push' ? 1 : 0.4);
  if (c.isPlayer && sess.kind === 'quali') gainKnow(state, c.did, 0.3);
  { const set = setOf(state, c); const team = state.teams[c.teamId]; const d = state.drivers[c.did];
    const w = wearPerLap({ c: c.tyre, track: t, car: effectiveCar(team, team.drivers.indexOf(c.did)), driver: d, mode: cur.kind === 'push' ? 'push' : 'conserve', wetness: sess.wet, trackTemp: sess.trackTemp, scale: 1 });
    if (set) { set.wear = Math.min(100, set.wear + w); set.laps++; } else { c.aiWear = Math.min(100, c.aiWear + w); c.aiLaps = (c.aiLaps || 0) + 1; }
    if (c.isPlayer && cur.kind === 'push') (state.weekend.runLog[c.did] ||= []).push({ s: `${sess.kind === 'quali' ? ['Q1', 'Q2', 'Q3'][sess.idx] : 'FP' + (sess.idx + 1)}`, run: c.runs + 1, c: c.tyre, set: set?.id, grip: Math.round(100 - (set ? set.wear : 0)), time: +cur.time.toFixed(3), del: cur.notes.includes('deleted'), notes: cur.notes.filter((n) => n !== 'deleted'), wet: +sess.wet.toFixed(2), temp: sess.trackTemp, wind: sess.wind, prog: sess.kind === 'practice' ? c.prog : 'quali', fuel: sess.kind === 'practice' ? (c.prog === 'longrun' ? 'high' : c.prog === 'qualisim' ? 'low' : 'medium') : 'low', setup: { ...state.weekend.setups[c.did] } });
  }
  if (cur.kind === 'push') {
    c.runPush++; c.pushLeft--;
    const deleted = cur.notes.includes('deleted');
    c.laps.push({ time: cur.time, s: cur.s, deleted, notes: cur.notes, at: sess.clock, tyre: c.tyre });
    if (deleted) { c.deleted++; sess.log.push({ t: sess.clock, text: `${c.name}: lap ${fmt(cur.time)} deleted (track limits)`, sev: 'warn', pl: c.isPlayer }); }
    else {
      const pb = cur.time < c.best; const ob = cur.time < sess.best;
      if (pb) { c.best = cur.time; }
      if (ob) { sess.best = cur.time; sess.log.push({ t: sess.clock, text: `${c.name} goes fastest: ${fmt(cur.time)}`, sev: 'purple', pl: c.isPlayer }); }
      else if (pb && c.isPlayer) sess.log.push({ t: sess.clock, text: `${c.name} improves: ${fmt(cur.time)}${cur.notes.length ? ' (' + cur.notes.join(', ') + ')' : ''}`, sev: 'good', pl: true });
      cur.s.forEach((x, i) => { if (x < c.bestS[i]) c.bestS[i] = x; if (x < sess.bestS[i]) sess.bestS[i] = x; });
    }
    if (cur.notes.includes('mistake') && c.isPlayer) sess.log.push({ t: sess.clock, text: `${c.name}: "Sorry, lost it on that lap."`, sev: 'bad', pl: true });
  }
  // what next?
  const flagged = sess.clock >= sess.len;
  if (cur.kind === 'in' || (flagged && cur.kind !== 'push' && cur.kind !== 'out')) return toGarage(state, sess, c, lines);
  if (flagged) { return toGarage(state, sess, c, lines, true); }
  if (c.boxReq || c.pushLeft <= 0) { c.boxReq = false; return startLap(state, sess, c, 'in'); }
  if (sess.kind === 'quali' && c.runPush >= 1 && cur.kind === 'push' && c.pushLeft > 0) return startLap(state, sess, c, 'cool');
  return startLap(state, sess, c, 'push');
}

function toGarage(state, sess, c, lines, chequered = false) {
  c.st = sess.clock >= sess.len ? 'done' : 'garage'; c.cur = null;
  if (sess.kind === 'practice' && c.isPlayer && c.runPush > 0) {
    const rng = rngOf(sess);
    const out = applyProgram(state, c.did, c.prog, rng, clamp(c.runPush / 12, 0.1, 0.8) * 0.6);
    out.forEach((l) => { lines.push(l); sess.log.push({ t: sess.clock, text: '🔧 ' + l.text, sev: 'info', pl: true }); });
  }
  c.runPush = 0; c.runs++;
  if (!c.isPlayer && c.st === 'garage') {
    const rng = rngOf(sess);
    c.until = sess.clock + (sess.kind === 'quali' ? rng.range(40, 140) : rng.range(90, 360));
    // in quali AI wants a final run near the end
    if (sess.kind === 'quali' && c.runs >= 1) c.until = Math.max(c.until, sess.len - rng.range(110, 170));
    if (sess.kind === 'quali' && c.runs >= 2) c.until = 1e9;
  }
  if (chequered && c.isPlayer) sess.log.push({ t: sess.clock, text: `${c.name} takes the chequered flag.`, sev: 'muted', pl: true });
}

export function sendOut(state, did, pushLaps = null) {
  const sess = state.weekend.live; const c = sess?.cars.find((x) => x.did === did);
  if (!c || c.st !== 'garage' || sess.clock >= sess.len) return false;
  c.until = Math.max(sess.clock, c.until === 1e9 ? sess.clock : c.until);
  if (pushLaps) c.plannedPush = pushLaps;
  c.go = true; return true;
}
export function boxThisLap(state, did) { const c = state.weekend.live?.cars.find((x) => x.did === did); if (c && c.st === 'track') c.boxReq = true; }
export function setCarOpt(state, did, patch) {
  const sess = state.weekend.live; const c = sess?.cars.find((x) => x.did === did); if (!c) return;
  if (patch.tyre && c.st === 'track') return; // tyres only change in the garage
  Object.assign(c, patch);
}
// Called by the UI after a setup change: garage time penalty.
export function setupChanged(state, did) {
  const sess = state.weekend.live; if (sess?.kind === 'quali') return false; const c = sess?.cars.find((x) => x.did === did); if (!c || c.st !== 'garage') return false;
  c.until = Math.max(c.until === 1e9 ? sess.clock : c.until, sess.clock) + SETUP_CHANGE_S; c.go = false; c.busyUntil = c.until;
  return true;
}

// Advance the session clock to `target` seconds. Returns lines produced by practice programmes.
export function advanceSession(state, target) {
  const sess = state.weekend.live; if (!sess || sess.done) return [];
  const lines = []; const step = 0.5;
  let guard = 0;
  while (sess.clock < target && !sess.done && guard++ < 1e6) {
    sess.clock = Math.min(target, sess.clock + step);
    if (!sess.flag && sess.clock >= sess.len) { sess.flag = true; sess.log.push({ t: sess.len, text: '🏁 Chequered flag — laps already started may be completed.', sev: 'info' }); }
    for (const c of sess.cars) {
      if (c.st === 'garage' && !sess.flag) {
        const ready = c.isPlayer ? c.go && sess.clock >= (c.busyUntil || 0) : sess.clock >= c.until && sess.clock >= (c.busyUntil || 0);
        if (ready) {
          c.go = false; c.pushLeft = c.isPlayer ? c.plannedPush : sess.kind === 'quali' ? (rngOf(sess).chance(0.35) ? 2 : 1) : Math.round(rngOf(sess).range(3, 9));
          if (!c.isPlayer && sess.kind === 'practice') c.prog = 'setup';
          if (c.isPlayer) c.setId = pickSet(state, c.did, c.tyre, c.newSet)?.id || null; else { c.aiWear = sess.kind === 'quali' || rngOf(sess).chance(0.5) ? 0 : 15; c.aiLaps = c.aiWear ? 3 : 0; }
          startLap(state, sess, c, 'out');
        }
      } else if (c.st === 'garage' && sess.flag) c.st = 'done';
      if (c.st === 'track' && sess.clock >= c.lapStart + c.lapLen) {
        const over = sess.clock - (c.lapStart + c.lapLen);
        sess.clock -= over; finishLap(state, sess, c, lines); sess.clock += over;
      }
    }
    if (sess.flag && sess.cars.every((c) => c.st !== 'track')) sess.done = true;
  }
  if (lines.length) (sess.lines ||= []).push(...lines);
  return lines;
}
// Run to the end (auto-pilot for the player: engineers run sensible programmes).
export function simulateRest(state) {
  const sess = state.weekend.live; if (!sess) return;
  for (const c of sess.cars) if (c.isPlayer && c.st === 'garage' && !sess.flag) {
    c.plannedPush = sess.kind === 'quali' ? 2 : 8; c.go = true;
  }
  let g = 0;
  while (!sess.done && g++ < 10000) {
    advanceSession(state, sess.clock + 10);
    for (const c of sess.cars) if (c.isPlayer && c.st === 'garage' && !sess.flag && c.runs < (sess.kind === 'quali' ? 2 : 3)) { c.go = true; c.busyUntil = Math.max(c.busyUntil || 0, sess.clock + 45); }
  }
}
export function ranking(sess) {
  return sess.cars.slice().sort((a, b) => a.best - b.best || a.did.localeCompare(b.did));
}
// Commit a finished live session into the weekend (same format as the instant engines).
export function commitSession(state) {
  const wk = state.weekend; const sess = wk.live; if (!sess) return;
  if (!sess.done) simulateRest(state);
  if (sess.kind === 'quali') {
    const t = trackById(wk.trackId);
    const out = ranking(sess).map((c) => ({ did: c.did, teamId: c.teamId, time: (c.best < 1e8) ? c.best : t.baseLap + 4 + c.did.length * 0.001, notes: [...new Set(c.laps.flatMap((l) => l.notes))].map((n) => n === 'deleted' ? 'lap deleted for track limits' : n === 'traffic' ? 'caught in traffic' : n === 'tow' ? 'got a tow' : n === 'dirty air' ? 'lost time in dirty air' : 'mistake on push lap') }));
    commitQuali(state, out, sess.wet);
  } else {
    wk.practice.done++;
    const lines = sess.lines || [];
    const pos = ranking(sess);
    const mine = pos.filter((c) => c.isPlayer).map((c) => `${c.name} P${pos.indexOf(c) + 1} (${(c.best < 1e8) ? fmt(c.best) : 'no time'}, ${c.laps.length} flying laps)`);
    wk.practice.reports.push({ session: wk.practice.done, lines: [{ did: null, prog: 'summary', text: `Timesheet: ${mine.join(' · ')}` }, ...lines] });
  }
  wk.live = null;
}
export const fmt = (s) => { if (!(Number.isFinite(s) && s < 1e8)) return '--'; const m = Math.floor(s / 60); const r = s - m * 60; return `${m}:${r.toFixed(3).padStart(6, '0')}`; };
export { PRACTICE_PROGRAMS };
