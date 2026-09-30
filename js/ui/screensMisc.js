// Championship, regulations, race history, season review, next-season planning, achievements, help, settings, saves.
import { app, screen, on, go, esc, persist, toast, render, modal, closeModal, confirmBox, setState, updateSettings, setHelp, applyTheme } from './app.js';
import { trackById } from '../data/tracks.js';
import { REGULATIONS, ACHIEVEMENTS, ATR_TABLE, COST_CAP } from '../data/content.js';
import { HELP } from '../data/help.js';
import * as C from '../engines/careerEngine.js';
import { POINTS } from '../engines/world.js';
import { save, load, meta, remove, exportJSON, importJSON, SLOTS, DEFAULT_SETTINGS } from '../state/persistence.js';
import { money } from '../sim/util.js';
import { lineChart, pill, tabs, bar } from './widgets.js';

const S = () => app.state;
setHelp((k) => { const h = HELP[k] || HELP.basics; modal(`<h2>${esc(h[0])}</h2><p>${esc(h[1])}</p><div class="row" style="justify-content:flex-end"><button class="btn" data-act="go" data-arg="help" onclick="">All help topics</button><button class="btn primary" data-act="modalClose">Close</button></div>`); });

screen('championship', {
  render() {
    const s = S(); const st = C.standings(s); const tab = app.tab.champ || 'cons';
    const rounds = s.results.filter((r) => r.season === s.season);
    const prog = (idFn, list, colorFn, n = 10) => list.slice(0, n).map((x) => { let acc = 0; const pts = [0, ...rounds.map((r) => { acc += r.rows.filter(idFn(x)).reduce((a, y) => a + y.pts, 0); return acc; })]; return { name: x.name.split(' ').pop(), color: colorFn(x), points: pts, width: x.id === s.player || s.teams[s.player].drivers.includes(x.id) ? 3 : 1.5 }; });
    const consChart = lineChart(prog((x) => (y) => y.teamId === x.id, st.teams, (x) => x.color), { xLabel: 'Round' });
    const drvChart = lineChart(prog((x) => (y) => y.did === x.id, st.drivers, (x) => s.teams[x.teamId]?.color || '#888', 8), { xLabel: 'Round' });
    return `<div class="pagehead"><h1>Championship ${s.year}</h1><span class="pill">After ${rounds.length}/${s.calendar.length} rounds</span></div>${tabs('champ', [['cons', "Constructors'"], ['drv', "Drivers'"], ['cal', 'Calendar']], tab)}
    ${tab === 'cons' ? `<div class="grid g2"><div class="card tw"><table><thead><tr><th>#</th><th>Team</th><th>Pts</th><th>Gap</th></tr></thead><tbody>${st.teams.map((t, i) => `<tr class="${t.id === s.player ? 'me' : ''}"><td>${i + 1}</td><td><span class="sw" style="background:${t.color}"></span>${esc(t.name)}</td><td><b>${t.pts}</b></td><td class="muted">${i ? '-' + (st.teams[0].pts - t.pts) : ''}</td></tr>`).join('')}</tbody></table></div><div class="card"><h3>Points progression</h3>${consChart}</div></div>` : ''}
    ${tab === 'drv' ? `<div class="grid g2"><div class="card tw"><table><thead><tr><th>#</th><th>Driver</th><th>Team</th><th>Pts</th></tr></thead><tbody>${st.drivers.map((d, i) => `<tr class="${s.teams[s.player].drivers.includes(d.id) ? 'me' : ''}"><td>${i + 1}</td><td>${esc(d.name)}</td><td><span class="sw" style="background:${s.teams[d.teamId]?.color || '#666'}"></span>${s.teams[d.teamId]?.abbr || '—'}</td><td><b>${d.pts}</b></td></tr>`).join('')}</tbody></table></div><div class="card"><h3>Title fight</h3>${drvChart}</div></div>` : ''}
    ${tab === 'cal' ? `<div class="card tw"><table><thead><tr><th>Rd</th><th>Circuit</th><th>Type</th><th>Winner</th><th>Our best</th></tr></thead><tbody>${s.calendar.map((id, i) => { const t = trackById(id); const r = rounds.find((x) => x.round === i); const w = r ? s.drivers[r.rows[0].did] : null; const ours = r ? r.rows.filter((x) => x.teamId === s.player).map((x) => (x.dnf ? 'DNF' : 'P' + x.pos)).join(', ') : ''; return `<tr class="${i === s.round ? 'me' : ''}"><td>${i + 1}</td><td>${esc(t.name)}</td><td class="small muted">${esc(t.archetype)}</td><td>${w ? esc(w.name) : ''}</td><td>${ours}</td></tr>`; }).join('')}</tbody></table></div>` : ''}`;
  },
});

screen('regulations', {
  render() {
    const s = S(); const reg = REGULATIONS.find((r) => r.id === s.regulation.next); const pos = C.teamPos(s, s.player);
    return `<div class="pagehead"><h1>Regulations</h1></div><div class="grid g2"><div class="card"><h3>Current sporting rules</h3><ul class="small"><li>Points: ${POINTS.join(', ')} for P1–P10.</li><li>Qualifying: Q1 (20 → 15), Q2 (15 → 10), Q3 top-10 shoot-out.</li><li>Dry races: at least two different dry compounds, or +20s.</li><li>Power units: ${Math.max(2, Math.ceil(s.calendar.length / 4))} per driver per season; each extra unit = 5-place grid penalty.</li><li>Cost cap: ${money(COST_CAP)} (salaries of drivers & facility capex excluded).</li><li>Aero testing allowance: your multiplier at P${pos} is ×${ATR_TABLE[Math.min(9, pos - 1)].toFixed(2)} (P1 ×${ATR_TABLE[0]}, P10 ×${ATR_TABLE[9]}).</li></ul></div>
    <div class="card"><h3>Next season</h3>${reg ? `<div class="alert warn"><b>${esc(reg.name)}</b><br>${esc(reg.desc)}</div><p class="small">Affected: ${reg.attrs.join(', ')} · regression ${Math.round(reg.regress * 100)}% (reduced by next-year focus).</p><button class="btn" data-act="goNext">Adjust next-year resource split →</button>` : `<p class="muted">No change confirmed yet. Announcements usually come mid-season (round ${Math.floor(s.calendar.length / 2) + 1}).</p><p class="small muted">Regulation foresight: investing some resources in next year early is a hedge — whatever changes, a slice of that work carries over.</p>`}</div></div>`;
  },
});
on({ goNext: () => { app.tab.car = 'next'; go('car'); } });

screen('history', {
  render() {
    const s = S(); const list = [...s.results].reverse();
    return `<div class="pagehead"><h1>Race history</h1></div>${list.length ? `<div class="card tw"><table><thead><tr><th>Season</th><th>Rd</th><th>Circuit</th><th>Winner</th>${s.teams[s.player].drivers.map(() => '<th>Ours</th>').join('')}<th>Strategies (ours)</th><th></th></tr></thead><tbody>${list.map((r) => { const ours = r.rows.filter((x) => x.teamId === s.player); return `<tr><td>${r.season}</td><td>${r.round + 1}</td><td>${esc(trackById(r.trackId).name)}${r.wet ? ' 🌧️' : ''}</td><td>${esc(s.drivers[r.rows[0].did]?.name || '')}</td>${ours.map((x) => `<td>${x.dnf ? '<span class="bad">DNF</span>' : 'P' + x.pos} <span class="muted tiny">(from P${x.grid})</span></td>`).join('')}<td class="small">${ours.map((x) => x.stints.join('-')).join(' / ')}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">No races completed yet.</div>'}`;
  },
});

screen('review', {
  render() {
    const s = S(); const r = s.review || s.history.seasons[s.history.seasons.length - 1];
    if (!r) return '<div class="empty">No season review available.</div>';
    const reg = REGULATIONS.find((x) => x.id === r.reg);
    return `<div class="pagehead"><h1>Season ${r.year} review</h1><span class="pill ${r.pos <= s.board.target ? 'good' : 'bad'}">P${r.pos} Constructors</span></div>
    <div class="grid g3"><div class="card"><h3>Sporting</h3><div class="small">Points: <b>${r.points}</b><br>${r.drivers.map((d) => `${esc(d.name)}: P${d.pos} (${d.pts} pts)`).join('<br>')}<br><br>Drivers' champion: <b>${esc(r.champion.name)}</b> (${esc(r.champion.team)})<br>Constructors' champion: <b>${esc(r.consChamp.name)}</b></div></div>
    <div class="card"><h3>Financial & commercial</h3><div class="small">Prize money: ${money(r.prize)}<br>Cash: <b class="${r.cash < 0 ? 'bad' : ''}">${money(r.cash)}</b><br>Cost-cap spend: ${money(r.spent)} / ${money(COST_CAP)}${r.capPen ? `<br><span class="bad">Cost-cap penalty: −${r.capPen} pts next season</span>` : ''}</div></div>
    <div class="card"><h3>Board objectives</h3>${r.objectives.map((o) => `<div class="row small"><span>${esc(o.text)}</span><span class="sp"></span>${pill(o.met ? 'Met' : 'Missed', o.met ? 'good' : 'bad')}</div>`).join('')}<div class="small" style="margin-top:.5rem">Board confidence: <b>${Math.round(r.board)}%</b></div></div></div>
    <div class="grid g2" style="margin-top:1rem"><div class="card"><h3>Final table</h3>${r.table.map((t, i) => `<div class="row small"><span style="width:24px">${i + 1}</span><span class="sw" style="background:${t.color}"></span>${esc(t.name)}<span class="sp"></span><b>${t.pts}</b></div>`).join('')}</div>
    <div class="card"><h3>Looking ahead</h3>${reg ? `<div class="alert warn">New regulations: <b>${esc(reg.name)}</b>. ${esc(reg.desc)}</div>` : '<p class="small muted">Stable regulations next year.</p>'}<p class="small">Next: renew or replace drivers with expiring contracts, check staff, then start the new season. Unfinished development projects do not carry over to the new chassis.</p>
    ${s.gameOver ? `<button class="btn danger" data-act="go" data-arg="gameover">Continue</button>` : `<button class="btn primary" data-act="go" data-arg="planning">Next-season planning →</button>`}</div></div>`;
  },
});
screen('planning', {
  render() {
    const s = S(); const t = s.teams[s.player];
    if (s.phase !== 'review') return '<div class="empty">Planning is available at the end of a season.</div>';
    const exp = t.drivers.map((id) => s.drivers[id]).filter((d) => d.contract.years <= 1 && !d._renewed);
    return `<div class="pagehead"><h1>Next-season planning</h1></div><div class="grid g2">
    <div class="card"><h3>Driver contracts</h3>${exp.length ? exp.map((d) => `<div class="row small" style="margin:.4rem 0"><b>${esc(d.name)}</b> <span class="muted">age ${d.age}, morale ${Math.round(d.morale)}</span><span class="sp"></span><button class="btn sm" data-act="renew" data-arg="${d.id}:1">1 yr</button><button class="btn sm" data-act="renew" data-arg="${d.id}:2">2 yrs</button></div>`).join('') + '<p class="tiny muted">Unrenewed drivers leave; a replacement will be drafted in. You can also sign someone from the market.</p>' : '<p class="small good">Both drivers are under contract.</p>'}<button class="btn sm" data-act="go" data-arg="drivers">Open driver market</button></div>
    <div class="card"><h3>Organisation</h3><p class="small">Review departments, hire from the market and plan facility upgrades before the season starts. Fatigue partially recovers over the winter.</p><div class="row"><button class="btn sm" data-act="go" data-arg="staff">Staff</button><button class="btn sm" data-act="go" data-arg="facilities">Facilities</button><button class="btn sm" data-act="goNext">Next-year focus (${Math.round((t.nextYearFocus || 0) * 100)}%)</button></div></div></div>
    <div class="row" style="margin-top:1rem"><span class="sp"></span><button class="btn primary" data-act="nextSeason">Start season ${s.season + 1} →</button></div>`;
  },
});
on({ nextSeason: async () => { const ok = await confirmBox('Start the new season?', 'Contracts, regulations, car carry-over and the driver market will be resolved.', 'Start season'); if (!ok) return; C.startNextSeason(S()); persist('New season started'); go('hq'); } });

screen('achievements', {
  render() {
    const s = S(); const got = s.achievements || {};
    return `<div class="pagehead"><h1>Achievements</h1><span class="pill">${Object.keys(got).length}/${ACHIEVEMENTS.length}</span></div><div class="grid g4">${ACHIEVEMENTS.map((a) => `<div class="card" style="${got[a.id] ? 'border-color:var(--good)' : 'opacity:.55'}"><b>${got[a.id] ? '⭐' : '🔒'} ${esc(a.name)}</b><div class="small muted">${esc(a.desc)}</div>${got[a.id] ? `<div class="tiny good">Season ${got[a.id].season}</div>` : ''}</div>`).join('')}</div>`;
  },
});

screen('help', {
  needsState: false,
  bare: false,
  render() {
    const body = `<div class="pagehead"><h1>How to play</h1>${app.state ? '' : '<button class="btn" data-act="go" data-arg="menu">← Menu</button>'}</div><div class="grid g2">${Object.entries(HELP).map(([k, [h, p]]) => `<div class="card" id="h_${k}"><h3>${esc(h)}</h3><p class="small">${esc(p)}</p></div>`).join('')}</div>
    <div class="card" style="margin-top:1rem"><h3>Keyboard</h3><p class="small">Space: pause/resume the race · Esc: close dialogs.</p></div>`;
    return app.state ? body : `<main style="max-width:1100px;margin:0 auto;padding:1rem">${body}</main>`;
  },
});

screen('settings', {
  needsState: false,
  render() {
    const st = app.settings;
    const body = `<div class="pagehead"><h1>Settings</h1>${app.state ? '' : '<button class="btn" data-act="go" data-arg="menu">← Menu</button>'}</div><div class="grid g2">
    <div class="card"><h3>Race</h3><label>Default speed</label><div class="seg">${[['normal', 'Normal'], ['fast', 'Fast'], ['vfast', 'Very fast']].map(([k, l]) => `<button class="btn sm ${st.speed === k ? 'on' : ''}" data-act="set" data-arg="speed:${k}">${l}</button>`).join('')}</div>
      <label style="margin-top:.6rem"><input type="checkbox" ${st.autoPause ? 'checked' : ''} data-change="setChk" data-arg="autoPause"> Auto-pause on critical events</label>
      <div class="grid g2" style="gap:.2rem;margin-top:.3rem">${Object.entries({ sc: 'Safety car / VSC', rain: 'Rain', dry: 'Drying track', cliff: 'Tyre cliff', failure: 'Failures', damage: 'Damage', orders: 'Team orders', fuel: 'Fuel', plan: 'Race-day strategy check' }).map(([k, l]) => `<label class="small" style="margin:0"><input type="checkbox" ${st.pauseOn?.[k] !== false ? 'checked' : ''} data-change="setPause" data-arg="${k}"> ${l}</label>`).join('')}</div></div>
    <div class="card"><h3>Accessibility & display</h3><label>Text size: ${Math.round((st.textScale || 1) * 100)}%</label><input type="range" min="0.85" max="1.35" step="0.05" value="${st.textScale || 1}" data-change="setRange" data-arg="textScale">
      <label><input type="checkbox" ${st.highContrast ? 'checked' : ''} data-change="setChk" data-arg="highContrast"> High contrast</label>
      <label><input type="checkbox" ${st.showTutorial ? 'checked' : ''} data-change="setChk" data-arg="showTutorial"> Show tutorial for new careers</label>
      <label><input type="checkbox" ${st.autosave ? 'checked' : ''} data-change="setChk" data-arg="autosave"> Autosave</label>
      <label><input type="checkbox" ${st.debug ? 'checked' : ''} data-change="setChk" data-arg="debug"> Debug mode (error toasts, state inspector)</label>
      <button class="btn sm" data-act="resetSettings" style="margin-top:.5rem">Reset settings</button></div></div>
    ${st.debug && app.state ? `<div class="card" style="margin-top:1rem"><h3>Debug</h3><p class="small mono">seed ${app.state.seed} · rng ${app.state.rngS} · version ${app.state.version} · validation: ${esc((window.__validate?.(app.state) || []).join('; ') || 'OK')}</p><div class="row"><button class="btn sm" data-act="dbgCash">+$20M cash</button><button class="btn sm" data-act="dbgDump">Dump state to console</button></div></div>` : ''}`;
    return app.state ? body : `<main style="max-width:1100px;margin:0 auto;padding:1rem">${body}</main>`;
  },
});
on({
  set: (arg) => { const [k, v] = arg.split(':'); updateSettings({ [k]: v }); render(); },
  setChk: (k, el) => { updateSettings({ [k]: el.checked }); render(); },
  setRange: (k, el) => { updateSettings({ [k]: +el.value }); render(); },
  setPause: (k, el) => { updateSettings({ pauseOn: { ...app.settings.pauseOn, [k]: el.checked } }); },
  resetSettings: () => { updateSettings({ ...DEFAULT_SETTINGS }); render(); },
  dbgCash: () => { C.ledger(S(), 'Debug', 20e6, 'Debug cash', false); persist(); render(); },
  dbgDump: () => { console.log(S()); toast('State logged to console'); },
});

screen('saves', {
  needsState: false,
  render() {
    const s = app.state;
    const rows = SLOTS.map((k) => { const m = meta(k); return `<div class="card"><div class="row"><b>${k === 'auto' ? 'Autosave' : 'Slot ' + k.slice(-1)}</b><span class="sp"></span>${m ? (m.corrupt ? pill('Corrupt', 'bad') : pill(m.mode === 'quick' ? 'Quick race' : `S${m.season} R${m.round + 1}/${m.total}`)) : pill('Empty')}</div>${m && !m.corrupt ? `<div class="small"><span class="sw" style="background:${m.color}"></span>${esc(m.team)} · ${m.diff} · ${new Date(m.at).toLocaleString()}</div>` : ''}
      <div class="row" style="margin-top:.5rem">${s && k !== 'auto' && !s.ironman ? `<button class="btn sm primary" data-act="saveSlot" data-arg="${k}">Save here</button>` : ''}${m ? `<button class="btn sm" data-act="loadSlot" data-arg="${k}">Load</button><button class="btn sm danger" data-act="delSlot" data-arg="${k}">Delete</button>` : ''}</div></div>`; }).join('');
    const body = `<div class="pagehead"><h1>Save / Load</h1>${s ? '' : '<button class="btn" data-act="go" data-arg="menu">← Menu</button>'}</div>${s?.ironman ? '<div class="alert warn">Ironman career: only the autosave is used.</div>' : ''}<div class="grid g2">${rows}</div>
    <div class="card" style="margin-top:1rem"><h3>Export / import</h3><div class="row">${s ? '<button class="btn" data-act="exportSave">Export current game (.json)</button>' : ''}<label class="btn" style="margin:0">Import .json<input type="file" accept="application/json,.json" data-change="importSave" style="display:none"></label></div><p class="small muted">Saves live in this browser's localStorage. Export to move between devices or keep backups.</p></div>`;
    return s ? body : `<main style="max-width:1100px;margin:0 auto;padding:1rem">${body}</main>`;
  },
});
on({
  saveSlot: (k) => { const r = save(S(), k); toast(r.ok ? 'Saved.' : r.msg, r.ok ? 'good' : 'bad'); render(); },
  loadSlot: async (k) => { if (app.state) { const ok = await confirmBox('Load game?', 'Unsaved progress in the current game will be lost.', 'Load'); if (!ok) return; } const r = load(k); if (!r.ok) return toast('Could not load save.', 'bad'); setState(r.state); toast(r.fromBackup ? 'Loaded from backup.' : 'Loaded.', r.fromBackup ? 'warn' : 'good'); go(r.state.mode === 'quick' ? 'weekend' : r.state.phase === 'review' ? 'review' : 'hq'); },
  delSlot: async (k) => { const ok = await confirmBox('Delete save?', 'This cannot be undone.', 'Delete'); if (!ok) return; remove(k); render(); },
  exportSave: () => { const blob = new Blob([exportJSON(S())], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `team-principal-${S().teams[S().player].abbr}-S${S().season}R${S().round + 1}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); },
  importSave: (a, el) => { const f = el.files?.[0]; if (!f) return; f.text().then((txt) => { try { const st = importJSON(txt); setState(st); save(st, 'auto'); toast('Imported.', 'good'); go(st.mode === 'quick' ? 'weekend' : 'hq'); } catch (e) { toast('Import failed: ' + e.message, 'bad', 6000); } }); },
});
