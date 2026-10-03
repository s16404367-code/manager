// Car-vs-track performance model and setup model. Pure functions (no DOM).
import { clamp } from '../sim/util.js';
import { CAR_ATTRS } from '../data/teams.js';

export function effectiveCar(team, slot = 0) {
  const mods = (team.carMods && team.carMods[slot]) || {};
  const out = {};
  for (const k of CAR_ATTRS) out[k] = clamp((team.car[k] || 50) + (mods[k] || 0), 20, 110);
  return out;
}

// Returns {score, breakdown} — higher is faster. Explainable components.
export function trackScore(car, t) {
  const cw = t.low + t.med + t.high || 1;
  const corner = (car.lowAero * t.low + car.medAero * t.med + car.highAero * t.high) / cw;
  const straight = car.dragEff * 0.5 + car.power * 0.5;
  const mech = car.mech * (1 - t.trac * 0.5) + car.traction * (t.trac * 0.5);
  const w = { corner: 0.3 + 0.4 * t.df, straight: 0.2 + 0.45 * t.drag, mech: 0.15 + 0.2 * t.trac + 0.1 * t.low, braking: 0.05 + 0.15 * t.brake };
  const tw = w.corner + w.straight + w.mech + w.braking;
  let score = (corner * w.corner + straight * w.straight + mech * w.mech + car.braking * w.braking) / tw;
  const coolNeed = 45 + 45 * t.cool;
  const coolPen = Math.max(0, coolNeed - car.cooling) * 0.12;
  score -= coolPen;
  return { score, breakdown: { corner, straight, mech, braking: car.braking, coolPen, weights: w } };
}
// Car vs driver weighting: studies of the hybrid era (e.g. Bell et al., Sheffield/Journal of Sports Analytics)
// attribute roughly 80-88% of performance differences to the car/team and ~12-20% to the driver.
// Spread here: car 63→82 rating ≈ 1.25s/lap, driver pace 75→97 ≈ 0.45s/lap → car-dominant (~75/25).
export const DRIVER_W = 0.02;
export const carDeficitSec = (score, t) => (100 - score) * 0.065 * (t.baseLap / 85);

export const SETUP_KEYS = ['frontWing', 'rearWing', 'ride', 'springs', 'arb', 'camber', 'toe', 'brakeBias', 'diff', 'pressure'];
export const SETUP_GROUPS = [['Aerodynamics', ['frontWing', 'rearWing', 'ride']], ['Suspension', ['springs', 'arb', 'camber', 'toe']], ['Brakes, diff & tyres', ['brakeBias', 'diff', 'pressure']]];
export const SETUP_LABEL = { frontWing: 'Front wing angle', rearWing: 'Rear wing angle', ride: 'Ride height', springs: 'Spring stiffness', arb: 'Anti-roll bars (F←→R)', camber: 'Camber', toe: 'Toe', brakeBias: 'Brake bias (rear←→front)', diff: 'Differential lock', pressure: 'Tyre pressure' };
export const SETUP_HINT = {
  frontWing: 'More front wing = sharper turn-in (oversteer). Aggressive drivers like a pointy front.',
  rearWing: 'More rear wing = more downforce & stability, less top speed and weaker DRS attack.',
  ride: 'Lower = more floor downforce, but bottoming & kerb damage risk rises on bumpy tracks.',
  springs: 'Stiffer = stable aero platform & response; worse over kerbs/bumps, more tyre wear.',
  arb: 'Front-biased roll stiffness = understeer & front wear; rear-biased = oversteer & rear wear.',
  camber: 'More negative camber = more cornering grip, more tyre wear.',
  toe: 'More toe = stability and turn-in; costs a little drag and tyre temperature.',
  brakeBias: 'Forward bias = stable braking; wrong bias causes lock-ups and mistakes.',
  diff: 'More lock = traction out of slow corners; more rear wear and understeer mid-corner.',
  pressure: 'Lower pressure = grip & warm-up; too low risks overheating, wear and punctures.',
};
const W = { frontWing: 1, rearWing: 1.2, ride: 1, springs: 0.8, arb: 0.7, camber: 0.8, toe: 0.5, brakeBias: 0.6, diff: 0.7, pressure: 0.8 };
const STYLE = { aggressive: 1, independent: 0.5, teamplayer: 0, technical: 0, lowinfo: -0.3, conservative: -1 }; // +: likes oversteer
export function driverStyle(d) { return STYLE[d?.pers] ?? 0; }
// Hidden optimum for a car + driver at a track (event noise from rng).
export function setupOptimum(t, car, rng, driver = null) {
  const n = () => (rng ? rng.normal(0, 1.3) : 0); const st = driverStyle(driver);
  const rw = clamp(1 + 8 * (t.df * 0.75 + (1 - t.drag) * 0.25) + (car.dragEff - 70) * 0.03 + n(), 0, 10);
  return {
    rearWing: rw,
    frontWing: clamp(rw + (t.rstress - t.fstress) * 2 + st * 1.1 + (car.highAero - car.lowAero) * 0.04 + n(), 0, 10),
    ride: clamp(2 + 6 * (1 - t.ride) + n(), 0, 10),
    springs: clamp(3 + 5 * (t.high * 0.6 + (1 - t.kerb) * 0.4) + n(), 0, 10),
    arb: clamp(5 + (t.rstress - t.fstress) * 3 + st * 0.6 + n(), 0, 10),
    camber: clamp(3 + 5 * (t.high * 0.5 + t.med * 0.3) - t.deg * 2 + 1 + n(), 0, 10),
    toe: clamp(5 - t.drag * 3 + t.low * 2 - st * 0.5 + n(), 0, 10),
    brakeBias: clamp(5 + (t.brake - 0.5) * 3 - st * 0.4 + n() * 0.7, 0, 10),
    diff: clamp(3 + 5 * t.trac - (car.traction - 70) * 0.03 + n(), 0, 10),
    pressure: clamp(3.5 + t.deg * 2.5 + t.high * 2 + t.temp * 1 + n(), 0, 10),
  };
}
export function setupQuality(setup, opt) {
  let e = 0, w = 0; for (const k of SETUP_KEYS) { e += W[k] * (((setup[k] ?? 5) - opt[k]) / 4) ** 2; w += W[k]; }
  return clamp(1 - (e / w) * 1.6, 0, 1);
}
// Secondary setup effects (trade-offs beyond pure quality)
export function setupEffects(setup, opt, t) {
  const d = (k) => (setup[k] ?? 5) - opt[k];
  return {
    wearMult: clamp(1 + Math.max(0, d('springs')) * 0.025 + Math.max(0, d('diff')) * 0.02 + Math.max(0, d('camber')) * 0.03 + Math.max(0, -d('pressure')) * 0.03, 0.85, 1.45),
    frontBias: clamp(-(d('frontWing') - d('rearWing')) * 0.025 - d('arb') * 0.02, -0.3, 0.3),
    damageRisk: clamp(1 + Math.max(0, -d('ride')) * 0.35 * (0.5 + t.kerb) + Math.max(0, d('springs')) * 0.1 * t.kerb, 1, 3),
    topSpeed: clamp(-(d('rearWing') * 0.7 + d('frontWing') * 0.3) * 0.012 - Math.max(0, d('toe')) * 0.003, -0.14, 0.14),
    mistakeMult: clamp(1 + Math.abs(d('brakeBias')) * 0.07 + Math.abs(d('toe')) * 0.03, 1, 1.8),
    punctureRisk: clamp(Math.max(0, -d('pressure')) * 0.25, 0, 1.5),
  };
}
// Observable characteristics of a setup (what the car "feels like"), 0..100 — independent of the hidden optimum.
export function setupCharacter(s) {
  const g = (k) => s[k] ?? 5;
  return {
    'Top speed': clamp(80 - (g('rearWing') * 5 + g('frontWing') * 2) + (10 - g('toe')) * 1 + 20, 0, 100),
    Cornering: clamp((g('rearWing') + g('frontWing')) * 3.5 + (10 - g('ride')) * 2 + g('camber') * 2 + g('springs') * 1, 0, 100),
    'Tyre life': clamp(100 - g('springs') * 3 - g('camber') * 3.5 - g('diff') * 2 + g('pressure') * 2.5 - 10, 0, 100),
    Stability: clamp(g('toe') * 4 + g('rearWing') * 3 + (10 - Math.abs(g('frontWing') - g('rearWing')) * 3) + g('brakeBias') * 2, 0, 100),
    'Kerb riding': clamp(g('ride') * 5 + (10 - g('springs')) * 4 + 10, 0, 100),
    Balance: clamp(50 + (g('frontWing') - g('rearWing')) * 6 + (5 - g('arb')) * 4, 0, 100), // >50 oversteer
  };
}
export function defaultSetup() { return Object.fromEntries(SETUP_KEYS.map((k) => [k, 5])); }
export const AI_FX = { wearMult: 1, frontBias: 0, damageRisk: 1, topSpeed: 0, mistakeMult: 1, punctureRisk: 0 };

/* Qualifying boost (2026 electrical deployment). The driver chooses where to spend the battery on the lap.
   full = deploy everywhere (fastest, small risk of running flat before the line), balanced = on the key straights, save = none.
   Gain scales with PU efficiency, driver skill and how power-sensitive the track is. Applies to every car. */
export const BOOST_MODES = { full: { k: -0.18, risk: 0.06, name: 'Full deploy' }, balanced: { k: -0.12, risk: 0, name: 'Balanced (key straights)' }, save: { k: 0, risk: 0, name: 'Save battery' } };
export function boostGain(mode, car, driver, track) {
  const m = BOOST_MODES[mode] || BOOST_MODES.balanced;
  const pu = 0.75 + ((car?.puEff || 60) - 50) / 160; const sk = 0.8 + ((driver?.pace || 80) - 70) / 100;
  const trk = 0.7 + (track?.drag ?? 0.5) * 0.6;
  return m.k * pu * sk * trk;
}
export function aiBoost(team, rng) { return team.aiStyle === 'aggressive' ? 'full' : team.aiStyle === 'conservative' ? (rng.chance(0.5) ? 'balanced' : 'save') : rng.chance(0.35) ? 'full' : 'balanced'; }
