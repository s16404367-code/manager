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
export const carDeficitSec = (score, t) => (100 - score) * 0.055 * (t.baseLap / 85);

export const SETUP_KEYS = ['wing', 'ride', 'susp', 'balance', 'diff'];
export const SETUP_LABEL = { wing: 'Wing level', ride: 'Ride height', susp: 'Suspension stiffness', balance: 'Aero balance (F←→R)', diff: 'Differential lock' };
export const SETUP_HINT = {
  wing: 'More wing = more cornering grip, less top speed and weaker DRS attack.',
  ride: 'Lower = more downforce, but bottoming/kerb damage risk rises.',
  susp: 'Stiffer = better aero platform, higher tyre wear and kerb sensitivity.',
  balance: 'Forward balance stresses fronts; rearward stresses rears.',
  diff: 'More lock = better traction, more rear tyre wear & understeer.',
};
// Hidden optimum for a car at a track (event noise from rng).
export function setupOptimum(t, car, rng) {
  const n = () => (rng ? rng.normal(0, 1.6) : 0);
  return {
    wing: clamp(1 + 8 * (t.df * 0.7 + (1 - t.drag) * 0.3) + (car.dragEff - 70) * 0.03 + n(), 0, 10),
    ride: clamp(2 + 6 * (1 - t.ride) + n(), 0, 10),
    susp: clamp(3 + 5 * (t.high * 0.6 + (1 - t.kerb) * 0.4) + n(), 0, 10),
    balance: clamp(5 + (t.rstress - t.fstress) * 4 + (car.highAero - car.lowAero) * 0.05 + n(), 0, 10),
    diff: clamp(3 + 5 * t.trac - (car.traction - 70) * 0.03 + n(), 0, 10),
  };
}
export function setupQuality(setup, opt) {
  let e = 0; for (const k of SETUP_KEYS) e += ((setup[k] - opt[k]) / 4) ** 2;
  return clamp(1 - e / SETUP_KEYS.length * 1.6, 0, 1);
}
// Secondary setup effects (trade-offs beyond pure quality)
export function setupEffects(setup, opt, t) {
  const d = (k) => setup[k] - opt[k];
  return {
    wearMult: clamp(1 + Math.max(0, d('susp')) * 0.03 + Math.max(0, d('diff')) * 0.02, 0.9, 1.35),
    frontBias: clamp(-d('balance') * 0.04, -0.3, 0.3),
    damageRisk: clamp(1 + Math.max(0, -d('ride')) * 0.35 * (0.5 + t.kerb), 1, 3),
    topSpeed: clamp(-d('wing') * 0.012, -0.12, 0.12), // + => better straight-line / DRS
  };
}
export function defaultSetup() { return { wing: 5, ride: 5, susp: 5, balance: 5, diff: 5 }; }
