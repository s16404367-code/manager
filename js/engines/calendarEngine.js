// Season calendar: a fixed year plan (start, development window, testing, race dates, end) that the
// player advances week by week. Race dates are predetermined; events/offers/failures between them are not.
import { MONTH_NAME } from '../data/tracks.js';

export const YEAR_WEEKS = 52;

// First Monday of the year, then +7 days per week
export function weekDate(year, week) {
  const d = new Date(Date.UTC(year, 0, 1));
  const shift = (8 - d.getUTCDay()) % 7; // days to first Monday
  d.setUTCDate(1 + shift + (week - 1) * 7);
  return d;
}
export const fmtDate = (d) => `${d.getUTCDate()} ${MONTH_NAME[d.getUTCMonth() + 1]}`;
export const weekMonth = (year, week) => weekDate(year, week).getUTCMonth() + 1;
export const weekLabel = (year, week) => `Week ${week} · ${fmtDate(weekDate(year, week))}`;

// Spread N races across the year. 24 races ≈ early March → early December (like the real calendar);
// fewer races use a proportionally shorter window, centred on the European summer.
export function buildSchedule(year, n) {
  const span = Math.round(4 + 34 * Math.min(1, Math.max(0, (n - 1) / 23))); // weeks between first and last race
  const first = n >= 20 ? 10 : Math.max(10, Math.round(26 - span / 2));
  const last = first + span;
  const weeks = [];
  for (let i = 0; i < n; i++) weeks.push(n === 1 ? first : Math.round(first + (i * (last - first)) / (n - 1)));
  for (let i = 1; i < n; i++) if (weeks[i] <= weeks[i - 1]) weeks[i] = weeks[i - 1] + 1;
  return {
    year, weeks,
    start: 1,                         // factory reopens, season budget released
    devOpen: 2,                       // upgrade projects may start
    testing: Math.max(3, first - 2),  // pre-season test
    first: weeks[0], last: weeks[n - 1],
    end: YEAR_WEEKS,                  // year closes → season review
  };
}

export function ensureSchedule(state) {
  if (state.mode !== 'career') return;
  const n = state.calendar.length;
  if (!state.schedule || state.schedule.weeks.length !== n || state.schedule.year !== state.year) {
    state.schedule = buildSchedule(state.year, n);
    // older saves: place the clock at the next race week
    if (state.week == null) state.week = state.round > 0 ? state.schedule.weeks[Math.min(state.round, n - 1)] : 1;
  }
  state.week ??= 1;
}

export function phaseOf(state) {
  const s = state.schedule; if (!s) return 'season';
  const w = state.week;
  if (state.round >= state.calendar.length) return 'offseason';
  if (w < s.devOpen) return 'winter';
  if (w < s.testing) return 'preseason';
  if (w < s.first) return 'testing';
  return 'season';
}
export const PHASE_LABEL = { winter: 'Winter shutdown ending', preseason: 'Pre-season build', testing: 'Pre-season testing', season: 'Racing season', offseason: 'Off-season' };

export const nextRaceWeek = (state) => state.schedule?.weeks[state.round];
export const weeksToRace = (state) => { const w = nextRaceWeek(state); return w == null ? null : w - state.week; };
export const raceDue = (state) => state.mode !== 'career' || !state.schedule || state.round >= state.calendar.length || state.week >= nextRaceWeek(state);
export const raceDate = (state, round) => fmtDate(weekDate(state.year, state.schedule.weeks[round]));
