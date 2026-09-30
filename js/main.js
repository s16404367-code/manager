// Entry point. All paths are relative so the game works under /REPOSITORY/ on GitHub Pages.
import { start, app } from './ui/app.js';
import { validate } from './state/persistence.js';
import './ui/screensStart.js';
import './ui/screensWeekend.js';
import './ui/screensRace.js';
import './ui/screensPost.js';
import './ui/screensMgmt.js';
import './ui/screensMisc.js';
window.__validate = validate;
window.__app = app;
start();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
