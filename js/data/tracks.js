// The 24-round 2026 Formula 1 calendar venues, with real geometry (see trackShapes.js).
// Circuit characteristics are game estimates, 0..1 unless noted. baseLap (s) ≈ representative race pace,
// laps = full race distance, pit = pit-lane time loss (s). Not official data.
import { SHAPES } from './trackShapes.js';
const T = (id, geo, name, country, gp, archetype, o) => ({ id, geo, name, country, gp, archetype, ...o });
export const TRACKS = [
  T('trk_melbourne', 'au-1953', 'Albert Park Circuit', 'Australia', 'Australian GP', 'Semi-street, medium speed', { baseLap: 80.5, laps: 58, pit: 19, df: .65, drag: .55, low: .35, med: .4, high: .25, brake: .55, trac: .55, kerb: .55, ride: .5, deg: .45, fstress: .5, rstress: .5, abr: .4, ovt: .55, drs: .7, sc: .7, wx: .35, evo: .75, cool: .4, eng: .6, traffic: .5, temp: .45 }),
  T('trk_shanghai', 'cn-2004', 'Shanghai International Circuit', 'China', 'Chinese GP', 'Front-limited, long straight', { baseLap: 96, laps: 56, pit: 22, df: .7, drag: .55, low: .35, med: .4, high: .25, brake: .6, trac: .5, kerb: .35, ride: .4, deg: .65, fstress: .85, rstress: .5, abr: .5, ovt: .35, drs: .85, sc: .4, wx: .45, evo: .6, cool: .4, eng: .6, traffic: .4, temp: .4 }),
  T('trk_suzuka', 'jp-1962', 'Suzuka Circuit', 'Japan', 'Japanese GP', 'High-speed figure-eight', { baseLap: 93, laps: 53, pit: 22, df: .8, drag: .4, low: .15, med: .35, high: .5, brake: .4, trac: .4, kerb: .4, ride: .45, deg: .7, fstress: .75, rstress: .55, abr: .7, ovt: .7, drs: .5, sc: .35, wx: .6, evo: .5, cool: .35, eng: .6, traffic: .55, temp: .4 }),
  T('trk_bahrain', 'bh-2002', 'Bahrain International Circuit', 'Bahrain', 'Bahrain GP', 'Traction & rear-tyre limited', { baseLap: 96, laps: 57, pit: 23, df: .55, drag: .6, low: .5, med: .3, high: .2, brake: .8, trac: .85, kerb: .4, ride: .35, deg: .8, fstress: .45, rstress: .9, abr: .85, ovt: .3, drs: .85, sc: .35, wx: .03, evo: .6, cool: .7, eng: .7, traffic: .35, temp: .8 }),
  T('trk_jeddah', 'sa-2021', 'Jeddah Corniche Circuit', 'Saudi Arabia', 'Saudi Arabian GP', 'High-speed street circuit', { baseLap: 91, laps: 50, pit: 20, df: .5, drag: .75, low: .1, med: .3, high: .6, brake: .45, trac: .4, kerb: .5, ride: .5, deg: .35, fstress: .5, rstress: .45, abr: .3, ovt: .45, drs: .9, sc: .8, wx: .03, evo: .8, cool: .6, eng: .75, traffic: .5, temp: .7 }),
  T('trk_miami', 'us-2022', 'Miami International Autodrome', 'USA', 'Miami GP', 'Hot, mixed street-style', { baseLap: 91, laps: 57, pit: 20, df: .6, drag: .65, low: .45, med: .35, high: .2, brake: .65, trac: .7, kerb: .45, ride: .45, deg: .55, fstress: .5, rstress: .7, abr: .5, ovt: .5, drs: .8, sc: .6, wx: .45, evo: .75, cool: .85, eng: .65, traffic: .5, temp: .9 }),
  T('trk_montreal', 'ca-1978', 'Circuit Gilles Villeneuve', 'Canada', 'Canadian GP', 'Stop-start, braking heavy', { baseLap: 76, laps: 70, pit: 19, df: .35, drag: .8, low: .65, med: .2, high: .15, brake: .95, trac: .85, kerb: .9, ride: .45, deg: .45, fstress: .35, rstress: .65, abr: .35, ovt: .35, drs: .8, sc: .75, wx: .55, evo: .8, cool: .5, eng: .7, traffic: .45, temp: .5 }),
  T('trk_monaco', 'mc-1929', 'Circuit de Monaco', 'Monaco', 'Monaco GP', 'Maximum-downforce street circuit', { baseLap: 75, laps: 78, pit: 20, df: 1, drag: .1, low: .85, med: .15, high: 0, brake: .6, trac: .9, kerb: .7, ride: .8, deg: .2, fstress: .35, rstress: .5, abr: .15, ovt: 1, drs: .1, sc: .6, wx: .3, evo: .9, cool: .5, eng: .3, traffic: 1, temp: .55 }),
  T('trk_barcelona', 'es-1991', 'Circuit de Barcelona-Catalunya', 'Spain', 'Spanish GP', 'All-round aero benchmark', { baseLap: 78, laps: 66, pit: 22, df: .8, drag: .4, low: .3, med: .45, high: .25, brake: .45, trac: .55, kerb: .35, ride: .35, deg: .75, fstress: .9, rstress: .55, abr: .7, ovt: .65, drs: .6, sc: .3, wx: .2, evo: .55, cool: .5, eng: .5, traffic: .55, temp: .65 }),
  T('trk_spielberg', 'at-1969', 'Red Bull Ring', 'Austria', 'Austrian GP', 'Short power & braking', { baseLap: 68, laps: 71, pit: 20, df: .5, drag: .7, low: .45, med: .3, high: .25, brake: .8, trac: .75, kerb: .7, ride: .4, deg: .5, fstress: .4, rstress: .65, abr: .45, ovt: .35, drs: .85, sc: .45, wx: .55, evo: .55, cool: .45, eng: .75, traffic: .6, temp: .45 }),
  T('trk_silverstone', 'gb-1948', 'Silverstone Circuit', 'Great Britain', 'British GP', 'Fast sweeping corners', { baseLap: 90, laps: 52, pit: 20, df: .75, drag: .5, low: .1, med: .35, high: .55, brake: .35, trac: .35, kerb: .4, ride: .5, deg: .75, fstress: .85, rstress: .5, abr: .65, ovt: .45, drs: .6, sc: .35, wx: .75, evo: .45, cool: .3, eng: .6, traffic: .4, temp: .3 }),
  T('trk_spa', 'be-1925', 'Circuit de Spa-Francorchamps', 'Belgium', 'Belgian GP', 'Long, low-drag with Eau Rouge', { baseLap: 107, laps: 44, pit: 19, df: .45, drag: .85, low: .2, med: .35, high: .45, brake: .55, trac: .45, kerb: .45, ride: .55, deg: .55, fstress: .6, rstress: .55, abr: .5, ovt: .3, drs: .9, sc: .45, wx: .9, evo: .4, cool: .35, eng: .9, traffic: .3, temp: .3 }),
  T('trk_hungaroring', 'hu-1986', 'Hungaroring', 'Hungary', 'Hungarian GP', 'Twisty high-downforce', { baseLap: 80.5, laps: 70, pit: 21, df: .9, drag: .25, low: .55, med: .35, high: .1, brake: .5, trac: .7, kerb: .45, ride: .4, deg: .6, fstress: .5, rstress: .7, abr: .5, ovt: .85, drs: .45, sc: .3, wx: .35, evo: .7, cool: .75, eng: .45, traffic: .8, temp: .8 }),
  T('trk_zandvoort', 'nl-1948', 'Circuit Zandvoort', 'Netherlands', 'Dutch GP', 'Banked, narrow old-school', { baseLap: 74, laps: 72, pit: 21, df: .9, drag: .3, low: .35, med: .4, high: .25, brake: .4, trac: .5, kerb: .4, ride: .45, deg: .6, fstress: .6, rstress: .6, abr: .7, ovt: .9, drs: .45, sc: .55, wx: .65, evo: .65, cool: .35, eng: .5, traffic: .85, temp: .35 }),
  T('trk_monza', 'it-1922', 'Autodromo Nazionale Monza', 'Italy', 'Italian GP', 'Temple of speed, minimum drag', { baseLap: 83.5, laps: 53, pit: 24, df: .1, drag: 1, low: .35, med: .25, high: .4, brake: .85, trac: .55, kerb: .75, ride: .35, deg: .35, fstress: .35, rstress: .5, abr: .35, ovt: .3, drs: .9, sc: .4, wx: .3, evo: .45, cool: .45, eng: 1, traffic: .35, temp: .55 }),
  T('trk_madrid', 'es-2026', 'Madring', 'Spain', 'Madrid GP', 'New semi-street with banking', { baseLap: 91, laps: 57, pit: 21, df: .7, drag: .55, low: .4, med: .35, high: .25, brake: .6, trac: .6, kerb: .5, ride: .6, deg: .5, fstress: .55, rstress: .55, abr: .45, ovt: .55, drs: .75, sc: .6, wx: .15, evo: .9, cool: .6, eng: .6, traffic: .55, temp: .65 }),
  T('trk_baku', 'az-2016', 'Baku City Circuit', 'Azerbaijan', 'Azerbaijan GP', 'Street circuit, 2km flat-out', { baseLap: 105, laps: 51, pit: 20, df: .4, drag: .85, low: .65, med: .15, high: .2, brake: .8, trac: .75, kerb: .55, ride: .55, deg: .35, fstress: .4, rstress: .5, abr: .3, ovt: .35, drs: .95, sc: .8, wx: .2, evo: .85, cool: .45, eng: .85, traffic: .5, temp: .5 }),
  T('trk_singapore', 'sg-2008', 'Marina Bay Street Circuit', 'Singapore', 'Singapore GP', 'Hot, humid night street race', { baseLap: 96, laps: 62, pit: 28, df: .95, drag: .2, low: .75, med: .2, high: .05, brake: .75, trac: .9, kerb: .85, ride: .7, deg: .5, fstress: .45, rstress: .75, abr: .4, ovt: .85, drs: .4, sc: .85, wx: .45, evo: .8, cool: .95, eng: .45, traffic: .85, temp: .95 }),
  T('trk_austin', 'us-2012', 'Circuit of the Americas', 'USA', 'United States GP', 'Bumpy, mixed with esses', { baseLap: 98, laps: 56, pit: 21, df: .75, drag: .5, low: .35, med: .35, high: .3, brake: .6, trac: .6, kerb: .6, ride: .75, deg: .65, fstress: .7, rstress: .6, abr: .6, ovt: .45, drs: .75, sc: .4, wx: .3, evo: .6, cool: .55, eng: .6, traffic: .45, temp: .6 }),
  T('trk_mexico', 'mx-1962', 'Autódromo Hermanos Rodríguez', 'Mexico', 'Mexico City GP', 'High altitude: low drag, cooling', { baseLap: 80, laps: 71, pit: 22, df: .9, drag: .4, low: .5, med: .35, high: .15, brake: .7, trac: .6, kerb: .5, ride: .4, deg: .4, fstress: .4, rstress: .55, abr: .35, ovt: .5, drs: .75, sc: .4, wx: .2, evo: .7, cool: 1, eng: .85, traffic: .5, temp: .5 }),
  T('trk_interlagos', 'br-1940', 'Autódromo José Carlos Pace', 'Brazil', 'São Paulo GP', 'Anti-clockwise, rain-prone', { baseLap: 73, laps: 71, pit: 21, df: .65, drag: .6, low: .4, med: .4, high: .2, brake: .55, trac: .65, kerb: .5, ride: .65, deg: .55, fstress: .5, rstress: .6, abr: .55, ovt: .35, drs: .8, sc: .65, wx: .85, evo: .55, cool: .5, eng: .65, traffic: .55, temp: .6 }),
  T('trk_vegas', 'us-2023', 'Las Vegas Strip Circuit', 'USA', 'Las Vegas GP', 'Cold night, long straights', { baseLap: 96, laps: 50, pit: 20, df: .3, drag: .9, low: .6, med: .2, high: .2, brake: .8, trac: .7, kerb: .45, ride: .5, deg: .35, fstress: .55, rstress: .45, abr: .35, ovt: .3, drs: .95, sc: .55, wx: .05, evo: .95, cool: .25, eng: .8, traffic: .4, temp: .1 }),
  T('trk_lusail', 'qa-2004', 'Lusail International Circuit', 'Qatar', 'Qatar GP', 'Flowing, tyre-punishing', { baseLap: 85, laps: 57, pit: 25, df: .8, drag: .45, low: .1, med: .5, high: .4, brake: .35, trac: .35, kerb: .7, ride: .4, deg: .9, fstress: .9, rstress: .6, abr: .8, ovt: .55, drs: .7, sc: .3, wx: .02, evo: .5, cool: .7, eng: .6, traffic: .45, temp: .75 }),
  T('trk_yasmarina', 'ae-2009', 'Yas Marina Circuit', 'Abu Dhabi', 'Abu Dhabi GP', 'Twilight finale, traction', { baseLap: 88, laps: 58, pit: 21, df: .65, drag: .6, low: .5, med: .35, high: .15, brake: .65, trac: .75, kerb: .4, ride: .35, deg: .45, fstress: .45, rstress: .6, abr: .35, ovt: .45, drs: .8, sc: .35, wx: .02, evo: .7, cool: .6, eng: .65, traffic: .45, temp: .6 }),
];
export const trackById = (id) => TRACKS.find((t) => t.id === id) || TRACKS[0];
export const shapeOf = (t) => SHAPES[t.geo];
export function trackPoints(track) { return shapeOf(track).pts; }
export function trackPath(track) { const p = trackPoints(track); return 'M' + p.map((q) => q.join(',')).join('L') + 'Z'; }

// ---- Speed profile (quasi-steady-state lap sim) --------------------------------------------
// Returns arrays over the 200 samples: d (distance fraction), tf (time fraction at sample), v (m/s scaled so lap = baseLap).
const cache = {};
export function lapProfile(track, carAdj = null) {
  const key = track.id + (carAdj ? JSON.stringify(carAdj) : '');
  if (cache[key]) return cache[key];
  const sh = shapeOf(track); const N = sh.rad.length; const ds = sh.len / N;
  const corner = carAdj?.corner ?? 1, top = carAdj?.top ?? 1;
  const vTop = (86 + track.drag * 10) * top;
  const vmax = sh.rad.map((r) => { const aLat = (26 + 26 * Math.min(1, r / 250)) * corner; return Math.min(vTop, Math.sqrt(aLat * Math.max(12, r))); });
  const v = vmax.slice();
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < N; i++) { const p = v[(i - 1 + N) % N]; const acc = 13 * (1 - p / (vTop * 1.05)) + 1.5; v[i] = Math.min(vmax[i], Math.sqrt(p * p + 2 * acc * ds)); }
    for (let i = N - 1; i >= 0; i--) { const n = v[(i + 1) % N]; v[i] = Math.min(v[i], Math.sqrt(n * n + 2 * 42 * ds)); }
  }
  const dt = v.map((x, i) => ds / ((x + v[(i + 1) % N]) / 2));
  const total = dt.reduce((a, b) => a + b, 0);
  const tf = []; let acc = 0; for (let i = 0; i < N; i++) { tf.push(acc / total); acc += dt[i]; }
  const k = total / track.baseLap; // scale speeds so the modelled lap matches baseLap
  const prof = { N, d: v.map((_, i) => i / N), tf, v: v.map((x) => x * k), vmax: vmax.map((x) => x * k), len: sh.len, simLap: total };
  // braking/throttle states
  prof.phase = prof.v.map((x, i) => { const n = prof.v[(i + 1) % N]; return n < x - 0.4 ? 'brake' : x >= prof.vmax[i] - 0.5 && prof.vmax[i] < vTop * k - 1 ? 'corner' : 'throttle'; });
  // sector boundaries at 1/3 and 2/3 distance
  prof.fullThrottle = prof.phase.reduce((a, ph, i) => a + (ph === 'throttle' ? dt[i] : 0), 0) / total;
  prof.sectorTf = [tf[Math.floor(N / 3)], tf[Math.floor((2 * N) / 3)]];
  cache[key] = prof; return prof;
}
// Time-fraction -> {d (distance fraction), v (km/h), gear, throttle, brake, i}
export function sampleAt(prof, f) {
  f = ((f % 1) + 1) % 1; const { tf, N } = prof;
  let lo = 0, hi = N - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (tf[m] <= f) lo = m; else hi = m - 1; }
  const i = lo, j = (i + 1) % N; const t0 = tf[i], t1 = j === 0 ? 1 : tf[j];
  const u = t1 > t0 ? (f - t0) / (t1 - t0) : 0;
  const d = (i + u) / N; const v = (prof.v[i] + (prof.v[j] - prof.v[i]) * u) * 3.6;
  const ph = prof.phase[i];
  return { d, v, i, gear: Math.max(1, Math.min(8, Math.ceil(v / 42))), throttle: ph === 'brake' ? 0 : ph === 'corner' ? 55 : 100, brake: ph === 'brake' ? 100 : 0 };
}
export const kmLen = (t) => (shapeOf(t).len / 1000).toFixed(3);

// ---- Climate (typical daytime highs, °C, January / July) — from long-term climate normals (approximate) ----
// night: race held at night/twilight (cooler air). Used with the month a race is held in.
export const CLIMATE = {
  trk_melbourne: [26, 14], trk_shanghai: [8, 32], trk_suzuka: [10, 31], trk_bahrain: [20, 38, 1], trk_jeddah: [29, 39, 1],
  trk_miami: [24, 33], trk_montreal: [-5, 26], trk_monaco: [13, 26], trk_barcelona: [14, 28], trk_spielberg: [0, 24],
  trk_silverstone: [7, 22], trk_spa: [4, 21], trk_hungaroring: [2, 28], trk_zandvoort: [6, 21], trk_monza: [6, 30],
  trk_madrid: [10, 33], trk_baku: [7, 31], trk_singapore: [30, 31, 1], trk_austin: [17, 35], trk_mexico: [21, 24],
  trk_interlagos: [28, 22], trk_vegas: [14, 40, 1], trk_lusail: [22, 41, 1], trk_yasmarina: [24, 41, 1],
};
// Month of each round on the real 2026 calendar (index = calendar order)
export const MONTH_2026 = [3, 3, 3, 4, 4, 5, 5, 6, 6, 6, 7, 7, 7, 8, 9, 9, 9, 10, 10, 11, 11, 11, 11, 12];
export const MONTH_NAME = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function climateAir(track, month) {
  const [jan, jul, night] = CLIMATE[track.id] || [18, 26];
  const t = (jan + jul) / 2 + ((jan - jul) / 2) * Math.cos((2 * Math.PI * (month - 1)) / 12);
  return t - (night ? 5 : 0);
}
// Month for a given round: real calendar -> real month; custom/random order -> spread March..December
export function monthFor(state, round) {
  const id = state.calendar[round]; const idx = TRACKS.findIndex((t) => t.id === id);
  if (state.calendarOrder !== 'random' && idx >= 0) return MONTH_2026[idx];
  const n = state.calendar.length; return Math.min(12, 3 + Math.floor((round / Math.max(1, n)) * 10));
}
