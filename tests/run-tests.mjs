// Headless test suite (Node 18+): node tests/run-tests.mjs
// Covers: world creation, weekend pipeline, race invariants, strategy balance, AI balance, multi-season career stability, save round-trip.
import { createWorld } from '../js/engines/world.js';
import * as W from '../js/engines/weekendEngine.js';
import * as C from '../js/engines/careerEngine.js';
import { advance } from '../js/engines/raceEngine.js';
import { trackById, TRACKS } from '../js/data/tracks.js';
import { validate, migrate, repair } from '../js/state/persistence.js';
import { planOptions } from '../js/engines/strategyEngine.js';
import * as SE from '../js/engines/sessionEngine.js';
import { lapProfile, sampleAt } from '../js/data/tracks.js';
import { SETUP_KEYS, setupOptimum, setupQuality, setupCharacter } from '../js/engines/carModel.js';

let pass = 0, fail = 0; const failures = [];
const ok = (cond, msg) => { if (cond) pass++; else { fail++; failures.push(msg); } };
const JSONOUT = process.argv.includes('--json');

function runRace(state, practice = true) {
  W.startWeekend(state);
  if (practice) for (let i = 0; i < state.weekend.practice.total; i++) W.runPractice(state, {});
  const pt = state.teams[state.player];
  for (const did of pt.drivers) state.weekend.setups[did] = W.engineerEstimate(state.weekend, did);
  for (let i = 0; i < 3; i++) W.runQualiSession(state, {});
  const race = W.buildRace(state); const t = trackById(state.weekend.trackId);
  let T = 0, guard = 0;
  while (!race.finished && guard++ < 100000) { T += 20; advance(race, T, t, {}); raceInvariants(race); }
  ok(race.finished, 'race finishes');
  W.classify(state);
  return race;
}
function raceInvariants(race) {
  const pos = race.cars.map((c) => c.pos).sort((a, b) => a - b);
  ok(pos.every((p, i) => p === i + 1), 'positions unique & contiguous');
  for (const c of race.cars) {
    ok(Number.isFinite(c.total) && Number.isFinite(c.lapEnd), `no NaN times (${c.id})`);
    ok(c.tyre.wear >= 0 && c.tyre.wear <= 100, 'tyre wear in range');
    ok(c.fuel >= 0, 'fuel non-negative');
    ok(c.lapsDone <= race.laps, 'laps within distance');
  }
}

// 1. Quick races on every track
const stratTally = {}; const winnerTeams = {}; let dnfs = 0, cars = 0, scs = 0;
for (const [i, tr] of TRACKS.entries()) {
  const s = createWorld({ mode: 'quick', seed: 1000 + i, playerTeamId: 'tm_verdant', trackId: tr.id });
  const race = runRace(s);
  const res = s.weekend.result;
  ok(res.rows.length === 20, 'classification has 20 rows');
  ok(res.rows.filter((r) => r.pts > 0).reduce((a, r) => a + r.pts, 0) <= 101, 'points total valid');
  winnerTeams[res.rows[0].teamId] = (winnerTeams[res.rows[0].teamId] || 0) + 1;
  for (const r of res.rows) { cars++; if (r.dnf) dnfs++; if (!r.dnf && r.pos <= 5) { const k = r.stints.length - 1 + '-stop'; stratTally[k] = (stratTally[k] || 0) + 1; } }
  scs += race.sc.count + race.sc.vscCount;
  ok(s.weekend.analysis.drivers.length === 2, 'analysis for both player drivers');
}
ok(Object.keys(stratTally).length >= 2, 'more than one strategy type succeeds (no single meta)');
ok(dnfs / cars < 0.25, `DNF rate reasonable (${(dnfs / cars * 100).toFixed(1)}%)`);

// 2. Determinism
const a = createWorld({ mode: 'quick', seed: 77, playerTeamId: 'tm_aurora', trackId: 'trk_suzuka' });
const b = createWorld({ mode: 'quick', seed: 77, playerTeamId: 'tm_aurora', trackId: 'trk_suzuka' });
runRace(a); runRace(b);
ok(JSON.stringify(a.weekend.result.rows.map((r) => r.did)) === JSON.stringify(b.weekend.result.rows.map((r) => r.did)), 'same seed → same result');

// 3. Strategy planner returns options with different stop counts
const s3 = createWorld({ mode: 'quick', seed: 5, playerTeamId: 'tm_papaya', trackId: 'trk_monza' });
W.startWeekend(s3);
const opts = planOptions(W.strategyContext(s3, s3.teams.tm_papaya.drivers[0]));
ok(opts.length >= 3, 'strategy options available');

// 4. Career: 3 seasons, auto-managed
const career = createWorld({ mode: 'career', seed: 2024, difficulty: 'standard', seasonLength: 8, raceLength: 0.25, custom: { name: 'Test GP', abbr: 'TST', color: '#ff0', color2: '#000', profile: 'midfield', philosophy: 'balanced', driverIds: ['drv_fa1', 'drv_fa3'] } });
ok(!validate(career).length, 'career world valid: ' + validate(career).join(','));
const aiPosHist = {};
for (let season = 1; season <= 3; season++) {
  for (let r = 0; r < career.calendar.length; r++) {
    if (career.gameOver) break;
    // auto-decisions: start a project if capacity, deploy ready ones, resolve events with option 0
    const tpl = ['prj_floor', 'prj_susp', 'prj_relpack', 'prj_ers'][r % 4];
    C.startProject(career, tpl, 'standard', 2);
    for (const p of career.projects.filter((p) => p.stage === 'ready')) C.deployProject(career, p.id);
    if (career.pendingEvent) C.resolveEvent(career, 0);
    runRace(career, true);
    C.applyRaceResult(career);
    const errs = validate(career);
    ok(!errs.length, `valid after S${season}R${r}: ${errs.join(',')}`);
  }
  if (career.gameOver) { ok(true, 'game over state reachable'); break; }
  ok(career.phase === 'review', 'season ends in review phase');
  for (const t of C.standings(career).teams) (aiPosHist[t.id] ||= []).push(t.pts);
  C.startNextSeason(career);
  ok(career.season === season + 1 && career.round === 0, 'season transition');
  ok(Object.values(career.teams).every((t) => t.drivers.length === 2 && t.drivers.every(Boolean)), 'all teams have 2 drivers after market');
}
// Save round trip
// ---- v3.1: real tracks, speed profiles, live sessions, 10-param setup ----
ok(TRACKS.length === 24, '24 calendar circuits');
for (const t of TRACKS) {
  const p = lapProfile(t);
  ok(p.N === 200 && p.v.every((v) => Number.isFinite(v) && v > 10 && v < 110), 'profile speeds sane ' + t.id);
  ok(p.tf.every((x, i) => i === 0 || x > p.tf[i - 1]), 'profile time monotonic ' + t.id);
  for (let f = 0; f < 1; f += 0.037) { const q = sampleAt(p, f); ok(q.d >= 0 && q.d < 1 && Number.isFinite(q.v) && q.gear >= 1 && q.gear <= 8, 'sampleAt ' + t.id); }
  const o = setupOptimum(t, { dragEff: 70, highAero: 70, lowAero: 70, traction: 70 }, null, { pers: 'aggressive' });
  ok(SETUP_KEYS.every((k) => o[k] >= 0 && o[k] <= 10), 'optimum in range ' + t.id);
  ok(Math.abs(setupQuality(o, o) - 1) < 1e-9, 'perfect setup = 1');
  ok(Object.values(setupCharacter(o)).every(Number.isFinite), 'character finite');
}
{
  const o1 = setupOptimum(trackById('trk_monza'), { dragEff: 70, highAero: 70, lowAero: 70, traction: 70 }, null, null);
  const o2 = setupOptimum(trackById('trk_monaco'), { dragEff: 70, highAero: 70, lowAero: 70, traction: 70 }, null, null);
  ok(o2.rearWing - o1.rearWing > 4, 'Monaco wants far more wing than Monza');
  const a = setupOptimum(trackById('trk_suzuka'), { dragEff: 70, highAero: 70, lowAero: 70, traction: 70 }, null, { pers: 'aggressive' });
  const c = setupOptimum(trackById('trk_suzuka'), { dragEff: 70, highAero: 70, lowAero: 70, traction: 70 }, null, { pers: 'conservative' });
  ok(a.frontWing > c.frontWing, 'aggressive driver prefers more front wing (oversteer)');
}
for (let i = 0; i < 6; i++) {
  const tr = TRACKS[(i * 5) % 24];
  const s = createWorld({ mode: 'quick', seed: 300 + i, playerTeamId: 'tm_verdant', trackId: tr.id });
  W.startWeekend(s);
  const sess = SE.createSession(s, 'practice'); const pt = s.teams[s.player];
  pt.drivers.forEach((d) => SE.sendOut(s, d, 4));
  SE.advanceSession(s, 400); SE.setupChanged(s, pt.drivers[0]);
  SE.simulateRest(s); ok(sess.done, 'practice session completes');
  ok(sess.cars.every((c) => c.st !== 'track'), 'no car left on track');
  SE.commitSession(s); ok(s.weekend.practice.done === 1 && !s.weekend.live, 'practice committed');
  for (let q = 0; q < 3; q++) { const qs = SE.createSession(s, 'quali'); ok(qs.cars.length === [20, 15, 10][q], 'quali entrants ' + q); SE.simulateRest(s); ok(qs.cars.some((c) => c.best < 1e8), 'times set'); ok(qs.clock < qs.len + 400, 'flag lap bounded'); SE.commitSession(s); }
  ok(s.weekend.grid.length === 20 && new Set(s.weekend.grid).size === 20, 'grid from live quali');
  ok(s.weekend.quali.results.every((r) => r.every((x) => Number.isFinite(x.time))), 'quali times finite');
  const js = JSON.parse(JSON.stringify(s)); ok(!validate(js).length, 'state valid after live sessions');
}
const text = JSON.stringify({ state: career });
const loaded = repair(migrate(JSON.parse(text).state));
ok(!validate(loaded).length, 'save round-trip valid');

// Report
const summary = { pass, fail, failures: [...new Set(failures)].slice(0, 20), winners: winnerTeams, top5Strategies: stratTally, dnfRate: +(dnfs / cars).toFixed(3), neutralisationsPerRace: +(scs / TRACKS.length).toFixed(2), careerSeasons: career.history.seasons.map((s) => ({ season: s.season, pos: s.pos, pts: s.points, cash: Math.round(s.cash / 1e6) + 'M' })) };
if (JSONOUT) console.log(JSON.stringify(summary)); else console.log(summary);
if (career.gameOver) console.log('gameOver:', career.gameOver, 'cash', Math.round(career.teams[career.player].cash/1e6), 'board', career.board.confidence.toFixed(0));
process.exit(fail ? 1 : 0);
