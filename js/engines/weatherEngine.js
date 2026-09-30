import { clamp } from '../sim/util.js';
// Generate per-lap wetness timeline. Rain events have start, duration, peak.
export function generateWeather(track, laps, rng, forcedWet = null) {
  const wet = new Array(laps + 2).fill(0);
  const events = [];
  const pRain = forcedWet === null ? track.wx * 0.5 : forcedWet ? 1 : 0;
  let startWet = 0;
  if (rng.chance(pRain)) {
    const n = rng.chance(0.3) ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const start = rng.chance(0.25) ? 0 : rng.int(Math.floor(laps * 0.1), Math.floor(laps * 0.8));
      const dur = rng.int(Math.max(3, Math.floor(laps * 0.12)), Math.max(5, Math.floor(laps * 0.45)));
      const peak = rng.range(0.2, 0.95);
      events.push({ start, dur, peak });
    }
  }
  for (const e of events) {
    for (let l = 0; l <= laps + 1; l++) {
      const rise = clamp((l - e.start + 1) / 2.5, 0, 1);
      const fall = clamp(1 - (l - (e.start + e.dur)) / 5, 0, 1);
      wet[l] = Math.max(wet[l], e.peak * Math.min(rise, fall));
    }
  }
  startWet = wet[0];
  const airTemp = Math.round(16 + track.temp * 20 + rng.range(-3, 3));
  return { wet, events, airTemp, trackTemp: Math.round(airTemp + 8 + track.temp * 15 - startWet * 10) };
}
// Forecast = noisy view of the truth. accuracy 0..1 from strategy staff / analysis facility / difficulty.
export function forecast(weather, laps, accuracy, rng, segment = 5) {
  const out = [];
  for (let s = 0; s < laps; s += segment) {
    const seg = weather.wet.slice(s, s + segment);
    const truth = Math.max(...seg) > 0.12 ? 1 : 0;
    const noise = rng.range(0, 1);
    const p = clamp(accuracy * truth + (1 - accuracy) * noise * 0.9, 0, 1);
    const unc = Math.round((1 - accuracy) * 40);
    out.push({ from: s + 1, to: Math.min(laps, s + segment), prob: Math.round(p * 100), unc });
  }
  return out;
}
export const wetLabel = (w) => (w < 0.08 ? 'Dry' : w < 0.2 ? 'Damp' : w < 0.45 ? 'Light rain' : w < 0.7 ? 'Wet' : 'Heavy rain');
