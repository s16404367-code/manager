// Week-by-week season clock: HQ card, year-plan strip, advance buttons.
import { app, on, esc, persist, render, toast, go } from './app.js';
import { trackById } from '../data/tracks.js';
import * as C from '../engines/careerEngine.js';
import { ensureSchedule, phaseOf, PHASE_LABEL, weekDate, fmtDate, weeksToRace, raceDue, YEAR_WEEKS } from '../engines/calendarEngine.js';

export function yearStrip(s, compact = false) {
  ensureSchedule(s); const sc = s.schedule; if (!sc) return '';
  const pct = (w) => ((w - 1) / (YEAR_WEEKS - 1)) * 100;
  const months = Array.from({ length: 12 }, (_, m) => { const d = new Date(Date.UTC(sc.year, m, 1)); const w = Math.max(1, Math.round((d - weekDate(sc.year, 1)) / 6048e5) + 1); return `<span class="ym" style="left:${pct(w)}%">${['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][m]}</span>`; }).join('');
  const races = sc.weeks.map((w, i) => { const t = trackById(s.calendar[i]); const done = i < s.round; return `<i class="yr ${done ? 'done' : ''} ${i === s.round ? 'next' : ''}" style="left:${pct(w)}%" title="R${i + 1} ${esc(t?.name || '')} — ${fmtDate(weekDate(sc.year, w))} (week ${w})"></i>`; }).join('');
  const mk = (w, cls, label) => `<i class="ymk ${cls}" style="left:${pct(w)}%" title="${label} — week ${w}, ${fmtDate(weekDate(sc.year, w))}"></i>`;
  return `<div class="ystrip ${compact ? 'compact' : ''}"><div class="ybar"><div class="yseason" style="left:${pct(sc.first)}%;width:${pct(sc.last) - pct(sc.first)}%"></div>${mk(sc.start, 'st', 'Year starts')}${mk(sc.devOpen, 'dev', 'Development opens')}${mk(sc.testing, 'test', 'Pre-season testing')}${mk(sc.end, 'end', 'Year closes')}${races}<i class="ynow" style="left:${pct(s.week)}%" title="Now: week ${s.week}"></i></div><div class="ymonths">${months}</div>
  ${compact ? '' : `<div class="tiny muted ylegend"><span><i class="ymk st"></i>Year start</span><span><i class="ymk dev"></i>Development opens</span><span><i class="ymk test"></i>Testing</span><span><i class="yr"></i>Race</span><span><i class="ynow"></i>Today</span><span><i class="ymk end"></i>Year closes</span></div>`}</div>`;
}

export function yearPlanList(s) {
  ensureSchedule(s); const sc = s.schedule; const d = (w) => fmtDate(weekDate(sc.year, w));
  return `<ul class="small yplan"><li><b>${d(sc.start)}</b> — factory reopens, budget released (week ${sc.start})</li><li><b>${d(sc.devOpen)}</b> — upgrade projects can start (week ${sc.devOpen})</li><li><b>${d(sc.testing)}</b> — pre-season testing (week ${sc.testing})</li><li><b>${d(sc.first)} → ${d(sc.last)}</b> — ${s.calendar.length} races (weeks ${sc.first}–${sc.last})</li><li><b>${d(sc.end)}</b> — year closes, season review (week ${sc.end})</li></ul><p class="tiny muted">Dates of the races are fixed. What happens in the weeks between (offers, failures, staff news, events) is not.</p>`;
}

export function clockCard(s) {
  ensureSchedule(s); const sc = s.schedule; const ph = phaseOf(s);
  const n = weeksToRace(s); const tr = s.calendar[s.round] ? trackById(s.calendar[s.round]) : null;
  const due = raceDue(s);
  const off = s.round >= s.calendar.length;
  const next = off ? `<div class="small">All ${s.calendar.length} races done. ${YEAR_WEEKS - s.week} week(s) until the year closes.</div>`
    : `<div class="small">Next: <b>${esc(tr.name)}</b> — ${fmtDate(weekDate(sc.year, sc.weeks[s.round]))} (R${s.round + 1}/${s.calendar.length}) · ${due ? '<b class="good">race week!</b>' : `in <b>${n}</b> week${n === 1 ? '' : 's'}`}</div>`;
  const btns = off
    ? `<button class="btn" data-act="wkNext" ${s.pendingEvent ? 'disabled' : ''}>Next week ▶</button><button class="btn primary" data-act="wkClose">Close the year → season review</button>`
    : due ? `<button class="btn primary" data-act="go" data-arg="weekend" ${s.pendingEvent ? 'disabled title="Resolve the pending decision first"' : ''}>${s.weekend ? 'Resume weekend' : 'Go to race weekend'} →</button>`
      : `<button class="btn primary" data-act="wkNext" ${s.pendingEvent ? 'disabled title="Resolve the pending decision first"' : ''}>Next week ▶</button><button class="btn" data-act="wkRace" ${s.pendingEvent ? 'disabled' : ''}>Advance to race week ⏩</button>`;
  return `<div class="card clock"><div class="row"><h4 style="margin:0">📅 ${s.year} · Week ${s.week}/${YEAR_WEEKS}</h4><span class="sp"></span><span class="pill">${PHASE_LABEL[ph]}</span></div>
  <div class="small muted" style="margin:.2rem 0 .4rem">Monday ${fmtDate(weekDate(sc.year, s.week))}${s.week < sc.devOpen ? ` · development opens week ${sc.devOpen}` : ''}</div>${next}
  ${yearStrip(s, true)}
  <div class="row" style="margin-top:.6rem">${btns}</div>
  <div class="tiny muted" style="margin-top:.3rem">Each week: projects progress, fatigue changes, and offers or problems may appear. Advancing stops early when a decision is needed.</div></div>`;
}

on({
  wkNext: () => { const r = C.advanceWeek(app.state); persist(); render(); if (r === 'event') toast('Something came up — decision needed in HQ.', 'warn'); else if (r === 'end') go('review'); else toast(`Week ${app.state.week}`, 'info', 900); },
  wkRace: () => { const r = C.advanceToRace(app.state); persist(); render(); const due = app.state.round < app.state.calendar.length && app.state.week >= app.state.schedule.weeks[app.state.round]; toast(due ? 'Race week! Travel to the circuit.' : `Stopped in week ${app.state.week}: a decision is needed.`, due ? 'good' : 'warn'); },
  wkClose: () => { C.closeYear(app.state); persist(); go('review'); },
});
