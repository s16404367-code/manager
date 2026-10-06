// App core: state holder, router, shell, delegated actions, modal/toast, persistence glue.
import { loadSettings, saveSettings, save } from '../state/persistence.js';
import { money } from '../sim/util.js';
import { trackById } from '../data/tracks.js';

export const app = { state: null, settings: loadSettings(), route: 'menu', arg: null, tab: {}, draft: {}, moreOpen: false };
const screens = {};
export const acts = {};
export const screen = (name, def) => (screens[name] = def);
export const on = (map) => Object.assign(acts, map);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function go(route, arg) { const h = '#/' + route + (arg != null ? '/' + encodeURIComponent(arg) : ''); if (location.hash === h) render(); else location.hash = h; }
// Autosave is batched: many quick changes = one disk write ~1.5s later (and immediately when the tab is hidden/closed).
let _saveTimer = null;
export function flushSave() { if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; } if (!app.state) return; if (app.settings.autosave || app.state.ironman) { const r = save(app.state, 'auto'); if (!r.ok) toast(r.msg, 'bad'); } }
export function persist(label) { if (!app.state) return; if (!_saveTimer) _saveTimer = setTimeout(flushSave, 1500); if (label) toast(label, 'good'); }
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { flushSave(); app.hidden = true; });
  document.addEventListener('visibilitychange', () => { app.hidden = document.hidden; if (document.hidden) { flushSave(); if (app._raceSt) app._raceSt.running = false; if (app._liveSt) app._liveSt.running = false; } });
}
export function setState(s) { app.state = s; applyTheme(); }
export function applyTheme() {
  const r = document.documentElement; const s = app.settings;
  r.style.setProperty('--fs', s.textScale || 1);
  document.body.classList.toggle('hc', !!s.highContrast);
  document.body.classList.toggle('navc', s.navCollapsed !== false);
  const t = app.state?.teams?.[app.state.player];
  if (t) { r.style.setProperty('--team', t.color); r.style.setProperty('--team2', t.color2 || '#fff'); }
}
export function updateSettings(patch) { app.settings = { ...app.settings, ...patch }; saveSettings(app.settings); applyTheme(); }

// ---------- toast & modal ----------
export function toast(msg, kind = 'info', ms = 3200) {
  let w = document.querySelector('.toast-wrap'); if (!w) { w = document.createElement('div'); w.className = 'toast-wrap'; w.setAttribute('aria-live', 'polite'); document.body.appendChild(w); }
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg; w.appendChild(t); setTimeout(() => t.remove(), ms);
}
let modalResolve = null;
export function modal(html, { wide = false, dismiss = true } = {}) {
  closeModal();
  const b = document.createElement('div'); b.className = 'modal-back'; b.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  if (dismiss) b.addEventListener('click', (e) => { if (e.target === b) closeModal(); });
  document.body.appendChild(b);
  const f = b.querySelector('button,[tabindex]'); f?.focus();
  return new Promise((res) => (modalResolve = res));
}
export function closeModal(v) { document.querySelectorAll('.modal-back').forEach((m) => m.remove()); if (modalResolve) { const r = modalResolve; modalResolve = null; r(v); } }
export function confirmBox(title, text, okLabel = 'Confirm') {
  return modal(`<h2>${esc(title)}</h2><p class="muted">${text}</p><div class="row" style="justify-content:flex-end"><button class="btn" data-act="modalClose">Cancel</button><button class="btn primary" data-act="modalOk">${esc(okLabel)}</button></div>`);
}
on({ modalClose: () => closeModal(false), modalOk: () => closeModal(true), go: (a) => go(a), help: (k) => showHelp(k) });
export let showHelp = () => {}; export const setHelp = (fn) => (showHelp = fn);

// ---------- navigation ----------
const NAV = [
  ['Team', [['hq', 'HQ', '🏠'], ['weekend', 'Race Weekend', '🏁'], ['championship', 'Championship', '🏆']]],
  ['Technical', [['car', 'Car & Development', '🔧'], ['facilities', 'Facilities', '🏭'], ['regulations', 'Regulations', '📜']]],
  ['People', [['staff', 'Staff & Departments', '👥'], ['drivers', 'Drivers & Academy', '🧑‍✈️']]],
  ['Business', [['finance', 'Finance', '💰'], ['sponsors', 'Sponsors', '🤝'], ['board', 'Board', '🏛️']]],
  ['Game', [['history', 'Race History', '📈'], ['achievements', 'Achievements', '⭐'], ['guide', 'Guide (what is what)', '📘'], ['help', 'Help', '❔'], ['settings', 'Settings', '⚙️'], ['saves', 'Save / Load', '💾']]],
];
const QUICK_NAV = [['Race', [['weekend', 'Race Weekend', '🏁']]], ['Game', [['help', 'Help', '❔'], ['settings', 'Settings', '⚙️']]]];
const BOTTOM = [['hq', 'HQ', '🏠'], ['weekend', 'Weekend', '🏁'], ['car', 'Car', '🔧'], ['championship', 'Standings', '🏆']];

function shell(inner) {
  const s = app.state; const t = s.teams[s.player];
  const quick = s.mode === 'quick';
  const nav = quick ? QUICK_NAV : NAV;
  const badge = (r) => (r === 'hq' && s.pendingEvent ? '<span class="badge">!</span>' : r === 'car' && s.projects?.some((p) => p.stage === 'ready') ? '<span class="badge">●</span>' : '');
  const side = nav.map(([g, items]) => `<div class="grp">${g}</div>` + items.map(([r, l, i]) => `<a href="#/${r}" class="${app.route === r ? 'on' : ''}"><span aria-hidden="true">${i}</span><span class="lbl">${l}</span>${badge(r)}</a>`).join('')).join('');
  const nextTrack = s.calendar[s.round] ? trackById(s.calendar[s.round]) : null;
  const bottom = (quick ? [['weekend', 'Weekend', '🏁'], ['help', 'Help', '❔'], ['settings', 'Settings', '⚙️']] : BOTTOM).map(([r, l, i]) => `<a href="#/${r}" class="${app.route === r ? 'on' : ''}"><span class="i">${i}</span>${l}</a>`).join('') + (quick ? '' : `<a href="javascript:void 0" data-act="more"><span class="i">☰</span>More</a>`);
  return `<header class="topbar">
    <a class="brand" href="#/${quick ? 'weekend' : 'hq'}" style="text-decoration:none;color:inherit"><span class="logo">${esc(t.abbr)}</span><span class="hide-m">${esc(t.name)}</span><span class="v5tag sm hide-m">TP V5.0</span></a>
    <div class="topstats">
      ${quick ? `<div class="s"><span>Quick Race</span>${esc(nextTrack?.name || '')}</div>` : `<div class="s"><span>Season ${s.season}</span>${s.year} · R${Math.min(s.round + 1, s.calendar.length)}/${s.calendar.length}${s.week ? ' · Wk ' + s.week : ''}</div>
      <div class="s"><span>Cash</span><b class="${t.cash < 0 ? 'bad' : ''}">${money(t.cash)}</b></div>
      <div class="s hide-m"><span>Board</span><b class="${s.board.confidence < 30 ? 'bad' : s.board.confidence < 50 ? 'warn' : 'good'}">${Math.round(s.board.confidence)}%</b></div>`}
      ${!quick ? '<button class="btn sm ghost" data-act="guidePage" title="Explain this page" aria-label="Explain this page">📘<span class="hide-m"> Guide</span></button>' : ''}
      <button class="btn sm ghost" data-act="fullscreen" title="Fullscreen" aria-label="Fullscreen">⛶</button>
      <button class="btn sm ghost" data-act="menu" title="Main menu" aria-label="Main menu">⏏</button>
    </div></header>
  <div class="shell"><nav class="sidenav" aria-label="Main"><button class="navtog" data-act="navToggle" title="${(app.settings.navCollapsed !== false) ? 'Expand menu' : 'Collapse menu'}" aria-label="Toggle menu">${(app.settings.navCollapsed !== false) ? '›' : '‹ Hide menu'}</button>${side}</nav><main id="main">${inner}</main></div>
  <nav class="bottomnav" aria-label="Mobile">${bottom}</nav>
  ${app.moreOpen ? `<div class="morepanel">${NAV.flatMap(([, it]) => it).map(([r, l, i]) => `<a href="#/${r}" data-act="closeMore">${i}<br>${l}</a>`).join('')}</div>` : ''}`;
}
on({
  navToggle: () => { updateSettings({ navCollapsed: app.settings.navCollapsed === false }); render(); },
  more: () => { app.moreOpen = !app.moreOpen; render(); },
  closeMore: () => { app.moreOpen = false; },
  fullscreen: () => { const d = document; if (!d.fullscreenElement) (d.documentElement.requestFullscreen?.() || d.documentElement.webkitRequestFullscreen?.())?.catch?.(() => toast('Fullscreen not supported here', 'warn')); else d.exitFullscreen?.(); },
  menu: async () => { if (app.state?.weekend?.race && !app.state.weekend.race.finished) { app.pauseRace?.(); } persist(); app.state = null; go('menu'); },
});

const viewKey = () => [app.route, app.arg, app.state?.weekend?.phase, !!app.state?.weekend?.live, app.state?.round, app.state?.weekend?.practice?.done, app.state?.weekend?.quali?.session].join('|');
export function render() {
  const root = document.getElementById('app');
  const def = screens[app.route] || screens.menu;
  if (def.needsState !== false && !app.state) { app.route = 'menu'; return render(); }
  if (app.leaveRoute && app._lastRoute !== app.route) { app.leaveRoute(); app.leaveRoute = null; }
  app._lastRoute = app.route;
  try {
    const inner = def.render(app.arg);
    const html = def.bare ? inner : shell(inner);
    const same = app._lastKey === viewKey() && root.firstChild;
    const sx = window.scrollX, sy = window.scrollY; const navY = root.querySelector('.sidenav')?.scrollTop || app._navY || 0; app._navY = navY;
    if (same) morphHtml(root, html); else root.innerHTML = html;
    app._sameRender = !!same; const nv = root.querySelector('.sidenav'); if (nv) nv.scrollTop = navY;
    if (same) window.scrollTo?.(sx, sy);
    def.after?.(root, app.arg);
  } catch (e) {
    console.error(e);
    root.innerHTML = `<div class="menu-hero"><div class="card" style="max-width:560px"><h2>Something went wrong</h2><p class="muted">The screen failed to render. Your autosave is intact.</p><pre class="small" style="white-space:pre-wrap">${esc(e.stack || e.message)}</pre><div class="row"><button class="btn primary" data-act="recover">Return to HQ</button><button class="btn" data-act="menu">Main menu</button></div></div></div>`;
  }
  const key = viewKey();
  if (!def.keepScroll && app._lastKey !== key) window.scrollTo?.(0, 0);
  app._lastKey = key;
}
// In-place DOM update: only changed nodes/attributes are touched, so clicking an option never
// flashes the page or jumps back to the top (scroll positions of inner panels are kept too).
function morphHtml(root, html) {
  const tpl = document.createElement('div'); tpl.innerHTML = html;
  morphChildren(root, tpl);
}
function morphChildren(a, b) {
  const an = [...a.childNodes], bn = [...b.childNodes];
  for (let i = 0; i < bn.length; i++) {
    const x = an[i], y = bn[i];
    if (!x) { a.appendChild(y); continue; }
    if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName || (x.id || '') !== (y.id || '')) { a.replaceChild(y, x); continue; }
    if (x.nodeType === 3 || x.nodeType === 8) { if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue; continue; }
    morphNode(x, y);
  }
  for (let i = an.length - 1; i >= bn.length; i--) an[i].remove();
}
function morphNode(x, y) {
  x._html = x._h = x._k = undefined;
  for (const at of [...x.attributes]) if (!y.hasAttribute(at.name)) x.removeAttribute(at.name);
  for (const at of [...y.attributes]) if (x.getAttribute(at.name) !== at.value) x.setAttribute(at.name, at.value);
  if (x.tagName === 'INPUT' || x.tagName === 'SELECT' || x.tagName === 'TEXTAREA') {
    if (x.type === 'checkbox' || x.type === 'radio') x.checked = y.hasAttribute('checked');
    else if (x.tagName === 'SELECT') { morphChildren(x, y); const o = [...y.options].findIndex((o) => o.hasAttribute('selected')); if (o >= 0) x.selectedIndex = o; return; }
    else if (document.activeElement !== x) x.value = y.getAttribute('value') ?? y.value ?? '';
    if (x.tagName !== 'TEXTAREA') return;
  }
  if (x.tagName === 'DETAILS') x.open = y.hasAttribute('open') || x.open;
  // live widgets (canvas/svg groups filled by scripts) are replaced wholesale by their after() hooks
  morphChildren(x, y);
}
on({ recover: () => go(app.state?.mode === 'quick' ? 'weekend' : 'hq') });
function route() {
  const h = location.hash.replace(/^#\/?/, '').split('/');
  app.route = h[0] || 'menu'; app.arg = h[1] ? decodeURIComponent(h[1]) : null; app.moreOpen = false;
  render();
}
export function start() {
  window.addEventListener('hashchange', route);
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
    const fn = acts[el.dataset.act]; if (!fn) { console.warn('No action', el.dataset.act); return; }
    e.preventDefault(); fn(el.dataset.arg, el, e);
  });
  // Fast-tap controls live inside panels that refresh several times per second (timing towers, speed bars).
  // They fire on pointerdown so a re-render between press and release can never swallow the tap.
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('[data-tap]'); if (!el || el.disabled || e.button > 0) return;
    const fn = acts[el.dataset.tap]; if (fn) { e.preventDefault(); fn(el.dataset.arg, el, e); }
  });
  document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset?.tap) { e.preventDefault(); acts[e.target.dataset.tap]?.(e.target.dataset.arg, e.target, e); } });
  const onChange = (e) => { const el = e.target.closest('[data-change]'); if (!el) return; const fn = acts[el.dataset.change]; if (fn) fn(el.dataset.arg, el, e); };
  document.addEventListener('change', onChange);
  document.addEventListener('input', (e) => { const el = e.target.closest('[data-input]'); if (!el) return; const fn = acts[el.dataset.input]; if (fn) fn(el.dataset.arg, el, e); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); if (app.onKey) app.onKey(e); });
  window.addEventListener('error', (e) => { if (app.settings.debug) toast('Error: ' + e.message, 'bad', 6000); });
  applyTheme();
  route();
}
