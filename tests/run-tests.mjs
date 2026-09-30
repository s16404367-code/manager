// Headless test suite (Node 18+): node tests/run-tests.mjs
// Covers: world creation, weekend pipeline, race invariants, strategy balance, AI balance, multi-season career stability, save round-trip.
import { createWorld } from '../js/engines/world.js';
import * as W from '../js/engines/weekendEngine.js';
import * as C from '../js/engines/careerEngine.js';
import { advance } from '../js/engines/raceEngine.js';
import { trackById, TRACKS } from '../js/data/tracks.js';
import { validate, migrate, repair } from '../js/state/persistence.js';
import { planOptions } from '../js/engines/strategyEngine.js';

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
const a = createWorld({ mode: 'quick', seed: 77, playerTeamId: 'tm_aurora', trackId: 'trk_hanasaki' });
const b = createWorld({ mode: 'quick', seed: 77, playerTeamId: 'tm_aurora', trackId: 'trk_hanasaki' });
runRace(a); runRace(b);
ok(JSON.stringify(a.weekend.result.rows.map((r) => r.did)) === JSON.stringify(b.weekend.result.rows.map((r) => r.did)), 'same seed → same result');

// 3. Strategy planner returns options with different stop counts
const s3 = createWorld({ mode: 'quick', seed: 5, playerTeamId: 'tm_papaya', trackId: 'trk_kestrel' });
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
const text = JSON.stringify({ state: career });
const loaded = repair(migrate(JSON.parse(text).state));
ok(!validate(loaded).length, 'save round-trip valid');

// Report
const summary = { pass, fail, failures: [...new Set(failures)].slice(0, 20), winners: winnerTeams, top5Strategies: stratTally, dnfRate: +(dnfs / cars).toFixed(3), neutralisationsPerRace: +(scs / TRACKS.length).toFixed(2), careerSeasons: career.history.seasons.map((s) => ({ season: s.season, pos: s.pos, pts: s.points, cash: Math.round(s.cash / 1e6) + 'M' })) };
if (JSONOUT) console.log(JSON.stringify(summary)); else console.log(summary);
if (career.gameOver) console.log('gameOver:', career.gameOver, 'cash', Math.round(career.teams[career.player].cash/1e6), 'board', career.board.confidence.toFixed(0));
process.exit(fail ? 1 : 0);
