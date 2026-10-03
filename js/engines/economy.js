// Team Principal — economy, power-unit suppliers, regulation voting, testing days and car areas.
// Real-world anchors (researched Oct 2026):
//  • F1 pays no prize per race; ~50% of the pool is equal, the rest by constructors' position
//    (champion ≈14% of the performance pool, P10 ≈6%, ~0.9% per place). We model that as an
//    equal per-race "FOM distribution" plus a season-end standings bonus.
//  • Teams also earn per event from hospitality (Paddock Club passes), merchandise and
//    media/TV exposure; these scale with reputation and on-track visibility.
//  • 2026 PU pool per driver: 4 ICE / 4 turbo / 3 MGU-K / 3 ES / 3 CE — identical for every team;
//    extra elements cost 10 grid places, then 5.
//  • Rule changes go through the F1 Commission: FIA 10 votes + FOM 10 votes + 1 per team (30).
//    Changes for next year need a super-majority (28/30) — so FIA+FOM need at least 8 teams.
import { clamp } from '../sim/util.js';

// --- Car areas (used by the car overview, next-year split and project grouping) ---
export const AREAS = {
  floor: { label: 'Floor & diffuser', icon: '▁', attrs: ['medAero', 'highAero', 'lowAero'] },
  wings: { label: 'Wings', icon: '✈', attrs: ['lowAero', 'dragEff'] },
  sidepods: { label: 'Sidepods & cooling', icon: '◧', attrs: ['cooling', 'dragEff'] },
  pu: { label: 'Power unit', icon: '⚡', attrs: ['power', 'puEff'] },
  susp: { label: 'Suspension & brakes', icon: '⚙', attrs: ['mech', 'traction', 'braking', 'tyreCare'] },
  rel: { label: 'Reliability', icon: '🛡', attrs: ['reliability'] },
};
export const AREA_KEYS = Object.keys(AREAS);
export const SPLIT_AREAS = ['floor', 'wings', 'sidepods', 'pu', 'susp'];
export const PROJECT_AREA = { prj_floor: 'floor', prj_fwing: 'wings', prj_lowdrag: 'wings', prj_hidf: 'wings', prj_sidepod: 'sidepods', prj_susp: 'susp', prj_rearsusp: 'susp', prj_brakes: 'susp', prj_weight: 'susp', prj_pupower: 'pu', prj_ers: 'pu', prj_relpack: 'rel', prj_tyremodel: 'susp' };
export const areaOfProject = (tplId) => PROJECT_AREA[tplId] || 'floor';
export function defaultSplit() { return { floor: 25, wings: 20, sidepods: 15, pu: 20, susp: 20 }; }
// focus per attribute (0..1) from total next-year focus and the % split
export function attrFocus(total, split, k) {
  const s = split || defaultSplit(); let f = 0;
  for (const a of SPLIT_AREAS) if (AREAS[a].attrs.includes(k)) f += (s[a] || 0) / 100 / (AREAS[a].attrs.length / 2);
  return clamp(total * f * 2.2, 0, 0.9);
}

// --- Power-unit suppliers: three customer suppliers or build your own ---
export const PU_SUPPLIERS = {
  ardent: { name: 'Ardent Powertrains', tag: 'Benchmark power', power: 81, puEff: 78, rel: 0, fee: 17e6, desc: 'Strongest ICE, average energy recovery. Most expensive lease.' },
  kestrel: { name: 'Kestrel Hybrid', tag: 'Efficiency king', power: 77, puEff: 83, rel: 1.5, fee: 15e6, desc: 'Best electrical efficiency — battery stays fuller, more Overtake-mode use.' },
  vulcan: { name: 'Vulcan Motorsport', tag: 'Bullet-proof', power: 76, puEff: 77, rel: 4, fee: 12e6, desc: 'A little down on power but the most reliable and the cheapest.' },
  inhouse: { name: 'In-house PU', tag: 'Your own factory', power: 72, puEff: 74, rel: -3, fee: 6e6, setup: 30e6, desc: 'No lease fee, but a 30M build-up and it starts behind. Your PU department improves it every year — the long game.' },
};
export const PU_KEYS = Object.keys(PU_SUPPLIERS);
export function assignSuppliers(teams, rng) {
  const ids = Object.keys(teams); const pool = ['ardent', 'kestrel', 'vulcan'];
  ids.forEach((id, i) => { const t = teams[id]; t.puSup = t.puSup || pool[i % 3]; });
}
// PU spec is equal for every customer of a supplier (+ the year's evolution of that supplier)
export function puSpec(state, key) {
  const S = PU_SUPPLIERS[key] || PU_SUPPLIERS.ardent; const evo = (state.puEvo || {})[key] || { power: 0, puEff: 0 };
  return { power: S.power + evo.power, puEff: S.puEff + evo.puEff, rel: S.rel };
}
export function applyPU(state, team) {
  const sp = puSpec(state, team.puSup); const own = team.puSup === 'inhouse' ? (team.puOwn || 0) : 0;
  team.car.power = Math.round((sp.power + own) * 10) / 10; team.car.puEff = Math.round((sp.puEff + own) * 10) / 10;
}
export function evolveSuppliers(state, rng) {
  state.puEvo ||= {};
  for (const k of ['ardent', 'kestrel', 'vulcan']) { const e = state.puEvo[k] || { power: 0, puEff: 0 }; state.puEvo[k] = { power: clamp(e.power + rng.range(-0.6, 1.4), -4, 8), puEff: clamp(e.puEff + rng.range(-0.6, 1.4), -4, 8) }; }
}

// --- Per-race income (other than sponsors) ---
export function raceIncome(state, P, mine, pos) {
  const sf = 12 / state.calendar.length; const rep = P.rep || 50;
  const pts = mine.reduce((a, x) => a + x.pts, 0);
  const best = Math.min(...mine.map((x) => (x.dnf ? 25 : x.pos)));
  return [
    ['Income', sf * 1.35e6, 'FOM distribution (equal share, per event)'],
    ['Income', sf * pts * 0.05e6, `FOM performance share (${pts} pts this race)`],
    ['Income', sf * (0.25e6 + rep * 0.006e6), 'Paddock Club hospitality'],
    ['Income', sf * (0.12e6 + rep * 0.004e6) * (best <= 3 ? 1.6 : best <= 10 ? 1.15 : 1), 'Merchandise sales'],
    ['Income', sf * (best <= 3 ? 0.45e6 : best <= 6 ? 0.22e6 : best <= 10 ? 0.1e6 : 0.03e6) * (pos <= 5 ? 1.2 : 1), 'TV & media exposure bonus'],
  ].filter((x) => x[1] > 1000);
}
// Season-end constructors' bonus (performance pool, ~0.9% of pool per place)
export const SEASON_BONUS = [46e6, 42e6, 38.5e6, 35e6, 31.5e6, 28e6, 24.5e6, 21e6, 17.5e6, 14e6, 11e6, 9e6];
export const seasonBonus = (pos) => SEASON_BONUS[clamp(pos - 1, 0, SEASON_BONUS.length - 1)];
export const START_PURSE = 45e6;

// --- Sponsor contract terms ---
export const SPONSOR_TERMS = {
  full: { label: 'Full season', races: (n) => n, pay: 1, bonus: 1, desc: 'Logo on the car every race. Standard rate.' },
  short: { label: 'Flagship races only', races: (n) => Math.max(3, Math.round(n * 0.4)), pay: 1.45, bonus: 1, desc: 'Fewer races (~40% of the calendar) at a premium per-race rate — then the slot is free again.' },
  multi: { label: 'Two-season deal', races: (n) => n * 2, pay: 0.88, bonus: 1, desc: 'Security: two full seasons at a slightly lower per-race rate.' },
  perf: { label: 'Performance-heavy', races: (n) => n, pay: 0.7, bonus: 2.6, desc: 'Lower base, much bigger bonus every time the objective is met.' },
};

// --- Regulation vote (F1 Commission) ---
export function regVoteOutcome(state, reg, playerFor, rng) {
  // AI teams vote by self-interest: strong in the affected area → against; weak → for
  let teamFor = playerFor ? 1 : 0; const votes = [];
  const all = Object.values(state.teams);
  const avgA = (t) => reg.attrs.reduce((a, k) => a + (t.car[k] || 70), 0) / reg.attrs.length;
  const fieldAvg = all.reduce((a, t) => a + avgA(t), 0) / all.length;
  for (const t of all) {
    if (t.isPlayer) { votes.push({ id: t.id, name: t.name, color: t.color, yes: !!playerFor }); continue; }
    const lean = (fieldAvg - avgA(t)) * 0.25 + (reg.popular || 0.6) * 2.2 - 0.9 + rng.normal(0, 0.6);
    const yes = lean > 0; if (yes) teamFor++; votes.push({ id: t.id, name: t.name, color: t.color, yes });
  }
  const need = Math.max(1, all.length - 2); // 28/30 incl. FIA + FOM (both back the proposal)
  return { votes, teamFor, need, passed: teamFor >= need, total: 20 + teamFor, of: 20 + all.length };
}

// --- Testing days: knowledge of the car (for engineers) and for each driver ---
export const TESTS = {
  pre: { label: 'Pre-season test', days: 3, laps: 130, desc: 'Three days, shared car. Big boost to car & driver knowledge before race 1.' },
  mid: { label: 'In-season test', days: 2, laps: 90, desc: 'Two days after a European race. Measures upgrades and builds knowledge.' },
  post: { label: 'Post-season test', days: 1, laps: 0, desc: 'One day; track time by constructors\' standings (lower teams get more laps, like the aero-testing scale). Knowledge carries into next year at 60%.' },
};
export function postSeasonLaps(pos) { return Math.round(70 + (clamp(pos, 1, 11) - 1) * 9); }
// split laps between the two drivers (share 0..1 for driver 0) — returns gains
export function runTest(state, P, kind, share = 0.5, focus = 'balanced') {
  const T = TESTS[kind]; const st = state;
  const laps = kind === 'post' ? postSeasonLaps(st._lastPos || 6) : T.laps;
  P.carKnow = P.carKnow ?? 0.3;
  const carGain = laps * 0.0028 * (focus === 'car' ? 1.4 : focus === 'drivers' ? 0.6 : 1) * (1 - P.carKnow);
  P.carKnow = clamp(P.carKnow + carGain, 0, 0.95);
  const out = { laps, car: carGain, drv: [] };
  P.drivers.forEach((did, i) => {
    const d = st.drivers[did]; if (!d) return; d.carFam = d.carFam ?? 0.3;
    const dl = laps * (i === 0 ? share : 1 - share);
    const g = dl * 0.0055 * (focus === 'drivers' ? 1.4 : focus === 'car' ? 0.6 : 1) * (1 - d.carFam);
    d.carFam = clamp(d.carFam + g, 0, 0.97); out.drv.push({ did, laps: Math.round(dl), gain: g });
  });
  if (st.reserve && st.drivers[st.reserve]) { const d = st.drivers[st.reserve]; d.carFam = d.carFam ?? 0.2; const g = laps * 0.0018 * (1 - d.carFam); d.carFam = clamp(d.carFam + g, 0, 0.9); out.drv.push({ did: d.id, laps: Math.round(laps * 0.15), gain: g, reserve: true }); } /* reserve driver gets a share of the test programme */
  // a test reveals the real gain of deployed parts
  for (const p of st.projects || []) if (p.stage === 'deployed' && !p.revealed) { p.revealed = true; out.revealed = (out.revealed || 0) + 1; }
  (st.testLog ||= []).push({ season: st.season, kind, week: st.week, laps, car: Math.round(P.carKnow * 100), drv: out.drv.map((x) => ({ did: x.did, fam: Math.round((st.drivers[x.did]?.carFam || 0) * 100) })) });
  return out;
}
