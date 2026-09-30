// Race weekend: preparation, practice, qualifying, strategy lab.
import { app, screen, on, go, esc, persist, toast, render, modal, closeModal } from './app.js';
import { trackById, trackPath, TRACKS, kmLen } from '../data/tracks.js';
import { createSession, commitSession } from '../engines/sessionEngine.js';
import { mapSvg } from './trackView.js';
import { ATTR_LABEL } from '../data/teams.js';
import { PERSONALITIES } from '../data/drivers.js';
import { startWeekend, runPractice, runQualiSession, engineerEstimate, PRACTICE_PROGRAMS, strategyContext, defaultPlans, buildRace } from '../engines/weekendEngine.js';
import { effectiveCar, trackScore, SETUP_KEYS, SETUP_LABEL, SETUP_HINT, SETUP_GROUPS, setupQuality, setupCharacter, driverStyle } from '../engines/carModel.js';
import { setupChanged } from '../engines/sessionEngine.js';
import { liveView, startLive, stopLive } from './screenSession.js';
import { planOptions, labelPlans, clonePlan } from '../engines/strategyEngine.js';
import { COMPOUNDS, estimateStint } from '../engines/tyreEngine.js';
import { wetLabel } from '../engines/weatherEngine.js';
import { deptQ, DIFFICULTY } from '../engines/world.js';
import { fmtTime, clamp } from '../sim/util.js';
import { tyreBadge, bar, helpBtn, pill } from './widgets.js';

const S = () => app.state; const WK = () => app.state.weekend;
const PHASES = [['prep', 'Preparation'], ['practice', 'Practice'], ['quali', 'Qualifying'], ['strategy', 'Strategy Lab'], ['race', 'Race'], ['post', 'Debrief']];

function stepper(phase) {
  const i = PHASES.findIndex((p) => p[0] === phase);
  return `<div class="stepper">${PHASES.map(([k, l], j) => `<div class="${j === i ? 'on' : j < i ? 'done' : ''}">${j < i ? '✓ ' : ''}${l}</div>`).join('')}</div>`;
}
function fieldRank(s, t) {
  const rows = Object.values(s.teams).map((tm) => ({ id: tm.id, score: trackScore(effectiveCar(tm, 0), t).score }));
  rows.sort((a, b) => b.score - a.score);
  return rows.findIndex((r) => r.id === s.player) + 1;
}
const WX = (p) => p < 15 ? ['☀️', 'Dry', '#f5b642'] : p < 35 ? ['🌤️', 'Mostly dry', '#c9b35a'] : p < 55 ? ['🌦️', 'Showers possible', '#6fb3ff'] : p < 75 ? ['🌧️', 'Rain likely', '#3b82f6'] : ['⛈️', 'Heavy rain', '#6d5bff'];
function forecastStrip(wk) {
  const conf = wk.forecastAcc > 0.8 ? 'high' : wk.forecastAcc > 0.6 ? 'moderate' : 'low';
  return `<div class="wxcards">${wk.forecast.map((f) => { const [ic, lab, col] = WX(f.prob); return `<div class="wxc" style="border-top-color:${col}" title="Laps ${f.from}–${f.to}: ${lab}, ${f.prob}% ±${f.unc}%"><div class="wxi">${ic}</div><b>${f.prob}%</b><span class="tiny muted">L${f.from}–${f.to}</span></div>`; }).join('')}</div>
  <div class="wxlegend tiny">${[5, 25, 45, 65, 85].map((p) => { const [ic, lab, col] = WX(p); return `<span><i style="background:${col}"></i>${ic} ${lab}</span>`; }).join('')}</div>
  <div class="small" style="margin-top:.3rem">${wk.forecast.filter((f) => f.prob >= 35).length ? `<b>Rain risk:</b> ${wk.forecast.filter((f) => f.prob >= 35).map((f) => `laps ${f.from}–${f.to} (${Math.max(0, f.prob - f.unc)}–${Math.min(100, f.prob + f.unc)}%)`).join(', ')}` : '☀️ <b>Dry race expected.</b>'} <span class="muted">Percent = chance of rain in that lap window. Forecast confidence: ${conf}.</span></div>`;
}

function meters(setup, did) {
  const ch = setupCharacter(setup);
  return Object.entries(ch).map(([k, v]) => k === 'Balance'
    ? `<div class="meter"><span>Balance</span><div class="balbar"><i style="left:${v}%"></i></div><em class="tiny muted">${v > 58 ? 'Oversteer' : v < 42 ? 'Understeer' : 'Neutral'}</em></div>`
    : `<div class="meter"><span>${k}</span><div class="bar"><i style="width:${v}%"></i></div><em class="mono tiny">${Math.round(v)}</em></div>`).join('');
}
function setupPanel(s, wk) {
  const pt = s.teams[s.player]; const live = wk.live;
  return pt.drivers.map((did) => {
    const d = s.drivers[did]; const est = engineerEstimate(wk, did); const cur = wk.setups[did]; const k = wk.knowledge[did];
    const conf = Math.round(Object.values(k).reduce((a, b) => a + b, 0) / SETUP_KEYS.length * 100);
    const info = DIFFICULTY[s.difficulty].info;
    const qEst = setupQuality(cur, wk.opt[did]);
    const shownQ = info >= 1 ? `${Math.round(qEst * 100)}%` : qEst > 0.9 ? 'Excellent' : qEst > 0.78 ? 'Good' : qEst > 0.6 ? 'Compromised' : 'Poor';
    const lc = live?.cars.find((c) => c.did === did); const locked = lc && lc.st === 'track';
    const st = driverStyle(d); const styleTxt = st > 0.3 ? 'prefers a pointy, oversteery car' : st < -0.3 ? 'prefers a stable, understeery car' : 'is comfortable with a neutral balance';
    return `<div class="card setupcard"><div class="row"><span class="sw" style="background:${pt.color}"></span><h3 style="margin:0">${esc(d.name)}</h3>${pill(PERSONALITIES[d.pers].label)}<span class="sp"></span><span class="small muted">Engineer confidence <b>${conf}%</b> · Track knowledge <b>${Math.round((wk.know?.[did] ?? 0.6) * 100)}%</b></span></div>
    <div class="small" style="margin:.35rem 0">Driver-reported feel: <b>${shownQ}</b> ${helpBtn('setup')} <span class="muted">· ${esc(d.name.split(' ').slice(-1)[0])} ${styleTxt}.</span></div>
    ${locked ? '<div class="alert warn small">Car is on track — setup changes only in the garage.</div>' : live ? `<div class="tiny muted">Each change in the garage costs ~30s of session time.</div>` : ''}
    <div class="setup-grid"><div>${SETUP_GROUPS.map(([g, keys]) => `<div class="sgroup"><div class="sgh">${g}</div>${keys.map((key) => `<div class="srow"><div class="row small"><span title="${esc(SETUP_HINT[key])}">${SETUP_LABEL[key]}</span><span class="sp"></span><span class="muted tiny">est. ${est[key]}</span><b class="mono sval">${cur[key]}</b></div>
      <input type="range" min="0" max="10" step="0.5" value="${cur[key]}" ${locked ? 'disabled' : ''} aria-label="${SETUP_LABEL[key]}" data-input="setup" data-change="setupDone" data-arg="${did}:${key}"><div class="tiny muted shint">${esc(SETUP_HINT[key])}</div></div>`).join('')}</div>`).join('')}</div>
    <div class="meters" id="meters-${did}"><div class="sgh">Predicted car character</div>${meters(cur, did)}<div class="tiny muted" style="margin-top:.4rem">These describe the setup itself. Match them to the circuit profile and the driver's taste.</div></div></div>
    <div class="row" style="margin-top:.5rem"><button class="btn sm" data-act="applyEst" data-arg="${did}" ${locked ? 'disabled' : ''}>Apply engineer estimate</button><button class="btn sm ghost" data-act="toggleHints">Show/hide hints</button></div></div>`;
  }).join('');
}
on({
  setup: (arg, el) => { const [did, key] = arg.split(':'); WK().setups[did][key] = +el.value; const b = el.parentElement.querySelector('b.sval'); if (b) b.textContent = el.value; const m = document.getElementById('meters-' + did); if (m) m.innerHTML = '<div class="sgh">Predicted car character</div>' + meters(WK().setups[did], did); },
  setupDone: (arg) => { const [did] = arg.split(':'); if (WK().live && setupChanged(S(), did)) toast('Mechanics working on the car (+30s).', 'info', 1500); persist(); },
  applyEst: (did) => { WK().setups[did] = engineerEstimate(WK(), did); if (WK().live) setupChanged(S(), did); persist(); render(); toast('Setup updated to engineer estimate.'); },
  toggleHints: () => { document.body.classList.toggle('showhints'); },
});

screen('weekend', {
  keepScroll: true,
  after: () => weekendAfter(),
  render() {
    const s = S();
    if (!s.weekend) {
      if (s.phase === 'review') return `<div class="empty">Season complete. <a href="#/review">Open the season review →</a></div>`;
      if (s.pendingEvent) return `<div class="card"><h2>Decision required before the weekend</h2><p class="muted">Resolve the pending matter in HQ first.</p><button class="btn primary" data-act="go" data-arg="hq">Go to HQ</button></div>`;
      const t = trackById(s.calendar[s.round]);
      return `<div class="pagehead"><h1>Next: ${esc(t.name)}</h1></div><div class="card"><p>Round ${s.round + 1} of ${s.calendar.length}. ${esc(t.archetype)}.</p><button class="btn primary" data-act="beginWeekend">Travel to ${esc(t.name)} →</button></div>`;
    }
    const wk = s.weekend; if (!wk) return '<div class="empty">No weekend active.</div>';
    if (wk.phase === 'race') { return `<div class="card"><h2>Race in progress</h2><button class="btn primary" data-act="go" data-arg="race">Return to pit wall →</button></div>`; }
    if (wk.phase === 'post') { return `<div class="card"><h2>Race complete</h2><button class="btn primary" data-act="go" data-arg="post">Open debrief →</button></div>`; }
    const t = trackById(wk.trackId);
    const body = { prep: prepView, practice: practiceView, quali: qualiView, strategy: strategyView }[wk.phase]?.(s, wk, t) || '';
    return `<div class="pagehead"><div class="gphead"><span class="rnd">R${(s.mode === 'career' ? s.round + 1 : TRACKS.indexOf(t) + 1)}</span><div><div class="tiny muted">${esc(t.gp)} · ${esc(t.country)}</div><h1>${esc(t.name)}</h1></div></div><span class="pill">${esc(t.archetype)}</span><span class="pill">${wk.laps} laps${wk.scale > 1.05 ? ' · compressed' : ''}</span>${helpBtn('weekend')}</div>${stepper(wk.phase)}${body}`;
  },
});
on({ beginWeekend: () => { startWeekend(S()); persist(); render(); } });
function weekendAfter() { stopLive(); if (S()?.weekend?.live) startLive(); }

function prepView(s, wk, t) {
  const pt = s.teams[s.player]; const car = effectiveCar(pt, 0); const sc = trackScore(car, t); const b = sc.breakdown;
  const rank = fieldRank(s, t); const unc = Math.round((1 - DIFFICULTY[s.difficulty].info) * 5) + 1;
  const dem = [['Downforce', t.df], ['Drag sensitivity', t.drag], ['Low-speed', t.low], ['High-speed', t.high], ['Braking', t.brake], ['Traction', t.trac], ['Tyre deg', t.deg], ['Kerbs', t.kerb], ['Cooling', t.cool], ['Engine stress', t.eng], ['Overtaking diff.', t.ovt], ['Safety car', t.sc]];
  return `<div class="grid g2">
  <div class="card"><h3>Circuit profile</h3><div class="row" style="align-items:flex-start"><div style="width:190px;flex:none">${mapSvg(t, 'pmap')}<div class="tiny muted" style="text-align:center">${kmLen(t)} km · ${t.laps} laps (full)</div></div>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:.3rem .8rem;flex:1">${dem.map(([l, v]) => `<div class="small">${l}${bar(v * 100, 100, v > 0.75 ? 'var(--accent2)' : null)}</div>`).join('')}</div></div>
    <p class="small muted">Pit-lane loss ≈ ${t.pit}s · Track evolution ${Math.round(t.evo * 100)}% · DRS effect ${Math.round(t.drs * 100)}%</p></div>
  <div class="card"><h3>Car suitability ${helpBtn('suitability')}</h3>
    <p>Engineers estimate our pace rank here: <b>P${clamp(rank - unc, 1, 10)}–P${clamp(rank + unc, 1, 10)}</b> of 10 teams.</p>
    <div class="small">Cornering (weighted) ${bar(b.corner, 110)}Straight-line ${bar(b.straight, 110)}Mechanical/traction ${bar(b.mech, 110)}Braking ${bar(b.braking, 110)}</div>
    ${b.coolPen > 0.3 ? `<div class="alert warn small">Cooling demand exceeds our package: expect a power de-rate (≈${b.coolPen.toFixed(1)} pts).</div>` : ''}
    <h4 style="margin-top:.8rem">Weather forecast</h4>${forecastStrip(wk)}
    <div class="small">Air ${wk.weather.airTemp}°C · Track ~${wk.weather.trackTemp}°C · Qualifying rain chance ~${wk.qForecast}%</div></div>
  </div>
  <h3 style="margin-top:1rem">Initial setup</h3><p class="small muted">Start from the simulator estimate. Practice sharpens the estimate; the true optimum is hidden.</p>
  <div class="grid g2">${setupPanel(s, wk)}</div>
  <div class="row" style="margin-top:1rem"><span class="sp"></span><button class="btn" data-act="skipPractice">Skip practice</button><button class="btn primary" data-act="toPractice">Go to practice →</button></div>`;
}
on({
  toPractice: () => { WK().phase = 'practice'; persist(); render(); },
  skipPractice: () => { WK().phase = 'quali'; persist(); render(); },
});

function practiceView(s, wk, t) {
  if (wk.live?.kind === 'practice') return liveView(s, wk, t) + `<h3 style="margin-top:1rem">Setup — garage</h3><div class="grid g2">${setupPanel(s, wk)}</div>`;
  const pt = s.teams[s.player];
  const left = wk.practice.total - wk.practice.done;
  app.tab.prog ||= {};
  return `<div class="card"><div class="row"><h3 style="margin:0">Free Practice ${Math.min(wk.practice.done + 1, wk.practice.total)} / ${wk.practice.total}</h3><span class="sp"></span>${left ? '' : pill('All sessions complete', 'good')}</div>
    <p class="small muted">Go live to run the session yourself — send cars out, pick programmes and tyres, change the setup between runs, and watch live timing and telemetry. Or pick a programme per driver and quick-simulate.</p>
    <div class="grid g2">${pt.drivers.map((did) => { const cur = app.tab.prog[did] || 'setup'; return `<div><b>${esc(s.drivers[did].name)}</b><div class="col" style="margin-top:.4rem">${Object.entries(PRACTICE_PROGRAMS).map(([k, p]) => `<button class="choice ${cur === k ? 'on' : ''}" data-act="prog" data-arg="${did}:${k}"><b class="small">${p.label}</b><div class="tiny muted">${p.desc}</div></button>`).join('')}</div></div>`; }).join('')}</div>
    <div class="row" style="margin-top:.8rem"><button class="btn primary" data-act="liveFP" ${left ? '' : 'disabled'}>▶ Go live (telemetry)</button><button class="btn" data-act="runPractice" ${left ? '' : 'disabled'}>Quick simulate</button><span class="sp"></span><button class="btn" data-act="toQuali">Go to qualifying →</button></div></div>
  ${wk.practice.reports.slice().reverse().map((r) => `<div class="card" style="margin-top:.7rem"><h4>FP${r.session} engineering report</h4>${r.lines.map((l) => `<div class="small" style="margin:.2rem 0">• ${esc(l.text)}</div>`).join('')}</div>`).join('')}
  <h3 style="margin-top:1rem">Setup</h3><div class="grid g2">${setupPanel(s, wk)}</div>`;
}
on({
  prog: (arg) => { const [did, k] = arg.split(':'); app.tab.prog[did] = k; render(); },
  runPractice: () => { const wk = WK(); const progs = {}; for (const did of S().teams[S().player].drivers) progs[did] = app.tab.prog?.[did] || 'setup'; runPractice(S(), progs); persist(); render(); toast('Session complete — engineering report updated.'); },
  toQuali: () => { if (WK().live) commitSession(S()); WK().phase = 'quali'; persist(); render(); },
  liveFP: () => { const sess = createSession(S(), 'practice'); for (const c of sess.cars) if (c.isPlayer) c.prog = app.tab.prog?.[c.did] || 'setup'; persist(); render(); },
  liveQ: () => { createSession(S(), 'quali'); persist(); render(); },
});

function qualiView(s, wk, t) {
  if (wk.live?.kind === 'quali') return liveView(s, wk, t) + `<h3 style="margin-top:1rem">Setup — garage</h3><div class="grid g2">${setupPanel(s, wk)}</div>`;
  const pt = s.teams[s.player]; const sess = wk.quali.session;
  const names = ['Q1', 'Q2', 'Q3'];
  const plans = (wk.quali.plans ||= {});
  const inSession = pt.drivers.filter((d) => !wk.quali.eliminated.includes(d));
  const last = wk.quali.results[sess - 1];
  const wetText = wk.qWet > 0.15 ? `<div class="alert warn small">Wet qualifying: track wetness ~${Math.round(wk.qWet * 100)}% (${wetLabel(wk.qWet)}). Choose tyres carefully.</div>` : '';
  const table = last ? `<div class="card" style="margin-top:.8rem"><h4>${names[sess - 1]} classification</h4><div class="tw"><table><thead><tr><th>#</th><th>Driver</th><th>Team</th><th>Time</th><th>Gap</th><th></th></tr></thead><tbody>${last.map((r, i) => { const d = s.drivers[r.did]; const tm = s.teams[r.teamId]; const cut = sess === 1 ? 15 : sess === 2 ? 10 : 99; return `<tr class="${tm.isPlayer ? 'me' : ''}" style="${i === cut ? 'border-top:2px solid var(--bad)' : ''}"><td>${i + 1}</td><td><span class="sw" style="background:${tm.color}"></span>${esc(d.name)}</td><td class="muted small">${esc(tm.abbr)}</td><td class="mono">${fmtTime(r.time)}</td><td class="mono muted">${i ? '+' + (r.time - last[0].time).toFixed(3) : ''}</td><td class="tiny warn">${esc(r.notes.join(', '))}${i >= cut ? ' <span class="bad">OUT</span>' : ''}</td></tr>`; }).join('')}</tbody></table></div></div>` : '';
  if (sess >= 3) {
    return `<div class="card"><h3>Qualifying complete — starting grid</h3><ol class="small" style="columns:2">${wk.grid.map((did) => { const d = s.drivers[did]; const tm = s.teams[d.teamId]; return `<li style="${tm.isPlayer ? 'font-weight:700' : ''}"><span class="sw" style="background:${tm.color}"></span>${esc(d.name)}${wk.gridPens?.[did] ? ' <span class="bad">(+' + wk.gridPens[did] + ' pen)</span>' : ''}</li>`; }).join('')}</ol><button class="btn primary" data-act="toStrategy">Strategy Lab →</button></div>${table}`;
  }
  return `${wetText}<div class="card"><h3>${names[sess]} ${helpBtn('quali')}</h3>
  ${inSession.length ? `<div class="grid g2">${inSession.map((did) => { const p = (plans[did] ||= { run: 'banker', push: 'normal', tyre: wk.qWet > 0.6 ? 'W' : wk.qWet > 0.16 ? 'I' : 'S' }); return `<div class="card tight"><b>${esc(s.drivers[did].name)}</b>
      <label style="margin-top:.4rem">Run plan</label><div class="seg">${[['banker', 'Two runs (banker)'], ['early', 'Early run'], ['late', 'Single late run']].map(([k, l]) => `<button class="btn sm ${p.run === k ? 'on' : ''}" data-act="qplan" data-arg="${did}:run:${k}">${l}</button>`).join('')}</div>
      <div class="tiny muted">Late: best track evolution, but traffic and red-flag risk. Two runs: safe, a little less evolution.</div>
      <label style="margin-top:.4rem">Push level</label><div class="seg">${[['safe', 'Safe'], ['normal', 'Normal'], ['max', 'Maximum']].map(([k, l]) => `<button class="btn sm ${p.push === k ? 'on' : ''}" data-act="qplan" data-arg="${did}:push:${k}">${l}</button>`).join('')}</div>
      <label style="margin-top:.4rem">Tyre</label><div class="seg">${['S', 'I', 'W'].map((c) => `<button class="btn sm ${p.tyre === c ? 'on' : ''}" data-act="qplan" data-arg="${did}:tyre:${c}">${COMPOUNDS[c].name}</button>`).join('')}</div></div>`; }).join('')}</div>` : '<p class="muted">Both drivers eliminated. Simulate the rest of qualifying.</p>'}
  <div class="row" style="margin-top:.8rem"><button class="btn primary" data-act="liveQ">▶ Go live: ${names[sess]} (${[12, 10, 8][sess]} min)</button><button class="btn" data-act="runQuali">Quick simulate ${names[sess]}</button><span class="tiny muted">Run plan applies to quick simulate; live mode is under your control.</span></div></div>${table}`;
}
on({
  qplan: (arg) => { const [did, k, v] = arg.split(':'); WK().quali.plans[did][k] = v; render(); },
  runQuali: () => { runQualiSession(S(), WK().quali.plans || {}); persist(); render(); },
  toStrategy: () => { defaultPlans(S()); WK().phase = 'strategy'; persist(); render(); },
});

function strategyView(s, wk, t) {
  defaultPlans(s);
  const pt = s.teams[s.player];
  const stratQ = deptQ(pt, 'strat');
  const wetStart = wk.weather.wet[0] > 0.16;
  const rivals = wk.grid.filter((d) => s.drivers[d].teamId !== s.player).slice(0, 6);
  return `<div class="grid g2">${pt.drivers.map((did) => {
    const ctx = strategyContext(s, did); const opts = planOptions(ctx); const lab = labelPlans(opts);
    const cur = wk.strategy[did]; const fuel = wk.fuel[did] ?? 1;
    const stints = ['S', 'M', 'H'].map((c) => `${tyreBadge(c)} ~${estimateStint(c, t, ctx.car, ctx.driver, wk.scale)} laps`).join(' &nbsp; ');
    return `<div class="card"><div class="row"><h3 style="margin:0">${esc(s.drivers[did].name)}</h3><span class="pill">Grid P${wk.grid.indexOf(did) + 1}</span></div>
    <div class="small muted" style="margin:.3rem 0">Estimated stint life: ${stints}</div>
    <div class="col">${opts.map((o) => { const tag = o === lab.conservative ? 'Conservative' : o === lab.aggressive ? 'Aggressive' : o === lab.balanced ? 'Balanced' : ''; const on = cur.name === o.name; return `<button class="choice ${on ? 'on' : ''}" data-act="pickPlan" data-arg="${did}:${o.name}"><div class="row"><span>${[o.start, ...o.stops.map((x) => x.c)].map((c) => tyreBadge(c)).join('')}</span><b class="small">${o.stops.length}-stop</b>${tag ? pill(tag, tag === 'Aggressive' ? 'warn' : tag === 'Conservative' ? 'good' : 'info') : ''}<span class="sp"></span><span class="small mono">${o.delta < 0.5 ? 'fastest' : '+' + o.delta.toFixed(0) + 's'}</span></div><div class="tiny muted">Stops: ${o.stops.map((x) => 'L' + x.lap).join(', ')} · Tyre-cliff risk: ${o.risk}</div></button>`; }).join('')}</div>
    <h4 style="margin-top:.7rem">Edit plan</h4>
    <div class="row small">Start ${['S', 'M', 'H', 'I', 'W'].map((c) => `<button class="btn sm ${cur.start === c ? 'on' : ''}" data-act="planStart" data-arg="${did}:${c}">${c}</button>`).join('')}</div>
    ${cur.stops.map((st, i) => `<div class="row small" style="margin-top:.3rem">Stop ${i + 1}: lap <input type="number" min="1" max="${wk.laps - 1}" value="${st.lap}" style="width:70px" data-change="planLap" data-arg="${did}:${i}"> → ${['S', 'M', 'H', 'I', 'W'].map((c) => `<button class="btn sm ${st.c === c ? 'on' : ''}" data-act="planComp" data-arg="${did}:${i}:${c}">${c}</button>`).join('')}<button class="btn sm ghost" data-act="planDel" data-arg="${did}:${i}" aria-label="Remove stop">✕</button></div>`).join('')}
    <div class="row" style="margin-top:.4rem"><button class="btn sm" data-act="planAdd" data-arg="${did}">+ Add stop</button></div>
    <h4 style="margin-top:.7rem">Fuel load ${helpBtn('fuel')}</h4>
    <div class="seg">${[[0.95, 'Under-fuel'], [1, 'Standard'], [1.04, 'Safety margin']].map(([v, l]) => `<button class="btn sm ${fuel == v ? 'on' : ''}" data-act="fuel" data-arg="${did}:${v}">${l}</button>`).join('')}</div>
    </div>`;
  }).join('')}</div>
  <div class="grid g2" style="margin-top:1rem"><div class="card"><h4>Weather at the start</h4>${forecastStrip(wk)}${wetStart ? `<div class="alert warn small">The track is wet at the start (${wetLabel(wk.weather.wet[0])}). Consider starting on ${wk.weather.wet[0] > 0.6 ? 'Wets' : 'Intermediates'}.</div>` : ''}</div>
  <div class="card"><h4>Rival strategy intelligence ${helpBtn('rivals')}</h4><div class="small">${rivals.map((did) => { const d = s.drivers[did]; const conf = stratQ > 75 ? 'likely' : stratQ > 55 ? 'possibly' : 'unclear —'; const tm = s.teams[d.teamId]; const guess = tm.aiStyle === 'aggressive' ? '2-stop, soft start' : tm.aiStyle === 'conservative' ? '1-stop, long first stint' : 'flexible, may undercut'; return `<div><span class="sw" style="background:${tm.color}"></span>${esc(d.name)} (P${wk.grid.indexOf(did) + 1}): <span class="muted">${conf} ${guess}</span></div>`; }).join('')}</div></div></div>
  <div class="row" style="margin-top:1rem"><label style="margin:0"><input type="checkbox" ${app.tab.autoPlan !== false ? 'checked' : ''} data-change="autoPlanToggle"> Engineers execute the plan automatically (you can override live)</label><span class="sp"></span><button class="btn primary" data-act="startRace">Form up on the grid →</button></div>`;
}
const planOf = (did) => WK().strategy[did];
const fixName = (p) => { p.stops.sort((a, b) => a.lap - b.lap); p.name = [p.start, ...p.stops.map((x) => x.c)].join('-') + '*'; };
on({
  pickPlan: (arg) => { const [did, name] = arg.split(':'); const o = planOptions(strategyContext(S(), did)).find((x) => x.name === name); if (o) WK().strategy[did] = clonePlan(o); render(); },
  planStart: (arg) => { const [did, c] = arg.split(':'); const p = planOf(did); p.start = c; fixName(p); WK().startTyre = { ...(WK().startTyre || {}), [did]: c }; render(); },
  planLap: (arg, el) => { const [did, i] = arg.split(':'); const p = planOf(did); p.stops[+i].lap = clamp(Math.round(+el.value || 1), 1, WK().laps - 1); fixName(p); render(); },
  planComp: (arg) => { const [did, i, c] = arg.split(':'); const p = planOf(did); p.stops[+i].c = c; fixName(p); render(); },
  planDel: (arg) => { const [did, i] = arg.split(':'); const p = planOf(did); p.stops.splice(+i, 1); fixName(p); render(); },
  planAdd: (did) => { const p = planOf(did); const last = p.stops[p.stops.length - 1]?.lap || 0; p.stops.push({ lap: clamp(Math.round((last + WK().laps) / 2), 2, WK().laps - 1), c: 'M' }); fixName(p); render(); },
  fuel: (arg) => { const [did, v] = arg.split(':'); WK().fuel[did] = +v; render(); },
  autoPlanToggle: (a, el) => { app.tab.autoPlan = el.checked; },
  startRace: () => {
    const race = buildRace(S());
    for (const c of race.cars) if (c.isPlayer) c.autoPlan = app.tab.autoPlan !== false;
    persist(); go('race');
  },
});
