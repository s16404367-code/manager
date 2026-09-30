import { clamp } from '../sim/util.js';
export const COMPOUNDS = {
  S: { name: 'Soft', color: '#ff3b3b', off: 0, wear: 3.4, cliff: 62, wet: false },
  M: { name: 'Medium', color: '#ffd23b', off: 0.55, wear: 2.2, cliff: 70, wet: false },
  H: { name: 'Hard', color: '#e8e8e8', off: 1.05, wear: 1.45, cliff: 78, wet: false },
  I: { name: 'Intermediate', color: '#2fbf4a', off: 0, wear: 2.0, cliff: 70, wet: true },
  W: { name: 'Wet', color: '#2f7bff', off: 0, wear: 1.6, cliff: 75, wet: true },
};
export const DRY = ['S', 'M', 'H'];
// Weather mismatch penalty (s) for compound at wetness w (0 dry .. 1 flooded)
export function wetPenalty(c, w) {
  if (c === 'S' || c === 'M' || c === 'H') return w > 0.1 ? (w - 0.1) * 38 : 0;
  if (c === 'I') return (w < 0.25 ? (0.25 - w) * 14 + 1.2 * (w < 0.12 ? 1 : (0.25 - w) / 0.13) : 0) + (w > 0.65 ? (w - 0.65) * 22 : 0);
  if (c === 'W') return w < 0.55 ? (0.55 - w) * 12 + 0.8 : 0;
  return 0;
}
export function tyrePaceLoss(tyre) {
  const C = COMPOUNDS[tyre.c];
  const cliff = tyre.wear > C.cliff ? Math.pow(tyre.wear - C.cliff, 1.6) * 0.05 : 0;
  return C.off + tyre.wear * 0.022 + cliff;
}
// Wear % per lap
export function wearPerLap({ c, track, car, driver, mode, wetness, dirty, sc, setupWear = 1, pers = 1, scale = 1, frontBias = 0 }) {
  const C = COMPOUNDS[c];
  let w = C.wear * (0.55 + 0.9 * track.deg) * (1.3 - car.tyreCare / 200) * (1.2 - driver.tyre / 400);
  w *= { conserve: 0.7, normal: 1, push: 1.35, attack: 1.7 }[mode] || 1;
  w *= 0.85 + 0.3 * track.temp;
  w *= 1 + Math.abs(frontBias) * 0.6 * (frontBias > 0 ? track.fstress : track.rstress);
  if (dirty) w *= 1.15;
  if (sc) w *= 0.3;
  if (C.wet && wetness < 0.2) w *= 1 + (0.2 - wetness) * 12; // inters/wets cook on a drying track
  if (!C.wet) w *= 1 - Math.min(0.5, wetness); // wet track is cooler
  return clamp(w * setupWear * pers * scale, 0.1, 25);
}
export function estimateStint(c, track, car, driver, scale) {
  const w = wearPerLap({ c, track, car, driver, mode: 'normal', wetness: 0, scale });
  return Math.max(3, Math.floor((COMPOUNDS[c].cliff + 4) / w));
}
