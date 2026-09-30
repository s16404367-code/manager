// Fictional teams. car = baseline car attribute profile (0..100). tier drives organisation generation.
export const CAR_ATTRS = ['lowAero', 'medAero', 'highAero', 'dragEff', 'mech', 'traction', 'braking', 'tyreCare', 'cooling', 'reliability', 'power', 'puEff'];
export const ATTR_LABEL = { lowAero: 'Low-speed aero', medAero: 'Medium-speed aero', highAero: 'High-speed aero', dragEff: 'Drag efficiency', mech: 'Mechanical grip', traction: 'Traction', braking: 'Braking stability', tyreCare: 'Tyre management', cooling: 'Cooling', reliability: 'Reliability', power: 'PU power', puEff: 'PU/ERS efficiency' };
const car = (b, m) => Object.fromEntries(CAR_ATTRS.map((k) => [k, Math.round(b + (m[k] || 0))]));
export const TEAMS = [
  { id: 'tm_aurora', name: 'Aurora Racing', abbr: 'AUR', color: '#1e6bff', color2: '#b8d0ff', tier: 'front', philosophy: 'aero', aiStyle: 'calculated', car: car(79, { lowAero: 5, medAero: 4, highAero: 4, dragEff: -4, power: 1 }) },
  { id: 'tm_scuderia', name: 'Scuderia Rossano', abbr: 'ROS', color: '#e1261c', color2: '#ffd400', tier: 'front', philosophy: 'power', aiStyle: 'aggressive', car: car(79, { power: 7, dragEff: 5, tyreCare: -5, reliability: -4 }) },
  { id: 'tm_silverline', name: 'Silverline GP', abbr: 'SLV', color: '#20c9b0', color2: '#d9fff8', tier: 'challenger', philosophy: 'balanced', aiStyle: 'calculated', car: car(76, { reliability: 6, puEff: 5 }) },
  { id: 'tm_papaya', name: 'Ember Works', abbr: 'EMB', color: '#ff8a00', color2: '#1a2a44', tier: 'challenger', philosophy: 'mech', aiStyle: 'opportunist', car: car(75, { mech: 6, traction: 5, highAero: -3 }) },
  { id: 'tm_verdant', name: 'Verdant Motorsport', abbr: 'VRD', color: '#0f8a4f', color2: '#c8f5d8', tier: 'midfield', philosophy: 'aero', aiStyle: 'conservative', car: car(71, { highAero: 5, medAero: 3, dragEff: -4 }) },
  { id: 'tm_alpinex', name: 'Altitude Racing', abbr: 'ALT', color: '#ff5ca8', color2: '#0b3d91', tier: 'midfield', philosophy: 'reliability', aiStyle: 'conservative', car: car(70, { reliability: 8, cooling: 4, power: -3 }) },
  { id: 'tm_nordic', name: 'Nordic Arrow', abbr: 'NRA', color: '#7fb3ff', color2: '#ffffff', tier: 'midfield', philosophy: 'power', aiStyle: 'opportunist', car: car(70, { power: 5, dragEff: 5, lowAero: -5 }) },
  { id: 'tm_kodiak', name: 'Kodiak Racing', abbr: 'KDK', color: '#8a5a2b', color2: '#f2d7a6', tier: 'midfield', philosophy: 'ops', aiStyle: 'aggressive', car: car(68, { traction: 3, braking: 4 }) },
  { id: 'tm_haze', name: 'Haze Engineering', abbr: 'HZE', color: '#9aa3ad', color2: '#d1202f', tier: 'back', philosophy: 'develop', aiStyle: 'aggressive', car: car(64, { tyreCare: 4, reliability: -3 }) },
  { id: 'tm_sabre', name: 'Sabre Autosport', abbr: 'SBR', color: '#6a2cff', color2: '#e3d6ff', tier: 'back', philosophy: 'driver', aiStyle: 'opportunist', car: car(63, { mech: 3, power: -2 }) },
];
export const PROFILES = {
  back: { label: 'Backmarker', desc: 'Weakest car, limited facilities and cash, low reputation and low expectations — high growth potential.', carBase: 63, cash: 22e6, budget: 95e6, fac: 1.6, staff: 50, rep: 25, target: 9, boardPatience: 1.3, sponsorBase: 0.6, payroll: 0.7 },
  midfield: { label: 'Midfield', desc: 'Balanced car, moderate facilities and budget, reasonable expectations.', carBase: 70, cash: 40e6, budget: 125e6, fac: 2.6, staff: 62, rep: 50, target: 6, boardPatience: 1.0, sponsorBase: 1.0, payroll: 1.0 },
  challenger: { label: 'Constructor Challenger', desc: 'Strong facilities and technical organisation, higher payroll, high board pressure.', carBase: 74, cash: 55e6, budget: 140e6, fac: 3.6, staff: 72, rep: 65, target: 3, boardPatience: 0.8, sponsorBase: 1.3, payroll: 1.35 },
  front: { label: 'Established Front-Runner', desc: 'Strong car, elite personnel, huge budget — high expectations and small tolerance for failure.', carBase: 79, cash: 80e6, budget: 150e6, fac: 4.4, staff: 82, rep: 88, target: 1, boardPatience: 0.6, sponsorBase: 1.7, payroll: 1.7 },
};
export const PHILOSOPHIES = {
  aero: { label: 'Aero Excellence', desc: 'Cornering aero strength; slower straight-line. Aero staff attracted; board expects fast-track results.', car: { lowAero: 3, medAero: 4, highAero: 4, dragEff: -3 }, dept: { aero: 8 }, devBias: ['lowAero', 'medAero', 'highAero'], risk: 0.5 },
  mech: { label: 'Mechanical Grip', desc: 'Strong low-speed & traction, kind to tyres. Weaker high-speed aero.', car: { mech: 5, traction: 4, tyreCare: 3, highAero: -3 }, dept: { vd: 8 }, devBias: ['mech', 'traction', 'tyreCare'], risk: 0.45 },
  power: { label: 'Straight-Line / Power', desc: 'Top speed & PU integration. Higher engine stress, weaker corners.', car: { power: 4, dragEff: 5, lowAero: -3, cooling: -2 }, dept: { pu: 8 }, devBias: ['power', 'dragEff', 'puEff'], risk: 0.55 },
  reliability: { label: 'Reliability First', desc: 'Bulletproof car and low variance development. Lower peak performance.', car: { reliability: 8, cooling: 4, power: -2, medAero: -2 }, dept: { rel: 10 }, devBias: ['reliability', 'cooling'], risk: 0.25 },
  develop: { label: 'Development Aggression', desc: 'Faster, riskier upgrade cycles. More failures and fatigue, higher ceiling.', car: { reliability: -3 }, dept: { aero: 4, mfg: 4 }, devBias: ['medAero', 'highAero', 'lowAero'], risk: 0.85, devSpeed: 1.2 },
  ops: { label: 'Race Operations', desc: 'Elite pit crew and strategists. Car itself is average.', car: {}, dept: { ops: 10, strat: 10 }, devBias: ['braking', 'traction'], risk: 0.4 },
  driver: { label: 'Driver Development', desc: 'Academy and coaching excellence: drivers grow faster, feedback improves.', car: { mech: 1 }, dept: { drv: 12 }, devBias: ['mech', 'tyreCare'], risk: 0.45 },
  balanced: { label: 'Balanced', desc: 'No major weaknesses, no major strengths.', car: { lowAero: 1, medAero: 1, highAero: 1, mech: 1, power: 1 }, dept: {}, devBias: [], risk: 0.5 },
};
