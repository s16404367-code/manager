// Fictional circuits. All values 0..1 unless noted. baseLap in seconds, laps = full distance, pit = pit-lane loss (s).
// shape: harmonic seeds used to procedurally draw a unique closed-loop minimap.
const T = (id, name, country, archetype, o) => ({ id, name, country, archetype, ...o });
export const TRACKS = [
  T('trk_portmarin', 'Port Marin Street Circuit', 'Monavia', 'High-downforce street circuit', { baseLap: 74, laps: 70, pit: 19, df: .95, drag: .2, low: .7, med: .25, high: .05, brake: .7, trac: .85, kerb: .8, ride: .7, deg: .35, fstress: .4, rstress: .55, abr: .3, ovt: .95, drs: .3, sc: .55, wx: .25, evo: .8, cool: .5, eng: .35, traffic: .9, temp: .55, shape: [3, 0.28, 5, 0.12, 7] }),
  T('trk_velocita', 'Autodromo Velocità', 'Italvia', 'Low-drag power circuit', { baseLap: 81, laps: 53, pit: 24, df: .2, drag: .95, low: .3, med: .2, high: .5, brake: .75, trac: .4, kerb: .5, ride: .3, deg: .45, fstress: .35, rstress: .5, abr: .4, ovt: .25, drs: .9, sc: .3, wx: .3, evo: .4, cool: .5, eng: .95, traffic: .3, temp: .55, shape: [2, 0.35, 3, 0.1, 4] }),
  T('trk_silverbrook', 'Silverbrook Park', 'Albrion', 'High-speed traditional circuit', { baseLap: 88, laps: 52, pit: 20, df: .7, drag: .5, low: .15, med: .3, high: .55, brake: .4, trac: .4, kerb: .4, ride: .5, deg: .7, fstress: .8, rstress: .5, abr: .6, ovt: .45, drs: .6, sc: .3, wx: .75, evo: .45, cool: .3, eng: .6, traffic: .4, temp: .3, shape: [3, 0.22, 4, 0.18, 6] }),
  T('trk_hanasaki', 'Hanasaki Ring', 'Nihora', 'Mixed technical circuit', { baseLap: 91, laps: 53, pit: 22, df: .75, drag: .45, low: .3, med: .35, high: .35, brake: .45, trac: .5, kerb: .45, ride: .45, deg: .6, fstress: .7, rstress: .55, abr: .55, ovt: .6, drs: .55, sc: .35, wx: .6, evo: .5, cool: .4, eng: .6, traffic: .5, temp: .45, shape: [2, 0.3, 5, 0.2, 3] }),
  T('trk_dunesabr', 'Sabr Dunes International', 'Qaradesh', 'High-temperature circuit', { baseLap: 92, laps: 57, pit: 23, df: .55, drag: .6, low: .4, med: .35, high: .25, brake: .7, trac: .75, kerb: .4, ride: .4, deg: .75, fstress: .5, rstress: .85, abr: .8, ovt: .35, drs: .8, sc: .25, wx: .05, evo: .7, cool: .95, eng: .75, traffic: .4, temp: .95, shape: [3, 0.3, 2, 0.15, 5] }),
  T('trk_verdanta', 'Verdanta Valley', 'Brasoria', 'Wet-prone circuit', { baseLap: 71, laps: 71, pit: 21, df: .6, drag: .6, low: .4, med: .4, high: .2, brake: .55, trac: .6, kerb: .5, ride: .6, deg: .55, fstress: .5, rstress: .6, abr: .55, ovt: .35, drs: .75, sc: .5, wx: .95, evo: .5, cool: .5, eng: .65, traffic: .5, temp: .6, shape: [2, 0.4, 3, 0.2, 5] }),
  T('trk_kestrel', 'Kestrel Bay Raceway', 'Ostralis', 'Tyre-limited circuit', { baseLap: 80, laps: 58, pit: 21, df: .6, drag: .5, low: .35, med: .4, high: .25, brake: .5, trac: .6, kerb: .4, ride: .4, deg: .95, fstress: .75, rstress: .8, abr: .95, ovt: .4, drs: .7, sc: .4, wx: .45, evo: .6, cool: .5, eng: .5, traffic: .4, temp: .6, shape: [4, 0.2, 3, 0.2, 6] }),
  T('trk_brakmont', 'Brakmont Circuit', 'Canmara', 'Braking-heavy circuit', { baseLap: 73, laps: 70, pit: 18, df: .4, drag: .75, low: .6, med: .15, high: .1, brake: .95, trac: .8, kerb: .85, ride: .5, deg: .4, fstress: .35, rstress: .6, abr: .35, ovt: .3, drs: .75, sc: .6, wx: .45, evo: .75, cool: .45, eng: .7, traffic: .45, temp: .5, shape: [2, 0.25, 4, 0.1, 6] }),
  T('trk_altacumbre', 'Alta Cumbre Autódromo', 'Mexandor', 'High-altitude circuit', { baseLap: 78, laps: 71, pit: 20, df: .85, drag: .35, low: .45, med: .35, high: .2, brake: .65, trac: .6, kerb: .5, ride: .4, deg: .4, fstress: .4, rstress: .5, abr: .35, ovt: .5, drs: .65, sc: .35, wx: .3, evo: .6, cool: .95, eng: .85, traffic: .45, temp: .5, shape: [3, 0.2, 5, 0.15, 2] }),
  T('trk_nordwald', 'Nordwald Ring', 'Germara', 'Mixed technical circuit', { baseLap: 83, laps: 60, pit: 21, df: .65, drag: .5, low: .35, med: .4, high: .25, brake: .55, trac: .55, kerb: .45, ride: .45, deg: .5, fstress: .5, rstress: .55, abr: .45, ovt: .45, drs: .6, sc: .3, wx: .55, evo: .5, cool: .4, eng: .55, traffic: .45, temp: .4, shape: [3, 0.18, 2, 0.3, 5] }),
  T('trk_lakeside', 'Lakeside Speedpark', 'Belvania', 'High-speed traditional circuit', { baseLap: 105, laps: 44, pit: 20, df: .6, drag: .65, low: .15, med: .35, high: .5, brake: .45, trac: .4, kerb: .35, ride: .55, deg: .6, fstress: .7, rstress: .55, abr: .5, ovt: .4, drs: .7, sc: .45, wx: .85, evo: .4, cool: .3, eng: .7, traffic: .35, temp: .3, shape: [2, 0.3, 3, 0.25, 7] }),
  T('trk_marinabay', 'Marina Lights Circuit', 'Singara', 'High-downforce street circuit', { baseLap: 98, laps: 62, pit: 28, df: .95, drag: .25, low: .7, med: .25, high: .05, brake: .75, trac: .9, kerb: .9, ride: .65, deg: .5, fstress: .45, rstress: .7, abr: .4, ovt: .8, drs: .45, sc: .85, wx: .55, evo: .8, cool: .9, eng: .45, traffic: .8, temp: .9, shape: [4, 0.25, 6, 0.1, 3] }),
  T('trk_steppes', 'Steppe Forge Circuit', 'Kazaria', 'Low-drag power circuit', { baseLap: 101, laps: 51, pit: 20, df: .3, drag: .9, low: .35, med: .2, high: .45, brake: .7, trac: .5, kerb: .55, ride: .35, deg: .45, fstress: .4, rstress: .5, abr: .35, ovt: .25, drs: .95, sc: .6, wx: .25, evo: .7, cool: .5, eng: .9, traffic: .35, temp: .5, shape: [2, 0.2, 5, 0.25, 4] }),
  T('trk_castellan', 'Castellan Park', 'Hispara', 'Tyre-limited circuit', { baseLap: 78, laps: 66, pit: 22, df: .8, drag: .4, low: .3, med: .45, high: .3, brake: .45, trac: .55, kerb: .35, ride: .35, deg: .8, fstress: .9, rstress: .55, abr: .7, ovt: .75, drs: .5, sc: .25, wx: .2, evo: .5, cool: .5, eng: .5, traffic: .6, temp: .65, shape: [3, 0.25, 4, 0.2, 2] }),
  T('trk_ironharbor', 'Iron Harbor Street Track', 'Columbia Nova', 'Braking-heavy circuit', { baseLap: 96, laps: 50, pit: 20, df: .45, drag: .75, low: .55, med: .2, high: .15, brake: .9, trac: .75, kerb: .7, ride: .75, deg: .35, fstress: .35, rstress: .55, abr: .3, ovt: .35, drs: .85, sc: .75, wx: .35, evo: .85, cool: .55, eng: .65, traffic: .5, temp: .5, shape: [2, 0.35, 4, 0.08, 6] }),
  T('trk_monsoon', 'Monsoon Coast Circuit', 'Indara', 'Wet-prone circuit', { baseLap: 94, laps: 56, pit: 21, df: .6, drag: .55, low: .35, med: .35, high: .3, brake: .6, trac: .6, kerb: .5, ride: .5, deg: .6, fstress: .55, rstress: .6, abr: .6, ovt: .4, drs: .7, sc: .45, wx: .9, evo: .55, cool: .75, eng: .6, traffic: .45, temp: .8, shape: [3, 0.3, 5, 0.18, 4] }),
];
export const trackById = (id) => TRACKS.find((t) => t.id === id);

// Procedural closed-loop minimap path (0..100 viewbox) from shape harmonics.
export function trackPoints(track, n = 180) {
  const [a, ra, b, rb, c] = track.shape; const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const r = 1 + ra * Math.sin(a * t + c) + rb * Math.cos(b * t + a * 0.7) + 0.05 * Math.sin((c + 3) * t);
    pts.push([50 + 38 * r * Math.cos(t) * 0.95, 50 + 30 * r * Math.sin(t)]);
  }
  // normalise into viewbox
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const sc = Math.min(88 / (maxX - minX), 64 / (maxY - minY));
  return pts.map(([x, y]) => [6 + (x - minX) * sc + (88 - (maxX - minX) * sc) / 2, 6 + (y - minY) * sc + (64 - (maxY - minY) * sc) / 2]);
}
export function trackPath(track) { const p = trackPoints(track); return 'M' + p.map((q) => q.map((v) => v.toFixed(2)).join(',')).join('L') + 'Z'; }
