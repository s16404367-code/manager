// Live Race Control: timing tower, minimap, pit wall controls, radio, critical-event decisions.
import { updateSettings, app, screen, on, go, esc, persist, toast, render, modal, closeModal, confirmBox } from './app.js';
import * as PE from '../engines/people.js';
import { trackById, trackPath } from '../data/tracks.js';
import { drsOn, advance, actions, carById, updateOrder, MODES, ERS_MODES } from '../engines/raceEngine.js';
import { classify } from '../engines/weekendEngine.js';
import { COMPOUNDS, grip } from '../engines/tyreEngine.js';
import { wetLabel } from '../engines/weatherEngine.js';
import { DIFFICULTY, deptQ } from '../engines/world.js';
import { fmtTime, clamp } from '../sim/util.js';
import { tyreBadge, bar } from './widgets.js';
import { mapSvg, carDots, placeCar, placeCarAt, pitPoint, showFlag, teleHtml, updateTele, sectorLegend, lapProfile, sampleAt, pointAt, markSelected } from './trackView.js';
import { trackPoints } from '../data/tracks.js';

/* player cars in the team's driver order (Driver 1 = favourite, shown first/left) */
const favOrder = (cars) => { const ord = app.state?.teams?.[app.state.player]?.drivers || []; return [...cars].sort((a, b) => ord.indexOf(a.driverId) - ord.indexOf(b.driverId)); };
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
    <div class="live rgrid" id="racegrid" data-mt="ctrl">
      <div class="card c-tower tower"><div class="row"><h4 style="margin:0">Timing</h4><span class="sp"></span><button class="btn sm ghost" data-act="gapMode" id="gapModeBtn">Interval</button></div><div id="tower"></div></div>
      <div class="c-map"><div class="mapwrap">${mapSvg(t, 'map')}${sectorLegend()}</div>
        <div class="card tight" style="margin-top:.8rem"><h4 style="margin:0 0 .4rem">Telemetry <span class="tiny muted" style="text-transform:none;letter-spacing:0">— tap any car in the timing table (yours or a rival)</span></h4>${teleHtml(t, 'rtele')}</div>
</div>
      <div class="pitfx" id="pitfx" aria-live="polite"></div>
      <div class="c-side"><div class="c-ctrl" id="ctrl"></div><div class="card c-feed" style="margin-top:.8rem"><h4>Team radio & race control</h4><div class="feed" id="feed"></div></div></div>
    </div>`;
  },
  after() { startLoop(); },
});

function startLoop() {
  stopLoop();
  const race = R(); if (!race) return;
  const t = trackById(app.state.weekend.trackId);
  const trk = { pts: trackPoints(t), prof: lapProfile(t), t }; const len = 1;
  const carsG = document.getElementById('map-cars');
  carsG.innerHTML = carDots(race.cars.map((c) => ({ id: c.id, color: c.color, isPlayer: c.isPlayer, tag: esc(c.short.slice(0, 3).toUpperCase()) }))) + '<g id="scCar" style="display:none"><rect x="-3" y="-1.8" width="6" height="3.6" rx="1" fill="#ffd400" stroke="#000" stroke-width=".4"/><text y="1.2" font-size="2.8" font-weight="900" text-anchor="middle" fill="#000">SC</text></g>';
  app.tab.teleCar ||= race.cars.find((c) => c.isPlayer)?.id;
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
  const mine = favOrder(race.cars.filter((c) => c.isPlayer && !c.dnf && !c.finished));
  const recs = [];
  if (p.type === 'sc' || p.type === 'vsc') for (const c of mine) { const left = race.laps - c.lapsDone; const next = c.plan.stops[c.planIdx]; if (left > 4 && (c.tyre.wear > 35 || (next && next.lap - c.lapsDone < 10))) recs.push(`Box ${c.short} for ${left > 15 / race.scale ? 'Hards' : 'Mediums'}`); else recs.push(`Keep ${c.short} out (track position)`); }
  if (p.type === 'rain') recs.push(race.wetness > 0.2 ? 'Switch to Intermediates now' : 'Wait one more lap — crossover is close');
  if (p.type === 'dry') recs.push(race.wetness < 0.1 ? 'Switch to slicks now' : 'Hold on inters one more lap');
  if (p.type === 'pitconfirm') { const c = carById(race, p.carId); if (c) recs.push(grip(c.tyre) < 25 ? 'Box: grip is nearly gone' : grip(c.tyre) > 50 && race.wetness < 0.15 ? 'Tyres still have life — staying out 2 laps is an option' : 'Box as proposed'); }
  if (p.type === 'pitplan') { const c = carById(race, p.carId); if (c) recs.push(grip(c.tyre) > 45 ? 'Tyres still have life — extending 2 laps is an option' : grip(c.tyre) < 25 ? 'Box now: grip is nearly gone' : 'Stick to the plan'); }
  if (p.type === 'red') recs.push('Free tyre change: fit the tyre that can reach the flag (Hards if >25 laps left)');
  if (p.type === 'cliff') recs.push('Box within 1–2 laps or lose ~1s+/lap');
  if (p.type === 'damage') recs.push('Repair if more than ~8 laps remain');
  if (p.type === 'plan') recs.push(Math.abs((race.degMult || 1) - 1) > 0.06 ? 'Adapt the plan: wear differs clearly from Friday' : 'Keep the plan: wear matches the model');
  if (p.type === 'orders') recs.push('Swap if the gap to the car ahead is closing; morale cost for the lead driver');
  return recs.length ? `<div class="alert small"><b>Engineer recommendation</b> (confidence: ${conf}): ${recs.map(esc).join(' · ')}</div>` : '';
}
function tyreRow(race, c) {
  return `<div class="row small" style="margin:.3rem 0"><b style="min-width:90px">${esc(c.short)}</b> P${c.pos} ${tyreBadge(c.tyre.c)} grip ${grip(c.tyre)}%
  <span class="sp"></span>${['S', 'M', 'H', 'I', 'W'].map((x) => `<button class="btn sm ${c.pitReq?.c === x ? 'on' : ''}" data-act="dpit" data-arg="${c.id}:${x}">Box ${x}</button>`).join('')}<button class="btn sm ${!c.pitReq ? 'on' : ''}" data-act="dstay" data-arg="${c.id}">Stay out</button></div>`;
}
export function raceDataHtml(race) {
  const order = updateOrder(race); const w = race.weather?.wet || [];
  const trend = [0, 3, 6, 10].map((k) => { const l = Math.min(w.length - 1, race.lap + k); return `<span class="pill">${k ? '+' + k + 'L' : 'Now'}: ${Math.round((w[l] || 0) * 100)}% wet</span>`; }).join(' ');
  return `<div class="small" style="margin:.4rem 0">Track ${race.trackTemp}°C · ${trend}${race.yellow ? ` · <b class="warn">Yellow S${race.yellow.sector}</b>` : ''}</div>
  <div style="max-height:44vh;overflow:auto"><table class="tbl small"><thead><tr><th>P</th><th>Driver</th><th>Gap</th><th>Last</th><th>Tyre</th><th>Grip</th><th>Age</th><th>Stops</th><th>Status</th></tr></thead><tbody>${order.map((c) => `<tr class="${c.isPlayer ? 'pl' : ''}"><td>${c.pos}</td><td><span class="sw" style="background:${c.color}"></span> ${esc(c.short)}</td><td class="mono">${gapOf(race, c, order, 'leader')}</td><td class="mono">${c.lastLap ? fmtTime(c.lastLap) : '--'}</td><td>${c.dnf ? '' : tyreBadge(c.tyre.c)}</td><td>${c.dnf ? '' : grip(c.tyre) + '%'}</td><td>${c.tyre.age}L</td><td>${c.stops.map((x) => 'L' + x.lap + '→' + x.to).join(' ') || '—'}</td><td class="tiny">${c.dnf ? '<span class="bad">' + esc(c.dnf) + '</span>' : c.damage ? '<span class="warn">damage</span>' : c.dirty ? 'dirty air' : ''}</td></tr>`).join('')}</tbody></table></div>`;
}
function showDecision(race, p) {
  const mine = favOrder(race.cars.filter((c) => c.isPlayer && !c.dnf && !c.finished));
  const titles = { pitconfirm: '🛞 Pit stop — your call', pitplan: '🛞 Planned pit stop', red: '🟥 Red flag', vsc: '🟡 Virtual Safety Car', sc: '🟡 Safety Car', rain: '🌧️ Rain', dry: '☀️ Track drying', cliff: '⚠️ Tyre cliff', failure: '🔧 Technical problem', damage: '💥 Damage', orders: '📻 Team orders', plan: '📋 Strategy check', fuel: '⛽ Fuel' };
  const car = p.carId ? carById(race, p.carId) : null;
  let body = '';
  if (['sc', 'vsc', 'red', 'rain', 'dry'].includes(p.type)) body = mine.map((c) => tyreRow(race, c)).join('');
  if (p.type === 'cliff' && car) body = tyreRow(race, car) + `<div class="row"><button class="btn sm" data-act="dmode" data-arg="${car.id}:conserve">Switch to Conserve</button></div>`;
  if (p.type === 'damage' && car) body = `<div class="row">${['S', 'M', 'H', 'I', 'W'].map((x) => `<button class="btn sm" data-act="dpit" data-arg="${car.id}:${x}">Repair + ${COMPOUNDS[x].name}</button>`).join('')}<button class="btn sm" data-act="dstay" data-arg="${car.id}">Continue</button></div>`;
  if (p.type === 'failure' && car) body = `<div class="row"><button class="btn sm" data-act="dmode" data-arg="${car.id}:conserve">Nurse the car (Conserve)</button><button class="btn sm" data-act="dclose">Keep pushing</button></div>`;
  if (p.type === 'fuel' && car) body = `<div class="row"><button class="btn sm" data-act="dmode" data-arg="${car.id}:conserve">Lift & coast (Conserve)</button><button class="btn sm" data-act="dclose">Ignore</button></div>`;
  if (p.type === 'plan') body = mine.map((c) => { const rest = c.plan.stops.slice(c.planIdx); const k = race.degMult || 1; const adj = rest.map((st) => Math.max(c.lapsDone + 1, Math.min(race.laps - 1, Math.round(c.lapsDone + (st.lap - c.lapsDone) / k)))); return `<div class="carpanel"><div class="hd"><span class="sw" style="background:${c.color}"></span><b>${esc(c.name)}</b><span class="pill">P${c.pos}</span>${tyreBadge(c.tyre.c)}<span class="tiny muted">grip ${grip(c.tyre)}% after ${c.tyre.age} laps</span></div>
    <div class="small">Current plan: ${rest.length ? rest.map((st) => `L${st.lap} → ${tyreBadge(st.c)}`).join(' ') : 'no more stops'}${rest.length ? ` · <span class="muted">adjusted for today's wear: ${adj.map((l, i) => `L${l} → ${rest[i].c}`).join(', ')}</span>` : ''}</div>
    <div class="row" style="margin-top:.4rem"><button class="btn sm on" data-act="dplan" data-arg="${c.id}:keep">Continue with plan</button><button class="btn sm" data-act="dplan" data-arg="${c.id}:replan">Engineers adapt to today's wear</button><button class="btn sm" data-act="dplan" data-arg="${c.id}:manual">I'll call stops manually</button></div></div>`; }).join('');
  if (p.type === 'pitplan' && car) { const st = car.plan.stops[car.planIdx]; body = `<div class="carpanel"><div class="small">Grip ${grip(car.tyre)}% after ${car.tyre.age} laps · P${car.pos} · plan: box L${st?.lap} → ${st ? tyreBadge(st.c) : ''}</div>
    <div class="tiny muted" style="margin-top:.4rem">Keep the plan, but choose the tyre:</div><div class="row">${['S', 'M', 'H', 'I', 'W'].map((x) => `<button class="btn sm ${st?.c === x ? 'on' : ''}" data-act="dstop" data-arg="${car.id}:${x}">Box → ${tyreBadge(x)}</button>`).join('')}</div>
    <div class="row" style="margin-top:.4rem"><button class="btn sm" data-act="ddelay" data-arg="${car.id}:2">Stay out +2 laps</button><button class="btn sm" data-act="ddelay" data-arg="${car.id}:5">Stay out +5 laps</button><button class="btn sm" data-act="dplan" data-arg="${car.id}:manual">Cancel plan — I'll call it</button></div></div>`; }
  if (p.type === 'pitconfirm' && car) body = pitConfirmBody(race, car);
  if (p.type === 'orders') body = `<div class="opts"><button class="btn" data-act="dorders" data-arg="${p.carId}:${p.mateId}:swap"><b>Swap positions</b>&nbsp;<span class="muted small">Faster car through; morale hit for the other driver.</span></button><button class="btn" data-act="dorders" data-arg="${p.carId}:${p.mateId}:hold"><b>Hold positions</b>&nbsp;<span class="muted small">No risk of contact; frustrated faster driver.</span></button><button class="btn" data-act="dorders" data-arg="${p.carId}:${p.mateId}:race"><b>Let them race</b>&nbsp;<span class="muted small">Fair, but risk of contact and time loss.</span></button></div>`;
  modal(`<div class="decision" style="padding:.2rem;border:0"><h2>${titles[p.type] || 'Decision'} <span class="muted small">Lap ${race.lap}/${race.laps}</span></h2><p>${esc(p.text)}</p>${recommendation(race, p)}${body}<details class="rdata"><summary>📊 Full race data (all cars, weather)</summary>${raceDataHtml(race)}</details><div class="row" style="justify-content:flex-end;margin-top:1rem"><button class="btn" data-act="dpeek">👁 View race screen (stays paused)</button><button class="btn primary" data-act="dclose">Resume race ▶</button></div></div>`, { wide: true, dismiss: false });
}
function pitConfirmBody(race, c) {
  const want = c._ask?.c || 'M'; const sets = Array.isArray(c.sets) ? c.sets : null;
  const comps = race.wetness > 0.15 ? ['I', 'W', 'S', 'M', 'H'] : ['S', 'M', 'H', 'I', 'W'];
  const rows = comps.map((x) => {
    const mine = sets ? sets.filter((s) => s.c === x).sort((a, b) => a.wear - b.wear) : null;
    const wantUsed = !!c._ask?.used; const pickId = mine && mine.length ? ((wantUsed && mine.find((q) => q.wear > 2)) || mine.find((q) => q.wear <= 2) || mine[0]).id : null;
    const opts = mine ? (mine.length ? mine.map((s) => `<button class="btn sm ${x === want && s.id === pickId ? 'on' : ''}" data-act="pcbox" data-arg="${c.id}:${x}:${s.id}">${s.wear <= 2 ? '🆕 New' : `Used · ${Math.round(100 - s.wear)}% life`}</button>`).join('') : `<button class="btn sm" data-act="pcbox" data-arg="${c.id}:${x}:">No sets left — scrubbed spare (65%)</button>`)
      : `<button class="btn sm ${x === want ? 'on' : ''}" data-act="pcbox" data-arg="${c.id}:${x}:">Fresh set</button>`;
    const nNew = mine ? mine.filter((s) => s.wear < 1).length : null;
    return `<div class="pcrow ${x === want ? 'rec' : ''}"><span class="pcc">${tyreBadge(x)} <b>${COMPOUNDS[x].name}</b>${mine ? `<span class="tiny muted">${nNew} new · ${mine.length - nNew} used</span>` : ''}${x === want ? '<span class="pill ok tiny">engineer pick</span>' : ''}</span><span class="pcsets">${opts}</span></div>`;
  }).join('');
  return `<div class="carpanel"><div class="hd"><span class="sw" style="background:${c.color}"></span><b>${esc(c.name)}</b><span class="pill">P${c.pos}</span><span class="pill">${tyreBadge(c.tyre.c)} ${grip(c.tyre)}% grip · ${c.tyre.age} laps</span></div>
  ${c.damage > 0 ? `<label class="small" style="display:block;margin:.4rem 0"><input type="checkbox" id="pcrep" checked> Repair damage too (+~6s, removes +${c.damage.toFixed(1)}s/lap)</label>` : ''}
  <div class="tiny muted" style="margin:.4rem 0 .2rem">Pick the set to fit (grip % = life left; 100% = brand new):</div><div class="pcgrid">${rows}</div>
  <div class="pcwhen">🛞 Pick a set above = <b>box at the end of lap ${c.lapsDone + 1}</b> (the pit animation plays as the car stops)</div>
  <div class="row" style="margin-top:.6rem"><button class="btn sm" data-act="pcstay" data-arg="${c.id}:1">Stay out 1 more lap (ask on lap ${c.lapsDone + 2})</button><button class="btn sm" data-act="pcstay" data-arg="${c.id}:2">Stay out 2 laps (ask on lap ${c.lapsDone + 3})</button><button class="btn sm ghost" data-act="pcdrop" data-arg="${c.id}">Skip this stop</button></div>
  <div class="tiny muted" style="margin-top:.3rem">Closing this window without choosing = stay out; we ask again next lap.</div></div>`;
}
function wxWidget(race) {
  const w = race.weather?.wet || []; const now = race.wetness || 0; const l = Math.min(w.length - 1, race.lap + 5); const soon = w[l] ?? now;
  const ic = now > 0.6 ? 'storm' : now > 0.15 ? 'rain' : soon > 0.2 ? 'cloud' : 'sun';
  const svg = { sun: '<svg viewBox="0 0 24 24" class="wxi sun"><g class="rays" stroke="#ffd34d" stroke-width="2" stroke-linecap="round">' + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<line x1="12" y1="2.5" x2="12" y2="5" transform="rotate(${a} 12 12)"/>`).join('') + '</g><circle cx="12" cy="12" r="4.6" fill="#ffd34d"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" class="wxi cloud"><circle cx="8" cy="9" r="3.5" fill="#ffd34d"/><path class="cl" d="M6 18h11a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6 1.4A3 3 0 0 0 6 18z" fill="#c9d2e3"/></svg>',
    rain: '<svg viewBox="0 0 24 24" class="wxi rain"><path d="M5 13h12a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6 1.4A3 3 0 0 0 5 13z" fill="#9fb0cc"/><g class="drops" stroke="#4aa8ff" stroke-width="1.6" stroke-linecap="round"><line x1="8" y1="15" x2="7" y2="18"/><line x1="12" y1="15" x2="11" y2="18"/><line x1="16" y1="15" x2="15" y2="18"/></g></svg>',
    storm: '<svg viewBox="0 0 24 24" class="wxi rain"><path d="M5 12h12a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6 1.4A3 3 0 0 0 5 12z" fill="#6f7f9c"/><g class="drops" stroke="#4aa8ff" stroke-width="1.6" stroke-linecap="round"><line x1="7" y1="14" x2="6" y2="18"/><line x1="10" y1="14" x2="9" y2="18"/><line x1="16" y1="14" x2="15" y2="18"/></g><path d="M13 13l-2 4h2l-1 4 3-5h-2l1-3z" fill="#ffd34d"/></svg>' }[ic];
  const trend = soon > now + 0.08 ? '↗ rain coming' : soon < now - 0.08 ? '↘ drying' : '→ stable';
  return `<span class="wxw" title="Track wetness now ${Math.round(now * 100)}%, in 5 laps ${Math.round(soon * 100)}%">${svg}<span class="tiny"><b>${race.trackTemp}°C</b> · ${Math.round(now * 100)}% wet <span class="muted">${trend}</span></span></span>`;
}
on({ swapOrder: () => { const r = PE.swapDrivers(app.state); if (r?.msg) toast(r.msg); persist(); render(); } });
on({
  pcbox: (arg) => { const [id, x, sid] = arg.split(':'); const rep = document.getElementById('pcrep'); actions.confirmPit(R(), id, x, sid || null, rep ? rep.checked : false); closeModal(); },
  pcstay: (arg) => { const [id, n] = arg.split(':'); actions.declinePit(R(), id, +n); closeModal(); },
  pcdrop: (id) => { actions.declinePit(R(), id, 4, true); closeModal(); },
  dpit: (arg, el) => { const [id, c] = arg.split(':'); actions.pit(R(), id, c); el.parentElement.querySelectorAll('.btn').forEach((b) => b.classList.remove('on')); el.classList.add('on'); },
  dstay: (id, el) => { actions.cancelPit(R(), id); el.parentElement.querySelectorAll('.btn').forEach((b) => b.classList.remove('on')); el.classList.add('on'); },
  dmode: (arg, el) => { const [id, m] = arg.split(':'); actions.mode(R(), id, m); el.classList.add('on'); },
  dorders: (arg) => { const [a, b, k] = arg.split(':'); actions.orders(R(), a, b, k); closeModal(); },
  dplan: (arg, el) => { const [id, k] = arg.split(':'); const r = R(); if (k === 'replan') actions.replan(r, id); else actions.auto(r, id, k === 'keep'); el.parentElement.querySelectorAll('.btn').forEach((b) => b.classList.toggle('on', b === el)); toast(k === 'keep' ? 'Plan kept.' : k === 'replan' ? 'Plan adapted to race-day wear.' : 'Manual pit calls — use the pit buttons.', 'info', 1800); },
  dstop: (arg, el) => { const [id, x] = arg.split(':'); actions.changeStop(R(), id, x); el.parentElement.querySelectorAll('.btn').forEach((b) => b.classList.toggle('on', b === el)); },
  ddelay: (arg, el) => { const [id, n] = arg.split(':'); actions.delayStop(R(), id, +n); el.classList.add('on'); },
  dclose: () => { document.getElementById('peekbar')?.remove(); closeModal(); },
});

// Where a car really is at time T. On the lap after a stop the car first spends the real pit time in the
// pit lane (drive to the box, stand still, drive out) and only then rejoins at racing speed — so it no longer
// pops out ahead of a rival and then "drops back" later in the lap.
function carPos(race, c, T) {
  if (c.finished) return { f: 0, prog: 1e6 - c.pos };
  const L = Math.max(1, c.lapEnd - c.lapStart); const el = clamp(T - c.lapStart, 0, L);
  const st = c.stops.length ? c.stops[c.stops.length - 1] : null;
  if (st && st.lap === c.lapsDone && el < L) {
    const W = Math.min(st.total, L * 0.6);
    if (el < W) {
      const q = el / W; const sF = clamp(st.stat / W, 0.05, 0.6); const a = (1 - sF) * 0.35;
      const u = q < a ? 0.5 + 0.12 * (q / a) : q < a + sF ? 0.62 : 0.62 + 0.38 * ((q - a - sF) / Math.max(0.01, 1 - a - sF));
      return { pitU: u, stationary: q >= a && q < a + sF, f: 0, prog: c.lapsDone + 0.045 * q };
    }
    const f = 0.045 + 0.954 * (el - W) / Math.max(1, L - W); return { f, prog: c.lapsDone + f };
  }
  const f = Math.min(0.999, el / L); return { f, prog: c.lapsDone + f };
}
function drawMap(race, len, trk) {
  const T = race.viewTime ?? race.time;
  let leaderD = null; const sel = app.tab.teleCar; if (sel) markSelected(sel);
  const mine = favOrder(race.cars.filter((c) => c.isPlayer)); const selB = mine.find((c) => c.id !== sel)?.id || mine[1]?.id;
  for (const c of race.cars) {
    if (c.dnf) { const g = document.getElementById('m_' + c.id); if (g) g.style.opacity = 0.18; continue; }
    const cp = carPos(race, c, T); const f = cp.f;
    const d = sampleAt(trk.prof, f).d;
    if (c.pos === 1) leaderD = d;
    // pit lane: entering at the end of a lap with a box call, leaving at the start of the lap after a stop
    const entering = c.pitReq && d > 0.955 && cp.pitU == null; const leaving = cp.pitU != null;
    const inPit = entering || leaving; (app._inPit ||= {})[c.id] = inPit;
    if (inPit) placeCarAt(c.id, pitPoint(trk.pts, entering ? (d - 0.955) / 0.09 : cp.pitU)); else placeCar(trk.pts, c.id, d);
    if (c.id === sel || c.id === selB) {
      const k = race.sc.state === 'sc' ? 1.45 : race.sc.state === 'vsc' ? 1.3 : 1;
      const drs = drsOn(race) && race.wetness < 0.3;
      const cap = race.sc.state === 'sc' ? 175 : race.sc.state === 'vsc' ? 215 : null;
      updateTele(trk.t, c.id === sel ? 'rtele' : 'rtele2', `<span class="sw" style="background:${c.color}"></span><b>${esc(c.name)}</b> <span class="muted">P${c.pos} · L${Math.min(c.lapsDone + 1, race.laps)}${inPit ? ' · PIT LANE' : ''}${cap ? ` · <b style="color:#ffd400">${race.sc.state === 'sc' ? 'SC — no overtaking, DRS off' : 'VSC — delta speed, DRS off'}</b>` : ''}</span>`, f, { k, state: c.finished ? 'garage' : inPit ? 'pit' : 'track', drs, cap, follow: !!c.dirty });
    }
  }
  const sc = document.getElementById('scCar');
  showFlag('map', race.red > 0 ? 'RED FLAG' : race.sc.state === 'sc' ? 'SAFETY CAR' : race.sc.state === 'vsc' ? 'VIRTUAL SAFETY CAR' : race.finished ? 'CHEQUERED FLAG' : race.yellow ? `YELLOW FLAG — SECTOR ${race.yellow.sector}` : null);
  if (sc) { if (race.sc.state === 'sc' && leaderD != null) { const p = pointAt(trk.pts, leaderD + 0.025); sc.style.display = ''; sc.setAttribute('transform', `translate(${p[0]},${p[1]})`); } else sc.style.display = 'none'; }
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
  const flag = race.finished ? '<span class="flag chk">🏁 FINISHED</span>' : race.red > 0 ? '<span class="flag red">RED FLAG</span>' : race.sc.state === 'sc' ? '<span class="flag sc">SAFETY CAR</span>' : race.sc.state === 'vsc' ? '<span class="flag vsc">VSC</span>' : '<span class="flag green">GREEN</span>'; const yl = race.yellow && !race.finished ? `<span class="flag vsc">YELLOW S${race.yellow.sector}</span>` : '';
  const sp = app.settings.speed;
  const html = `<span class="lap mono">L${Math.min(race.lap, race.laps)}/${race.laps}</span>${flag}${yl}<span class="flag ${drsOn(race) && race.wetness < 0.3 ? 'drs-on' : 'drs-off'}" title="2026 active aero: every car may open its wings (X-mode) in the green zones on the map, every lap. Disabled in the wet and under SC.">ACTIVE AERO ${drsOn(race) && race.wetness < 0.3 ? 'X-MODE ON' : 'LOCKED (Z)'}</span>${wxWidget(race)}<span class="small">${wetLabel(race.wetness)}${race.wetness > 0.05 ? ` (${Math.round(race.wetness * 100)}%)` : ''}</span>
  <span class="sp"></span>
  ${race.finished ? `<button class="btn primary" data-act="toDebrief">Race debrief →</button>` : `<div class="row speed" role="group" aria-label="Simulation speed"><button class="btn sm ${st?.running ? '' : 'on'}" data-tap="rpause" aria-label="Pause">${st?.running ? '⏸' : '▶'}</button>
  ${Object.entries({ normal: '1×', fast: '3×', vfast: '9×' }).map(([k, l]) => `<button class="btn sm ${sp === k ? 'on' : ''}" data-tap="rspeed" data-arg="${k}">${l}</button>`).join('')}<button class="btn sm ghost" data-act="rskip" title="Let the engineers run the rest">⏭</button><button class="btn sm ghost" data-act="swapOrder" title="Swap which of your drivers is shown first / on the left">⇅</button></div>`}`;
  if (el._html !== html) { el.innerHTML = html; el._html = html; }
}
// Pit-stop animation: slides up at the bottom of the live screen — old tyre rolls off, new one rolls on, stop timer counts.
const pitQ = []; let pitBusy = false;
function watchPits(race) {
  race._seenStops ||= {};
  if (race.finished) { for (const c of race.cars) race._seenStops[c.id] = c.stops.length; return; }
  for (const c of race.cars) {
    const n = c.stops.length, seen = race._seenStops[c.id] ?? n;
    if (race._seenStops[c.id] == null) { race._seenStops[c.id] = n; continue; }
    for (let i = seen; i < n; i++) if (c.isPlayer) pitQ.push({ c, st: c.stops[i] });
    race._seenStops[c.id] = n;
  }
  pitQ.sort((a, b) => (b.c.isPlayer ? 1 : 0) - (a.c.isPlayer ? 1 : 0));
  if (!pitBusy && pitQ.length) playPit(pitQ.shift());
}
function playPit({ c, st }) {
  const el = document.getElementById('pitfx'); if (!el) return;
  pitBusy = true;
  const tyre = (x, cls) => `<span class="pfxtyre ${cls}" style="--tc:${COMPOUNDS[x].color}"><b>${x}</b></span>`;
  el.innerHTML = `<div class="pfxcard ${c.isPlayer ? 'mine' : ''}" style="--team:${c.color}"><div class="pfxhd"><span class="pfxbox">BOX</span><span class="sw" style="background:${c.color}"></span><b>${esc(c.name)}</b><span class="tiny muted">Lap ${st.lap}${st.sc && st.sc !== 'none' ? ' · under ' + st.sc.toUpperCase() : ''}</span></div>
    <div class="pfxstage"><div class="pfxwheel">${tyre(st.from, 'out')}${tyre(st.to, 'in')}</div><div class="pfxtxt"><div>${COMPOUNDS[st.from].name} <span class="pfxarrow">➜</span> <b style="color:${COMPOUNDS[st.to].color}">${COMPOUNDS[st.to].name}</b></div><div class="pfxtimer mono"><span id="pfxt">0.0</span>s <span class="tiny muted">stationary · ${st.total}s total</span></div></div><div class="pfxgun"></div></div></div>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  const t0 = performance.now(), dur = Math.max(1.8, st.stat) * 600; const tEl = () => document.getElementById('pfxt');
  const tick = () => { const k = Math.min(1, (performance.now() - t0) / dur); const e = tEl(); if (e) e.textContent = (st.stat * k).toFixed(1); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => { pitBusy = false; if (pitQ.length) playPit(pitQ.shift()); }, 350); }, dur + (c.isPlayer ? 2200 : 1300));
}
function drawUI(race) {
  if (race.askPits == null) race.askPits = true;
  watchPits(race);
  const s = app.state; const order = updateOrder(race);
  drawBar(race, app._raceSt);
  const mode = app.tab.gapMode || 'interval';
  const info = DIFFICULTY[s.difficulty].info;
  const tw = document.getElementById('tower');
  const fl = Math.min(...race.cars.flatMap((c) => c.laps.slice(1)).filter(Number.isFinite), Infinity);
  app._iv = {}; for (const c of order) { const g = gapOf(race, c, order, 'interval'); app._iv[c.id] = parseFloat(String(g).replace('+', '')); }
  const lastCls = (c) => { const l = c.laps[c.laps.length - 1]; if (!l || c.laps.length < 2) return ''; if (l <= fl + 1e-6) return 'purple'; return l <= Math.min(...c.laps.slice(1)) + 1e-6 ? 'pb' : ''; };
  // LIVE timing: order by real track progress (lap + fraction of the lap), like the map — not only at the line
  const TT = race.viewTime ?? race.time;
  const prog = (c) => c.dnf ? -1e6 + c.lapsDone : carPos(race, c, TT).prog;
  const lo = [...order].sort((a, b) => prog(b) - prog(a)); const LP = {}; lo.forEach((c, k) => { LP[c.id] = k + 1; });
  const lapLen = (c) => Math.max(1, c.lapEnd - c.lapStart);
  const liveGap = (c) => { const k = LP[c.id]; if (c.dnf) return 'DNF'; if (k === 1) return c.finished ? 'WIN' : 'Leader'; if (c.finished) return gapOf(race, c, order, mode);
    const ref = mode === 'leader' ? lo[0] : lo[k - 2]; if (!ref || ref.dnf) return '--'; const dp = prog(ref) - prog(c); if (dp >= 1) return '+' + Math.floor(dp) + 'L';
    return '+' + Math.max(0, dp * lapLen(c)).toFixed(1); };
  if (tw) tw.innerHTML = `<table><tbody>${lo.map((c) => `<tr class="${c.isPlayer ? 'pl' : ''} ${c.dnf ? 'dnf' : ''} ${app.tab.teleCar === c.id ? 'sel' : ''}" data-tap="teleSel" tabindex="0" data-arg="${c.id}" style="cursor:pointer"><td class="pos">${LP[c.id]}</td><td><span class="sw" style="background:${c.color}"></span></td><td class="nm">${esc(c.short)}${LP[c.id] < c.grid && !c.dnf ? ' <span class="good tiny">▲' + (c.grid - LP[c.id]) + '</span>' : LP[c.id] > c.grid && !c.dnf ? ' <span class="bad tiny">▼' + (LP[c.id] - c.grid) + '</span>' : ''}</td><td class="mono small">${liveGap(c)}</td><td class="mono tiny lt ${lastCls(c)}">${c.lastLap ? fmtTime(c.lastLap) : ''}</td><td>${c.dnf ? '' : tyreBadge(c.tyre.c)}</td><td class="tiny muted">${c.dnf ? esc(c.dnf).slice(0, 10) : c.tyre.age + 'L ' + grip(c.tyre) + '%'}${c.stops.length ? ' ·' + c.stops.length + 'P' : ''}${app._inPit?.[c.id] ? ' <b class="pitpill">PIT</b>' : c.pitReq ? ' <b class="pitpill box">BOX</b>' : ''}</td></tr>`).join('')}</tbody></table>`;
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
  const g_ = grip(c.tyre); const wear = info >= 0.8 ? g_ + '%' : info >= 0.6 ? '~' + Math.round(g_ / 10) * 10 + '%' : g_ < 30 ? 'Low' : g_ < 60 ? 'Medium' : 'High';
  const next = c.plan.stops[c.planIdx];
  const lapsLeft = race.laps - c.lapsDone;
  const fuelMargin = c.fuel - (100 / race.laps) * lapsLeft;
  const cliff = COMPOUNDS[c.tyre.c].cliff;
  if (c.dnf) return `<div class="carpanel"><div class="hd"><span class="sw" style="background:${c.color}"></span><b>${esc(c.name)}</b><span class="pill bad">DNF</span></div><div class="small muted">${esc(c.dnf)} — lap ${c.lapsDone}</div></div>`;
  if (c.finished) return `<div class="carpanel"><div class="hd"><span class="sw" style="background:${c.color}"></span><b>${esc(c.name)}</b><span class="pill good">Finished P${c.pos}</span></div></div>`;
  return `<div class="carpanel"><div class="hd"><span class="sw" style="background:${c.color}"></span><b>${esc(c.name)}</b><span class="pill">P${c.pos}</span><span class="sp"></span><span class="tiny muted mono">last ${c.lastLap ? fmtTime(c.lastLap) : '--'}</span></div>
  <div class="row small"><span>Ahead <b class="mono">${gA}</b></span><span>Behind <b class="mono">${gB}</b></span>${c.damage > 0 ? `<span class="bad">Damage +${c.damage.toFixed(1)}s</span>` : ''}${c.failurePen > 0 ? `<span class="warn">Fault +${c.failurePen.toFixed(1)}s</span>` : ''}</div>
  <div class="row small" style="margin-top:.3rem">${tyreBadge(c.tyre.c)} <span>${COMPOUNDS[c.tyre.c].name} · ${c.tyre.age} laps · grip ${wear}${c.sets ? ` · sets left: ${['S','M','H','I','W'].map((x) => { const n = c.sets.filter((y) => y.c === x).length; return n ? x + n : ''; }).filter(Boolean).join(' ')}` : ''}${c.dirty ? ' · <span class="warn">dirty air</span>' : ''}</span></div>${bar(100 - c.tyre.wear, 100, c.tyre.wear > cliff ? 'var(--bad)' : c.tyre.wear > cliff - 12 ? 'var(--warn)' : 'var(--good)')}
  <div class="row tiny muted" style="margin-top:.2rem"><span>Fuel ${fuelMargin >= 0 ? '+' : ''}${(fuelMargin / (100 / race.laps)).toFixed(1)} laps</span><span>Battery ${Math.round(c.battery)}%</span><span>${next ? `Plan: L${next.lap} → ${next.c}` : 'No more planned stops'}</span></div>
  <div class="tiny muted" style="margin-top:.35rem">Instruction ${(() => { const a = order[c.pos - 2]; return a ? `<span class="muted">(car ahead: ${esc(a.short)}${c.train > 1 ? ` · tow train ×${c.train}` : ''})</span>` : ''; })()}</div><div class="seg">${[['race', 'Race'], ['follow', 'Follow car ahead (tow)'], ['defend', 'Defend']].map(([k, l]) => `<button class="btn sm ${(c.instr || 'race') === k ? 'on' : ''}" data-act="rinstr" data-arg="${c.id}:${k}" title="${k === 'follow' ? 'Sit ~0.5s behind in the slipstream: no attack, saves battery, bigger tow' : k === 'defend' ? 'Cover the car behind: much harder to pass, ~0.1s/lap slower' : 'Attack and defend normally'}">${l}</button>`).join('')}</div>
  <div class="tiny muted" style="margin-top:.35rem">Driving mode</div><div class="seg">${MODES.map((m) => `<button class="btn sm ${c.mode === m ? 'on' : ''}" data-act="rmode" data-arg="${c.id}:${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}</div>
  <div class="tiny muted">Overtake mode <span title="2026 rules: extra electric power only when within 1.0s of the car ahead (never for the leader). Battery recharges itself under braking and clipping.">ⓘ</span> ${c.ovt ? '<b class="ok">⚡ ACTIVE</b>' : c.pos === 1 ? '<span class="muted">leader — not available</span>' : '<span class="muted">needs &lt;1.0s gap</span>'}</div><div class="seg">${ERS_MODES.map((m) => `<button class="btn sm ${c.ers === m ? 'on' : ''}" data-act="rers" data-arg="${c.id}:${m}">${m === 'auto' ? 'Use when in range' : 'Save battery'}</button>`).join('')}</div>
  <div class="tiny muted">Pit call ${c.pitReq ? `<b class="warn">— 🅿 BOX at the end of lap ${c.lapsDone + 1} → ${COMPOUNDS[c.pitReq.c].name} ${c.pitReq.used ? '(best used set)' : c.pitReq.setId ? '(chosen set)' : '(new set)'}${c.damage > 0 && c.pitReq.repair !== false ? ' + repair' : ''}</b>` : (c.plan.stops[c.planIdx] ? `next planned stop: lap ${c.plan.stops[c.planIdx].lap} → ${COMPOUNDS[c.plan.stops[c.planIdx].c].name}${c.plan.stops[c.planIdx].used ? ' (used)' : ''} — you\'ll be asked half-way round that lap` : 'no more planned stops')}</div><div class="seg">${['S', 'M', 'H', 'I', 'W'].map((x) => `<button class="btn sm ${c.pitReq?.c === x ? 'on' : ''}" data-act="rpit" data-arg="${c.id}:${x}" title="Box for ${COMPOUNDS[x].name}">${tyreBadge(x)}</button>`).join('')}${c.pitReq ? `<button class="btn sm danger" data-act="rcancel" data-arg="${c.id}">Cancel</button>` : ''}</div>
  <label class="tiny" style="margin-top:.3rem"><input type="checkbox" ${c.autoPlan ? 'checked' : ''} data-change="rauto" data-arg="${c.id}"> Engineers execute plan & weather calls</label></div>`;
}
const refresh = () => drawUI(R());
on({ teleSel: (id) => { app.tab.teleCar = id; drawUI(R()); } });
on({
  mtab: (k, el) => { document.getElementById('racegrid').dataset.mt = k; el.parentElement.querySelectorAll('.btn').forEach((b) => b.classList.toggle('on', b === el)); },
  gapMode: () => { app.tab.gapMode = app.tab.gapMode === 'leader' ? 'interval' : 'leader'; document.getElementById('gapModeBtn').textContent = app.tab.gapMode === 'leader' ? 'To leader' : 'Interval'; drawUI(R()); },
  rpause: () => togglePause(),
  dpeek: () => { const m = document.querySelector('.modal-back'); if (!m) return; m.classList.add('peek'); let b = document.getElementById('peekbar'); if (!b) { b = document.createElement('div'); b.id = 'peekbar'; b.className = 'peekbar'; b.innerHTML = '⏸ Race paused — decision pending. <button class="btn sm primary" data-act="dunpeek">Back to decision</button>'; document.body.appendChild(b); } },
  dunpeek: () => { document.querySelector('.modal-back')?.classList.remove('peek'); document.getElementById('peekbar')?.remove(); },
  rspeed: (k) => { updateSettings({ speed: k }); drawBar(R(), app._raceSt); },
  rskip: async () => {
    const ok = await confirmBox('Simulate to the flag?', 'Engineers will run the rest of the race using your plan. Critical decisions will be made automatically.', 'Simulate');
    if (!ok) return; const race = R(); const t = trackById(app.state.weekend.trackId);
    for (const c of race.cars) if (c.isPlayer) c.autoPlan = true; race.askPits = false;
    let T = race.viewTime; let g = 0; while (!race.finished && g++ < 20000) { T += 30; advance(race, T, t, {}); }
    race.pending.forEach((p) => (p.shown = true)); race.viewTime = race.time; onFinish();
  },
  rinstr: (arg) => { const [id, k] = arg.split(':'); actions.instr(R(), id, k); refresh(); },
  rmode: (arg) => { const [id, m] = arg.split(':'); actions.mode(R(), id, m); refresh(); },
  rers: (arg) => { const [id, m] = arg.split(':'); actions.ers(R(), id, m); refresh(); },
  rpit: (arg) => { const [id, c] = arg.split(':'); actions.pit(R(), id, c); refresh(); },
  rcancel: (id) => { actions.cancelPit(R(), id); refresh(); },
  rauto: (id, el) => { actions.auto(R(), id, el.checked); },
  toDebrief: () => { if (app.state.weekend.phase !== 'post') classify(app.state); persist(); go('post'); },
});
function onFinish() { const s = app.state; if (s.weekend.phase !== 'post') classify(s); persist(); drawUI(R()); toast('Chequered flag!', 'good'); }
