// Strategy planning: candidate plans with estimated time, risk labels, and per-lap tyre estimates.
import { COMPOUNDS, wearPerLap, tyrePaceLoss } from './tyreEngine.js';

const TEMPLATES = [
  ['M', 'H'], ['H', 'M'], ['S', 'H'], ['S', 'M'], ['M', 'S'],
  ['S', 'M', 'S'], ['M', 'H', 'S'], ['S', 'H', 'S'], ['S', 'M', 'M'], ['M', 'M', 'S'], ['S', 'S', 'M', 'S'],
];

function stintCost(c, len, ctx) {
  let wear = 0, t = 0;
  for (let i = 0; i < len; i++) {
    t += tyrePaceLoss({ c, wear });
    wear += wearPerLap({ c, track: ctx.track, car: ctx.car, driver: ctx.driver, mode: 'normal', wetness: 0, scale: ctx.scale });
  }
  return { t, endWear: wear };
}

export function planOptions(ctx) {
  // ctx: {track, laps, car, driver, scale}
  const { laps, track } = ctx;
  const res = [];
  for (const tpl of TEMPLATES) {
    const stops = tpl.length - 1;
    // weight stint lengths by compound durability
    const dur = tpl.map((c) => 1 / COMPOUNDS[c].wear);
    const tot = dur.reduce((a, b) => a + b, 0);
    let lens = dur.map((d) => Math.max(3, Math.round((d / tot) * laps)));
    const diff = laps - lens.reduce((a, b) => a + b, 0); lens[lens.length - 1] += diff;
    if (lens.some((l) => l < 3)) continue;
    let t = stops * (track.pit + 2.6), maxWear = 0, cliffRisk = 0;
    lens.forEach((l, i) => { const s = stintCost(tpl[i], l, ctx); t += s.t; maxWear = Math.max(maxWear, s.endWear); cliffRisk = Math.max(cliffRisk, s.endWear - COMPOUNDS[tpl[i]].cliff); });
    let lap = 0; const stopList = [];
    for (let i = 0; i < stops; i++) { lap += lens[i]; stopList.push({ lap, c: tpl[i + 1] }); }
    res.push({ start: tpl[0], stops: stopList, est: t, maxWear, cliffRisk, name: tpl.join('-') });
  }
  res.sort((a, b) => a.est - b.est);
  const best = res[0]?.est || 0;
  for (const r of res) {
    r.delta = r.est - best;
    r.risk = r.cliffRisk > 10 ? 'High' : r.cliffRisk > 0 ? 'Medium' : 'Low';
  }
  return res.filter((r) => r.maxWear < 110).slice(0, 6);
}
export function labelPlans(opts) {
  const byStops = [...opts];
  const conservative = byStops.find((p) => p.risk === 'Low') || byStops[0];
  const aggressive = byStops.find((p) => p.stops.length >= 2 && p !== conservative) || byStops[byStops.length - 1];
  const balanced = byStops.find((p) => p !== conservative && p !== aggressive) || byStops[0];
  return { conservative, balanced, aggressive };
}
export function clonePlan(p) { return { start: p.start, stops: p.stops.map((s) => ({ ...s })), name: p.name }; }
