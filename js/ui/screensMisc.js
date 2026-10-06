// Championship, regulations, race history, season review, next-season planning, achievements, help, settings, saves.
import { app, screen, on, go, esc, persist, toast, render, modal, closeModal, confirmBox, setState, updateSettings, setHelp, applyTheme } from './app.js';
import { trackById } from '../data/tracks.js';
import { REGULATIONS, ACHIEVEMENTS, ATR_TABLE, COST_CAP } from '../data/content.js';
import { HELP } from '../data/help.js';
import { GUIDE, GUIDE_ORDER } from '../data/guide.js';
import * as C from '../engines/careerEngine.js';
import { POINTS } from '../engines/world.js';
import { save, load, meta, remove, exportJSON, importJSON, SLOTS, DEFAULT_SETTINGS } from '../state/persistence.js';
import { money } from '../sim/util.js';
import { lineChart, pill, tabs, bar } from './widgets.js';
import { weekDate, fmtDate, ensureSchedule } from '../engines/calendarEngine.js';
import { yearStrip, yearPlanList } from './calendarUi.js';

const S = () => app.state;
setHelp((k) => { const h = HELP[k] || HELP.basics; modal(`<h2>${esc(h[0])}</h2><p>${esc(h[1])}</p><div class="row" style="justify-content:flex-end"><button class="btn" data-act="go" data-arg="help" onclick="">All help topics</button><button class="btn primary" data-act="modalClose">Close</button></div>`); });

screen('championship', {
  render() {
    const s = S(); const st = C.standings(s); const tab = app.tab.champ || 'cons';
    const rounds = s.results.filter((r) => r.season === s.season);
    const prog = (idFn, list, colorFn, n = 10) => list.slice(0, n).map((x) => { let acc = 0; const pts = [0, ...rounds.map((r) => { acc += r.rows.filter(idFn(x)).reduce((a, y) => a + y.pts, 0); return acc; })]; return { name: x.name.split(' ').pop(), color: colorFn(x), points: pts, width: x.id === s.player || s.teams[s.player].drivers.includes(x.id) ? 3 : 1.5 }; });
    const consChart = lineChart(prog((x) => (y) => y.teamId === x.id, st.teams, (x) => x.color), { xLabel: 'Round' });
    const drvChart = lineChart(prog((x) => (y) => y.did === x.id, st.drivers, (x) => s.teams[x.teamId]?.color || '#888', 8), { xLabel: 'Round' });
    return `<div class="pagehead"><h1>Championship ${s.year}</h1><span class="pill">After ${rounds.length}/${s.calendar.length} rounds</span></div>${tabs('champ', [['cons', "Constructors'"], ['drv', "Drivers'"], ['cal', 'Calendar'], ['past', 'Past seasons']], tab)}
    ${tab === 'cons' ? `<div class="grid g2"><div class="card tw"><table><thead><tr><th>#</th><th>Team</th><th>Pts</th><th>Gap</th></tr></thead><tbody>${st.teams.map((t, i) => `<tr class="${t.id === s.player ? 'me' : ''}"><td>${i + 1}</td><td><span class="sw" style="background:${t.color}"></span>${esc(t.name)}</td><td><b>${t.pts}</b></td><td class="muted">${i ? '-' + (st.teams[0].pts - t.pts) : ''}</td></tr>`).join('')}</tbody></table></div><div class="card"><h3>Points progression</h3>${consChart}</div></div>` : ''}
    ${tab === 'drv' ? `<div class="grid g2"><div class="card tw"><table><thead><tr><th>#</th><th>Driver</th><th>Team</th><th>Pts</th></tr></thead><tbody>${st.drivers.map((d, i) => `<tr class="${s.teams[s.player].drivers.includes(d.id) ? 'me' : ''}"><td>${i + 1}</td><td>${esc(d.name)}</td><td><span class="sw" style="background:${s.teams[d.teamId]?.color || '#666'}"></span>${s.teams[d.teamId]?.abbr || '—'}</td><td><b>${d.pts}</b></td></tr>`).join('')}</tbody></table></div><div class="card"><h3>Title fight</h3>${drvChart}</div></div>` : ''}
    ${tab === 'past' ? pastSeasons(s) : ''}
    ${tab === 'cal' ? (ensureSchedule(s), `<div class="card" style="margin-bottom:.8rem"><h3>Year plan ${s.year}</h3>${yearStrip(s)}${yearPlanList(s)}</div>`) : ''}
    ${tab === 'cal' ? `<div class="card tw"><table><thead><tr><th>Rd</th><th>Date</th><th>Circuit</th><th>Type</th><th>Winner</th><th>Our best</th></tr></thead><tbody>${s.calendar.map((id, i) => { const t = trackById(id); const r = rounds.find((x) => x.round === i); const w = r ? s.drivers[r.rows[0].did] : null; const ours = r ? r.rows.filter((x) => x.teamId === s.player).map((x) => (x.dnf ? 'DNF' : 'P' + x.pos)).join(', ') : ''; return `<tr class="${i === s.round ? 'me' : ''}"><td>${i + 1}</td><td class="small">${s.schedule ? fmtDate(weekDate(s.year, s.schedule.weeks[i])) : ''}</td><td>${esc(t.name)}</td><td class="small muted">${esc(t.archetype)}</td><td>${w ? esc(w.name) : ''}</td><td>${ours}</td></tr>`; }).join('')}</tbody></table></div>` : ''}`;
  },
});

export function pastSeasons(s) {
  const H = s.history?.seasons || [];
  if (!H.length) return '<div class="empty">No completed seasons yet. After each year closes, its full data appears here.</div>';
  return `<div class="grid g2">${[...H].reverse().map((r) => { const res = s.results.filter((x) => x.season === r.season); const mine = res.flatMap((x) => x.rows.filter((y) => y.teamId === s.player).map((y) => ({ ...y, trackId: x.trackId }))); const fin = mine.filter((x) => !x.dnf);
    const byTrack = {}; mine.forEach((x) => { (byTrack[x.trackId] ||= []).push(x.dnf ? 20 : x.pos); });
    const tr = Object.entries(byTrack).map(([id, a]) => [id, a.reduce((p, q) => p + q, 0) / a.length]).sort((a, b) => a[1] - b[1]);
    return `<div class="card"><div class="row"><h3 style="margin:0">Season ${r.season} · ${r.year}</h3><span class="sp"></span>${pill('P' + r.pos, r.pos <= (r.target || 99) ? 'good' : '')}</div>
    <dl class="kv small"><dt>Points</dt><dd>${r.points}</dd><dt>Drivers</dt><dd>${r.drivers.map((d) => `${esc(d.name)} P${d.pos} (${d.pts})`).join(' · ')}</dd><dt>Champions</dt><dd>${esc(r.champion.name || '')} · ${esc(r.consChamp.name)}</dd><dt>Prize / cash at end</dt><dd>${money(r.prize)} / ${money(r.cash)}</dd><dt>Cost cap</dt><dd>${money(r.spent)} of ${money(COST_CAP)}</dd><dt>Board</dt><dd>${Math.round(r.board)}% · objectives ${r.objectives.filter((o) => o.met).length}/${r.objectives.length} met</dd>
    ${fin.length ? `<dt>Avg finish / grid</dt><dd>${(fin.reduce((a, x) => a + x.pos, 0) / fin.length).toFixed(1)} / ${(mine.reduce((a, x) => a + x.grid, 0) / mine.length).toFixed(1)}</dd><dt>DNFs</dt><dd>${mine.length - fin.length}</dd>` : ''}
    ${tr.length ? `<dt>Best tracks</dt><dd>${tr.slice(0, 3).map(([id]) => esc(trackById(id).name)).join(', ')}</dd><dt>Worst tracks</dt><dd>${tr.slice(-3).reverse().map(([id]) => esc(trackById(id).name)).join(', ')}</dd>` : ''}</dl></div>`; }).join('')}</div>`;
}
// Suggestions for the new year from last year's data
export function lastYearAdvice(s) {
  const r = (s.history?.seasons || []).slice(-1)[0]; if (!r) return '';
  const res = s.results.filter((x) => x.season === r.season); const mine = res.flatMap((x) => x.rows.filter((y) => y.teamId === s.player));
  const fin = mine.filter((x) => !x.dnf); const mech = mine.filter((x) => x.dnf && /failure|fault|power|gearbox|hydraul|engine/i.test(x.dnf)).length;
  const crash = mine.filter((x) => x.dnf && /crash|collision/i.test(x.dnf)).length;
  const avgG = mine.length ? mine.reduce((a, x) => a + x.grid, 0) / mine.length : 0; const avgF = fin.length ? fin.reduce((a, x) => a + x.pos, 0) / fin.length : 0;
  const tips = [];
  if (mech >= 2) tips.push(['warn', `${mech} mechanical DNFs — invest in reliability projects and the Factory, keep manufacturing fatigue low.`]);
  if (crash >= 2) tips.push(['warn', `${crash} crashes — consider calmer drivers or the Driver-coaching department.`]);
  if (avgG && avgF && avgG - avgF > 1.5) tips.push(['info', `Race pace beats qualifying (avg grid ${avgG.toFixed(1)} → finish ${avgF.toFixed(1)}): aero/low-drag and quali-sim practice will pay off.`]);
  if (avgG && avgF && avgF - avgG > 1.5) tips.push(['info', `You lose places in races (grid ${avgG.toFixed(1)} → ${avgF.toFixed(1)}): focus on tyre management, pit crew and strategy staff.`]);
  if (r.cash < 10e6) tips.push(['bad', `Finished the year with only ${money(r.cash)} — sign sponsors early and avoid long crunch periods.`]);
  if (r.spent > COST_CAP * 0.95) tips.push(['warn', 'Cost cap nearly maxed — prioritise fewer, bigger projects.']);
  if (r.pos > (s.board.target || 10)) tips.push(['bad', `Finished P${r.pos} vs board target — the board will be less patient this year.`]);
  if (!tips.length) tips.push(['good', 'Solid year. Keep development running from the first development week.']);
  return `<div class="card"><h3>Last year's data (${r.year}) → suggestions</h3><div class="small" style="margin-bottom:.4rem">P${r.pos} · ${r.points} pts · avg grid ${avgG ? avgG.toFixed(1) : '—'} · avg finish ${avgF ? avgF.toFixed(1) : '—'} · DNFs ${mine.length - fin.length}</div>${tips.map(([k, t]) => `<div class="alert ${k} small">${esc(t)}</div>`).join('')}<button class="btn sm" data-act="pastLink">Full past-season data →</button></div>`;
}
on({ pastLink: () => { app.tab.champ = 'past'; go('championship'); } });
screen('regulations', {
  render() {
    const s = S(); const reg = REGULATIONS.find((r) => r.id === s.regulation.next); const pos = C.teamPos(s, s.player);
    return `<div class="pagehead"><h1>Regulations</h1></div><div class="grid g2"><div class="card"><h3>Current sporting rules</h3><ul class="small"><li>Points: ${POINTS.join(', ')} for P1–P10.</li><li>Qualifying: Q1 (20 → 15), Q2 (15 → 10), Q3 top-10 shoot-out.</li><li>Dry races: at least two different dry compounds, or +20s.</li><li>Power units (2026 rules, scaled to your season): 4 ICE, 4 turbo, 4 exhaust, 3 MGU-K, 3 battery, 3 control electronics per driver. No MGU-H. First extra part of a type = 10 grid places, then 5. Gearbox: no season limit, but a change in parc fermé = pit-lane start.</li><li>Cost cap: ${money(COST_CAP)} (salaries of drivers & facility capex excluded).</li><li>Aero testing allowance: your multiplier at P${pos} is ×${ATR_TABLE[Math.min(9, pos - 1)].toFixed(2)} (P1 ×${ATR_TABLE[0]}, P10 ×${ATR_TABLE[9]}).</li></ul></div>
    <div class="card"><h3>Next season</h3>${reg ? `<div class="alert warn"><b>${esc(reg.name)}</b><br>${esc(reg.desc)}</div><p class="small">Affected: ${reg.attrs.join(', ')} · regression ${Math.round(reg.regress * 100)}% (reduced by next-year focus).</p><button class="btn" data-act="goNext">Adjust next-year resource split →</button>` : `<p class="muted">No change confirmed yet. Announcements usually come mid-season (round ${Math.floor(s.calendar.length / 2) + 1}).</p><p class="small muted">Regulation foresight: investing some resources in next year early is a hedge — whatever changes, a slice of that work carries over.</p>`}</div></div>`;
  },
});
on({ goNext: () => { app.tab.car = 'next'; go('car'); } });

screen('history', {
  render() {
    const s = S(); const me = s.player; const seasons = [...new Set(s.results.map((r) => r.season))].sort((a, b) => b - a);
    const f = app.tab.hseason ?? 'all';
    const list = [...s.results].filter((r) => f === 'all' || r.season === +f).reverse();
    const ours = (r) => r.rows.filter((x) => x.teamId === me);
    const dn = (id) => s.drivers[id]?.name || '—';
    const all = list.flatMap(ours);
    const fin = all.filter((x) => !x.dnf);
    const stat = (l, v) => `<div class="card stat"><b>${v}</b><span>${l}</span></div>`;
    const summary = `<div class="grid g4" style="margin-bottom:1rem">${stat('Races (our starts)', all.length)}${stat('Points', all.reduce((a, x) => a + (x.pts || 0), 0))}${stat('Wins / podiums', `${fin.filter((x) => x.pos === 1).length} / ${fin.filter((x) => x.pos <= 3).length}`)}${stat('Avg finish · avg grid', `${fin.length ? (fin.reduce((a, x) => a + x.pos, 0) / fin.length).toFixed(1) : '—'} · ${all.length ? (all.reduce((a, x) => a + x.grid, 0) / all.length).toFixed(1) : '—'}`)}${stat('DNFs (mechanical)', `${all.filter((x) => x.dnf).length} (${all.filter((x) => x.dnf && /failure|fault|power|gearbox|hydraul|engine/i.test(x.dnf)).length})`)}${stat('Positions gained', all.filter((x) => !x.dnf).reduce((a, x) => a + (x.grid - x.pos), 0))}${stat('Top-10 finishes', fin.filter((x) => x.pos <= 10).length)}${stat('Wet races', list.filter((r) => r.wet).length)}</div>`;
    const filt = `<div class="row" style="margin-bottom:.6rem"><span class="small muted">Season:</span><button class="btn sm ${f === 'all' ? 'on' : ''}" data-act="hSeason" data-arg="all">All</button>${seasons.map((x) => `<button class="btn sm ${String(f) === String(x) ? 'on' : ''}" data-act="hSeason" data-arg="${x}">S${x}</button>`).join('')}</div>`;
    const rows = list.map((r) => { const o = ours(r); const idx = s.results.indexOf(r); return `<tr data-act="hDetail" data-arg="${idx}" style="cursor:pointer"><td>S${r.season}${r.year ? ' · ' + r.year : ''}</td><td>${r.round + 1}</td><td>${esc(trackById(r.trackId).name)}${r.wet ? ' 🌧️' : ''}${r.sc ? ` <span class="pill warn">${r.sc} SC</span>` : ''}</td><td>${esc(dn(r.rows[0].did))}</td><td>${r.pole ? esc(dn(r.pole)) : '—'}</td>${o.map((x) => `<td>${x.dnf ? '<span class="bad">DNF</span>' : 'P' + x.pos} <span class="muted tiny">(P${x.grid})</span>${x.pts ? ` <b class="good tiny">+${x.pts}</b>` : ''}</td>`).join('')}<td class="small">${o.map((x) => x.stints.join('-')).join(' / ')}</td><td><button class="btn sm">Details</button></td></tr>`; }).join('');
    return `<div class="pagehead"><h1>Race history</h1></div>${list.length ? filt + summary + `<div class="card tw"><table><thead><tr><th>Season</th><th>Rd</th><th>Circuit</th><th>Winner</th><th>Pole</th>${s.teams[me].drivers.map(() => '<th>Ours</th>').join('')}<th>Strategies (ours)</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><p class="tiny muted">Click any race for the full classification, pit stops, incidents and conditions.</p>` : '<div class="empty">No races completed yet.</div>'}`;
  },
});
on({
  hSeason: (k) => { app.tab.hseason = k; render(); },
  hDetail: (i) => {
    const s = S(); const r = s.results[+i]; if (!r) return; const t = trackById(r.trackId); const dn = (id) => s.drivers[id]?.name || id;
    const tm = (id) => s.teams[s.drivers[id]?.teamId];
    modal(`<h2>${esc(t.name)} — S${r.season} R${r.round + 1}</h2>
    <div class="row small" style="gap:.5rem;flex-wrap:wrap">${r.laps ? `<span class="pill">${r.laps} laps</span>` : ''}${r.air != null ? `<span class="pill">Air ${r.air}° · Track ${r.track}°</span>` : ''}${r.maxWet != null ? `<span class="pill ${r.maxWet > 15 ? 'info' : ''}">Max wetness ${r.maxWet}%</span>` : ''}<span class="pill warn">${r.sc || 0} SC · ${r.vsc || 0} VSC</span>${r.overtakes != null ? `<span class="pill">${r.overtakes} overtakes</span>` : ''}${r.pole ? `<span class="pill">Pole: ${esc(dn(r.pole))}</span>` : ''}${r.fastest ? `<span class="pill" style="border-color:#a855f7">Fastest lap: ${esc(dn(r.fastest.did))} ${fmtT(r.fastest.t)}</span>` : ''}</div>
    <div class="tw" style="max-height:52vh;overflow:auto;margin-top:.6rem"><table class="tbl small"><thead><tr><th>Pos</th><th>Driver</th><th>Grid</th><th>+/-</th><th>Gap</th><th>Best</th><th>Strategy & stops</th><th>Pts</th><th>Incidents</th></tr></thead><tbody>${r.rows.map((x) => `<tr class="${x.teamId === s.player ? 'pl' : ''}"><td>${x.dnf ? 'DNF' : x.pos}</td><td><span class="sw" style="background:${tm(x.did)?.color || '#888'}"></span>${esc(dn(x.did))}</td><td>${x.grid}</td><td class="${x.grid - x.pos > 0 ? 'good' : x.grid - x.pos < 0 ? 'bad' : ''}">${x.dnf ? '' : (x.grid - x.pos > 0 ? '+' : '') + (x.grid - x.pos)}</td><td class="mono">${x.dnf ? `<span class="bad">${esc(x.dnf)}</span>` : esc(x.gap || '')}</td><td class="mono">${x.best ? fmtT(x.best) : '—'}</td><td>${x.stints.join('-')}${x.stops?.length ? ` <span class="tiny muted">(${x.stops.map((st) => 'L' + st.lap + '→' + st.to + ' ' + st.total + 's').join(', ')})</span>` : ''}</td><td>${x.pts || ''}</td><td class="tiny">${(x.inc || []).map(esc).join('; ')}</td></tr>`).join('')}</tbody></table></div>
    ${r.log?.length ? `<details style="margin-top:.5rem"><summary class="small"><b>Race control log</b></summary><div class="tiny" style="max-height:25vh;overflow:auto">${r.log.map((l) => `<div>${esc(l)}</div>`).join('')}</div></details>` : '<p class="tiny muted">Detailed data (stops, incidents, conditions) is recorded for races from v3.7 onwards.</p>'}
    <div class="row" style="justify-content:flex-end;margin-top:.6rem"><button class="btn primary" data-act="modalClose">Close</button></div>`, { wide: true });
  },
});
const fmtT = (x) => { const m = Math.floor(x / 60); return `${m}:${(x - m * 60).toFixed(3).padStart(6, '0')}`; };

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
    return `<div class="pagehead"><h1>Next-season planning</h1></div>${lastYearAdvice(s)}<div class="grid g2" style="margin-top:1rem">
    <div class="card"><h3>Driver contracts</h3>${exp.length ? exp.map((d) => `<div class="row small" style="margin:.4rem 0"><b>${esc(d.name)}</b> <span class="muted">age ${d.age}, morale ${Math.round(d.morale)}</span><span class="sp"></span><button class="btn sm" data-act="renew" data-arg="${d.id}:1">1 yr</button><button class="btn sm" data-act="renew" data-arg="${d.id}:2">2 yrs</button></div>`).join('') + '<p class="tiny muted">Unrenewed drivers leave; a replacement will be drafted in. You can also sign someone from the market.</p>' : '<p class="small good">Both drivers are under contract.</p>'}<button class="btn sm" data-act="go" data-arg="drivers">Open driver market</button></div>
    <div class="card"><h3>Organisation</h3><p class="small">Review departments, hire from the market and plan facility upgrades before the season starts. Fatigue partially recovers over the winter.</p><div class="row"><button class="btn sm" data-act="go" data-arg="staff">Staff</button><button class="btn sm" data-act="go" data-arg="facilities">Facilities</button><button class="btn sm" data-act="goNext">Next-year focus (${Math.round((t.nextYearFocus || 0) * 100)}%)</button></div></div></div>
    <div class="row" style="margin-top:1rem"><span class="sp"></span><button class="btn primary" data-act="nextSeason">Start season ${s.season + 1} →</button></div>`;
  },
});
on({ nextSeason: async () => { const ok = await confirmBox('Start the new season?', 'Contracts, regulations, car carry-over and the driver market will be resolved.', 'Start season'); if (!ok) return; C.startNextSeason(S()); persist('New season started'); app.tab.champ = 'cal'; go('hq'); } });

screen('achievements', {
  render() {
    const s = S(); const got = s.achievements || {};
    return `<div class="pagehead"><h1>Achievements</h1><span class="pill">${Object.keys(got).length}/${ACHIEVEMENTS.length}</span></div><div class="grid g4">${ACHIEVEMENTS.map((a) => `<div class="card" style="${got[a.id] ? 'border-color:var(--good)' : 'opacity:.55'}"><b>${got[a.id] ? '⭐' : '🔒'} ${esc(a.name)}</b><div class="small muted">${esc(a.desc)}</div>${got[a.id] ? `<div class="tiny good">Season ${got[a.id].season}</div>` : ''}</div>`).join('')}</div>`;
  },
});

export const guideHtml = (k) => { const g = GUIDE[k]; if (!g) return ''; const [t, p, secs, tip] = g; return `<div class="guide"><h3>${esc(t)}</h3><p class="small">${esc(p)}</p>${secs.length ? `<dl class="small">${secs.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>` : ''}${tip ? `<div class="alert small">💡 ${esc(tip)}</div>` : ''}</div>`; };
screen('guide', {
  render() {
    const sel = app.tab.guide || 'hq';
    return `<div class="pagehead"><h1>📘 Championship guide</h1></div>
    <div class="card" style="margin-bottom:1rem"><h3>How a year works</h3><ol class="small"><li><b>Week 1:</b> the year starts. Check HQ → Year plan for all fixed dates.</li><li><b>Development opens:</b> start upgrade projects in Car & Development; build facilities; hire staff.</li><li><b>Each week:</b> press "Next week ▶" in HQ. Projects progress, fatigue changes, events may pop up.</li><li><b>Race week:</b> "Go to race weekend" → practice, qualifying, strategy, race, debrief.</li><li><b>After the last race:</b> off-season. Plan next year, then "Close the year" for the season review and planning.</li></ol></div>
    <div class="grid" style="grid-template-columns:minmax(180px,240px) 1fr;gap:1rem"><div class="card col">${GUIDE_ORDER.map((k) => `<button class="choice ${sel === k ? 'on' : ''}" data-act="guideSel" data-arg="${k}">${esc(GUIDE[k][0])}</button>`).join('')}</div><div class="card">${guideHtml(sel)}<div class="row" style="margin-top:.6rem"><button class="btn sm" data-act="go" data-arg="${sel}">Open this page →</button></div></div></div>`;
  },
});
on({ guideSel: (k) => { app.tab.guide = k; render(); }, guidePage: () => { const k = GUIDE[app.route] ? app.route : 'hq'; modal(`${guideHtml(k)}<div class="row" style="justify-content:flex-end;margin-top:.6rem"><button class="btn" data-act="guideAll">Full guide</button><button class="btn primary" data-act="modalClose">Got it</button></div>`, { wide: true }); }, guideAll: () => { closeModal(); app.tab.guide = GUIDE[app.route] ? app.route : 'hq'; go('guide'); } });
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
      <div class="grid g2" style="gap:.2rem;margin-top:.3rem">${Object.entries({ pitplan: 'Planned pit stop', red: 'Red flag', sc: 'Safety car / VSC', rain: 'Rain', dry: 'Drying track', cliff: 'Tyre cliff', failure: 'Failures', damage: 'Damage', orders: 'Team orders', fuel: 'Fuel', plan: 'Race-day strategy check' }).map(([k, l]) => `<label class="small" style="margin:0"><input type="checkbox" ${st.pauseOn?.[k] !== false ? 'checked' : ''} data-change="setPause" data-arg="${k}"> ${l}</label>`).join('')}</div></div>
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
    <div class="card" style="margin-top:1rem"><h3>💾 Save file in your GitHub repo</h3><p class="small">Browser saves live on your disk (browser storage), not in RAM — closing the tab frees all memory. To keep a copy in the repo: <b>1.</b> press <b>Download save file</b> (savegame.json) · <b>2.</b> put it in the repo folder <code>saves/</code> and commit · <b>3.</b> next time press <b>Load from repo</b>.</p><div class="row"><button class="btn" data-act="exportSave">⬇ Download save file</button><button class="btn" data-act="repoLoad">📂 Load from repo (saves/savegame.json)</button></div></div>
    <div class="card" style="margin-top:1rem"><h3>Export / import</h3><div class="row">${s ? '<button class="btn" data-act="exportSave">Export current game (.json)</button>' : ''}<label class="btn" style="margin:0">Import .json<input type="file" accept="application/json,.json" data-change="importSave" style="display:none"></label></div><p class="small muted">Saves live in this browser's localStorage. Export to move between devices or keep backups.</p></div>`;
    return s ? body : `<main style="max-width:1100px;margin:0 auto;padding:1rem">${body}</main>`;
  },
});
on({
  saveSlot: (k) => { const r = save(S(), k); toast(r.ok ? 'Saved.' : r.msg, r.ok ? 'good' : 'bad'); render(); },
  loadSlot: async (k) => { if (app.state) { const ok = await confirmBox('Load game?', 'Unsaved progress in the current game will be lost.', 'Load'); if (!ok) return; } const r = load(k); if (!r.ok) return toast('Could not load save.', 'bad'); setState(r.state); toast(r.fromBackup ? 'Loaded from backup.' : 'Loaded.', r.fromBackup ? 'warn' : 'good'); go(r.state.mode === 'quick' ? 'weekend' : r.state.phase === 'review' ? 'review' : 'hq'); },
  delSlot: async (k) => { const ok = await confirmBox('Delete save?', 'This cannot be undone.', 'Delete'); if (!ok) return; remove(k); render(); },
  exportSave: () => { const blob = new Blob([exportJSON(S())], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'savegame.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); },
  repoLoad: async () => { try { const r = await fetch('./saves/savegame.json', { cache: 'no-store' }); if (!r.ok) throw new Error('saves/savegame.json not found in the repo'); const st = importJSON(await r.text()); setState(st); save(st, 'auto'); toast('Loaded saves/savegame.json from the repo.', 'good'); go(st.mode === 'quick' ? 'weekend' : 'hq'); } catch (e) { toast('Repo load failed: ' + e.message, 'bad', 6000); } },
  importSave: (a, el) => { const f = el.files?.[0]; if (!f) return; f.text().then((txt) => { try { const st = importJSON(txt); setState(st); save(st, 'auto'); toast('Imported.', 'good'); go(st.mode === 'quick' ? 'weekend' : 'hq'); } catch (e) { toast('Import failed: ' + e.message, 'bad', 6000); } }); },
});
