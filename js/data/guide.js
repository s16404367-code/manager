// Championship-mode guide: one entry per left-menu page, with every section explained.
// [title, one-line purpose, [[section, explanation], ...], tip]
export const GUIDE = {
  hq: ['🏠 HQ (Headquarters)', 'Your home screen. It tells you what is happening this week, what needs a decision, and what is at risk.', [
    ['📅 Season clock (Week x/52)', 'The year runs week by week. "Next week ▶" moves one week: projects progress, staff fatigue changes, offers and problems may appear. "Advance to race week ⏩" skips ahead but stops early when a decision is needed. In race week the button changes to "Go to race weekend".'],
    ['Year plan', 'The fixed dates of the year: factory reopens (week 1), development opens, pre-season testing, every race date, and the year close (week 52). The white line is today, green dots are finished races, the red dot is the next race.'],
    ['Championship', 'Your constructors\' position, points and board target, plus each driver\'s position.'],
    ['At risk', 'Board confidence (if it falls too low you are fired), cost-cap usage (overspending gives a points deduction) and team morale.'],
    ['Decision cards (📨 / ⚠️)', 'Events such as staff poaching, sponsor issues or factory problems. You must choose an option before you can advance or race.'],
    ['Needs attention', 'Automatic checklist: upgrades ready to fit, low cash, tired departments, expiring contracts, sponsor offers. Click an item to jump to the right page.'],
    ['Car vs field', 'Each car attribute compared with the average of the other teams (green = better).'],
    ['Last year\'s data', 'At the start of a new year: last season\'s results with suggestions on what to fix.'],
    ['Inbox / Paddock news', 'Messages from your team (facts) and rumours from the paddock (may be wrong).'],
  ], 'Start every week in HQ: clear decisions, deploy ready parts, then advance.'],
  weekend: ['🏁 Race Weekend', 'Everything at the circuit: Preparation → Practice → Qualifying → Strategy Lab → Race → Debrief.', [
    ['Preparation', 'Track demands, weather forecast for Friday/Saturday/Sunday, and how your car suits the circuit.'],
    ['Practice', 'Run programmes (setup work, long runs, quali sim, conditions, tyre comparison). Each lap is logged in "Practice analysis" by tyre with deg per lap. More knowledge = more accurate engineer estimates.'],
    ['Qualifying', 'Before Q1 choose the best practice setup and your qualifying tyre. From Q1 the setup is locked (parc fermé). Q1 cuts to 15, Q2 to 10, Q3 decides pole.'],
    ['Strategy Lab', 'Pick a plan per driver: start tyre, stop laps and compounds, fuel. The estimated life of each tyre is shown so stints are realistic.'],
    ['Race', 'Live pit wall: timing, map, telemetry and both driver panels. Alerts (safety car, rain, red flag, planned pit stop…) pause the race for your decision.'],
    ['Debrief', 'Classification, tyre-strategy chart and "Why?" explanations of the result.'],
  ], 'The weekend opens only in race week; use HQ to advance the calendar.'],
  championship: ['🏆 Championship', 'Standings and the season calendar.', [
    ['Constructors\' / Drivers\'', 'Tables and points-progress charts for the current season.'],
    ['Calendar', 'The year plan and every race with its date, winner and your best result.'],
    ['Past seasons', 'Every completed year: final position, points, drivers, finances, board objectives, best and worst tracks. Use it to plan the next year.'],
  ], ''],
  car: ['🔧 Car & Development', 'Design, build and fit upgrades.', [
    ['New project', 'Pick a concept, approach (conservative / standard / aggressive) and whether to build for both cars. It shows the expected gain range, cost, design + manufacturing weeks and failure risk. Projects can start once the development window opens.'],
    ['Crunch mode', 'Overtime for the factory: projects progress about 30% faster, but it costs $0.3M every week and pushes fatigue (and failure risk) up. It switches off automatically when no project is running.'],
    ['Pipeline & parts', 'Projects in design, manufacturing and ready to deploy. Deploy to fit parts; true gains are revealed after a race.'],
    ['Car overview', 'Your car\'s attributes and fitted upgrades.'],
    ['Next-year car', 'How much effort goes into next year\'s car (helps with new regulations but slows this year).'],
    ['Power units', 'Engine/gearbox parts per car. Each part wears; going over the allocation gives grid penalties.'],
  ], 'Fatigue: every department settles at a baseline of 20 when idle. Bigger projects (both cars, aggressive, long) raise fatigue faster in the departments working on them.'],
  facilities: ['🏭 Facilities', 'Long-term buildings: wind tunnel, simulator, R&D centre, factory, etc. Upgrades cost money and take weeks, but make every later project faster, cheaper or more accurate.', [], 'Build them early in the year; they pay off over seasons.'],
  regulations: ['📜 Regulations', 'Current sporting rules and next year\'s rule change (announced mid-season). Big changes reset part of the field — plan the next-year car split.', [], ''],
  staff: ['👥 Staff & Departments', 'Your people run everything.', [
    ['Departments', 'Aero, chassis, power unit, manufacturing, operations (pit crew), strategy, commercial, driver coaching. Each has a head (skill, morale, fatigue) and a headcount. Headcount adds capacity but costs salary.'],
    ['Fatigue & morale', 'Fatigue rises with workload and crunch, and falls back to the baseline when idle. High fatigue causes failed prototypes, defects and slow stops. "Give a break" drops fatigue quickly.'],
    ['Recruitment market', 'Hire better department heads. The market changes over the weeks.'],
  ], ''],
  drivers: ['🧑‍✈️ Drivers & Academy', 'Your race drivers, contracts and future talent.', [
    ['Our drivers', 'Skills, morale, contract, training programmes and teammate comparison.'],
    ['Driver market', 'Sign drivers from other teams or free agents.'],
    ['Academy', 'Junior drivers you can develop and promote.'],
  ], ''],
  finance: ['💰 Finance', 'Cash, cost cap, income and spending by category, and emergency options (loan, sponsor advance).', [], 'Watch crunch costs and facility upkeep; negative cash for long leads to administration.'],
  sponsors: ['🤝 Sponsors', 'Current partners and new offers. Each has an objective (points, top-X, finishes); meeting it keeps them happy and paying.', [], ''],
  board: ['🏛️ Board', 'Board confidence, season objectives and patience. Missing objectives lowers confidence; too low and you are replaced.', [], ''],
  history: ['📈 Race History', 'Every race you have run: filter by season, see totals (points, podiums, avg grid/finish, DNFs) and click a race for the full classification, pit stops, incidents, fastest lap and conditions.', [], ''],
  achievements: ['⭐ Achievements', 'Milestones you have unlocked.', [], ''],
  settings: ['⚙️ Settings', 'Speed, which race alerts pause the game, accessibility and display options.', [], ''],
  saves: ['💾 Save / Load', 'Manual save slots, export/import of save files.', [], ''],
};
export const GUIDE_ORDER = ['hq', 'weekend', 'championship', 'car', 'facilities', 'regulations', 'staff', 'drivers', 'finance', 'sponsors', 'board', 'history', 'achievements', 'settings', 'saves'];
