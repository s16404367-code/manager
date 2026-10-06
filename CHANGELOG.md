# Changelog

## Round 10 — "Team Principal"
- Race: you approve every pit stop and repair (engineers only propose; never on the final lap); choose new or used sets (grip % shown); tyre-change animation only for your cars.
- 2026 energy rules: ERS modes removed. Overtake mode works only within 1.0s of the car ahead (never for the leader). Battery recharges automatically from braking and clipping.
- DRS replaced by active aero (X-mode), shown as green zones on every track map and in the telemetry. Animated weather widget in the race bar.
- Weekend: speed resets to 1× at the start of every session; FP1–FP3 last 60 min each; 4 practice programmes instead of 7; real 13-dry-set allocation explained.
- Car & Dev: area → concept → approve. Parts go through a Design→Build→Ready→On the car stepper and are fitted automatically. Car overview grouped by area. Next-year effort split by area.
- PU: 3 suppliers or your own in-house PU; identical allowance for every team (2026 pool, scaled to season length).
- Economy: equal starting purse; per-race FOM, points share, hospitality, merchandise and TV income; season-end standings bonus; cash (including negative) carries over; sponsor terms (flagship races, two-season, performance-heavy).
- F1 Commission rules vote (28/30). Board trend and reasons. Training grouped and allowed on credit. Facility effects shown per level.
- Pre-season, in-season and post-season tests (post-season laps by standings) raise car knowledge and driver familiarity.
- Car vs driver weighting is now car-dominant (~75/25).
- New "this week" panel, milestone year plan, strategy plan bars, and an upgraded debrief timeline (SC/VSC/wet bands, used-set stripes, filters).

## v3.8
- Pit-stop animation at the bottom of the race screen for every stop (your cars first): BOX flash, old tyre rolls off, new tyre rolls on, stationary timer, "Soft → Medium" label; blinking PIT tag in the timing tower on the pit lap.
- Strategy chart: pit-lap numbers under the bars removed (compound + stint length stay in the coloured bars).
- New season-clock card: week progress ring, next race with countdown ("3 weeks to go" / pulsing RACE WEEK), phase chip, animated year rail.
- Year plan / championship calendar: month-by-month week grid with venue codes on race weeks, testing and development markers, this week highlighted.
- Week strip also shown on race-weekend pages.
- Left menu keeps its scroll position when you pick a page.

## v3.7
- Fixed: "No timed laps yet" before Q1 in championship — quick-simulated practice now runs the real session engine, so all laps are logged.
- No more page reload / jump to top when choosing an option anywhere: screens update in place (DOM morph) and keep scroll position.
- Week-by-week year: fixed plan (year start week 1, development opens week 2, pre-season testing, race dates, year close week 52). Races are spread across the year according to the number of races (24 = March→December, fewer = shorter window). "Next week" / "Advance to race week" in HQ; events, offers and problems appear in any week; weekend opens only in race week; off-season after the last race, then "Close the year".
- Crunch mode: costs $0.3M per week, ~30% faster progress while active, more fatigue. Staff fatigue: common baseline of 20 when idle; rises with the size of the work (both-car sets, aggressive, long projects).
- Championship → Past seasons tab; planning screen and early-year HQ show last year's data with suggestions. Calendar tab shows race dates and the year plan. Results kept for 5 seasons.
- Race history: season filter, totals (points, podiums, avg grid/finish, DNFs, places gained) and a detail view per race (full classification, pit stops, incidents, fastest lap, pole, conditions, SC/VSC, overtakes, race-control log).
- Guide: new "📘 Guide" page explaining every left-menu page and every HQ section, plus a "📘 Guide" button in the top bar that explains the current page.

## v3.6
- Driver panels: text/buttons no longer overflow (practice, quali, race).
- Before Q1: "Best setup found in practice" (fuel/tyre/grip-corrected fastest lap) with one-click apply.
- Race screen uses the exact practice/quali grid (timing left, map + telemetry centre, driver panels + feed right).
- New "Planned pit stop" decision one lap before each scheduled stop: box as planned (choose tyre), stay out +2/+5, or cancel the plan. Grip 100% = new tyre, 0% = no grip.
- Debrief strategy chart redesigned (F1-TV style): rounded compound bars with stint length, pit laps under the bar, lap gridlines, legend.

## v3.5
- Practice analysis per driver: best/average/deg per compound, fastest laps with setup, grip, track temp, wind, fuel.
- Timing tower shows every car's tyre, laps on the set and grip %. Right-side panel shows position, last tyre, new/used set toggle and set inventory.
- Real tyre allocation per driver (8 Soft / 3 Medium / 2 Hard / 4 Inter / 3 Wet); used sets keep their wear into quali and the race.
- New practice programmes (Conditions correlation, Tyre compound comparison). Engineer estimates carry a condition bias (wind, temperature swing, weather changes) with a Reliable/Fair/Unreliable label and reasons.
- Before Q1: pick the setup from any practice run and a quali tyre; parc fermé locks the setup from Q1 to the race.
- Slipstream (tow on straights) and dirty air (corner loss) in practice, quali and race, with TOW / DIRTY AIR telemetry tags. Based on public figures: 2022+ cars keep ~80–85% downforce at 10–20 m (the-race.com; flowracers; formuladream).
- Tyre temperature windows: Inters/Wets overheat on a drying track; slicks suffer when cold.
- Climate-based temperatures per venue and month; new-game option for real or random venue order; month shown on the weekend strip.
- Race: red flags (free tyre change, SC restart), local yellow flags (no DRS, fewer passes), grip % everywhere.
- Decision pop-ups: full race-data table and weather trend, plus "View race screen", which keeps the race paused.
- Race layout now matches practice/quali (timing | map+telemetry | controls+feed).
- Strategy: estimated stint life for all 5 compounds and a stint-vs-life check. Fixed: Inter/Wet starts were overridden by automatic engineer weather calls.
- Debrief strategy timeline with pit separators, pit-lap labels and a lap axis.

## 3.0.0
- First V3 release: quick race, career, full race engine, organisation, business and the save system.

## Round 11
- Pit calls now happen half-way round the lap, for every car. You are asked about every stop with a clear message: "box at the END of lap N", which set (new, or the used set with the most life left), and whether to repair. You can also stay out 1 or 2 laps (you get asked again on that lap) or skip the stop. Closing the window counts as staying out. This fixes the bug where a car sometimes didn't pit after a strategy change or under SC/VSC.
- Pit loss for each track now uses the real average. Pit-lane traffic is modelled: garages follow last year's championship order, double-stacked cars wait for their team-mate, there are release holds, and cars queue first come, first served at the pit entry.
- Timing PIT pill now only shows while the car is in the pit lane, matching the map. A separate BOX tag shows when a stop has been called.
- Strategy Lab: choose New or Used tyres for the start and for each stop.
- Qualifying boost modes (full / balanced / save). Every car uses one.
- 2026 power-unit pool: ICE 4, turbo 4, exhaust 4, MGU-K 3, battery 3, control electronics 3. No MGU-H. Gearboxes have no season limit, but a change in parc fermé means a pit-lane start.
- Drivers:
  - Contracts now show when they end ("until end of YYYY season").
  - Engineer rapport.
  - Reserve driver: sign, swap into a race seat, gains from tests.
  - Swap the driver order (favourite shown first).
  - Academy: scouting list where you sign or reject juniors, release academy drivers, and run junior training.
- Staff: plan a one-week leave per department. AI teams follow the same rule.
- Next-season plain-English summary. Team HQ redesign and a new visual theme.

## Round 12
- Practice/qualifying: setup panel now refreshes when a car returns, so "Apply engineer estimate" works again and the "car on track" lock clears. You now pick the exact tyre set for the next run: New, or any used set with its % life left. Default for used = the most life left.
- Practice/qualifying clock runs slower (1×/3×/9× = 6/18/60 s of session per second).
- Race timing tower is live: order and gaps follow track position, like the map, not only at the start/finish line.
- Strategy: an early, late or extra stop (SC, VSC, weather, damage, manual) replaces the nearest planned stop, and the remaining stops are re-spaced. No more "pit again as planned". AI does the same. Fixed AI repeating SC stops lap after lap.
- HQ: removed the car drawing. The dotted week line is replaced by race chips (last race + next four).
- Car & Dev: new default "Development plan" tab. Pick a focus and a spending level, and the technical director starts, builds and fits parts automatically. Manual parts are still available as "advanced".
- Reliability: each reliability run in practice now cuts failure risk (up to −50%). The player's worn-part and fatigue penalties were softened to match the AI.
- Finance: income statement for every race, split into income, recurring costs and one-off costs, with tips on where to save.
- Performance: autosave is batched (one disk write instead of many) and flushed when the tab closes. The backup copy is made at most every 10 minutes, and the save size is trimmed. The game pauses when hidden.
- Saves: "Download save file" + "Load from repo" (saves/savegame.json).
- Visual polish across the whole UI.

## Round 13
- SC/VSC/yellow re-checked. SC: field bunches up with no overtaking, and a car that pits under SC now really loses its pit time (before, it was erased). VSC: every car runs the same delta, so gaps are frozen and nobody catches up or overtakes. Single yellow: lift (+0.35s) and no passing in that sector. New double yellow (car stopped, no SC): bigger slow-down. Restart: no Overtake mode for 2 laps.
- Pit animation is real time. On the lap after a stop the car drives to its box, stands still for the stop time, drives out, then rejoins. A rival can no longer appear behind and then jump ahead later. The timing tower uses the same position.
- Chequered flag (practice/quali): a flying lap started before the flag is completed and counts. A car on its out-lap at the flag gets no flying lap (message shown), and cars in the garage stay in.
- Drivers learn from mistakes: within a race/session each mistake makes the next less likely, and experience carries over (+small consistency gain). All drivers.
- Slipstream train: the 2nd car in a close chain gets the normal tow, and each extra car behind gets a bit more (+15% per car, max +45%).
- Map ↔ timing selection: click a dot on the map or a row in timing; the selected car is highlighted in both and shows its name tag.
- New race instruction per car: Race / Follow car ahead (sit in the tow, no attack, saves battery) / Defend (harder to pass, ~0.1s/lap slower).

## V5.0
- Removed the "restart — Overtake mode in 2 laps" rule and message (not relevant with 2026 active aero).
- New "Pit Wall" look across the whole game (new css/v5.css): graphite panels with notched corners, volt-green accent plus a team-colour tint, condensed uppercase headings, monospace timing numbers, a redesigned menu, top bar, side menu, tabs, weekend stepper, timing tower, car panels, HQ banner and calendar chips.
- Version shown as V5.0 (menu, top bar, page title, offline cache tp-v5.0).

## V5.1
- Reverted the V5.0 "Pit Wall" colour theme: back to the previous (Round 13) graphics/UI.
- Qualifying: new "Follow for tow" instruction per car — No / Car ahead on track / any specific car. Racecraft affects spacing (tow vs dirty air). AI teams also use it on low-drag tracks.
