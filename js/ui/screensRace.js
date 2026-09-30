// Live Race Control: timing tower, minimap, pit wall controls, radio, critical-event decisions.
import { app, screen, on, go, esc, persist, toast, render, modal, closeModal, confirmBox } from './app.js';
import { trackById, trackPath } from '../data/tracks.js';
import { advance, actions, carById, updateOrder, MODES, ERS_MODES } from '../engines/raceEngine.js';
import { classify } from '../engines/weekendEngine.js';
import { COMPOUNDS } from '../engines/tyreEngine.js';
import { wetLabel } from '../engines/weatherEngine.js';
import { DIFFICULTY, deptQ } from '../engines/world.js';
import { fmtTime, clamp } from '../sim/util.js';
import { tyreBadge, bar } from './widgets.js';

const SPEEDS = { normal: 10, fast: 30, vfast: 90 };
let loop = null;
const R = () => app.state?.weekend?.race;

screen('race', {
  keepScroll: false,
  render() {
    const s = app.state; const wk = s.weekend;
    if (!wk?.race) return `<div class="empty">No race in progress. <a href="#/weekend">Back to weekend</a></div>`;
    const t = trackById(wk.trackId);
    return `<div class="racebar" id="racebar"></div>
    <div class="mtabs"><button class="btn sm on" data-act="mtab" data-arg="ctrl">Pit wall</button><button class="btn sm" data-act="mtab" data-arg="tower">Timing</button><button class="btn sm" data-act="mtab" data-arg="feed">Radio</button></div>
    <div class="race" id="racegrid" data-mt="ctrl">
      <div class="card c-tower tower"><div class="row"><h4 style="margin:0">Timing</h4><span class="sp"></span><button class="btn sm ghost" data-act="gapMode" id="gapModeBtn">Interval</button></div><div id="tower"></div></div>
      <div class="c-map"><div class="mapwrap"><svg viewBox="0 0 100 76" id="map" aria-label="Track map"><path id="trk" d="${trackPath(t)}" fill="none" stroke="#2a3346" stroke-width="4.5" stroke-linejoin="round"/><path d="${trackPath(t)}" fill="none" stroke="#9aa5bb" stroke-width="1" stroke-linejoin="round"/><g id="cars"></g></svg></div>
        <div class="card c-feed" style="margin-top:.8rem"><h4>Team radio & race control</h4><div class="feed" id="feed"></div></div></div>
      <div class="c-ctrl" id="ctrl"></div>
    </div>`;
  },
  after() { startLoop(); },
});

function startLoop() {
  stopLoop();
  const race = R(); if (!race) return;
  const t = trackById(app.state.weekend.trackId);
  const trk = document.getElementById('trk'); const len = trk.getTotalLength();
  const carsG = document.getElementById('cars');
  carsG.innerHTML = race.cars.map((c) => `<g id="m_${c.id}"><circle r="${c.isPlayer ? 2 : 1.45}" fill="${c.color}" stroke="${c.isPlayer ? '#fff' : '#000'}" stroke-width="${c.isPlayer ? 0.6 : 0.3}"/>${c.isPlayer ? `<text y="-2.8" font-size="3" text-anchor="middle" fill="#fff" font-weight="700">${esc(c.short.slice(0, 3).toUpperCase())}</text>` : ''}</g>`).join('') + '<g id="scCar" style="display:none"><rect x="-1.8" y="-1.2" width="3.6" height="2.4" rx=".6" fill="#ffd400"/></g>';
  race.viewTime ??= 0;
  const st = { running: !race.finished && !app._racePaused, last: performance.now(), uiT: 0, saveT: 0 };
  app.pauseRace = () => { st.running = false; app._racePaused = true; bar_(); };
  app.leaveRoute = () => { stopLoop(); persist(); };
  const frame = (ts) => {
    const dt = Math.min(0.1, (ts - st.last) / 1000); st.last = ts;
    if (st.running && !race.finished && !document.querySelector('.modal-back')) {
      const mult = SPEEDS[app.settings.speed] || 10;
      const target = race.viewTime + dt * mult;
      const r = advance(race, target, t, { autoPause: true });
      race.viewTime = r === 'pause' ? race.time : target;
      handlePending(race, st);
      if (race.finished) { onFinish(); }
    }
    drawMap(race, len, trk);
    st.uiT += dt; st.saveT += dt;
    if (st.uiT > 0.25) { st.uiT = 0; drawUI(race); }
    if (st.saveT > 12) { st.saveT = 0; persist(); }
    loop = requestAnimationFrame(frame);
  };
  const bar_ = () => drawBar(race, st);
  app._raceSt = st;
  drawUI(race);
  loop = requestAnimationFrame(frame);
  app.onKey = (e) => { if (e.target.tagName === 'INPUT') return; if (e.code === 'Space') { e.preventDefault(); togglePause(); } };
}
function stopLoop() { if (loop) cancelAnimationFrame(loop); loop = null; app.onKey = null; }
function togglePause() { const st = app._raceSt; if (!st) return; st.running = !st.running; app._racePaused = !st.running; drawBar(R(), st); }

function handlePending(race, st) {
  const pend = race.pending.filter((p) => !p.shown);
  for (const p of pend) {
    const pauseOn = app.settings.autoPause && app.settings.pauseOn?.[p.type] !== false;
    const stillRelevant = !p.carId || (!carById(race, p.carId)?.dnf && !carById(race, p.carId)?.finished);
    p.shown = true;
    if (!stillRelevant || race.finished) continue;
    if (pauseOn) { showDecision(race, p); return; }
    toast(p.text, 'warn', 4000);
  }
}

function recommendation(race, p) {
  const s = app.state; const pt = s.teams[s.player]; const q = deptQ(pt, 'strat');
  const conf = q > 75 ? 'High' : q > 55 ? 'Medium' : 'Low';
  const mine = race.cars.filter((c) => c.isPlayer && !c.dnf && !c.finished);
  const recs = [];
  if (p.type === 'sc' || p.type === 'vsc') for (const c of mine) { const left = race.laps - c.lapsDone; const next = c.plan.stops[c.planIdx]; if (left > 4 && (c.tyre.wear > 35 || (next && next.lap - c.lapsDone < 10))) recs.push(`Box ${c.short} for ${left > 15 / race.scale ? 'Hards' : 'Mediums'}`); else recs.push(`Keep ${c.short} out (track position)`); }
  if (p.type === 'rain') recs.push(race.wetness > 0.2 ? 'Switch to Intermediates now' : 'Wait one more lap — crossover is close');
  if (p.type === 'dry') recs.push(race.wetness < 0.1 ? 'Switch to slicks now' : 'Hold on inters one more lap');
  if (p.type === 'cliff') recs.push('Box within 1–2 laps or lose ~1s+/lap');
  if (p.type === 'damage') recs.push('Repair if more than ~8 laps remain');
  if (p.type === 'orders') recs.push('Swap if the gap to the car ahead is closing; morale cost for the lead driver');
  return recs.length ? `<div class="alert small"><b>Engineer recommendation</b> (confidence: ${conf}): ${recs.map(esc).join(' · ')}</div>` : '';
}
function tyreRow(race, c) {
  return `<div class="row small" style="margin:.3rem 0"><b style="min-width:90px">${esc(c.short)}</b> P${c.pos} ${tyreBadge(c.tyre.c)} ${Math.round(c.tyre.wear)}%
  <span class="sp"></span>${['S', 'M', 'H', 'I', 'W'].map((x) => `<button class="btn sm ${c.pitReq?.c === x ? 'on' : ''}" data-act="dpit" data-arg="${c.id}:${x}">Box ${x}</button>`).join('')}<button class="btn sm ${!c.pitReq ? 'on' : ''}" data-act="dstay" data-arg="${c.id}">Stay out</button></div>`;
}
function showDecision(race, p) {
  const mine = race.cars.filter((c) => c.isPlayer && !c.dnf && !c.finished);
  const titles = { sc: '🟡 Safety Car', rain: '🌧️ Rain', dry: '☀️ Track drying', cliff: '⚠️ Tyre cliff', failure: '🔧 Technical problem', damage: '💥 Damage', orders: '📻 Team orders', fuel: '⛽ Fuel' };
  const car = p.carId ? carById(race, p.carId) : null;
  let body = '';
  if (['sc', 'rain', 'dry'].includes(p.type)) body = mine.map((c) => tyreRow(race, c)).join('');
  if (p.type === 'cliff' && car) body = tyreRow(race, car) + `<div class="row"><button class="btn sm" data-act="dmode" data-arg="${car.id}:conserve">Switch to Conserve</button></div>`;
  if (p.type === 'damage' && car) body = `<div class="row">${['S', 'M', 'H', 'I', 'W'].map((x) => `<button class="btn sm" data-act="dpit" data-arg="${car.id}:${x}">Repair + ${COMPOUNDS[x].name}</button>`).join('')}<button class="btn sm" data-act="dstay" data-arg="${car.id}">Continue</button></div>`;
  if (p.type === 'failure' && car) body = `<div class="row"><button class="btn sm" data-act="dmode" data-arg="${car.id}:conserve">Nurse the car (Conserve)</button><button class="btn sm" data-act="dclose">Keep pushing</button></div>`;
  if (p.type === 'fuel' && car) body = `<div class="row"><button class="btn sm" data-act="dmode" data-arg="${car.id}:conserve">Lift & coast (Conserve)</button><button class="btn sm" data-act="dclose">Ignore</button></div>`;
  if (p.type === 'orders') body = `<div class="opts"><button class="btn" data-act="dorders" data-arg="${p.carId}:${p.mateId}:swap"><b>Swap positions</b>&nbsp;<span class="muted small">Faster car through; morale hit for the other driver.</span></button><button class="btn" data-act="dorders" data-arg="${p.carId}:${p.mateId}:hold"><b>Hold positions</b>&nbsp;<span class="muted small">No risk of contact; frustrated faster driver.</span></button><button class="btn" data-act="dorders" data-arg="${p.carId}:${p.mateId}:race"><b>Let them race</b>&nbsp;<span class="muted small">Fair, but risk of contact and time loss.</span></button></div>`;
  modal(`<div class="decision" style="padding:.2rem;border:0"><h2>${titles[p.type] || 'Decision'} <span class="muted small">Lap ${race.lap}/${race.laps}</span></h2><p>${esc(p.text)}</p>${recommendation(race, p)}${body}<div class="row" style="justify-content:flex-end;margin-top:1rem"><button class="btn primary" data-act="dclose">Resume race ▶</button></div></div>`, { wide: true, dismiss: false });
}
on({
  dpit: (arg, el) => { const [id, c] = arg.split(':'); actions.pit(R(), id, c); el.parentElement.querySelectorAll('.btn').forEach((b) => b.classList.remove('on')); el.classList.add('on'); },
  dstay: (id, el) => { actions.cancelPit(R(), id); el.parentElement.querySelectorAll('.btn').forEach((b) => b.classList.remove('on')); el.classList.add('on'); },
  dmode: (arg, el) => { const [id, m] = arg.split(':'); actions.mode(R(), id, m); el.classList.add('on'); },
  dorders: (arg) => { const [a, b, k] = arg.split(':'); actions.orders(R(), a, b, k); closeModal(); },
  dclose: () => closeModal(),
});

function drawMap(race, len, trk) {
  const T = race.viewTime ?? race.time;
  let leaderFrac = null;
  for (const c of race.cars) {
    const g = document.getElementById('m_' + c.id); if (!g) continue;
    if (c.dnf) { g.style.opacity = 0.18; continue; }
    let f = c.finished ? 0 : clamp((T - c.lapStart) / Math.max(1, c.lapEnd - c.lapStart), 0, 0.999);
    if (c.pos === 1) leaderFrac = f;
    const p = trk.getPointAtLength(f * len);
    g.setAttribute('transform', `translate(${p.x.toFixed(2)},${p.y.toFixed(2)})`);
  }
  const sc = document.getElementById('scCar');
  if (sc) { if (race.sc.state === 'sc' && leaderFrac != null) { const p = trk.getPointAtLength(((leaderFrac + 0.025) % 1) * len); sc.style.display = ''; sc.setAttribute('transform', `translate(${p.x},${p.y})`); } else sc.style.display = 'none'; }
}
const crossAt = (c, k) => { let t = 0; for (let i = 0; i < k && i < c.laps.length; i++) t += c.laps[i]; return t; };
function gapOf(race, c, order, mode) {
  if (c.dnf) return 'DNF';
  if (c.pos === 1) return c.finished ? 'WIN' : 'Leader';
  const lead = order[0];
  if (mode === 'leader') { const d = lead.lapsDone - c.lapsDone; if (d >= 2) return `+${d - 1}L`; const lt = race.lineTimes[c.lapsDone]; return lt != null ? '+' + Math.max(0, c.total - lt).toFixed(1) : '--'; }
  const ahead = order[c.pos - 2]; if (!ahead || ahead.dnf) return '--';
  const d = ahead.lapsDone - c.lapsDone; if (d >= 2) return '+1L';
  const iv = d === 0 ? c.total - ahead.total : c.total - crossAt(ahead, c.lapsDone);
  return Number.isFinite(iv) ? '+' + Math.max(0, iv).toFixed(1) : '--';
}
function drawBar(race, st) {
  const el = document.getElementById('racebar'); if (!el) return;
  const flag = race.finished ? '<span class="flag chk">🏁 FINISHED</span>' : race.sc.state === 'sc' ? '<span class="flag sc">SAFETY CAR</span>' : race.sc.state === 'vsc' ? '<span class="flag vsc">VSC</span>' : '<span class="flag green">GREEN</span>';
  const sp = app.settings.speed;
  const html = `<span class="lap mono">L${Math.min(race.lap, race.laps)}/${race.laps}</span>${flag}<span class="small">${wetLabel(race.wetness)}${race.wetness > 0.05 ? ` (${Math.round(race.wetness * 100)}%)` : ''}</span>
  <span class="sp"></span>
  ${race.finished ? `<button class="btn primary" data-act="toDebrief">Race debrief →</button>` : `<div class="row speed" role="group" aria-label="Simulation speed"><button class="btn sm ${st?.running ? '' : 'on'}" data-act="rpause" aria-label="Pause">${st?.running ? '⏸' : '▶'}</button>
  ${Object.entries({ normal: '1×', fast: '3×', vfast: '9×' }).map(([k, l]) => `<button class="btn sm ${sp === k ? 'on' : ''}" data-act="rspeed" data-arg="${k}">${l}</button>`).join('')}<button class="btn sm ghost" data-act="rskip" title="Let the engineers run the rest">⏭</button></div>`}`;
  if (el._html !== html) { el.innerHTML = html; el._html = html; }
}
function drawUI(race) {
  const s = app.state; const order = updateOrder(race);
  drawBar(race, app._raceSt);
  const mode = app.tab.gapMode || 'interval';
  const info = DIFFICULTY[s.difficulty].info;
  const tw = document.getElementById('tower');
  if (tw) tw.innerHTML = `<table><tbody>${order.map((c) => `<tr class="${c.isPlayer ? 'pl' : ''} ${c.dnf ? 'dnf' : ''}"><td class="pos">${c.pos}</td><td><span class="sw" style="background:${c.color}"></span></td><td class="nm">${esc(c.short)}${c.pos < c.grid && !c.dnf ? ' <span class="good tiny">▲' + (c.grid - c.pos) + '</span>' : c.pos > c.grid && !c.dnf ? ' <span class="bad tiny">▼' + (c.pos - c.grid) + '</span>' : ''}</td><td class="mono small">${gapOf(race, c, order, mode)}</td><td>${c.dnf ? '' : tyreBadge(c.tyre.c)}</td><td class="tiny muted">${c.dnf ? esc(c.dnf).slice(0, 10) : c.tyre.age + 'L'}${c.stops.length ? ' ·' + c.stops.length + 'P' : ''}</td></tr>`).join('')}</tbody></table>`;
  const ctrl = document.getElementById('ctrl');
  const html = race.cars.filter((c) => c.isPlayer).map((c) => carPanel(race, c, order, info)).join('') + `<div class="card tight small muted">Space = pause. Critical events pause automatically (configure in Settings). Pit calls take effect at the end of the current lap.</div>`;
  if (ctrl && ctrl._html !== html) { ctrl.innerHTML = html; ctrl._html = html; }
  const feed = document.getElementById('feed');
  if (feed) {
    const items = [...race.radio.slice(-25).map((r) => ({ lap: r.lap, html: `<span class="l">L${r.lap}</span><b style="color:${r.color}">📻 ${esc(r.from)}:</b> ${esc(r.text)}`, t: r.lap + 0.5 })), ...race.log.slice(-35).map((l) => ({ lap: l.lap, html: `<span class="l">L${l.lap}</span><span class="${l.sev === 'muted' ? 'muted' : l.sev}">${esc(l.text)}</span>`, t: l.lap }))].sort((a, b) => b.t - a.t).slice(0, 40);
    feed.innerHTML = items.map((i) => `<div>${i.html}</div>`).join('');
  }
}
function carPanel(race, c, order, info) {
  const ahead = order[c.pos - 2], behind = order[c.pos];
  const gA = ahead && !ahead.dnf && ahead.lapsDone === c.lapsDone ? (c.total - ahead.total).toFixed(1) : '—';
  const gB = behind && !behind.dnf && behind.lapsDone === c.lapsDone ? (behind.total - c.total).toFixed(1) : '—';
  const wear = info >= 0.8 ? Math.round(c.tyre.wear) + '%' : info >= 0.6 ? '~' + Math.round(c.tyre.wear / 10) * 10 + '%' : c.tyre.wear > 70 ? 'High' : c.tyre.wear > 40 ? 'Medium' : 'Low';
  const next = c.plan.stops[c.planIdx];
  const lapsLeft = race.laps - c.lapsDone;
  const fuelMargin = c.fuel - (100 / race.laps) * lapsLeft;
  const cliff = COMPOUNDS[c.tyre.c].cliff;
  if (c.dnf) return `<div class="carpanel"><div class="hd"><span class="sw" style="background:${c.color}"></span><b>${esc(c.name)}</b><span class="pill bad">DNF</span></div><div class="small muted">${esc(c.dnf)} — lap ${c.lapsDone}</div></div>`;
  if (c.finished) return `<div class="carpanel"><div class="hd"><span class="sw" style="background:${c.color}"></span><b>${esc(c.name)}</b><span class="pill good">Finished P${c.pos}</span></div></div>`;
  return `<div class="carpanel"><div class="hd"><span class="sw" style="background:${c.color}"></span><b>${esc(c.name)}</b><span class="pill">P${c.pos}</span><span class="sp"></span><span class="tiny muted mono">last ${c.lastLap ? fmtTime(c.lastLap) : '--'}</span></div>
  <div class="row small"><span>Ahead <b class="mono">${gA}</b></span><span>Behind <b class="mono">${gB}</b></span>${c.damage > 0 ? `<span class="bad">Damage +${c.damage.toFixed(1)}s</span>` : ''}${c.failurePen > 0 ? `<span class="warn">Fault +${c.failurePen.toFixed(1)}s</span>` : ''}</div>
  <div class="row small" style="margin-top:.3rem">${tyreBadge(c.tyre.c)} <span>${COMPOUNDS[c.tyre.c].name} · ${c.tyre.age} laps · wear ${wear}</span></div>${bar(c.tyre.wear, 100, c.tyre.wear > cliff ? 'var(--bad)' : c.tyre.wear > cliff - 12 ? 'var(--warn)' : 'var(--good)')}
  <div class="row tiny muted" style="margin-top:.2rem"><span>Fuel ${fuelMargin >= 0 ? '+' : ''}${(fuelMargin / (100 / race.laps)).toFixed(1)} laps</span><span>Battery ${Math.round(c.battery)}%</span><span>${next ? `Plan: L${next.lap} → ${next.c}` : 'No more planned stops'}</span></div>
  <div class="tiny muted" style="margin-top:.35rem">Driving mode</div><div class="seg">${MODES.map((m) => `<button class="btn sm ${c.mode === m ? 'on' : ''}" data-act="rmode" data-arg="${c.id}:${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}</div>
  <div class="tiny muted">ERS</div><div class="seg">${ERS_MODES.map((m) => `<button class="btn sm ${c.ers === m ? 'on' : ''}" data-act="rers" data-arg="${c.id}:${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}</div>
  <div class="tiny muted">Pit call ${c.pitReq ? `<b class="warn">— BOXING for ${COMPOUNDS[c.pitReq.c].name}</b>` : ''}</div><div class="seg">${['S', 'M', 'H', 'I', 'W'].map((x) => `<button class="btn sm ${c.pitReq?.c === x ? 'on' : ''}" data-act="rpit" data-arg="${c.id}:${x}" title="Box for ${COMPOUNDS[x].name}">${tyreBadge(x)}</button>`).join('')}${c.pitReq ? `<button class="btn sm danger" data-act="rcancel" data-arg="${c.id}">Cancel</button>` : ''}</div>
  <label class="tiny" style="margin-top:.3rem"><input type="checkbox" ${c.autoPlan ? 'checked' : ''} data-change="rauto" data-arg="${c.id}"> Engineers execute plan & weather calls</label></div>`;
}
const refresh = () => drawUI(R());
on({
  mtab: (k, el) => { document.getElementById('racegrid').dataset.mt = k; el.parentElement.querySelectorAll('.btn').forEach((b) => b.classList.toggle('on', b === el)); },
  gapMode: () => { app.tab.gapMode = app.tab.gapMode === 'leader' ? 'interval' : 'leader'; document.getElementById('gapModeBtn').textContent = app.tab.gapMode === 'leader' ? 'To leader' : 'Interval'; drawUI(R()); },
  rpause: () => togglePause(),
  rspeed: (k) => { app.settings.speed = k; drawBar(R(), app._raceSt); },
  rskip: async () => {
    const ok = await confirmBox('Simulate to the flag?', 'Engineers will run the rest of the race using your plan. Critical decisions will be made automatically.', 'Simulate');
    if (!ok) return; const race = R(); const t = trackById(app.state.weekend.trackId);
    for (const c of race.cars) if (c.isPlayer) c.autoPlan = true;
    let T = race.viewTime; let g = 0; while (!race.finished && g++ < 20000) { T += 30; advance(race, T, t, {}); }
    race.pending.forEach((p) => (p.shown = true)); race.viewTime = race.time; onFinish();
  },
  rmode: (arg) => { const [id, m] = arg.split(':'); actions.mode(R(), id, m); refresh(); },
  rers: (arg) => { const [id, m] = arg.split(':'); actions.ers(R(), id, m); refresh(); },
  rpit: (arg) => { const [id, c] = arg.split(':'); actions.pit(R(), id, c); refresh(); },
  rcancel: (id) => { actions.cancelPit(R(), id); refresh(); },
  rauto: (id, el) => { actions.auto(R(), id, el.checked); },
  toDebrief: () => { if (app.state.weekend.phase !== 'post') classify(app.state); persist(); go('post'); },
});
function onFinish() { const s = app.state; if (s.weekend.phase !== 'post') classify(s); persist(); drawUI(R()); toast('Chequered flag!', 'good'); }
