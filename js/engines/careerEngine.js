// Career systems: development, manufacturing, finance, staff, drivers, sponsors, board, AI, events, regulations, seasons.
import { wearRace, fitNew, resetSeason, COMP } from './components.js';
import { RNG, hashStr } from '../sim/rng.js';
import { clamp, avg, money, round } from '../sim/util.js';
import { CAR_ATTRS, ATTR_LABEL, PHILOSOPHIES, PROFILES } from '../data/teams.js';
import { PROJECTS, APPROACHES, FACILITIES, SPONSOR_POOL, REGULATIONS, EVENTS, ATR_TABLE, COST_CAP, DEPARTMENTS, OBJ_TEXT } from '../data/content.js';
import { DRIVERS } from '../data/drivers.js';
import { trackById } from '../data/tracks.js';
import { ensureSchedule, raceDue, YEAR_WEEKS, nextRaceWeek, weekLabel } from './calendarEngine.js';
import { deptQ, facLvl, correlationQuality, genStaff, genStaffMarket, driverSalary, driverRating, DIFFICULTY, POINTS, pickCalendar, seasonObjectives } from './world.js';

const rngOf = (state, salt) => { const r = new RNG((state.rngS ^ hashStr(String(salt))) >>> 0); return r; };
const commit = (state, r) => { state.rngS = (state.rngS * 1664525 + 1013904223 + r.s) >>> 0; };
export const pt = (s) => s.teams[s.player];
export const FATIGUE_BASE = 20; // every department settles at this fatigue level when not developing
export function note(state, sev, text) { state.inbox.unshift({ sev, text, round: state.round, season: state.season }); if (state.inbox.length > 80) state.inbox.pop(); }
export function ledger(state, cat, amount, text, capped = true) {
  const t = pt(state); t.cash += amount;
  if (amount < 0 && capped) t.budgetSpent += -amount;
  state.ledger.unshift({ season: state.season, round: state.round, cat, amount: Math.round(amount), text });
  if (state.ledger.length > 300) state.ledger.pop();
}
const diffOf = (s) => DIFFICULTY[s.difficulty] || DIFFICULTY.standard;

// ---------------- Standings ----------------
export function standings(state) {
  const teams = Object.values(state.teams).map((t) => ({ id: t.id, pts: t.points || 0, name: t.name, color: t.color, abbr: t.abbr, best: bestFinish(state, t.id) })).sort((a, b) => b.pts - a.pts || a.best - b.best);
  const drivers = Object.values(state.drivers).filter((d) => d.teamId || d.seasonPts).map((d) => ({ id: d.id, name: d.name, teamId: d.teamId, pts: d.seasonPts || 0 })).filter((d) => d.teamId || d.pts).sort((a, b) => b.pts - a.pts);
  return { teams, drivers };
}
function bestFinish(state, tid) { let b = 99; for (const r of state.results) for (const row of r.rows) if (row.teamId === tid && !row.dnf) b = Math.min(b, row.pos); return b; }
export const teamPos = (state, tid) => standings(state).teams.findIndex((t) => t.id === tid) + 1;

// ---------------- Race result application ----------------
export function applyRaceResult(state) {
  const wk = state.weekend; const res = wk.result; const r = rngOf(state, 'res' + state.round + state.season);
  const rc = wk.race;
  const fl = rc ? rc.cars.flatMap((c) => c.laps.slice(1).map((t) => ({ did: c.id, t }))).filter((x) => Number.isFinite(x.t)).sort((a, b) => a.t - b.t)[0] : null;
  state.results.push({ round: state.round, season: state.season, year: state.year, week: state.week, trackId: res.trackId, wet: res.wet,
    rows: res.rows.map((x) => { const c = rc?.cars.find((y) => y.id === x.did); return { ...x, stints: x.stints.map((s) => s.c), stops: c ? c.stops.map((st) => ({ lap: st.lap, to: st.to, total: st.total })) : [], laps: c?.lapsDone, inc: c ? c.incidents.map((i) => `L${i.lap} ${i.text}`) : [] }; }),
    laps: rc?.laps, sc: rc?.sc?.count || 0, vsc: rc?.sc?.vscCount || 0, overtakes: rc?.stats?.overtakes || 0,
    air: wk.weather?.airTemp, track: wk.weather?.trackTemp, maxWet: Math.round(Math.max(...(wk.weather?.wet || [0])) * 100),
    pole: wk.grid?.[0], fastest: fl ? { did: fl.did, t: fl.t } : null,
    log: (rc?.log || []).filter((l) => l.sev === 'bad' || l.sev === 'warn').slice(-25).map((l) => `L${l.lap}: ${l.text}`) });
  for (const row of res.rows) {
    const d = state.drivers[row.did]; const t = state.teams[row.teamId];
    d.seasonPts = (d.seasonPts || 0) + row.pts; t.points = (t.points || 0) + row.pts;
    d.stats.starts++; if (row.pos === 1 && !row.dnf) d.stats.wins++; if (row.pos <= 3 && !row.dnf) d.stats.podiums++; d.stats.points += row.pts;
    t.results.push(row.pos);
  }
  const P = pt(state);
  const mine = res.rows.filter((x) => x.teamId === state.player);
  // achievements
  const ach = (id) => { if (!state.achievements[id]) { state.achievements[id] = { season: state.season, round: state.round }; note(state, 'good', `Achievement unlocked: ${id.replace('ach_', '').replace('_', ' ')}`); } };
  ach('ach_first_race');
  if (mine.some((x) => x.pts > 0)) ach('ach_points');
  if (mine.some((x) => x.pos <= 3 && !x.dnf)) ach('ach_podium');
  if (mine.some((x) => x.pos === 1 && !x.dnf)) ach('ach_win');
  if (mine.filter((x) => x.pos <= 2 && !x.dnf).length === 2) ach('ach_one_two');
  if (wk.grid && P.drivers.includes(wk.grid[0])) { ach('ach_pole'); state.stats.poles++; }
  if (res.wet && mine.some((x) => x.pts > 0)) ach('ach_wet_win');
  state.stats.races++; state.stats.points += mine.reduce((a, x) => a + x.pts, 0);
  state.stats.wins += mine.filter((x) => x.pos === 1 && !x.dnf).length; state.stats.podiums += mine.filter((x) => x.pos <= 3 && !x.dnf).length;
  // undercut achievement: position gained across own stop
  const race = wk.race;
  for (const c of race.cars.filter((c) => c.isPlayer)) if (c.stops.length && c.posHist.length > 3) { const i = c.stops[0].lap; if (c.posHist[Math.min(c.posHist.length - 1, i + 3)] < c.posHist[Math.max(0, i - 1)]) ach('ach_undercut'); }
  // driver morale & confidence
  for (const did of P.drivers) {
    const d = state.drivers[did]; const row = res.rows.find((x) => x.did === did); const mate = res.rows.find((x) => x.teamId === state.player && x.did !== did);
    const car = race.cars.find((c) => c.id === did);
    let dm = row.pts > 0 ? 3 : -1; if (mate && row.pos < mate.pos) dm += 2; else dm -= 1; if (row.dnf && /failure|fault/i.test(row.dnf)) dm -= 3;
    d.morale = clamp((car?.drv.morale ?? d.morale) + dm, 10, 100);
    d.confidence = clamp(d.confidence + (row.pos <= wk.grid.indexOf(did) + 1 ? 2 : -2) + (row.dnf === 'Crashed' ? -6 : 0), 10, 100);
  }
  // AI driver morale drifts
  for (const d of Object.values(state.drivers)) if (d.teamId !== state.player) d.morale = clamp(d.morale + r.range(-2, 2), 30, 95);
  // AI memory: undercuts suffered from player
  if (state.mode !== 'career') { state.phase = 'quickDone'; commit(state, r); return; }
  // PU & gearbox component wear (forced replacements may cost grid places)
  P.drivers.forEach((did, slot) => {
    const c = race.cars.find((x) => x.id === did);
    const forced = wearRace(state, P, slot, trackById(wk.trackId), state.raceLength || 0.35, c?.dnf || '');
    for (const k of forced) { const pen = fitNew(state, P, slot, k); note(state, pen ? 'warn' : 'info', `${state.drivers[did].name}: ${COMP[k].name} worn out and replaced${pen ? ` — beyond the allocation, ${pen}-place grid penalty next race` : ''}.`); }
  });
  // driver training programmes
  for (const did of P.drivers) { const d = state.drivers[did]; const tr = d.training; if (!tr) continue; for (const k of TRAINING[tr.k].stats) d[k] = clamp(round(d[k] + TRAINING[tr.k].gain * (d[k] < d.pot ? 1 : 0.3), 1), 40, 99); tr.left--; if (tr.left <= 0) { note(state, 'good', `${d.name} completed ${TRAINING[tr.k].label}.`); d.training = null; } }
  // finance
  const diff = diffOf(state);
  const pos = teamPos(state, state.player);
  const sf = 12 / state.calendar.length; // annualised per-race payments
  ledger(state, 'Income', sf * 1.6e6 + (10 - pos) * 0.25e6 * sf, 'Commercial rights distribution', false);
  for (const s of state.sponsors) {
    const pay = s.perRace * sf * (0.6 + 0.4 * s.sat / 100);
    ledger(state, 'Sponsors', pay, `${s.name} payment`, false);
    const met = sponsorMet(s, mine);
    s.sat = clamp(s.sat + (met ? 6 : -5) + (s.volatile ? r.range(-6, 6) : 0), 0, 100);
    if (met) ledger(state, 'Sponsors', s.bonus, `${s.name} objective bonus`, false);
    s.racesLeft--;
  }
  const expired = state.sponsors.filter((s) => s.racesLeft <= 0 || s.sat < 12);
  expired.forEach((s) => note(state, s.sat < 12 ? 'bad' : 'warn', s.sat < 12 ? `${s.name} terminated their contract due to dissatisfaction.` : `${s.name} contract expired.`));
  state.sponsors = state.sponsors.filter((s) => !expired.includes(s));
  const len = state.calendar.length;
  const drvSal = P.drivers.reduce((a, id) => a + state.drivers[id].contract.salary, 0) / len;
  ledger(state, 'Drivers', -drvSal, 'Driver salaries', false);
  const staffSal = (Object.values(P.depts).reduce((a, d) => a + d.head.salary + d.headcount * 0.45e6, 0) + P.td.salary) / len * diff.cost;
  ledger(state, 'Staff', -staffSal, 'Staff payroll');
  const upkeep = Object.entries(P.facilities).reduce((a, [k, l]) => a + FACILITIES[k].upkeep * l, 0) / len * 2;
  ledger(state, 'Facilities', -upkeep, 'Facility operating costs');
  ledger(state, 'Operations', -1.1e6 * sf * diff.cost, 'Race operations & logistics');
  const crashes = race.cars.filter((c) => c.isPlayer && (c.dnf === 'Crashed' || c.dnf === 'Collision damage')).length;
  const dmg = race.cars.filter((c) => c.isPlayer).reduce((a, c) => a + c.incidents.filter((i) => /damage|excursion/i.test(i.text)).length, 0);
  if (crashes || dmg) ledger(state, 'Damage', -(crashes * 1.6e6 + dmg * 0.35e6) * diff.cost, 'Crash & damage repairs');
  // morale of departments from results
  const good = mine.some((x) => x.pts > 0);
  for (const d of Object.values(P.depts)) d.morale = clamp(d.morale + (good ? 1.5 : -1), 15, 100);
  const slowStops = race.cars.filter((c) => c.isPlayer).flatMap((c) => c.stops).filter((s) => s.stat > 4.5).length;
  if (slowStops) P.depts.ops.morale = clamp(P.depts.ops.morale - 2 * slowStops, 10, 100);
  P.depts.ops.fatigue = clamp(P.depts.ops.fatigue + 3 + crashes * 4, 0, 100);
  // board
  const expected = state.board.target * 2 + 1;
  const avgFin = avg(mine.map((x) => (x.dnf ? 20 : x.pos)));
  let bd = clamp((expected - avgFin) * 0.9, -6, 6) * (avgFin > expected ? 1 / state.board.patience : 1);
  if (P.cash < 0) bd -= 2;
  state.board.confidence = clamp(state.board.confidence + bd, 0, 100);
  // memory for AI: which AI teams lost positions to player stops
  for (const t of Object.values(state.teams)) if (!t.isPlayer && t.memory) t.memory.undercutsSuffered += race.cars.filter((c) => c.isPlayer && c.stops.length).length ? 0.1 : 0;
  // board critical
  if (state.board.confidence < 8 && !state.gameOver) { state.gameOver = { reason: 'fired', text: 'The board has lost confidence and relieved you of your duties.' }; }
  if (P.cash < -40e6 && !state.gameOver) state.gameOver = { reason: 'bankrupt', text: 'The team has entered administration after running out of cash.' };
  commit(state, r);
  state.round++;
  state.weekend = null;
  // the race week itself still counts as factory time; afterwards the player advances week by week
  ensureSchedule(state);
  weekTick(state); state.week = Math.min(YEAR_WEEKS, (state.week || 1) + 1);
  if (state.round >= state.calendar.length) note(state, 'info', `Final race done. Off-season until the year closes (week ${YEAR_WEEKS}). Plan next year's car, staff and drivers.`);
}
// ---------------- Week-by-week calendar ----------------
export function advanceWeek(state) {
  ensureSchedule(state);
  if (state.phase === 'review') return;
  if (state.round < state.calendar.length && raceDue(state)) return 'race';
  if (state.week >= YEAR_WEEKS) { seasonEnd(state); return 'end'; }
  weekTick(state);
  state.week++;
  if (state.week === state.schedule.devOpen) note(state, 'good', 'Development window is open: upgrade projects can start.');
  if (state.week === state.schedule.testing) note(state, 'info', 'Pre-season testing this week — the car runs for the first time.');
  return state.pendingEvent ? 'event' : 'ok';
}
export function advanceToRace(state, maxWeeks = 60) {
  let g = 0; let r = 'ok';
  while (g++ < maxWeeks && state.round < state.calendar.length && !raceDue(state)) { r = advanceWeek(state); if (r === 'event') break; }
  return r;
}
export function closeYear(state) {
  let g = 0; while (state.phase !== 'review' && g++ < 60) { const r = advanceWeek(state); if (r === 'end') break; if (state.pendingEvent) state.pendingEvent = null; }
}
export function weekTick(state) { return betweenRaces(state, 1); }
function sponsorMet(s, mine) {
  if (s.objective === 'points') return mine.filter((x) => x.pts > 0).length >= s.target;
  if (s.objective === 'top') return mine.some((x) => !x.dnf && x.pos <= s.target);
  return mine.filter((x) => !x.dnf).length >= s.target;
}

// ---------------- Between races ----------------
export function betweenRaces(state, weeks = 2) {
  const r = rngOf(state, 'wk' + state.round + state.season + ':' + (state.week || 0));
  const pk = weeks / 2; // event probabilities were tuned per 2-week gap
  const P = pt(state); const diff = diffOf(state);
  for (let w = 0; w < weeks; w++) { progressProjects(state, r); progressFacilities(state); }
  // staff fatigue/morale
  const active = state.projects.filter((p) => p.stage === 'design' || p.stage === 'manufacturing').length;
  for (const [k, d] of Object.entries(P.depts)) {
    const load = state.projects.filter((p) => (p.stage === 'design' && p.dept === k) || (p.stage === 'manufacturing' && k === 'mfg')).length;
    // workload from the SIZE of the work (both-car sets, aggressive concepts and long projects weigh more)
    const size = state.projects.filter((p) => (p.stage === 'design' && p.dept === k) || (p.stage === 'manufacturing' && k === 'mfg'))
      .reduce((a, p) => a + (p.qty === 1 ? 0.7 : 1) * ({ conservative: 0.8, standard: 1, aggressive: 1.35 }[p.approach] || 1) * clamp((p.totalWeeks || 4) / 4, 0.6, 1.8), 0);
    d.workload = clamp(25 + size * 32 / Math.max(1, d.headcount / 3) + (P.crunch && load ? 25 : 0), 0, 140);
    const tol = d.head.spec === 'Motivator' ? 2 : 0;
    const BASE = FATIGUE_BASE;
    if (!load && !P.crunch) d.fatigue = Math.max(BASE, d.fatigue - (4 + tol) * weeks); // idle: recover back to the common baseline
    else d.fatigue = clamp(d.fatigue + ((d.workload - 55) * 0.07 - tol) * weeks, BASE - 5, 100);
    const pay = d.head.salary > (0.25 + (d.head.skill / 100) ** 3 * 3.2) * 1e6 ? 0.5 : -0.3;
    d.morale = clamp(d.morale + (70 - d.morale) * 0.05 - Math.max(0, d.fatigue - 50) * 0.08 + pay + (P.facilities ? avg(Object.values(P.facilities)) - 2.5 : 0) * 0.2, 10, 100);
    d.head.fatigue = d.fatigue; d.head.morale = d.morale;
    // skill growth
    if (d.head.skill < d.head.potential && r.chance(0.12 * pk)) d.head.skill++;
    if (d.head.age > 58 && r.chance(0.06 * pk)) d.head.skill--;
  }
  if (active === 0) P.crunch = false;
  if (P.crunch) ledger(state, 'Staff', -0.3e6 * weeks, 'Crunch overtime & night shifts');
  // AI development
  if (r.chance(pk)) aiDevelop(state, r);
  // driver development (player's coach)
  for (const did of P.drivers) growDriver(state.drivers[did], deptQ(P, 'drv') + facLvl(P, 'simulator') * 4, r, 0.18 * pk);
  // poaching
  if (r.chance(0.12 * pk * diff.events)) {
    const cands = Object.entries(P.depts).filter(([, d]) => d.head.skill > 68);
    if (cands.length && !state.pendingEvent) {
      const [k, d] = r.pick(cands); const rival = r.pick(Object.values(state.teams).filter((t) => !t.isPlayer));
      const offer = Math.round(d.head.salary * r.range(1.3, 1.7) / 1e4) * 1e4;
      state.pendingEvent = { kind: 'poach', dept: k, rivalId: rival.id, offer, title: `${rival.name} approach your ${DEPARTMENTS[k].role}`, text: `${d.head.name} (skill ${d.head.skill}) has an offer of ${money(offer)}/yr from ${rival.name}. Loyalty: ${d.head.loyalty}.` };
    }
  }
  // random event
  if (!state.pendingEvent && r.chance(0.38 * pk * diff.events)) {
    const recent = state._recentEvents || [];
    const pool = EVENTS.filter((e) => !recent.includes(e.id));
    const e = r.pick(pool.length ? pool : EVENTS);
    state.pendingEvent = { kind: 'event', id: e.id };
    state._recentEvents = [e.id, ...recent].slice(0, 5);
  }
  // regulation announcement mid-season
  const len = state.calendar.length;
  if (!state.regulation.announced && state.round >= Math.floor(len / 2)) {
    const reg = r.pick(REGULATIONS);
    state.regulation = { next: reg.id, announced: true };
    note(state, 'warn', `REGULATIONS: "${reg.name}" confirmed for next season. ${reg.desc}`);
  }
  // sponsor offers
  if (state.sponsors.length < 4 && r.chance(0.5 * pk)) {
    const have = new Set(state.sponsors.map((s) => s.id));
    const pool = SPONSOR_POOL.filter((s) => !have.has(s.id) && s.minRep <= P.rep + deptQ(P, 'com') * 0.2);
    if (pool.length) { const s = r.pick(pool); const offer = { ...s, perRace: s.perRace * (0.8 + deptQ(P, 'com') / 250) * r.range(0.85, 1.15), racesLeft: len - state.round + r.int(0, len), sat: 60, expires: state.round + 2 }; state.sponsorOffers = [offer, ...state.sponsorOffers.filter((o) => o.id !== s.id && o.expires > state.round)].slice(0, 3); note(state, 'info', `${s.name} has made a sponsorship offer.`); }
  }
  state.sponsorOffers = state.sponsorOffers.filter((o) => o.expires >= state.round);
  // staff market churn
  if (r.chance(0.3 * pk)) { state.staffMarket.shift(); state.staffMarket.push(...genStaffMarket(r, 1)); }
  // cash crisis
  const remind = weeks > 1 || (state.week || 0) % 4 === 0;
  if (remind && P.cash < 0) note(state, 'bad', `Cash is negative (${money(P.cash)}). Consider a loan, sponsor advance, or cutting costs.`);
  if (remind && P.budgetSpent > COST_CAP * 0.9) note(state, 'warn', `Cost-cap spending at ${Math.round(P.budgetSpent / COST_CAP * 100)}%. Exceeding it brings a points deduction.`);
  if (remind && state.board.confidence < 25) note(state, 'bad', `Board confidence is critical (${Math.round(state.board.confidence)}). Results are needed.`);
  commit(state, r);
}

// ---------------- Development ----------------
export function projectPreview(state, tplId, approach, qty = 2) {
  const P = pt(state); const tpl = PROJECTS.find((p) => p.id === tplId); const A = APPROACHES[approach];
  const q = deptQ(P, tpl.dept); const fac = facLvl(P, tpl.fac);
  const ph = PHILOSOPHIES[P.philosophy] || PHILOSOPHIES.balanced;
  const bias = ph.devBias.some((a) => tpl.effects[a]) ? 1.12 : 1;
  const pos = teamPos(state, state.player);
  const atr = tpl.aero ? ATR_TABLE[clamp(pos - 1, 0, 9)] : 1;
  const qual = (0.55 + q / 180 + fac * 0.06) * bias * atr;
  const speed = (0.6 + q / 200 + facLvl(P, 'rnd') * 0.08) * (ph.devSpeed || 1) * (1 - (P.nextYearFocus || 0) * 0.6) * (1 - P.depts[tpl.dept].fatigue / 250);
  const weeks = Math.max(1, Math.round(tpl.weeks * A.time / speed));
  const expected = {}; for (const [k, v] of Object.entries(tpl.effects)) expected[k] = v * A.gain * qual;
  for (const [k, v] of Object.entries(tpl.side)) expected[k] = (expected[k] || 0) + v * A.side;
  const corr = correlationQuality(P, !!tpl.aero);
  const unc = A.sd * (1.35 - corr);
  const specFail = { 'Process-driven': 0.6, Innovator: 1.3 }[P.depts[tpl.dept].head.spec] || 1;
  const failP = clamp(A.fail * (1.4 - q / 100) * specFail * (1 + P.depts[tpl.dept].fatigue / 100) * (P.crunch ? 1.3 : 1), 0.01, 0.5);
  const cost = tpl.cost * A.cost * diffOf(state).cost * (P.depts[tpl.dept].head.spec === 'Pragmatist' ? 0.9 : 1);
  const mfgCost = tpl.mfg * qty * diffOf(state).cost;
  const mfgWeeks = Math.max(1, Math.round((tpl.weeks / 2.5) / (0.6 + deptQ(P, 'mfg') / 200 + facLvl(P, 'factory') * 0.08)));
  return { tpl, A, expected, unc, failP, cost, mfgCost, weeks, mfgWeeks, corr, atr, qty };
}
export function startProject(state, tplId, approach, qty = 2) {
  const P = pt(state); const pv = projectPreview(state, tplId, approach, qty);
  const maxActive = 2 + Math.floor(facLvl(P, 'rnd') / 2);
  const active = state.projects.filter((p) => p.stage === 'design' || p.stage === 'manufacturing').length;
  if (active >= maxActive) return { ok: false, msg: `Design capacity full (${maxActive} active projects). Upgrade the R&D Centre for more.` };
  if (state.projects.some((p) => p.tplId === tplId && ['design', 'manufacturing', 'ready'].includes(p.stage))) return { ok: false, msg: 'That project is already in progress.' };
  const r = rngOf(state, 'prj' + tplId + state.round + state.projects.length);
  const failed = r.chance(pv.failP);
  const actual = {};
  const noise = r.normal(0, 1);
  for (const [k, v] of Object.entries(pv.expected)) actual[k] = failed ? (v > 0 ? -v * r.range(0.1, 0.5) : v * 1.5) : v * (1 + noise * pv.unc * 1.2 + r.normal(0, 0.1));
  if (failed) actual.reliability = (actual.reliability || 0) - r.range(0.5, 1.5);
  const detectP = pv.corr * 0.8;
  const p = { id: 'p' + Date.now().toString(36) + r.int(0, 999), tplId, name: pv.tpl.name, dept: pv.tpl.dept, approach, qty, stage: 'design', weeksLeft: pv.weeks, totalWeeks: pv.weeks, mfgWeeks: pv.mfgWeeks, expected: pv.expected, unc: pv.unc, actual, failed, detectable: r.chance(detectP), cost: pv.cost, mfgCost: pv.mfgCost, revealed: false, startedRound: state.round, season: state.season, aero: !!pv.tpl.aero };
  ledger(state, 'Development', -pv.cost, `Design: ${p.name} (${APPROACHES[approach].label})`);
  state.projects.unshift(p);
  commit(state, r);
  return { ok: true, project: p };
}
function progressProjects(state, r) {
  for (const p of state.projects) {
    if (p.stage === 'design') {
      p.weeksLeft--; if (pt(state).crunch && r.chance(0.3)) p.weeksLeft--; // crunch: extra progress ~30% of weeks
      if (p.weeksLeft <= 0) {
        if (p.failed && p.detectable) { p.stage = 'failed'; note(state, 'bad', `${p.name}: prototype failed validation — the concept did not deliver. Design cost lost, but no bad parts reach the car.`); continue; }
        p.stage = 'manufacturing'; p.weeksLeft = p.mfgWeeks + (state._mfgDelay || 0);
        ledger(state, 'Manufacturing', -p.mfgCost, `Manufacture ${p.qty} set(s): ${p.name}`);
        note(state, 'info', `${p.name}: design complete, now in manufacturing (${p.weeksLeft} wk).`);
      }
    } else if (p.stage === 'manufacturing') {
      p.weeksLeft--;
      const P = pt(state);
      if (r.chance(0.04 + P.depts.mfg.fatigue * 0.001 - facLvl(P, 'factory') * 0.005)) { p.weeksLeft++; note(state, 'warn', `${p.name}: manufacturing defect found — one week delay.`); }
      if (p.weeksLeft <= 0) { p.stage = 'ready'; note(state, 'good', `${p.name}: parts ready to deploy.`); }
    }
  }
  state._mfgDelay = 0;
}
export function deployProject(state, pid, slot = null) {
  const p = state.projects.find((x) => x.id === pid); const P = pt(state);
  if (!p || p.stage !== 'ready') return;
  if (p.qty >= 2 || slot == null) { for (const [k, v] of Object.entries(p.actual)) P.car[k] = clamp(P.car[k] + v, 20, 110); p.slot = null; }
  else { const m = P.carMods[slot]; for (const [k, v] of Object.entries(p.actual)) m[k] = (m[k] || 0) + v; p.slot = slot; }
  p.stage = 'deployed'; p.deployedRound = state.round;
  const better = Object.keys(p.expected).reduce((a, k) => a + (p.actual[k] || 0) - p.expected[k], 0) > 0;
  if (better && !p.failed) { if (!state.achievements.ach_upgrade) state.achievements.ach_upgrade = { season: state.season, round: state.round }; }
  note(state, 'info', `${p.name} fitted${p.slot != null ? ' to ' + state.drivers[P.drivers[p.slot]].name + "'s car only" : ' to both cars'}. Real gain unknown until measured (correlation run or race).`);
}
export function buildSecondSet(state, pid) {
  const p = state.projects.find((x) => x.id === pid); const P = pt(state);
  if (!p || p.stage !== 'deployed' || p.slot == null) return;
  const other = p.slot === 0 ? 1 : 0;
  for (const [k, v] of Object.entries(p.actual)) { P.carMods[p.slot][k] = (P.carMods[p.slot][k] || 0) - v; P.car[k] = clamp(P.car[k] + v, 20, 110); }
  ledger(state, 'Manufacturing', -p.mfgCost, `Second set: ${p.name}`);
  p.slot = null; p.qty = 2; note(state, 'info', `${p.name}: second set built — both cars now equal.`); void other;
}
export function revealAfterRace(state) { for (const p of state.projects) if (p.stage === 'deployed' && !p.revealed && p.deployedRound < state.round) { p.revealed = true; } }

// ---------------- Facilities ----------------
export function upgradeFacility(state, key) {
  const P = pt(state); const F = FACILITIES[key]; const lvl = P.facilities[key];
  if (lvl >= 5) return { ok: false, msg: 'Already at maximum level.' };
  if (P.facilityBuilds.some((b) => b.key === key)) return { ok: false, msg: 'Already under construction.' };
  const cost = F.cost * (1 + lvl * 0.35) * diffOf(state).cost;
  if (P.cash < cost * 0.5) return { ok: false, msg: 'Insufficient funds (need at least half the cost in cash).' };
  ledger(state, 'Facilities', -cost, `Upgrade ${F.label} to L${lvl + 1}`, false);
  P.facilityBuilds.push({ key, weeksLeft: F.weeks + lvl, total: F.weeks + lvl });
  // construction disrupts the relevant department briefly
  return { ok: true };
}
export const facilityCost = (state, key) => FACILITIES[key].cost * (1 + pt(state).facilities[key] * 0.35) * diffOf(state).cost;
function progressFacilities(state) {
  const P = pt(state);
  for (const b of P.facilityBuilds) { b.weeksLeft--; if (b.weeksLeft <= 0) { P.facilities[b.key]++; note(state, 'good', `${FACILITIES[b.key].label} upgraded to level ${P.facilities[b.key]}.`); if (P.facilities[b.key] >= 4) state.achievements.ach_facility ||= { season: state.season, round: state.round }; } }
  P.facilityBuilds = P.facilityBuilds.filter((b) => b.weeksLeft > 0);
}

// ---------------- Staff ----------------
export function hireStaff(state, staffId) {
  const P = pt(state); const s = state.staffMarket.find((x) => x.id === staffId); if (!s) return { ok: false };
  const fee = s.salary * 0.5;
  if (P.cash < fee) return { ok: false, msg: 'Cannot afford the signing fee.' };
  ledger(state, 'Staff', -fee, `Signing fee: ${s.name}`);
  if (s.dept === 'td') { const old = P.td; P.td = { ...s, role: 'Technical Director' }; ledger(state, 'Staff', -old.salary * 0.3, `Severance: ${old.name}`); }
  else { const d = P.depts[s.dept]; const old = d.head; d.head = { ...s }; ledger(state, 'Staff', -old.salary * 0.3, `Severance: ${old.name}`); d.morale = clamp(d.morale + (s.skill - old.skill) * 0.2 + (s.leadership - 60) * 0.05, 10, 100); }
  state.staffMarket = state.staffMarket.filter((x) => x.id !== staffId);
  note(state, 'good', `${s.name} joins as ${s.role}.`);
  return { ok: true };
}
export function changeHeadcount(state, key, delta) {
  const d = pt(state).depts[key]; const n = clamp(d.headcount + delta, 1, 10); if (n === d.headcount) return;
  if (delta < 0) { d.morale = clamp(d.morale - 6, 10, 100); ledger(state, 'Staff', -0.2e6, `Redundancy costs (${DEPARTMENTS[key].label})`); } else { ledger(state, 'Staff', -0.15e6, `Recruitment (${DEPARTMENTS[key].label})`); d.fatigue = clamp(d.fatigue - 8, 0, 100); }
  d.headcount = n;
}
export function giveRaise(state, key) { const d = pt(state).depts[key]; d.head.salary = Math.round(d.head.salary * 1.15 / 1e4) * 1e4; d.morale = clamp(d.morale + 8, 0, 100); d.head.loyalty = clamp(d.head.loyalty + 8, 0, 100); }
export function giveBreak(state, key) { const d = pt(state).depts[key]; d.fatigue = clamp(d.fatigue - 25, 0, 100); d.morale = clamp(d.morale + 3, 0, 100); for (const p of state.projects) if (p.dept === key && p.stage === 'design') p.weeksLeft++; }

// ---------------- Events ----------------
export function resolveEvent(state, optIdx) {
  const ev = state.pendingEvent; if (!ev) return; const P = pt(state); const r = rngOf(state, 'ev' + state.round);
  if (ev.kind === 'poach') {
    const d = P.depts[ev.dept];
    if (optIdx === 0) { d.head.salary = ev.offer; d.head.loyalty = clamp(d.head.loyalty + 10, 0, 100); d.morale = clamp(d.morale + 3, 0, 100); note(state, 'info', `You matched the offer. ${d.head.name} stays.`); }
    else if (optIdx === 1) { const rival = state.teams[ev.rivalId]; const old = d.head; if (rival.depts?.[ev.dept]) rival.depts[ev.dept].head = { ...old }; d.head = genStaff(r, old.role, ev.dept, old.skill - 9); d.head.name = d.head.name + ' (promoted)'; d.morale = clamp(d.morale + 4, 0, 100); note(state, 'warn', `${old.name} leaves for ${rival.name}. Internal candidate ${d.head.name} promoted.`); }
    else { if (r.chance(d.head.loyalty / 130)) { note(state, 'good', `${d.head.name} rejected the rival offer out of loyalty.`); d.head.loyalty -= 10; } else { const rival = state.teams[ev.rivalId]; const old = d.head; if (rival.depts?.[ev.dept]) rival.depts[ev.dept].head = { ...old }; d.head = genStaff(r, old.role, ev.dept, old.skill - 15); d.morale -= 8; note(state, 'bad', `${old.name} left for ${rival.name}. A weaker replacement steps in.`); } }
  } else if (ev.kind === 'event') {
    const e = EVENTS.find((x) => x.id === ev.id); const fx = e.options[optIdx].fx;
    if (fx.cash) ledger(state, 'Events', fx.cash, e.title, fx.cash < 0);
    if (fx.morale) for (const d of Object.values(P.depts)) d.morale = clamp(d.morale + fx.morale, 0, 100);
    if (fx.fatigue) for (const d of Object.values(P.depts)) d.fatigue = clamp(d.fatigue + fx.fatigue, 0, 100);
    if (fx.engMorale) for (const k of ['aero', 'chassis', 'vd', 'pu', 'sim']) P.depts[k].morale = clamp(P.depts[k].morale + fx.engMorale, 0, 100);
    if (fx.opsMorale) P.depts.ops.morale = clamp(P.depts.ops.morale + fx.opsMorale, 0, 100);
    if (fx.driverMorale) for (const id of P.drivers) state.drivers[id].morale = clamp(state.drivers[id].morale + fx.driverMorale, 0, 100);
    if (fx.sponsorSat) for (const s of state.sponsors) s.sat = clamp(s.sat + fx.sponsorSat, 0, 100);
    if (fx.board) state.board.confidence = clamp(state.board.confidence + fx.board, 0, 100);
    if (fx.boardPatience) state.board.patience = Math.max(0.3, state.board.patience + fx.boardPatience);
    if (fx.devProgress) for (const p of state.projects) if (p.stage === 'design') p.weeksLeft = Math.max(0, p.weeksLeft - fx.devProgress);
    if (fx.correlation) P.correlationMod = clamp((P.correlationMod || 0) + fx.correlation, -0.3, 0.2);
    if (fx.mfgDelay) state._mfgDelay = fx.mfgDelay;
    if (fx.setupKnowledge) state.setupPenalty = fx.setupKnowledge;
    if (fx.carAttr) for (const [k, v] of Object.entries(fx.carAttr)) P.car[k] += v;
    if (fx.junior) { const id = 'drv_jr_x' + state.season + state.round; state.drivers[id] = { id, name: `${r.pick(['Luca', 'Mateo', 'Arvid', 'Rohan', 'Jules'])} ${r.pick(['Moretti', 'Lindahl', 'Varma', 'Santos', 'Dubreuil'])}`, nat: 'INT', age: 18, team: 'academy', teamId: null, academy: true, pace: 75, craft: 70, cons: 68, tyre: 70, wet: 72, fb: 68, start: 72, pot: 96, pers: 'aggressive', morale: 75, confidence: 70, form: 0, contract: { years: 3, salary: 0.6e6 }, stats: { starts: 0, wins: 0, podiums: 0, points: 0 } }; note(state, 'good', 'A new junior joins the academy.'); }
    if (fx.gamble && r.chance(fx.gamble)) { ledger(state, 'Events', -3e6, 'FIA fine'); P.car.medAero -= 1.5; note(state, 'bad', 'Race control ruled against you: $3M fine and forced floor modification.'); }
  } else if (ev.kind === 'loan') {
    // handled elsewhere
  }
  state.pendingEvent = null; commit(state, r);
}
export function takeLoan(state, amount) { const P = pt(state); ledger(state, 'Finance', amount, 'Emergency loan', false); state.loan = (state.loan || 0) + amount * 1.15; state.board.confidence = clamp(state.board.confidence - 5, 0, 100); note(state, 'warn', `Loan of ${money(amount)} taken. ${money(amount * 1.15)} is repaid at season end.`); void P; }
export function sponsorAdvance(state) { const P = pt(state); const tot = state.sponsors.reduce((a, s) => a + s.perRace * 2, 0); if (!tot) return; ledger(state, 'Sponsors', tot * 0.85, 'Sponsor advance (2 races, 15% discount)', false); state.sponsors.forEach((s) => { s.racesLeft = Math.max(1, s.racesLeft - 2); s.sat -= 5; }); void P; }
export function acceptSponsor(state, id) { const o = state.sponsorOffers.find((x) => x.id === id); if (!o || state.sponsors.length >= 4) return; state.sponsors.push({ ...o, sat: 62 }); state.sponsorOffers = state.sponsorOffers.filter((x) => x.id !== id); note(state, 'good', `${o.name} signed as a sponsor.`); }
export function negotiateSponsor(state, id) {
  const o = state.sponsorOffers.find((x) => x.id === id); if (!o || o.negotiated) return 'Already negotiated.';
  const r = rngOf(state, 'neg' + id + state.round); const P = pt(state); o.negotiated = true;
  const p = 0.35 + deptQ(P, 'com') / 250 + P.rep / 400;
  if (r.chance(p)) { o.perRace *= 1.15; commit(state, r); return `${o.name} accepted a 15% improvement.`; }
  if (r.chance(0.35)) { state.sponsorOffers = state.sponsorOffers.filter((x) => x.id !== id); commit(state, r); return `${o.name} walked away from negotiations.`; }
  commit(state, r); return `${o.name} held firm on their original offer.`;
}

// ---------------- Drivers ----------------
export const TRAINING = {
  sim: { label: 'Simulator programme', stats: ['pace', 'fb'], gain: 0.6, cost: 0.5e6, races: 3, desc: 'Pace and technical feedback.' },
  fitness: { label: 'Fitness & endurance', stats: ['cons'], gain: 0.9, cost: 0.35e6, races: 3, desc: 'Consistency, fewer late-race mistakes.' },
  wet: { label: 'Wet-weather sessions', stats: ['wet'], gain: 1.1, cost: 0.4e6, races: 3, desc: 'Confidence in rain.' },
  tyre: { label: 'Tyre-management clinic', stats: ['tyre'], gain: 1.0, cost: 0.4e6, races: 3, desc: 'Lower wear, longer stints.' },
  craft: { label: 'Racecraft coaching', stats: ['craft', 'start'], gain: 0.6, cost: 0.55e6, races: 3, desc: 'Overtaking, defending and starts.' },
};
export function startTraining(state, did, k) {
  const d = state.drivers[did]; const T = TRAINING[k]; if (!T) return { ok: false, msg: 'Unknown programme' };
  if (d.training) return { ok: false, msg: `${d.name} is already in a programme.` };
  if (pt(state).cash < T.cost) return { ok: false, msg: 'Not enough cash.' };
  ledger(state, 'Drivers', -T.cost, `${T.label}: ${d.name}`); d.training = { k, left: T.races };
  return { ok: true, msg: `${d.name} started ${T.label}.` };
}
export function fitComponent(state, slot, key) { const pen = fitNew(state, pt(state), slot, key); ledger(state, 'Technical', -0.25e6, `New ${COMP[key].name}`); return pen; }
export function growDriver(d, coachQ, r, rate = 0.25) {
  const ageF = d.age < 25 ? 1 : d.age < 30 ? 0.5 : d.age < 34 ? 0 : -0.8;
  for (const k of ['pace', 'craft', 'cons', 'tyre', 'wet', 'fb']) {
    const room = (d.pot - d[k]) / 20;
    const delta = rate * (ageF * (0.5 + coachQ / 150) * Math.max(0, room + (ageF < 0 ? 1 : 0))) + r.normal(0, 0.15);
    d[k] = clamp(round(d[k] + delta, 1), 40, 99);
  }
}
export function driverMarket(state) { return Object.values(state.drivers).filter((d) => d.teamId !== state.player && (d.teamId == null || true) && !d.retired && !d.academy); }
export function signDriver(state, did, replaceSlot, years = 2) {
  const P = pt(state); const d = state.drivers[did]; if (!d) return { ok: false, msg: 'Unknown driver' };
  const demand = driverSalary(d) * (d.teamId ? 1.25 : 1) * (1 + Math.max(0, 60 - P.rep) / 200);
  const buyout = d.teamId && !d.academy ? demand * 0.8 * d.contract.years : 0;
  const will = acceptChance(state, d);
  if (will < 0.2) return { ok: false, msg: `${d.name} is not interested in joining (team reputation/competitiveness too low).` };
  if (P.cash < buyout + demand * 0.2) return { ok: false, msg: 'Insufficient funds for buy-out and signing.' };
  if (buyout) ledger(state, 'Drivers', -buyout, `Contract buy-out: ${d.name}`, false);
  const out = state.drivers[P.drivers[replaceSlot]];
  if (out) { out.teamId = null; out.morale = 50; }
  if (d.teamId && state.teams[d.teamId]) { const t = state.teams[d.teamId]; const i = t.drivers.indexOf(did); if (i >= 0) { t.drivers[i] = out ? out.id : fillAI(state, t.id); if (out) out.teamId = t.id; } }
  d.teamId = P.id; d.academy = false; d.contract = { years, salary: Math.round(demand / 1e4) * 1e4 }; d.morale = 72;
  P.drivers[replaceSlot] = did;
  note(state, 'good', `${d.name} signed for ${years} year(s) at ${money(d.contract.salary)}/yr.`);
  return { ok: true };
}
export function acceptChance(state, d) {
  const P = pt(state); const pos = teamPos(state, P.id) || 5;
  const r = driverRating(d);
  return clamp(0.4 + P.rep / 200 + (10 - pos) * 0.04 - Math.max(0, r - 85) * 0.03 + (d.teamId ? -0.1 : 0.15), 0, 1);
}
function fillAI(state, tid) {
  const fa = Object.values(state.drivers).filter((x) => !x.teamId && !x.academy && !x.retired).sort((a, b) => driverRating(b) - driverRating(a))[0];
  if (fa) { fa.teamId = tid; return fa.id; }
  return null;
}
export function renewDriver(state, did, years) {
  const d = state.drivers[did]; const demand = driverSalary(d) * (d.morale < 50 ? 1.3 : 1.05);
  const ok = d.morale > 35 || acceptChance(state, d) > 0.6;
  if (!ok) return { ok: false, msg: `${d.name} refuses to extend (morale ${Math.round(d.morale)}).` };
  d.contract = { years: years + (state.phase === 'review' ? 1 : 0), salary: Math.round(demand / 1e4) * 1e4 }; d.morale = clamp(d.morale + 5, 0, 100);
  return { ok: true, msg: `${d.name} extended for ${years} year(s) at ${money(d.contract.salary)}/yr.` };
}
export function promoteJunior(state, did, slot) { const d = state.drivers[did]; if (!d?.academy) return { ok: false, msg: 'Not an academy driver' }; d.academy = false; d.contract = { years: 2, salary: 0.8e6 }; const P = pt(state); const out = state.drivers[P.drivers[slot]]; if (out) out.teamId = null; P.drivers[slot] = did; d.teamId = P.id; note(state, 'good', `${d.name} promoted from the academy.`); return { ok: true }; }

// ---------------- AI ----------------
function aiDevelop(state, r) {
  const diff = diffOf(state);
  const st = standings(state).teams;
  for (const t of Object.values(state.teams)) {
    if (t.isPlayer) continue;
    const pos = st.findIndex((x) => x.id === t.id) + 1;
    const fac = avg(Object.values(t.facilities)); const org = avg(Object.values(t.depts).map((d) => d.head.skill));
    const budget = { front: 1.15, challenger: 1.05, midfield: 0.95, back: 0.85 }[t.tier] || 1;
    const rate = 0.55 * budget * (0.5 + org / 120) * (0.6 + fac / 6) * diff.ai;
    const ph = PHILOSOPHIES[t.philosophy] || PHILOSOPHIES.balanced;
    const weakest = [...CAR_ATTRS].sort((a, b) => t.car[a] - t.car[b])[0];
    const areas = [r.pick(ph.devBias.length ? ph.devBias : CAR_ATTRS), weakest];
    const failed = r.chance(0.08 * (ph.risk + 0.5));
    for (const a of areas) {
      const atr = ['lowAero', 'medAero', 'highAero'].includes(a) ? ATR_TABLE[clamp(pos - 1, 0, 9)] : 1;
      const g = failed ? -rate * 0.4 : rate * r.range(0.2, 1.6) * atr;
      t.car[a] = clamp(t.car[a] + g, 20, 110);
    }
    if (!failed && r.chance(0.18)) state.news.unshift({ round: state.round, season: state.season, text: `${t.name} bring an upgrade targeting ${ATTR_LABEL[areas[0]].toLowerCase()}.` });
    if (failed && r.chance(0.5)) state.news.unshift({ round: state.round, season: state.season, text: `Paddock rumour: ${t.name}'s latest package isn't working as expected.` });
  }
  state.news = state.news.slice(0, 40);
}

// ---------------- Season end ----------------
export function seasonEnd(state) {
  const r = rngOf(state, 'season' + state.season);
  const P = pt(state); const st = standings(state);
  const pos = st.teams.findIndex((t) => t.id === P.id) + 1;
  const prize = (11 - pos) * 6e6 + 10e6;
  ledger(state, 'Income', prize, `Constructors' prize money (P${pos})`, false);
  if (state.loan) { ledger(state, 'Finance', -state.loan, 'Loan repayment', false); state.loan = 0; }
  // cost cap
  let capPen = 0;
  if (P.budgetSpent > COST_CAP) { capPen = Math.ceil((P.budgetSpent - COST_CAP) / 2e6) * 5; note(state, 'bad', `Cost cap breached by ${money(P.budgetSpent - COST_CAP)} — ${capPen}-point deduction applied to next season's start.`); }
  // objectives
  const objs = (state.board.objectives || []).map((o) => {
    let met = false;
    if (o.kind === 'cons') met = pos <= o.value;
    if (o.kind === 'cash') met = P.cash > o.value;
    if (o.kind === 'rel') met = state.results.filter((x) => x.season === state.season).flatMap((x) => x.rows).filter((x) => x.teamId === P.id && x.dnf && /failure|fault/i.test(x.dnf)).length < o.value;
    return { ...o, met };
  });
  const score = objs.reduce((a, o) => a + (o.met ? o.weight : -o.weight), 0);
  state.board.confidence = clamp(state.board.confidence + score * 5 * (score < 0 ? 1 / state.board.patience : 1), 0, 100);
  P.rep = clamp(P.rep + (state.board.target - pos) * 3 + (pos <= 3 ? 5 : 0), 5, 100);
  const champion = st.drivers[0]; const consChamp = st.teams[0];
  const review = {
    season: state.season, year: state.year, pos, points: P.points, prize, objectives: objs, capPen,
    drivers: P.drivers.map((id) => ({ id, name: state.drivers[id].name, pts: state.drivers[id].seasonPts || 0, pos: st.drivers.findIndex((d) => d.id === id) + 1 })),
    champion: { name: champion?.name, team: state.teams[champion?.teamId]?.name, pts: champion?.pts }, consChamp: { name: consChamp.name, pts: consChamp.pts },
    cash: P.cash, spent: P.budgetSpent, board: state.board.confidence, reg: state.regulation.next,
    table: st.teams.map((t) => ({ name: t.name, pts: t.pts, color: t.color })),
  };
  state.history.seasons.push(review);
  state.achievements.ach_season ||= { season: state.season };
  if (pos === 1) state.achievements.ach_champion ||= { season: state.season };
  if (state.board.confidence < 15 && !state.gameOver) state.gameOver = { reason: 'fired', text: `After finishing P${pos} (target P${state.board.target}), the board has decided to replace you.` };
  state.pendingCapPen = capPen;
  state.phase = 'review';
  state.review = review;
  commit(state, r);
}

export function startNextSeason(state) {
  const r = rngOf(state, 'next' + state.season);
  const P = pt(state);
  const reg = REGULATIONS.find((x) => x.id === state.regulation.next);
  for (const t of Object.values(state.teams)) {
    // merge per-car mods into base (parts carry to new chassis equally)
    for (const k of CAR_ATTRS) { const m = ((t.carMods[0][k] || 0) + (t.carMods[1][k] || 0)) / 2; t.car[k] += m; }
    t.carMods = [{}, {}];
    const focus = t.isPlayer ? P.nextYearFocus || 0 : r.range(0.1, 0.4);
    for (const k of CAR_ATTRS) {
      t.car[k] = t.car[k] + (72 - t.car[k]) * 0.08; // natural convergence
      if (reg && reg.attrs.includes(k)) {
        const regress = reg.regress * (1 - focus * 0.9);
        const deptBonus = t.depts?.[reg.area === 'aero' ? 'aero' : reg.area === 'pu' ? 'pu' : 'chassis'] ? deptQ(t, reg.area === 'aero' ? 'aero' : reg.area === 'pu' ? 'pu' : 'chassis') : 60;
        t.car[k] = t.car[k] + (68 - t.car[k]) * regress + focus * 4 + (deptBonus - 60) * 0.05 + r.normal(0, 1.2);
      }
      t.car[k] = clamp(round(t.car[k], 1), 30, 105);
    }
    t.points = 0; t.results = []; t.pu = [0, 0]; resetSeason(t); t.budgetSpent = 0;
  }
  if (reg) note(state, 'warn', `New regulations in force: ${reg.name}.`);
  // drivers: age, growth, contracts
  const drvCoach = deptQ(P, 'drv');
  for (const d of Object.values(state.drivers)) {
    d.age++; d.seasonPts = 0;
    growDriver(d, d.teamId === P.id || d.academy ? drvCoach : 55, r, d.academy ? 1.2 : 0.8);
    if (d.teamId) d.contract.years--;
    if (d.age >= 37 && r.chance(0.4) && d.teamId !== P.id) { d.retired = true; if (d.teamId && state.teams[d.teamId]) { const t = state.teams[d.teamId]; t.drivers = t.drivers.map((x) => (x === d.id ? null : x)); } d.teamId = null; state.news.unshift({ round: 0, season: state.season + 1, text: `${d.name} retires from racing.` }); }
  }
  // AI driver market: expired contracts may move
  for (const t of Object.values(state.teams)) {
    if (t.isPlayer) continue;
    t.drivers = t.drivers.map((id) => {
      const d = state.drivers[id];
      if (!d || d.retired) return null;
      if (d.contract.years <= 0) { if (r.chance(0.55)) { d.contract = { years: r.int(1, 3), salary: driverSalary(d) }; return id; } d.teamId = null; state.news.unshift({ round: 0, season: state.season + 1, text: `${d.name} leaves ${t.name}.` }); return null; }
      return id;
    });
  }
  for (const t of Object.values(state.teams)) {
    if (t.isPlayer) continue;
    for (let i = 0; i < 2; i++) if (!t.drivers[i]) {
      const pool = Object.values(state.drivers).filter((x) => !x.teamId && !x.retired && !x.academy).sort((a, b) => driverRating(b) - driverRating(a));
      let pick = t.tier === 'front' || t.tier === 'challenger' ? pool[0] : pool[r.int(0, Math.min(3, pool.length - 1))];
      if (!pick) { const g = { id: 'drv_gen' + state.season + t.id + i, name: `${r.pick(['Alex', 'Jon', 'Theo', 'Rico', 'Finn'])} ${r.pick(['Kerr', 'Mora', 'Heinz', 'Blake', 'Soto'])}`, nat: 'INT', age: 21, pace: 78, craft: 75, cons: 75, tyre: 76, wet: 75, fb: 72, start: 76, pot: 88, pers: 'teamplayer', morale: 70, confidence: 70, contract: { years: 2, salary: 0 }, stats: { starts: 0, wins: 0, podiums: 0, points: 0 } }; g.contract.salary = driverSalary(g); state.drivers[g.id] = g; pick = g; }
      pick.teamId = t.id; pick.contract = { years: r.int(1, 3), salary: driverSalary(pick) }; t.drivers[i] = pick.id;
      state.news.unshift({ round: 0, season: state.season + 1, text: `${pick.name} signs for ${t.name}.` });
    }
  }
  // player's expiring drivers leave if not renewed
  P.drivers.forEach((id, slot) => {
    const d = state.drivers[id];
    if (d && d.contract.years < 0) { /* already handled */ }
    if (d && d.contract.years <= 0 && !d._renewed) {
      d.teamId = null; note(state, 'bad', `${d.name}'s contract expired and he left the team.`);
      const pool = Object.values(state.drivers).filter((x) => !x.teamId && !x.retired && !x.academy).sort((a, b) => driverRating(b) - driverRating(a));
      const rep = pool[r.int(0, Math.min(4, pool.length - 1))]; if (rep) { rep.teamId = P.id; rep.contract = { years: 1, salary: driverSalary(rep) }; P.drivers[slot] = rep.id; note(state, 'warn', `${rep.name} drafted in on a one-year deal.`); }
    }
    if (d) delete d._renewed;
  });
  // staff contracts & ageing
  for (const t of Object.values(state.teams)) for (const d of Object.values(t.depts)) { d.head.age++; d.fatigue = Math.max(0, d.fatigue - 30); d.morale = clamp(d.morale + 5, 0, 100); }
  // sponsors & market refresh
  state.staffMarket = genStaffMarket(r, 10);
  state.sponsors.forEach((s) => { s.racesLeft = Math.max(s.racesLeft, 0); });
  state.projects = []; // new chassis: in-flight concepts do not carry over
  state.season++; state.year++; state.round = 0; state.results = state.results.filter((x) => x.season >= state.season - 5); state.week = 1; state.schedule = null; ensureSchedule(state);
  state.calendar = pickCalendar(r, state.calendar.length, state.calendarOrder);
  state.regulation = { next: null, announced: false };
  if (state.pendingCapPen) { P.points = -state.pendingCapPen; state.pendingCapPen = 0; }
  // board target adjusts to reputation / last result
  const last = state.history.seasons[state.history.seasons.length - 1];
  state.board.target = clamp(Math.min(state.board.target, last.pos + 1), 1, 10);
  if (last.pos > state.board.target + 2) state.board.target = clamp(state.board.target + 1, 1, 10);
  state.board.objectives = seasonObjectives(state);
  P.nextYearFocus = 0.15;
  state.phase = 'hq'; state.review = null;
  note(state, 'info', `Season ${state.season} (${state.year}) begins. Board target: P${state.board.target}.`);
  commit(state, r);
}
export { OBJ_TEXT, PROFILES };
