// HQ and management screens: car development, facilities, staff, drivers, finance, sponsors, board.
import { COMP, COMP_KEYS, allowance, ensurePC } from '../engines/components.js';
import { app, screen, on, go, esc, persist, toast, render, modal, closeModal, confirmBox } from './app.js';
import { trackById } from '../data/tracks.js';
import { CAR_ATTRS, ATTR_LABEL, PHILOSOPHIES, PROFILES } from '../data/teams.js';
import { PERSONALITIES } from '../data/drivers.js';
import { seasonBonus } from '../engines/economy.js';
import { DEPARTMENTS, FACILITIES, PROJECTS, APPROACHES, EVENTS, SPEC_DESC, COST_CAP, OBJ_TEXT, REGULATIONS } from '../data/content.js';
import * as C from '../engines/careerEngine.js';
import { deptQ, driverRating, driverSalary, DIFFICULTY, facLvl } from '../engines/world.js';
import { effectiveCar } from '../engines/carModel.js';
import * as PE from '../engines/people.js';
import { AREAS, AREA_KEYS, SPLIT_AREAS, areaOfProject, defaultSplit, PU_SUPPLIERS, PU_KEYS, puSpec, SPONSOR_TERMS, TESTS, postSeasonLaps, attrFocus } from '../engines/economy.js';
import { money, avg, clamp, qual } from '../sim/util.js';
import { lastYearAdvice } from './screensMisc.js';
import { clockCard, yearPlanList, yearStrip } from './calendarUi.js';
import { bar, helpBtn, pill, lineChart, barChart, tabs, sevColor } from './widgets.js';

const S = () => app.state; const P = () => app.state.teams[app.state.player];
on({ tab: (arg) => { const [k, v] = arg.split(':'); app.tab[k] = v; render(); } });

// ---------------- HQ ----------------
function eventCard(s) {
  const ev = s.pendingEvent; if (!ev) return '';
  if (ev.kind === 'poach') return `<div class="card" style="border-color:var(--warn)"><h3>⚠️ ${esc(ev.title)}</h3><p>${esc(ev.text)}</p><div class="opts col">
    <button class="btn" data-act="resolveEv" data-arg="0">Match the offer (${money(ev.offer)}/yr) — keeps them, raises payroll</button>
    <button class="btn" data-act="resolveEv" data-arg="1">Let them go & promote internally — weaker head, morale boost for promotion</button>
    <button class="btn" data-act="resolveEv" data-arg="2">Reject the demand — gamble on loyalty (${Math.round(P().depts[ev.dept].head.loyalty / 1.3)}% stay chance)</button></div></div>`;
  if (ev.kind === 'regvote') { const reg = REGULATIONS.find((r) => r.id === ev.regId); const mine = reg.attrs.reduce((a, k) => a + P().car[k], 0) / reg.attrs.length; const fa = avg(Object.values(s.teams).filter((x) => !x.isPlayer).map((t) => reg.attrs.reduce((a, k) => a + t.car[k], 0) / reg.attrs.length));
    return `<div class="card evcard reg"><h3>🗳️ F1 Commission vote — next year's rules</h3><p><b>${esc(reg.name)}</b>: ${esc(reg.desc)}</p><div class="small">Your car in the affected area: <b class="${mine > fa ? 'good' : 'bad'}">${mine.toFixed(1)}</b> vs field ${fa.toFixed(1)} → ${mine > fa ? 'you would lose an advantage (vote against?)' : 'a reset helps you catch up (vote for?)'}</div><div class="tiny muted" style="margin:.4rem 0">FIA (10 votes) and FOM (10) back it; it needs 28 of 30, so at least ${Object.keys(s.teams).length - 2} of ${Object.keys(s.teams).length} teams must agree.</div><div class="row"><button class="btn primary" data-act="resolveEv" data-arg="0">✓ Vote FOR</button><button class="btn" data-act="resolveEv" data-arg="1">✗ Vote AGAINST</button></div></div>`; }
  if (ev.kind === 'test') { const T = TESTS[ev.test]; const laps = ev.test === 'post' ? postSeasonLaps(C.teamPos(s, s.player)) : T.laps;
    return `<div class="card evcard test"><h3>🧪 ${T.label} this week</h3><p class="small">${esc(T.desc)}</p><div class="row small"><span class="pill">${T.days} day(s)</span><span class="pill">${laps} laps</span><span class="pill">Car knowledge ${Math.round((P().carKnow ?? 0.3) * 100)}%</span>${P().drivers.map((d) => `<span class="pill">${esc(s.drivers[d].name.split(' ').pop())} ${Math.round((s.drivers[d].carFam ?? 0.3) * 100)}%</span>`).join('')}</div><p class="tiny muted">Car knowledge = better setup starting point for engineers. Driver familiarity = faster start to every weekend (track knowledge). Both carry into next year at 60%.</p><div class="row"><button class="btn primary" data-act="resolveEv" data-arg="0">Balanced programme</button><button class="btn" data-act="resolveEv" data-arg="1">Car / engineering focus</button><button class="btn" data-act="resolveEv" data-arg="2">Driver mileage focus</button></div></div>`; }
  const e = EVENTS.find((x) => x.id === ev.id);
  return `<div class="card" style="border-color:var(--warn)"><h3>📨 ${esc(e.title)}</h3><p>${esc(e.text)}</p><div class="col">${e.options.map((o, i) => `<button class="btn" style="justify-content:flex-start;white-space:normal;text-align:left;height:auto;padding:.6rem" data-act="resolveEv" data-arg="${i}"><b>${esc(o.label)}</b>&nbsp;<span class="muted small">— ${esc(o.note)}</span></button>`).join('')}</div></div>`;
}
on({ resolveEv: (i) => { C.resolveEvent(S(), +i); persist(); render(); } });

function attentionList(s) {
  const t = P(); const a = [];
  const ready = s.projects.filter((p) => p.stage === 'ready'); if (ready.length) a.push(['good', `${ready.length} upgrade(s) ready to deploy.`, 'car']);
  if (t.cash < 0) a.push(['bad', `Cash is negative (${money(t.cash)}). Open Finance for emergency options.`, 'finance']);
  else if (t.cash < 8e6) a.push(['warn', `Cash is low (${money(t.cash)}).`, 'finance']);
  if (s.board.confidence < 30) a.push(['bad', `Board confidence critical: ${Math.round(s.board.confidence)}%.`, 'board']);
  for (const [k, d] of Object.entries(t.depts)) { if (d.fatigue > 60) a.push(['warn', `${DEPARTMENTS[k].label} fatigue high (${Math.round(d.fatigue)}) — errors and failures more likely.`, 'staff']); if (d.morale < 40) a.push(['warn', `${DEPARTMENTS[k].label} morale low (${Math.round(d.morale)}).`, 'staff']); }
  for (const id of t.drivers) { const d = s.drivers[id]; if (d.contract.years <= 1) a.push(['info', `${d.name}'s contract expires at season end.`, 'drivers']); if (d.morale < 40) a.push(['warn', `${d.name} is unhappy (morale ${Math.round(d.morale)}).`, 'drivers']); }
  if (t.budgetSpent > COST_CAP * 0.85) a.push(['warn', `Cost-cap usage ${Math.round(t.budgetSpent / COST_CAP * 100)}%.`, 'finance']);
  const active = s.projects.filter((p) => ['design', 'manufacturing'].includes(p.stage)).length; if (!active) a.push(['info', 'No development projects running — rivals are developing every week.', 'car']);
  if (s.sponsors.length < 2) a.push(['warn', 'Few sponsors — check offers.', 'sponsors']);
  if (s.sponsorOffers.length) a.push(['info', `${s.sponsorOffers.length} sponsor offer(s) waiting.`, 'sponsors']);
  if (s.gridPenalties && Object.keys(s.gridPenalties).length) a.push(['warn', 'Grid penalty pending for next race (PU allocation).', 'car']);
  return a;
}
// ---- HQ visuals (Round 11) ----
function carSvg(c1, c2) {
  return `<svg class="hqcar" viewBox="0 0 320 90" aria-hidden="true"><defs><linearGradient id="hqg" x1="0" x2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <path d="M8 58 L40 52 L70 50 L96 40 L150 36 L180 28 L205 28 L214 38 L258 42 L300 46 L312 54 L300 60 L60 64 Z" fill="url(#hqg)" stroke="rgba(255,255,255,.35)" stroke-width="1"/>
  <path d="M176 30 q14 -12 28 0" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round"/><rect x="292" y="36" width="22" height="6" rx="2" fill="${c2}"/><rect x="2" y="54" width="34" height="5" rx="2" fill="${c2}"/>
  <circle cx="72" cy="64" r="17" fill="#111" stroke="#333" stroke-width="4"/><circle cx="72" cy="64" r="6" fill="#555"/><circle cx="252" cy="64" r="19" fill="#111" stroke="#333" stroke-width="4"/><circle cx="252" cy="64" r="7" fill="#555"/></svg>`;
}
function radarSvg(t, field) {
  const ks = ['lowAero', 'highAero', 'dragEff', 'mech', 'traction', 'braking', 'tyreCare', 'cooling', 'reliability', 'power'];
  const R = 80, cx = 110, cy = 100; const pt2 = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / ks.length; const r = R * clamp((v - 40) / 70, 0.02, 1); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
  const poly = (vals) => vals.map((v, i) => pt2(i, v).map((x) => x.toFixed(1)).join(',')).join(' ');
  const me = ks.map((k) => t.car[k]); const fa = ks.map((k) => avg(field.map((x) => x.car[k]))); const best = ks.map((k) => Math.max(...field.map((x) => x.car[k])));
  const rings = [0.25, 0.5, 0.75, 1].map((f) => `<polygon points="${ks.map((_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / ks.length; return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f].map((x) => x.toFixed(1)).join(','); }).join(' ')}" fill="none" stroke="rgba(255,255,255,.08)"/>`).join('');
  const labels = ks.map((k, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / ks.length; const x = cx + Math.cos(a) * (R + 16), y = cy + Math.sin(a) * (R + 12); return `<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" text-anchor="${Math.cos(a) > 0.3 ? 'start' : Math.cos(a) < -0.3 ? 'end' : 'middle'}" dominant-baseline="middle">${esc(ATTR_LABEL[k])}</text>`; }).join('');
  return `<svg class="radar" viewBox="-40 0 300 205" role="img" aria-label="Car vs field radar">${rings}<polygon points="${poly(best)}" fill="none" stroke="#d4af37" stroke-dasharray="3 3"/><polygon points="${poly(fa)}" fill="rgba(160,170,190,.12)" stroke="#8d98ad"/><polygon points="${poly(me)}" fill="color-mix(in srgb, var(--team) 35%, transparent)" stroke="var(--team)" stroke-width="2"/>${labels}</svg>
  <div class="tiny muted" style="text-align:center"><span style="color:var(--team)">■</span> Your car · <span style="color:#8d98ad">■</span> field average · <span style="color:#d4af37">┅</span> best rival</div>`;
}
function ring(v, max, label, col) { const f = clamp(v / max, 0, 1); const C2 = 2 * Math.PI * 22; return `<div class="ringw"><svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="6"/><circle cx="28" cy="28" r="22" fill="none" stroke="${col}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(C2 * f).toFixed(1)} ${C2.toFixed(1)}" transform="rotate(-90 28 28)"/><text x="28" y="31" text-anchor="middle">${Math.round(v)}</text></svg><span>${label}</span></div>`; }
function hqHero(s, t, pos, st, tr) {
  const dCards = t.drivers.map((id, i) => { const d = s.drivers[id]; const dp = st.drivers.findIndex((x) => x.id === id) + 1; return `<div class="hqdrv"><div class="hqnum">${i + 1}</div><div><b>${esc(d.name)}</b><div class="tiny muted">P${dp} · ${d.seasonPts || 0} pts · ${PE.contractText(s, d)}</div><div class="tiny">🎧 ${PE.rapportText(d.rapport)} rapport · morale ${Math.round(d.morale)}</div></div></div>`; }).join('');
  const depts = Object.entries(t.depts).map(([k, d]) => `<div class="hqdept ${d.leave?.on ? 'leave' : ''}" title="${DEPARTMENTS[k].label}: fatigue ${Math.round(d.fatigue)}, morale ${Math.round(d.morale)}${d.leave ? (d.leave.on ? ' — ON LEAVE' : ' — leave booked wk ' + d.leave.start) : ''}">${ring(d.fatigue, 100, (d.leave?.on ? '🏖 ' : '') + DEPARTMENTS[k].label.split(' ')[0], d.fatigue > 60 ? 'var(--bad)' : d.fatigue > 35 ? 'var(--warn)' : 'var(--good)')}</div>`).join('');
  return `<section class="hqhero" style="--tc:${t.color};--tc2:${t.color2 || '#fff'}">
    <div class="hqtop"><div><div class="hqkick">TEAM HQ · ${s.year} · SEASON ${s.season}</div><h1 class="hqname">${esc(t.name)}</h1><div class="row">${pill(PROFILES[t.profile]?.label || '')}${pill(PHILOSOPHIES[t.philosophy]?.label || '')}${s.reserve ? pill('Reserve: ' + esc(s.drivers[s.reserve]?.name || ''), 'info') : ''}</div></div>${carSvg(t.color, t.color2 || '#ffffff')}</div>
    <div class="hqkpis"><div class="kpi"><b>P${pos}</b><span>Constructors</span></div><div class="kpi"><b>${t.points}</b><span>Points</span></div><div class="kpi"><b>P${s.board.target}</b><span>Board target</span></div><div class="kpi"><b class="${t.cash < 0 ? 'bad' : ''}">${money(t.cash)}</b><span>Cash</span></div><div class="kpi"><b>${Math.round(s.board.confidence)}%</b><span>Board</span></div>${tr ? `<div class="kpi next"><b>${esc(tr.gp || tr.name)}</b><span>Next race · R${s.round + 1}/${s.calendar.length}</span></div>` : ''}</div>
    <div class="hqrow"><div class="hqdrvs">${dCards}</div><div class="hqdepts"><div class="tiny muted">Department fatigue (ring) — book 🏖 leave in Staff</div><div class="row" style="gap:.3rem">${depts}</div></div></div>
  </section>`;
}
screen('hq', {
  render() {
    const s = S();
    if (s.mode === 'quick') { go('weekend'); return ''; }
    if (s.gameOver) { setTimeout(() => go('gameover')); return ''; }
    if (s.phase === 'review') return `<div class="card"><h2>Season ${s.season} complete</h2><button class="btn primary" data-act="go" data-arg="review">Open season review →</button></div>`;
    const t = P(); const st = C.standings(s); const pos = st.teams.findIndex((x) => x.id === t.id) + 1;
    const tr = trackById(s.calendar[s.round]);
    const field = Object.values(s.teams).filter((x) => !x.isPlayer);
    const attn = attentionList(s);
    return `${hqHero(s, t, pos, st, tr)}
    ${app.tutorial ? tutorialCard() : ''}
    ${s.season > 1 && s.schedule && s.week < s.schedule.first ? `<div style="margin-bottom:1rem">${lastYearAdvice(s)}</div>` : ''}
    <div class="grid g3">
      ${clockCard(s)}
      <div class="card"><h4>Championship</h4><div class="row"><div class="stat"><b>P${pos}</b><span>Constructors</span></div><div class="stat"><b>${t.points}</b><span>Points</span></div><div class="stat"><b>P${s.board.target}</b><span>Target</span></div></div>
        <div class="small" style="margin-top:.5rem">${t.drivers.map((id) => `${esc(s.drivers[id].name)}: P${st.drivers.findIndex((d) => d.id === id) + 1} (${s.drivers[id].seasonPts || 0} pts)`).join('<br>')}</div></div>
      <div class="card"><h4>At risk</h4><div class="small">Board confidence ${bar(s.board.confidence, 100, sevColor(s.board.confidence, 55, 30))}Cost cap used ${bar(t.budgetSpent, COST_CAP, t.budgetSpent > COST_CAP * 0.9 ? 'var(--bad)' : null)}Team morale ${bar(avg(Object.values(t.depts).map((d) => d.morale)), 100, sevColor(avg(Object.values(t.depts).map((d) => d.morale))))}Staff fatigue ${bar(avg(Object.values(t.depts).map((d) => d.fatigue)), 100, 'var(--warn)')}</div></div>
    </div>
    <div class="grid g2" style="margin-top:1rem">
      <div class="col">${eventCard(s)}<div class="card"><h3>Needs attention</h3>${attn.length ? attn.map(([k, txt, r]) => `<div class="alert ${k}"><a href="#/${r}" style="color:inherit;text-decoration:none">${esc(txt)} →</a></div>`).join('') : '<div class="muted small">Nothing urgent. Consider long-term investments.</div>'}</div>
        <div class="card"><h3>Car vs field ${helpBtn('car')}</h3>${radarSvg(t, field)}<details class="small"><summary>Exact numbers</summary>${CAR_ATTRS.map((k) => { const mine = t.car[k]; const fa = avg(field.map((x) => x.car[k])); const d = mine - fa; return `<div class="row small" style="margin:.15rem 0"><span style="width:140px">${ATTR_LABEL[k]}</span><div style="flex:1">${bar(mine, 110, d > 1 ? 'var(--good)' : d < -1 ? 'var(--bad)' : null)}</div><span class="mono" style="width:48px;text-align:right" class="${d >= 0 ? 'good' : 'bad'}">${d >= 0 ? '+' : ''}${d.toFixed(1)}</span></div>`; }).join('')}<div class="tiny muted">Difference vs AI field average (estimate).</div></details></div></div>
      <div class="col"><div class="card"><h3>Year plan ${s.year}</h3>${yearStrip(s)}${yearPlanList(s)}</div><div class="card"><h3>Inbox</h3>${s.inbox.slice(0, 10).map((m) => `<div class="alert ${m.sev === 'info' ? '' : m.sev} small">${m.season ? `<span class="muted tiny">S${m.season} R${m.round + 1}</span> ` : ''}${esc(m.text)}</div>`).join('') || '<div class="muted">Empty</div>'}</div>
        <div class="card"><h3>Paddock news</h3>${s.news.slice(0, 8).map((n) => `<div class="small" style="margin:.25rem 0">• ${esc(n.text)} <span class="muted tiny">(unconfirmed)</span></div>`).join('') || '<div class="muted small">Quiet in the paddock.</div>'}</div></div>
    </div>`;
  },
});
function tutorialCard() {
  const steps = [
    ['Welcome, Principal', 'HQ answers four questions: what is happening, what needs attention, what is at risk, and what you should decide next.'],
    ['Develop the car', 'Car & Development: start projects. Aggressive concepts promise more but can fail. Real gains are only known after a correlation run or a race.'],
    ['People matter', 'Staff quality, morale and fatigue drive development speed, pit stops and reliability. Crunch speeds things up — at a price.'],
    ['Race weekends', 'Practice sharpens setup and tyre knowledge. Qualifying run plans trade safety for track evolution. The Strategy Lab sets each driver\'s plan.'],
    ['On the pit wall', 'Critical moments — safety cars, rain, tyre cliffs, damage — pause the race and ask for your call. Then read the Why? debrief.'],
  ];
  const i = app.tutStep || 0; const [h, p] = steps[i];
  return `<div class="card" style="border-color:var(--info);margin-bottom:1rem"><div class="row"><h3 style="margin:0">🎓 ${h}</h3><span class="sp"></span><span class="tiny muted">${i + 1}/${steps.length}</span></div><p class="small">${p}</p><div class="row"><button class="btn sm" data-act="tutSkip">Skip tutorial</button><span class="sp"></span>${i < steps.length - 1 ? '<button class="btn sm primary" data-act="tutNext">Next</button>' : '<button class="btn sm primary" data-act="tutSkip">Got it</button>'}</div></div>`;
}
on({ tutNext: () => { app.tutStep = (app.tutStep || 0) + 1; render(); }, tutSkip: () => { app.tutorial = false; app.tutStep = 0; render(); } });

// ---------------- Car & development ----------------
// v4: minimal flow — pick an area → pick a concept → it moves Design → Build → Ready → On the car (auto-fit).
const STEPS = [['design', 'Design', '✏️'], ['manufacturing', 'Build', '🏭'], ['ready', 'Ready', '📦'], ['deployed', 'On the car', '🏎️']];
function stepper(p) {
  const idx = p.stage === 'failed' ? -1 : STEPS.findIndex(([k]) => k === p.stage);
  const prog = p.stage === 'design' ? (1 - p.weeksLeft / p.totalWeeks) : p.stage === 'manufacturing' ? (1 - p.weeksLeft / Math.max(1, p.mfgWeeks)) : 1;
  return `<div class="pstep">${STEPS.map(([k, l, ic], i) => `<div class="ps ${i < idx ? 'done' : i === idx ? 'cur' : ''}"><span class="psd">${i < idx ? '✓' : ic}</span><span class="psl">${l}</span>${i === idx && i < 2 ? `<i class="psbar"><b style="width:${Math.round(prog * 100)}%"></b></i><span class="tiny muted">${p.weeksLeft} wk</span>` : ''}</div>`).join('<span class="psj"></span>')}${p.stage === 'failed' ? '<div class="ps bad"><span class="psd">✗</span><span class="psl">Failed validation</span></div>' : ''}</div>`;
}
screen('car', {
  render() {
    const s = S(); const t = P(); const tab = app.tab.car || 'dev';
    const live = s.projects.filter((p) => ['design', 'manufacturing', 'ready'].includes(p.stage)).length;
    return `<div class="pagehead"><h1>Car & Development</h1>${helpBtn('development')}</div>${tabs('car', [['dev', '➕ New part'], ['pipe', `🔧 Parts in progress${live ? ` (${live})` : ''}`], ['overview', '🏎️ Car by area'], ['next', '📅 Next-year car'], ['pu', '⚡ Power unit']], tab)}${{ dev: devTab, pipe: pipeTab, overview: overviewTab, next: nextTab, pu: puTab }[tab](s, t)}`;
  },
});
function devTab(s, t) {
  const area = app.tab.area || 'floor';
  const list = PROJECTS.filter((p) => areaOfProject(p.id) === area);
  const sel = list.some((p) => p.id === app.tab.prj) ? app.tab.prj : list[0]?.id; const ap = app.tab.appr || 'standard'; const qty = app.tab.qty || 2;
  const pv = C.projectPreview(s, sel, ap, qty);
  const maxActive = 2 + Math.floor(facLvl(t, 'rnd') / 2); const active = s.projects.filter((p) => ['design', 'manufacturing'].includes(p.stage)).length;
  const info = DIFFICULTY[s.difficulty].info;
  const fx = Object.entries(pv.expected).map(([k, v]) => { const u = Math.abs(v) * pv.unc + 0.1 * (1 - info); return `<span class="fxchip ${v >= 0 ? 'up' : 'down'}">${ATTR_LABEL[k]} <b>${v >= 0 ? '+' : ''}${(v - u).toFixed(1)}…${(v + u).toFixed(1)}</b></span>`; }).join('');
  return `<div class="devhead"><div class="dh"><b class="${t.cash < 0 ? 'bad' : ''}">${money(t.cash)}</b><span>Cash</span></div><div class="dh"><b>${money(Math.max(0, COST_CAP - t.budgetSpent))}</b><span>Cost-cap room</span></div><div class="dh"><b>${active}/${maxActive}</b><span>Design slots</span></div><div class="dh"><b>${t.autoFit !== false ? 'On' : 'Off'}</b><span>Auto-fit parts</span></div></div>
  <div class="card"><h3 style="margin-top:0">1 · Choose an area</h3><div class="areapick">${AREA_KEYS.map((k) => `<button class="areab ${area === k ? 'on' : ''}" data-act="selArea" data-arg="${k}"><span class="ai">${AREAS[k].icon}</span><b>${AREAS[k].label}</b><span class="tiny muted">${PROJECTS.filter((p) => areaOfProject(p.id) === k).length} concepts</span></button>`).join('')}</div></div>
  <div class="grid g2" style="margin-top:1rem"><div class="card"><h3 style="margin-top:0">2 · Pick a concept</h3><div class="col">${list.map((p) => `<button class="choice ${sel === p.id ? 'on' : ''}" data-act="selPrj" data-arg="${p.id}"><div class="row"><b class="small">${esc(p.name)}</b><span class="sp"></span><span class="tiny muted">${p.weeks} wk · ${money(p.cost)}</span></div><div class="tiny muted">${Object.keys(p.effects).map((k) => ATTR_LABEL[k]).join(' · ')}</div></button>`).join('')}</div></div>
  <div class="card"><h3 style="margin-top:0">3 · Approve</h3><b>${esc(pv.tpl.name)}</b>
    <div class="fxchips" style="margin:.5rem 0">${fx}</div>
    <label>Risk</label><div class="seg">${Object.entries(APPROACHES).map(([k, a]) => `<button class="btn sm ${ap === k ? 'on' : ''}" data-act="selAppr" data-arg="${k}">${a.label}</button>`).join('')}</div><div class="tiny muted">${APPROACHES[ap].desc}</div>
    <label style="margin-top:.6rem">Build for</label><div class="seg"><button class="btn sm ${qty === 2 ? 'on' : ''}" data-act="selQty" data-arg="2">Both cars</button><button class="btn sm ${qty === 1 ? 'on' : ''}" data-act="selQty" data-arg="1">Lead car first</button></div>
    <div class="costline"><span>💷 ${money(pv.cost + pv.mfgCost)}</span><span>⏱ ${pv.weeks + pv.mfgWeeks} weeks to the car</span><span class="${pv.failP > 0.15 ? 'bad' : pv.failP > 0.07 ? 'warn' : 'good'}">⚠ ${info >= 0.8 ? Math.round(pv.failP * 100) + '% fail risk' : pv.failP > 0.15 ? 'high risk' : pv.failP > 0.07 ? 'some risk' : 'low risk'}</span></div>
    <div class="row" style="margin-top:.8rem"><button class="btn primary" data-act="startPrj" ${active >= maxActive ? 'disabled' : ''}>Start ${esc(pv.tpl.name.split(' ')[0])} project</button></div>
    <details class="small" style="margin-top:.6rem"><summary>Options</summary><label class="small"><input type="checkbox" ${t.autoFit !== false ? 'checked' : ''} data-change="autoFit"> Fit finished parts to the car automatically</label><br><label class="small"><input type="checkbox" ${t.crunch ? 'checked' : ''} data-change="crunch"> Crunch mode (≈30% faster, $0.3M/week, more fatigue)</label></details></div></div>`;
}
on({
  selArea: (k) => { app.tab.area = k; app.tab.prj = null; render(); },
  selPrj: (id) => { app.tab.prj = id; render(); }, selAppr: (k) => { app.tab.appr = k; render(); }, selQty: (q) => { app.tab.qty = +q; render(); },
  startPrj: () => { if (S().schedule && S().week < S().schedule.devOpen) return toast(`Development opens in week ${S().schedule.devOpen}.`, 'warn'); const area = app.tab.area || 'floor'; const id = app.tab.prj || PROJECTS.find((p) => areaOfProject(p.id) === area).id; const r = C.startProject(S(), id, app.tab.appr || 'standard', app.tab.qty || 2); if (!r.ok) return toast(r.msg, 'warn'); persist(); toast(`${r.project.name} started.`, 'good'); app.tab.car = 'pipe'; render(); },
  crunch: (a, el) => { P().crunch = el.checked; persist(); render(); },
  autoFit: (a, el) => { P().autoFit = el.checked; persist(); render(); },
});
const fxText = (fx) => Object.entries(fx || {}).filter(([, v]) => Math.abs(v) > 0.05).map(([k, v]) => `${ATTR_LABEL[k]} ${v >= 0 ? '+' : ''}${v.toFixed(1)}`).join(', ');
function pipeTab(s, t) {
  const list = s.projects;
  if (!list.length) return '<div class="empty">No parts in progress. Start one in "➕ New part".</div>';
  const order = { ready: 0, manufacturing: 1, design: 2, deployed: 3, failed: 4 };
  return `<p class="small muted">Every part moves through four steps. With <b>auto-fit</b> on, a finished part goes straight onto the car — you only decide if a single set should go to one driver.</p><div class="col">${[...list].sort((a, b) => order[a.stage] - order[b.stage]).map((p) => {
    const ar = AREAS[areaOfProject(p.tplId)];
    const cmp = p.stage === 'deployed' ? (p.revealed ? `<div class="small">Measured on track: <b>${fxText(p.actual)}</b> <span class="muted">(predicted ${fxText(p.expected)})</span></div>` : `<div class="small muted">On the car. Real gain is measured by an Aero & conditions run, a test day or the next race.</div>`) : `<div class="small muted">Target: ${fxText(p.expected)}</div>`;
    return `<div class="card pcard"><div class="row"><span class="ai sm">${ar.icon}</span><b>${esc(p.name)}</b><span class="tiny muted">${ar.label}</span>${pill(APPROACHES[p.approach].label)}<span class="sp"></span>${p.slot != null && p.stage === 'deployed' ? `<span class="pill warn">${esc(s.drivers[t.drivers[p.slot]].name)} only</span>` : p.stage === 'deployed' ? '<span class="pill good">Both cars</span>' : ''}</div>
    ${stepper(p)}${cmp}
    ${p.stage === 'ready' ? `<div class="row" style="margin-top:.5rem">${p.qty >= 2 ? `<button class="btn sm primary" data-act="deploy" data-arg="${p.id}:">Fit to both cars</button>` : t.drivers.map((did, i) => `<button class="btn sm primary" data-act="deploy" data-arg="${p.id}:${i}">Fit to ${esc(s.drivers[did].name)}</button>`).join('')}</div>` : ''}
    ${p.stage === 'deployed' && p.slot != null ? `<div class="row" style="margin-top:.5rem"><button class="btn sm" data-act="secondSet" data-arg="${p.id}">Build a set for the other car (${money(p.mfgCost)})</button></div>` : ''}</div>`;
  }).join('')}</div>`;
}
on({
  deploy: (arg) => { const [id, slot] = arg.split(':'); C.deployProject(S(), id, slot === '' ? null : +slot); persist(); render(); toast('Part fitted to the car.', 'good'); },
  secondSet: (id) => { C.buildSecondSet(S(), id); persist(); render(); },
});
function overviewTab(s, t) {
  const c0 = effectiveCar(t, 0), c1 = effectiveCar(t, 1);
  const rivals = Object.values(s.teams).filter((x) => !x.isPlayer);
  return `<div class="grid g3">${AREA_KEYS.map((a) => {
    const parts = s.projects.filter((p) => p.stage === 'deployed' && areaOfProject(p.tplId) === a);
    const wip = s.projects.filter((p) => ['design', 'manufacturing', 'ready'].includes(p.stage) && areaOfProject(p.tplId) === a);
    const attrs = [...new Set(AREAS[a].attrs)];
    const score = avg(attrs.map((k) => (c0[k] + c1[k]) / 2)); const fa = avg(attrs.map((k) => avg(rivals.map((r) => r.car[k])))); const d = score - fa;
    return `<div class="card areacard"><div class="row"><span class="ai">${AREAS[a].icon}</span><h3 style="margin:0">${AREAS[a].label}</h3><span class="sp"></span><span class="pill ${d > 1 ? 'good' : d < -1 ? 'bad' : ''}">${d >= 0 ? '+' : ''}${d.toFixed(1)} vs field</span></div>
    ${attrs.map((k) => { const v = (c0[k] + c1[k]) / 2; const best = Math.max(...rivals.map((r) => r.car[k])); const f = avg(rivals.map((r) => r.car[k])); return `<div class="arow"><span>${ATTR_LABEL[k]}</span><div class="abar"><i style="width:${clamp(v, 0, 110) / 1.1}%"></i><em style="left:${f / 1.1}%" title="Field average"></em><u style="left:${best / 1.1}%" title="Best rival"></u></div><b class="mono">${v.toFixed(1)}</b>${Math.abs(c0[k] - c1[k]) > 0.05 ? `<span class="tiny warn" title="Cars differ">${c0[k].toFixed(1)}/${c1[k].toFixed(1)}</span>` : ''}</div>`; }).join('')}
    <div class="tiny" style="margin-top:.4rem">${parts.length ? `🏎️ On the car: ${parts.map((p) => esc(p.name)).join(', ')}` : '<span class="muted">No new parts fitted this season.</span>'}${wip.length ? `<br>🔧 In progress: ${wip.map((p) => esc(p.name)).join(', ')}` : ''}</div></div>`;
  }).join('')}</div><p class="small muted">Bar = your car · grey tick = field average · gold tick = best rival (engineering estimates from GPS and speed traps).</p>`;
}
// Plain-English summary of what next season looks like with the current choices
function nextPlain(s, t, reg, sp) {
  const tot = t.nextYearFocus || 0; const rivals = Object.values(s.teams).filter((x) => x.id !== t.id);
  const up = [], down = [], rec = [];
  const sorted = [...SPLIT_AREAS].sort((a, b) => sp[b] - sp[a]); const focus = sorted[0];
  if (tot <= 0.001) { down.push('Nothing carries over: you are spending 0% on next year\'s car, so it starts from this year\'s level (and loses ground if the rules change).'); }
  else for (const a of SPLIT_AREAS) { if (sp[a] >= 15) up.push(`${AREAS[a].label}: gets ${sp[a]}% of the next-year effort, so it will start next season stronger.`); }
  if (reg) {
    for (const k of reg.attrs) { const f = attrFocus(tot, sp, k); const loss = Math.round(reg.regress * (1 - f) * 100); down.push(`${ATTR_LABEL[k]}: the new rule "${reg.name}" cuts it by about ${loss}%${f > 0.05 ? ` (you saved ${Math.round(f * 100)}% of the hit by funding it)` : ' — you are not protecting it yet'}.`); }
  }
  if (tot > 0) down.push(`This year: current projects run up to ${Math.round(tot * 60)}% slower while the factory works on next year.`);
  const car = effectiveCar(t, 0);
  const weak = [...CAR_ATTRS].filter((k) => k !== 'reliability').map((k) => ({ k, gap: avg(rivals.map((r) => r.car[k])) - car[k] })).sort((a, b) => b.gap - a.gap).slice(0, 2);
  for (const w of weak) if (w.gap > 0.5) { const area = SPLIT_AREAS.find((a) => AREAS[a].attrs.includes(w.k)); rec.push(`Your ${ATTR_LABEL[w.k].toLowerCase()} is ${w.gap.toFixed(1)} behind the field average — put more into ${area ? AREAS[area].label : 'that area'}.`); }
  if (reg) { const un = reg.attrs.filter((k) => attrFocus(tot, sp, k) < 0.2); if (un.length) rec.push(`Protect ${un.map((k) => ATTR_LABEL[k]).join(' and ')} from the rule change by funding the matching areas.`); }
  const left = s.calendar.length - s.round;
  if (left > s.calendar.length / 2 && tot > 0.3) rec.push(`It's still early (${left} races left) — ${Math.round(tot * 100)}% on next year hurts this season a lot. Around 10–25% is usual until mid-season.`);
  if (left <= 4 && tot < 0.3) rec.push(`Only ${left} race(s) left — shifting 40–60% to next year now costs little and gives a better start.`);
  if (!rec.length) rec.push('Your plan looks balanced. Keep it and review after the next race.');
  const li = (xs, cls) => xs.length ? `<ul class="plain ${cls}">${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="tiny muted">Nothing.</p>';
  return `<div class="card plaincard"><h3>📋 Next season in plain English</h3>
    <div class="plaingrid"><div><h4>⬆ Goes up</h4>${li(up, 'up')}</div><div><h4>⬇ Goes down</h4>${li(down, 'down')}</div>
    <div><h4>🎯 Main focus</h4><p class="small">${tot > 0 ? `<b>${AREAS[focus].label}</b> (${sp[focus]}% of the next-year work).` : 'None yet — the slider below is at 0%.'}</p></div><div><h4>💡 We recommend</h4>${li(rec, 'rec')}</div></div></div>`;
}
function nextTab(s, t) {
  const reg = REGULATIONS.find((r) => r.id === s.regulation.next); const prop = REGULATIONS.find((r) => r.id === s.regulation.proposal); const v = s.regulation.vote;
  const sp = t.nextYearSplit || defaultSplit();
  return `${nextPlain(s, t, reg, sp)}<div class="grid g2"><div class="card"><h3>Next-year car ${helpBtn('regs')}</h3>
  ${reg ? `<div class="alert warn">Confirmed for next season: <b>${esc(reg.name)}</b> — ${esc(reg.desc)}</div>` : prop && v ? `<div class="alert">Proposal "<b>${esc(prop.name)}</b>" was rejected by the F1 Commission (${v.total}/${v.of}, 28 needed). Current rules carry on.</div>` : '<p class="muted small">Rule changes are voted on by the F1 Commission around mid-season (FIA 10 votes + FOM 10 + one per team; 28 of 30 needed).</p>'}
  ${v ? `<div class="votegrid">${v.votes.map((x) => `<span class="vt ${x.yes ? 'y' : 'n'}" title="${esc(x.name)}"><span class="sw" style="background:${x.color}"></span>${x.yes ? '✓' : '✗'}</span>`).join('')}</div>` : ''}
  <label>Total effort on next year's car: <b>${Math.round((t.nextYearFocus || 0) * 100)}%</b></label>
  <input type="range" min="0" max="0.6" step="0.05" value="${t.nextYearFocus || 0}" data-change="nyFocus">
  <p class="small muted">Slows this year's projects by up to ${Math.round((t.nextYearFocus || 0) * 60)}%, but every area you fund starts next season stronger and suffers less from new rules.</p></div>
  <div class="card"><h3>Split by area</h3><p class="small muted">Where the next-year effort goes (always totals 100%).</p>
  ${SPLIT_AREAS.map((a) => `<div class="splitrow"><span class="ai sm">${AREAS[a].icon}</span><span class="sl">${AREAS[a].label}</span><input type="range" min="0" max="80" step="5" value="${sp[a]}" data-change="nySplit" data-arg="${a}"><b class="mono">${sp[a]}%</b></div>`).join('')}
  <div class="splitbar">${SPLIT_AREAS.map((a, i) => `<i style="width:${sp[a]}%;background:hsl(${i * 62 + 190} 60% 50%)" title="${AREAS[a].label}"></i>`).join('')}</div>
  ${reg ? `<p class="tiny warn">Tip: the new rules hit ${reg.attrs.map((k) => ATTR_LABEL[k]).join(', ')} — fund the areas that contain them.</p>` : ''}</div></div>`;
}
on({ nyFocus: (a, el) => { P().nextYearFocus = +el.value; persist(); render(); }, nySplit: (a, el) => { C.setSplit(S(), a, +el.value); persist(); render(); } });
function puTab(s, t) {
  ensurePC(t);
  const cur = t.puSup || 'ardent'; const nxt = t.puNext || cur;
  const customers = (k) => Object.values(s.teams).filter((x) => x.puSup === k).map((x) => `<span class="sw" style="background:${x.color}" title="${esc(x.name)}"></span>`).join('');
  return `<div class="card"><h3>Power-unit supplier</h3><p class="small muted">Three manufacturers supply the grid — or build your own. Every customer of a supplier gets the identical PU, and every driver gets the same component allowance. Changes apply from next season.</p>
  <div class="grid g4">${PU_KEYS.map((k) => { const S2 = PU_SUPPLIERS[k]; const sp = k === 'inhouse' ? { power: S2.power + (t.puOwn || 0), puEff: S2.puEff + (t.puOwn || 0) } : puSpec(s, k); return `<div class="pucard ${cur === k ? 'cur' : ''} ${nxt === k && nxt !== cur ? 'next' : ''}"><div class="row"><b>${esc(S2.name)}</b><span class="sp"></span>${cur === k ? '<span class="pill good">Current</span>' : ''}${nxt === k && nxt !== cur ? '<span class="pill info">Next year</span>' : ''}</div><div class="tiny muted">${esc(S2.tag)}</div>
    <div class="arow"><span>Power</span><div class="abar"><i style="width:${sp.power / 1.1}%"></i></div><b class="mono">${sp.power.toFixed(0)}</b></div><div class="arow"><span>Efficiency</span><div class="abar"><i style="width:${sp.puEff / 1.1}%"></i></div><b class="mono">${sp.puEff.toFixed(0)}</b></div>
    <div class="tiny">${esc(S2.desc)}</div><div class="tiny" style="margin:.3rem 0">Fee ${money(S2.fee)}/season${S2.setup && !t.puBuilt ? ` · build-up ${money(S2.setup)}` : ''} ${k !== 'inhouse' ? `· customers ${customers(k)}` : ''}</div>
    ${nxt === k ? '' : `<button class="btn sm" data-act="pickPU" data-arg="${k}">${cur === k ? 'Stay' : 'Sign for next year'}</button>`}</div>`; }).join('')}</div></div>
  <div class="card" style="margin-top:1rem"><h3>Power unit & gearbox pool ${helpBtn('development')}</h3><p class="small muted">Same for every team (2026 rules, per driver over 24 races, scaled to your season): <b>4</b> engines, <b>4</b> turbos, <b>4</b> exhausts, <b>3</b> MGU-Ks, <b>3</b> batteries, <b>3</b> control electronics. No MGU-H any more. Worn parts fail more often. An extra part beyond the allocation costs <b>10 grid places</b> the first time and <b>5</b> after that. Gearboxes have <b>no season limit</b> (they only cost money), but changing one between qualifying and the race means a <b>pit-lane start</b>.</p>
  <div class="grid g2">${t.drivers.map((did, slot) => `<div class="card tight"><b>${esc(s.drivers[did].name)}</b>${(s.gridPenalties || {})[did] ? ` <span class="pill bad">${s.gridPenalties[did] >= 99 ? 'pit-lane start' : '+' + s.gridPenalties[did] + ' grid places'} next race</span>` : ''}
    ${COMP_KEYS.map((k) => { const c = t.pc[slot][k]; const al = allowance(s, k); return `<div class="row small" style="margin-top:.45rem"><span style="width:120px">${COMP[k].name}</span><div style="flex:1">${bar(c.wear, 100, c.wear > 75 ? 'var(--bad)' : c.wear > 50 ? 'var(--warn)' : 'var(--good)')}</div><span class="mono tiny" style="width:40px">${Math.round(c.wear)}%</span><span class="mono tiny ${c.used >= al ? 'warn' : ''}" style="width:34px">${al === Infinity ? c.used + '/∞' : c.used + '/' + al}</span><button class="btn sm" data-act="fitComp" data-arg="${slot}:${k}">New</button></div>`; }).join('')}</div>`).join('')}</div></div>`;
}
on({ fitComp: async (arg) => { const [slot, k] = arg.split(':'); const s = S(); const t = P(); const c = ensurePC(t)[+slot][k]; const over = c.used + 1 > allowance(s, k); const ok = await confirmBox(`Fit a new ${COMP[k].name}?`, `Costs $0.25M. ${k === 'GB' ? (s.weekend?.parcFerme ? '<b class="bad">The car is in parc fermé: changing the gearbox now means a pit-lane start.</b>' : 'Gearboxes have no season limit: no penalty.') : over ? `<b class="bad">Beyond the allocation: ${c.pens ? 5 : 10}-place grid penalty.</b>` : 'Within the allocation, so no penalty.'}`, 'Fit part'); if (!ok) return; const pen = C.fitComponent(s, +slot, k); toast(pen ? `New part fitted: ${pen}-place grid penalty.` : 'New part fitted.', pen ? 'warn' : 'good'); persist(); render(); } });

// ---------------- Facilities ----------------
const FAC_FX = { windTunnel: (l) => `${Math.round(60 + l * 8)}% correlation`, cfd: (l) => `±${(0.5 - l * 0.07).toFixed(2)} estimate error`, rnd: (l) => `${2 + Math.floor(l / 2)} design slots, +${l * 4}% speed`, factory: (l) => `+${l * 5}% build speed`, relLab: (l) => `−${l * 6}% failure rate`, simulator: (l) => `+${l * 4}% setup start, driver growth`, analysis: (l) => `${Math.round(55 + l * 8)}% forecast accuracy`, pitCentre: (l) => `≈${(2.9 - l * 0.12).toFixed(2)}s avg stop` };
const facEffect = (k, l) => (FAC_FX[k] ? FAC_FX[k](l) : 'L' + l);
screen('facilities', {
  render() {
    const s = S(); const t = P();
    const up = Object.entries(t.facilities).reduce((a, [k, l]) => a + FACILITIES[k].upkeep * l, 0);
    return `<div class="pagehead"><h1>Facilities</h1>${helpBtn('facilities')}</div><div class="devhead"><div class="dh"><b>${avg(Object.values(t.facilities)).toFixed(1)}</b><span>Average level</span></div><div class="dh"><b>${money(up * 2)}</b><span>Operating cost / season</span></div><div class="dh"><b>${t.facilityBuilds.length}</b><span>Under construction</span></div><div class="dh"><b class="${t.cash < 0 ? 'bad' : ''}">${money(t.cash)}</b><span>Cash</span></div></div><div class="grid g3">${Object.entries(FACILITIES).map(([k, f]) => { const lvl = t.facilities[k]; const b = t.facilityBuilds.find((x) => x.key === k); const cost = C.facilityCost(s, k); return `<div class="card"><div class="row"><h3 style="margin:0">${f.label}</h3><span class="sp"></span><b>L${lvl}</b></div><div class="row" style="gap:3px;margin:.4rem 0">${[1, 2, 3, 4, 5].map((i) => `<i style="flex:1;height:8px;border-radius:3px;background:${i <= lvl ? 'var(--team)' : '#263045'}"></i>`).join('')}</div><p class="small muted">${f.desc}</p><div class="facfx"><span>Now: <b>${facEffect(k, lvl)}</b></span>${lvl < 5 ? `<span>L${lvl + 1}: <b class="good">${facEffect(k, lvl + 1)}</b></span>` : ''}</div><div class="small">Upkeep: ${money(f.upkeep * lvl)}/season</div>
      ${b ? `<div class="small warn" style="margin-top:.4rem">Under construction — ${b.weeksLeft} wk left</div>${bar(b.total - b.weeksLeft, b.total)}` : lvl < 5 ? `<button class="btn sm" style="margin-top:.5rem" data-act="upFac" data-arg="${k}">Upgrade to L${lvl + 1}: ${money(cost)} · ${f.weeks + lvl} wk</button>` : '<div class="small good" style="margin-top:.4rem">Maximum level</div>'}</div>`; }).join('')}</div>
    <p class="small muted">Facilities multiply staff skill: a great aero director in a weak tunnel is capped; a great tunnel with weak staff under-delivers. Upgrades don't count towards the cost cap but add operating cost.</p>`;
  },
});
on({ upFac: async (k) => { const ok = await confirmBox('Upgrade facility?', `${FACILITIES[k].label} → L${P().facilities[k] + 1} for ${money(C.facilityCost(S(), k))}. Operating costs rise.`); if (!ok) return; const r = C.upgradeFacility(S(), k); if (!r.ok) return toast(r.msg, 'warn'); persist(); render(); toast('Construction started.', 'good'); } });

// ---------------- Staff ----------------
screen('staff', {
  render() {
    const s = S(); const t = P(); const tab = app.tab.staff || 'depts';
    return `<div class="pagehead"><h1>Staff & Departments</h1>${helpBtn('staff')}</div>${tabs('staff', [['depts', 'Departments'], ['market', 'Recruitment market']], tab)}${tab === 'depts' ? deptsTab(s, t) : marketTab(s, t)}`;
  },
});
function deptsTab(s, t) {
  const td = t.td;
  return `<div class="card"><div class="row"><h3 style="margin:0">Technical Director: ${esc(td.name)}</h3>${pill('Skill ' + td.skill)}${pill(td.spec)}<span class="sp"></span><span class="small muted">${money(td.salary)}/yr</span></div><p class="small muted">The TD lifts every technical department's output.</p></div>
  <div class="row" style="margin:.6rem 0"><label class="small" style="margin:0"><input type="checkbox" ${t.crunch ? 'checked' : ''} data-change="crunch"> Factory crunch mode</label><span class="small muted">Speeds development 25%, raises fatigue and failure risk.</span></div>
  <div class="card tw"><table><thead><tr><th>Department</th><th>Head</th><th>Skill</th><th>Output</th><th>Morale</th><th>Fatigue</th><th>Workload</th><th>Headcount</th><th>Salary</th><th></th></tr></thead><tbody>
  ${Object.entries(t.depts).map(([k, d]) => `<tr><td><b>${DEPARTMENTS[k].label}</b><div class="tiny muted">${DEPARTMENTS[k].affects}</div></td><td>${esc(d.head.name)}<div class="tiny muted" title="${esc(SPEC_DESC[d.head.spec])}">${d.head.spec} · age ${d.head.age} · loyalty ${d.head.loyalty}</div></td><td>${d.head.skill}</td><td>${Math.round(deptQ(t, k))}</td><td style="color:${sevColor(d.morale)}">${Math.round(d.morale)}</td><td style="color:${d.fatigue > 60 ? 'var(--bad)' : d.fatigue > 35 ? 'var(--warn)' : ''}">${Math.round(d.fatigue)}</td><td>${Math.round(d.workload)}%</td>
  <td><div class="row" style="flex-wrap:nowrap;gap:.2rem"><button class="btn sm" data-act="hc" data-arg="${k}:-1" aria-label="Reduce headcount">−</button><b>${d.headcount}</b><button class="btn sm" data-act="hc" data-arg="${k}:1" aria-label="Increase headcount">+</button></div></td><td class="small">${money(d.head.salary)}</td>
  <td><div class="row" style="flex-wrap:nowrap;gap:.2rem"><button class="btn sm" data-act="raise" data-arg="${k}" title="+15% salary, morale & loyalty">Raise</button><button class="btn sm" data-act="rest" data-arg="${k}" title="-25 fatigue, projects +1 week">Break</button>${d.leave ? (d.leave.on ? pill('🏖 On leave', 'info') : `<button class="btn sm ghost" data-act="leaveX" data-arg="${k}" title="Cancel planned leave">🏖 Week ${d.leave.start} ✕</button>`) : `<button class="btn sm" data-act="leave" data-arg="${k}" title="Plan one week of leave next week: fatigue −35, this department\'s projects pause for that week">🏖 Plan leave</button>`}</div></td></tr>`).join('')}</tbody></table></div>
  <p class="small muted">Each headcount step costs ~$0.45M/season. Every department settles at a baseline fatigue of 20 when idle. <b>🏖 Planned leave</b>: one week off (booked for next week) cuts fatigue by 35 and lifts morale, but that department's design/manufacturing work stops for the week — you get an inbox message when it starts and ends. Rival teams follow the same rule and send staff on leave when fatigue passes 60. Working on projects raises it according to the size of the work (both-car sets, aggressive concepts, long projects) and crunch; high fatigue causes failed prototypes, slow stops and defects.</p>`;
}
on({
  hc: (arg) => { const [k, d] = arg.split(':'); C.changeHeadcount(S(), k, +d); persist(); render(); },
  raise: (k) => { C.giveRaise(S(), k); persist(); render(); toast('Salary raised.'); },
  leave: (k) => { const r = PE.planLeave(S(), k, 1); toast(r.msg, r.ok ? 'good' : 'bad'); persist(); render(); },
  leaveX: (k) => { const r = PE.cancelLeave(S(), k); toast(r.msg); persist(); render(); },
  rest: (k) => { C.giveBreak(S(), k); persist(); render(); toast('Department rested.'); },
});
function marketTab(s, t) {
  if (!s.staffMarket.length) return '<div class="empty">No candidates available right now.</div>';
  return `<div class="card tw"><table><thead><tr><th>Candidate</th><th>Role</th><th>Skill</th><th>Potential</th><th>Speciality</th><th>Leadership</th><th>Salary</th><th>vs current</th><th></th></tr></thead><tbody>${s.staffMarket.map((c) => { const cur = c.dept === 'td' ? t.td : t.depts[c.dept]?.head; const d = c.skill - (cur?.skill || 0); return `<tr><td>${esc(c.name)} <span class="tiny muted">age ${c.age}</span></td><td>${esc(c.role)}</td><td>${c.skill}</td><td>${c.potential}</td><td title="${esc(SPEC_DESC[c.spec])}">${c.spec}</td><td>${c.leadership}</td><td>${money(c.salary)}</td><td class="${d >= 0 ? 'good' : 'bad'}">${d >= 0 ? '+' : ''}${d}</td><td><button class="btn sm" data-act="hire" data-arg="${c.id}">Hire (fee ${money(c.salary * 0.5)})</button></td></tr>`; }).join('')}</tbody></table></div><p class="small muted">Hiring replaces the current head (30% severance). The market changes between races.</p>`;
}
on({ hire: async (id) => { const c = S().staffMarket.find((x) => x.id === id); const ok = await confirmBox('Hire ' + c.name + '?', `Replaces your current ${esc(c.role)}. Signing fee ${money(c.salary * 0.5)} plus severance.`); if (!ok) return; const r = C.hireStaff(S(), id); if (!r.ok) return toast(r.msg || 'Could not hire', 'warn'); persist(); render(); } });

// ---------------- Drivers ----------------
screen('drivers', {
  render() {
    const s = S(); const t = P(); const tab = app.tab.drv || 'team';
    return `<div class="pagehead"><h1>Drivers</h1>${helpBtn('drivers')}</div>${tabs('drv', [['team', 'Our drivers'], ['market', 'Driver market'], ['academy', 'Academy']], tab)}${{ team: drvTeam, market: drvMarket, academy: drvAcademy }[tab](s, t)}`;
  },
});
const skillRow = (d) => ['pace', 'craft', 'cons', 'tyre', 'wet', 'fb', 'start'].map((k) => `<div class="small">${{ pace: 'Pace', craft: 'Racecraft', cons: 'Consistency', tyre: 'Tyre mgmt', wet: 'Wet', fb: 'Feedback', start: 'Starts' }[k]} <b style="float:right">${Math.round(d[k])}</b>${bar(d[k], 100)}</div>`).join('');
const TRAIN_GROUPS = [['💪 Physical', ['fitness']], ['🧠 Technical', ['sim', 'tyre']], ['🏁 Racecraft', ['craft', 'wet']]];
function drvTeam(s, t) {
  PE.ensureAcademy(s);
  const rs = s.reserve && s.drivers[s.reserve];
  const top = `<div class="card hqstrip"><div class="row"><b>Driver order</b><span class="tiny muted">The first driver is shown first / on the left / on top in Practice, Qualifying and Race.</span><span class="sp"></span><button class="btn sm" data-act="swapDrv">⇅ Swap order (${esc(s.drivers[t.drivers[1]].name.split(' ').pop())} first)</button></div>
    <div class="row" style="margin-top:.5rem"><b>Reserve driver</b>${rs ? `<span>${esc(rs.name)} <span class="tiny muted">age ${rs.age} · rating ${driverRating(rs).toFixed(0)} · car familiarity ${Math.round((rs.carFam ?? 0.2) * 100)}%</span></span><span class="sp"></span>${t.drivers.map((x, i) => `<button class="btn sm" data-act="resSwap" data-arg="${i}">⇄ Race seat for ${esc(s.drivers[x].name.split(' ').pop())}</button>`).join('')}<button class="btn sm ghost" data-act="resRel">Release</button>` : `<span class="tiny muted">None. A reserve covers injuries, gains familiarity in tests and can be swapped into a race seat between weekends.</span><span class="sp"></span><select data-change="resSign" aria-label="Sign reserve"><option value="">Sign a reserve…</option>${PE.reserveCandidates(s).sort((a, b) => driverRating(b) - driverRating(a)).slice(0, 14).map((d) => `<option value="${d.id}">${esc(d.name)} (${d.academy ? 'academy' : 'free agent'}, ${driverRating(d).toFixed(0)})</option>`).join('')}</select>`}</div></div>`;
  const h2h = { q: [0, 0], r: [0, 0] };
  for (const r of s.results.filter((x) => x.season === s.season)) { const a = r.rows.find((x) => x.did === t.drivers[0]), b = r.rows.find((x) => x.did === t.drivers[1]); if (a && b) { if (a.grid < b.grid) h2h.q[0]++; else h2h.q[1]++; if (a.pos < b.pos) h2h.r[0]++; else h2h.r[1]++; } }
  return `${top}<div class="grid g2">${t.drivers.map((id, i) => { const d = s.drivers[id]; return `<div class="card drvcard" style="--tc:${t.color}"><div class="drvslot">${i === 0 ? 'Driver 1 · shown first' : 'Driver 2'}</div><div class="row"><h3 style="margin:0">${esc(d.name)}</h3><span class="muted small">${d.nat} · ${d.age}</span><span class="sp"></span>${pill(PERSONALITIES[d.pers].label)}</div><p class="tiny muted">${esc(PERSONALITIES[d.pers].desc)}</p>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:.3rem .8rem">${skillRow(d)}<div class="small">Potential <b style="float:right">${d.pot}</b>${bar(d.pot, 100, 'var(--accent2)')}</div></div>
    <div class="row small" style="margin-top:.5rem"><span>Morale <b style="color:${sevColor(d.morale)}">${Math.round(d.morale)}</b></span><span>Confidence <b>${Math.round(d.confidence)}</b></span><span>Season pts <b>${d.seasonPts || 0}</b></span></div>
    <div class="trainbox"><div class="row"><b class="small">🎯 Training</b><span class="sp"></span><span class="tiny muted">Car familiarity ${Math.round((d.carFam ?? 0.3) * 100)}%</span></div>${d.training ? `<div class="trainon"><b>${C.TRAINING[d.training.k].label}</b><span class="tiny">${d.training.left} race(s) left · improving ${C.TRAINING[d.training.k].stats.join(', ')}</span>${bar(C.TRAINING[d.training.k].races - d.training.left, C.TRAINING[d.training.k].races, 'var(--good)')}</div>` : `<div class="traingrid">${TRAIN_GROUPS.map(([g, ks]) => `<div class="tg"><div class="tiny muted">${g}</div>${ks.map((k) => { const tr = C.TRAINING[k]; return `<button class="tbtn" data-act="train" data-arg="${id}:${k}" title="${esc(tr.desc)}"><b>${tr.label}</b><span>${tr.stats.map((x) => `${x} ${Math.round(d[x])}`).join(' · ')}</span><em>${money(tr.cost)} · ${tr.races} races</em></button>`; }).join('')}</div>`).join('')}</div>${t.cash < 1e6 ? '<div class="tiny warn">Cash is low — training can still be paid on credit (cash goes negative, board notices).</div>' : ''}`}</div>
    <div class="small" style="margin-top:.3rem">📝 Contract <b>${PE.contractText(s, d)}</b> · ${money(d.contract.salary)}/yr</div><div class="small">🎧 Engineer rapport <b>${PE.rapportText(d.rapport)}</b> ${bar((d.rapport || 0) * 100, 100, 'var(--accent2)')}<span class="tiny muted">Grows every race weekend together. Faster setup/aero understanding in practice and slow gains in feedback, consistency and tyre sense. Resets if the driver changes team.</span></div>
    ${d.contract.years <= 1 ? `<div class="row" style="margin-top:.4rem"><button class="btn sm" data-act="renew" data-arg="${id}:1">Extend 1 yr</button><button class="btn sm" data-act="renew" data-arg="${id}:2">Extend 2 yrs</button><button class="btn sm" data-act="renew" data-arg="${id}:3">Extend 3 yrs</button></div>` : ''}</div>`; }).join('')}</div>
  <div class="card" style="margin-top:1rem"><h3>Teammate comparison (this season)</h3><div class="small">Qualifying: ${esc(s.drivers[t.drivers[0]].name)} ${h2h.q[0]} – ${h2h.q[1]} ${esc(s.drivers[t.drivers[1]].name)}<br>Race: ${h2h.r[0]} – ${h2h.r[1]}</div></div>`;
}
on({ train: (arg) => { const [id, k] = arg.split(':'); const r = C.startTraining(S(), id, k); toast(r.msg, r.ok ? 'good' : 'bad'); persist(); render(); } });
on({ renew: (arg) => { const [id, y] = arg.split(':'); const r = C.renewDriver(S(), id, +y); toast(r.msg, r.ok ? 'good' : 'bad'); if (r.ok) S().drivers[id]._renewed = true; persist(); render(); } });
function drvMarket(s, t) {
  const list = Object.values(s.drivers).filter((d) => d.teamId !== t.id && !d.retired && !d.academy).sort((a, b) => driverRating(b) - driverRating(a));
  return `<div class="card tw"><table><thead><tr><th>Driver</th><th>Age</th><th>Team</th><th>Rating</th><th>Pace</th><th>Wet</th><th>Potential</th><th>Contract</th><th>Est. salary</th><th>Interest</th><th></th></tr></thead><tbody>${list.map((d) => { const tm = s.teams[d.teamId]; const ch = C.acceptChance(s, d); return `<tr><td>${esc(d.name)} <span class="tiny muted">${PERSONALITIES[d.pers].label}</span></td><td>${d.age}</td><td>${tm ? `<span class="sw" style="background:${tm.color}"></span>${tm.abbr}` : '<span class="good">Free agent</span>'}</td><td>${driverRating(d).toFixed(0)}</td><td>${Math.round(d.pace)}</td><td>${Math.round(d.wet)}</td><td>${d.pot}</td><td>${tm ? 'end ' + PE.contractEndYear(s, d) : '—'}</td><td>${money(driverSalary(d) * (tm ? 1.25 : 1))}</td><td style="color:${sevColor(ch * 100, 60, 35)}">${ch > 0.6 ? 'Keen' : ch > 0.35 ? 'Open' : ch > 0.2 ? 'Reluctant' : 'Not interested'}</td><td><div class="row" style="flex-wrap:nowrap;gap:.2rem">${t.drivers.map((x, i) => `<button class="btn sm" data-act="sign" data-arg="${d.id}:${i}" title="Replace ${esc(s.drivers[x].name)}">⇄ ${esc(s.drivers[x].name.split(' ').pop())}</button>`).join('')}</div></td></tr>`; }).join('')}</tbody></table></div><p class="small muted">Signing a contracted driver requires a buy-out. The replaced driver becomes a free agent (or moves to the other team).</p>`;
}
on({ sign: async (arg) => { const [id, slot] = arg.split(':'); const d = S().drivers[id]; const ok = await confirmBox(`Sign ${d.name}?`, `Replaces ${esc(S().drivers[P().drivers[+slot]].name)} immediately.${d.teamId ? ' A contract buy-out is required.' : ''}`); if (!ok) return; const r = C.signDriver(S(), id, +slot); toast(r.ok ? 'Driver signed.' : r.msg, r.ok ? 'good' : 'bad'); persist(); render(); } });
function drvAcademy(s, t) {
  PE.ensureAcademy(s);
  const ord = s.acOrder || []; const mine = PE.academyOf(s).sort((a, b) => ((ord.indexOf(a.id) + 1 || 99) - (ord.indexOf(b.id) + 1 || 99)));
  const pool = PE.academyPool(s).sort((a, b) => b.pot - a.pot);
  const card = (d, i) => `<div class="card accard"><div class="row"><b>${esc(d.name)}</b><span class="muted small">${d.nat || ''} · ${d.age}</span><span class="sp"></span>${pill('Pot ' + d.pot, 'good')}${i > 0 ? `<button class="btn sm ghost" data-act="acUp" data-arg="${d.id}" title="Move up (show first)">▲</button>` : ''}</div>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:.2rem .6rem;margin-top:.4rem">${skillRow(d)}</div>
    <div class="trainbox"><b class="small">🎯 Junior training</b>${d.acTrain ? `<div class="trainon"><b>${PE.AC_TRAINING[d.acTrain.k].label}</b><span class="tiny">${d.acTrain.left} race(s) left · improving ${PE.AC_TRAINING[d.acTrain.k].stats.join(', ')}</span></div>` : `<div class="traingrid">${Object.entries(PE.AC_TRAINING).map(([k, tr]) => `<button class="tbtn" data-act="acTrain" data-arg="${d.id}:${k}"><b>${tr.label}</b><span>${tr.stats.map((x) => `${x} ${Math.round(d[x])}`).join(' · ')}</span><em>${money(tr.cost)} · ${tr.races} races</em></button>`).join('')}</div>`}</div>
    <div class="row" style="margin-top:.5rem">${t.drivers.map((x, j) => `<button class="btn sm" data-act="promote" data-arg="${d.id}:${j}">Promote over ${esc(s.drivers[x].name.split(' ').pop())}</button>`).join('')}${s.reserve !== d.id ? `<button class="btn sm" data-act="acRes" data-arg="${d.id}">Make reserve</button>` : pill('Reserve', 'info')}<button class="btn sm danger" data-act="acRel" data-arg="${d.id}">Release</button></div></div>`;
  return `<div class="card hqstrip"><b>Your academy (${mine.length}/${PE.ACADEMY_MAX})</b> <span class="tiny muted">Place fee ${money(PE.ACADEMY_FEE)} per junior. Juniors grow every race (faster with training) and every season.</span></div>
  <div class="grid g3">${mine.map(card).join('') || '<div class="empty">No juniors signed — pick from the scouting list below.</div>'}</div>
  <h3 style="margin-top:1rem">🔭 Scouting list — choose who joins</h3><div class="card tw"><table><thead><tr><th>Junior</th><th>Age</th><th>Pace</th><th>Racecraft</th><th>Wet</th><th>Potential</th><th></th></tr></thead><tbody>${pool.map((d) => `<tr><td>${esc(d.name)} <span class="tiny muted">${d.nat || ''}</span></td><td>${d.age}</td><td>${Math.round(d.pace)}</td><td>${Math.round(d.craft)}</td><td>${Math.round(d.wet)}</td><td><b>${d.pot}</b></td><td><button class="btn sm primary" data-act="acSign" data-arg="${d.id}">Sign</button> <button class="btn sm ghost" data-act="acRej" data-arg="${d.id}">Reject</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">No more prospects this season — a new list arrives next season.</td></tr>'}</tbody></table></div>`;
}
const peAct = (fn) => (arg) => { const r = fn(arg); if (r?.msg) toast(r.msg, r.ok === false ? 'bad' : 'good'); persist(); render(); };
on({
  swapDrv: peAct(() => PE.swapDrivers(S())),
  resSwap: peAct((a) => PE.swapReserve(S(), +a)), resRel: peAct(() => PE.releaseReserve(S())),
  resSign: (v, el) => { const id = el?.value ?? v; if (!id) return; peAct(() => PE.signReserve(S(), id))(); },
  acSign: peAct((a) => PE.academySign(S(), a)), acRel: peAct((a) => PE.academyRelease(S(), a)), acRej: peAct((a) => PE.academyReject(S(), a)),
  acTrain: peAct((a) => { const [id, k] = a.split(':'); return PE.academyTrain(S(), id, k); }), acRes: peAct((a) => PE.signReserve(S(), a)),
  acUp: peAct((a) => { const s = S(); const mine = PE.academyOf(s); const ord = s.acOrder?.length ? s.acOrder.filter((x) => mine.some((m) => m.id === x)) : mine.map((m) => m.id); for (const m of mine) if (!ord.includes(m.id)) ord.push(m.id); const i = ord.indexOf(a); if (i > 0) { [ord[i - 1], ord[i]] = [ord[i], ord[i - 1]]; } s.acOrder = ord; return { ok: true }; }),
});
on({ promote: async (arg) => { const [id, slot] = arg.split(':'); const ok = await confirmBox('Promote junior?', 'The replaced driver leaves the team.'); if (!ok) return; const r = C.promoteJunior(S(), id, +slot); toast(r.ok ? 'Promoted.' : r.msg, r.ok ? 'good' : 'bad'); persist(); render(); } });

// ---------------- Finance ----------------
function lastRaceIncome(s) { const r = s.round - 1; const o = {}; for (const l of s.ledger) if (l.season === s.season && l.round === r && l.amount > 0) o[l.text.replace(/ \(.*\)/, '')] = (o[l.text.replace(/ \(.*\)/, '')] || 0) + l.amount; return o; }
screen('finance', {
  render() {
    const s = S(); const t = P();
    const season = s.ledger.filter((l) => l.season === s.season);
    const cats = {}; for (const l of season) cats[l.cat] = (cats[l.cat] || 0) + l.amount;
    const chron = [...season].reverse(); let run = t.cash - season.reduce((a, l) => a + l.amount, 0); const pts = [run]; for (const l of chron) { run += l.amount; pts.push(run / 1e6); }
    pts[0] = pts[0] / 1e6;
    return `<div class="pagehead"><h1>Finance</h1>${helpBtn('finance')}</div>
    <div class="grid g4"><div class="card stat"><b class="${t.cash < 0 ? 'bad' : ''}">${money(t.cash)}</b><span>Cash</span></div><div class="card stat"><b>${money(t.budgetSpent)}</b><span>Cost-cap spend (cap ${money(COST_CAP)})</span>${bar(t.budgetSpent, COST_CAP, t.budgetSpent > COST_CAP * 0.9 ? 'var(--bad)' : null)}</div><div class="card stat"><b>${money(s.sponsors.reduce((a, x) => a + x.perRace, 0) * 12 / s.calendar.length)}</b><span>Sponsor income / race</span></div><div class="card stat"><b>${money(s.loan || 0)}</b><span>Loan due at season end</span></div></div>
    <div class="grid g2" style="margin-top:1rem"><div class="card"><h3>Cash this season ($M)</h3>${lineChart([{ name: 'Cash', color: '#2ecc71', points: pts }], { xLabel: 'Transactions' })}</div>
    <div class="card"><h3>By category</h3>${barChart(Object.entries(cats).map(([k, v]) => ({ label: k.slice(0, 8), v, color: v >= 0 ? '#2ecc71' : '#ff4d5e' })), { fmt: money })}</div></div>
    ${t.cash < 10e6 ? `<div class="card" style="margin-top:1rem;border-color:var(--bad)"><h3>Cash-crisis options</h3><div class="row"><button class="btn" data-act="loan" data-arg="10000000">Loan $10M (repay $11.5M, board −5)</button><button class="btn" data-act="loan" data-arg="20000000">Loan $20M (repay $23M, board −5)</button><button class="btn" data-act="advance">Sponsor advance (2 races, 15% discount)</button></div><p class="small muted">Other levers: reduce headcount, pause projects (don't start new ones), delay facility upgrades, sign cheaper drivers.</p></div>` : ''}
    <div class="card" style="margin-top:1rem"><h3>How the money works</h3><div class="moneyflow">
      <div class="mf in"><b>Every race</b><span>FOM equal share · FOM points share · Paddock Club hospitality · merchandise · TV/media bonus · sponsors</span></div>
      <div class="mf out"><b>Every race</b><span>Staff & driver pay · PU ${t.puSup === 'inhouse' ? 'running costs' : 'lease'} · logistics · facilities · crash damage</span></div>
      <div class="mf in"><b>Season end</b><span>Constructors' bonus: P1 ${money(seasonBonus(1))} → P10 ${money(seasonBonus(10))} (≈0.9% of the pool per place)</span></div>
      <div class="mf"><b>Carry-over</b><span>All teams start with the same purse. Whatever is left — positive <i>or negative</i> — carries into next year. Administration below ${money(-60e6)}.</span></div></div>
      <div class="row small" style="margin-top:.5rem">${Object.entries(lastRaceIncome(s)).map(([k, v]) => `<span class="pill">${esc(k)} ${money(v)}</span>`).join('')}</div></div>
    <div class="card" style="margin-top:1rem"><h3>Ledger</h3><div class="tw" style="max-height:420px;overflow:auto"><table><thead><tr><th>When</th><th>Category</th><th>Item</th><th style="text-align:right">Amount</th></tr></thead><tbody>${s.ledger.slice(0, 120).map((l) => `<tr><td class="tiny muted">S${l.season} R${l.round + 1}</td><td>${esc(l.cat)}</td><td class="small">${esc(l.text)}</td><td class="mono ${l.amount >= 0 ? 'good' : 'bad'}" style="text-align:right">${money(l.amount)}</td></tr>`).join('')}</tbody></table></div></div>`;
  },
});
on({ loan: (a) => { C.takeLoan(S(), +a); persist(); render(); }, advance: () => { C.sponsorAdvance(S()); persist(); render(); } });

// ---------------- Sponsors ----------------
screen('sponsors', {
  render() {
    const s = S(); const sf = 12 / s.calendar.length;
    return `<div class="pagehead"><h1>Sponsors</h1>${helpBtn('sponsors')}</div><h3>Current partners (${s.sponsors.length}/4)</h3><div class="grid g3">${s.sponsors.map((x) => `<div class="card"><div class="row"><b>${esc(x.name)}</b>${x.volatile ? pill('Volatile', 'warn') : ''}</div><div class="small">Objective: ${OBJ_TEXT[x.objective](x.target)}<br>Base: ${money(x.perRace * sf)}/race · Bonus ${money(x.bonus)}<br>Races left: ${x.racesLeft}${x.term ? ` · <span class="pill">${SPONSOR_TERMS[x.term]?.label || ''}</span>` : ''}</div><div class="small" style="margin-top:.4rem">Satisfaction ${bar(x.sat, 100, sevColor(x.sat, 55, 30))}</div></div>`).join('') || '<div class="empty">No sponsors.</div>'}</div>
    <h3 style="margin-top:1rem">Offers</h3><div class="grid g3">${s.sponsorOffers.map((o) => `<div class="card"><b>${esc(o.name)}</b><div class="small">Objective: ${OBJ_TEXT[o.objective](o.target)}<br>${money(o.perRace * sf)}/race for ${o.racesLeft} races · bonus ${money(o.bonus)}<br><span class="muted">Offer expires after round ${o.expires + 1}</span></div><div class="terms">${Object.entries(SPONSOR_TERMS).map(([k, T]) => `<button class="term" data-act="accSp" data-arg="${o.id}:${k}" ${s.sponsors.length >= 4 ? 'disabled' : ''} title="${esc(T.desc)}"><b>${T.label}</b><span>${money(o.perRace * T.pay * sf)}/race · ${Math.min(T.races(s.calendar.length), k === 'multi' ? s.calendar.length * 2 : s.calendar.length - s.round)} races</span><em>bonus ${money(o.bonus * T.bonus)}</em></button>`).join('')}</div><div class="row" style="margin-top:.4rem"><button class="btn sm" data-act="negSp" data-arg="${o.id}" ${o.negotiated ? 'disabled' : ''}>Negotiate +15% first</button></div></div>`).join('') || '<div class="empty">No offers right now. Results, reputation and a strong Commercial department attract partners.</div>'}</div>`;
  },
});
on({ accSp: (arg) => { const [id, term] = arg.split(':'); C.acceptSponsor(S(), id, term); persist(); render(); }, negSp: (id) => { toast(C.negotiateSponsor(S(), id)); persist(); render(); } });

// ---------------- Board ----------------
function boardMood(s, t, pos) {
  const m = []; const tg = s.board.target;
  m.push(pos <= tg ? ['good', `Running P${pos}, target P${tg}.`] : ['bad', `Running P${pos}, ${pos - tg} place(s) below target P${tg}.`]);
  m.push(t.cash >= 0 ? ['good', `Finances positive (${money(t.cash)}).`] : ['bad', `Spending on credit (${money(t.cash)}) — every race below zero costs confidence.`]);
  if (t.budgetSpent > COST_CAP * 0.9) m.push(['bad', 'Close to the cost cap.']);
  const act = s.projects.filter((p) => ['design', 'manufacturing'].includes(p.stage)).length; m.push(act ? ['good', `${act} development project(s) running.`] : ['info', 'The board wants to see the car being developed.']);
  if (s.sponsors.length >= 3) m.push(['good', `${s.sponsors.length} commercial partners.`]); else m.push(['info', 'More sponsors would please the board.']);
  return m;
}
screen('board', {
  render() {
    const s = S(); const t = P(); const pos = C.teamPos(s, t.id);
    return `<div class="pagehead"><h1>Board</h1>${helpBtn('board')}</div><div class="grid g2"><div class="card"><h3>Confidence</h3><div class="stat"><b style="color:${sevColor(s.board.confidence, 55, 30)}">${Math.round(s.board.confidence)}%</b><span>Board confidence</span></div>${bar(s.board.confidence, 100, sevColor(s.board.confidence, 55, 30))}<p class="small muted">Patience: ${s.board.patience >= 1.2 ? 'High' : s.board.patience >= 0.9 ? 'Normal' : 'Low'}. Below ~10% you will be dismissed.</p>
    ${(s.board.hist || []).length > 1 ? lineChart([{ name: 'Confidence', color: '#4aa8ff', points: s.board.hist.map((h) => h.c) }], { xLabel: 'Races' }) : ''}
    <div class="boardmood">${boardMood(s, t, pos).map(([k, txt]) => `<div class="bm ${k}">${k === 'good' ? '👍' : k === 'bad' ? '👎' : '•'} ${esc(txt)}</div>`).join('')}</div>
    ${(s.board.hist || []).slice(-5).reverse().map((h) => `<div class="tiny"><span class="mono ${h.d >= 0 ? 'good' : 'bad'}">${h.d >= 0 ? '+' : ''}${h.d}</span> R${h.r}: ${esc(h.why)}</div>`).join('')}</div>
    <div class="card"><h3>Season objectives</h3>${(s.board.objectives || []).map((o) => { let st = ''; if (o.kind === 'cons') st = pos <= o.value ? 'On track' : 'Behind'; if (o.kind === 'cash') st = t.cash > 0 ? 'On track' : 'At risk'; if (o.kind === 'rel') { const n = s.results.filter((x) => x.season === s.season).flatMap((x) => x.rows).filter((x) => x.teamId === t.id && x.dnf && /failure|fault/i.test(x.dnf)).length; st = `${n} so far`; } return `<div class="row small" style="margin:.3rem 0"><span>${esc(o.text)}</span><span class="sp"></span>${pill(st, /On track/.test(st) ? 'good' : /Behind|risk/.test(st) ? 'bad' : 'info')}</div>`; }).join('')}</div></div>
    <div class="card" style="margin-top:1rem"><h3>History</h3>${s.history.seasons.length ? `<table><thead><tr><th>Season</th><th>Pos</th><th>Points</th><th>Board</th></tr></thead><tbody>${s.history.seasons.map((h) => `<tr><td>${h.year}</td><td>P${h.pos}</td><td>${h.points}</td><td>${Math.round(h.board)}%</td></tr>`).join('')}</tbody></table>` : '<div class="muted small">First season in charge.</div>'}</div>`;
  },
});

on({ pickPU: async (k) => { const S2 = PU_SUPPLIERS[k]; const ok = await confirmBox(`${S2.name}?`, `${esc(S2.desc)} Applies from next season. Fee ${money(S2.fee)}/season${S2.setup && !P().puBuilt ? `, plus a one-off ${money(S2.setup)} factory build-up now` : ''}.`, 'Sign'); if (!ok) return; const r = C.choosePU(S(), k); toast(r.msg, r.ok ? 'good' : 'bad'); persist(); render(); } });
