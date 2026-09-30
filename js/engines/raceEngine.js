// Deterministic lap-event race engine. Each car has a scheduled next line-crossing time (lapEnd).
// Cars are processed in chronological crossing order, so interactions (overtakes, blocking, SC bunching)
// are resolved against the car directly ahead on the road. The UI interpolates positions between crossings.
import { RNG } from '../sim/rng.js';
import { clamp, safe } from '../sim/util.js';
import { COMPOUNDS, DRY, wetPenalty, tyrePaceLoss, wearPerLap } from './tyreEngine.js';
import { PERSONALITIES } from '../data/drivers.js';

const MODE = {
  conserve: { pace: 0.5, fuel: 0.85, inc: 0.6, rel: 0.8 },
  normal: { pace: 0, fuel: 1, inc: 1, rel: 1 },
  push: { pace: -0.35, fuel: 1.1, inc: 1.3, rel: 1.15 },
  attack: { pace: -0.6, fuel: 1.22, inc: 1.7, rel: 1.3 },
};
const ERS = {
  harvest: { pace: 0.25, bat: +14 }, balanced: { pace: 0, bat: +2 }, deploy: { pace: -0.3, bat: -12 }, overtake: { pace: -0.5, bat: -26 },
};
export const MODES = Object.keys(MODE);
export const ERS_MODES = Object.keys(ERS);
const SC_PACE = 1.4, VSC_PACE = 1.3;

export function createRace(ctx) {
  // ctx: {track, laps, entries, weather, seed, scale, difficulty}
  const rng = new RNG(ctx.seed);
  const race = {
    trackId: ctx.track.id, laps: ctx.laps, scale: ctx.scale || 1, time: 0, lap: 1, rngS: rng.s,
    weather: ctx.weather, wetness: ctx.weather.wet[0], sc: { state: 'none', lapsLeft: 0, count: 0, vscCount: 0 },
    cars: [], log: [], radio: [], pending: [], chequered: false, finished: false, lineTimes: [0],
    difficulty: ctx.difficulty || 'standard', lapChart: [], alerts: {}, stats: { overtakes: 0 },
  };
  const t = ctx.track;
  const fuelStart = 100;
  ctx.entries.forEach((e) => {
    race.cars.push({
      id: e.driverId, driverId: e.driverId, teamId: e.teamId, name: e.name, short: e.short, abbr: e.abbr, color: e.color,
      isPlayer: !!e.isPlayer, slot: e.slot || 0, grid: e.grid, pos: e.grid,
      drv: e.drv, car: e.car, perf: e.perf, setupQ: e.setupQ, setupFx: e.setupFx, crew: e.crew, relMult: e.relMult || 1,
      plan: e.plan, planIdx: 0, autoPlan: e.isPlayer ? e.autoPlan !== false : true, aiStyle: e.aiStyle || 'calculated',
      tyre: { c: e.plan.start, age: 0, wear: e.startWear || 0 }, compoundsUsed: [e.plan.start],
      fuel: fuelStart * (e.fuelLoad || 1), fuelTarget: e.fuelLoad || 1, mode: 'normal', ers: 'balanced', battery: 70,
      lapsDone: 0, lapStart: 0, lapEnd: 0, total: 0, lastLap: null, bestLap: null, laps: [],
      damage: 0, damageType: null, failurePen: 0, dnf: null, finished: false, pitReq: null, stops: [], stints: [{ c: e.plan.start, from: 1 }],
      dirty: false, gain: 0, orders: null, posHist: [e.grid], incidents: [], pitLossTotal: 0, penalty: 0,
    });
  });
  // Launch: grid slot offset + start performance; lap-1 chaos resolved by sort + minimum gap.
  const first = race.cars.map((c) => {
    const startSkill = (c.drv.start - 80) * 0.012;
    const launch = rng.normal(0, 0.28) - startSkill + (c.grid % 2 === 0 ? 0.05 : 0); // dirty side
    const lt = lapTime(race, c, t, rng, true) + 1.8;
    return { c, end: lt + (c.grid - 1) * 0.22 + launch };
  }).sort((a, b) => a.end - b.end);
  let prev = -Infinity;
  for (const f of first) { f.end = Math.max(f.end, prev + 0.2); prev = f.end; f.c.lapEnd = f.end; f.c.curLap = f.end; }
  rng.s = rng.s; race.rngS = rng.s;
  pushLog(race, 0, `Lights out at ${t.name}! ${race.laps} laps.`, 'info');
  updateOrder(race);
  return race;
}

function pushLog(race, lap, text, sev = 'info', carId = null) { race.log.push({ lap, text, sev, carId, t: race.time }); if (race.log.length > 400) race.log.shift(); }
function radio(race, car, text) { race.radio.push({ lap: race.lap, from: car.short || car.name, text, carId: car.id, color: car.color }); if (race.radio.length > 120) race.radio.shift(); }

export function lapTime(race, c, t, rng, isFirst = false) {
  const w = race.wetness;
  const m = MODE[c.mode] || MODE.normal;
  const e = ERS[c.battery <= 0 && (c.ers === 'deploy' || c.ers === 'overtake') ? 'harvest' : c.ers] || ERS.balanced;
  let lt = t.baseLap + c.perf + (100 - c.drv.pace) * 0.035 + (1 - c.setupQ) * 0.9;
  lt += tyrePaceLoss(c.tyre) + wetPenalty(c.tyre.c, w);
  lt += w * 6 + w * (100 - c.drv.wet) * 0.04;
  lt += c.fuel * 0.032 * (t.baseLap / 85);
  lt += m.pace + e.pace + c.damage + c.failurePen;
  lt -= t.evo * 0.5 * (race.lap / race.laps);
  lt -= c.setupFx.topSpeed * t.drag * 2;
  lt += ((c.drv.morale ?? 70) - 70) * -0.004;
  const sd = 0.08 + (100 - c.drv.cons) * 0.012 + w * 0.25;
  lt += rng.normal(0, sd);
  const mistakeP = (0.006 + (100 - c.drv.cons) * 0.0006) * (1 + w * 2) * m.inc;
  if (!isFirst && rng.chance(mistakeP)) { const loss = rng.range(1.2, 4); lt += loss; c._mistake = loss; }
  return safe(lt, t.baseLap + 5);
}

export function updateOrder(race) {
  const sorted = [...race.cars].sort((a, b) => {
    if (!!a.dnf !== !!b.dnf) return a.dnf ? 1 : -1;
    if (b.lapsDone !== a.lapsDone) return b.lapsDone - a.lapsDone;
    return a.total - b.total;
  });
  sorted.forEach((c, i) => (c.pos = i + 1));
  race.order = sorted.map((c) => c.id);
  return sorted;
}
export const carById = (race, id) => race.cars.find((c) => c.id === id);

// Advance simulation to time T. Returns 'pause' if a critical decision was raised and autoPause is set.
export function advance(race, T, track, opts = {}) {
  const rng = new RNG(race.rngS);
  let guard = 0;
  while (guard++ < 500) {
    let next = null;
    for (const c of race.cars) if (!c.dnf && !c.finished && c.lapEnd <= T && (!next || c.lapEnd < next.lapEnd)) next = c;
    if (!next) break;
    race.time = next.lapEnd;
    processLap(race, next, track, rng);
    if (race.cars.every((c) => c.dnf || c.finished)) { finishRace(race); break; }
    if (opts.autoPause && race.pending.some((p) => !p.shown)) { race.rngS = rng.s; return 'pause'; }
  }
  if (!race.finished) race.time = Math.max(race.time, T);
  race.rngS = rng.s;
  return race.finished ? 'finished' : 'ok';
}

function carAhead(race, c) {
  const order = updateOrder(race);
  const i = order.indexOf(c);
  for (let j = i - 1; j >= 0; j--) { const a = order[j]; if (!a.dnf) return a; }
  return null;
}

function processLap(race, c, t, rng) {
  c.lapsDone++;
  c.total = c.lapEnd;
  const lt = c.lapEnd - c.lapStart;
  c.lastLap = lt; c.laps.push(+lt.toFixed(3));
  const green = race.sc.state === 'none';
  if (green && !c._pitLap && (!c.bestLap || lt < c.bestLap)) c.bestLap = lt;
  c._pitLap = false;
  if (c.lapsDone > race.lineTimes.length - 1) { race.lineTimes.push(c.total); onLeaderLap(race, c, t, rng); }
  // wear & consumption for completed lap
  const pers = PERSONALITIES[c.drv.pers] || PERSONALITIES.teamplayer;
  const w = wearPerLap({ c: c.tyre.c, track: t, car: c.car, driver: c.drv, mode: c.mode, wetness: race.wetness, dirty: c.dirty, sc: !green, setupWear: c.setupFx.wearMult, pers: pers.wear, scale: race.scale, frontBias: c.setupFx.frontBias });
  c.tyre.wear = clamp(c.tyre.wear + w, 0, 100); c.tyre.age++;
  const m = MODE[c.mode] || MODE.normal;
  const fuelUse = (100 / race.laps) * m.fuel * (green ? 1 : 0.55);
  c.fuel = Math.max(0, c.fuel - fuelUse);
  const e = ERS[c.ers] || ERS.balanced;
  c.battery = clamp(c.battery + e.bat * (c.car.puEff / 80), 0, 100);
  c.dirty = false;
  c.posHist.push(c.pos);
  // fuel shortfall: forced lift-and-coast
  const lapsLeft = race.laps - c.lapsDone;
  const needed = (100 / race.laps) * lapsLeft * 0.97;
  if (lapsLeft > 0 && c.fuel < needed && c.mode !== 'conserve') {
    if (!c._fuelWarn) { c._fuelWarn = true; if (c.isPlayer) { radio(race, c, 'Fuel is marginal — we need to lift and coast.'); raise(race, { type: 'fuel', carId: c.id, text: `${c.short}: fuel below target. Switch to Conserve?` }); } }
    if (!c.isPlayer || c.autoPlan) c.mode = 'conserve';
  }
  if (c.fuel <= 0 && lapsLeft > 0) return retire(race, c, 'Ran out of fuel', t, rng, false);

  if (race.chequered || c.lapsDone >= race.laps) {
    c.finished = true; race.chequered = true;
    if (!race._flagShown) { race._flagShown = true; pushLog(race, race.laps, `Chequered flag! ${c.name} wins.`, 'good', c.id); }
    return;
  }
  // reliability
  const relP = 0.012 * Math.pow(clamp(1 - c.car.reliability / 100, 0.02, 0.9), 1.5) * m.rel * c.relMult * race.scale * (0.7 + 0.6 * t.eng);
  if (rng.chance(relP)) {
    const types = [['Power unit failure', true], ['Gearbox failure', true], ['Hydraulics failure', true], ['ERS fault', false], ['Brake overheating', false]];
    const [name, terminal] = rng.pick(types);
    if (terminal) return retire(race, c, name, t, rng, true);
    c.failurePen += name === 'ERS fault' ? 1.2 : 0.6; c.incidents.push({ lap: c.lapsDone, text: name });
    pushLog(race, c.lapsDone, `${c.name}: ${name} — losing time.`, 'warn', c.id);
    if (c.isPlayer) { radio(race, c, `I've got a problem… ${name.toLowerCase()}!`); raise(race, { type: 'failure', carId: c.id, text: `${c.short} has a ${name}. Car can continue with a pace loss (~${name === 'ERS fault' ? '1.2' : '0.6'}s/lap).` }); }
  }
  // crash / off
  const crashP = 0.0006 * pers.inc * m.inc * (1 + race.wetness * 3 * (1.3 - c.drv.wet / 100) + wetPenalty(c.tyre.c, race.wetness) * 0.06) * (1 + (100 - c.drv.cons) / 40) * race.scale * c.setupFx.damageRisk * (c.tyre.wear > COMPOUNDS[c.tyre.c].cliff ? 1.6 : 1);
  if (green && rng.chance(crashP)) {
    if (rng.chance(0.55)) return retire(race, c, 'Crashed', t, rng, false, true);
    applyDamage(race, c, rng, 'Off-track excursion');
  }
  // kerb damage due to low ride height
  if (green && rng.chance(0.0015 * (c.setupFx.damageRisk - 1) * race.scale)) applyDamage(race, c, rng, 'Floor damage over kerbs', 0.35);
  // puncture
  if (c.tyre.wear > 88 && rng.chance((c.tyre.wear - 88) * 0.02)) {
    pushLog(race, c.lapsDone, `${c.name}: PUNCTURE!`, 'bad', c.id);
    if (c.isPlayer) radio(race, c, 'Puncture! Puncture! Boxing now.');
    c.pitReq = c.pitReq || bestCompoundFor(race, c); c._puncture = true;
  }
  // tyre cliff warning
  if (c.isPlayer && c.tyre.wear > COMPOUNDS[c.tyre.c].cliff - 4 && !c._cliffWarned && !c.pitReq) {
    c._cliffWarned = true; radio(race, c, 'Tyres are going off — rear grip is dropping fast.');
    raise(race, { type: 'cliff', carId: c.id, text: `${c.short}'s ${COMPOUNDS[c.tyre.c].name}s are near the performance cliff (wear ~${Math.round(c.tyre.wear)}%).` });
  }
  // pit decision
  let pitLoss = 0;
  const decision = pitDecision(race, c, t, rng);
  if (decision) pitLoss = doPit(race, c, decision, t, rng);
  // next lap time
  const base = lapTime(race, c, t, rng) + (c._puncture ? 18 : 0);
  c._puncture = false;
  if (c._mistake && c.isPlayer && c._mistake > 2) radio(race, c, 'Sorry, locked up into the hairpin.');
  c._mistake = 0;
  let end = c.lapEnd + base + pitLoss;
  const ahead = carAhead(race, c);
  if (race.sc.state === 'sc') {
    end = c.lapEnd + t.baseLap * SC_PACE + pitLoss;
    if (ahead && !ahead.finished && ahead.lapsDone === c.lapsDone) end = Math.max(Math.min(end, ahead.lapEnd + 1.0), ahead.lapEnd + 0.8);
  } else if (race.sc.state === 'vsc') {
    end = c.lapEnd + base * VSC_PACE + pitLoss;
  } else if (ahead && !ahead.finished && ahead.lapsDone === c.lapsDone && end < ahead.lapEnd + 0.25 && !pitLoss) {
    end = resolveBattle(race, c, ahead, end, t, rng);
  } else if (ahead && ahead.lapsDone === c.lapsDone && end < ahead.lapEnd + 0.15) {
    end = ahead.lapEnd + 0.15;
  }
  if (race.lap <= 2 && ahead && end < ahead.lapEnd + 0.12) end = ahead.lapEnd + 0.12;
  c.lapStart = c.lapEnd; c.lapEnd = safe(end, c.lapEnd + t.baseLap * 1.2); c.curLap = c.lapEnd - c.lapStart;
  if (pitLoss) c._pitLap = true;
  updateOrder(race);
  // team orders — hold position
  teamOrderCheck(race, c, t);
}

function resolveBattle(race, c, ahead, end, t, rng) {
  const gap = c.total - ahead.total;
  const pace = (ahead.lapEnd - ahead.lapStart) - (end - c.lapEnd);
  const drs = gap < 1.0 && race.lap > 2 && race.wetness < 0.3;
  const pers = PERSONALITIES[c.drv.pers] || PERSONALITIES.teamplayer;
  if (c.orders === 'hold' && ahead.teamId === c.teamId) return ahead.lapEnd + 0.6;
  if (pace > 3 || ahead._pitLap) return Math.min(end, ahead.lapEnd - 0.2); // car ahead pitting / crippled
  let p = 0.08 + pace * 0.4 + (drs ? t.drs * 0.3 : 0) - t.ovt * 0.45 + (c.drv.craft - ahead.drv.craft) * 0.008;
  if (c.ers === 'overtake' && c.battery > 0) p += 0.12;
  if (ahead.ers === 'overtake' && ahead.battery > 0) p -= 0.08;
  p += (c.setupFx.topSpeed - ahead.setupFx.topSpeed) * 1.5 * t.drag;
  p *= pers.ovt;
  if (ahead.teamId === c.teamId && ahead.orders === 'letby') p = 0.95;
  p = clamp(p, 0.02, 0.92);
  if (rng.chance(p)) {
    // contact risk during overtake
    const contactP = 0.012 * pers.inc * (1 + race.wetness) * (MODE[c.mode]?.inc || 1);
    if (rng.chance(contactP)) {
      pushLog(race, c.lapsDone, `Contact between ${c.name} and ${ahead.name}!`, 'bad', c.id);
      applyDamage(race, rng.chance(0.5) ? c : ahead, rng, 'Contact damage');
      if (rng.chance(0.25)) { retire(race, ahead, 'Collision damage', t, rng, false, true); return end; }
    }
    ahead.lapEnd += 0.2; c.gain++;
    if (ahead.orders === 'letby') ahead.orders = null;
    race.stats.overtakes++;
    if (c.isPlayer || ahead.isPlayer) pushLog(race, c.lapsDone, `${c.name} overtakes ${ahead.name}${drs ? ' with DRS' : ''} for P${ahead.pos}.`, c.isPlayer ? 'good' : 'warn', c.id);
    return Math.min(end, ahead.lapEnd - 0.12);
  }
  c.dirty = true;
  if (c.isPlayer && !c._stuckWarned && pace > 0.4) { c._stuckWarned = true; radio(race, c, `I'm much quicker than ${ahead.short}, but I can't get close in the dirty air.`); }
  return ahead.lapEnd + 0.25 + rng.range(0, 0.35);
}

function applyDamage(race, c, rng, why, sev = null) {
  const loss = sev ?? rng.range(0.4, 1.4);
  c.damage += loss; c.damageType = why; c.incidents.push({ lap: c.lapsDone, text: why });
  pushLog(race, c.lapsDone, `${c.name}: ${why} (≈${loss.toFixed(1)}s/lap).`, 'warn', c.id);
  if (c.isPlayer) { radio(race, c, `I think I've got damage — the car feels different.`); raise(race, { type: 'damage', carId: c.id, text: `${c.short} has ${why.toLowerCase()} costing ~${loss.toFixed(1)}s/lap. Pit for a new nose/repair (+6s) or continue?` }); }
}

function retire(race, c, why, t, rng, mech, crash = false) {
  c.dnf = why; c.incidents.push({ lap: c.lapsDone, text: why });
  pushLog(race, c.lapsDone, `${c.name} retires: ${why}.`, 'bad', c.id);
  if (c.isPlayer) radio(race, c, mech ? 'Lost power… I have to stop the car. Sorry guys.' : 'I\'m out. Sorry.');
  if (race.sc.state === 'none' && race.lap < race.laps - 1) {
    const pSC = crash ? 0.45 + t.sc * 0.4 : 0.15 + t.sc * 0.2;
    if (rng.chance(pSC)) deploySC(race, rng.chance(crash ? 0.75 : 0.35) ? 'sc' : 'vsc', rng, why);
  }
  updateOrder(race);
}

function deploySC(race, type, rng, why) {
  race.sc = { ...race.sc, state: type, lapsLeft: type === 'sc' ? rng.int(3, 5) : rng.int(1, 3) };
  if (type === 'sc') race.sc.count++; else race.sc.vscCount++;
  pushLog(race, race.lap, `${type === 'sc' ? 'SAFETY CAR' : 'VIRTUAL SAFETY CAR'} deployed${why ? ' — ' + why : ''}.`, 'warn');
  raise(race, { type: 'sc', text: `${type === 'sc' ? 'Safety Car' : 'Virtual Safety Car'} deployed. Pit stops are cheaper now (~${type === 'sc' ? '45' : '40'}% less time lost). Box either car?` });
}

function onLeaderLap(race, leader, t, rng) {
  race.lap = Math.min(race.laps, leader.lapsDone + 1);
  const prevW = race.wetness;
  race.wetness = race.weather.wet[Math.min(race.lap, race.weather.wet.length - 1)] || 0;
  race.lapChart.push(updateOrder(race).map((c) => c.id));
  if (race.sc.state !== 'none') {
    race.sc.lapsLeft--;
    if (race.sc.lapsLeft <= 0) { pushLog(race, race.lap, race.sc.state === 'sc' ? 'Safety car in this lap — green flag!' : 'VSC ending — green flag!', 'info'); race.sc.state = 'none'; }
  } else if (race.lap > 1 && race.lap < race.laps - 2 && rng.chance(t.sc * 0.006 * race.scale)) {
    deploySC(race, rng.chance(0.5) ? 'vsc' : 'sc', rng, 'debris on track');
  }
  if (prevW < 0.14 && race.wetness >= 0.14) { pushLog(race, race.lap, 'Rain is falling — track getting wet.', 'warn'); raise(race, { type: 'rain', text: `Rain! Track wetness now ${Math.round(race.wetness * 100)}%. Slicks become slower than Inters at ~16%. Switch to Intermediates?` }); }
  if (prevW >= 0.14 && race.wetness < 0.14) { pushLog(race, race.lap, 'Track is drying — a dry line is appearing.', 'warn'); raise(race, { type: 'dry', text: `Track drying (wetness ${Math.round(race.wetness * 100)}%). Slicks will soon be faster. Switch to dry tyres?` }); }
  // pit window hints for player
  for (const c of race.cars) {
    if (!c.isPlayer || c.dnf || c.finished) continue;
    const nextStop = c.plan.stops[c.planIdx];
    if (nextStop && nextStop.lap - race.lap === 2 && !c._windowWarn?.[c.planIdx]) {
      c._windowWarn = { ...(c._windowWarn || {}), [c.planIdx]: true };
      pushLog(race, race.lap, `${c.short}: pit window opens in 2 laps (plan: ${COMPOUNDS[nextStop.c].name}).`, 'info', c.id);
    }
  }
}

function bestCompoundFor(race, c) {
  const w = race.wetness;
  if (w > 0.6) return 'W';
  if (w > 0.16) return 'I';
  const left = race.laps - c.lapsDone;
  const need2 = !c.compoundsUsed.some((x) => x !== c.tyre.c && DRY.includes(x)) && DRY.includes(c.tyre.c);
  const opts = left > 28 * (1 / race.scale) ? ['H', 'M'] : left > 14 / race.scale ? ['M', 'H'] : ['S', 'M'];
  for (const o of opts) if (!need2 || o !== c.tyre.c) return o;
  return opts[0];
}

function pitDecision(race, c, t, rng) {
  const lapsLeft = race.laps - c.lapsDone;
  if (c.pitReq) { const r = c.pitReq; c.pitReq = null; return typeof r === 'string' ? { c: r } : r; }
  if (lapsLeft < 1) return null;
  const w = race.wetness;
  const onDry = DRY.includes(c.tyre.c);
  const player = c.isPlayer;
  const auto = !player || c.autoPlan;
  if (!auto) return null;
  // weather reactions (AI; player auto-plan follows engineer)
  const lag = c.aiStyle === 'conservative' ? 0.06 : c.aiStyle === 'aggressive' ? -0.02 : 0.02;
  const pl = player ? 0.05 : 0; // engineer auto-calls for player are slightly cautious
  if (onDry && w > 0.17 + lag + pl) return { c: w > 0.62 ? 'W' : 'I' };
  if (!onDry && w < 0.1 - lag * 0.5 - pl && lapsLeft > 2) return { c: bestCompoundFor(race, c) };
  if (c.tyre.c === 'W' && w < 0.5 - pl && lapsLeft > 3) return { c: 'I' };
  const C = COMPOUNDS[c.tyre.c];
  const next = c.plan.stops[c.planIdx];
  // cheap stop under SC/VSC
  if (race.sc.state !== 'none' && !player && lapsLeft > 5) {
    const near = next && Math.abs(next.lap - c.lapsDone) <= 8 / race.scale ** 0.3;
    if (near || c.tyre.wear > 40) { c.planIdx++; return { c: next?.c || bestCompoundFor(race, c) }; }
  }
  if (next) {
    let triggerLap = next.lap;
    if (!player && c.aiStyle === 'opportunist') {
      const ahead = carAhead(race, c);
      if (ahead && ahead.total && c.total - ahead.total < 2 && next.lap - c.lapsDone <= 2) triggerLap = c.lapsDone; // undercut attempt
    }
    if (c.lapsDone >= triggerLap || c.tyre.wear > C.cliff + 4) { c.planIdx++; return { c: next.c }; }
  } else if (c.tyre.wear > C.cliff + 10 && lapsLeft > 4) {
    return { c: bestCompoundFor(race, c) };
  }
  // mandatory second compound safety
  if (!player && lapsLeft === 2 && w < 0.1 && !c.compoundsUsed.some((x) => x !== c.compoundsUsed[0]) && DRY.includes(c.tyre.c)) return { c: c.tyre.c === 'S' ? 'M' : 'S' };
  return null;
}

function doPit(race, c, d, t, rng) {
  const crew = c.crew || { speed: 70, err: 0.05 };
  let stat = 2.1 + (100 - crew.speed) * 0.025 + Math.abs(rng.normal(0, 0.25));
  let note = '';
  if (rng.chance(crew.err)) { const e = rng.range(1.5, 6); stat += e; note = ` (slow stop +${e.toFixed(1)}s)`; }
  if (c.damage > 0 && d.repair !== false) { stat += 6; note += ' + repair'; c.damage = 0; c.damageType = null; }
  const lane = t.pit * (race.sc.state === 'sc' ? 0.55 : race.sc.state === 'vsc' ? 0.6 : 1);
  if (d.c === c.tyre.c && d.keep) { return 0; }
  const old = c.tyre.c;
  c.tyre = { c: d.c, age: 0, wear: 0 };
  if (!c.compoundsUsed.includes(d.c)) c.compoundsUsed.push(d.c);
  c.stints.push({ c: d.c, from: c.lapsDone + 1 });
  c._cliffWarned = false;
  c.stops.push({ lap: c.lapsDone, from: old, to: d.c, stat: +stat.toFixed(1), total: +(stat + lane).toFixed(1), sc: race.sc.state });
  c.pitLossTotal += stat + lane;
  if (c.isPlayer || c.pos <= 3) pushLog(race, c.lapsDone, `${c.name} pits: ${COMPOUNDS[old].name} → ${COMPOUNDS[d.c].name}, ${stat.toFixed(1)}s${note}.`, c.isPlayer ? 'info' : 'muted', c.id);
  // plan catch-up: if player pitted off-plan, advance plan index past stops earlier than now+3
  while (c.plan.stops[c.planIdx] && c.plan.stops[c.planIdx].lap <= c.lapsDone + 3) c.planIdx++;
  return stat + lane;
}

function teamOrderCheck(race, c, t) {
  if (!c.isPlayer || c.dnf) return;
  const mate = race.cars.find((x) => x.teamId === c.teamId && x.id !== c.id && !x.dnf && !x.finished);
  if (!mate) return;
  if (mate.pos === c.pos - 1 && c.lapsDone === mate.lapsDone && c.total - mate.total < 1.2 && c.lastLap < mate.lastLap - 0.3 && !race.alerts['to' + race.lap] && !race._toAsked?.[c.id + mate.id + Math.floor(race.lap / 8)]) {
    race._toAsked = { ...(race._toAsked || {}), [c.id + mate.id + Math.floor(race.lap / 8)]: true };
    raise(race, { type: 'orders', carId: c.id, mateId: mate.id, text: `${c.short} is faster than teammate ${mate.short} and stuck behind (gap ${(c.total - mate.total).toFixed(1)}s). Issue team orders?` });
  }
}

export function raise(race, p) { race.pending.push({ ...p, id: race.pending.length + '_' + race.lap, lap: race.lap, shown: false }); }

function finishRace(race) {
  race.finished = true;
  const order = updateOrder(race);
  // mandatory compound penalty (dry races)
  const wetRace = race.weather.wet.some((w) => w > 0.14);
  if (!wetRace) for (const c of order) if (!c.dnf && new Set(c.compoundsUsed.filter((x) => DRY.includes(x))).size < 2) { c.total += 20; c.penalty += 20; pushLog(race, race.laps, `${c.name}: +20s penalty — did not use two dry compounds.`, 'bad', c.id); }
  updateOrder(race);
  race.wetRace = wetRace;
}

// Player actions ------------------------------------------------------------
export const actions = {
  pit(race, carId, compound, opts = {}) { const c = carById(race, carId); if (!c || c.dnf || c.finished) return; c.pitReq = { c: compound, ...opts }; radio(race, c, `Copy, box this lap for ${COMPOUNDS[compound].name}s.`); },
  cancelPit(race, carId) { const c = carById(race, carId); if (c) { c.pitReq = null; } },
  mode(race, carId, m) { const c = carById(race, carId); if (c && MODE[m]) c.mode = m; },
  ers(race, carId, m) { const c = carById(race, carId); if (c && ERS[m]) c.ers = m; },
  auto(race, carId, v) { const c = carById(race, carId); if (c) c.autoPlan = v; },
  orders(race, carId, mateId, kind) {
    const c = carById(race, carId), m = carById(race, mateId); if (!c || !m) return;
    if (kind === 'swap') { m.orders = 'letby'; c.orders = null; pushLog(race, race.lap, `Team orders: ${m.name} to let ${c.name} through.`, 'warn'); radio(race, m, 'Understood… letting him by. Not happy.'); m.drv.morale = (m.drv.morale ?? 70) - 6 * (1.2 - (PERSONALITIES[m.drv.pers]?.orders ?? 0.8)); race.ordersIssued = (race.ordersIssued || 0) + 1; }
    else if (kind === 'hold') { c.orders = 'hold'; m.orders = null; pushLog(race, race.lap, 'Team orders: hold positions.', 'info'); c.drv.morale = (c.drv.morale ?? 70) - 3 * (1.2 - (PERSONALITIES[c.drv.pers]?.orders ?? 0.8)); }
    else { c.orders = null; m.orders = null; pushLog(race, race.lap, 'Team orders: drivers free to race.', 'info'); }
  },
};
