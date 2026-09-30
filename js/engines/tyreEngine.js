// Tyre model (v3.5). Internally tyres track WEAR (0 = new … 100 = gone); the UI shows GRIP = 100 − wear.
// Each compound has an operating window: track wetness and track temperature decide how well it works.
//  • Slicks: fastest when dry; above ~12% wetness they aquaplane/slide (big penalty, crash risk).
//  • Intermediates: window ~15–65% wetness. On a drying line they overheat and wear fast; in standing water they aquaplane.
//  • Full wets: best above ~60% wetness (clear the most water); on a drying track they are slow and overheat quickly.
//  • Temperature: Softs overheat/grain on hot tracks (>45°C track), Hards struggle to warm up on cold tracks (<25°C).
import { clamp } from '../sim/util.js';
export const COMPOUNDS = {
  S: { name: 'Soft', color: '#ff3b3b', off: 0, wear: 3.4, cliff: 62, wet: false, win: [20, 45] },
  M: { name: 'Medium', color: '#ffd23b', off: 0.55, wear: 2.2, cliff: 70, wet: false, win: [25, 52] },
  H: { name: 'Hard', color: '#e8e8e8', off: 1.05, wear: 1.45, cliff: 78, wet: false, win: [32, 60] },
  I: { name: 'Intermediate', color: '#2fbf4a', off: 0, wear: 2.0, cliff: 70, wet: true, win: [10, 40] },
  W: { name: 'Wet', color: '#2f7bff', off: 0, wear: 1.6, cliff: 75, wet: true, win: [5, 35] },
};
export const DRY = ['S', 'M', 'H'];
// Real-life style weekend allocation per driver (Pirelli: 13 dry sets + 4 Inter + 3 Wet)
export const ALLOCATION = { S: 8, M: 3, H: 2, I: 4, W: 3 };
export const grip = (w) => Math.max(0, Math.round(100 - (typeof w === 'object' && w ? w.wear : w || 0)));

// Weather mismatch penalty (s/lap) for compound at wetness w (0 dry … 1 flooded)
export function wetPenalty(c, w) {
  if (c === 'S' || c === 'M' || c === 'H') return w > 0.12 ? (w - 0.12) * 40 + Math.pow(Math.max(0, w - 0.3), 2) * 30 : 0;
  if (c === 'I') return (w < 0.15 ? (0.15 - w) * 12 + 1.1 : 0) + (w > 0.65 ? (w - 0.65) * 24 : 0);
  if (c === 'W') return w < 0.6 ? (0.6 - w) * 9 + (w < 0.3 ? 1.2 : 0.3) : 0;
  return 0;
}
// Which compound is right for this wetness (for engineers/AI)
export const bestFor = (w) => (w > 0.62 ? 'W' : w > 0.15 ? 'I' : null);
// Temperature window penalty (s) — cold tyres lack grip, hot ones slide
export function tempPenalty(c, trackTemp = 35, age = 5) {
  const C = COMPOUNDS[c]; if (!C || C.wet) return 0;
  const [lo, hi] = C.win; let p = 0;
  if (trackTemp < lo) p += (lo - trackTemp) * 0.025 * (age < 2 ? 2.2 : 1);
  if (trackTemp > hi) p += (trackTemp - hi) * 0.02;
  return p;
}
export function tyrePaceLoss(tyre, trackTemp = 35) {
  const C = COMPOUNDS[tyre.c];
  const cliff = tyre.wear > C.cliff ? Math.pow(tyre.wear - C.cliff, 1.6) * 0.05 : 0;
  return C.off + tyre.wear * 0.022 + cliff + tempPenalty(tyre.c, trackTemp, tyre.age ?? 5);
}
// Wear % per lap
export function wearPerLap({ c, track, car, driver, mode, wetness, dirty, sc, setupWear = 1, pers = 1, scale = 1, frontBias = 0, trackTemp = null }) {
  const C = COMPOUNDS[c];
  let w = C.wear * (0.55 + 0.9 * track.deg) * (1.3 - car.tyreCare / 200) * (1.2 - driver.tyre / 400);
  w *= { conserve: 0.7, normal: 1, push: 1.35, attack: 1.7 }[mode] || 1;
  const tt = trackTemp ?? (25 + track.temp * 25);
  w *= 0.85 + 0.3 * clamp((tt - 20) / 30, 0, 1.4);
  if (!C.wet && tt > C.win[1]) w *= 1 + (tt - C.win[1]) * 0.02; // overheating / blistering
  if (!C.wet && tt < C.win[0]) w *= 1 + (C.win[0] - tt) * 0.015; // graining on cold tracks
  w *= 1 + Math.abs(frontBias) * 0.6 * (frontBias > 0 ? track.fstress : track.rstress);
  if (dirty) w *= 1.12; // sliding in dirty air
  if (sc) w *= 0.3;
  if (c === 'I' && wetness < 0.15) w *= 1 + (0.15 - wetness) * 18; // inters cook on a drying line
  if (c === 'W' && wetness < 0.45) w *= 1 + (0.45 - wetness) * 7;  // wets overheat fast
  if (!C.wet) w *= 1 - Math.min(0.5, wetness); // wet track is cooler
  return clamp(w * setupWear * pers * scale, 0.1, 25);
}
export function estimateStint(c, track, car, driver, scale, wetness = 0, trackTemp = null) {
  const w = wearPerLap({ c, track, car, driver, mode: 'normal', wetness, scale, trackTemp });
  return Math.max(2, Math.floor((COMPOUNDS[c].cliff + 4) / w));
}
