// Fictional drivers. pace, craft (racecraft), cons (consistency), tyre, wet, fb (feedback), start, pot (potential)
const D = (id, name, nat, age, team, pace, craft, cons, tyre, wet, fb, start, pot, pers) => ({ id, name, nat, age, team, pace, craft, cons, tyre, wet, fb, start, pot, pers });
export const DRIVERS = [
  D('drv_vance', 'Lucas Vance', 'NED', 27, 'tm_aurora', 95, 92, 90, 86, 93, 80, 88, 96, 'aggressive'),
  D('drv_okafor', 'Daniel Okafor', 'NGA', 29, 'tm_aurora', 86, 84, 88, 85, 80, 84, 82, 87, 'teamplayer'),
  D('drv_rossi', 'Matteo Ricci', 'ITA', 26, 'tm_scuderia', 91, 86, 83, 82, 84, 78, 87, 93, 'aggressive'),
  D('drv_leclair', 'Julien Leclair', 'MON', 27, 'tm_scuderia', 92, 85, 82, 80, 83, 82, 85, 94, 'independent'),
  D('drv_hart', 'Oliver Hart', 'GBR', 25, 'tm_silverline', 89, 87, 88, 88, 88, 86, 84, 92, 'technical'),
  D('drv_mendes', 'Rafael Mendes', 'BRA', 32, 'tm_silverline', 87, 90, 91, 89, 90, 90, 86, 87, 'conservative'),
  D('drv_nakamura', 'Ren Nakamura', 'JPN', 24, 'tm_papaya', 90, 84, 84, 84, 86, 79, 83, 95, 'aggressive'),
  D('drv_piastri', 'Liam Castle', 'AUS', 23, 'tm_papaya', 88, 85, 87, 86, 82, 81, 82, 94, 'conservative'),
  D('drv_berg', 'Erik Berg', 'SWE', 30, 'tm_verdant', 83, 85, 86, 84, 82, 85, 83, 84, 'teamplayer'),
  D('drv_alvarez', 'Diego Alvarez', 'ESP', 36, 'tm_verdant', 86, 93, 90, 91, 91, 92, 88, 86, 'technical'),
  D('drv_dubois', 'Pierre Dubois', 'FRA', 28, 'tm_alpinex', 84, 82, 83, 82, 80, 80, 81, 86, 'independent'),
  D('drv_klein', 'Max Klein', 'GER', 22, 'tm_alpinex', 83, 78, 78, 78, 79, 70, 80, 93, 'aggressive'),
  D('drv_lindqvist', 'Nils Lindqvist', 'FIN', 31, 'tm_nordic', 82, 83, 87, 85, 81, 83, 81, 83, 'lowinfo'),
  D('drv_patel', 'Arjun Patel', 'IND', 25, 'tm_nordic', 83, 80, 82, 83, 84, 82, 79, 90, 'technical'),
  D('drv_morgan', 'Cole Morgan', 'USA', 27, 'tm_kodiak', 81, 84, 80, 79, 78, 77, 84, 84, 'aggressive'),
  D('drv_ivanov', 'Pavel Ivanov', 'KAZ', 29, 'tm_kodiak', 80, 82, 84, 83, 80, 80, 80, 82, 'teamplayer'),
  D('drv_chen', 'Zhou Chen', 'CHN', 24, 'tm_haze', 81, 79, 81, 82, 78, 80, 78, 89, 'conservative'),
  D('drv_novak', 'Tomas Novak', 'CZE', 26, 'tm_haze', 79, 80, 79, 78, 82, 76, 79, 85, 'independent'),
  D('drv_silva', 'Bruno Silva', 'POR', 21, 'tm_sabre', 80, 76, 76, 77, 77, 72, 77, 94, 'aggressive'),
  D('drv_holt', 'Sam Holt', 'NZL', 33, 'tm_sabre', 78, 83, 86, 84, 83, 84, 80, 78, 'teamplayer'),
  // free agents
  D('drv_fa1', 'Kevin Marsh', 'CAN', 30, null, 80, 81, 82, 80, 79, 79, 80, 81, 'conservative'),
  D('drv_fa2', 'Aleks Petrov', 'RUS', 27, null, 81, 79, 78, 78, 83, 76, 81, 84, 'aggressive'),
  D('drv_fa3', 'Hugo Martin', 'BEL', 24, null, 82, 78, 79, 80, 80, 78, 79, 90, 'technical'),
  D('drv_fa4', 'Yuki Tanabe', 'JPN', 25, null, 81, 80, 77, 79, 78, 75, 82, 87, 'independent'),
  D('drv_fa5', 'Marco Bianchi', 'ITA', 34, null, 79, 86, 87, 86, 84, 88, 83, 79, 'teamplayer'),
  D('drv_fa6', 'Ethan Brooks', 'GBR', 23, null, 80, 77, 78, 79, 76, 77, 78, 91, 'lowinfo'),
  // academy juniors (F2-level)
  D('drv_jr1', 'Aiden Ferro', 'ARG', 19, 'academy', 74, 70, 68, 70, 72, 65, 72, 95, 'aggressive'),
  D('drv_jr2', 'Sofia Laurent', 'FRA', 20, 'academy', 75, 72, 72, 73, 76, 74, 71, 92, 'technical'),
  D('drv_jr3', 'Kai Reddy', 'IND', 18, 'academy', 72, 68, 66, 69, 70, 68, 70, 97, 'independent'),
  D('drv_jr4', 'Noah Schmidt', 'GER', 20, 'academy', 76, 71, 73, 72, 70, 71, 74, 89, 'conservative'),
];
export const PERSONALITIES = {
  aggressive: { label: 'Aggressive', desc: 'Faster overtakes, more tyre stress, higher incident risk.', ovt: 1.2, inc: 1.4, wear: 1.08, orders: 0.5 },
  conservative: { label: 'Conservative', desc: 'Protects tyres and finishes races; weaker in wheel-to-wheel attacks.', ovt: 0.85, inc: 0.7, wear: 0.94, orders: 0.85 },
  teamplayer: { label: 'Team Player', desc: 'Accepts team orders with little morale loss.', ovt: 1, inc: 0.9, wear: 1, orders: 1 },
  independent: { label: 'Independent', desc: 'Strong self-belief; resents team orders.', ovt: 1.05, inc: 1.05, wear: 1, orders: 0.3 },
  technical: { label: 'Technical', desc: 'Excellent setup feedback, accelerates development correlation.', ovt: 1, inc: 0.95, wear: 0.98, orders: 0.8, fbBonus: 8 },
  lowinfo: { label: 'Low-information', desc: 'Fast but vague feedback — setup work is harder.', ovt: 1, inc: 1, wear: 1, orders: 0.7, fbBonus: -12 },
};
