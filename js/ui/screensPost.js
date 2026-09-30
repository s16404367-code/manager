// Post-race analysis: classification, "Why?", lap chart, strategy timeline, management debrief.
import { app, screen, on, go, esc, persist, toast, render, setState } from './app.js';
import { trackById } from '../data/tracks.js';
import { COMPOUNDS } from '../engines/tyreEngine.js';
import { applyRaceResult, revealAfterRace } from '../engines/careerEngine.js';
import { createWorld } from '../engines/world.js';
import { startWeekend } from '../engines/weekendEngine.js';
import { fmtTime } from '../sim/util.js';
import { lineChart } from './widgets.js';

screen('post', {
  render() {
    const s = app.state; const wk = s.weekend;
    if (!wk?.result) return `<div class="empty">No race result to show. <a href="#/${s.mode === 'quick' ? 'weekend' : 'hq'}">Back</a></div>`;
    const t = trackById(wk.trackId); const res = wk.result; const race = wk.race;
    const mine = res.rows.filter((r) => r.teamId === s.player);
    const pts = mine.reduce((a, r) => a + r.pts, 0);
    const show = race.cars.filter((c) => c.isPlayer || c.grid <= 4 || res.rows.find((r) => r.did === c.id).pos <= 4);
    const lap = lineChart(show.map((c) => ({ name: c.short, color: c.color, points: c.posHist, width: c.isPlayer ? 3 : 1.3 })), { invert: true, yMin: 1, yMax: 20, xLabel: 'Lap', yLabel: 'Position' });
    const ticks = [1, ...[0.25, 0.5, 0.75].map((f) => Math.round(race.laps * f)), race.laps];
    const axis = `<div class="row small" style="gap:.4rem;flex-wrap:nowrap"><span style="width:100px;flex:none"></span><div class="tlaxis">${ticks.map((l) => `<span style="left:${((l - 1) / Math.max(1, race.laps - 1)) * 100}%">L${l}</span>`).join('')}</div></div>`;
    const timeline = axis + res.rows.slice(0, 20).map((r) => { const c = race.cars.find((x) => x.id === r.did); const segs = c.stints.map((st, i) => { const to = (c.stints[i + 1]?.from || c.lapsDone + 1) - 1; const w = Math.max(0, (to - st.from + 1) / race.laps * 100); const stop = c.stops[i - 1]; return `<i class="tlseg" style="width:${w}%;background:${COMPOUNDS[st.c].color}" title="${COMPOUNDS[st.c].name}: laps ${st.from}–${to} (${to - st.from + 1} laps)${stop ? ' · pit L' + stop.lap + ' ' + stop.total + 's' : ''}"><b>${st.c}</b>${i > 0 ? `<em>L${st.from - 1}</em>` : ''}</i>`; }).join(''); return `<div class="row small tlrow" style="gap:.4rem;flex-wrap:nowrap;${c.isPlayer ? 'font-weight:700' : ''}"><span style="width:100px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span class="sw" style="background:${c.color}"></span>${esc(c.short)}</span><div class="tlbar">${segs}</div></div>`; }).join('') + `<div class="tiny muted" style="margin-top:.3rem">Each block is a stint (letter = compound). The white separator and “L##” mark the lap of each pit stop.</div>`;
    return `<div class="pagehead"><h1>Race debrief — ${esc(t.name)}</h1><span class="pill ${pts ? 'good' : ''}">${pts} points</span>${res.wet ? '<span class="pill info">Wet race</span>' : ''}${res.sc ? `<span class="pill warn">${res.sc} SC</span>` : ''}${res.vsc ? `<span class="pill warn">${res.vsc} VSC</span>` : ''}</div>
    <div class="grid g2">
      <div class="card"><h3>Classification</h3><div class="tw"><table><thead><tr><th>Pos</th><th>Driver</th><th>Grid</th><th>Gap</th><th>Strategy</th><th>Best</th><th>Pts</th></tr></thead><tbody>
      ${res.rows.map((r) => { const d = s.drivers[r.did]; const tm = s.teams[r.teamId]; return `<tr class="${tm.isPlayer ? 'me' : ''}"><td>${r.dnf ? 'DNF' : r.pos}</td><td><span class="sw" style="background:${tm.color}"></span>${esc(d.name)} <span class="muted tiny">${tm.abbr}</span></td><td>${r.grid}</td><td class="mono small">${r.dnf ? `<span class="bad">${esc(r.dnf)}</span>` : esc(r.gap)}${r.penalty ? ' <span class="bad">(+' + r.penalty + 's)</span>' : ''}</td><td class="small">${r.stints.map((x) => x.c).join('-')}</td><td class="mono small">${r.best ? fmtTime(r.best) : '--'}</td><td>${r.pts || ''}</td></tr>`; }).join('')}</tbody></table></div></div>
      <div class="col">${wk.analysis.drivers.map((a) => `<div class="card"><h3>Why? — ${esc(a.name)}</h3>${a.why.map((w) => `<div class="alert ${w.k === 'info' ? '' : w.k}">${esc(w.t)}</div>`).join('')}</div>`).join('')}</div>
    </div>
    <div class="grid g2" style="margin-top:1rem"><div class="card"><h3>Lap chart</h3>${lap}</div><div class="card"><h3>Strategy timeline</h3>${timeline}<div class="tiny muted" style="margin-top:.4rem">${Object.entries(COMPOUNDS).map(([k, c]) => `<span class="sw" style="background:${c.color}"></span>${c.name} `).join(' ')}</div></div></div>
    ${s.mode === 'career' ? `<div class="card" style="margin-top:1rem"><h3>Management debrief</h3><p class="small muted">Continuing applies prize distribution, sponsor payments and bonuses, salaries and operating costs, damage bills, driver & staff morale changes and board reaction. Two weeks pass at the factory: projects progress and rivals develop.</p><button class="btn primary" data-act="postContinue">Continue to HQ →</button></div>` :
      `<div class="card" style="margin-top:1rem"><h3>Session complete</h3><div class="row"><button class="btn primary" data-act="quickAgain">Race again (new conditions)</button><button class="btn" data-act="go" data-arg="quick">New quick race</button><button class="btn" data-act="menu">Main menu</button></div></div>`}`;
  },
});
on({
  postContinue: () => {
    const s = app.state;
    if (s.mode !== 'career' || !s.weekend) return go('hq');
    revealAfterRace(s);
    applyRaceResult(s);
    persist('Progress saved');
    if (s.gameOver) return go('gameover');
    go(s.phase === 'review' ? 'review' : 'hq');
  },
  quickAgain: () => {
    const s = app.state; const tid = s.player; const tr = s.calendar[0];
    const n = createWorld({ mode: 'quick', playerTeamId: tid, trackId: tr, raceLength: s.raceLength, difficulty: s.difficulty });
    n.forceWeather = s.forceWeather ?? null; startWeekend(n); setState(n); persist(); go('weekend');
  },
});
