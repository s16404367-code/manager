# Changelog

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
