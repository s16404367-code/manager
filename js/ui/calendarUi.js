// Week-by-week season clock: HQ card, year-plan strip, advance buttons.
import { app, on, esc, persist, render, toast, go } from './app.js';
import { trackById } from '../data/tracks.js';
import * as C from '../engines/careerEngine.js';
import { ensureSchedule, phaseOf, PHASE_LABEL, weekDate, fmtDate, weeksToRace, raceDue, YEAR_WEEKS } from '../engines/calendarEngine.js';

const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const flagCode = (t) => (t?.country || '???').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
// Weeks of the year grouped by month. Each week is a cell: race weeks carry the venue code.
function cellsByMonth(s) {
  const sc = s.schedule; const out = MN.map(() => []);
  for (let w = 1; w <= YEAR_WEEKS; w++) {
    const m = weekDate(sc.year, w).getUTCMonth(); const ri = sc.weeks.indexOf(w);
    const t = ri >= 0 ? trackById(s.calendar[ri]) : null;
    const kind = ri >= 0 ? (ri < s.round ? 'race done' : ri === s.round ? 'race next' : 'race') : (w === sc.testing || Object.values(C.testWeeks(s)).includes(w)) ? 'test' : w === sc.devOpen ? 'dev' : w === sc.start ? 'st' : w === sc.end ? 'end' : '';
    out[Math.min(11, m)].push({ w, kind, t, ri, past: w < s.week, now: w === s.week });
  }
  return out;
}
export function yearStrip(s, compact = false) {
  ensureSchedule(s); const sc = s.schedule; if (!sc) return '';
  if (compact) {
    // one-row progress rail: filled up to today, race pips, pulsing "you are here"
    const pct = (w) => ((w - 1) / (YEAR_WEEKS - 1)) * 100;
    return `<div class="yrail"><div class="yrail-fill" style="width:${pct(s.week)}%"></div>${sc.weeks.map((w, i) => `<i class="yp ${i < s.round ? 'done' : i === s.round ? 'next' : ''}" style="left:${pct(w)}%" title="R${i + 1} ${esc(trackById(s.calendar[i])?.name || '')} · ${fmtDate(weekDate(sc.year, w))}"></i>`).join('')}<i class="yhere" style="left:${pct(s.week)}%"></i></div>
    <div class="yrail-m">${MN.map((m) => `<span>${m[0]}</span>`).join('')}</div>`;
  }
  const months = cellsByMonth(s);
  return `<div class="ycal">${months.map((cells, m) => `<div class="ycm ${cells.some((c) => c.now) ? 'cur' : ''}"><div class="ycmh">${MN[m]}</div><div class="ycw">${cells.map((c) => `<div class="yc ${c.kind} ${c.past ? 'past' : ''} ${c.now ? 'now' : ''}" title="Week ${c.w} · ${fmtDate(weekDate(sc.year, c.w))}${c.t ? ` · R${c.ri + 1} ${esc(c.t.name)}` : c.kind === 'test' ? ' · Pre-season testing' : c.kind === 'dev' ? ' · Development opens' : c.kind === 'st' ? ' · Year starts' : c.kind === 'end' ? ' · Year closes' : ''}">${c.t ? `<span>${flagCode(c.t)}</span>` : c.kind === 'test' ? '🧪' : c.kind === 'dev' ? '🔧' : c.kind === 'end' ? '🏁' : c.kind === 'st' ? '▶' : ''}</div>`).join('')}</div></div>`).join('')}</div>
  <div class="tiny muted ylegend"><span><i class="yc sw race"></i>Race</span><span><i class="yc sw race next"></i>Next race</span><span><i class="yc sw race done"></i>Done</span><span><i class="yc sw test"></i>Testing</span><span><i class="yc sw dev"></i>Development opens</span><span><i class="yc sw now"></i>This week</span></div>`;
}

export function yearPlanList(s) {
  ensureSchedule(s); const sc = s.schedule; const d = (w) => fmtDate(weekDate(sc.year, w)); const tw = C.testWeeks(s);
  const n = s.calendar.length; const voteRound = Math.floor(n / 2); const voteWeek = sc.weeks[voteRound] || sc.last;
  const ms = [
    [sc.start, '🏁', 'Factory reopens', 'Season budget released'],
    [sc.devOpen, '✏️', 'Development opens', 'Upgrade projects can start'],
    [tw.pre, '🧪', 'Pre-season test', '3 days · car & driver knowledge'],
    [sc.first, '🚦', `Race 1 — ${trackById(s.calendar[0])?.name || ''}`, `${n} races to ${d(sc.last)}`],
    ...(tw.mid ? [[tw.mid, '🧪', 'In-season test', '2 days · measure upgrades']] : []),
    [voteWeek, '🗳️', 'Rules vote', s.regulation?.vote ? (s.regulation.vote.passed ? 'Passed — new rules next year' : 'Rejected') : 'F1 Commission votes on next year'],
    [sc.last, '🏆', `Final race — ${trackById(s.calendar[n - 1])?.name || ''}`, 'Constructors\' bonus paid at year end'],
    [tw.post, '🧪', 'Post-season test', 'Track time by standings'],
    [sc.end, '📊', 'Year closes', 'Season review, cash carries over'],
  ].sort((x, y) => x[0] - y[0]);
  const nextI = ms.findIndex((m) => m[0] >= s.week);
  return `<div class="ytl">${ms.map(([w, ic, h, sub], i) => `<div class="ytli ${w < s.week ? 'done' : i === nextI ? 'next' : ''}"><span class="ytld">${w < s.week ? '✓' : ic}</span><div><b>${esc(h)}</b><small>${d(w)} · wk ${w}${i === nextI && w > s.week ? ` · in ${w - s.week} wk` : i === nextI ? ' · this week' : ''}</small><small class="muted">${esc(sub)}</small></div></div>`).join('')}</div>`;
}

// "What happens when you press Next week" — a live mini-dashboard instead of a text tip
function thisWeek(s) {
  const P = s.teams[s.player]; const act = s.projects.filter((p) => ['design', 'manufacturing'].includes(p.stage));
  const soon = act.length ? Math.min(...act.map((p) => p.weeksLeft + (p.stage === 'design' ? p.mfgWeeks || 0 : 0))) : null;
  const fat = Math.round(Object.values(P.depts).reduce((a, d) => a + d.fatigue, 0) / Object.keys(P.depts).length);
  const tw = C.testWeeks(s); const nextTest = Object.entries(tw).filter(([k, w]) => w >= s.week && !(s.testsDone || {})[k + s.season]).sort((a, b) => a[1] - b[1])[0];
  const items = [
    ['🔧', act.length ? `${act.length} part${act.length > 1 ? 's' : ''} in progress` : 'No parts in progress', act.length ? `next on the car in ~${soon} wk` : 'start one in Car & Dev', act.length ? '' : 'warn', 'car'],
    ['🏗️', P.facilityBuilds.length ? `${P.facilityBuilds.length} build${P.facilityBuilds.length > 1 ? 's' : ''}` : 'Facilities idle', P.facilityBuilds.length ? `${Math.min(...P.facilityBuilds.map((b) => b.weeksLeft))} wk left` : 'upgrade in Facilities', '', 'facilities'],
    ['😓', `Fatigue ${fat}`, fat > 55 ? 'staff need a break' : 'staff OK', fat > 55 ? 'warn' : '', 'staff'],
    ['🧪', nextTest ? ({ pre: 'Pre-season test', mid: 'In-season test', post: 'Post-season test' })[nextTest[0]] : 'No more tests', nextTest ? (nextTest[1] === s.week ? 'this week' : `in ${nextTest[1] - s.week} wk`) : 'this year', '', 'hq'],
  ];
  return `<div class="twk"><div class="tiny muted twkh">PRESSING “NEXT WEEK” MOVES THESE ON · it stops early if a decision is needed</div><div class="twkg">${items.map(([ic, a, b, k, r]) => `<a class="twi ${k}" href="#/${r}"><span class="twic">${ic}</span><span><b>${a}</b><small>${b}</small></span></a>`).join('')}</div></div>`;
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
  const R = 26, L = 2 * Math.PI * R, prog = s.week / YEAR_WEEKS;
  const ring = `<svg class="wring" viewBox="0 0 64 64" width="84" height="84"><circle cx="32" cy="32" r="${R}" class="bg"/><circle cx="32" cy="32" r="${R}" class="fg" stroke-dasharray="${(L * prog).toFixed(1)} ${L.toFixed(1)}"/><text x="32" y="29" class="wk">WEEK</text><text x="32" y="43" class="wn">${s.week}</text></svg>`;
  const cd = off ? '' : `<div class="cdown ${due ? 'due' : ''}"><b>${due ? 'RACE' : n}</b><span>${due ? 'WEEK' : n === 1 ? 'week to go' : 'weeks to go'}</span></div>`;
  return `<div class="card clock"><div class="clockrow">${ring}<div class="clockmain"><div class="row" style="gap:.4rem"><span class="tiny muted">${s.year} · Monday ${fmtDate(weekDate(sc.year, s.week))}</span><span class="pill ph-${ph}">${PHASE_LABEL[ph]}</span></div>
  ${off ? `<div class="small" style="margin-top:.3rem">All ${s.calendar.length} races done — ${YEAR_WEEKS - s.week} week(s) until the year closes.</div>` : `<div class="nextrace"><span class="tiny muted">NEXT · R${s.round + 1}/${s.calendar.length}</span><b>${esc(tr.name)}</b><span class="small">${fmtDate(weekDate(sc.year, sc.weeks[s.round]))} · ${esc(tr.country || '')}</span></div>`}
  ${s.week < sc.devOpen ? `<div class="tiny warn">Development opens in week ${sc.devOpen}</div>` : ''}</div>${cd}</div>
  ${yearStrip(s, true)}
  <div class="row" style="margin-top:.6rem">${btns}</div>
  ${thisWeek(s)}</div>`;
}

on({
  wkNext: () => { const r = C.advanceWeek(app.state); persist(); render(); if (r === 'event') toast('Something came up — decision needed in HQ.', 'warn'); else if (r === 'end') go('review'); else toast(`Week ${app.state.week}`, 'info', 900); },
  wkRace: () => { const r = C.advanceToRace(app.state); persist(); render(); const due = app.state.round < app.state.calendar.length && app.state.week >= app.state.schedule.weeks[app.state.round]; toast(due ? 'Race week! Travel to the circuit.' : `Stopped in week ${app.state.week}: a decision is needed.`, due ? 'good' : 'warn'); },
  wkClose: () => { C.closeYear(app.state); persist(); go('review'); },
});

export function weekMini(s) {
  if (s.mode !== 'career') return ''; ensureSchedule(s); const sc = s.schedule;
  return `<div class="card tight weekmini"><div class="row" style="gap:.6rem"><span class="wmn"><small>WEEK</small>${s.week}</span><span class="small"><b>${s.year}</b> · ${fmtDate(weekDate(sc.year, s.week))} · <span class="good">Race week — R${s.round + 1}/${s.calendar.length}</span></span></div>${yearStrip(s, true)}</div>`;
}
