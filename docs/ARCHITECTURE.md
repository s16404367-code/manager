# Architecture
```
index.html            entry (relative paths only), manifest, sw.js (offline cache)
css/                  base · layout · race · mobile
js/main.js            boots the router and registers screens
js/sim/               rng.js (seeded mulberry32, serialisable), util.js
js/data/              tracks, teams/profiles/philosophies, drivers/personalities, content (departments,
                      facilities, projects, sponsors, events, regulations, achievements), help
js/engines/           pure logic with no DOM, so Node can test it
  world.js            world creation, org selectors (deptQ, pitCrew, forecastAccuracy, correlation)
  carModel.js         car-vs-track score, setup optimum/quality/side-effects
  tyreEngine.js       compounds, wear, cliff, wet crossover
  weatherEngine.js    per-lap wetness timeline, noisy forecasts
  strategyEngine.js   plan generation and estimation
  raceEngine.js       lap-event race simulation and player actions
  weekendEngine.js    practice, qualifying, grid, race build, classification, "Why?" analysis
  careerEngine.js     results, finance, development, facilities, staff, drivers, sponsors, events,
                      AI development, board, regulations, season end/start
js/state/persistence.js  save/load, validation, repair, migrations, settings
js/ui/                app.js (router, shell, delegated actions, modal/toast), widgets (SVG charts), screens*
```
**Race engine.** Each car has a scheduled line-crossing time. The engine processes cars in chronological order and resolves interactions against the car directly ahead: overtake attempts, dirty-air holding, and SC bunching. The UI interpolates between crossings to draw the minimap. The RNG state is stored in the race object, so a race can be saved mid-way and resumed deterministically.

**Actions.** The UI never mutates engine internals directly. It calls domain functions (`startProject`, `actions.pit`, `resolveEvent` and so on), then persists and re-renders.
