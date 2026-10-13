// Historique d'un exercice : dernière réalisation et charge conseillée pour la séance du jour.
// Progression : double progression (ACSM 2009 : +2 à 10 % quand on dépasse la fourchette) ou réglage par la réserve (Helms 2016).
import { ids, jget, jset } from './store.js';
import { blocks, itemKey, doneN, itemLoad, setLoadsOf, setsText, workLoad } from './plan.js';
import { norm, LIB_BY_ID } from './library.js';
import { repsOf } from './activity.js';
import { fmtNum, fmtShort } from './dates.js';

const num = v => { const m = String(v == null ? '' : v).replace(',', '.').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
const STRENGTH = ['muscu', 'renfo', 'doigts', 'epaule'];

// Dernière fois que l'exercice a été fait avant le jour k
export function lastPerf(label, k, lib) {
  const target = norm(label); if (!target) return null;
  const days = ids('j:').map(id => id.slice(2)).filter(d => d < k).reverse().slice(0, 150);
  for (const d of days) {
    const e = jget(d);
    for (const x of e.log || []) {
      if (norm(x.label) !== target || !(x.sets || x.reps || x.load)) continue;
      return { k: d, sets: num(x.sets), reps: x.reps || '', repsKnown: !!x.reps, load: x.load || '', loadV: num(x.load), rir: typeof x.rir === 'number' ? x.rir : null, full: true };
    }
    for (const b of blocks(d)) for (const it of b.items || []) {
      if (it.id === 'ech' || it.id === 'rac') continue;
      if (!(lib && it.lib === lib) && norm(it.label) !== target) continue;
      const key = itemKey(b, it), n = doneN(e, key, it.n); if (n <= 0) continue;
      const ld = itemLoad(b, it, e), sl = setLoadsOf(e, key), u = ld ? ld.u : it.unit_load || 'kg';
      const wl = sl ? workLoad(sl) : ld ? ld.v : null;
      return { k: d, sets: n, n: it.n, reps: repsOf(it.det), load: sl ? setsText(sl, u) : ld ? ld.text : '', loadV: wl, setLoads: sl, unit: u, rir: e.rir && typeof e.rir[key] === 'number' ? e.rir[key] : null, full: n >= it.n };
    }
  }
  return null;
}
export function perfText(p) {
  const parts = [];
  if (p.sets) parts.push(p.sets + (p.reps && p.repsKnown ? ' × ' + p.reps : ' série' + (p.sets > 1 ? 's' : '')));
  else if (p.reps) parts.push(p.reps);
  if (p.load) parts.push(p.load);
  if (typeof p.rir === 'number') parts.push('réserve ' + p.rir + (p.rir >= 4 ? '+' : ''));
  return fmtShort(p.k) + ' : ' + parts.join(' · ');
}

// Plus petit pas de charge raisonnable
function step(it, v) {
  const x = it.lib && LIB_BY_ID[it.lib];
  if (it.unit_load === '+kg') return x && x.pat === 'finger-max' ? 1 : 2.5;
  const lower = x && ['squat', 'hinge'].includes(x.pat);
  if (lower && v >= 80) return 5;
  if (v < 20) return 1;
  return 2.5;
}
const roundTo = (v, s) => Math.round(v / s) * s;

// Charge conseillée pour un exercice prévu ce jour-là : { v, text, why, from }
export function suggestLoad(b, it, k) {
  if (!STRENGTH.includes(b.kind) || it.id === 'ech') return null;
  const lp = lastPerf(it.label, k, it.lib);
  if (!lp || lp.loadV == null) return null;
  const v0 = lp.loadV, rx = it.rx || {}, s = step(it, Math.abs(v0)), u = it.unit_load === '+kg' || lp.unit === '+kg' ? '+kg' : 'kg';
  const fmt = v => (u === '+kg' && v > 0 ? '+' : '') + fmtNum(Math.round(v * 100) / 100) + ' kg';
  let v = v0, why;
  const lighter = lp.setLoads ? lp.setLoads.filter(x => x < v0) : [];
  if (rx.light) { why = 'Semaine de décharge : même charge que la dernière fois (ou un peu moins), loin de l’échec.'; }
  else if (!lp.full) { why = 'Séries incomplètes la dernière fois : on garde la même charge.'; }
  else if (lighter.length) { why = (lighter.length > 1 ? lighter.length + ' séries allégées' : 'Une série allégée') + ' la dernière fois (' + fmt(Math.min(...lighter)) + ') : on garde ' + fmt(v0) + ' et on vise toutes les séries à cette charge.'; }
  else {
    // répétitions réellement faites : connues seulement si notées dans « Ce que j'ai fait »
    const target = typeof rx.rir === 'number' ? rx.rir : 2, hi = rx.r ? rx.r[1] : null, reps = lp.repsKnown ? num(lp.reps) : null;
    const rr = lp.rir === 4 ? '4 ou plus' : lp.rir;
    if (typeof lp.rir === 'number') {
      if (lp.rir > target) { v = v0 + s * (lp.rir >= target + 2 && lp.rir < 4 ? 2 : 1); why = 'Il te restait ' + rr + ' répétitions pour une réserve visée de ' + target + ' : la charge monte.'; }
      else if (lp.rir <= target - 2) { v = v0 - s; why = 'Réserve de ' + rr + ' pour ' + target + ' visée : on redescend d’un cran.'; }
      else if (hi && reps && reps >= hi) { v = v0 + s; why = 'Haut de la fourchette atteint avec la réserve visée : +' + fmtNum(s) + ' kg (double progression).'; }
      else why = 'Réserve dans la cible : même charge, vise une répétition de plus.';
    } else if (hi && reps && reps >= hi) { v = v0 + s; why = 'Toutes les séries faites en haut de la fourchette : +' + fmtNum(s) + ' kg (double progression).'; }
    else why = 'Même charge que la dernière fois. Note ta réserve en fin de série : la charge suivante se réglera toute seule.';
  }
  v = roundTo(v, s >= 2.5 ? 1.25 : 0.5);
  if (u === 'kg') v = Math.max(0, v);
  return { v, u, text: fmt(v), from: fmt(v0), why, last: lp };
}
export function applySuggested(k, b, it, sug) {
  const key = itemKey(b, it), loads = Object.assign({}, jget(k).loads);
  loads[key] = sug.v; jset(k, { loads });
}
