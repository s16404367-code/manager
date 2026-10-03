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
    // F1-TV style tyre strategy chart: one row per driver, a rounded bar per stint, gap = pit stop
    const N = race.laps; const step = N > 40 ? 10 : 5;
    const grid = Array.from({ length: Math.floor(N / step) + 1 }, (_, k) => k * step).filter((l) => l > 0 && l < N);
    const pct = (l) => (l / N) * 100;
    const axis = `<div class="tsrow tsaxis"><span class="tsname"></span><div class="tstrack">${[0, ...grid, N].map((l) => `<span class="tstick" style="left:${pct(l)}%">${l || 'Start'}</span>`).join('')}</div></div>`;
    const tf = app.tab.tsf || 'all';
    const rowsShown = res.rows.slice(0, 20).filter((r) => { const c = race.cars.find((x) => x.id === r.did); return tf === 'all' || c.isPlayer || (tf === 'top' && !r.dnf && r.pos <= 6); });
    const bands = (race.lapState || []).map((x, i) => (x.sc !== 'none' ? `<i class="tsband ${x.sc}" style="left:${pct(i)}%;width:${pct(1)}%"></i>` : x.w > 0.15 ? `<i class="tsband wet" style="left:${pct(i)}%;width:${pct(1)}%"></i>` : '')).join('');
    const timeline = `<div class="tsfilter seg"><button class="btn sm ${tf === 'all' ? 'on' : ''}" data-act="tsf" data-arg="all">All</button><button class="btn sm ${tf === 'top' ? 'on' : ''}" data-act="tsf" data-arg="top">Top 6 + my team</button><button class="btn sm ${tf === 'me' ? 'on' : ''}" data-act="tsf" data-arg="me">My team</button></div><div class="tschart">${axis}${rowsShown.map((r) => { const c = race.cars.find((x) => x.id === r.did);
      const segs = c.stints.map((st, i) => { const from = st.from - 1; const to = (c.stints[i + 1]?.from || c.lapsDone + 1) - 1; const n = to - from; const col = COMPOUNDS[st.c].color;
        return `<div class="tsseg ${st.used ? 'used' : ''}" style="left:calc(${pct(from)}% + ${i ? 2 : 0}px);width:calc(${pct(n)}% - ${i ? 2 : 0}px);--tc:${col}" title="${COMPOUNDS[st.c].name}${st.used ? ' (used set)' : ''}: laps ${from + 1}–${to} (${n} laps)"><span>${st.c}${n >= 3 ? '<small>' + n + '</small>' : ''}</span></div>`; }).join('');
      const pits = c.stops.map((x) => `<span class="tspit" style="left:${pct(x.lap)}%" title="Pit lap ${x.lap} · stationary ${x.stat?.toFixed?.(1) ?? '?'}s · total ${x.total}s"></span>`).join('');
      return `<div class="tsrow ${c.isPlayer ? 'me' : ''}"><span class="tsname"><b>${r.dnf ? 'DNF' : r.pos}</b> <span class="sw" style="background:${c.color}"></span>${esc(c.short)}</span><div class="tstrack">${bands}${grid.map((l) => `<i class="tsgrid" style="left:${pct(l)}%"></i>`).join('')}${segs}${pits}</div><span class="tsst tiny muted">${c.stops.length}×</span></div>`; }).join('')}
    <div class="tslegend tiny">${['S', 'M', 'H', 'I', 'W'].map((x) => `<span><i style="background:${COMPOUNDS[x].color}"></i>${COMPOUNDS[x].name}</span>`).join('')}<span><i class="tsband sc lg"></i>Safety Car</span><span><i class="tsband vsc lg"></i>VSC</span><span><i class="tsband wet lg"></i>Wet</span><span>Bar fades as the tyre wears · striped = used set · ▼ = pit stop</span></div></div>`;
    return `<div class="pagehead"><h1>Race debrief — ${esc(t.name)}</h1><span class="pill ${pts ? 'good' : ''}">${pts} points</span>${res.wet ? '<span class="pill info">Wet race</span>' : ''}${res.sc ? `<span class="pill warn">${res.sc} SC</span>` : ''}${res.vsc ? `<span class="pill warn">${res.vsc} VSC</span>` : ''}</div>
    <div class="grid g2">
      <div class="card"><h3>Classification</h3><div class="tw"><table><thead><tr><th>Pos</th><th>Driver</th><th>Grid</th><th>Gap</th><th>Strategy</th><th>Best</th><th>Pts</th></tr></thead><tbody>
      ${res.rows.map((r) => { const d = s.drivers[r.did]; const tm = s.teams[r.teamId]; return `<tr class="${tm.isPlayer ? 'me' : ''}"><td>${r.dnf ? 'DNF' : r.pos}</td><td><span class="sw" style="background:${tm.color}"></span>${esc(d.name)} <span class="muted tiny">${tm.abbr}</span></td><td>${r.grid}</td><td class="mono small">${r.dnf ? `<span class="bad">${esc(r.dnf)}</span>` : esc(r.gap)}${r.penalty ? ' <span class="bad">(+' + r.penalty + 's)</span>' : ''}</td><td class="small">${r.stints.map((x) => x.c).join('-')}</td><td class="mono small">${r.best ? fmtTime(r.best) : '--'}</td><td>${r.pts || ''}</td></tr>`; }).join('')}</tbody></table></div></div>
      <div class="col">${wk.analysis.drivers.map((a) => `<div class="card"><h3>Why? — ${esc(a.name)}</h3>${a.why.map((w) => `<div class="alert ${w.k === 'info' ? '' : w.k}">${esc(w.t)}</div>`).join('')}</div>`).join('')}</div>
    </div>
    <div class="grid g2" style="margin-top:1rem"><div class="card"><h3>Lap chart</h3>${lap}</div><div class="card"><h3>Strategy timeline</h3>${timeline}</div></div>
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

on({ tsf: (k) => { app.tab.tsf = k; render(); } });
