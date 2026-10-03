import { ensureSchedule } from './calendarEngine.js';
// World creation & organisation selectors (pure).
import { RNG } from '../sim/rng.js';
import { clamp, avg } from '../sim/util.js';
import { TEAMS, PROFILES, PHILOSOPHIES, CAR_ATTRS } from '../data/teams.js';
import { DRIVERS } from '../data/drivers.js';
import { TRACKS } from '../data/tracks.js';
import { DEPARTMENTS, FACILITIES, FIRST, LAST, SPECIALTIES, SPONSOR_POOL } from '../data/content.js';

import { START_PURSE, defaultSplit, assignSuppliers, applyPU } from './economy.js';
export const SAVE_VERSION = 4;
export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const DIFFICULTY = {
  beginner: { label: 'Beginner', info: 1.0, cost: 0.85, ai: 0.8, events: 0.7, patience: 1.4, desc: 'More information, softer finances and board.' },
  standard: { label: 'Standard', info: 0.8, cost: 1.0, ai: 1.0, events: 1.0, patience: 1.0, desc: 'Balanced uncertainty.' },
  expert: { label: 'Expert', info: 0.6, cost: 1.12, ai: 1.1, events: 1.25, patience: 0.8, desc: 'Less information, higher consequences.' },
  principal: { label: 'Principal Mode', info: 0.45, cost: 1.2, ai: 1.15, events: 1.4, patience: 0.65, desc: 'Very limited information. Optional ironman (single autosave).' },
};
const TIER_PROFILE = { front: 'front', challenger: 'challenger', midfield: 'midfield', back: 'back' };

let _sid = 0;
export function genStaff(rng, role, dept, base, id) {
  const skill = clamp(Math.round(base + rng.normal(0, 7)), 25, 97);
  const age = rng.int(30, 60);
  return {
    id: id || `stf_${Date.now().toString(36)}_${(_sid++).toString(36)}_${rng.int(0, 1e6).toString(36)}`,
    name: `${rng.pick(FIRST)} ${rng.pick(LAST)}`, role, dept, skill, age,
    potential: clamp(skill + rng.int(-4, 14) - Math.max(0, age - 45), skill, 99),
    spec: rng.pick(SPECIALTIES), leadership: rng.int(30, 95), loyalty: rng.int(20, 95), ambition: rng.int(20, 95),
    morale: 70, fatigue: 10, salary: Math.round((0.25 + (skill / 100) ** 3 * 3.2) * 1e6 / 1e4) * 1e4, contract: rng.int(1, 3),
  };
}
export function driverSalary(d) { const r = driverRating(d); return Math.round(Math.max(0.5, ((r - 70) / 25) ** 2.4 * 38 + 0.8) * 1e5) * 10; }
export const driverRating = (d) => d.pace * 0.45 + d.craft * 0.2 + d.cons * 0.15 + d.tyre * 0.1 + d.wet * 0.1;

function buildOrg(rng, team, profileKey, philKey, diff) {
  const P = PROFILES[profileKey], Ph = PHILOSOPHIES[philKey] || PHILOSOPHIES.balanced;
  const facilities = {};
  for (const k of Object.keys(FACILITIES)) facilities[k] = clamp(Math.round(P.fac + rng.range(-0.8, 0.8)), 1, 5);
  if (philKey === 'aero') facilities.windTunnel = clamp(facilities.windTunnel + 1, 1, 5);
  if (philKey === 'ops') facilities.pitCentre = clamp(facilities.pitCentre + 1, 1, 5);
  if (philKey === 'reliability') facilities.relLab = clamp(facilities.relLab + 1, 1, 5);
  if (philKey === 'driver') facilities.simulator = clamp(facilities.simulator + 1, 1, 5);
  const depts = {};
  for (const [k, d] of Object.entries(DEPARTMENTS)) {
    const head = genStaff(rng, d.role, k, P.staff + (Ph.dept[k] || 0));
    depts[k] = { head, headcount: clamp(Math.round(P.fac * 1.6 + rng.range(-1, 1)), 1, 10), morale: 72, fatigue: 12, workload: 50 };
  }
  const td = genStaff(rng, 'Technical Director', 'td', P.staff + 3);
  return {
    facilities, facilityBuilds: [], depts, td,
    cash: START_PURSE / (diff?.cost || 1), /* equal starting purse for every team */ rep: P.rep, profile: profileKey, philosophy: philKey,
    budgetSpent: 0, crunch: false, nextYearFocus: 0.15, nextYearSplit: defaultSplit(), correlationMod: 0, carKnow: 0.3,
  };
}

export function deptQ(team, key) {
  const d = team.depts?.[key]; if (!d) return 60;
  const tdB = (team.td?.skill || 60) * 0.1;
  return clamp(d.head.skill * 0.5 + d.headcount * 3 + tdB + (d.morale - 70) * 0.2 - d.fatigue * 0.2, 5, 100);
}
export const facLvl = (team, k) => team.facilities?.[k] || 1;

export function pitCrew(team) {
  const q = deptQ(team, 'ops'); const f = facLvl(team, 'pitCentre');
  const d = team.depts?.ops;
  return { speed: clamp(q * 0.7 + f * 6, 30, 99), err: clamp(0.09 - q * 0.0006 - f * 0.008 + (d ? d.fatigue * 0.0007 + Math.max(0, 60 - d.morale) * 0.001 : 0), 0.01, 0.2) };
}
export function forecastAccuracy(team, diff) {
  return clamp((0.35 + deptQ(team, 'strat') * 0.004 + facLvl(team, 'analysis') * 0.05) * (diff?.info ?? 0.8) + 0.1, 0.2, 0.97);
}
export function correlationQuality(team, aero = true) {
  const base = aero ? 0.2 + facLvl(team, 'windTunnel') * 0.09 + facLvl(team, 'cfd') * 0.05 + deptQ(team, 'aero') * 0.002 : 0.3 + facLvl(team, 'simulator') * 0.05 + deptQ(team, 'sim') * 0.004;
  return clamp(base + (team.correlationMod || 0), 0.1, 0.97);
}

export function createWorld(opts) {
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const rng = new RNG(seed);
  const diff = DIFFICULTY[opts.difficulty || 'standard'];
  const teams = {}, drivers = {};
  for (const d of DRIVERS) drivers[d.id] = { ...d, morale: 70, confidence: 70, form: 0, contract: { years: rng.int(1, 3), salary: 0 }, teamId: d.team && d.team !== 'academy' ? d.team : null, academy: d.team === 'academy', stats: { starts: 0, wins: 0, podiums: 0, points: 0 } };
  for (const d of Object.values(drivers)) d.contract.salary = driverSalary(d);
  let teamDefs = TEAMS.map((t) => ({ ...t, car: { ...t.car } }));
  let playerId = opts.playerTeamId;
  if (opts.mode === 'career' && opts.custom) {
    const c = opts.custom;
    const tierKey = c.profile;
    const idx = [...teamDefs].reverse().findIndex((t) => t.tier === tierKey);
    const replaced = teamDefs[teamDefs.length - 1 - idx];
    for (const d of Object.values(drivers)) if (d.teamId === replaced.id) d.teamId = null;
    const P = PROFILES[tierKey], Ph = PHILOSOPHIES[c.philosophy];
    const car = Object.fromEntries(CAR_ATTRS.map((k) => [k, Math.round(P.carBase + (Ph.car[k] || 0) + rng.range(-1.5, 1.5))]));
    const pt = { id: 'tm_player', name: c.name, abbr: c.abbr, color: c.color, color2: c.color2, tier: tierKey, philosophy: c.philosophy, aiStyle: 'player', car };
    teamDefs = teamDefs.map((t) => (t.id === replaced.id ? pt : t));
    playerId = 'tm_player';
    (c.driverIds || []).forEach((id) => { if (drivers[id]) { drivers[id].teamId = playerId; drivers[id].academy = false; drivers[id].contract.years = Math.max(2, drivers[id].contract.years); } });
  }
  for (const t of teamDefs) {
    const prof = t.id === playerId && opts.custom ? opts.custom.profile : TIER_PROFILE[t.tier];
    teams[t.id] = { ...t, isPlayer: t.id === playerId, carMods: [{}, {}], points: 0, ...buildOrg(rng, t, prof, t.philosophy, t.id === playerId ? diff : null), pu: [0, 0], results: [], memory: { undercutsSuffered: 0 } };
  }
  assignSuppliers(teams, rng);
  const st0 = { puEvo: {} }; for (const t of Object.values(teams)) { if (t.isPlayer && opts.custom?.pu) t.puSup = opts.custom.pu; applyPU(st0, t); }
  // ensure every team has 2 drivers
  for (const t of Object.values(teams)) {
    let ds = Object.values(drivers).filter((d) => d.teamId === t.id);
    while (ds.length < 2) {
      const fa = Object.values(drivers).filter((d) => !d.teamId && !d.academy).sort((a, b) => driverRating(b) - driverRating(a))[0];
      if (!fa) break; fa.teamId = t.id; ds = Object.values(drivers).filter((d) => d.teamId === t.id);
    }
    t.drivers = ds.slice(0, 2).map((d) => d.id);
    ds.slice(2).forEach((d) => (d.teamId = null));
  }
  const len = opts.seasonLength || 12;
  const calendar = opts.mode === 'quick' ? [opts.trackId] : pickCalendar(rng, len, opts.calendarOrder);
  const P = teams[playerId];
  const prof = PROFILES[P.profile] || PROFILES.midfield;
  const state = {
    version: SAVE_VERSION, mode: opts.mode, seed, rngS: rng.s, difficulty: opts.difficulty || 'standard', ironman: !!opts.ironman,
    createdAt: Date.now(), season: 1, year: 2027, round: 0, calendar, calendarOrder: opts.calendarOrder || 'real', raceLength: opts.raceLength || 0.35, player: playerId,
    teams, drivers, projects: [], ledger: [], inbox: [], results: [], news: [],
    sponsors: [], sponsorOffers: [], staffMarket: [], pendingEvent: null, weekend: null, achievements: {},
    board: { confidence: 65, target: opts.custom?.target ?? prof.target, patience: prof.boardPatience * diff.patience, warnings: 0 },
    regulation: { next: null, announced: false }, controlLevel: opts.controlLevel || 'hands-on', phase: 'hq', gameOver: null,
    history: { seasons: [] }, stats: { races: 0, wins: 0, podiums: 0, points: 0, poles: 0 },
  };
  if (opts.mode === 'career') {
    // starting sponsors
    const pool = SPONSOR_POOL.filter((s) => s.minRep <= P.rep).slice(0, 3);
    state.sponsors = pool.map((s, i) => ({ ...s, sat: 65, term: i === 0 ? 'multi' : 'full', racesLeft: i === 0 ? len * 2 : len, perRace: s.perRace * prof.sponsorBase * (i === 0 ? 0.88 : 1) }));
    state.staffMarket = genStaffMarket(rng, 10);
    state.board.objectives = seasonObjectives(state);
    state.inbox.push({ sev: 'info', text: `Welcome, Team Principal. The board expects P${state.board.target} or better in the Constructors' Championship.`, round: 0 });
  }
  state.rngS = rng.s;
  if (state.mode === 'career') { state.week = 1; ensureSchedule(state); }
  return state;
}
// Real 2026 calendar order; shorter seasons take an evenly spaced subset (keeps the season's geography).
export function pickCalendar(rng, len, order = 'real') {
  if (order === 'random') return rng.shuffle(TRACKS).slice(0, Math.min(len, TRACKS.length)).map((t) => t.id);
  const n = Math.min(len, TRACKS.length); if (n >= TRACKS.length) return TRACKS.map((t) => t.id);
  const off = rng.next() * (TRACKS.length / n); const out = [];
  for (let i = 0; i < n; i++) out.push(TRACKS[Math.floor(off + i * TRACKS.length / n) % TRACKS.length].id);
  return [...new Set(out)];
}
export function genStaffMarket(rng, n) {
  const keys = Object.keys(DEPARTMENTS); const list = [];
  for (let i = 0; i < n; i++) { const k = rng.pick(keys); list.push(genStaff(rng, DEPARTMENTS[k].role, k, rng.range(50, 85))); }
  if (rng.chance(0.5)) list.push(genStaff(rng, 'Technical Director', 'td', rng.range(60, 88)));
  return list;
}
export function seasonObjectives(state) {
  const t = state.board.target;
  return [
    { id: 'obj_cons', text: `Finish P${t} or better in the Constructors'`, kind: 'cons', value: t, weight: 3 },
    { id: 'obj_fin', text: 'Finish the season with positive cash', kind: 'cash', value: 0, weight: 1 },
    { id: 'obj_rel', text: `Keep mechanical DNFs under ${Math.ceil(state.calendar.length / 3)}`, kind: 'rel', value: Math.ceil(state.calendar.length / 3), weight: 1 },
  ];
}
export const playerTeam = (s) => s.teams[s.player];
export const teamDrivers = (s, tid) => (s.teams[tid]?.drivers || []).map((id) => s.drivers[id]).filter(Boolean);
export const teamRatingAvg = (t) => avg(Object.values(t.car));
