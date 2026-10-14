// Assistant de programme : objectif → séances types → bloc de semaines écrit dans le plan.
// Prescription : ACSM 2009, NSCA 2016 ; volume : Schoenfeld 2017 ; repos : Schoenfeld 2016 ; réserve : Helms 2016 ;
// périodisation : Williams 2017 ; décharge : Bell 2023 ; affûtage : Bosquet 2007 ; endurance polarisée : Stöggl 2014.
import { LIB, LIB_BY_ID, equipSet, GOAL_BY_ID, SYSTEMS, libMatch } from './library.js';
import { meta, day, clone, uid, KIND } from './plan.js';
import { putMany, put, remove, links, myProfile } from './store.js';
import { cloud } from './supa.js';
import { addDays, mondayOf, todayKey, dow, fmtDay, diffDays, mmss, fmtNum } from './dates.js';
import { climbLevel, oneRM, loadForPct, LIFT_OF_LIB, vmaOf, fcmaxOf, paceAt, srcTxt, csOf, ftpOf } from './levels.js';
import { shiftGrade, gapText } from './grades.js';
import { lastResult } from './tests.js';
import { applyExtras, EXTRAS } from './needs.js';

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
  doigts: { kind: 'doigts', t: 'Doigts' }, bloc: { kind: 'grimpe', t: 'Bloc à la limite' }, resist: { kind: 'grimpe', t: 'Résistance' }, conti: { kind: 'grimpe', t: 'Volume' }, compet: { kind: 'grimpe', t: 'Compétition' },
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
    resist: ['resist', 'bloc', 'resist', 'conti', 'renfo'], conti: ['conti', 'renfo', 'conti', 'resist', 'mobi'], prev: ['prevS', 'mobi', 'prevS', 'ef', 'mobi'],
    compet: ['compet', 'renfo', 'bloc', 'conti', 'mobi']
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

/* ---------- Formats de séance ---------- */
// Pour chaque famille de séance, plusieurs façons de travailler la même filière ; l'assistant en conseille une selon l'objectif et le niveau.
export const FORMATS = {
  conti: [['blocs', 'Beaucoup de blocs', 'Volume de mouvements, filière aérobie'], ['traversee', 'Continuité', 'Aérobie long : grimper sans s’arrêter'], ['voies', 'Volume en voie', 'Beaucoup de voies faciles']],
  resist: [['4x4', '4 × 4', 'Résistance, filière lactique'], ['int', 'Intervalles 1 min', 'Lactique, sur pan ou traversée'], ['voies', 'Voies enchaînées', 'Résistance en voie']],
  bloc: [['limite', 'Blocs à la limite', 'Puissance, filière alactique'], ['pan', 'Pan ou Moonboard', 'Mouvements de puissance sur petites prises']],
  doigts: [['hangs', 'Suspensions max', 'Force des doigts sur poutre'], ['lift', 'Finger lift', 'Force des doigts, charge réglée au kilo'], ['blocs', 'Petites prises en bloc', 'Force des doigts en grimpant']],
  compet: [['qualif', 'Format qualif', 'Blocs nouveaux, temps limité par bloc'], ['contest', 'Contest', 'Un maximum de blocs en temps limité'], ['flash', 'Flash', 'Un seul essai après lecture']],
  force: [['classique', 'Séries classiques', 'Repos complet entre les séries'], ['clusters', 'Clusters', 'Répétitions isolées : plus lourd, même qualité']],
  hyper: [['classique', 'Séries classiques', 'Un exercice à la fois'], ['supersets', 'Supersets antagonistes', 'Poussée et tirage en alternance : séance plus courte']],
  puiss: [['balistique', 'Balistique', 'Charges légères lancées vite'], ['contraste', 'Contraste', 'Une série lourde, puis la même chose en explosif']],
  int: [['alterne', '30/30 et 3 min en alternance', 'VO2max, deux formats d’une semaine à l’autre'], ['3030', '30/30', 'VO2max en efforts courts'], ['seuil', 'Seuil', 'Autour de ta vitesse critique']],
  intV: [['4x4', '4 × 4 min', 'VO2max'], ['sst', 'Sweet spot', '2 longs blocs juste sous la FTP']]
};
const FMT_SRC = { clusters: 'tufano2017', supersets: 'robbins2010', contraste: 'seitz2016' };
// Famille de format d'une séance type
export function fmtFamily(type, cfg) {
  if (['conti', 'resist', 'bloc', 'doigts', 'compet'].includes(type)) return type;
  if (type === 'puiss') return 'puiss';
  if (type === 'int') { const sp = cardioSport(cfg, equipSet(cfg.equip)); return sp === 'course' ? 'int' : sp === 'velo' ? 'intV' : null; }
  if (['fbA', 'fbB', 'haut', 'bas', 'renfo'].includes(type)) { const g = ST[type].goal || [cfg.goal, cfg.goal2].find(x => ['force', 'hyper', 'endu_f'].includes(x)) || 'force'; return FORMATS[g] ? g : null; }
  return null;
}
// Format conseillé : justifié par l'objectif, le niveau, le matériel et la durée
export function fmtReco(fam, cfg) {
  const lv = climbLevel(null, cfg.lv), voieOnly = (lv.vf || lv.vm) && !(lv.bf || lv.bm), eq = equipSet(cfg.equip);
  if (fam === 'conti') return voieOnly || cfg.goal === 'conti' && voieOnly ? 'voies' : 'blocs';
  if (fam === 'resist') return voieOnly && cfg.goal === 'resist' ? 'voies' : '4x4';
  if (fam === 'bloc') return 'limite';
  if (fam === 'doigts') return available(LIB_BY_ID['max-hangs'], cfg, eq) ? 'hangs' : 'blocs';
  if (fam === 'compet') return 'qualif';
  if (fam === 'hyper') return cfg.dur <= 45 ? 'supersets' : 'classique';
  if (fam === 'puiss') return cfg.lvl >= 2 && eq.has('barre') ? 'contraste' : 'balistique';
  if (fam === 'int') return 'alterne';
  if (fam === 'intV') return '4x4';
  return 'classique';
}
export const fmtOf = (fam, cfg) => (cfg.fmt && cfg.fmt[fam] && FORMATS[fam].some(f => f[0] === cfg.fmt[fam])) ? cfg.fmt[fam] : fmtReco(fam, cfg);

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
  const fam = fmtFamily(type, cfg), fmt = fam ? fmtOf(fam, cfg) : 'classique';
  // les clusters allongent les séries : un exercice de moins pour tenir la durée
  const nEx = (cfg.dur <= 45 ? 4 : cfg.dur <= 60 ? 5 : 6) - (fmt === 'clusters' ? 1 : 0);
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
    // charge en kg d'après le 1RM (test, profil ou estimation), en % selon répétitions + réserve (table NSCA)
    const lift = role === 'main' && ['force', 'hyper', 'endu_f'].includes(rx.goal) ? LIFT_OF_LIB[x.id] : null, rm = lift ? oneRM(lift, null, cfg.lv) : null;
    if (rm) {
      const mid = Math.round((rx.r[0] + rx.r[1]) / 2), pc = PCT[Math.min(15, mid + rx.rir)] || 65, ld = loadForPct(rm, pc);
      if (ld != null) { it.load = ld; it.unit_load = rm.lest ? '+kg' : 'kg'; it.reps = mid; it.det = it.det.split(' · ').filter(x => !/% du max|lest ou variante/.test(x)).concat([(rm.lest && ld >= 0 ? '+' : '') + fmtNum(ld) + ' kg (≈ ' + pc + ' % de ton 1RM, ' + rm.txt + ')']).join(' · '); }
    }
    if (role === 'main' && fmt === 'clusters' && x.t !== 'iso' && items.filter(y => y.timer && y.timer.kind === 'cluster').length < 2) {
      const reps = rx.r[0]; it.timer = { kind: 'cluster', reps, intra: 20, setRest: rx.rest };
      it.det = reps + ' rép. isolées, 20 s entre chaque · ' + it.det.split(' · ').slice(1).join(' · ');
      delete it.rest;
    }
    items.push(it);
    if (x.heavy && !wk.light && role !== 'prev') x.g.forEach(g => heavy.add(g));
  }
  // supersets : poussée et tirage voisins en alternance (1 min entre les deux, le repos habituel avant la paire suivante)
  if (fmt === 'supersets') for (let i = 1; i < items.length; i++) {
    const a = LIB_BY_ID[items[i - 1].lib] || {}, b = LIB_BY_ID[items[i].lib] || {};
    if (items[i - 1].superset || items[i].superset || items[i - 1].pairWith) continue;
    const pa = String(a.pat || ''), pb = String(b.pat || '');
    if ((pa.startsWith('push') && pb.startsWith('pull')) || (pa.startsWith('pull') && pb.startsWith('push'))) { items[i].superset = items[i - 1].id; items[i - 1].pairWith = true; items[i - 1].pairRest = 60; items[i].rest = items[i - 1].rest; delete items[i - 1].pairWith; i++; }
  }
  // contraste : une série lourde du mouvement de base, puis la version explosive (potentialisation)
  if (fmt === 'contraste' && !wk.light) {
    const pairs = [['squat', 'plyo', 'Squat lourd + sauts'], ['push-h', 'push-puiss', 'Développé couché lourd + pompes explosives'], ['pull-v', 'pull-puiss', 'Tractions lestées lourdes + tractions explosives']];
    const out = [];
    for (const [hp, lp, lbl] of pairs) {
      let h = pick(hp, 'force', cfg, eq, new Set()), l = pick(lp, 'puiss', cfg, eq, new Set()); if (!h || !l) continue;
      if (cfg.swap && cfg.swap[h.id] && LIB_BY_ID[cfg.swap[h.id]]) h = LIB_BY_ID[cfg.swap[h.id]];
      if (cfg.swap && cfg.swap[l.id] && LIB_BY_ID[cfg.swap[l.id]]) l = LIB_BY_ID[cfg.swap[l.id]];
      const lift = LIFT_OF_LIB[h.id], rm = lift ? oneRM(lift, null, cfg.lv) : null, ld = rm ? loadForPct(rm, 87) : null;
      out.push({ id: uid('i'), label: 'Contraste : ' + h.n.toLowerCase() + ' + ' + l.n.toLowerCase(), det: '3 rép. lourdes' + (ld != null ? ' à ' + (rm.lest && ld >= 0 ? '+' : '') + fmtNum(ld) + ' kg (≈ 87 % de ton 1RM)' : ' (≈ 85-90 % du max)') + ', 4 min, puis 5 ' + (lp === 'plyo' ? 'sauts' : 'répétitions explosives') + ' à vitesse maximale', n: wk.taper ? 2 : cfg.lvl >= 3 ? 4 : 3, unit: 'Série', lib: h.id, timer: { kind: 'contrast', heavyRest: 240, lightRest: 180 }, rx: { goal: 'puiss', role: 'puiss', light: false } });
      if (ld != null) { out[out.length - 1].load = ld; out[out.length - 1].unit_load = rm.lest ? '+kg' : 'kg'; }
      h.g.forEach(g => heavy.add(g));
    }
    if (out.length) { items.splice(0, items.length, ...out.concat(items.filter(it => it.rx && it.rx.role === 'acc'))); }
  }
  const g0 = GOAL_BY_ID[goal] || GOAL_BY_ID.force;
  const mainRx = rxFor(goal, 'main', cfg, wk);
  const prog = goal === 'puiss' ? 'Vitesse avant tout : on garde des charges légères et on arrête la série dès que le mouvement ralentit.'
    : cfg.lvl === 3 ? 'Charge réglée sur la réserve : si tu termines avec plus de réserve que prévu, ajoute 2,5 à 5 % la séance suivante ; avec moins, garde la charge.'
      : 'Double progression : quand toutes les séries atteignent le haut de la fourchette avec la réserve visée, ajoute la plus petite charge possible (2,5 kg) la séance suivante.';
  const blk = { id: uid('b'), kind: T.kind, title: (T.kind === 'renfo' ? 'Renfo' : 'Muscu') + ' · ' + T.t, desc: items.length + ' exercices · ' + (wk.light ? 'semaine de décharge' : wk.taper ? 'affûtage : moins de séries, même intensité' : g0.l.toLowerCase()), sub: wk.light ? 'Décharge : environ 40 % de séries en moins, même charge ou un peu moins, loin de l’échec.' : prog, items: [ech('5 à 10 min de cardio léger, mobilité, puis 2 à 3 séries de montée en charge sur le premier exercice.')].concat(items) };
  const rpe = wk.light ? [4, 6] : goal === 'puiss' ? [5, 7] : goal === 'endu_f' ? [6, 8] : goal === 'prev' ? [4, 6] : goal === 'hyper' ? [7, 9] : [7, 8];
  const sys = SYSTEMS[g0.sys] || SYSTEMS.neuro;
  // durée et temps sous tension estimés : 40 s par série + repos, environ 3 s par répétition
  let sec = 600, tut = 0;
  for (const it of items) { const r = it.reps || (it.rx && it.rx.r ? Math.round((it.rx.r[0] + it.rx.r[1]) / 2) : 8); sec += it.n * (40 + (it.superset ? 0 : (it.rest || (it.timer ? it.timer.setRest || it.timer.heavyRest + it.timer.lightRest || 180 : 90)))); tut += it.n * (it.timer && it.timer.kind === 'contrast' ? 2 * 5 * 2 : r * 3); }
  if (fmt === 'clusters') sec += items.filter(it => it.timer && it.timer.kind === 'cluster').reduce((a, it) => a + it.n * it.timer.reps * it.timer.intra, 0);
  return { short: T.t, blocks: [blk], target: { rpe, fam: wk.light || goal === 'prev' ? 'light' : 'muscu', why: sys.l + ' · ' + sys.d + (mainRx.rest ? ' Repos : ' + mmss(mainRx.rest) + ' entre les séries des exercices principaux.' : '') }, heavy, est: { min: Math.round(sec / 60 / 5) * 5, tut, fmt } };
}

// Cotation conseillée : écart (en niveaux) à ton flash / à vue ou à ton max, si tu les as renseignés ou si l'appli les estime
function gradeRx(lv, key, shift, disc) {
  const r = lv[key]; if (!r) return null;
  const g = shiftGrade(r.g, shift, disc), ref = key === 'bf' ? 'flash' : key === 'vf' ? 'à vue' : 'max';
  return { g, txt: g + ' (' + (gapText(g, r.g, disc, ref) || '') + ')' };
}
function climbSession(type, cfg, eq, wk) {
  const m = wk.light ? 0.6 : wk.taper ? 0.5 : 1, n = (base, add) => Math.max(1, Math.round((base + (wk.light || wk.taper ? 0 : add[wk.step])) * m));
  const heavy = new Set(), blocks = [], lv = climbLevel(null, cfg.lv), L = cfg.lvl - 1;
  const durF = cfg.dur <= 45 ? 0.75 : cfg.dur <= 60 ? 1 : cfg.dur <= 75 ? 1.25 : 1.5;
  const avail = Math.max(20, cfg.dur - 15) * 60; // secondes après l'échauffement
  const fmt = fmtOf(type, cfg);
  let short = ST[type].t, tg, est = { fmt };
  const blk = (title, desc, sub, items, kind) => blocks.push({ id: uid('b'), kind: kind || 'grimpe', title, desc, sub, items });
  if (type === 'doigts') {
    if (fmt === 'hangs' && available(LIB_BY_ID['max-hangs'], cfg, eq)) {
      const reps = n(5, [0, 1, 1]);
      blk('Doigts · suspensions max', reps + ' × 10 s · 3 min de repos', 'Charge : celle que tu tiendrais environ 13 s (marge de 3 s). Quand les 10 s deviennent faciles sur toutes les suspensions, ajoute 1 à 2 kg (ou retire de la décharge).', [
        ech('10 min de grimpe facile, puis 3 suspensions de 10 s à environ 50, 70 et 85 % de l’effort, 1 min entre chaque.', 'Échauffement des doigts'),
        { id: uid('i'), label: 'Suspensions max · 20 mm semi-arqué', det: '10 s par suspension, 3 min de repos (filière alactique, 1:18)', n: reps, unit: 'Série', unit_load: '+kg', lib: 'max-hangs', rx: { goal: 'doigts', role: 'main', light: !!wk.light }, timer: { kind: 'interval', name: 'Suspensions max', work: 10, rest: 180, reps, sets: 1, setRest: 0, prep: 10, workLabel: 'Suspends', restLabel: 'Repos', markEach: 'rep' } }
      ], 'doigts');
      est = { fmt, min: 15 + Math.round(reps * 190 / 60), tut: reps * 10 };
    } else if (fmt === 'lift' && available(LIB_BY_ID['finger-lift'], cfg, eq)) {
      // charge d'après ton test de finger lift max (7 s) : environ 85 %, il reste 2 à 3 s de marge
      // en alternant les mains : 7 s, 1 min 30, l'autre main… chaque main récupère environ 3 min
      const reps = n(5, [0, 1, 1]), lifts = reps * 2, t = lastResult('fl-semi'), mx = t && t.vals && typeof t.vals.v === 'number' ? t.vals.v : null, ld = mx ? Math.round(mx * 0.85 / 1.25) * 1.25 : null;
      const it = { id: uid('i'), label: 'Finger lift · semi-arqué', det: lifts + ' levées de 7 s en alternant les mains (' + reps + ' par main), 1 min 30 entre deux' + (ld ? ' · ' + fmtNum(ld) + ' kg (≈ 85 % de ton test du ' + fmtDay(t.k) + ')' : ' · charge que tu tiendrais 9 à 10 s'), n: lifts, unit: 'Série', lib: 'finger-lift', rx: { goal: 'doigts', role: 'main', light: !!wk.light }, timer: { kind: 'interval', name: 'Finger lift', work: 7, rest: 90, reps: lifts, sets: 1, setRest: 0, prep: 10, workLabel: 'Lève', restLabel: 'Change de main', markEach: 'rep' } };
      if (ld) { it.load = ld; it.unit_load = 'kg'; }
      blk('Doigts · finger lift', reps + ' × 7 s par main, en alternant', 'Progression : quand les 7 s passent avec de la marge sur toutes les levées, ajoute 1 à 2 kg.', [ech('10 min de grimpe facile, puis 3 levées de 7 s en montant la charge.', 'Échauffement des doigts'), it], 'doigts');
      est = { fmt, min: 15 + Math.round(lifts * 97 / 60), tut: lifts * 7 };
    } else {
      const tries = n(Math.round(7 * durF), [0, 1, 2]), g = gradeRx(lv, 'bm', -1, 'bloc');
      blk('Escalade · force des doigts', tries + ' essais très durs sur petites prises', cfg.u18 ? 'Avant 18 ans, pas de suspensions max : la grimpe sur petites prises fait progresser les doigts sans risque pour les cartilages de croissance.' : 'Qualité avant quantité : on arrête dès que les essais deviennent moins bons.', [
        ech('15 min de grimpe facile, puis 3 à 4 blocs de plus en plus durs.'),
        Object.assign({ id: uid('i'), label: 'Blocs à ta limite sur petites prises', det: '3 à 6 mouvements quasi maximaux, 3 min entre les essais' + (g ? ' · ' + g.txt : ''), n: tries, unit: 'Essai', rest: 180, lib: 'limite', rx: { goal: 'doigts', role: 'main', light: !!wk.light } }, g ? { grade: g.g } : {})]);
      est = { fmt, min: 15 + Math.round(tries * 195 / 60), tut: tries * 15 };
    }
    if (!wk.light) heavy.add('doigts');
    short = 'Doigts';
    tg = { rpe: wk.light ? [4, 6] : [7, 8], fam: wk.light ? 'light' : 'hard', s: 6, i: wk.light ? 5 : 9, v: 3 };
  } else if (type === 'bloc') {
    const pan = fmt === 'pan' && available(LIB_BY_ID['pan-dur'], cfg, eq), x = pan ? LIB_BY_ID['pan-dur'] : LIB_BY_ID.limite;
    const tries = n(Math.round(7 * durF), [0, 1, 2]), g = pan ? null : gradeRx(lv, 'bm', 0, 'bloc');
    const items = [ech('15 min de grimpe facile, puis 3 à 4 blocs de plus en plus durs.'), Object.assign({ id: uid('i'), label: x.n, det: '3 à 6 mouvements quasi maximaux, 3 min entre les essais (filière alactique)' + (g ? ' · autour de ' + g.g + ' (ton max)' : ''), n: tries, unit: 'Essai', rest: 180, lib: x.id, rx: { goal: 'bloc', role: 'main', light: !!wk.light } }, g ? { grade: g.g } : {})];
    if (available(LIB_BY_ID.campus, cfg, eq) && !wk.light) items.push({ id: uid('i'), label: 'Campus sur prises larges', det: 'Montées 1-3-5, arrêt dès que la qualité baisse', n: wk.taper ? 2 : 4, unit: 'Essai', rest: 180, lib: 'campus' });
    if (available(LIB_BY_ID['tractions-expl'], cfg, eq) && cfg.dur >= 60) items.push({ id: uid('i'), label: 'Tractions explosives', det: '3 rép. · vitesse maximale', n: wk.light ? 2 : 4, unit: 'Série', rest: 150, lib: 'tractions-expl' });
    blk('Escalade · ' + (pan ? 'pan' : 'bloc à la limite'), tries + ' essais très durs, frais à chaque fois', 'Qualité avant quantité : on arrête dès que les essais deviennent moins bons.', items);
    if (!wk.light) { heavy.add('doigts'); heavy.add('tirage'); }
    short = 'Bloc limite';
    tg = { rpe: wk.light ? [4, 6] : [8, 9], fam: wk.light ? 'light' : 'hard', s: 9, i: wk.light ? 5 : 9, v: 4 };
    est = { fmt, min: 15 + Math.round((tries + (items.length - 2) * 4) * 195 / 60), tut: tries * 15 };
  } else if (type === 'compet') {
    const ech0 = ech('20 min : grimpe facile, puis 4 à 5 blocs de plus en plus durs, comme avant une compétition.');
    let it, desc, sub;
    if (fmt === 'contest') {
      const nb = n([10, 14, 18][L], [0, 1, 2]), g = gradeRx(lv, 'bf', -3, 'bloc'), top = lv.bm ? lv.bm.g : null;
      it = Object.assign({ id: uid('i'), label: 'Contest', det: 'Du plus facile au plus dur' + (g ? ', de ' + g.g + ' à ' + (top || 'ton max') : '') + ' · 2 min entre les blocs, note chaque bloc (Tombé si raté)', n: nb, unit: 'Bloc', rest: 120, lib: 'compet-sim', disc: 'bloc' }, g ? { grade: g.g } : {});
      desc = 'Un maximum de blocs en temps limité, comme en open'; sub = 'Choisis tes blocs comme en contest : assure les points faciles, puis monte. La cotation se règle bloc par bloc.';
      est = { fmt, min: 20 + Math.round(nb * 160 / 60), tut: nb * 45 };
    } else if (fmt === 'flash') {
      const nb = n([5, 6, 8][L], [0, 0, 1]), g = gradeRx(lv, 'bf', 0, 'bloc');
      it = Object.assign({ id: uid('i'), label: 'Flash de blocs nouveaux', det: '1 min de lecture depuis le sol, un seul essai, 3 min de repos' + (g ? ' · autour de ' + g.g + ' (ton flash)' : ''), n: nb, unit: 'Essai', rest: 180, lib: 'flash' }, g ? { grade: g.g } : {});
      desc = 'Lecture et engagement : un seul essai par bloc'; sub = 'Lis la séquence entière avant de partir : mains, pieds, repos. Note les flashs réussis : c’est ton indicateur.';
      est = { fmt, min: 20 + Math.round(nb * 240 / 60), tut: nb * 40 };
    } else {
      const nb = wk.light || wk.taper ? 3 : cfg.lvl >= 2 ? 5 : 4, g = gradeRx(lv, 'bf', -1, 'bloc'), top = lv.bm ? lv.bm.g : null;
      it = Object.assign({ id: uid('i'), label: 'Simulation de qualif', det: 'Blocs nouveaux de difficulté croissante' + (g ? ' (' + g.g + ' à ' + (top || 'ton max') + ')' : '') + ' · 4 min d’essais par bloc, 4 min de repos', n: nb, unit: 'Bloc', lib: 'compet-sim', timer: { kind: 'interval', name: 'Qualif', work: 240, rest: 240, reps: nb, sets: 1, setRest: 0, prep: 10, workLabel: 'Essais', restLabel: 'Repos', markEach: 'rep' } }, g ? { grade: g.g } : {});
      desc = nb + ' blocs · 4 min d’essais, 4 min de repos'; sub = 'Au plus près du format des compétitions (4 à 5 min par bloc) : gère tes essais, repose-toi vraiment entre deux. Note tops et zones.';
      est = { fmt, min: 20 + Math.round(nb * 8), tut: nb * 120 };
    }
    blk('Escalade · compétition', desc, sub, [ech0, it]);
    if (!wk.light) { heavy.add('doigts'); heavy.add('tirage'); }
    short = 'Compétition';
    tg = { rpe: wk.light ? [4, 6] : [7, 9], fam: wk.light ? 'light' : 'hard', s: 10, i: wk.light ? 5 : 8, v: 5 };
  } else if (type === 'resist') {
    const items = [ech('15 min de grimpe facile qui monte progressivement.')];
    if (fmt === 'int' && available(LIB_BY_ID['int-pan'], cfg, eq)) {
      const reps = n(Math.round(5 * durF), [0, 1, 2]);
      items.push({ id: uid('i'), label: 'Intervalles 1 min sur pan', det: '1 min de grimpe soutenue, 3 min de repos (1:3)', n: reps, unit: 'Série', lib: 'int-pan', timer: { kind: 'interval', name: 'Intervalles 1 min', work: 60, rest: 180, reps, sets: 1, setRest: 0, prep: 10, workLabel: 'Grimpe', restLabel: 'Repos', markEach: 'rep' } });
      est = { fmt, min: 15 + Math.round(reps * 4), tut: reps * 60 };
    } else if (fmt === 'voies') {
      const sets = n([3, 4, 5][L], [0, 0, 1]), g = gradeRx(lv, 'vf', -2, 'voie');
      items.push(Object.assign({ id: uid('i'), label: 'Enchaînement de deux voies', det: 'Deux voies d’affilée sans redescendre au sol si possible, 5 min de repos' + (g ? ' · ' + g.txt : ' · ton à vue moins 2'), n: sets, unit: 'Série', rest: 300, lib: 'enchainement', disc: 'voie' }, g ? { grade: g.g } : {}));
      est = { fmt, min: 15 + Math.round(sets * 11), tut: sets * 360 };
    } else {
      const sets = n(cfg.dur >= 75 ? 5 : 4, [0, 0, 1]), g = gradeRx(lv, 'bm', -3, 'bloc');
      items.push(Object.assign({ id: uid('i'), label: '4 blocs enchaînés (4 × 4)', det: 'Une série = 4 blocs sans pause, 3 à 4 min de repos entre les séries' + (g ? ' · ' + g.txt : ' · 2 à 3 niveaux sous ta limite'), n: sets, unit: 'Série', rest: 210, lib: '4x4' }, g ? { grade: g.g } : {}));
      est = { fmt, min: 15 + Math.round(sets * (160 + 210) / 60), tut: sets * 160 };
    }
    blk('Escalade · résistance', 'Filière lactique : efforts de 1 à 3 min qui « brûlent »', 'Progression : un bloc ou une série de plus, ou des blocs un peu plus durs, quand tout passe proprement.', items);
    tg = { rpe: wk.light ? [4, 6] : [7, 9], fam: wk.light ? 'light' : 'hard', s: 8, i: wk.light ? 5 : 7, v: 7 };
  } else {
    if (fmt === 'blocs') {
      // 40 s sur le bloc + 1 min de repos ; plafond selon le niveau ; +2 blocs par semaine dans le mésocycle
      const nb = Math.max(6, Math.round((Math.min([14, 20, 26][L], Math.floor(avail / 100)) + (wk.light || wk.taper ? 0 : [0, 2, 4][wk.step])) * m));
      const g = gradeRx(lv, 'bf', -3, 'bloc');
      blk('Escalade · volume', nb + ' blocs · 1 min de repos', 'Assez facile pour enchaîner sans « bouteiller » : si les chutes s’accumulent, descends d’une cotation. Le mode blocs note les chutes et le temps sur le mur.', [ech('10 min de grimpe très facile.'),
        Object.assign({ id: uid('i'), label: 'Blocs' + (g ? ' ' + g.g : ' faciles'), det: '1 min de repos entre les blocs' + (g ? ' · ' + g.txt : ' · nettement sous ton flash'), n: nb, unit: 'Bloc', rest: 60, lib: 'volume-blocs', disc: 'bloc' }, g ? { grade: g.g } : {})]);
      est = { fmt, min: 10 + Math.round(nb * 100 / 60), tut: nb * 40 };
    } else if (fmt === 'voies') {
      const nv = Math.max(4, Math.round((Math.min([6, 9, 12][L], Math.floor(avail / 420)) + (wk.light || wk.taper ? 0 : [0, 1, 2][wk.step])) * m)), g = gradeRx(lv, 'vf', -3, 'voie');
      blk('Escalade · volume en voie', nv + ' voies faciles', 'Beaucoup de voies faciles en soignant les placements ; repos le temps d’assurer.', [ech('10 min de grimpe très facile.'),
        Object.assign({ id: uid('i'), label: 'Voies' + (g ? ' ' + g.g : ' faciles'), det: 'Environ 4 min de repos (le temps d’assurer)' + (g ? ' · ' + g.txt : ' · 2 à 3 niveaux sous ton à vue'), n: nv, unit: 'Voie', rest: 240, lib: 'volume', disc: 'voie' }, g ? { grade: g.g } : {})]);
      est = { fmt, min: 10 + Math.round(nv * 7), tut: nv * 180 };
    } else {
      const k = cfg.dur <= 45 ? [2, 10] : cfg.dur <= 60 ? [2, 15] : cfg.dur <= 75 ? [3, 12] : [3, 15];
      const sets = n(k[0], [0, 0, 1]), g = gradeRx(lv, 'bf', -4, 'bloc');
      blk('Escalade · continuité', 'Filière aérobie : long et facile', 'Avant-bras chauds mais jamais « bouteillés » : si ça brûle, descends d’un niveau.', [ech('10 min de grimpe très facile.'), { id: uid('i'), label: 'Continuité ' + sets + ' × ' + k[1] + ' min', det: 'Grimpe facile sans t’arrêter (traversées, voies faciles enchaînées), 5 min de repos' + (g ? ' · ' + g.txt : ''), n: sets, unit: 'Bloc', rest: 300, lib: 'conti' }]);
      est = { fmt, min: 10 + sets * (k[1] + 5), tut: sets * k[1] * 60 };
    }
    short = 'Volume';
    tg = { rpe: [3, 5], fam: 'vol', s: 6, i: 3, v: wk.light ? 5 : 8 };
  }
  const sys = SYSTEMS[(GOAL_BY_ID[type === 'compet' ? 'compet' : type] || GOAL_BY_ID.conti).sys];
  tg.why = sys.l + ' · ' + sys.d;
  return { short, blocks, target: tg, heavy, est };
}

// Allures et fréquences cardiaques d'après la VMA et la FC max (repères facultatifs)
function vmaTxt(vma, lo, hi) { return vma ? 'allure ' + paceAt(vma.v, hi) + ' à ' + paceAt(vma.v, lo) + ' /km (' + lo + '-' + hi + ' % de ta VMA)' : null; }
function distTxt(vma, pct, sec) { if (!vma) return null; const m = Math.round(vma.v * pct / 100 / 3.6 * sec / 5) * 5; return '≈ ' + m + ' m en ' + (sec >= 60 ? sec / 60 + ' min' : sec + ' s') + ' (' + pct + ' % de ta VMA)'; }
function fcTxt(fc, lo, hi) { return fc ? lo + '-' + hi + ' % de ta FC max, soit ' + Math.round(fc.v * lo / 100) + ' à ' + Math.round(fc.v * hi / 100) + ' bpm' : null; }
// Watts d'après la FTP (zones de Coggan)
function wTxt(ftp, lo, hi) { return ftp ? (hi ? Math.round(ftp.v * lo / 100) + ' à ' + Math.round(ftp.v * hi / 100) + ' W (' + lo + '-' + hi + ' % de ta FTP)' : 'au moins ' + Math.round(ftp.v * lo / 100) + ' W (' + lo + ' % de ta FTP et plus)') : null; }
function csTxt(cs, lo, hi) { return cs ? 'allure ' + paceAt(cs.v, hi) + ' à ' + paceAt(cs.v, lo) + ' /km (' + lo + '-' + hi + ' % de ta vitesse critique)' : null; }
function cardioSession(type, cfg, eq, wk) {
  const sport = cardioSport(cfg, eq), kind = sport === 'course' ? 'course' : 'velo';
  const vma = sport === 'course' ? vmaOf(null, cfg.lv) : null, fc = fcmaxOf(null, cfg.lv), cs = sport === 'course' ? csOf() : null, ftp = sport === 'velo' ? ftpOf(null, cfg.lv) : null;
  const fam = type === 'int' ? fmtFamily('int', cfg) : null, fmt = fam ? fmtOf(fam, cfg) : null;
  let est = fmt ? { fmt } : undefined;
  const m = wk.light ? 0.6 : wk.taper ? 0.5 : 1, lv = cfg.lvl - 1, heavy = new Set();
  const nm = { course: ['Footing', 'Course'], velo: ['Vélo', 'Vélo'], nage: ['Natation', 'Natation'], circuit: ['Circuit', 'Circuit'] }[sport];
  let blocks, short = ST[type] ? ST[type].t : 'Cardio', tg;
  if (sport === 'circuit' && type !== 'ef' && type !== 'long') type = 'circuit';
  if (type === 'ef' || type === 'long') {
    const base = type === 'long' ? [50, 75, 95][lv] : Math.max(30, cfg.dur - 10), mins = Math.round(base * (wk.light ? 0.7 : wk.taper ? 0.6 : [1, 1.1, 1.15][wk.step]) / 5) * 5;
    const x = sport === 'velo' ? 'velo-z2' : sport === 'nage' ? 'nage-ef' : sport === 'circuit' ? null : type === 'long' ? 'sortie-longue' : 'ef';
    const lbl = x ? (type === 'long' ? 'Sortie longue' : LIB_BY_ID[x].n) : 'Cardio facile (marche rapide, vélo, corde à sauter…)';
    const zone = vmaTxt(vma, 60, 70) || (sport === 'velo' ? wTxt(ftp, 56, 75) : null) || fcTxt(fc, 60, 70);
    blocks = [{ id: uid('b'), kind, title: nm[1] + ' · ' + (type === 'long' ? 'sortie longue' : 'endurance fondamentale'), desc: mins + ' min faciles', sub: 'Zone 1-2 : tu peux parler en phrases complètes. C’est l’essentiel du volume en endurance (environ 80 %).', items: [Object.assign({ id: uid('i'), label: lbl + ' · ' + mins + ' min', det: (x ? LIB_BY_ID[x].c : 'Zone 1-2, aisance respiratoire.') + (zone ? ' · ' + zone : ''), n: 1, unit: 'Bloc' }, x ? { lib: x } : {})] }];
    tg = { rpe: [2, 4], fam: type === 'long' ? 'vol' : 'easy' };
  } else if (type === 'circuit') {
    const rounds = Math.max(2, Math.round(([3, 4, 5][lv] + (wk.light || wk.taper ? 0 : [0, 0, 1][wk.step])) * m));
    blocks = [{ id: uid('b'), kind: 'velo', title: 'Circuit fonctionnel', desc: rounds + ' tours · 5 ateliers', sub: 'Filière lactique et aérobie : 40 s par atelier, 20 s de transition, 2 min entre les tours.', items: [ech('5 min de cardio léger et de mobilité.'), { id: uid('i'), label: 'Circuit : burpees, fentes, squats, pompes, gainage', det: '40 s d’effort, 20 s de transition', n: rounds, unit: 'Série', lib: 'circuit', timer: { kind: 'interval', name: 'Circuit', work: 40, rest: 20, reps: 5, sets: rounds, setRest: 120, prep: 10, workLabel: 'Effort', restLabel: 'Change' } }] }];
    tg = { rpe: wk.light ? [4, 6] : [7, 8], fam: wk.light ? 'light' : 'hard' };
    if (!wk.light) heavy.add('cardio');
  } else {
    // intervalles : 30/30 (VMA), 3 min, 4 × 4 min vélo, 100 m nage, 300 m lactiques
    let it;
    if (type === 'int' && fmt === 'seuil') { const reps = Math.max(2, Math.round(([3, 4, 5][lv] + (wk.light || wk.taper ? 0 : [0, 0, 1][wk.step])) * m)); it = { label: 'Seuil ' + reps + ' × 8 min', det: '8 min à allure seuil, 2 min de trot' + (cs ? ' · ' + csTxt(cs, 93, 97) : vma ? ' · ' + vmaTxt(vma, 82, 86) + ' (sans test de vitesse critique)' : ' · allure semi-marathon'), lib: '3min', timer: { kind: 'interval', name: 'Seuil', work: 480, rest: 120, reps, sets: 1, setRest: 0, prep: 10, workLabel: 'Seuil', restLabel: 'Trot', markEach: 'rep' }, n: reps }; est = { fmt, min: 25 + reps * 10 }; }
    else if (type === 'int' && fmt === 'sst') { const mins = [12, 15, 20][lv], reps = wk.light || wk.taper ? 1 : 2; it = { label: 'Sweet spot ' + reps + ' × ' + mins + ' min', det: mins + ' min juste sous la FTP, 5 min faciles' + (ftp ? ' · ' + wTxt(ftp, 88, 94) : fc ? ' · ' + fcTxt(fc, 82, 87) : ''), timer: { kind: 'interval', name: 'Sweet spot', work: mins * 60, rest: 300, reps, sets: 1, setRest: 0, prep: 10, workLabel: 'Sweet spot', restLabel: 'Facile', markEach: 'rep' }, n: reps }; est = { fmt, min: 25 + reps * (mins + 5) }; }
    else if (type === 'lact') { const reps = Math.max(3, Math.round(([5, 6, 7][lv] + [0, 1, 2][wk.step]) * m)); it = { label: sport === 'velo' ? 'Vélo 6 × 1 min très vite' : sport === 'nage' ? 'Natation 6 × 50 m vite' : 'Répétitions de 300 m', det: 'Environ 1 min très vite, 3 min 30 de récupération (1:3 à 1:4)' + (sport === 'velo' && ftp ? ' · ' + wTxt(ftp, 121) : ''), lib: sport === 'course' ? '300m' : null, timer: { kind: 'interval', name: 'Lactique', work: 60, rest: 210, reps, sets: 1, setRest: 0, prep: 10, workLabel: 'Vite', restLabel: 'Récup', markEach: 'rep' }, n: reps }; }
    else if (sport === 'velo') { const reps = Math.max(2, Math.round((4 + (wk.light || wk.taper ? 0 : [0, 0, 1][wk.step])) * m)); it = { label: 'Vélo 4 × 4 min', det: '4 min fort (90-95 % de ta FC max), 3 min faciles' + (ftp ? ' · ' + wTxt(ftp, 106, 120) : fc ? ' · ' + fcTxt(fc, 90, 95) : ''), lib: 'velo-4x4', timer: { kind: 'interval', name: 'Vélo 4 × 4', work: 240, rest: 180, reps, sets: 1, setRest: 0, prep: 10, workLabel: 'Fort', restLabel: 'Facile', markEach: 'rep' }, n: reps }; }
    else if (sport === 'nage') { const reps = Math.max(4, Math.round(([6, 8, 10][lv] + [0, 1, 2][wk.step]) * m)); it = { label: 'Natation ' + reps + ' × 100 m', det: '100 m soutenu, 20 à 30 s de repos', lib: 'nage-100', n: reps, unit: 'Série', rest: 25 }; }
    else if (cfg.lvl >= 2 && wk.step === 1 && fmt !== '3030') { const reps = Math.max(3, Math.round(([4, 4, 5][lv] + 1) * m)); it = { label: 'Intervalles 3 min', det: '3 min à allure 3 000-5 000 m, 2 min de trot' + (vma ? ' · ' + distTxt(vma, 92, 180) : ''), lib: '3min', timer: { kind: 'interval', name: 'Intervalles 3 min', work: 180, rest: 120, reps, sets: 1, setRest: 0, prep: 10, workLabel: 'Vite', restLabel: 'Trot', markEach: 'rep' }, n: reps }; }
    else { const sets = lv === 0 ? 1 : 2, reps = Math.max(4, Math.round(([8, 10, 12][lv] + [0, 1, 2][wk.step]) * m)); it = { label: 'Intervalles 30/30', det: '30 s vite (proche de ta VMA), 30 s de trot' + (vma ? ' · ' + distTxt(vma, 100, 30) : '') + ' · ' + sets + ' série' + (sets > 1 ? 's' : '') + ' de ' + reps, lib: '30-30', timer: { kind: 'interval', name: '30/30', work: 30, rest: 30, reps, sets, setRest: 180, prep: 10, workLabel: 'Vite', restLabel: 'Trot' }, n: sets }; }
    blocks = [{ id: uid('b'), kind, title: nm[1] + ' · ' + (type === 'lact' ? 'intervalles lactiques' : 'intervalles'), desc: it.det, sub: type === 'lact' ? 'Filière lactique : efforts de 20 s à 2 min, récupération 1:3 à 1:5.' : 'Les 20 % d’intensité de l’entraînement polarisé : efforts durs, le reste de la semaine reste facile.', items: [ech('15 min faciles, puis 3 accélérations progressives de 20 s.'), Object.assign({ id: uid('i'), unit: 'Série' }, it), { id: 'rac', label: 'Retour au calme', det: '10 min très faciles', n: 1 }] }];
    tg = { rpe: wk.light ? [4, 6] : [7, 9], fam: wk.light ? 'light' : 'hard' };
    if (!wk.light) heavy.add('cardio');
  }
  const sys = SYSTEMS[type === 'lact' || type === 'circuit' ? 'lact' : 'aero'];
  tg.why = sys.l + ' · ' + sys.d;
  return { short, blocks, target: tg, heavy, est };
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
  if (['doigts', 'bloc', 'resist', 'conti', 'compet'].includes(type)) return climbSession(type, cfg, eq, wk);
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
    // compléments choisis dans l'aperçu (ce qui manque pour ton sport)
    applyExtras(days, cfg, wk);
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
  // repères et formats retenus, pour relire le programme plus tard
  const fams = [...new Set((prog.types || []).map(t => fmtFamily(t, c)).filter(Boolean))];
  if (fams.length) lines.push('- Formats : ' + fams.map(f => FORMATS[f].find(x => x[0] === fmtOf(f, c))[1].toLowerCase()).join(', ') + '.');
  const cl = climbLevel(null, c.lv), rep = [];
  for (const [k, l] of [['bf', 'bloc flash'], ['bm', 'bloc max'], ['vf', 'voie à vue'], ['vm', 'voie max']]) if (cl[k]) rep.push(l + ' ' + cl[k].g + (cl[k].src !== 'déclaré' ? ' (estimé)' : ''));
  for (const l of ['squat', 'bench', 'deadlift', 'pull', 'dips']) { const r = oneRM(l, null, c.lv); if (r) rep.push('1RM ' + ({ squat: 'squat', bench: 'développé couché', deadlift: 'soulevé de terre', pull: 'traction', dips: 'dips' })[l] + ' ' + r.txt + ' (' + srcTxt(r) + ')'); }
  const v = vmaOf(null, c.lv); if (v) rep.push('VMA ' + fmtNum(v.v) + ' km/h');
  if (rep.length) lines.push('- Repères utilisés : ' + rep.join(' ; ') + '.');
  const ex = (c.extras || []).filter(id => EXTRAS[id]);
  if (ex.length) lines.push('- Compléments pour ton sport : ' + ex.map(id => EXTRAS[id].t.toLowerCase()).join(', ') + '.');
  lines.push('', 'Sources : ACSM 2009 ; NSCA 2016 ; Schoenfeld 2016 et 2017 ; Helms 2016 ; Williams 2017 ; Bell 2023' + (c.event ? ' ; Bosquet 2007' : '') + ([c.goal, c.goal2].includes('aero') ? ' ; Stöggl 2014' : '') + (fams.some(f => fmtOf(f, c) === 'clusters') ? ' ; Tufano 2017' : '') + (fams.some(f => fmtOf(f, c) === 'supersets') ? ' ; Robbins 2010' : '') + (fams.some(f => fmtOf(f, c) === 'contraste') ? ' ; Seitz 2016' : '') + (v ? ' ; Billat 2001' : '') + exSrc(ex) + '.');
  return lines.join('\n');
}
const SRC_TXT = { turner2003: 'Turner 2003', bohm2015: 'Bohm 2015', vandyk2019: 'van Dyk 2019', byram2010: 'Byram 2010', lixandrao2018: 'Lixandrão 2018', patterson2019: 'Patterson 2019', wilson2013: 'Wilson 2013' };
const exSrc = ex => { const s = [...new Set(ex.flatMap(id => EXTRAS[id].src || []))].map(x => SRC_TXT[x]).filter(Boolean); return s.length ? ' ; ' + s.join(' ; ') : ''; };
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
