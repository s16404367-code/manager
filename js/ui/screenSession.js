// Live practice / qualifying view: animated map, telemetry, timing tower with sector colours, garage controls.
import { updateSettings, app, on, esc, persist, render, toast, confirmBox } from './app.js';
import { trackById, trackPoints } from '../data/tracks.js';
import { advanceSession, simulateRest, commitSession, sendOut, boxThisLap, setCarOpt, ranking, fmt, PRACTICE_PROGRAMS, setsSummary, setGrip, setLaps, chooseSet } from '../engines/sessionEngine.js';
import { COMPOUNDS } from '../engines/tyreEngine.js';
import { wetLabel } from '../engines/weatherEngine.js';
import { mapSvg, carDots, placeCar, placeCarAt, pitPoint, showFlag, teleHtml, updateTele, sectorLegend, lapProfile, sampleAt, markSelected } from './trackView.js';
import { tyreBadge } from './widgets.js';

const SPEEDS = { normal: 6, fast: 18, vfast: 60 }; /* slower, closer to a real session feel */
let loop = null;
const L = () => app.state?.weekend?.live;
const clockTxt = (x) => { x = Math.max(0, Math.ceil(x)); return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`; };
const sessName = (sess) => (sess.kind === 'quali' ? ['Q1', 'Q2', 'Q3'][sess.idx] : `FP${sess.idx + 1}`);

export function liveView(s, wk, t) {
  const sess = wk.live;
  return `<div class="sessbar" id="sessbar"></div>
  <div class="live" id="livegrid">
    <div class="card c-tower tower"><div class="row"><h4 style="margin:0">Timing — ${sessName(sess)}</h4><span class="sp"></span><span class="tiny muted"><span class="sc purple">■</span> overall best <span class="sc pb">■</span> personal best</span></div><div id="ltower"></div></div>
    <div class="c-map"><div class="mapwrap">${mapSvg(t, 'lmap')}${sectorLegend()}</div>
      <div class="card tight" style="margin-top:.8rem"><h4 style="margin:0 0 .4rem">Telemetry <span class="tiny muted" style="text-transform:none;letter-spacing:0">— tap any car in the timing table (yours or a rival)</span></h4>${teleHtml(t, 'ltele')}</div></div>
    <div class="c-ctrl"><div id="lctrl"></div><div class="card tight" style="margin-top:.8rem"><h4>Session feed</h4><div class="feed" id="lfeed"></div></div></div>
  </div>`;
}

export function stopLive() { if (loop) cancelAnimationFrame(loop); loop = null; app.onKey = null; }
export function startLive() {
  stopLive(); const sess = L(); if (!sess) return;
  const t = trackById(app.state.weekend.trackId); const pts = trackPoints(t); const prof = lapProfile(t);
  const g = document.getElementById('lmap-cars'); if (!g) return;
  g.innerHTML = carDots(sess.cars.map((c) => ({ id: c.did, color: c.color, isPlayer: c.isPlayer, tag: esc(c.short.slice(0, 3).toUpperCase()) })), 'liveSel');
  app.tab.lsel ||= sess.cars.find((c) => c.isPlayer)?.did;
  const st = (app._liveSt ||= { running: true }); st.last = performance.now(); st.ui = 1;
  app.leaveRoute = () => { stopLive(); persist(); };
  const frame = (ts) => {
    const dt = Math.min(0.1, (ts - st.last) / 1000); st.last = ts;
    if (st.running && !sess.done && !document.querySelector('.modal-back')) {
      advanceSession(app.state, sess.clock + dt * (SPEEDS[app.settings.speed] || 10));
    }
    const mine = sess.cars.filter((c) => c.isPlayer); const selA = app.tab.lsel; if (selA) markSelected(selA); const selB = mine.find((c) => c.did !== selA)?.did;
    let box = 0;
    sess.cars.forEach((c) => {
      let tele = null;
      if (c.st === 'track') {
        const f = Math.min(0.999, (sess.clock - c.lapStart) / c.lapLen); const d = sampleAt(prof, f).d;
        const pitOut = c.kind === 'out' && f < 0.05, pitIn = c.kind === 'in' && f > 0.95;
        if (pitOut || pitIn) placeCarAt(c.did, pitPoint(pts, pitOut ? 0.5 + f * 10 : (f - 0.95) * 10)); else placeCar(pts, c.did, d);
        tele = { f, state: pitOut || pitIn ? 'pit' : 'track' };
      } else {
        // parked in the garage: line the pit boxes along the pit lane
        const idx = sess.cars.indexOf(c); placeCarAt(c.did, pitPoint(pts, 0.22 + (idx % 20) * 0.028));
        const g = document.getElementById('m_' + c.did); if (g) g.style.opacity = c.st === 'done' ? 0.35 : 0.8; box++;
      }
      if (c.st === 'track') { const g = document.getElementById('m_' + c.did); if (g) g.style.opacity = 1; }
      if (c.did === selA || c.did === selB) {
        const id = c.did === selA ? 'ltele' : 'ltele2';
        if (tele) updateTele(t, id, teleWho(c), tele.f, { k: c.kind === 'push' ? 1 : c.kind === 'out' ? 1.35 : 1.25, drs: sess.wet < 0.3, state: tele.state, follow: c.kind === 'push' && (c.cur?.notes || []).some((n) => n === 'tow' || n === 'dirty air') });
        else updateTele(t, id, teleWho(c), 0, { state: 'garage' });
      }
    });
    showFlag('lmap', sess.done ? 'SESSION OVER' : sess.flag ? 'CHEQUERED FLAG' : null);
    st.ui += dt; if (st.ui > 0.25) { st.ui = 0; drawLiveUI(sess); }
    loop = requestAnimationFrame(frame);
  };
  drawLiveUI(sess);
  loop = requestAnimationFrame(frame);
  app.onKey = (e) => { if (e.target.tagName === 'INPUT') return; if (e.code === 'Space') { e.preventDefault(); st.running = !st.running; drawLiveUI(sess); } };
}
const KIND = { out: 'Out lap', push: 'FLYING LAP', cool: 'Cool-down lap', in: 'In lap' };
function teleWho(c) { return `<span class="sw" style="background:${c.color}"></span><b>${esc(c.name)}</b> <span class="muted">${c.st === 'track' ? KIND[c.kind] : c.st === 'done' ? 'Session over' : 'In the garage'} · ${tyreBadge(c.tyre)}</span>`; }

function drawLiveUI(sess) {
  const st = app._liveSt || {};
  const bar = document.getElementById('sessbar'); if (!bar) return;
  const left = sess.len - sess.clock;
  const sp = app.settings.speed;
  const flag = sess.done ? '<span class="flag chk">🏁 SESSION OVER</span>' : sess.flag ? '<span class="flag chk">🏁 CHEQUERED</span>' : '<span class="flag green">GREEN</span>';
  const key = [sess.done, sess.flag, st.running, sp].join('|');
  if (bar._k !== key) {
    bar._k = key;
    bar.innerHTML = `<span class="lap mono">${sessName(sess)}</span><span class="clock mono" id="sclock"></span>${flag}<span class="small muted" id="sinfo"></span><span class="sp"></span>
    ${sess.done ? `<button class="btn primary" data-act="liveCommit">${sess.kind === 'quali' ? 'Confirm classification →' : 'Close session & read report →'}</button>` : `<div class="row speed"><button class="btn sm ${st.running ? '' : 'on'}" data-tap="livePause" aria-label="Pause">${st.running ? '⏸' : '▶'}</button>${Object.entries({ normal: '1×', fast: '3×', vfast: '9×' }).map(([k, l]) => `<button class="btn sm ${sp === k ? 'on' : ''}" data-tap="liveSpeed" data-arg="${k}">${l}</button>`).join('')}<button class="btn sm ghost" data-act="liveSkip" title="Simulate to the end">⏭ Simulate</button></div>`}`;
  }
  document.getElementById('sclock').textContent = clockTxt(left);
  // garage state changed (car came in / went out) → refresh the setup panel so its buttons unlock/lock correctly
  const gk = sess.cars.filter((c) => c.isPlayer).map((c) => c.st + (c.busyUntil > sess.clock ? 'b' : '')).join(',') + (app.state.weekend.parcFerme ? 'pf' : '');
  const sw = document.getElementById('setupWrap');
  if (sw && sw._gk !== gk && !sw.contains(document.activeElement)) { sw._gk = gk; if (app._renderSetup) sw.innerHTML = app._renderSetup(); }
  document.getElementById('sinfo').textContent = `${wetLabel(sess.wet)} · track evolution +${Math.round((sess.clock / sess.len) * 100)}%`;
  // tower
  const rk = ranking(sess); const best = rk[0]?.best;
  const cut = sess.kind === 'quali' ? (sess.idx === 0 ? 15 : sess.idx === 1 ? 10 : 99) : 99;
  const sCell = (c, i) => { const cur = c.cur; const done = cur && c.st === 'track' ? (sess.clock - c.lapStart) / c.lapLen : null; const last = c.laps[c.laps.length - 1];
    let v = null, cls = '';
    if (cur && cur.kind === 'push' && done != null) { const cum = cur.s.slice(0, i + 1).reduce((a, b) => a + b, 0); if ((sess.clock - c.lapStart) >= cum) v = cur.s[i]; }
    else if (last) v = last.s[i];
    if (v != null) cls = v <= sess.bestS[i] + 1e-6 ? 'purple' : v <= c.bestS[i] + 1e-6 ? 'pb' : 'yl';
    return `<td class="mono tiny sc ${cls}">${v != null ? v.toFixed(1) : ''}</td>`; };
  const tw = document.getElementById('ltower');
  if (tw) tw.innerHTML = `<table><thead><tr><th>#</th><th></th><th>Driver</th><th>Best</th><th>Gap</th><th>S1</th><th>S2</th><th>S3</th><th>Tyre</th><th>Laps</th><th></th></tr></thead><tbody>${rk.map((c, i) => `<tr class="${c.isPlayer ? 'pl' : ''} ${app.tab.lsel === c.did ? 'sel' : ''} ${i === cut ? 'cutline' : ''}" data-tap="liveSel" tabindex="0" data-arg="${c.did}" style="cursor:pointer"><td class="pos">${i + 1}</td><td><span class="sw" style="background:${c.color}"></span></td><td class="nm">${esc(c.short)}</td><td class="mono small ${(c.best < 1e8) && c.best === best ? 'purple' : ''}">${(c.best < 1e8) ? fmt(c.best) : '—'}</td><td class="mono tiny muted">${i && (c.best < 1e8) ? '+' + (c.best - best).toFixed(3) : ''}</td>${[0, 1, 2].map((k) => sCell(c, k)).join('')}<td class="tiny">${tyreBadge(c.tyre)}<span class="muted"> ${setLaps(app.state, c)}L·${setGrip(app.state, c)}%</span></td><td class="tiny muted">${c.laps.length}</td><td class="tiny">${c.st === 'track' ? (c.kind === 'push' ? '<span class="good">●</span>' : '<span class="muted">○</span>') : c.st === 'garage' ? '<span class="muted">PIT</span>' : ''}${i >= cut ? ' <span class="bad">DZ</span>' : ''}</td></tr>`).join('')}</tbody></table>`;
  // controls
  const ctrl = document.getElementById('lctrl');
  const html = sess.cars.filter((c) => c.isPlayer).map((c) => carCtrl(sess, c)).join('') + `<div class="card tight tiny muted">Cars leave the garage on an out-lap, run the requested flying laps, then return. ${sess.kind === 'quali' ? 'Rubber builds up — later laps are faster, but traffic and track-limits deletions are real. A lap started before the flag counts.' : 'Programme learning is applied each time the car returns to the garage.'} Space = pause.</div>`;
  if (ctrl && ctrl._h !== html) { ctrl.innerHTML = html; ctrl._h = html; }
  const feed = document.getElementById('lfeed');
  if (feed) { const h = sess.log.slice(-40).reverse().map((l) => `<div><span class="l">${clockTxt(sess.len - l.t)}</span><span class="${l.sev}">${esc(l.text)}</span></div>`).join('') || '<div class="muted">Pit lane open. Waiting for cars…</div>'; if (feed._h !== h) { feed.innerHTML = h; feed._h = h; } }
}

// pick the exact set for the next run: one 'New' button + every used set with its remaining life
function setChooser(c, garage) {
  const all = (app.state.weekend.sets?.[c.did] || []).filter((x) => x.c === c.tyre); if (!all.length) return '<div class="tiny muted">No sets of this compound left.</div>';
  const fresh = all.filter((x) => x.laps === 0); const used = all.filter((x) => x.laps > 0).sort((a, b) => a.wear - b.wear);
  const cur = c.wantSet || c.setId; const curSet = all.find((x) => x.id === cur);
  const onNew = curSet ? curSet.laps === 0 : c.newSet;
  return `<div class="tiny muted" style="margin-top:.25rem">Set for the next run ${garage ? '' : '(choose in the garage)'}</div><div class="seg wrap">${fresh.length ? `<button class="btn sm ${onNew ? 'on' : ''}" data-act="liveSetId" data-arg="${c.did}:${fresh[0].id}" ${garage ? '' : 'disabled'}>🆕 New (${fresh.length} left)</button>` : ''}${used.map((u) => `<button class="btn sm ${cur === u.id ? 'on' : ''}" data-act="liveSetId" data-arg="${c.did}:${u.id}" ${garage ? '' : 'disabled'} title="${u.laps} laps done">Used · ${Math.round(100 - u.wear)}% life · ${u.laps}L</button>`).join('')}</div>`;
}
function carCtrl(sess, c) {
  const garage = c.st === 'garage'; const busy = garage && (c.busyUntil || 0) > sess.clock;
  const status = c.st === 'track' ? `${KIND[c.kind]}${c.boxReq ? ' · <b class="warn">boxing this lap</b>' : c.kind === 'push' || c.kind === 'cool' ? ` · ${c.pushLeft} flying lap(s) left` : ''}` : c.st === 'done' ? 'Session complete' : busy ? `${c.fails ? '🔧 Repairing failure' : 'Mechanics working'} (${clockTxt(c.busyUntil - sess.clock)})${c.busyUntil > sess.len ? ' — will miss the rest of the session' : ''}` : c.go ? 'Leaving garage…' : 'In the garage';
  const tyres = ['S', 'M', 'H', 'I', 'W'];
  const rk = ranking(sess); const pos = rk.indexOf(c) + 1; const lastT = c.laps.length ? c.laps[c.laps.length - 1].tyre : null;
  const sum = setsSummary(app.state, c.did);
  const inv = Object.entries(sum).map(([k, o]) => `<span class="pill" title="${o.used.map((u) => u.id + ': ' + Math.round(100 - u.wear) + '% grip, ' + u.laps + ' laps').join('\n')}">${tyreBadge(k)} ${o.fresh} new${o.used.length ? ' · ' + o.used.map((u) => Math.round(100 - u.wear) + '%').join('/') : ''}</span>`).join(' ');
  const lapsOpts = sess.kind === 'quali' ? [1, 2, 3] : [3, 6, 10];
  return `<div class="carpanel"><div class="hd"><span class="sw" style="background:${c.color}"></span><b>${esc(c.name)}</b><span class="pill">P${pos}</span><span class="pill">${(c.best < 1e8) ? fmt(c.best) : 'no time'}</span><span class="sp"></span><span class="tiny muted">${c.laps.length} laps${c.deleted ? ` · ${c.deleted} deleted` : ''}</span></div>
  <div class="small" style="margin:.2rem 0 .4rem">${status}</div>
  <div class="tiny" style="margin-bottom:.3rem">On car: ${tyreBadge(c.tyre)} grip ${setGrip(app.state, c)}%${lastT ? ` · last timed lap on ${tyreBadge(lastT)}` : ''}</div>
  <div class="tiny muted">Tyre ${garage ? '' : '(change in garage)'}</div><div class="seg">${tyres.map((x) => `<button class="btn sm ${c.tyre === x ? 'on' : ''}" data-act="liveTyre" data-arg="${c.did}:${x}" ${garage ? '' : 'disabled'} title="${COMPOUNDS[x].name}">${tyreBadge(x)}</button>`).join('')}</div>${setChooser(c, garage)}
  <div class="tiny muted" style="margin:.15rem 0 .3rem" title="Real F1 weekend allocation: 13 dry sets (here 8 Soft, 3 Medium, 2 Hard) + 4 Intermediate + 3 Wet per driver. Sets used in practice/quali stay available for the race at their remaining grip.">Sets ⓘ: ${inv || '—'}</div>
  ${sess.kind === 'practice' ? `<div class="tiny muted">Programme</div><div class="seg wrap">${Object.entries(PRACTICE_PROGRAMS).map(([k, p]) => `<button class="btn sm ${c.prog === k ? 'on' : ''}" data-act="liveProg" data-arg="${c.did}:${k}" title="${esc(p.desc)}" ${garage ? '' : 'disabled'}>${p.label}</button>`).join('')}</div>` : `<div class="tiny muted">Push level</div><div class="seg">${[['safe', 'Safe'], ['normal', 'Normal'], ['max', 'Maximum']].map(([k, l]) => `<button class="btn sm ${c.push === k ? 'on' : ''}" data-act="livePush" data-arg="${c.did}:${k}">${l}</button>`).join('')}</div>${sess.kind === 'quali' ? `<div class="tiny muted" title="Tow in qualifying: your driver spaces out behind the chosen car on the flying lap. Good tow = time gain on straights; too close = dirty air in corners. Works best on low-drag tracks.">Follow for tow ⓘ</div><select class="sm" data-change="liveFollow" data-arg="${c.did}"><option value="">No — run in clean air</option><option value="ahead" ${c.follow === 'ahead' ? 'selected' : ''}>Car ahead on track</option>${sess.cars.filter((o) => o !== c).map((o) => `<option value="${o.did}" ${c.follow === o.did ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>` : ''}`}
  <div class="tiny muted">Flying laps per run</div><div class="seg">${lapsOpts.map((n) => `<button class="btn sm ${c.plannedPush === n ? 'on' : ''}" data-act="liveLaps" data-arg="${c.did}:${n}">${n}</button>`).join('')}</div>
  <div class="row" style="margin-top:.5rem">${garage && !sess.flag ? `<button class="btn primary sm" data-act="liveOut" data-arg="${c.did}" ${c.go ? 'disabled' : ''}>▶ Send out</button>` : ''}${c.st === 'track' && c.kind !== 'in' ? `<button class="btn sm danger" data-act="liveBox" data-arg="${c.did}" ${c.boxReq ? 'disabled' : ''}>Box this lap</button>` : ''}</div></div>`;
}

on({
  livePause: () => { const st = app._liveSt; if (st) st.running = !st.running; drawLiveUI(L()); },
  liveSpeed: (k) => { updateSettings({ speed: k }); drawLiveUI(L()); },
  liveSel: (did) => { app.tab.lsel = did; drawLiveUI(L()); },
  liveOut: (did) => { if (sendOut(app.state, did)) toast('Car released from the garage.', 'info', 1400); drawLiveUI(L()); },
  liveBox: (did) => { boxThisLap(app.state, did); drawLiveUI(L()); },
  liveTyre: (arg) => { const [did, x] = arg.split(':'); setCarOpt(app.state, did, { tyre: x, wantSet: null }); drawLiveUI(L()); },
  liveSetId: (arg) => { const [did, id] = arg.split(':'); if (chooseSet(app.state, did, id)) toast('Set selected for the next run.', 'info', 1200); drawLiveUI(L()); },
  liveSet: (arg) => { const [did, x] = arg.split(':'); setCarOpt(app.state, did, { newSet: x === '1' }); drawLiveUI(L()); },
  liveProg: (arg) => { const [did, x] = arg.split(':'); setCarOpt(app.state, did, { prog: x }); drawLiveUI(L()); },
  liveFollow: (arg, el) => { setCarOpt(app.state, arg, { follow: el.value || null }); drawLiveUI(L()); },
  livePush: (arg) => { const [did, x] = arg.split(':'); setCarOpt(app.state, did, { push: x }); drawLiveUI(L()); },
  liveLaps: (arg) => { const [did, n] = arg.split(':'); setCarOpt(app.state, did, { plannedPush: +n }); drawLiveUI(L()); },
  liveSkip: async () => { const ok = await confirmBox('Simulate the rest of the session?', 'Your engineers will run sensible programmes for both cars until the flag.', 'Simulate'); if (!ok) return; simulateRest(app.state); persist(); drawLiveUI(L()); },
  liveCommit: () => { const k = L()?.kind; commitSession(app.state); stopLive(); persist(); render(); toast(k === 'quali' ? 'Classification confirmed.' : 'Practice report filed.', 'good'); },
});
