// Assistant de programme : objectif → séances types → bloc de semaines écrit dans le plan.
// Prescription : ACSM 2009, NSCA 2016 ; volume : Schoenfeld 2017 ; repos : Schoenfeld 2016 ; réserve : Helms 2016 ;
// périodisation : Williams 2017 ; décharge : Bell 2023 ; affûtage : Bosquet 2007 ; endurance polarisée : Stöggl 2014.
import { LIB, LIB_BY_ID, equipSet, GOAL_BY_ID, SYSTEMS, libMatch } from './library.js';
import { meta, day, clone, uid, KIND } from './plan.js';
import { putMany, put, remove, links, myProfile } from './store.js';
import { cloud } from './supa.js';
import { addDays, mondayOf, todayKey, dow, fmtDay, diffDays, mmss } from './dates.js';

export const LEVELS = [[1, 'Débutant', 'moins d’un an d’entraînement régulier'], [2, 'Intermédiaire', '1 à 3 ans'], [3, 'Avancé', 'plus de 3 ans']];
export const DURS = [45, 60, 75, 90];
export const GROUP_LBL = { jambes: 'jambes', dos: 'bas du dos', poussee: 'poussée (pectoraux, triceps)', tirage: 'tirage (dos, biceps)', epaule: 'épaules', doigts: 'doigts', cardio: 'cardio intense' };

/* ---------- Prescriptions (par niveau : débutant, intermédiaire, avancé) ---------- */
const RX = {
  force: [{ r: [8, 10], s: 3, rir: 3, pct: '≈ 65-75 % du max', rest: 120 }, { r: [4, 6], s: 4, rir: 2, pct: '≈ 80-85 % du max', rest: 180 }, { r: [3, 5], s: 5, rir: 2, pct: '≈ 85-90 % du max', rest: 210 }],
  hyper: [{ r: [10, 12], s: 3, rir: 3, pct: '≈ 65-75 % du max', rest: 90 }, { r: [8, 12], s: 3, rir: 2, pct: '≈ 67-80 % du max', rest: 120 }, { r: [6, 12], s: 4, rir: 1, pct: '≈ 67-85 % du max', rest: 150 }],
  endu_f: [{ r: [15, 20], s: 2, rir: 3, pct: 'charge légère', rest: 60 }, { r: [15, 20], s: 3, rir: 2, pct: '< 67 % du max', rest: 60 }, { r: [12, 20], s: 3, rir: 2, pct: '< 67 % du max', rest: 45 }],
  puiss: [{ r: [3, 5], s: 3, rir: 4, pct: 'charge légère', rest: 150 }, { r: [3, 5], s: 4, rir: 4, pct: '30-60 % du max', rest: 180 }, { r: [2, 4], s: 5, rir: 4, pct: '30-60 % du max', rest: 180 }],
  acc: [{ r: [10, 12], s: 2, rir: 3, rest: 75 }, { r: [8, 12], s: 3, rir: 2, rest: 90 }, { r: [8, 12], s: 3, rir: 2, rest: 90 }],
  prev: [{ r: [12, 15], s: 2, rir: 3, rest: 60 }, { r: [12, 15], s: 2, rir: 3, rest: 60 }, { r: [12, 15], s: 3, rir: 3, rest: 60 }]
};
const STRENGTH_GOALS = ['force', 'hyper', 'endu_f', 'puiss'];

/* ---------- Séances types ---------- */
const ST = {
  fbA: { kind: 'muscu', t: 'Corps entier A', slots: [['squat', 'main'], ['push-h', 'main'], ['pull-v', 'main'], ['unilat', 'acc'], ['core', 'acc'], ['epaule', 'prev']] },
  fbB: { kind: 'muscu', t: 'Corps entier B', slots: [['hinge', 'main'], ['push-v', 'main'], ['pull-h', 'main'], ['unilat', 'acc'], ['core', 'acc'], ['mollet', 'prev']] },
  haut: { kind: 'muscu', t: 'Haut du corps', slots: [['push-h', 'main'], ['pull-v', 'main'], ['push-v', 'main'], ['pull-h', 'main'], ['epaule', 'prev'], ['core', 'acc']] },
  bas: { kind: 'muscu', t: 'Bas du corps', slots: [['squat', 'main'], ['hinge', 'main'], ['unilat', 'acc'], ['ischio', 'prev'], ['mollet', 'prev'], ['core', 'acc']] },
  puiss: { kind: 'muscu', t: 'Puissance', goal: 'puiss', slots: [['plyo', 'puiss'], ['squat-puiss|hinge', 'puiss'], ['push-puiss|push-h', 'puiss'], ['pull-puiss|pull-v', 'puiss'], ['core', 'acc']] },
  renfo: { kind: 'muscu', t: 'Renfo grimpeur', goal: 'force', slots: [['pull-v', 'main'], ['push-h', 'acc'], ['pull-iso|pull-h', 'acc'], ['epaule', 'prev'], ['avantbras', 'prev'], ['core', 'acc']] },
  prevS: { kind: 'renfo', t: 'Prévention', goal: 'prev', slots: [['epaule', 'prev'], ['ischio', 'prev'], ['mollet', 'prev'], ['avantbras', 'prev'], ['core', 'prev'], ['unilat', 'prev']] },
  mobi: { kind: 'recup', t: 'Mobilité' },
  doigts: { kind: 'doigts', t: 'Doigts' }, bloc: { kind: 'grimpe', t: 'Bloc à la limite' }, resist: { kind: 'grimpe', t: 'Résistance' }, conti: { kind: 'grimpe', t: 'Continuité' },
  ef: { kind: 'cardio', t: 'Endurance fondamentale' }, int: { kind: 'cardio', t: 'Intervalles' }, long: { kind: 'cardio', t: 'Sortie longue' }, lact: { kind: 'cardio', t: 'Intervalles lactiques' },
  sprint: { kind: 'course', t: 'Vitesse' }, circuit: { kind: 'velo', t: 'Circuit' }
};
export const SESSION_LBL = Object.fromEntries(Object.entries(ST).map(([k, v]) => [k, v.t]));

// Répartition des séances de la semaine selon l'objectif et le nombre de jours
function pattern(goal, n) {
  const P = {
    force: ['fbA', 'fbB', 'fbA', 'haut|bas', 'mobi'], hyper: ['fbA', 'fbB', 'fbA', 'haut|bas', 'mobi'], endu_f: ['fbA', 'circuit', 'fbB', 'lact', 'ef'],
    puiss: ['puiss', 'fbA', 'puiss', 'fbB', 'mobi'], vit: ['sprint', 'fbA', 'sprint', 'fbB', 'mobi'],
    aero: ['int', 'long', 'ef', 'ef', 'int', 'ef'], doigts: ['doigts', 'conti', 'doigts', 'renfo', 'mobi'], bloc: ['bloc', 'renfo', 'bloc', 'conti', 'mobi'],
    resist: ['resist', 'bloc', 'resist', 'conti', 'renfo'], conti: ['conti', 'renfo', 'conti', 'resist', 'mobi'], prev: ['prevS', 'mobi', 'prevS', 'ef', 'mobi']
  }[goal] || ['fbA', 'fbB'];
  // 4 jours ou plus en force / masse : haut / bas plutôt que corps entier
  if (['force', 'hyper'].includes(goal) && n >= 4) return ['haut', 'bas', 'haut', 'bas', 'mobi', 'ef'].slice(0, n);
  if (goal === 'aero') return { 1: ['int'], 2: ['int', 'long'], 3: ['ef', 'int', 'long'], 4: ['ef', 'int', 'ef', 'long'], 5: ['ef', 'int', 'ef', 'lact', 'long'], 6: ['ef', 'int', 'ef', 'ef', 'int', 'long'] }[Math.min(6, n)];
  const out = []; for (let i = 0; i < n; i++) out.push(P[i % P.length].split('|')[0]);
  return out;
}
export function weekPlanTypes(cfg) {
  const n = cfg.days.length, g2 = cfg.goal2 && cfg.goal2 !== cfg.goal ? cfg.goal2 : null;
  if (!g2 || n < 2) return pattern(cfg.goal, n);
  const n2 = n <= 3 ? 1 : n <= 5 ? 2 : 2, n1 = n - n2;
  const a = pattern(cfg.goal, n1), b = pattern(g2, n2).filter(x => x !== 'mobi');
  while (b.length < n2) b.push(pattern(g2, 3)[b.length % 3]);
  // on intercale les séances du second objectif
  const out = a.slice(); b.forEach((x, i) => out.splice(Math.min(out.length, (i + 1) * 2 - 1 + i), 0, x));
  return out.slice(0, n);
}

/* ---------- Choix des exercices ---------- */
function available(x, cfg, eq) {
  if (x.lvl > cfg.lvl) return false;
  if (x.u18 === false && cfg.u18) return false;
  if (!x.eq.some(e => eq.has(e))) return false;
  if (!x.sp.includes('all') && !x.sp.some(s => (cfg.sports || []).includes(s))) return false;
  return true;
}
function pick(pats, quality, cfg, eq, used) {
  const ps = pats.split('|');
  for (const p of ps) {
    let c = LIB.filter(x => x.pat === p && available(x, cfg, eq));
    if (!c.length) continue;
    const pref = c.filter(x => x.q.includes(quality));
    if (pref.length) c = pref.concat(c.filter(x => !pref.includes(x)));
    const fresh = c.filter(x => !used.has(x.id));
    return (fresh[0] || c[0]);
  }
  return null;
}
function cardioSport(cfg, eq) {
  const s = cfg.sports || [];
  if (eq.has('exterieur') && (!s.length || s.some(x => ['course', 'trail', 'hyrox', 'collectif', 'combat', 'autre', 'muscu', 'escalade'].includes(x)))) return 'course';
  if (eq.has('velo')) return 'velo';
  if (eq.has('piscine')) return 'nage';
  if (eq.has('exterieur')) return 'course';
  return 'circuit';
}

/* ---------- Texte des prescriptions ---------- */
const range = r => r[0] === r[1] ? String(r[0]) : r[0] + '-' + r[1];
const rirTxt = n => 'réserve ' + n + (n >= 4 ? '+' : '');
// % du max selon le nombre de répétitions possibles (répétitions faites + réserve), table NSCA
const PCT = [0, 100, 95, 93, 90, 87, 85, 83, 80, 77, 75, 70, 67, 66, 65, 65];
function pctTxt(r, rir) {
  if (r[0] + rir > 15) return '< 65 % du max';
  const a = PCT[Math.min(15, r[1] + rir)], b = PCT[Math.min(15, r[0] + rir)];
  return '≈ ' + (a === b ? a : a + '-' + b) + ' % du max';
}
function detReps(x, rx, week) {
  if (x.t === 'iso') return (x.hold || (week.light ? '20-30 s' : rx.goal === 'endu_f' || rx.role === 'prev' ? '30-45 s' : '20-40 s')) + ' de maintien';
  const parts = [range(rx.r) + ' rép.' + (x.pat === 'unilat' || x.pat === 'mollet' || x.id === 'rot-ext' || x.id === 'rowing-halt' ? ' par côté' : '')];
  parts.push(rirTxt(rx.rir));
  if (rx.role === 'main' && x.ld !== 'bw' && ['force', 'hyper', 'endu_f'].includes(rx.goal)) parts.push(pctTxt(rx.r, rx.rir));
  else if (rx.pct && rx.role === 'puiss' && x.ld !== 'bw') parts.push(rx.pct);
  if (x.ld === 'bw' && rx.role === 'main') parts.push('lest ou variante plus facile pour rester dans la fourchette');
  if (rx.role === 'puiss') parts.push('vitesse maximale, arrêt si ça ralentit');
  return parts.join(' · ');
}

/* ---------- Semaine : charge, décharge, affûtage ---------- */
// i : index de la semaine dans le bloc · retourne { phase, light, taper, step (0, 1, 2 dans le mésocycle), meso }
export function weekInfo(cfg, i, W) {
  const tw = cfg.event ? (W >= 6 ? 2 : 1) : 0;
  if (tw && i >= W - tw) return { phase: 'affutage', taper: true, step: 1, meso: Math.floor(i / 4) };
  const pos = i % 4, meso = Math.floor(i / 4);
  if (pos === 3 && W >= 4) return { phase: 'deload', light: true, step: 0, meso };
  const sys = (GOAL_BY_ID[cfg.goal] || {}).sys;
  const seq = sys === 'alac' ? ['force', 'puissance', 'specifique'] : sys === 'lact' || sys === 'aero' ? ['volume', 'specifique', 'specifique'] : sys === 'prev' ? ['volume', 'volume', 'volume'] : ['volume', 'force', 'specifique'];
  return { phase: seq[Math.min(2, meso)], step: pos, meso };
}
function rxFor(goal, role, cfg, wk) {
  const lv = cfg.lvl - 1;
  const base = clone((role === 'main' || role === 'puiss' ? RX[role === 'puiss' ? 'puiss' : goal] || RX.acc : RX[role] || RX.acc)[lv]);
  base.role = role; base.goal = goal;
  if (role === 'main' && goal === 'force') { const sh = [2, 0, -1][Math.min(2, wk.meso)]; base.r = [Math.max(1, base.r[0] + sh), Math.max(2, base.r[1] + sh)]; }
  if (wk.light) { base.s = Math.max(1, Math.round(base.s * 0.6)); base.rir = 4; base.light = true; }
  else if (wk.taper) { base.s = Math.max(1, Math.round(base.s * 0.5)); }
  else {
    if (role !== 'puiss') base.rir = Math.min(role === 'prev' ? 4 : 3, Math.max(cfg.lvl === 1 ? 2 : 1, base.rir + [1, 0, -1][wk.step]));
    if (wk.step === 2 && role === 'main') base.s += 1;
  }
  return base;
}
const ech = (det, label) => ({ id: 'ech', label: label || 'Échauffement', det, n: 1 });

/* ---------- Construction d'une séance ---------- */
function strengthSession(type, cfg, eq, wk, used, memo, goalOverride) {
  // séance de muscu « support » : l'objectif de force / masse / endurance de force du programme, sinon la force
  const T = ST[type], goal = goalOverride || T.goal || [cfg.goal, cfg.goal2].find(g => ['force', 'hyper', 'endu_f'].includes(g)) || 'force';
  const nEx = cfg.dur <= 45 ? 4 : cfg.dur <= 60 ? 5 : 6;
  const items = [], heavy = new Set();
  // même séance type = mêmes exercices d'une fois sur l'autre (indispensable pour suivre la progression des charges)
  const mem = memo ? (memo[type] = memo[type] || []) : [];
  for (const [si, [pats, role]] of T.slots.entries()) {
    if (items.length >= nEx) break;
    const q = role === 'main' ? goal : role === 'puiss' ? 'puiss' : role === 'prev' ? 'prev' : goal === 'force' ? 'hyper' : goal;
    let x = mem[si] !== undefined ? (mem[si] && LIB_BY_ID[mem[si]]) : pick(pats, q, cfg, eq, used);
    if (mem[si] === undefined) mem[si] = x ? x.id : null;
    if (x && cfg.swap && cfg.swap[x.id] && LIB_BY_ID[cfg.swap[x.id]]) x = LIB_BY_ID[cfg.swap[x.id]];
    if (!x || items.some(it => it.lib === x.id)) continue;
    used.add(x.id);
    const rx = rxFor(goal === 'prev' ? 'prev' : goal, goal === 'prev' ? 'prev' : role, cfg, wk);
    if (x.rr) rx.r = x.rr.slice();
    const it = { id: uid('i'), label: x.n, det: detReps(x, rx, wk), n: rx.s, unit: 'Série', rest: rx.rest, lib: x.id, rx: { goal: rx.goal, role, r: rx.r, rir: rx.rir, light: !!rx.light } };
    if (x.ld === '+kg') it.unit_load = '+kg';
    items.push(it);
    if (x.heavy && !wk.light && role !== 'prev') x.g.forEach(g => heavy.add(g));
  }
  const g0 = GOAL_BY_ID[goal] || GOAL_BY_ID.force;
  const mainRx = rxFor(goal, 'main', cfg, wk);
  const prog = goal === 'puiss' ? 'Vitesse avant tout : on garde des charges légères et on arrête la série dès que le mouvement ralentit.'
    : cfg.lvl === 3 ? 'Charge réglée sur la réserve : si tu termines avec plus de réserve que prévu, ajoute 2,5 à 5 % la séance suivante ; avec moins, garde la charge.'
      : 'Double progression : quand toutes les séries atteignent le haut de la fourchette avec la réserve visée, ajoute la plus petite charge possible (2,5 kg) la séance suivante.';
  const blk = { id: uid('b'), kind: T.kind, title: (T.kind === 'renfo' ? 'Renfo' : 'Muscu') + ' · ' + T.t, desc: items.length + ' exercices · ' + (wk.light ? 'semaine de décharge' : wk.taper ? 'affûtage : moins de séries, même intensité' : g0.l.toLowerCase()), sub: wk.light ? 'Décharge : environ 40 % de séries en moins, même charge ou un peu moins, loin de l’échec.' : prog, items: [ech('5 à 10 min de cardio léger, mobilité, puis 2 à 3 séries de montée en charge sur le premier exercice.')].concat(items) };
  const rpe = wk.light ? [4, 6] : goal === 'puiss' ? [5, 7] : goal === 'endu_f' ? [6, 8] : goal === 'prev' ? [4, 6] : goal === 'hyper' ? [7, 9] : [7, 8];
  const sys = SYSTEMS[g0.sys] || SYSTEMS.neuro;
  return { short: T.t, blocks: [blk], target: { rpe, fam: wk.light || goal === 'prev' ? 'light' : 'muscu', why: sys.l + ' · ' + sys.d + (mainRx.rest ? ' Repos : ' + mmss(mainRx.rest) + ' entre les séries des exercices principaux.' : '') }, heavy };
}

function climbSession(type, cfg, eq, wk) {
  const m = wk.light ? 0.6 : wk.taper ? 0.5 : 1, n = (base, add) => Math.max(1, Math.round((base + (wk.light || wk.taper ? 0 : add[wk.step])) * m));
  const heavy = new Set(), blocks = [];
  const durF = cfg.dur <= 45 ? 0.75 : cfg.dur <= 60 ? 1 : cfg.dur <= 75 ? 1.25 : 1.5;
  const canHang = available(LIB_BY_ID['max-hangs'], cfg, eq);
  let short = ST[type].t, tg;
  if (type === 'doigts' && canHang) {
    const reps = n(5, [0, 1, 1]);
    blocks.push({ id: uid('b'), kind: 'doigts', title: 'Doigts · suspensions max', desc: reps + ' × 10 s · 3 min de repos', sub: 'Charge : celle que tu tiendrais environ 13 s (marge de 3 s). Quand les 10 s deviennent faciles sur toutes les suspensions, ajoute 1 à 2 kg (ou retire de la décharge).', items: [
      ech('10 min de grimpe facile, puis 3 suspensions de 10 s à environ 50, 70 et 85 % de l’effort, 1 min entre chaque.', 'Échauffement des doigts'),
      { id: uid('i'), label: 'Suspensions max · 20 mm semi-arqué', det: '10 s par suspension, 3 min de repos (filière alactique, 1:18)', n: reps, unit: 'Série', unit_load: '+kg', lib: 'max-hangs', rx: { goal: 'doigts', role: 'main', light: !!wk.light }, timer: { kind: 'interval', name: 'Suspensions max', work: 10, rest: 180, reps, sets: 1, setRest: 0, prep: 10, workLabel: 'Suspends', restLabel: 'Repos', markEach: 'rep' } }
    ] });
    if (cfg.dur >= 75) blocks.push({ id: uid('b'), kind: 'grimpe', title: 'Escalade · blocs variés', desc: 'Fin de séance sans forcer', items: [{ id: uid('i'), label: 'Blocs variés, 2 niveaux sous ta limite', det: 'Mouvements variés, sans arqué en force maximale', n: n(4, [0, 0, 1]), unit: 'Bloc', rest: 120 }] });
    if (!wk.light) heavy.add('doigts');
    tg = { rpe: wk.light ? [4, 6] : [7, 8], fam: wk.light ? 'light' : 'hard', s: 6, i: wk.light ? 5 : 9, v: 3 };
  } else if (type === 'doigts' || type === 'bloc') {
    const x = available(LIB_BY_ID['pan-dur'], cfg, eq) && type === 'bloc' ? LIB_BY_ID['pan-dur'] : LIB_BY_ID.limite;
    const tries = n(Math.round(7 * durF), [0, 1, 2]);
    const items = [ech('15 min de grimpe facile, puis 3 à 4 blocs de plus en plus durs.'), { id: uid('i'), label: type === 'doigts' ? 'Blocs à ta limite sur petites prises' : x.n, det: '3 à 6 mouvements quasi maximaux, 3 min entre les essais (filière alactique)', n: tries, unit: 'Essai', rest: 180, lib: x.id, rx: { goal: type, role: 'main', light: !!wk.light } }];
    if (type === 'bloc' && available(LIB_BY_ID.campus, cfg, eq) && !wk.light) items.push({ id: uid('i'), label: 'Campus sur prises larges', det: 'Montées 1-3-5, arrêt dès que la qualité baisse', n: wk.taper ? 2 : 4, unit: 'Essai', rest: 180, lib: 'campus' });
    if (type === 'bloc' && available(LIB_BY_ID['tractions-expl'], cfg, eq) && cfg.dur >= 60) items.push({ id: uid('i'), label: 'Tractions explosives', det: '3 rép. · vitesse maximale', n: wk.light ? 2 : 4, unit: 'Série', rest: 150, lib: 'tractions-expl' });
    blocks.push({ id: uid('b'), kind: 'grimpe', title: 'Escalade · ' + (type === 'doigts' ? 'force des doigts' : 'bloc à la limite'), desc: tries + ' essais très durs, frais à chaque fois', sub: type === 'doigts' && !canHang ? (cfg.u18 ? 'Avant 18 ans, pas de suspensions max : la grimpe sur petites prises fait progresser les doigts sans risque pour les cartilages de croissance.' : cfg.lvl < 2 ? 'Débutant : grimper sur petites prises suffit à faire progresser les doigts, la poutre viendra après.' : 'Sans poutre : petites prises en bloc.') : 'Qualité avant quantité : on arrête dès que les essais deviennent moins bons.', items });
    if (!wk.light) { heavy.add('doigts'); heavy.add('tirage'); }
    short = type === 'doigts' ? 'Doigts' : 'Bloc limite';
    tg = { rpe: wk.light ? [4, 6] : [8, 9], fam: wk.light ? 'light' : 'hard', s: 9, i: wk.light ? 5 : 9, v: 4 };
  } else if (type === 'resist') {
    const alt = wk.step % 2 === 1 && available(LIB_BY_ID['int-pan'], cfg, eq);
    const items = [ech('15 min de grimpe facile qui monte progressivement.')];
    if (alt) { const reps = n(Math.round(5 * durF), [0, 1, 2]); items.push({ id: uid('i'), label: 'Intervalles 1 min sur pan', det: '1 min de grimpe soutenue, 3 min de repos (1:3)', n: reps, unit: 'Série', lib: 'int-pan', timer: { kind: 'interval', name: 'Intervalles 1 min', work: 60, rest: 180, reps, sets: 1, setRest: 0, prep: 10, workLabel: 'Grimpe', restLabel: 'Repos', markEach: 'rep' } }); }
    else { const sets = n(cfg.dur >= 75 ? 5 : 4, [0, 0, 1]); items.push({ id: uid('i'), label: '4 blocs enchaînés (4 × 4)', det: 'Une série = 4 blocs sans pause, 2 à 3 niveaux sous ta limite ; 3 à 4 min de repos entre les séries', n: sets, unit: 'Série', rest: 210, lib: '4x4' }); }
    blocks.push({ id: uid('b'), kind: 'grimpe', title: 'Escalade · résistance', desc: 'Filière lactique : efforts de 1 à 3 min qui « brûlent »', sub: 'Progression : un bloc ou une série de plus, ou des blocs un peu plus durs, quand tout passe proprement.', items });
    tg = { rpe: wk.light ? [4, 6] : [7, 9], fam: wk.light ? 'light' : 'hard', s: 8, i: wk.light ? 5 : 7, v: 7 };
  } else {
    const k = cfg.dur <= 45 ? [2, 10] : cfg.dur <= 60 ? [2, 15] : cfg.dur <= 75 ? [3, 12] : [3, 15];
    const sets = n(k[0], [0, 0, 1]);
    blocks.push({ id: uid('b'), kind: 'grimpe', title: 'Escalade · continuité', desc: 'Filière aérobie : long et facile', sub: 'Avant-bras chauds mais jamais « bouteillés » : si ça brûle, descends d’un niveau.', items: [ech('10 min de grimpe très facile.'), { id: uid('i'), label: 'Continuité ' + sets + ' × ' + k[1] + ' min', det: 'Grimpe facile sans t’arrêter (traversées, voies faciles enchaînées), 5 min de repos', n: sets, unit: 'Bloc', rest: 300, lib: 'conti' }] });
    tg = { rpe: [3, 5], fam: 'vol', s: 6, i: 3, v: wk.light ? 5 : 8 };
  }
  const sys = SYSTEMS[(GOAL_BY_ID[type] || GOAL_BY_ID.conti).sys];
  tg.why = sys.l + ' · ' + sys.d;
  return { short, blocks, target: tg, heavy };
}

function cardioSession(type, cfg, eq, wk) {
  const sport = cardioSport(cfg, eq), kind = sport === 'course' ? 'course' : 'velo';
  const m = wk.light ? 0.6 : wk.taper ? 0.5 : 1, lv = cfg.lvl - 1, heavy = new Set();
  const nm = { course: ['Footing', 'Course'], velo: ['Vélo', 'Vélo'], nage: ['Natation', 'Natation'], circuit: ['Circuit', 'Circuit'] }[sport];
  let blocks, short = ST[type] ? ST[type].t : 'Cardio', tg;
  if (sport === 'circuit' && type !== 'ef' && type !== 'long') type = 'circuit';
  if (type === 'ef' || type === 'long') {
    const base = type === 'long' ? [50, 75, 95][lv] : Math.max(30, cfg.dur - 10), mins = Math.round(base * (wk.light ? 0.7 : wk.taper ? 0.6 : [1, 1.1, 1.15][wk.step]) / 5) * 5;
    const x = sport === 'velo' ? 'velo-z2' : sport === 'nage' ? 'nage-ef' : sport === 'circuit' ? null : type === 'long' ? 'sortie-longue' : 'ef';
    const lbl = x ? (type === 'long' ? 'Sortie longue' : LIB_BY_ID[x].n) : 'Cardio facile (marche rapide, vélo, corde à sauter…)';
    blocks = [{ id: uid('b'), kind, title: nm[1] + ' · ' + (type === 'long' ? 'sortie longue' : 'endurance fondamentale'), desc: mins + ' min faciles', sub: 'Zone 1-2 : tu peux parler en phrases complètes. C’est l’essentiel du volume en endurance (environ 80 %).', items: [Object.assign({ id: uid('i'), label: lbl + ' · ' + mins + ' min', det: x ? LIB_BY_ID[x].c : 'Zone 1-2, aisance respiratoire.', n: 1, unit: 'Bloc' }, x ? { lib: x } : {})] }];
    tg = { rpe: [2, 4], fam: type === 'long' ? 'vol' : 'easy' };
  } else if (type === 'circuit') {
    const rounds = Math.max(2, Math.round(([3, 4, 5][lv] + (wk.light || wk.taper ? 0 : [0, 0, 1][wk.step])) * m));
    blocks = [{ id: uid('b'), kind: 'velo', title: 'Circuit fonctionnel', desc: rounds + ' tours · 5 ateliers', sub: 'Filière lactique et aérobie : 40 s par atelier, 20 s de transition, 2 min entre les tours.', items: [ech('5 min de cardio léger et de mobilité.'), { id: uid('i'), label: 'Circuit : burpees, fentes, squats, pompes, gainage', det: '40 s d’effort, 20 s de transition', n: rounds, unit: 'Série', lib: 'circuit', timer: { kind: 'interval', name: 'Circuit', work: 40, rest: 20, reps: 5, sets: rounds, setRest: 120, prep: 10, workLabel: 'Effort', restLabel: 'Change' } }] }];
    tg = { rpe: wk.light ? [4, 6] : [7, 8], fam: wk.light ? 'light' : 'hard' };
    if (!wk.light) heavy.add('cardio');
  } else {
    // intervalles : 30/30 (VMA), 3 min, 4 × 4 min vélo, 100 m nage, 300 m lactiques
    let it;
    if (type === 'lact') { const reps = Math.max(3, Math.round(([5, 6, 7][lv] + [0, 1, 2][wk.step]) * m)); it = { label: sport === 'velo' ? 'Vélo 6 × 1 min très vite' : sport === 'nage' ? 'Natation 6 × 50 m vite' : 'Répétitions de 300 m', det: 'Environ 1 min très vite, 3 min 30 de récupération (1:3 à 1:4)', lib: sport === 'course' ? '300m' : null, timer: { kind: 'interval', name: 'Lactique', work: 60, rest: 210, reps, sets: 1, setRest: 0, prep: 10, workLabel: 'Vite', restLabel: 'Récup', markEach: 'rep' }, n: reps }; }
    else if (sport === 'velo') { const reps = Math.max(2, Math.round((4 + (wk.light || wk.taper ? 0 : [0, 0, 1][wk.step])) * m)); it = { label: 'Vélo 4 min à 90-95 % de ta FC max', det: '4 min fort, 3 min faciles', lib: 'velo-4x4', timer: { kind: 'interval', name: 'Vélo 4 × 4', work: 240, rest: 180, reps, sets: 1, setRest: 0, prep: 10, workLabel: 'Fort', restLabel: 'Facile', markEach: 'rep' }, n: reps }; }
    else if (sport === 'nage') { const reps = Math.max(4, Math.round(([6, 8, 10][lv] + [0, 1, 2][wk.step]) * m)); it = { label: 'Natation ' + reps + ' × 100 m', det: '100 m soutenu, 20 à 30 s de repos', lib: 'nage-100', n: reps, unit: 'Série', rest: 25 }; }
    else if (cfg.lvl >= 2 && wk.step === 1) { const reps = Math.max(3, Math.round(([4, 4, 5][lv] + 1) * m)); it = { label: 'Intervalles 3 min', det: '3 min à allure 3 000-5 000 m, 2 min de trot', lib: '3min', timer: { kind: 'interval', name: 'Intervalles 3 min', work: 180, rest: 120, reps, sets: 1, setRest: 0, prep: 10, workLabel: 'Vite', restLabel: 'Trot', markEach: 'rep' }, n: reps }; }
    else { const sets = lv === 0 ? 1 : 2, reps = Math.max(4, Math.round(([8, 10, 12][lv] + [0, 1, 2][wk.step]) * m)); it = { label: 'Intervalles 30/30', det: '30 s vite (proche de ta VMA), 30 s de trot · ' + sets + ' série' + (sets > 1 ? 's' : '') + ' de ' + reps, lib: '30-30', timer: { kind: 'interval', name: '30/30', work: 30, rest: 30, reps, sets, setRest: 180, prep: 10, workLabel: 'Vite', restLabel: 'Trot' }, n: sets }; }
    blocks = [{ id: uid('b'), kind, title: nm[1] + ' · ' + (type === 'lact' ? 'intervalles lactiques' : 'intervalles'), desc: it.det, sub: type === 'lact' ? 'Filière lactique : efforts de 20 s à 2 min, récupération 1:3 à 1:5.' : 'Les 20 % d’intensité de l’entraînement polarisé : efforts durs, le reste de la semaine reste facile.', items: [ech('15 min faciles, puis 3 accélérations progressives de 20 s.'), Object.assign({ id: uid('i'), unit: 'Série' }, it), { id: 'rac', label: 'Retour au calme', det: '10 min très faciles', n: 1 }] }];
    tg = { rpe: wk.light ? [4, 6] : [7, 9], fam: wk.light ? 'light' : 'hard' };
    if (!wk.light) heavy.add('cardio');
  }
  const sys = SYSTEMS[type === 'lact' || type === 'circuit' ? 'lact' : 'aero'];
  tg.why = sys.l + ' · ' + sys.d;
  return { short, blocks, target: tg, heavy };
}

function sprintSession(cfg, eq, wk, used) {
  const m = wk.light ? 0.6 : wk.taper ? 0.5 : 1, heavy = new Set();
  const sp = available(LIB_BY_ID.sprint, cfg, eq) ? LIB_BY_ID.sprint : null;
  const items = [ech('10 min de footing, gammes (montées de genoux, talons-fesses), 3 accélérations progressives.')];
  if (sp) { items.push({ id: uid('i'), label: sp.n, det: 'Effort maximal (3-4 s), 2 min de récupération complète (1:12 à 1:20)', n: Math.max(3, Math.round(([5, 6, 8][cfg.lvl - 1] + [0, 1, 1][wk.step]) * m)), unit: 'Essai', rest: 120, lib: 'sprint' }); if (!wk.light) heavy.add('jambes'); }
  if (cfg.lvl >= 2 && available(LIB_BY_ID['sprint-lance'], cfg, eq)) items.push({ id: uid('i'), label: 'Sprints lancés 20 m', det: '20 m d’élan, 20 m à fond, 3 min de récupération', n: Math.max(2, Math.round(4 * m)), unit: 'Essai', rest: 180, lib: 'sprint-lance' });
  const pl = pick('plyo', 'puiss', cfg, eq, used); if (pl) items.push({ id: uid('i'), label: pl.n, det: '5 sauts de qualité maximale', n: wk.light ? 2 : 3, unit: 'Série', rest: 120, lib: pl.id });
  if (!sp) items.push({ id: uid('i'), label: 'Sprints sur place ou en côte 8 s', det: '8 s à fond, 2 min de récupération', n: 6, unit: 'Essai', rest: 120 });
  return { short: 'Vitesse', blocks: [{ id: uid('b'), kind: 'course', title: 'Course · vitesse', desc: 'Filière alactique : moins de 10 s à fond', sub: 'La qualité prime : chaque sprint doit être aussi rapide que le premier. Si tu ralentis nettement, arrête la série.', items }], target: { rpe: wk.light ? [3, 5] : [6, 8], fam: wk.light ? 'light' : 'hard', why: SYSTEMS.alac.l + ' · ' + SYSTEMS.alac.d }, heavy };
}

function mobiSession(cfg) {
  const ids = ['mob-hanches', 'mob-epaules', 'mob-chevilles', 'mob-dos'].concat((cfg.sports || []).includes('escalade') ? ['mob-doigts'] : []);
  return { short: 'Mobilité', blocks: [{ id: uid('b'), kind: 'recup', title: 'Récupération · mobilité', desc: '20 à 30 min tranquilles', items: ids.map(id => ({ id: uid('i'), label: LIB_BY_ID[id].n, det: LIB_BY_ID[id].c, n: 1, lib: id })) }], target: { rpe: [1, 3], fam: 'light', why: 'Séance facile qui entretient la mobilité et aide à récupérer.' }, heavy: new Set() };
}

export function buildSession(type, cfg, wk, used, memo) {
  const eq = equipSet(cfg.equip);
  used = used || new Set();
  if (['fbA', 'fbB', 'haut', 'bas', 'puiss', 'renfo', 'prevS'].includes(type)) return strengthSession(type, cfg, eq, wk, used, memo);
  if (['doigts', 'bloc', 'resist', 'conti'].includes(type)) return climbSession(type, cfg, eq, wk);
  if (['ef', 'int', 'long', 'lact', 'circuit'].includes(type)) return cardioSession(type, cfg, eq, wk);
  if (type === 'sprint') return sprintSession(cfg, eq, wk, used);
  return mobiSession(cfg);
}

// Exercices de remplacement (même schéma de mouvement, matériel et niveau compatibles)
export function alternatives(libId, cfg) {
  const x = LIB_BY_ID[libId]; if (!x) return [];
  const eq = equipSet(cfg.equip);
  return LIB.filter(y => y.pat === x.pat && y.id !== x.id && available(y, cfg, eq));
}

/* ---------- Règle des 48 h ---------- */
const H48 = ['jambes', 'dos', 'poussee', 'tirage', 'doigts', 'cardio'];
// Groupes sollicités lourdement par une journée du plan (séance générée ou saisie à la main)
export function heavyOf(d) {
  const out = new Set();
  if (!d) return out;
  for (const b of d.blocks || []) {
    if (b.kind === 'rest') continue;
    if (Array.isArray(b.heavy)) { b.heavy.forEach(g => out.add(g)); continue; }
    if (b.kind === 'doigts' && b.finger && b.finger.load) out.add('doigts');
    for (const it of b.items || []) {
      if (it.id === 'ech' || it.id === 'rac') continue;
      const x = it.lib ? LIB_BY_ID[it.lib] : libMatch(it.label);
      if (it.rx && it.rx.light) continue;
      if (x && x.heavy) x.g.forEach(g => out.add(g));
      if (x && x.g.includes('cardio') && x.t === 'int') out.add('cardio');
    }
  }
  return new Set([...out].filter(g => H48.includes(g)));
}
const inter = (a, b) => [...a].filter(x => b.has(x));
// Conflits avec la veille et le lendemain pour un jour (brouillon de l'éditeur ou plan enregistré)
export function check48(k, d) {
  const mine = heavyOf(d), out = [];
  if (!mine.size) return out;
  for (const o of [-1, 1]) { const k2 = addDays(k, o), g = inter(mine, heavyOf(day(k2))); if (g.length) out.push({ k: k2, when: o < 0 ? 'la veille' : 'le lendemain', groups: g }); }
  return out;
}
export const groupsTxt = g => g.map(x => GROUP_LBL[x] || x).join(', ');

/* ---------- Placement des séances dans la semaine ---------- */
function permutations(a) { if (a.length <= 1) return [a]; const out = []; a.forEach((x, i) => { for (const p of permutations(a.slice(0, i).concat(a.slice(i + 1)))) out.push([x].concat(p)); }); return out; }
function weekCost(byDow) {
  let c = 0;
  for (let d = 0; d < 7; d++) { const a = byDow[d], b = byDow[(d + 1) % 7]; if (a && b) c += inter(a, b).length; }
  return c;
}
export function placeSessions(cfg, types, sample) {
  const days = cfg.days.slice().sort((a, b) => a - b), fixed = new Set(cfg.fixed || []);
  const fixedHeavy = new Set(['jambes', 'cardio']);
  let best = null;
  const perms = types.length <= 6 ? permutations(types.map((t, i) => i)) : [types.map((t, i) => i)];
  for (const p of perms) {
    const by = {}; for (const f of fixed) by[f] = fixedHeavy;
    p.forEach((ti, j) => { by[days[j]] = sample[ti].heavy; });
    const c = weekCost(by);
    if (!best || c < best.c) best = { c, p };
    if (c === 0) break;
  }
  const out = {}; best.p.forEach((ti, j) => { out[days[j]] = types[ti]; });
  return { map: out, cost: best.c };
}

/* ---------- Génération du bloc complet ---------- */
export function nextMonday(k) { const t = k || todayKey(); return dow(t) === 0 ? t : addDays(mondayOf(t), 7); }
export function generate(cfg) {
  const start = cfg.start || nextMonday();
  let W = cfg.weeks || 4;
  if (cfg.event) W = Math.max(2, Math.min(16, Math.floor(diffDays(start, cfg.event) / 7) + 1));
  const types = weekPlanTypes(cfg), memo = {}, used0 = new Set();
  const sample = types.map(t => buildSession(t, cfg, { step: 1, meso: 0, phase: 'volume' }, used0, memo));
  const { map, cost } = placeSessions(cfg, types, sample);
  const weeks = [], warnings = [];
  for (let i = 0; i < W; i++) {
    const wk = weekInfo(cfg, i, W), ws = addDays(start, i * 7), used = new Set(), days = {};
    for (let d = 0; d < 7; d++) {
      const k = addDays(ws, d);
      if (cfg.event && k > cfg.event) continue;
      if (cfg.event && k === cfg.event) { days[d] = { short: cfg.eventLbl || 'Objectif', blocks: [{ id: uid('b'), kind: 'compet', title: cfg.eventLbl || 'Objectif', desc: 'Jour J', items: [] }] }; continue; }
      if ((cfg.fixed || []).includes(d)) { days[d] = { short: cfg.fixedLbl || 'Sport', blocks: [{ id: uid('b'), kind: 'sport', title: cfg.fixedLbl || 'Entraînement du club ou match', desc: 'Séance fixe de la semaine', heavy: ['jambes', 'cardio'], items: [{ id: uid('i'), label: cfg.fixedLbl || 'Entraînement ou match', n: 1 }] }] }; continue; }
      let t = map[d]; if (!t) continue;
      // veille de l'objectif : séance légère seulement
      if (cfg.event && addDays(k, 1) === cfg.event && !['mobi', 'ef', 'conti'].includes(t)) t = 'mobi';
      // corps entier A / B : on alterne d'une semaine à l'autre
      if (i % 2 === 1 && (t === 'fbA' || t === 'fbB') && types.filter(x => x === 'fbA').length !== types.filter(x => x === 'fbB').length) t = t === 'fbA' ? 'fbB' : 'fbA';
      days[d] = Object.assign(buildSession(t, cfg, wk, used, memo), { type: t });
    }
    weeks.push({ i, start: ws, end: addDays(ws, 6), phase: wk.phase, light: !!wk.light, taper: !!wk.taper, days });
  }
  // conflits de la règle des 48 h restants (jours imposés trop proches)
  if (cost > 0) {
    const w0 = weeks[0].days;
    for (let d = 0; d < 7; d++) {
      const a = w0[d], b = w0[(d + 1) % 7]; if (!a || !b) continue;
      const g = inter(heavyOf(a), heavyOf(b)); if (g.length) warnings.push({ d, d2: (d + 1) % 7, groups: g });
    }
  }
  return { cfg, start, end: addDays(start, W * 7 - 1), weeks, warnings, types };
}

/* ---------- Écriture dans le plan ---------- */
const PH_BLOC = { volume: 'Accumulation', force: 'Intensification', puissance: 'Puissance', specifique: 'Spécifique', deload: 'Décharge', affutage: 'Affûtage' };
export function conflicts(prog) {
  const t = todayKey(), out = [];
  for (const w of prog.weeks) for (const d of Object.keys(w.days)) { const k = addDays(w.start, +d); if (k >= t && day(k) && (day(k).blocks || []).some(b => b.kind !== 'rest')) out.push(k); }
  return out;
}
export function programNotes(prog) {
  const c = prog.cfg, g = GOAL_BY_ID[c.goal], g2 = c.goal2 && GOAL_BY_ID[c.goal2], sys = SYSTEMS[g.sys];
  const lines = ['**Objectif** : ' + g.l.toLowerCase() + (g2 ? ', puis ' + g2.l.toLowerCase() : '') + '.', '', '**' + sys.l + '.** ' + sys.d];
  if (g2) lines.push('', '**' + SYSTEMS[g2.sys].l + '.** ' + SYSTEMS[g2.sys].d);
  lines.push('', '### Organisation',
    '- Mésocycles de 4 semaines : 3 semaines qui montent, puis 1 semaine de décharge (environ 40 % de séries en moins, même charge, loin de l’échec).',
    '- La réserve (« il m’en restait 2 ») règle l’intensité : 2 = tu aurais pu faire 2 répétitions de plus.',
    '- Règle des 48 h : pas deux séances lourdes de suite sur les mêmes muscles.');
  if (c.event) lines.push('- Affûtage avant l’objectif : volume réduit de 40 à 60 %, intensité et fréquence gardées.');
  if (STRENGTH_GOALS.includes(c.goal)) lines.push('- Progression des charges : quand toutes les séries atteignent le haut de la fourchette avec la réserve visée, la charge monte de 2,5 kg (ou 2 à 5 %).');
  lines.push('', 'Sources : ACSM 2009 ; NSCA 2016 ; Schoenfeld 2016 et 2017 ; Helms 2016 ; Williams 2017 ; Bell 2023' + (c.event ? ' ; Bosquet 2007' : '') + ([c.goal, c.goal2].includes('aero') ? ' ; Stöggl 2014' : '') + '.');
  return lines.join('\n');
}
// mode : 'replace' (les séances prévues sur ces jours sont remplacées) ou 'merge' (le programme s'ajoute)
export function writeProgram(prog, mode) {
  const t = todayKey(), c = prog.cfg;
  const m = clone(meta() || { v: 1, title: 'Mon plan', goal: null, tests: [], weeks: [], blocs: [], sections: [] });
  const byStart = new Map(m.weeks.map(w => [w.start, w]));
  const g = GOAL_BY_ID[c.goal], blocName = 'Programme · ' + g.l;
  for (const w of prog.weeks) {
    // semaine existante qui recouvre celle du programme (même début, ou plan qui ne commence pas un lundi)
    const cur = byStart.get(w.start) || m.weeks.find(x => x.start <= w.end && x.end >= w.start);
    const patch = { phase: w.phase, bloc: blocName + ' · ' + PH_BLOC[w.phase] };
    if (cur) Object.assign(cur, patch);
    else { const nw = Object.assign({ id: uid('w'), n: 0, start: w.start, end: w.end }, patch); m.weeks.push(nw); byStart.set(w.start, nw); }
  }
  m.weeks.sort((a, b) => (a.start < b.start ? -1 : 1));
  // semaines non alignées sur le lundi (anciens plans) : on garde leur numérotation
  m.weeks.forEach((w, i) => { if (!w.label) w.n = i + 1; });
  m.start = m.weeks[0].start; m.end = m.weeks[m.weeks.length - 1].end;
  if (c.event) {
    m.events = (m.events || []).filter(e => e.date !== c.event).concat([{ date: c.event, label: c.eventLbl || 'Objectif' }]).sort((a, b) => (a.date < b.date ? -1 : 1));
    if (!m.goal || !m.goal.date || m.goal.date < t) m.goal = { label: c.eventLbl || 'Objectif', date: c.event };
  }
  m.blocs = (m.blocs || []).concat([{ name: blocName, from: prog.start < t ? t : prog.start, to: prog.end, obj: GOAL_BY_ID[c.goal].d + (c.goal2 ? ' · en second : ' + GOAL_BY_ID[c.goal2].l.toLowerCase() : ''), notes: programNotes(prog) }]).sort((a, b) => (a.from < b.from ? -1 : 1));
  m.programs = (m.programs || []).concat([{ id: uid('g'), cfg: c, from: prog.start, to: prog.end, at: Date.now() }]);
  const st = cloud && links.me ? { uid: links.me, name: myProfile().name || '', at: Date.now() } : undefined;
  m.edited = st;
  const docs = { plan: m };
  for (const w of prog.weeks) for (const [d, s] of Object.entries(w.days)) {
    const k = addDays(w.start, +d); if (k < t) continue;
    const dd = { short: s.short, blocks: s.blocks, edited: st, prog: true };
    if (s.target) dd.target = s.target;
    const ex = day(k);
    if (mode === 'merge' && ex && (ex.blocks || []).some(b => b.kind !== 'rest')) { dd.blocks = ex.blocks.filter(b => b.kind !== 'rest').concat(s.blocks); dd.short = (ex.short || '') ? ex.short + ' + ' + s.short : s.short; if (ex.target) dd.target = ex.target; }
    docs['p:' + k] = dd;
  }
  if (mode === 'replace') for (const w of prog.weeks) for (let d = 0; d < 7; d++) { const k = addDays(w.start, d); if (k >= t && !docs['p:' + k] && day(k)) remove('p:' + k); }
  putMany(docs);
  return Object.keys(docs).length - 1;
}

// Résumé lisible d'une séance pour l'aperçu
export function sessionSummary(s) {
  const its = [];
  for (const b of s.blocks) for (const it of b.items || []) if (it.id !== 'ech' && it.id !== 'rac') its.push(it);
  return its;
}
export const KIND_OF_TYPE = t => (ST[t] ? (ST[t].kind === 'cardio' ? 'course' : ST[t].kind) : 'autre');
export { KIND };
