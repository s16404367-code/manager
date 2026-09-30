// Data-driven content: departments, staff roles, facilities, development projects, sponsors, events, regulations, achievements.
export const DEPARTMENTS = {
  aero: { label: 'Aerodynamics', role: 'Aero Director', affects: 'Aero project quality & correlation' },
  chassis: { label: 'Chassis / Design', role: 'Chief Designer', affects: 'Mechanical & structural projects, part weight' },
  vd: { label: 'Vehicle Dynamics', role: 'Vehicle Dynamics Lead', affects: 'Setup optimum discovery, tyre usage' },
  pu: { label: 'Power Unit Integration', role: 'Head of PU', affects: 'PU power/efficiency projects, engine reliability' },
  rel: { label: 'Reliability', role: 'Reliability Chief', affects: 'Failure rate, component life' },
  ops: { label: 'Race Operations', role: 'Chief Mechanic', affects: 'Pit stop speed & error rate, damage repairs' },
  strat: { label: 'Strategy', role: 'Head of Strategy', affects: 'Forecast accuracy, rival strategy insight, pit call advice' },
  mfg: { label: 'Manufacturing', role: 'Manufacturing Manager', affects: 'Part build time, cost, defects' },
  sim: { label: 'Simulation & Data', role: 'Head of Simulation', affects: 'Expected-gain accuracy, practice efficiency' },
  drv: { label: 'Driver Development', role: 'Driver Coach', affects: 'Driver growth, confidence, academy' },
  com: { label: 'Commercial', role: 'Commercial Director', affects: 'Sponsor offers & satisfaction' },
};
export const TD_ROLE = 'Technical Director';
export const FIRST = ['James', 'Anna', 'Marco', 'Hiro', 'Elena', 'Tom', 'Priya', 'Lars', 'Chloe', 'Omar', 'Greta', 'Sanjay', 'Fiona', 'Paolo', 'Mei', 'Ravi', 'Ines', 'Karl', 'Nadia', 'Victor', 'Ruth', 'Andre', 'Lena', 'Felix', 'Ayesha', 'Jonas', 'Carla', 'Ben', 'Yara', 'Ivo'];
export const LAST = ['Whitmore', 'Rossi', 'Tanaka', 'Novak', 'Brandt', 'Iyer', 'Moreau', 'Kowalski', 'Hughes', 'Santos', 'Berg', 'Haddad', 'Fischer', 'Costa', 'Lindgren', 'Rao', 'Dupont', 'Maher', 'Keller', 'Nair', 'Vogel', 'Ortega', 'Hall', 'Sato', 'Petersen', 'Reyes', 'Kumar', 'Grant', 'Weiss', 'Byrne'];
export const SPECIALTIES = ['Innovator', 'Process-driven', 'Motivator', 'Analyst', 'Pragmatist', 'Perfectionist'];
export const SPEC_DESC = { Innovator: 'Higher ceiling & variance on projects', 'Process-driven': 'Lower variance, fewer failures', Motivator: 'Department morale & fatigue recovery', Analyst: 'Better correlation/estimates', Pragmatist: 'Cheaper, faster output', Perfectionist: 'Higher quality but slower' };

export const FACILITIES = {
  windTunnel: { label: 'Wind Tunnel', desc: 'Aero project quality and correlation accuracy.', cost: 9e6, weeks: 5, upkeep: 0.35e6 },
  cfd: { label: 'CFD Centre', desc: 'Faster aero research; better expected-gain estimates.', cost: 7e6, weeks: 4, upkeep: 0.25e6 },
  rnd: { label: 'R&D Centre', desc: 'Project speed for all areas; unlocks aggressive concepts.', cost: 8e6, weeks: 5, upkeep: 0.3e6 },
  factory: { label: 'Factory', desc: 'Manufacturing speed and part quality.', cost: 8e6, weeks: 5, upkeep: 0.3e6 },
  relLab: { label: 'Reliability Lab', desc: 'Lower failure rates; reveals reliability risk.', cost: 5e6, weeks: 3, upkeep: 0.18e6 },
  simulator: { label: 'Driver Simulator', desc: 'Better setup starting point; driver growth.', cost: 6e6, weeks: 4, upkeep: 0.2e6 },
  analysis: { label: 'Analysis Centre', desc: 'Forecast accuracy, rival pace insight during races.', cost: 4e6, weeks: 3, upkeep: 0.15e6 },
  pitCentre: { label: 'Pit Training Centre', desc: 'Faster, more consistent pit stops.', cost: 3e6, weeks: 2, upkeep: 0.1e6 },
};

// Development project templates. primary/secondary effects are car attribute deltas (expected, at 'standard').
export const PROJECTS = [
  { id: 'prj_floor', name: 'Floor & Diffuser Revision', dept: 'aero', fac: 'windTunnel', effects: { medAero: 1.6, highAero: 1.4, lowAero: 0.6 }, side: { reliability: -0.3 }, weeks: 4, cost: 2.6e6, mfg: 1.2e6, aero: true },
  { id: 'prj_fwing', name: 'Front Wing — Outwash Concept', dept: 'aero', fac: 'windTunnel', effects: { lowAero: 1.8, medAero: 0.8 }, side: { tyreCare: -0.4 }, weeks: 3, cost: 1.6e6, mfg: 0.6e6, aero: true },
  { id: 'prj_lowdrag', name: 'Low-Drag Rear Wing Package', dept: 'aero', fac: 'cfd', effects: { dragEff: 2.2 }, side: { highAero: -0.6, lowAero: -0.4 }, weeks: 3, cost: 1.4e6, mfg: 0.5e6, aero: true },
  { id: 'prj_hidf', name: 'High-Downforce Rear Wing', dept: 'aero', fac: 'windTunnel', effects: { lowAero: 1.5, medAero: 1.2 }, side: { dragEff: -0.9 }, weeks: 3, cost: 1.4e6, mfg: 0.5e6, aero: true },
  { id: 'prj_sidepod', name: 'Sidepod & Cooling Layout', dept: 'aero', fac: 'cfd', effects: { cooling: 2.0, dragEff: 0.8 }, side: { medAero: -0.3 }, weeks: 4, cost: 2.0e6, mfg: 1.0e6, aero: true },
  { id: 'prj_susp', name: 'Front Suspension Geometry', dept: 'chassis', fac: 'rnd', effects: { mech: 1.8, tyreCare: 0.8 }, side: {}, weeks: 4, cost: 1.8e6, mfg: 0.9e6 },
  { id: 'prj_rearsusp', name: 'Rear Suspension & Traction', dept: 'vd', fac: 'rnd', effects: { traction: 2.0, tyreCare: 0.6 }, side: { highAero: -0.3 }, weeks: 4, cost: 1.8e6, mfg: 0.9e6 },
  { id: 'prj_brakes', name: 'Brake-by-Wire Calibration', dept: 'vd', fac: 'simulator', effects: { braking: 2.2 }, side: {}, weeks: 2, cost: 0.9e6, mfg: 0.3e6 },
  { id: 'prj_weight', name: 'Chassis Weight Reduction', dept: 'chassis', fac: 'factory', effects: { mech: 0.9, traction: 0.7, braking: 0.7, lowAero: 0.5 }, side: { reliability: -0.6 }, weeks: 5, cost: 2.8e6, mfg: 1.4e6 },
  { id: 'prj_pupower', name: 'PU Combustion Mapping', dept: 'pu', fac: 'rnd', effects: { power: 1.8 }, side: { reliability: -0.7, cooling: -0.3 }, weeks: 4, cost: 2.2e6, mfg: 0.6e6 },
  { id: 'prj_ers', name: 'ERS Deployment Software', dept: 'pu', fac: 'simulator', effects: { puEff: 2.2, power: 0.4 }, side: {}, weeks: 3, cost: 1.2e6, mfg: 0.1e6 },
  { id: 'prj_relpack', name: 'Reliability Upgrade Pack', dept: 'rel', fac: 'relLab', effects: { reliability: 3.0 }, side: { power: -0.2 }, weeks: 3, cost: 1.3e6, mfg: 0.6e6 },
  { id: 'prj_tyremodel', name: 'Tyre Thermal Model', dept: 'vd', fac: 'simulator', effects: { tyreCare: 2.2 }, side: {}, weeks: 3, cost: 1.1e6, mfg: 0.2e6 },
];
export const APPROACHES = {
  conservative: { label: 'Conservative', gain: 0.65, sd: 0.15, fail: 0.02, cost: 0.8, time: 0.9, side: 0.6, desc: 'Small, predictable gain. Low risk.' },
  standard: { label: 'Standard', gain: 1.0, sd: 0.3, fail: 0.07, cost: 1.0, time: 1.0, side: 1.0, desc: 'Balanced expected gain and risk.' },
  aggressive: { label: 'Aggressive', gain: 1.6, sd: 0.55, fail: 0.18, cost: 1.35, time: 1.15, side: 1.5, desc: 'Big potential gain; wide variance; failure and reliability risk.' },
};

export const SPONSOR_POOL = [
  { id: 'sp_nexa', name: 'Nexa Telecom', perRace: 1.1e6, objective: 'points', target: 1, bonus: 0.4e6, minRep: 30 },
  { id: 'sp_orbit', name: 'Orbit Energy', perRace: 2.2e6, objective: 'top', target: 6, bonus: 0.8e6, minRep: 55 },
  { id: 'sp_kairo', name: 'Kairo Watches', perRace: 0.7e6, objective: 'finish', target: 2, bonus: 0.2e6, minRep: 0 },
  { id: 'sp_vanta', name: 'Vanta Cloud', perRace: 3.0e6, objective: 'top', target: 3, bonus: 1.5e6, minRep: 75 },
  { id: 'sp_helix', name: 'Helix Pharma', perRace: 0.9e6, objective: 'points', target: 1, bonus: 0.3e6, minRep: 20 },
  { id: 'sp_rune', name: 'Rune Beverages', perRace: 1.5e6, objective: 'top', target: 8, bonus: 0.5e6, minRep: 40 },
  { id: 'sp_sol', name: 'Sol Airlines', perRace: 1.8e6, objective: 'points', target: 2, bonus: 0.6e6, minRep: 50 },
  { id: 'sp_mint', name: 'Mintline Crypto', perRace: 2.5e6, objective: 'finish', target: 2, bonus: 0.2e6, minRep: 10, volatile: true },
  { id: 'sp_forge', name: 'Forge Tools', perRace: 0.5e6, objective: 'finish', target: 1, bonus: 0.15e6, minRep: 0 },
  { id: 'sp_apex', name: 'Apex Bank', perRace: 4.0e6, objective: 'top', target: 2, bonus: 2e6, minRep: 85 },
];
export const OBJ_TEXT = { points: (n) => `${n}+ car(s) in the points`, top: (n) => `Best finish P${n} or better`, finish: (n) => `${n} car(s) finish` };

// Regulation changes announced mid-season, applied next season. effect multiplies (resets towards baseline) listed attributes.
export const REGULATIONS = [
  { id: 'reg_aero_cut', name: 'Floor Edge & Downforce Reduction', desc: 'Aero attributes regress 40% towards a common baseline. Teams investing early in next-year aero recover faster.', attrs: ['lowAero', 'medAero', 'highAero'], regress: 0.4, area: 'aero' },
  { id: 'reg_pu_fuel', name: 'Sustainable Fuel & ERS Rebalance', desc: 'PU power and efficiency regress 45% towards baseline. PU integration teams adapt faster.', attrs: ['power', 'puEff'], regress: 0.45, area: 'pu' },
  { id: 'reg_tyre', name: 'New Tyre Construction', desc: 'Tyre management and mechanical grip regress 35% towards baseline.', attrs: ['tyreCare', 'mech'], regress: 0.35, area: 'chassis' },
  { id: 'reg_weight', name: 'Minimum Weight Increase', desc: 'Traction and braking regress 30% towards baseline. Cooling demands rise.', attrs: ['traction', 'braking', 'cooling'], regress: 0.3, area: 'chassis' },
];
export const ATR_TABLE = [0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.15]; // aero testing allowance multiplier by constructor position (P1 = least)
export const COST_CAP = 145e6;

// Season events. Each option has explicit trade-offs; effects are interpreted by eventEngine.
export const EVENTS = [
  { id: 'ev_crunch', title: 'Factory asks for overtime', text: 'The design office can pull the next upgrade forward if staff accept a crunch period.', options: [
    { label: 'Approve crunch', fx: { devProgress: 1, fatigue: 18, morale: -6 }, note: 'Projects advance ~1 week. Fatigue rises sharply.' },
    { label: 'Protect staff', fx: { morale: 4, fatigue: -8 }, note: 'Morale up, no acceleration.' } ] },
  { id: 'ev_sponsor_event', title: 'Sponsor demands driver appearances', text: 'A key sponsor wants both drivers at a promotional event on simulator day.', options: [
    { label: 'Send drivers', fx: { sponsorSat: 10, setupKnowledge: -0.15, driverMorale: -3 }, note: 'Sponsors happy; weaker setup start next weekend.' },
    { label: 'Decline', fx: { sponsorSat: -12 }, note: 'Sponsor satisfaction drops.' } ] },
  { id: 'ev_supplier', title: 'Carbon supplier delay', text: 'A composites supplier is running three weeks late.', options: [
    { label: 'Pay express premium', fx: { cash: -1.2e6 }, note: 'Costs $1.2M, no delay.' },
    { label: 'Accept the delay', fx: { mfgDelay: 1 }, note: 'All manufacturing slips 1 week.' } ] },
  { id: 'ev_media', title: 'Media storm after comments', text: 'Your lead driver criticised the car in a press conference.', options: [
    { label: 'Back your driver publicly', fx: { driverMorale: 8, engMorale: -6 }, note: 'Driver morale up, engineers annoyed.' },
    { label: 'Reprimand privately', fx: { driverMorale: -8, engMorale: 3, board: 2 }, note: 'Board appreciates discipline.' } ] },
  { id: 'ev_investor', title: 'Investor offers cash for influence', text: 'A wealthy investor offers $8M in exchange for a seat on the board.', options: [
    { label: 'Accept', fx: { cash: 8e6, boardPatience: -0.1 }, note: 'Cash now, but the board becomes less patient.' },
    { label: 'Decline', fx: { board: 3 }, note: 'Board values independence.' } ] },
  { id: 'ev_wt_fault', title: 'Wind tunnel calibration fault', text: 'Engineers suspect the tunnel belt has drifted out of calibration.', options: [
    { label: 'Shut down for recalibration', fx: { devProgress: -1, correlation: 0.1 }, note: 'Lose ~1 week of aero progress; better correlation afterwards.' },
    { label: 'Keep running', fx: { correlation: -0.15 }, note: 'No delay, but upgrades may not match predictions.' } ] },
  { id: 'ev_junior', title: 'Junior series star available', text: 'A championship-leading junior wants to join your academy for a fee.', options: [
    { label: 'Sign him ($1.5M)', fx: { cash: -1.5e6, junior: 1 }, note: 'A high-potential junior joins your academy.' },
    { label: 'Pass', fx: {}, note: 'Nothing changes.' } ] },
  { id: 'ev_raise', title: 'Pit crew requests bonus pool', text: 'The mechanics feel under-rewarded after a heavy triple-header.', options: [
    { label: 'Pay $0.6M bonus', fx: { cash: -0.6e6, opsMorale: 12 }, note: 'Pit crew morale up.' },
    { label: 'Refuse', fx: { opsMorale: -12 }, note: 'Risk of slower, error-prone stops.' } ] },
  { id: 'ev_legality', title: 'Rival questions your floor legality', text: 'A rival requests clarification from race control on your floor design.', options: [
    { label: 'Modify pre-emptively', fx: { carAttr: { medAero: -0.8 }, board: 1 }, note: 'Small performance loss, no risk.' },
    { label: 'Stand firm', fx: { gamble: 0.3 }, note: '30% chance of a $3M fine and forced modification.' } ] },
  { id: 'ev_tech_share', title: 'Engine supplier offers test data', text: 'Your PU partner offers dyno data in exchange for exclusive marketing rights.', options: [
    { label: 'Accept', fx: { carAttr: { puEff: 1.2 }, sponsorSat: -5 }, note: 'Efficiency gain; commercial partners unhappy.' },
    { label: 'Decline', fx: { sponsorSat: 3 }, note: 'Commercial freedom retained.' } ] },
];

export const ACHIEVEMENTS = [
  { id: 'ach_first_race', name: 'Lights Out', desc: 'Complete your first race.' },
  { id: 'ach_points', name: 'On the Board', desc: 'Score points.' },
  { id: 'ach_podium', name: 'Champagne', desc: 'Finish on the podium.' },
  { id: 'ach_win', name: 'Race Winner', desc: 'Win a Grand Prix.' },
  { id: 'ach_one_two', name: 'One-Two', desc: 'Finish 1st and 2nd.' },
  { id: 'ach_pole', name: 'Pole Sitter', desc: 'Take pole position.' },
  { id: 'ach_wet_win', name: 'Rain Master', desc: 'Score points in a wet race.' },
  { id: 'ach_upgrade', name: 'It Works!', desc: 'Deploy an upgrade that beats its prediction.' },
  { id: 'ach_facility', name: 'Builder', desc: 'Upgrade a facility to level 4.' },
  { id: 'ach_season', name: 'Full Season', desc: 'Complete a career season.' },
  { id: 'ach_champion', name: 'World Champions', desc: 'Win the Constructors\' Championship.' },
  { id: 'ach_undercut', name: 'Undercut Artist', desc: 'Gain a position via pit stop timing.' },
];
