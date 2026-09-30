// HQ and management screens: car development, facilities, staff, drivers, finance, sponsors, board.
import { COMP, COMP_KEYS, allowance, ensurePC } from '../engines/components.js';
import { app, screen, on, go, esc, persist, toast, render, modal, closeModal, confirmBox } from './app.js';
import { trackById } from '../data/tracks.js';
import { CAR_ATTRS, ATTR_LABEL, PHILOSOPHIES, PROFILES } from '../data/teams.js';
import { PERSONALITIES } from '../data/drivers.js';
import { DEPARTMENTS, FACILITIES, PROJECTS, APPROACHES, EVENTS, SPEC_DESC, COST_CAP, OBJ_TEXT, REGULATIONS } from '../data/content.js';
import * as C from '../engines/careerEngine.js';
import { deptQ, driverRating, driverSalary, DIFFICULTY, facLvl } from '../engines/world.js';
import { effectiveCar } from '../engines/carModel.js';
import { money, avg, clamp, qual } from '../sim/util.js';
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
    return `<div class="pagehead"><h1>Team HQ</h1><span class="pill">${esc(PROFILES[t.profile]?.label || '')}</span><span class="pill">${esc(PHILOSOPHIES[t.philosophy]?.label || '')}</span></div>
    ${app.tutorial ? tutorialCard() : ''}
    <div class="grid g3">
      <div class="card"><h4>Next race</h4><h2 style="margin:.2rem 0">${esc(tr.name)}</h2><div class="small muted">${esc(tr.archetype)} · Round ${s.round + 1}/${s.calendar.length}</div>
        <div class="row" style="margin-top:.7rem"><button class="btn primary" data-act="go" data-arg="weekend" ${s.pendingEvent ? 'disabled title="Resolve the pending decision first"' : ''}>${s.weekend ? 'Resume weekend' : 'Go to race weekend'} →</button></div></div>
      <div class="card"><h4>Championship</h4><div class="row"><div class="stat"><b>P${pos}</b><span>Constructors</span></div><div class="stat"><b>${t.points}</b><span>Points</span></div><div class="stat"><b>P${s.board.target}</b><span>Target</span></div></div>
        <div class="small" style="margin-top:.5rem">${t.drivers.map((id) => `${esc(s.drivers[id].name)}: P${st.drivers.findIndex((d) => d.id === id) + 1} (${s.drivers[id].seasonPts || 0} pts)`).join('<br>')}</div></div>
      <div class="card"><h4>At risk</h4><div class="small">Board confidence ${bar(s.board.confidence, 100, sevColor(s.board.confidence, 55, 30))}Cost cap used ${bar(t.budgetSpent, COST_CAP, t.budgetSpent > COST_CAP * 0.9 ? 'var(--bad)' : null)}Team morale ${bar(avg(Object.values(t.depts).map((d) => d.morale)), 100, sevColor(avg(Object.values(t.depts).map((d) => d.morale))))}Staff fatigue ${bar(avg(Object.values(t.depts).map((d) => d.fatigue)), 100, 'var(--warn)')}</div></div>
    </div>
    <div class="grid g2" style="margin-top:1rem">
      <div class="col">${eventCard(s)}<div class="card"><h3>Needs attention</h3>${attn.length ? attn.map(([k, txt, r]) => `<div class="alert ${k}"><a href="#/${r}" style="color:inherit;text-decoration:none">${esc(txt)} →</a></div>`).join('') : '<div class="muted small">Nothing urgent. Consider long-term investments.</div>'}</div>
        <div class="card"><h3>Car vs field ${helpBtn('car')}</h3>${CAR_ATTRS.map((k) => { const mine = t.car[k]; const fa = avg(field.map((x) => x.car[k])); const d = mine - fa; return `<div class="row small" style="margin:.15rem 0"><span style="width:140px">${ATTR_LABEL[k]}</span><div style="flex:1">${bar(mine, 110, d > 1 ? 'var(--good)' : d < -1 ? 'var(--bad)' : null)}</div><span class="mono" style="width:48px;text-align:right" class="${d >= 0 ? 'good' : 'bad'}">${d >= 0 ? '+' : ''}${d.toFixed(1)}</span></div>`; }).join('')}<div class="tiny muted">Difference vs AI field average (estimate).</div></div></div>
      <div class="col"><div class="card"><h3>Inbox</h3>${s.inbox.slice(0, 10).map((m) => `<div class="alert ${m.sev === 'info' ? '' : m.sev} small">${m.season ? `<span class="muted tiny">S${m.season} R${m.round + 1}</span> ` : ''}${esc(m.text)}</div>`).join('') || '<div class="muted">Empty</div>'}</div>
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
screen('car', {
  render() {
    const s = S(); const t = P(); const tab = app.tab.car || 'dev';
    return `<div class="pagehead"><h1>Car & Development</h1>${helpBtn('development')}</div>${tabs('car', [['dev', 'New project'], ['pipe', 'Pipeline & parts'], ['overview', 'Car overview'], ['next', 'Next-year car'], ['pu', 'Power units']], tab)}${{ dev: devTab, pipe: pipeTab, overview: overviewTab, next: nextTab, pu: puTab }[tab](s, t)}`;
  },
});
function devTab(s, t) {
  const sel = app.tab.prj || PROJECTS[0].id; const ap = app.tab.appr || 'standard'; const qty = app.tab.qty || 2;
  const pv = C.projectPreview(s, sel, ap, qty);
  const maxActive = 2 + Math.floor(facLvl(t, 'rnd') / 2); const active = s.projects.filter((p) => ['design', 'manufacturing'].includes(p.stage)).length;
  const info = DIFFICULTY[s.difficulty].info;
  const fx = Object.entries(pv.expected).map(([k, v]) => { const u = Math.abs(v) * pv.unc + 0.1 * (1 - info); return `<div class="row small"><span style="width:150px">${ATTR_LABEL[k]}</span><b class="${v >= 0 ? 'good' : 'bad'}">${v >= 0 ? '+' : ''}${(v - u).toFixed(1)} … ${v >= 0 ? '+' : ''}${(v + u).toFixed(1)}</b></div>`; }).join('');
  const purse = `<div class="grid g4" style="margin-bottom:1rem"><div class="card stat"><b class="${t.cash < 0 ? 'bad' : ''}">${money(t.cash)}</b><span>Season purse (cash)</span></div><div class="card stat"><b>${money(Math.max(0, COST_CAP - t.budgetSpent))}</b><span>Cost-cap headroom</span>${bar(t.budgetSpent, COST_CAP, t.budgetSpent > COST_CAP * 0.9 ? 'var(--bad)' : null)}</div><div class="card stat"><b>${active}/${maxActive}</b><span>R&D slots in use (R&D facility lvl ${facLvl(t, 'rnd')})</span></div><div class="card stat"><b>${Math.round(deptQ(t, 'aero'))}</b><span>Aero dept quality: affects the size of upgrade gains</span></div></div>`;
  return purse + `<div class="grid g2"><div class="card"><h3>Concepts</h3><p class="small muted">Capacity: ${active}/${maxActive} active projects (R&D Centre L${facLvl(t, 'rnd')}).</p><div class="col">${PROJECTS.map((p) => `<button class="choice ${sel === p.id ? 'on' : ''}" data-act="selPrj" data-arg="${p.id}"><div class="row"><b class="small">${esc(p.name)}</b><span class="sp"></span><span class="pill">${DEPARTMENTS[p.dept].label}</span></div><div class="tiny muted">${Object.keys(p.effects).map((k) => ATTR_LABEL[k]).join(', ')}${Object.keys(p.side).length ? ' · trade-off: ' + Object.keys(p.side).map((k) => ATTR_LABEL[k]).join(', ') : ''}</div></button>`).join('')}</div></div>
  <div class="card"><h3>${esc(pv.tpl.name)}</h3>
    <label>Approach</label><div class="seg">${Object.entries(APPROACHES).map(([k, a]) => `<button class="btn sm ${ap === k ? 'on' : ''}" data-act="selAppr" data-arg="${k}">${a.label}</button>`).join('')}</div><div class="tiny muted">${APPROACHES[ap].desc}</div>
    <label style="margin-top:.6rem">Part allocation</label><div class="seg"><button class="btn sm ${qty === 2 ? 'on' : ''}" data-act="selQty" data-arg="2">Both cars</button><button class="btn sm ${qty === 1 ? 'on' : ''}" data-act="selQty" data-arg="1">One car first (cheaper, faster to race)</button></div>
    <h4 style="margin-top:.8rem">Expected effect (range)</h4>${fx}
    <dl class="kv" style="margin-top:.6rem"><dt>Design cost</dt><dd>${money(pv.cost)}</dd><dt>Manufacturing</dt><dd>${money(pv.mfgCost)} (${pv.qty} set${pv.qty > 1 ? 's' : ''})</dd><dt>Design time</dt><dd>~${pv.weeks} weeks (+${pv.mfgWeeks} manufacturing)</dd><dt>Failure risk</dt><dd class="${pv.failP > 0.15 ? 'bad' : pv.failP > 0.07 ? 'warn' : ''}">${info >= 0.8 ? Math.round(pv.failP * 100) + '%' : pv.failP > 0.15 ? 'High' : pv.failP > 0.07 ? 'Moderate' : 'Low'}</dd><dt>Correlation confidence</dt><dd>${qual(pv.corr * 100)} ${pv.tpl.aero ? `<span class="muted tiny">(ATR ×${pv.atr.toFixed(2)})</span>` : ''}</dd><dt>Lead</dt><dd>${esc(t.depts[pv.tpl.dept].head.name)} (${t.depts[pv.tpl.dept].head.spec}, fatigue ${Math.round(t.depts[pv.tpl.dept].fatigue)})</dd></dl>
    <div class="row" style="margin-top:.8rem"><button class="btn primary" data-act="startPrj" ${active >= maxActive ? 'disabled' : ''}>Start project (${money(pv.cost)})</button><label class="small" style="margin:0"><input type="checkbox" ${t.crunch ? 'checked' : ''} data-change="crunch"> Crunch mode (+25% speed, fatigue & failure risk)</label></div></div></div>`;
}
on({
  selPrj: (id) => { app.tab.prj = id; render(); }, selAppr: (k) => { app.tab.appr = k; render(); }, selQty: (q) => { app.tab.qty = +q; render(); },
  startPrj: () => { const r = C.startProject(S(), app.tab.prj || PROJECTS[0].id, app.tab.appr || 'standard', app.tab.qty || 2); if (!r.ok) return toast(r.msg, 'warn'); persist(); toast(`${r.project.name} started.`, 'good'); app.tab.car = 'pipe'; render(); },
  crunch: (a, el) => { P().crunch = el.checked; persist(); render(); },
});
const fxText = (fx) => Object.entries(fx || {}).filter(([, v]) => Math.abs(v) > 0.05).map(([k, v]) => `${ATTR_LABEL[k]} ${v >= 0 ? '+' : ''}${v.toFixed(1)}`).join(', ');
function pipeTab(s, t) {
  const list = s.projects;
  if (!list.length) return '<div class="empty">No projects yet. Start one in "New project".</div>';
  return `<div class="col">${list.map((p) => {
    const stageLbl = { design: 'Design', manufacturing: 'Manufacturing', ready: 'Ready to deploy', deployed: 'Deployed', failed: 'Failed validation' }[p.stage];
    const prog = p.stage === 'design' ? (1 - p.weeksLeft / p.totalWeeks) * 100 : p.stage === 'manufacturing' ? 100 * (1 - p.weeksLeft / Math.max(1, p.mfgWeeks)) : 100;
    const cmp = p.stage === 'deployed' ? (p.revealed ? `<div class="small">Measured: <b>${fxText(p.actual)}</b><br><span class="muted">Predicted: ${fxText(p.expected)}</span></div>` : `<div class="small muted">Real gain not yet measured — run an Aero correlation test in practice or complete a race.</div>`) : `<div class="small muted">Expected: ${fxText(p.expected)}</div>`;
    return `<div class="card"><div class="row"><b>${esc(p.name)}</b>${pill(APPROACHES[p.approach].label)}${pill(stageLbl, p.stage === 'failed' ? 'bad' : p.stage === 'ready' ? 'good' : p.stage === 'deployed' ? 'info' : '')}<span class="sp"></span><span class="tiny muted">S${p.season}</span></div>
    ${['design', 'manufacturing'].includes(p.stage) ? `<div class="small" style="margin:.4rem 0">${p.weeksLeft} week(s) remaining${bar(prog)}</div>` : ''}${cmp}
    ${p.stage === 'ready' ? `<div class="row" style="margin-top:.5rem">${p.qty >= 2 ? `<button class="btn sm primary" data-act="deploy" data-arg="${p.id}:">Deploy to both cars</button>` : t.drivers.map((did, i) => `<button class="btn sm primary" data-act="deploy" data-arg="${p.id}:${i}">Fit to ${esc(s.drivers[did].name)}</button>`).join('')}</div>` : ''}
    ${p.stage === 'deployed' && p.slot != null ? `<div class="row" style="margin-top:.5rem"><span class="small warn">Only on ${esc(s.drivers[t.drivers[p.slot]].name)}'s car.</span><button class="btn sm" data-act="secondSet" data-arg="${p.id}">Build second set (${money(p.mfgCost)})</button></div>` : ''}</div>`;
  }).join('')}</div>`;
}
on({
  deploy: (arg) => { const [id, slot] = arg.split(':'); C.deployProject(S(), id, slot === '' ? null : +slot); persist(); render(); toast('Upgrade fitted.', 'good'); },
  secondSet: (id) => { C.buildSecondSet(S(), id); persist(); render(); },
});
function overviewTab(s, t) {
  const c0 = effectiveCar(t, 0), c1 = effectiveCar(t, 1);
  const rivals = Object.values(s.teams).filter((x) => !x.isPlayer);
  return `<div class="card"><div class="tw"><table><thead><tr><th>Attribute</th><th>${esc(s.drivers[t.drivers[0]].name)}</th><th>${esc(s.drivers[t.drivers[1]].name)}</th><th>Field best (est.)</th><th>Field avg</th></tr></thead><tbody>${CAR_ATTRS.map((k) => `<tr><td>${ATTR_LABEL[k]}</td><td class="mono">${c0[k].toFixed(1)}</td><td class="mono">${c1[k].toFixed(1)}</td><td class="mono muted">${Math.max(...rivals.map((r) => r.car[k])).toFixed(0)}</td><td class="mono muted">${avg(rivals.map((r) => r.car[k])).toFixed(1)}</td></tr>`).join('')}</tbody></table></div>
  <p class="small muted">Rival values are engineering estimates from GPS and speed-trap data. The same car performs differently at each circuit: see Car suitability in race preparation.</p></div>`;
}
function nextTab(s, t) {
  const reg = REGULATIONS.find((r) => r.id === s.regulation.next);
  return `<div class="card"><h3>Next-year resource split ${helpBtn('regs')}</h3>
  ${reg ? `<div class="alert warn">Confirmed for next season: <b>${esc(reg.name)}</b> — ${esc(reg.desc)}</div>` : '<p class="muted small">No regulation change confirmed yet (usually announced mid-season). Investment still carries some performance into next year.</p>'}
  <label>Share of development resources on next year's car: <b>${Math.round((t.nextYearFocus || 0) * 100)}%</b></label>
  <input type="range" min="0" max="0.6" step="0.05" value="${t.nextYearFocus || 0}" data-change="nyFocus">
  <p class="small">Higher focus slows current projects by up to ${Math.round((t.nextYearFocus || 0) * 60)}% but reduces regulation regression and adds baseline performance next season.</p></div>`;
}
on({ nyFocus: (a, el) => { P().nextYearFocus = +el.value; persist(); render(); } });
function puTab(s, t) {
  ensurePC(t);
  return `<div class="card"><h3>Power unit & gearbox pool ${helpBtn('development')}</h3><p class="small muted">Each part wears every race (more at power tracks). Worn parts are more likely to fail in practice, qualifying and the race. Fitting a part beyond the season allocation costs grid places: <b>10 for the first extra part of a type, 5 for each one after that</b>. Penalties apply at the next race.</p>
  <div class="grid g2">${t.drivers.map((did, slot) => `<div class="card tight"><b>${esc(s.drivers[did].name)}</b>${(s.gridPenalties || {})[did] ? ` <span class="pill bad">+${s.gridPenalties[did]} grid places next race</span>` : ''}
    ${COMP_KEYS.map((k) => { const c = t.pc[slot][k]; const al = allowance(s, k); return `<div class="row small" style="margin-top:.45rem"><span style="width:120px">${COMP[k].name}</span><div style="flex:1">${bar(c.wear, 100, c.wear > 75 ? 'var(--bad)' : c.wear > 50 ? 'var(--warn)' : 'var(--good)')}</div><span class="mono tiny" style="width:40px">${Math.round(c.wear)}%</span><span class="mono tiny ${c.used >= al ? 'warn' : ''}" style="width:34px">${c.used}/${al}</span><button class="btn sm" data-act="fitComp" data-arg="${slot}:${k}">New</button></div>`; }).join('')}</div>`).join('')}</div></div>`;
}
on({ fitComp: async (arg) => { const [slot, k] = arg.split(':'); const s = S(); const t = P(); const c = ensurePC(t)[+slot][k]; const over = c.used + 1 > allowance(s, k); const ok = await confirmBox(`Fit a new ${COMP[k].name}?`, `Costs $0.25M. ${over ? `<b class="bad">Beyond the allocation: ${c.pens ? 5 : 10}-place grid penalty.</b>` : 'Within the allocation, so no penalty.'}`, 'Fit part'); if (!ok) return; const pen = C.fitComponent(s, +slot, k); toast(pen ? `New part fitted: ${pen}-place grid penalty.` : 'New part fitted.', pen ? 'warn' : 'good'); persist(); render(); } });

// ---------------- Facilities ----------------
screen('facilities', {
  render() {
    const s = S(); const t = P();
    return `<div class="pagehead"><h1>Facilities</h1>${helpBtn('facilities')}</div><div class="grid g3">${Object.entries(FACILITIES).map(([k, f]) => { const lvl = t.facilities[k]; const b = t.facilityBuilds.find((x) => x.key === k); const cost = C.facilityCost(s, k); return `<div class="card"><div class="row"><h3 style="margin:0">${f.label}</h3><span class="sp"></span><b>L${lvl}</b></div><div class="row" style="gap:3px;margin:.4rem 0">${[1, 2, 3, 4, 5].map((i) => `<i style="flex:1;height:8px;border-radius:3px;background:${i <= lvl ? 'var(--team)' : '#263045'}"></i>`).join('')}</div><p class="small muted">${f.desc}</p><div class="small">Upkeep: ${money(f.upkeep * lvl)}/season</div>
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
  <td><div class="row" style="flex-wrap:nowrap;gap:.2rem"><button class="btn sm" data-act="raise" data-arg="${k}" title="+15% salary, morale & loyalty">Raise</button><button class="btn sm" data-act="rest" data-arg="${k}" title="-25 fatigue, projects +1 week">Break</button></div></td></tr>`).join('')}</tbody></table></div>
  <p class="small muted">Each headcount step costs ~$0.45M/season. Fatigue comes from workload and crunch; it causes failed prototypes, slow stops and defects.</p>`;
}
on({
  hc: (arg) => { const [k, d] = arg.split(':'); C.changeHeadcount(S(), k, +d); persist(); render(); },
  raise: (k) => { C.giveRaise(S(), k); persist(); render(); toast('Salary raised.'); },
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
function drvTeam(s, t) {
  const h2h = { q: [0, 0], r: [0, 0] };
  for (const r of s.results.filter((x) => x.season === s.season)) { const a = r.rows.find((x) => x.did === t.drivers[0]), b = r.rows.find((x) => x.did === t.drivers[1]); if (a && b) { if (a.grid < b.grid) h2h.q[0]++; else h2h.q[1]++; if (a.pos < b.pos) h2h.r[0]++; else h2h.r[1]++; } }
  return `<div class="grid g2">${t.drivers.map((id, i) => { const d = s.drivers[id]; return `<div class="card"><div class="row"><h3 style="margin:0">${esc(d.name)}</h3><span class="muted small">${d.nat} · ${d.age}</span><span class="sp"></span>${pill(PERSONALITIES[d.pers].label)}</div><p class="tiny muted">${esc(PERSONALITIES[d.pers].desc)}</p>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:.3rem .8rem">${skillRow(d)}<div class="small">Potential <b style="float:right">${d.pot}</b>${bar(d.pot, 100, 'var(--accent2)')}</div></div>
    <div class="row small" style="margin-top:.5rem"><span>Morale <b style="color:${sevColor(d.morale)}">${Math.round(d.morale)}</b></span><span>Confidence <b>${Math.round(d.confidence)}</b></span><span>Season pts <b>${d.seasonPts || 0}</b></span></div>
    <div class="trainbox"><div class="tiny muted" style="margin:.5rem 0 .25rem">DRIVER TRAINING ${d.training ? `— <b class="good">${C.TRAINING[d.training.k].label}</b>, ${d.training.left} race(s) left` : ''}</div>${d.training ? '' : `<div class="seg wrap">${Object.entries(C.TRAINING).map(([k, tr]) => `<button class="btn sm" data-act="train" data-arg="${id}:${k}" title="${esc(tr.desc)} Improves ${tr.stats.join(', ')} each race for ${tr.races} races.">${tr.label} · ${money(tr.cost)}</button>`).join('')}</div>`}</div>
    <div class="small" style="margin-top:.3rem">Contract: ${d.contract.years} season(s) left at ${money(d.contract.salary)}/yr</div>
    ${d.contract.years <= 1 ? `<div class="row" style="margin-top:.4rem"><button class="btn sm" data-act="renew" data-arg="${id}:1">Extend 1 yr</button><button class="btn sm" data-act="renew" data-arg="${id}:2">Extend 2 yrs</button><button class="btn sm" data-act="renew" data-arg="${id}:3">Extend 3 yrs</button></div>` : ''}</div>`; }).join('')}</div>
  <div class="card" style="margin-top:1rem"><h3>Teammate comparison (this season)</h3><div class="small">Qualifying: ${esc(s.drivers[t.drivers[0]].name)} ${h2h.q[0]} – ${h2h.q[1]} ${esc(s.drivers[t.drivers[1]].name)}<br>Race: ${h2h.r[0]} – ${h2h.r[1]}</div></div>`;
}
on({ train: (arg) => { const [id, k] = arg.split(':'); const r = C.startTraining(S(), id, k); toast(r.msg, r.ok ? 'good' : 'bad'); persist(); render(); } });
on({ renew: (arg) => { const [id, y] = arg.split(':'); const r = C.renewDriver(S(), id, +y); toast(r.msg, r.ok ? 'good' : 'bad'); if (r.ok) S().drivers[id]._renewed = true; persist(); render(); } });
function drvMarket(s, t) {
  const list = Object.values(s.drivers).filter((d) => d.teamId !== t.id && !d.retired && !d.academy).sort((a, b) => driverRating(b) - driverRating(a));
  return `<div class="card tw"><table><thead><tr><th>Driver</th><th>Age</th><th>Team</th><th>Rating</th><th>Pace</th><th>Wet</th><th>Potential</th><th>Contract</th><th>Est. salary</th><th>Interest</th><th></th></tr></thead><tbody>${list.map((d) => { const tm = s.teams[d.teamId]; const ch = C.acceptChance(s, d); return `<tr><td>${esc(d.name)} <span class="tiny muted">${PERSONALITIES[d.pers].label}</span></td><td>${d.age}</td><td>${tm ? `<span class="sw" style="background:${tm.color}"></span>${tm.abbr}` : '<span class="good">Free agent</span>'}</td><td>${driverRating(d).toFixed(0)}</td><td>${Math.round(d.pace)}</td><td>${Math.round(d.wet)}</td><td>${d.pot}</td><td>${tm ? d.contract.years + ' yr' : '—'}</td><td>${money(driverSalary(d) * (tm ? 1.25 : 1))}</td><td style="color:${sevColor(ch * 100, 60, 35)}">${ch > 0.6 ? 'Keen' : ch > 0.35 ? 'Open' : ch > 0.2 ? 'Reluctant' : 'Not interested'}</td><td><div class="row" style="flex-wrap:nowrap;gap:.2rem">${t.drivers.map((x, i) => `<button class="btn sm" data-act="sign" data-arg="${d.id}:${i}" title="Replace ${esc(s.drivers[x].name)}">⇄ ${esc(s.drivers[x].name.split(' ').pop())}</button>`).join('')}</div></td></tr>`; }).join('')}</tbody></table></div><p class="small muted">Signing a contracted driver requires a buy-out. The replaced driver becomes a free agent (or moves to the other team).</p>`;
}
on({ sign: async (arg) => { const [id, slot] = arg.split(':'); const d = S().drivers[id]; const ok = await confirmBox(`Sign ${d.name}?`, `Replaces ${esc(S().drivers[P().drivers[+slot]].name)} immediately.${d.teamId ? ' A contract buy-out is required.' : ''}`); if (!ok) return; const r = C.signDriver(S(), id, +slot); toast(r.ok ? 'Driver signed.' : r.msg, r.ok ? 'good' : 'bad'); persist(); render(); } });
function drvAcademy(s, t) {
  const list = Object.values(s.drivers).filter((d) => d.academy && !d.retired);
  return `<div class="grid g3">${list.map((d) => `<div class="card"><div class="row"><b>${esc(d.name)}</b><span class="muted small">${d.age}</span><span class="sp"></span>${pill('Pot ' + d.pot, 'good')}</div><div class="grid" style="grid-template-columns:1fr 1fr;gap:.2rem .6rem;margin-top:.4rem">${skillRow(d)}</div><div class="row" style="margin-top:.5rem">${t.drivers.map((x, i) => `<button class="btn sm" data-act="promote" data-arg="${d.id}:${i}">Promote over ${esc(s.drivers[x].name.split(' ').pop())}</button>`).join('')}</div></div>`).join('') || '<div class="empty">No juniors in the academy.</div>'}</div><p class="small muted">Juniors grow each season, faster with a strong Driver Development department and simulator.</p>`;
}
on({ promote: async (arg) => { const [id, slot] = arg.split(':'); const ok = await confirmBox('Promote junior?', 'The replaced driver leaves the team.'); if (!ok) return; const r = C.promoteJunior(S(), id, +slot); toast(r.ok ? 'Promoted.' : r.msg, r.ok ? 'good' : 'bad'); persist(); render(); } });

// ---------------- Finance ----------------
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
    <div class="card" style="margin-top:1rem"><h3>Ledger</h3><div class="tw" style="max-height:420px;overflow:auto"><table><thead><tr><th>When</th><th>Category</th><th>Item</th><th style="text-align:right">Amount</th></tr></thead><tbody>${s.ledger.slice(0, 120).map((l) => `<tr><td class="tiny muted">S${l.season} R${l.round + 1}</td><td>${esc(l.cat)}</td><td class="small">${esc(l.text)}</td><td class="mono ${l.amount >= 0 ? 'good' : 'bad'}" style="text-align:right">${money(l.amount)}</td></tr>`).join('')}</tbody></table></div></div>`;
  },
});
on({ loan: (a) => { C.takeLoan(S(), +a); persist(); render(); }, advance: () => { C.sponsorAdvance(S()); persist(); render(); } });

// ---------------- Sponsors ----------------
screen('sponsors', {
  render() {
    const s = S(); const sf = 12 / s.calendar.length;
    return `<div class="pagehead"><h1>Sponsors</h1>${helpBtn('sponsors')}</div><h3>Current partners (${s.sponsors.length}/4)</h3><div class="grid g3">${s.sponsors.map((x) => `<div class="card"><div class="row"><b>${esc(x.name)}</b>${x.volatile ? pill('Volatile', 'warn') : ''}</div><div class="small">Objective: ${OBJ_TEXT[x.objective](x.target)}<br>Base: ${money(x.perRace * sf)}/race · Bonus ${money(x.bonus)}<br>Races left: ${x.racesLeft}</div><div class="small" style="margin-top:.4rem">Satisfaction ${bar(x.sat, 100, sevColor(x.sat, 55, 30))}</div></div>`).join('') || '<div class="empty">No sponsors.</div>'}</div>
    <h3 style="margin-top:1rem">Offers</h3><div class="grid g3">${s.sponsorOffers.map((o) => `<div class="card"><b>${esc(o.name)}</b><div class="small">Objective: ${OBJ_TEXT[o.objective](o.target)}<br>${money(o.perRace * sf)}/race for ${o.racesLeft} races · bonus ${money(o.bonus)}<br><span class="muted">Offer expires after round ${o.expires + 1}</span></div><div class="row" style="margin-top:.5rem"><button class="btn sm primary" data-act="accSp" data-arg="${o.id}" ${s.sponsors.length >= 4 ? 'disabled' : ''}>Accept</button><button class="btn sm" data-act="negSp" data-arg="${o.id}" ${o.negotiated ? 'disabled' : ''}>Negotiate +15%</button></div></div>`).join('') || '<div class="empty">No offers right now. Results, reputation and a strong Commercial department attract partners.</div>'}</div>`;
  },
});
on({ accSp: (id) => { C.acceptSponsor(S(), id); persist(); render(); }, negSp: (id) => { toast(C.negotiateSponsor(S(), id)); persist(); render(); } });

// ---------------- Board ----------------
screen('board', {
  render() {
    const s = S(); const t = P(); const pos = C.teamPos(s, t.id);
    return `<div class="pagehead"><h1>Board</h1>${helpBtn('board')}</div><div class="grid g2"><div class="card"><h3>Confidence</h3><div class="stat"><b style="color:${sevColor(s.board.confidence, 55, 30)}">${Math.round(s.board.confidence)}%</b><span>Board confidence</span></div>${bar(s.board.confidence, 100, sevColor(s.board.confidence, 55, 30))}<p class="small muted">Patience: ${s.board.patience >= 1.2 ? 'High' : s.board.patience >= 0.9 ? 'Normal' : 'Low'}. Below ~10% you will be dismissed. Results vs target, finances and objectives drive confidence.</p></div>
    <div class="card"><h3>Season objectives</h3>${(s.board.objectives || []).map((o) => { let st = ''; if (o.kind === 'cons') st = pos <= o.value ? 'On track' : 'Behind'; if (o.kind === 'cash') st = t.cash > 0 ? 'On track' : 'At risk'; if (o.kind === 'rel') { const n = s.results.filter((x) => x.season === s.season).flatMap((x) => x.rows).filter((x) => x.teamId === t.id && x.dnf && /failure|fault/i.test(x.dnf)).length; st = `${n} so far`; } return `<div class="row small" style="margin:.3rem 0"><span>${esc(o.text)}</span><span class="sp"></span>${pill(st, /On track/.test(st) ? 'good' : /Behind|risk/.test(st) ? 'bad' : 'info')}</div>`; }).join('')}</div></div>
    <div class="card" style="margin-top:1rem"><h3>History</h3>${s.history.seasons.length ? `<table><thead><tr><th>Season</th><th>Pos</th><th>Points</th><th>Board</th></tr></thead><tbody>${s.history.seasons.map((h) => `<tr><td>${h.year}</td><td>P${h.pos}</td><td>${h.points}</td><td>${Math.round(h.board)}%</td></tr>`).join('')}</tbody></table>` : '<div class="muted small">First season in charge.</div>'}</div>`;
  },
});
