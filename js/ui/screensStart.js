// Main menu, new career (team creation), quick race setup, game over.
import { app, screen, on, go, esc, setState, persist, toast, render, modal, closeModal } from './app.js';
import { createWorld, DIFFICULTY, driverSalary, driverRating } from '../engines/world.js';
import { startWeekend } from '../engines/weekendEngine.js';
import { TEAMS, PROFILES, PHILOSOPHIES } from '../data/teams.js';
import { DRIVERS, PERSONALITIES } from '../data/drivers.js';
import { TRACKS, trackPath, kmLen } from '../data/tracks.js';
import { mapSvg } from './trackView.js';
import { load, meta } from '../state/persistence.js';
import { money } from '../sim/util.js';

screen('menu', {
  needsState: false, bare: true,
  render() {
    const m = meta('auto');
    return `<div class="menu-hero"><div class="menu-box">
      <div class="tiny muted" style="letter-spacing:.3em">MOTORSPORT MANAGEMENT SIMULATOR</div>
      <div class="menu-title">TEAM PRINCIPAL <em>V3</em></div>
      <p class="muted" style="max-width:640px">You don't drive the car. You run the organisation — factory, engineers, drivers, development, finances, strategy room and pit wall. Every decision trades something for something else.</p>
      <div class="menu-grid">
        ${m && !m.corrupt ? `<button class="menu-card" data-act="continue" style="border-color:${m.color}"><b>▶ Continue</b><span class="muted small">${esc(m.team)} · ${m.mode === 'quick' ? 'Quick Race' : `Season ${m.season}, R${m.round + 1}/${m.total}`}<br>${new Date(m.at).toLocaleString()}</span></button>` : ''}
        <button class="menu-card" data-act="go" data-arg="newcareer"><b>🏗️ New Career</b><span class="muted small">Create a team, pick a philosophy and build a dynasty over multiple seasons.</span></button>
        <button class="menu-card" data-act="go" data-arg="quick"><b>⚡ Quick Race</b><span class="muted small">A complete weekend in 5–15 minutes: setup, qualifying, strategy and the race.</span></button>
        <button class="menu-card" data-act="go" data-arg="saves"><b>💾 Load Game</b><span class="muted small">Manual slots, autosave, and import/export.</span></button>
        <button class="menu-card" data-act="go" data-arg="help"><b>❔ How to Play</b><span class="muted small">Concepts, strategy, and the pit wall explained.</span></button>
        <button class="menu-card" data-act="go" data-arg="settings"><b>⚙️ Settings</b><span class="muted small">Speed, auto-pause, accessibility.</span></button>
      </div>
      <p class="tiny muted" style="margin-top:2rem">Fictional teams and drivers; real circuit layouts used for identification only. Not affiliated with Formula 1, the FIA or any team. Runs fully offline; saves stay in your browser. <button class="btn sm ghost" data-act="credits">Credits &amp; legal</button></p>
    </div></div>`;
  },
});
on({
  continue: () => { const r = load('auto'); if (!r.ok) return toast('Autosave could not be loaded.', 'bad'); setState(r.state); if (r.fromBackup) toast('Main save was damaged — restored from backup.', 'warn'); go(r.state.mode === 'quick' ? 'weekend' : 'hq'); },
});

// ---------------- New Career ----------------
const draft = () => (app.draft.career ||= { name: 'Meridian Racing', abbr: 'MER', color: '#e10600', color2: '#ffffff', profile: 'midfield', philosophy: 'balanced', difficulty: 'standard', seasonLength: 12, calendarOrder: 'real', raceLength: 0.35, control: 'hands-on', ironman: false, drivers: [] });
function availableDrivers(profile) {
  const reversed = [...TEAMS].reverse(); const replaced = reversed.find((t) => t.tier === profile);
  return { replaced, list: DRIVERS.filter((d) => d.team === replaced.id || d.team === null || d.team === 'academy') };
}
screen('newcareer', {
  needsState: false, bare: true,
  render() {
    const d = draft(); const { replaced, list } = availableDrivers(d.profile); const P = PROFILES[d.profile];
    const budget = P.cash;
    const sal = d.drivers.reduce((a, id) => a + driverSalary(DRIVERS.find((x) => x.id === id)), 0);
    return `<div class="menu-hero" style="place-items:start center"><div class="menu-box" style="max-width:1100px">
    <div class="row"><button class="btn ghost" data-act="go" data-arg="menu">← Back</button><h1 style="margin:0">New Career — Team Creation</h1></div>
    <div class="grid g2" style="margin-top:1rem">
      <div class="card"><h3>1 · Identity</h3>
        <div class="grid" style="grid-template-columns:2fr 1fr;gap:.6rem"><div><label>Team name</label><input type="text" maxlength="28" value="${esc(d.name)}" data-input="cdraft" data-arg="name"></div><div><label>Abbreviation</label><input type="text" maxlength="3" value="${esc(d.abbr)}" data-input="cdraft" data-arg="abbr"></div></div>
        <div class="row" style="margin-top:.6rem"><div><label>Primary</label><input type="color" value="${d.color}" data-change="cdraft" data-arg="color"></div><div><label>Secondary</label><input type="color" value="${d.color2}" data-change="cdraft" data-arg="color2"></div>
        <div class="sp"></div><div class="brand"><span class="logo" style="background:linear-gradient(135deg,${d.color},${d.color2})">${esc(d.abbr)}</span>${esc(d.name)}</div></div>
      </div>
      <div class="card"><h3>2 · Rules of the game</h3>
        <div class="grid g2" style="gap:.6rem">
          <div><label>Difficulty</label><select data-change="cdraft" data-arg="difficulty">${Object.entries(DIFFICULTY).map(([k, v]) => `<option value="${k}" ${d.difficulty === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select><div class="tiny muted">${DIFFICULTY[d.difficulty].desc}</div></div>
          <div><label>Season length</label><select data-change="cdraft" data-arg="seasonLength">${[8, 12, 16, 24].map((n) => `<option value="${n}" ${d.seasonLength == n ? 'selected' : ''}>${n === 24 ? '24 races (full 2026 calendar)' : n + ' races'}</option>`).join('')}</select></div>
          <div><label>Venue order</label><select data-change="cdraft" data-arg="calendarOrder"><option value="real" ${d.calendarOrder !== 'random' ? 'selected' : ''}>Real 2026 order (climate follows the months)</option><option value="random" ${d.calendarOrder === 'random' ? 'selected' : ''}>Random order (reshuffled each season)</option></select></div>
          <div><label>Race distance</label><select data-change="cdraft" data-arg="raceLength">${[[0.25, '25% (~5 min)'], [0.35, '35% (~8 min)'], [0.5, '50% (~12 min)'], [1, '100% (full)']].map(([v, l]) => `<option value="${v}" ${d.raceLength == v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div><label>Control level</label><select data-change="cdraft" data-arg="control"><option value="principal" ${d.control === 'principal' ? 'selected' : ''}>Principal (delegate details)</option><option value="hands-on" ${d.control === 'hands-on' ? 'selected' : ''}>Hands-on Principal</option></select></div>
        </div>
        ${d.difficulty === 'principal' ? `<label style="margin-top:.6rem"><input type="checkbox" ${d.ironman ? 'checked' : ''} data-change="cdraft" data-arg="ironman"> Ironman — single autosave, no rollback</label>` : ''}
      </div>
    </div>
    <div class="card" style="margin-top:1rem"><h3>3 · Starting profile</h3><div class="grid g4">${Object.entries(PROFILES).map(([k, p]) => `<button class="choice ${d.profile === k ? 'on' : ''}" data-act="cset" data-arg="profile:${k}"><b>${p.label}</b><div class="small muted">${p.desc}</div><div class="tiny" style="margin-top:.4rem">Cash ${money(p.cash)} · Board target P${p.target}</div></button>`).join('')}</div>
      <p class="tiny muted">Your team takes the grid slot of <b>${esc(replaced.name)}</b>. Profiles change facilities, staff quality, payroll, car baseline, reputation and board patience — not a single difficulty number.</p></div>
    <div class="card" style="margin-top:1rem"><h3>4 · Team philosophy</h3><div class="grid g4">${Object.entries(PHILOSOPHIES).map(([k, p]) => `<button class="choice ${d.philosophy === k ? 'on' : ''}" data-act="cset" data-arg="philosophy:${k}"><b>${p.label}</b><div class="small muted">${p.desc}</div></button>`).join('')}</div></div>
    <div class="card" style="margin-top:1rem"><h3>5 · Driver line-up <span class="muted small">(choose 2 — ${d.drivers.length}/2)</span></h3>
      <div class="tw"><table><thead><tr><th></th><th>Driver</th><th>Age</th><th>Pace</th><th>Racecraft</th><th>Consist.</th><th>Tyres</th><th>Wet</th><th>Feedback</th><th>Potential</th><th>Personality</th><th>Salary</th></tr></thead><tbody>
      ${list.map((x) => `<tr class="${d.drivers.includes(x.id) ? 'me' : ''}"><td><input type="checkbox" aria-label="Select ${esc(x.name)}" ${d.drivers.includes(x.id) ? 'checked' : ''} data-change="cdriver" data-arg="${x.id}"></td><td><b>${esc(x.name)}</b> <span class="muted tiny">${x.nat}${x.team === 'academy' ? ' · junior' : ''}</span></td><td>${x.age}</td><td>${x.pace}</td><td>${x.craft}</td><td>${x.cons}</td><td>${x.tyre}</td><td>${x.wet}</td><td>${x.fb}</td><td>${x.pot}</td><td title="${esc(PERSONALITIES[x.pers].desc)}">${PERSONALITIES[x.pers].label}</td><td>${money(driverSalary(x))}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="small muted">Driver salaries this season: <b>${money(sal)}</b> of starting cash ${money(budget)}. Cheaper juniors grow faster but make more mistakes and give weaker feedback.</p></div>
    <div class="row" style="margin:1rem 0 3rem"><div class="sp"></div><button class="btn primary" data-act="startCareer" ${d.drivers.length !== 2 ? 'disabled' : ''}>Confirm objective & start career →</button></div>
    </div></div>`;
  },
});
on({
  cdraft: (k, el) => { const d = draft(); d[k] = el.type === 'checkbox' ? el.checked : ['seasonLength', 'raceLength'].includes(k) ? +el.value : el.value; if (['difficulty'].includes(k) || el.tagName === 'SELECT' || el.type === 'color') render(); },
  cset: (arg) => { const [k, v] = arg.split(':'); const d = draft(); d[k] = v; if (k === 'profile') d.drivers = []; render(); },
  cdriver: (id, el) => { const d = draft(); if (el.checked) { if (d.drivers.length >= 2) { el.checked = false; return toast('Choose exactly two drivers.', 'warn'); } d.drivers.push(id); } else d.drivers = d.drivers.filter((x) => x !== id); render(); },
  startCareer: async () => {
    const d = draft(); if (d.drivers.length !== 2) return;
    const P = PROFILES[d.profile];
    const ok = await modal(`<h2>Board objective</h2><p>The board of <b>${esc(d.name)}</b> expects a <b>P${P.target} or better</b> finish in the Constructors' Championship, positive cash at season end, and a reliable car.</p><p class="muted small">Board patience: ${P.boardPatience >= 1.2 ? 'high' : P.boardPatience >= 0.9 ? 'normal' : 'low'}. Falling below ~10% confidence ends your tenure.</p><div class="row" style="justify-content:flex-end"><button class="btn" data-act="modalClose">Back</button><button class="btn primary" data-act="modalOk">Accept & go to HQ</button></div>`);
    if (!ok) return;
    const s = createWorld({ mode: 'career', difficulty: d.difficulty, seasonLength: d.seasonLength, calendarOrder: d.calendarOrder || 'real', raceLength: d.raceLength, ironman: d.ironman, controlLevel: d.control, custom: { name: d.name.trim() || 'My Team', abbr: (d.abbr || 'TEA').toUpperCase().slice(0, 3), color: d.color, color2: d.color2, profile: d.profile, philosophy: d.philosophy, driverIds: d.drivers } });
    setState(s); persist(); app.draft.career = null; app.tutorial = app.settings.showTutorial; go('hq');
  },
});

// ---------------- Quick race ----------------
const qd = () => (app.draft.quick ||= { team: 'tm_papaya', track: 'trk_silverstone', raceLength: 0.35, weather: 'random', difficulty: 'standard' });
screen('quick', {
  needsState: false, bare: true,
  render() {
    const d = qd(); const tr = TRACKS.find((t) => t.id === d.track);
    return `<div class="menu-hero" style="place-items:start center"><div class="menu-box" style="max-width:1100px">
    <div class="row"><button class="btn ghost" data-act="go" data-arg="menu">← Back</button><h1 style="margin:0">Quick Race</h1></div>
    <div class="card" style="margin-top:1rem"><h3>1 · Select team</h3><div class="grid g4">${TEAMS.map((t) => { const ds = DRIVERS.filter((x) => x.team === t.id); return `<button class="choice ${d.team === t.id ? 'on' : ''}" data-act="qset" data-arg="team:${t.id}"><div class="row"><span class="sw" style="background:${t.color};width:16px;height:16px"></span><b>${esc(t.name)}</b></div><div class="tiny muted">${PROFILES[t.tier].label} · ${PHILOSOPHIES[t.philosophy].label}</div><div class="small">${ds.map((x) => esc(x.name)).join(' · ')}</div></button>`; }).join('')}</div></div>
    <div class="grid g2" style="margin-top:1rem">
      <div class="card"><h3>2 · Circuit</h3><select data-change="qset2" data-arg="track">${TRACKS.map((t, i) => `<option value="${t.id}" ${d.track === t.id ? 'selected' : ''}>R${i + 1} · ${esc(t.gp)} — ${esc(t.name)}</option>`).join('')}</select>
        <div class="row" style="margin-top:.6rem;align-items:flex-start"><div style="width:190px;flex:none">${mapSvg(tr, 'qmap')}<div class="tiny muted" style="text-align:center">${esc(tr.country)} · ${kmLen(tr)} km · ${esc(tr.archetype)}</div></div>
        <div class="small"><b>${esc(tr.archetype)}</b><br>Downforce demand ${Math.round(tr.df * 100)}% · Drag sensitivity ${Math.round(tr.drag * 100)}%<br>Tyre degradation ${Math.round(tr.deg * 100)}% · Overtaking difficulty ${Math.round(tr.ovt * 100)}%<br>Safety-car likelihood ${Math.round(tr.sc * 100)}% · Weather volatility ${Math.round(tr.wx * 100)}%</div></div></div>
      <div class="card"><h3>3 · Options</h3><div class="grid g2" style="gap:.6rem">
        <div><label>Race distance</label><select data-change="qset2" data-arg="raceLength">${[[0.2, '20% (~4 min)'], [0.35, '35% (~8 min)'], [0.5, '50% (~12 min)'], [1, '100% (full)']].map(([v, l]) => `<option value="${v}" ${d.raceLength == v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div><label>Weather</label><select data-change="qset2" data-arg="weather"><option value="random" ${d.weather === 'random' ? 'selected' : ''}>Realistic (uncertain)</option><option value="dry" ${d.weather === 'dry' ? 'selected' : ''}>Dry</option><option value="wet" ${d.weather === 'wet' ? 'selected' : ''}>Rain expected</option></select></div>
        <div><label>Difficulty</label><select data-change="qset2" data-arg="difficulty">${Object.entries(DIFFICULTY).map(([k, v]) => `<option value="${k}" ${d.difficulty === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
      </div></div>
    </div>
    <div class="row" style="margin:1rem 0 3rem"><div class="sp"></div><button class="btn primary" data-act="startQuick">Go to race weekend →</button></div>
    </div></div>`;
  },
});
on({
  qset: (arg) => { const [k, v] = arg.split(':'); qd()[k] = v; render(); },
  qset2: (k, el) => { qd()[k] = k === 'raceLength' ? +el.value : el.value; render(); },
  startQuick: () => {
    const d = qd();
    const s = createWorld({ mode: 'quick', playerTeamId: d.team, trackId: d.track, raceLength: d.raceLength, difficulty: d.difficulty });
    s.forceWeather = d.weather === 'random' ? null : d.weather === 'wet';
    startWeekend(s); setState(s); persist(); go('weekend');
  },
});

screen('gameover', {
  render() {
    const s = app.state; const g = s.gameOver || { text: 'Career over.' };
    return `<div class="card" style="max-width:720px;margin:2rem auto;text-align:center"><h1>${g.reason === 'bankrupt' ? '💸 Administration' : '📉 Relieved of duties'}</h1><p>${esc(g.text)}</p>
    <p class="muted">Seasons completed: ${s.history.seasons.length} · Races: ${s.stats.races} · Wins: ${s.stats.wins} · Podiums: ${s.stats.podiums} · Points: ${s.stats.points}</p>
    <div class="row" style="justify-content:center"><button class="btn primary" data-act="go" data-arg="newcareer">Start a new career</button><button class="btn" data-act="menu">Main menu</button></div></div>`;
  },
});

on({ credits: () => modal(`<h2>Credits & legal</h2>
<p class="small"><b>Team Principal</b> is an unofficial, non-commercial fan game. It is not affiliated with, endorsed or sponsored by Formula 1, Formula One Management, the FIA, or any team, driver or circuit. F1, FORMULA 1 and GRAND PRIX are trademarks of Formula One Licensing B.V. Circuit names are used only to identify real venues.</p>
<p class="small">All teams, drivers, staff and sponsors are fictional.</p>
<p class="small"><b>Circuit outlines:</b> derived from <i>bacinger/f1-circuits</i>, © Tomislav Bacinger, MIT License.</p>
<p class="small">Game code © the Team Principal authors, MIT License. See LICENSE, THIRD_PARTY_NOTICES.md and LEGAL.md in the project folder.</p>
<div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="modalClose">Close</button></div>`) });
