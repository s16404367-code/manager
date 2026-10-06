// Race weekend orchestration: preparation, practice, qualifying, strategy, race creation, classification.
import { RNG, hashStr } from '../sim/rng.js';
import { clamp, avg } from '../sim/util.js';
import { trackById, monthFor, climateAir, lapProfile } from '../data/tracks.js';
import { PERSONALITIES } from '../data/drivers.js';
import { effectiveCar, trackScore, carDeficitSec, setupOptimum, setupQuality, setupEffects, defaultSetup, SETUP_KEYS, SETUP_LABEL, AI_FX, DRIVER_W, boostGain, aiBoost, BOOST_MODES } from './carModel.js';
import { generateWeather, forecast } from './weatherEngine.js';
import { planOptions, labelPlans, clonePlan } from './strategyEngine.js';
import { wearPerLap, COMPOUNDS, wetPenalty, ALLOCATION, tyrePaceLoss } from './tyreEngine.js';
import { createRace } from './raceEngine.js';
import { maxWear, ensurePC } from './components.js';
import { deptQ, facLvl, pitCrew, forecastAccuracy, DIFFICULTY, teamDrivers, POINTS } from './world.js';

export function startWeekend(state) {
  const trackId = state.calendar[state.round];
  const t = trackById(trackId);
  const seed = (state.seed ^ hashStr(trackId + state.season + ':' + state.round)) >>> 0;
  const rng = new RNG(seed);
  const laps = Math.max(8, Math.round(t.laps * state.raceLength));
  const scale = clamp(t.laps / laps, 1, 4);
  const weather = generateWeather(t, laps, rng, state.forceWeather ?? null);
  // Climate: temperatures follow the venue's typical weather for the month the race is held in (random day-to-day spread)
  const month = monthFor(state, state.round); const airMean = climateAir(t, month);
  weather.airTemp = Math.round(airMean + rng.normal(0, 3)); weather.trackTemp = Math.round(weather.airTemp + rng.range(6, 18) * (weather.wet[0] > 0.15 ? 0.35 : 1));
  const qWet = rng.chance(t.wx * 0.3) ? rng.range(0.15, 0.8) : 0;
  const pt = state.teams[state.player];
  const diff = DIFFICULTY[state.difficulty];
  const acc = forecastAccuracy(pt, diff);
  const wk = {
    trackId, round: state.round, seed, laps, scale, weather, qWet, phase: 'prep', forecastAcc: acc,
    forecast: forecast(weather, laps, acc, rng.fork(3)), qForecast: Math.round(clamp(acc * (qWet > 0 ? 1 : 0) + (1 - acc) * rng.next(), 0, 1) * 100),
    opt: {}, noise: {}, setups: {}, knowledge: {}, tyreKnow: 0.15 + facLvl(pt, 'simulator') * 0.05, qualiPrep: {}, relBurn: {},
    know: {}, raceDeg: 1, practice: { done: 0, total: state.mode === 'quick' ? 1 : 3, reports: [] },
    quali: { session: 0, results: [], eliminated: [], plans: {} }, grid: null, strategy: {}, fuel: {}, race: null, result: null,
  };
  for (const team of Object.values(state.teams)) {
    team.drivers.forEach((did, slot) => {
      const car = effectiveCar(team, slot);
      wk.opt[did] = setupOptimum(t, car, rng, state.drivers[did]);
      if (team.isPlayer) {
        wk.noise[did] = Object.fromEntries(SETUP_KEYS.map((k) => [k, rng.normal(0, 1)]));
        const simB = facLvl(team, 'simulator') * 0.06 + deptQ(team, 'vd') * 0.002;
        wk.knowledge[did] = Object.fromEntries(SETUP_KEYS.map((k) => [k, clamp(0.1 + simB + (state.setupPenalty || 0) + ((team.carKnow ?? 0.3) - 0.3) * 0.3, 0, 0.9)]));
        wk.setups[did] = defaultSetup();
        wk.qualiPrep[did] = 0;
      }
    });
  }
  // Race-day tyre behaviour can differ from Friday: temperature swing, track rubbering, wind, rain washing rubber away.
  // Three different days: Friday (practice), Saturday (qualifying), Sunday (race)
  const dayT = (d) => Math.round(airMean + rng.normal(0, 3) + d);
  const fpWet = rng.chance(t.wx * 0.3) ? rng.range(0.15, 0.75) : 0;
  const friAir = dayT(-1), satAir = dayT(0);
  wk.days = [
    { day: 'Friday', what: 'Practice', wet: fpWet, air: friAir, track: friAir + Math.round(rng.range(6, 14) * (fpWet ? 0.4 : 1)), wind: Math.round(rng.range(3, 25)) },
    { day: 'Saturday', what: 'Qualifying', wet: qWet, air: satAir, track: satAir + Math.round(rng.range(6, 14) * (qWet ? 0.4 : 1)), wind: Math.round(rng.range(3, 25)) },
    { day: 'Sunday', what: 'Race', wet: weather.wet[0], rainLater: Math.max(...weather.wet), air: weather.airTemp, track: weather.trackTemp, wind: Math.round(rng.range(3, 25)) },
  ];
  const rainy = weather.wet.some((w) => w > 0.12);
  wk.raceDeg = clamp(1 + rng.normal(0, 0.11) + (weather.trackTemp - wk.days[0].track) * 0.006 + (weather.trackTemp - 35) * 0.002 + (rainy ? rng.range(-0.08, 0.1) : 0), 0.78, 1.3);
  for (const did of pt.drivers) { wk.know[did] = clamp(0.2 + facLvl(pt, 'simulator') * 0.04 + (state.drivers[did].age > 27 ? 0.08 : 0) + ((state.drivers[did].carFam ?? 0.3) - 0.3) * 0.35 + (state.drivers[did].rapport || 0) * 0.08, 0, 0.72); /* testing days raise driver familiarity */ ensurePC(pt); }
  wk.month = month;
  // Tyre sets (real-life style allocation) and run log for the player's drivers
  wk.sets = {}; wk.runLog = {}; wk.condKnow = {}; wk.condBias = {};
  const condSpread = clamp(wk.days[0].wind / 30 + Math.abs(wk.days[2].track - wk.days[0].track) / 12 + (Math.abs(wk.days[0].wet - wk.days[2].wet) > 0.15 ? 0.6 : 0), 0.15, 1.6);
  wk.condSpread = condSpread;
  for (const did of pt.drivers) {
    let n = 0; wk.sets[did] = Object.entries(ALLOCATION).flatMap(([c, k]) => Array.from({ length: k }, () => ({ id: c + (++n), c, wear: 0, laps: 0 })));
    wk.runLog[did] = []; wk.condKnow[did] = 0;
    wk.condBias[did] = Object.fromEntries(SETUP_KEYS.map((k) => [k, rng.normal(0, 1) * condSpread]));
  }
  state.setupPenalty = 0;
  state.weekend = wk;
  return wk;
}

export function estimateReliability(wk, did) {
  const k = wk.knowledge[did]; const kk = Object.values(k).reduce((a, b) => a + b, 0) / Object.values(k).length;
  const cond = (wk.condSpread || 0) * (1 - (wk.condKnow?.[did] || 0));
  const score = clamp(kk - cond * 0.25, 0, 1);
  const why = [];
  if (kk < 0.5) why.push('few laps / limited setup data');
  if (wk.days?.[0]?.wind > 18) why.push(`gusty wind on Friday (${wk.days[0].wind} km/h)`);
  if (wk.days && Math.abs(wk.days[2].track - wk.days[0].track) > 5) why.push(`Sunday track ${wk.days[2].track > wk.days[0].track ? 'hotter' : 'cooler'} than Friday (${wk.days[0].track}° → ${wk.days[2].track}°)`);
  if (wk.days && Math.abs(wk.days[0].wet - wk.days[2].wet) > 0.15) why.push('different weather Friday vs Sunday');
  if ((wk.condKnow?.[did] || 0) > 0.5) why.push('conditions correlation done ✓');
  return { score, label: score > 0.75 ? 'Reliable' : score > 0.5 ? 'Fair' : 'Unreliable', why };
}
export function engineerEstimate(wk, did) {
  const o = wk.opt[did], n = wk.noise[did], k = wk.knowledge[did];
  const cb = wk.condBias?.[did]; const ck = wk.condKnow?.[did] || 0;
  return Object.fromEntries(SETUP_KEYS.map((key) => [key, clamp(Math.round((o[key] + n[key] * (1 - k[key]) * 3.2 + (cb ? cb[key] * (1 - ck) : 0)) * 2) / 2, 0, 10)]));
}

// Simplified to four programmes (v4): each bundles the old specialist runs.
export const PRACTICE_PROGRAMS = {
  setup: { label: '🔧 Setup & quali runs', desc: 'Converge on the setup and do low-fuel laps. Raises engineer confidence in the setup and adds a little quali pace.' },
  longrun: { label: '🛞 Race runs (all compounds)', desc: 'Heavy-fuel stints on each compound. Learns degradation → better strategy & tyre estimates.' },
  aero: { label: '🌬️ Aero & conditions test', desc: 'Measures new parts (reveals real gain) and maps wind/temperature so the engineers\' estimate is not biased by conditions.' },
  reliability: { label: '🛡️ Reliability run', desc: 'Burn-in checks: 12% lower failure risk this weekend, adds PU mileage.' },
};
const PROG_PARTS = { setup: [['setup', 0.9], ['qualisim', 0.6]], longrun: [['longrun', 0.85], ['tyrecomp', 0.6]], aero: [['correlation', 0.9], ['conditions', 0.85]], reliability: [['reliability', 1]],
  qualisim: [['setup', 0.9], ['qualisim', 0.6]], tyrecomp: [['longrun', 0.85], ['tyrecomp', 0.6]], correlation: [['correlation', 0.9], ['conditions', 0.85]], conditions: [['correlation', 0.9], ['conditions', 0.85]] };
export function applyProgram(state, did, prog, rng, mult = 1, lines = []) {
  for (const [p, k] of PROG_PARTS[prog] || [[prog, 1]]) applyOne(state, did, p, rng, mult * k, lines);
  return lines;
}

// Apply one practice programme's learning for a driver. mult scales the gain (1 = a full classic session).
function applyOne(state, did, prog, rng, mult = 1, lines = []) {
  const wk = state.weekend; const t = trackById(wk.trackId); const pt = state.teams[state.player];
  if (state.mode === 'quick') mult *= 2.2;
  const d = state.drivers[did];
    const fb = d.fb + (PERSONALITIES[d.pers]?.fbBonus || 0);
    const k = wk.knowledge[did];
    if (prog === 'setup' || prog === 'qualisim') {
      const g = (prog === 'setup' ? 0.22 + fb / 500 + deptQ(pt, 'vd') / 600 : 0.08) * mult;
      for (const key of SETUP_KEYS) k[key] = clamp(k[key] + g * rng.range(0.7, 1.2), 0, 0.97);
      // feedback — direction hints, accuracy tied to feedback skill
      const est = engineerEstimate(wk, did); const cur = wk.setups[did];
      const hints = [];
      for (const key of SETUP_KEYS) {
        const dlt = est[key] - cur[key];
        if (Math.abs(dlt) >= 1) {
          const wrong = rng.chance(clamp(0.35 - fb / 400, 0.03, 0.3));
          const dir = (dlt > 0) !== wrong ? 'more' : 'less';
          hints.push(`${SETUP_LABEL[key]}: wants ${dir}${wrong ? '' : ''}`);
        }
      }
      lines.push({ did, prog, text: hints.length ? `${d.name}: ${hints.slice(0, 3).join('; ')}.` : `${d.name}: "The balance feels close to right."` });
    }
    if (prog === 'qualisim') { wk.qualiPrep[did] = Math.min(0.12, (wk.qualiPrep[did] || 0) + 0.06 * mult); lines.push({ did, prog, text: `${d.name} completed low-fuel runs. Quali preparation improved.` }); }
    if (prog === 'longrun') {
      wk.tyreKnow = clamp(wk.tyreKnow + 0.3 * mult, 0, 0.95);
      const car = effectiveCar(pt, pt.drivers.indexOf(did));
      const deg = ['S', 'M', 'H'].map((c) => { const w = wearPerLap({ c, track: t, car, driver: d, mode: 'normal', wetness: 0, scale: wk.scale }); const e = w * (1 + rng.normal(0, 0.25 * (1 - wk.tyreKnow))); return `${COMPOUNDS[c].name} ~${e.toFixed(1)}%/lap`; });
      lines.push({ did, prog, text: `${d.name} long run — measured wear: ${deg.join(', ')}.` });
    }
    if (prog === 'correlation') {
      const pending = state.projects.filter((p) => p.stage === 'deployed' && !p.revealed);
      if (!pending.length) lines.push({ did, prog, text: `${d.name}: no unmeasured parts on the car — time used for baseline aero maps (small setup gain).` });
      pending.forEach((p) => { p.revealed = true; lines.push({ did, prog, text: `Correlation: ${p.name} measured at ${fmtFx(p.actual)} vs predicted ${fmtFx(p.expected)}.` }); });
      for (const key of SETUP_KEYS) k[key] = clamp(k[key] + 0.05, 0, 0.97);
    }
    if (prog === 'conditions') { wk.condKnow[did] = clamp((wk.condKnow[did] || 0) + 0.4 * mult, 0, 0.95); lines.push({ did, prog, text: `${d.name}: aero rakes and wind mapping done. Estimate bias from conditions reduced (confidence ${Math.round(wk.condKnow[did] * 100)}%).` }); }
    if (prog === 'tyrecomp') { wk.tyreKnow = clamp(wk.tyreKnow + 0.2 * mult, 0, 0.95); lines.push({ did, prog, text: `${d.name}: compared compounds back-to-back. Tyre model improved.` }); }
    if (prog === 'reliability') { wk.relBurn[did] = (+wk.relBurn[did] || 0) + 1; /* every reliability run finds more issues */ lines.push({ did, prog, text: `${d.name} completed reliability checks. ${pt.car.reliability < 65 ? 'Engineers flagged a marginal hydraulic pressure trace.' : 'No issues found.'}` }); }
  return lines;
}
// Track/car understanding grows with laps run (driver + engineers). Worth up to ~0.3s/lap.
export function gainKnow(state, did, laps) {
  const wk = state.weekend; if (!wk.know || wk.know[did] == null) return;
  const d = state.drivers[did]; const k = wk.knowledge[did];
  const rate = 0.0075 * (0.7 + d.fb / 160) * (1 + (d.rapport || 0) * 0.6); /* engineer rapport: faster understanding of the best aero/setup */
  wk.know[did] = clamp(wk.know[did] + rate * laps * (1 - wk.know[did]), 0, 1);
  if (k) for (const key of SETUP_KEYS) k[key] = clamp(k[key] + 0.0025 * laps, 0, 0.97);
}
export const AI_KNOW = 0.62;
export function knowOf(state, did) { const wk = state.weekend; return state.drivers[did].teamId === state.player ? (wk.know?.[did] ?? AI_KNOW) : AI_KNOW; }
export function runPractice(state, programs) {
  const wk = state.weekend;
  const rng = new RNG((wk.seed + 101 * (wk.practice.done + 1)) >>> 0);
  const pt = state.teams[state.player]; const lines = [];
  for (const did of pt.drivers) { applyProgram(state, did, programs[did] || 'setup', rng, 1, lines); gainKnow(state, did, 16); }
  wk.practice.done++;
  wk.practice.reports.push({ session: wk.practice.done, lines });
  return lines;
}
function fmtFx(fx) { return Object.entries(fx || {}).filter(([, v]) => Math.abs(v) > 0.05).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v.toFixed(1)}`).join(', ') || 'no change'; }

// Per-car single-lap pace for qualifying
export function qualiLap(state, team, slot, did, t, wet, rng, plan) {
  const wk = state.weekend; const d = state.drivers[did];
  const car = effectiveCar(team, slot);
  const perf = carDeficitSec(trackScore(car, t).score, t);
  const sq = team.isPlayer ? setupQuality(wk.setups[did], wk.opt[did]) : aiSetupQ(team, rng);
  const fx = team.isPlayer ? setupEffects(wk.setups[did], wk.opt[did], t) : { topSpeed: 0 };
  const tyre = wet > 0.6 ? 'W' : wet > 0.16 ? 'I' : 'S';
  const chosen = team.isPlayer && plan?.tyre ? plan.tyre : tyre;
  let lt = t.baseLap - knowOf(state, did) * 0.3 + AI_KNOW * 0.3 + perf + (100 - d.pace) * DRIVER_W + (1 - sq) * 0.9 - (wk.qualiPrep[did] || 0) + wetPenalty(chosen, wet) + wet * 6 + wet * (100 - d.wet) * 0.04 - fx.topSpeed * t.drag * 2 + 5 * 0.032 - 0.45;
  const push = plan?.push || 'normal';
  lt += { safe: 0.08, normal: 0, max: -0.12 }[push];
  const bm = plan?.boost || 'balanced'; lt += boostGain(bm, car, d, t);
  const mistakeP = { safe: 0.03, normal: 0.07, max: 0.15 }[push] * (1 + wet) * (1 + (100 - d.cons) / 50);
  const runs = plan?.run === 'late' ? 1 : 2;
  let best = Infinity; const notes = [];
  for (let r = 0; r < runs; r++) {
    let x = lt + rng.normal(0, 0.06 + (100 - d.cons) * 0.006);
    const evo = t.evo * 0.35 * (plan?.run === 'late' ? 1 : plan?.run === 'early' ? 0.2 : r === 1 ? 0.8 : 0.3);
    x -= evo;
    if (plan?.run === 'late' && rng.chance(0.1 + t.traffic * 0.08)) { x += rng.range(0.3, 0.8); notes.push('caught in traffic'); }
    if (plan?.run === 'late' && rng.chance(0.04)) { x = Infinity; notes.push('red flag ended session before final run'); }
    if (rng.chance(mistakeP)) { x += rng.range(0.6, 2.2); notes.push('mistake on push lap'); }
    if (BOOST_MODES[bm]?.risk && rng.chance(BOOST_MODES[bm].risk)) { x += rng.range(0.15, 0.4); notes.push('battery ran flat before the line'); }
    best = Math.min(best, x);
  }
  if (!Number.isFinite(best)) best = lt + 1.5; // fallback banker from practice-style lap
  return { time: best, notes, sq };
}
export function aiSetupQ(team, rng) { return clamp(0.78 + deptQ(team, 'vd') * 0.0018 + rng.range(-0.06, 0.06), 0.6, 0.99); }

export function runQualiSession(state, plans) {
  const wk = state.weekend; const t = trackById(wk.trackId); wk.parcFerme = true;
  const s = wk.quali.session; // 0,1,2
  const rng = new RNG((wk.seed + 777 * (s + 1)) >>> 0);
  const wet = clamp(wk.qWet + rng.normal(0, 0.05) * (wk.qWet > 0 ? 1 : 0), 0, 1);
  const out = [];
  for (const team of Object.values(state.teams)) {
    team.drivers.forEach((did, slot) => {
      if (wk.quali.eliminated.includes(did)) return;
      const aiPlan = { run: rng.pick(['banker', 'banker', 'late']), push: team.aiStyle === 'aggressive' ? 'max' : 'normal', boost: aiBoost(team, rng) };
      const r = qualiLap(state, team, slot, did, t, wet, rng, team.isPlayer ? plans[did] : aiPlan);
      out.push({ did, teamId: team.id, ...r });
    });
  }
  commitQuali(state, out, wet);
  return out;
}
export function commitQuali(state, out, wet) {
  const wk = state.weekend; const s = wk.quali.session;
  out.sort((a, b) => a.time - b.time);
  wk.quali.results[s] = out.map((o) => ({ did: o.did, teamId: o.teamId, time: o.time, notes: o.notes }));
  wk.quali.wet = wet;
  const cut = s === 0 ? 15 : s === 1 ? 10 : 99;
  out.slice(cut).forEach((o) => wk.quali.eliminated.push(o.did));
  wk.quali.session++;
  if (wk.quali.session >= 3) buildGrid(state);
}
export function buildGrid(state) {
  const wk = state.weekend; const r = wk.quali.results;
  const order = [...r[2].map((x) => x.did)];
  for (const x of r[1]) if (!order.includes(x.did)) order.push(x.did);
  for (const x of r[0]) if (!order.includes(x.did)) order.push(x.did);
  // grid penalties (PU allocation)
  const pens = state.gridPenalties || {};
  const withPen = order.map((did, i) => ({ did, key: i + (pens[did] || 0) + i * 0.001 }));
  withPen.sort((a, b) => a.key - b.key);
  wk.grid = withPen.map((x) => x.did);
  wk.gridPens = { ...pens }; state.gridPenalties = {};
}

export function strategyContext(state, did) {
  const wk = state.weekend; const t = trackById(wk.trackId);
  const team = state.teams[state.drivers[did].teamId];
  const car = effectiveCar(team, team.drivers.indexOf(did));
  return { track: t, laps: wk.laps, car, driver: state.drivers[did], scale: wk.scale };
}
export function defaultPlans(state) {
  const wk = state.weekend; const pt = state.teams[state.player];
  for (const did of pt.drivers) {
    if (!wk.strategy[did]) {
      const opts = planOptions(strategyContext(state, did));
      wk.strategy[did] = clonePlan(opts[0]);
      wk.fuel[did] = 1;
    }
  }
}

export function buildRace(state) {
  const wk = state.weekend; const t = trackById(wk.trackId);
  const rng = new RNG((wk.seed + 999) >>> 0);
  const diff = DIFFICULTY[state.difficulty];
  defaultPlans(state);
  const entries = [];
  for (const team of Object.values(state.teams)) {
    team.drivers.forEach((did, slot) => {
      const d = state.drivers[did];
      const car = effectiveCar(team, slot);
      const perf = carDeficitSec(trackScore(car, t).score, t);
      let plan, setupQ, setupFx;
      if (team.isPlayer) {
        plan = clonePlan(wk.strategy[did]); setupQ = setupQuality(wk.setups[did], wk.opt[did]); setupFx = setupEffects(wk.setups[did], wk.opt[did], t);
      } else {
        const opts = planOptions({ track: t, laps: wk.laps, car, driver: d, scale: wk.scale });
        const noise = (1 - Math.min(1, diff.ai)) * 3 + 0.4;
        const idx = team.aiStyle === 'aggressive' ? Math.min(opts.length - 1, rng.int(0, 2)) : team.aiStyle === 'conservative' ? 0 : Math.min(opts.length - 1, Math.floor(Math.abs(rng.normal(0, noise))));
        plan = clonePlan(opts[idx] || opts[0]);
        // wet start
        if (wk.weather.wet[0] > 0.16) plan.start = wk.weather.wet[0] > 0.6 ? 'W' : 'I';
        setupQ = aiSetupQ(team, rng); setupFx = { ...AI_FX };
      }
      if (team.isPlayer && wk.weather.wet[0] > 0.16 && ['S', 'M', 'H'].includes(plan.start) && wk.startTyre?.[did] == null) {/* player chose */}
      if (team.isPlayer && wk.startTyre?.[did]) plan.start = wk.startTyre[did];
      const relFac = team.isPlayer ? relMultiplier(state, team, did) : clamp(1.1 - deptQ(team, 'rel') * 0.004, 0.7, 1.2);
      let sets = null, startWear = 0;
      if (team.isPlayer && Array.isArray(wk.sets?.[did])) {
        sets = wk.sets[did].map((x) => ({ ...x }));
        const ofS = sets.filter((x) => x.c === plan.start).sort((a, b) => a.wear - b.wear); const st0 = (plan.startUsed && ofS.find((x) => x.wear > 2)) || ofS.find((x) => x.wear <= 2) || ofS[0];
        if (st0) { startWear = st0.wear; sets.splice(sets.indexOf(st0), 1); }
      } else if (!team.isPlayer && ['S', 'M'].includes(plan.start) && wk.grid.indexOf(did) < 10) startWear = rng.range(4, 12); // top-10 start on quali tyres
      entries.push({
        sets, startWear, driverId: did, teamId: team.id, name: d.name, short: d.name.split(' ').slice(-1)[0], abbr: team.abbr, color: team.color,
        isPlayer: team.isPlayer, slot, grid: wk.grid.indexOf(did) + 1, drv: d, car, perf, setupQ, setupFx, plan,
        know: knowOf(state, did), crew: pitCrew(team), relMult: relFac * Math.max(0.5, 1 - 0.17 * (+wk.relBurn[did] || 0)), fuelLoad: team.isPlayer ? wk.fuel[did] || 1 : 1, aiStyle: team.aiStyle,
      });
    });
  }
  entries.sort((a, b) => a.grid - b.grid);
  wk.race = createRace({ track: t, laps: wk.laps, entries, weather: wk.weather, seed: rng.int(1, 2 ** 31), scale: wk.scale, difficulty: state.difficulty, degMult: wk.raceDeg || 1, fullThrottle: lapProfile(t).fullThrottle, boxOrder: state.lastOrder || Object.keys(state.teams) });
  wk.phase = 'race';
  return wk.race;
}
function relMultiplier(state, team, did) {
  const slot = team.drivers.indexOf(did);
  const over = 1 + Math.pow(maxWear(team, slot) / 100, 2) * 0.6; // worn PU/gearbox parts fail more often
  const fat = 1 + Math.max(0, team.depts.rel.fatigue + team.depts.ops.fatigue - 40) * 0.003; /* same baseline as AI */
  return clamp((1.1 - deptQ(team, 'rel') * 0.004 - facLvl(team, 'relLab') * 0.03) * over * fat, 0.55, 1.6);
}

// Classification & analysis ---------------------------------------------------
export function classify(state) {
  const wk = state.weekend; const race = wk.race; const t = trackById(wk.trackId);
  // learning from mistakes (every driver): experience reduces future error rate; a little consistency gained
  if (!race._learned) { race._learned = true; for (const c of race.cars) { const d = state.drivers[c.driverId]; if (!d || !c.mistakes) continue; d.mkExp = Math.min(30, (d.mkExp || 0) + c.mistakes); if (d.cons < (d.pot || 90)) d.cons = Math.min(99, Math.round((d.cons + 0.15 * c.mistakes) * 100) / 100); } }
  const order = [...race.cars].sort((a, b) => (!!a.dnf - !!b.dnf) || (b.lapsDone - a.lapsDone) || (a.total - b.total));
  const winner = order[0];
  const rows = order.map((c, i) => ({
    pos: i + 1, did: c.driverId, teamId: c.teamId, grid: c.grid, dnf: c.dnf, laps: c.lapsDone,
    gap: c.dnf ? null : c.lapsDone < winner.lapsDone ? `+${winner.lapsDone - c.lapsDone}L` : i === 0 ? race.laps + ' laps' : `+${(c.total - winner.total).toFixed(1)}s`,
    pts: !c.dnf && i < 10 ? POINTS[i] : 0, best: c.bestLap, stops: c.stops.length, stints: c.stints, penalty: c.penalty,
  }));
  wk.result = { rows, trackId: t.id, wet: race.wetRace, sc: race.sc.count, vsc: race.sc.vscCount, laps: race.laps, round: wk.round };
  wk.analysis = analyse(state);
  wk.phase = 'post';
  return wk.result;
}

export function analyse(state) {
  const wk = state.weekend; const race = wk.race; const t = trackById(wk.trackId);
  const pt = state.teams[state.player];
  const cars = race.cars;
  const green = (c) => { const l = c.laps.filter((x, i) => i > 0 && x < t.baseLap * 1.15); return l.length ? avg(l) : Infinity; };
  const paceRank = [...cars].filter((c) => !c.dnf).sort((a, b) => green(a) - green(b)).map((c) => c.id);
  const out = [];
  for (const did of pt.drivers) {
    const c = cars.find((x) => x.id === did); const d = state.drivers[did];
    const row = wk.result.rows.find((r) => r.did === did);
    const why = [];
    const pr = paceRank.indexOf(did) + 1;
    if (c.dnf) why.push({ k: 'bad', t: `Retired: ${c.dnf} on lap ${c.lapsDone}.` + (/(failure|fault)/i.test(c.dnf) ? ` Car reliability ${Math.round(c.car.reliability)} and component stress at this circuit (engine stress ${Math.round(t.eng * 100)}%) raised the risk.` : '') });
    else {
      why.push({ k: 'info', t: `Started P${c.grid}, finished P${row.pos} (${row.pos < c.grid ? '+' : ''}${c.grid - row.pos} places). Race pace rank: ${pr}/${paceRank.length}.` });
      if (pr < row.pos - 2) why.push({ k: 'warn', t: `Pace was better than the result: stuck in traffic/dirty air (overtaking difficulty ${Math.round(t.ovt * 100)}%). A better grid slot or offset strategy would have helped.` });
      if (pr > row.pos + 2) why.push({ k: 'good', t: 'Result beat underlying pace — track position, strategy or rival problems helped.' });
    }
    const sq = setupQuality(wk.setups[did], wk.opt[did]);
    why.push({ k: sq > 0.9 ? 'good' : sq > 0.75 ? 'info' : 'warn', t: `Setup quality ≈ ${Math.round(sq * 100)}% (costing ~${((1 - sq) * 0.9).toFixed(2)}s/lap).${sq < 0.8 ? ' More practice setup work would have closed the gap.' : ''}` });
    const sc = trackScore(c.car, t);
    const b = sc.breakdown;
    const strongest = [['cornering', b.corner], ['straight-line', b.straight], ['mechanical grip', b.mech], ['braking', b.braking]].sort((x, y) => y[1] - x[1]);
    why.push({ k: 'info', t: `Car suited this track via ${strongest[0][0]}; weakest in ${strongest[3][0]}.${b.coolPen > 0.5 ? ` Cooling deficit cost performance (≈${b.coolPen.toFixed(1)} rating pts).` : ''}` });
    if (c.stops.length) why.push({ k: 'info', t: `Pit stops: ${c.stops.map((s) => `L${s.lap} ${s.from}→${s.to} (${s.stat}s stationary${s.sc !== 'none' ? ', under ' + s.sc.toUpperCase() : ''})`).join('; ')}.` });
    const slow = c.stops.filter((s) => s.stat > 4.5); if (slow.length) why.push({ k: 'bad', t: `${slow.length} slow stop(s) — pit crew morale/fatigue and training level matter.` });
    const cheap = c.stops.filter((s) => s.sc !== 'none'); if (cheap.length) why.push({ k: 'good', t: 'Pitted under neutralisation, saving ~40% of pit-loss.' });
    const maxWear = Math.max(0, ...c.laps.map(() => 0), c.tyre.wear);
    if (c.incidents.length) why.push({ k: 'warn', t: `Incidents: ${c.incidents.map((i) => `L${i.lap} ${i.text}`).join(', ')}.` });
    if (race.wetRace) why.push({ k: 'info', t: `Wet running: ${d.name}'s wet skill ${d.wet} ${d.wet > 85 ? 'was an asset' : 'limited gains'}.` });
    if (c.penalty) why.push({ k: 'bad', t: `Received a ${c.penalty}s time penalty.` });
    if (maxWear > 80 && !c.dnf) why.push({ k: 'warn', t: `Finished on heavily worn tyres (${Math.round(maxWear)}%).` });
    out.push({ did, name: d.name, why, paceRank: pr });
  }
  // strategy comparison with nearest rival
  const rivals = cars.filter((c) => !c.isPlayer && !c.dnf).slice(0, 20);
  const strat = {};
  for (const c of rivals.slice(0, 6)) strat[c.id] = c.stints.map((s) => s.c).join('-');
  return { drivers: out, paceRank, rivalStrats: strat };
}
