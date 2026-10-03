# Team Principal — Motorsport Management & Strategy Simulator

An F1-inspired **Team Principal** simulator. It runs entirely in the browser as a static site. There's no backend, login or build step, and it plays offline. You don't drive the car: you run the factory, the engineers, the drivers, development, the finances and the pit wall.

> Fictional teams and drivers. Real circuit names/layouts are used only to identify venues. Unofficial fan project — not affiliated with, endorsed or sponsored by Formula 1, Formula One Management, the FIA, any team, driver or circuit. See LEGAL.md.

## Play locally
ES modules need an HTTP server (browsers won't load `file://` modules):
```bash
python3 -m http.server 8080      # or: npx serve .
# open http://localhost:8080/
```

## Deploy on GitHub Pages
1. Push this folder to a repository (the root holds `index.html`).
2. Pick one:
   - **Settings → Pages → Deploy from branch → `main` / root**, or
   - **Settings → Pages → Source: GitHub Actions**. `.github/workflows/pages.yml` runs the tests, then deploys.
3. All paths are relative, so the game works under `https://USER.github.io/REPOSITORY/`.

## Features
- **Quick Race** (5–15 min): pick a team and circuit, set up the car, run practice programmes, go through Q1/Q2/Q3 run plans, plan strategy in the Strategy Lab, run the live race, then read the "Why?" debrief.
- **Career**: 4 starting profiles × 8 philosophies. Seasons can be 8, 12 or 16 races, and the career runs for as many seasons as you like, with regulation changes, ageing, contracts and an AI driver market.
- **Race engine**: deterministic and driven by lap events. Covers overtaking in dirty air, DRS, 5 tyre compounds with a performance cliff and punctures, per-lap weather with crossover points, SC/VSC, reliability failures, damage, fuel, ERS modes, team orders, pit crew errors and the two-compound rule.
- **Pit wall**: timing tower, animated SVG track map, per-car controls. The race auto-pauses for critical decisions and offers an engineer recommendation with a confidence level. Speeds: 1×, 3× and 9×, plus "simulate to the flag".
- **Organisation**: 11 departments with heads, headcount, morale and fatigue, plus a Technical Director. Also covers staff poaching, crunch mode, a recruitment market, 8 facilities (levels 1–5), and development projects that move from design to manufacturing to deployment. Actual upgrade gains are hidden until you measure them, and projects can fail. Parts can go on one car or both. The Aero Testing Restriction (ATR) and next-year focus also affect development.
- **Business**: ledger, cost cap, sponsors (with objectives, satisfaction and negotiation), board confidence and objectives, loans, bankruptcy and dismissal.
- **Presentation**: HQ attention list, charts (lap chart, points progression, cash), achievements, tutorial, help and settings. The layout is responsive for desktop, tablet and phones in portrait or landscape. Includes fullscreen, text scaling and high contrast.
- **Saves**: autosave plus 3 slots, backup rotation, validation, repair and migrations, JSON export/import, and an optional Ironman mode.

## Languages / tooling
| Part | Language |
|---|---|
| Game | HTML, CSS, JavaScript (ES modules, no dependencies) |
| Headless simulation tests | JavaScript (Node 18+) — `node tests/run-tests.mjs` |
| Balance report & data validation | Python 3 — `python tools/balance_report.py` |
| Browser smoke test (desktop + mobile) | Python + Playwright — `python tests/e2e_smoke.py http://localhost:8080/` |
| CI / Pages deploy | GitHub Actions YAML |

See `docs/` for the architecture, game design notes and the QA checklist.

## v3.1 — Real 2026 calendar, live sessions, new UI

- **24 real circuits** of the 2026 F1 calendar (Melbourne → Abu Dhabi, including Madring). The layouts come from
  [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT License, © Tomislav Bacinger). A speed profile is
  computed from each circuit's corner radii, and it drives car positions and telemetry. Teams and drivers are still fictional.
- **Live practice and qualifying**: a session clock, out-laps, flying laps and in-laps, live timing with sector colours
  (purple/green/yellow), a telemetry trace, traffic, track-limits deletions and track evolution. Q1 is 12 min, Q2 10 min and Q3 8 min.
  "Quick simulate" is still available.
- **10-parameter setup** (wings, ride height, springs, anti-roll bars, camber, toe, brake bias, diff, tyre pressure). The optimum
  depends on the track and the driver's style. Live meters show the car's predicted character.
- A new visual theme and race telemetry: tap any car in the timing tower to see its data.

### Run in GitHub Codespaces
```bash
unzip team-principal.zip -d . && cd f1tp   # if you uploaded the zip
python3 -m http.server 8080                      # then open the forwarded port 8080 (Ports tab → globe icon)
node tests/run-tests.mjs                          # headless engine tests
```

## v3.2
- Two telemetry panels (A: any car you tap, B: your team-mate) in practice, qualifying and the race. Taps are registered on press, so live refreshes can't swallow them.
- Speed buttons (1×/3×/9×/pause) respond to a single tap, and your choice is remembered.
- Track knowledge grows with laps run in practice, qualifying and the race; it is worth up to ~0.3s/lap and sharpens setup estimates.
- Reliability failures in practice and qualifying (ERS/battery, engine, hydraulics, gearbox) stop the car and mean a repair in the garage, sometimes for the rest of the session.
- Power-unit and gearbox pool per car (Car → Power units): parts wear each race, worn parts fail more, and extra parts cost 10 then 5 grid places.
- Driver training programmes (Drivers page), paid from the season purse. The Car page shows the purse, cost-cap headroom and R&D slots.
- Race-day tyre wear differs from Friday (temperature, rubber, rain); the engineer radios the difference early on.
- New weather forecast cards with icons, a legend and chance of rain per lap window.
- Pit lane drawn on every map, with garage cars parked in the pit boxes; clearer SC/VSC car and banner. Wider timing tower.

## v3.3
- Legal: `LICENSE` (MIT, your code), `THIRD_PARTY_NOTICES.md` (circuit data credit + dev-tool licences), `LEGAL.md` (non-affiliation/trademark disclaimer), plus an in-game **Credits & legal** button on the main menu. Team/driver names that resembled real ones were renamed.
- A single telemetry panel: tap any car in the timing table (yours or a rival's) in practice, qualifying and the race.
- Larger map in practice and qualifying.
- The side menu is collapsed by default; use the › / ‹ button to open or close it.
- Race-day strategy check: after the first laps, the pit wall asks whether to continue with the pre-race plan, let the engineers adapt it to today's tyre wear, or switch to manual pit calls. You can switch this pause on or off in Settings.
- Restyled HQ, management screens, tables, tabs, menus and dialogs.

## v3.8
- Three-day weekend weather: Friday (practice), Saturday (qualifying) and Sunday (race) each have their own conditions, air/track temperature and wind. Practice runs in Friday's weather, so Friday's tyre data can mislead on a hotter or cooler Sunday.
- Safety car realism: SC ~175 km/h and VSC delta speed in telemetry, no overtaking, DRS disabled during SC/VSC and for 2 laps after the restart, and a DRS ENABLED/DISABLED indicator on the race bar.
- Map size capped (max 560px wide, ~half the screen height), the same in practice, qualifying and the race.
- New weather-day cards, pulsing SC flag, and restyled car panels.

## Round 10
See CHANGELOG.md (latest section).
