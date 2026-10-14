// Repères de niveau de l'athlète, tous facultatifs : cotations d'escalade, 1RM des mouvements de base, VMA, FC max.
// Pour chaque repère on prend la valeur la plus récente parmi : un test passé, ce qui est déclaré dans le profil,
// ou une estimation tirée des séances (1RM d'après les séries faites, cotations d'après les blocs notés).
import { profileOf, getSubject, getFor, putFor, SELF, ids, jget } from './store.js';
import { history, bodyWeightAt } from './tests.js';
import { blocks, itemKey, doneN, setLoadsOf, itemLoad } from './plan.js';
import { gradeIdx, gradeAt } from './grades.js';
import { libMatch } from './library.js';
import { todayKey, addDays, fmtDay } from './dates.js';

// Mouvements de base : test 1RM, exercices de la bibliothèque qui s'y rapportent, charge additionnelle (lest) ou non
export const LIFTS = {
  squat: { l: 'Squat', test: 'squat-1rm', libs: ['squat'] },
  bench: { l: 'Développé couché', test: 'bench-1rm', libs: ['dc'] },
  deadlift: { l: 'Soulevé de terre', test: 'deadlift-1rm', libs: ['sdt'] },
  pull: { l: 'Traction lestée', test: 'pull-1rm', test5: 'pull-5rm', libs: ['tractions-lest', 'tractions'], lest: true },
  dips: { l: 'Dips lestés', test: 'dips-1rm', libs: ['dips'], lest: true }
};
export const LIFT_OF_LIB = Object.fromEntries(Object.entries(LIFTS).flatMap(([k, v]) => v.libs.map(l => [l, k])));
export const CLIMB_KEYS = [['bf', 'bloc', 'flash', 'Bloc · flash'], ['bm', 'bloc', 'max', 'Bloc · max enchaîné'], ['vf', 'voie', 'à vue', 'Voie · à vue'], ['vm', 'voie', 'max', 'Voie · max enchaîné']];

export const levelsDoc = o => (profileOf(o == null ? getSubject() : o).levels || {});
// Déclarer un repère dans son profil (valeur null = effacer)
export function setLevel(key, val, sub) {
  const p = getFor(SELF, 'profile') || {}, lv = Object.assign({}, p.levels), at = Object.assign({}, lv.at);
  if (sub) { const o = Object.assign({}, lv[key]); if (val == null || val === '') delete o[sub]; else o[sub] = val; lv[key] = o; at[key + '.' + sub] = todayKey(); }
  else { if (val == null || val === '') delete lv[key]; else lv[key] = val; at[key] = todayKey(); }
  lv.at = at;
  putFor(SELF, 'profile', Object.assign({}, p, { levels: lv }));
}
const newest = list => list.filter(x => x && x.v > 0).sort((a, b) => (a.k < b.k ? 1 : -1))[0] || null;

// 1RM d'un mouvement : { v (charge totale soulevée, poids de corps compris pour les mouvements lestés), lest, src, k, txt }
const epley = (w, n) => w * (1 + n / 30);
export function oneRM(lift, o, cfgLv) {
  const L = LIFTS[lift]; if (!L) return null;
  const lv = cfgLv || levelsDoc(o), at = lv.at || {}, cand = [];
  const bwAt = k => bodyWeightAt(k) || 0;
  for (const h of history(L.test)) { const v = h.vals && h.vals.v; if (typeof v === 'number') cand.push({ k: h.k, v: L.lest ? (h.bw || bwAt(h.k)) + v : v, src: 'test' }); }
  if (L.test5) for (const h of history(L.test5)) { const v = h.vals && h.vals.v; if (typeof v === 'number') cand.push({ k: h.k, v: ((h.bw || bwAt(h.k)) + v) * 1.167, src: 'test 5RM' }); }
  const dec = lv.rm && typeof lv.rm[lift] === 'number' ? lv.rm[lift] : null;
  if (dec != null) { const k = at['rm.' + lift] || '2000-01-01'; cand.push({ k, v: L.lest ? bwAt(todayKey()) + dec : dec, src: 'déclaré' }); }
  // estimation d'après les séances des 4 derniers mois : charge × (1 + (répétitions + réserve) / 30), Epley
  const from = addDays(todayKey(), -120);
  let est = null;
  for (const id of ids('j:')) {
    const k = id.slice(2); if (k < from || k > todayKey()) continue;
    const e = jget(k);
    for (const b of blocks(k)) for (const it of b.items || []) {
      const lid = it.lib || (libMatch(it.label) || {}).id; if (!L.libs.includes(lid)) continue;
      const key = itemKey(b, it), n = doneN(e, key, it.n); if (!n) continue;
      const reps = it.reps || (it.rx && it.rx.r ? it.rx.r[0] : null); if (!reps) continue;
      const rir = e.rir && typeof e.rir[key] === 'number' ? e.rir[key] : 2;
      const sl = setLoadsOf(e, key), ld = itemLoad(b, it, e), w = sl ? Math.max(...sl) : ld ? ld.v : null; if (w == null) continue;
      const tot = (it.unit_load === '+kg' || L.lest ? bwAt(k) : 0) + w, v = epley(tot, reps + Math.min(4, rir));
      if (!est || v > est.v) est = { k, v, src: 'estimé' };
    }
  }
  if (est) cand.push(est);
  const best = newest(cand); if (!best) return null;
  const bw = bwAt(todayKey());
  const r = Math.round(best.v * 2) / 2;
  const lest = L.lest ? Math.round((r - bw) * 2) / 2 : null;
  return { v: r, lest, lift, src: best.src, k: best.k, txt: L.lest ? (lest >= 0 ? '+' : '') + String(lest).replace('.', ',') + ' kg' : String(r).replace('.', ',') + ' kg' };
}
// Charge (kg ou lest) pour un % du 1RM, arrondie à 2,5 kg (1,25 au-dessous de 20 kg)
export function loadForPct(rm, pct) {
  if (!rm) return null;
  const bw = LIFTS[rm.lift].lest ? bodyWeightAt(todayKey()) || 0 : 0;
  const tot = rm.v * pct / 100, raw = tot - bw, s = Math.abs(raw) < 20 ? 1.25 : 2.5;
  return Math.round(raw / s) * s;
}

// Cotations d'escalade : déclarées, sinon estimées d'après les blocs notés en séance (max réussi sans chute)
export function climbLevel(o, cfgLv) {
  const lv = cfgLv || levelsDoc(o), out = {};
  for (const [k, disc] of CLIMB_KEYS) if (lv[k] && gradeIdx(lv[k], disc) != null) out[k] = { g: lv[k], src: 'déclaré' };
  if (!out.bf || !out.bm) {
    // meilleure cotation enchaînée sans chute sur 90 jours
    let top = null; const from = addDays(todayKey(), -90);
    for (const id of ids('j:')) {
      const k = id.slice(2); if (k < from) continue;
      const e = jget(k);
      for (const arr of Object.values(e.cl || {})) for (const x of arr || []) { const ix = gradeIdx(x.g, 'bloc'); if (!x.f && ix != null && (top == null || ix > top)) top = ix; }
    }
    if (top != null) { if (!out.bm) out.bm = { g: gradeAt(top, 'bloc'), src: 'estimé' }; if (!out.bf) out.bf = { g: gradeAt(top - 1, 'bloc'), src: 'estimé' }; }
  }
  return out;
}
export function vmaOf(o, cfgLv) {
  const lv = cfgLv || levelsDoc(o), cand = [];
  for (const h of history('vma')) if (h.vals && typeof h.vals.v === 'number') cand.push({ k: h.k, v: h.vals.v, src: 'test' });
  if (typeof lv.vma === 'number') cand.push({ k: (lv.at || {}).vma || '2000-01-01', v: lv.vma, src: 'déclarée' });
  return newest(cand);
}
export function fcmaxOf(o, cfgLv) {
  const lv = cfgLv || levelsDoc(o);
  if (typeof lv.fcmax === 'number') return { v: lv.fcmax, src: 'déclarée' };
  const p = profileOf(o == null ? getSubject() : o);
  if (p.birth_year) { const age = new Date().getFullYear() - p.birth_year; return { v: Math.round(208 - 0.7 * age), src: 'estimée (Tanaka)' }; }
  return null;
}
// Allure (min/km) à un % de la VMA
export function paceAt(vma, pct) { const kmh = vma * pct / 100; if (!(kmh > 0)) return null; const s = Math.round(3600 / kmh); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
export const srcTxt = r => r ? (r.src === 'déclaré' || r.src === 'déclarée' ? r.src : r.src + (r.k && r.k > '2000' ? ' le ' + fmtDay(r.k) : '')) : '';
