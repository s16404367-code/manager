// Live practice & qualifying sessions: every car runs out-laps, flying laps and in-laps on a session clock.
// Pure logic (no DOM). The UI advances the clock; results are committed into the weekend in the same format
// as the instant engines (runPractice / runQualiSession) so everything downstream is unchanged.
import { RNG } from '../sim/rng.js';
import { clamp } from '../sim/util.js';
import { trackById, lapProfile } from '../data/tracks.js';
import { effectiveCar, trackScore, carDeficitSec, setupQuality, setupEffects } from './carModel.js';
import { COMPOUNDS, wetPenalty } from './tyreEngine.js';
import { aiSetupQ, applyProgram, commitQuali, PRACTICE_PROGRAMS, gainKnow, knowOf, AI_KNOW } from './weekendEngine.js';
import { maxWear, ensurePC, COMP } from './components.js';

export const Q_LEN = [720, 600, 480];
export const FP_LEN = 1800; // 30 min of session clock per practice session (compressed)
export const SETUP_CHANGE_S = 30;
const OUT_K = 1.35, IN_K = 1.3, COOL_K = 1.18;

function carBase(state, did, wet, tyre) {
  const wk = state.weekend; const t = trackById(wk.trackId); const d = state.drivers[did]; const team = state.teams[d.teamId];
  const slot = team.drivers.indexOf(did); const car = effectiveCar(team, slot);
  const perf = carDeficitSec(trackScore(car, t).score, t);
  const rng = new RNG((wk.seed ^ (did.length * 7919 + slot * 31 + d.name.charCodeAt(0))) >>> 0);
  const sq = team.isPlayer ? setupQuality(wk.setups[did], wk.opt[did]) : aiSetupQ(team, rng);
  const fx = team.isPlayer ? setupEffects(wk.setups[did], wk.opt[did], t) : { topSpeed: 0, mistakeMult: 1 };
  const lt = t.baseLap - (knowOf(state, did) - AI_KNOW) * 0.3 + perf + (100 - d.pace) * 0.035 + (1 - sq) * 0.9 - (wk.qualiPrep[did] || 0) + wetPenalty(tyre, wet) + wet * 6 + wet * (100 - d.wet) * 0.04 - fx.topSpeed * t.drag * 2 + 0.16 - 0.45 + (COMPOUNDS[tyre]?.off || 0);
  return { lt, sq, fx };
}

export function createSession(state, kind) {
  const wk = state.weekend; const t = trackById(wk.trackId);
  const idx = kind === 'quali' ? wk.quali.session : wk.practice.done;
  const rng = new RNG((wk.seed + (kind === 'quali' ? 9001 : 5003) * (idx + 1)) >>> 0);
  const wet = kind === 'quali' ? clamp(wk.qWet + rng.normal(0, 0.05) * (wk.qWet > 0 ? 1 : 0), 0, 1) : clamp(wk.weather.wet[0] * 0.7, 0, 1);
  const dryTyre = wet > 0.6 ? 'W' : wet > 0.16 ? 'I' : 'S';
  const sess = { kind, idx, len: kind === 'quali' ? Q_LEN[idx] : FP_LEN, clock: 0, wet, flag: false, done: false, rngState: rng.s ?? null, seed: rng.next() * 1e9 >>> 0, cars: [], log: [], bestS: [1e9, 1e9, 1e9], best: 1e9, lapNo: 0 };
  for (const team of Object.values(state.teams)) {
    team.drivers.forEach((did) => {
      if (kind === 'quali' && wk.quali.eliminated.includes(did)) return;
      const d = state.drivers[did];
      const plan = kind === 'quali' ? (wk.quali.plans?.[did] || {}) : {};
      const tyre = team.isPlayer ? (plan.tyre && (wet > 0.16) === !!COMPOUNDS[plan.tyre].wet ? plan.tyre : dryTyre) : (kind === 'practice' && wet < 0.16 ? rng.pick(['S', 'M', 'M', 'H']) : dryTyre);
      sess.cars.push({
        did, teamId: team.id, isPlayer: !!team.isPlayer, color: team.color, short: d.name.split(' ').slice(-1)[0], name: d.name,
        st: 'garage', until: team.isPlayer ? 1e9 : rng.range(15, sess.len * (kind === 'quali' ? 0.45 : 0.3)),
        lapStart: 0, lapLen: t.baseLap, kind: 'out', tyre, push: plan.push || (team.aiStyle === 'aggressive' ? 'max' : 'normal'),
        prog: 'setup', plannedPush: kind === 'quali' ? 2 : 6, pushLeft: 0, boxReq: false, runs: 0, runPush: 0,
        laps: [], best: 1e9, bestS: [1e9, 1e9, 1e9], lastS: [null, null, null], sColor: ['', '', ''], cur: null, deleted: 0,
      });
    });
  }
  wk.live = sess;
  return sess;
}

const rngOf = (sess) => { const r = new RNG((sess.seed + sess.lapNo * 2654435761) >>> 0); sess.lapNo++; return r; };

function startLap(state, sess, c, kind) {
  const t = trackById(state.weekend.trackId); const rng = rngOf(sess);
  const d = state.drivers[c.did];
  const { lt, fx } = carBase(state, c.did, sess.wet, c.tyre);
  const evo = t.evo * 0.55 * (sess.clock / sess.len) + (sess.kind === 'quali' ? sess.idx * t.evo * 0.12 : 0);
  const fuel = sess.kind === 'practice' ? (c.prog === 'longrun' ? 1.6 : c.prog === 'qualisim' ? 0.1 : 0.8) : 0;
  const tyreAge = sess.kind === 'practice' ? Math.max(0, c.runPush - 1) * (COMPOUNDS[c.tyre].wear * 0.02) : c.runPush > 1 ? 0.18 : 0;
  const pushK = sess.kind === 'quali' ? { safe: 0.08, normal: 0, max: -0.12 }[c.push] : 0.25;
  let time = lt - evo + fuel + tyreAge + pushK + rng.normal(0, 0.06 + (100 - d.cons) * 0.005);
  const notes = [];
  if (kind === 'push') {
    const near = sess.cars.filter((o) => o !== c && o.st === 'track' && (((sess.clock - o.lapStart) / o.lapLen) < 0.05 || ((sess.clock - o.lapStart) / o.lapLen) > 0.95)).length;
    if (near && rng.chance(0.12 + t.traffic * 0.15 * near)) { time += rng.range(0.25, 0.9); notes.push('traffic'); }
    const mP = { safe: 0.03, normal: 0.06, max: 0.13 }[c.push] * (1 + sess.wet) * (1 + (100 - d.cons) / 60) * (fx.mistakeMult || 1);
    if (rng.chance(mP)) { time += rng.range(0.5, 2); notes.push('mistake'); }
    if (rng.chance(0.03 + (c.push === 'max' ? 0.03 : 0) + t.kerb * 0.02)) notes.push('deleted');
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
    const out = applyProgram(state, c.did, c.prog, rng, clamp(c.runPush / 12, 0.1, 0.8));
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
  const sess = state.weekend.live; const c = sess?.cars.find((x) => x.did === did); if (!c || c.st !== 'garage') return false;
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
    const out = ranking(sess).map((c) => ({ did: c.did, teamId: c.teamId, time: (c.best < 1e8) ? c.best : t.baseLap + 4 + c.did.length * 0.001, notes: [...new Set(c.laps.flatMap((l) => l.notes))].map((n) => n === 'deleted' ? 'lap deleted for track limits' : n === 'traffic' ? 'caught in traffic' : 'mistake on push lap') }));
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
