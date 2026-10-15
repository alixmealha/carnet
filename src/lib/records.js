// Records : charge la plus lourde par exercice (muscu, finger lift, épaule) et cotation la plus dure enchaînée sans chute.
// Un record compte à partir de la deuxième séance de l'exercice (la première sert de référence).
import { ids, jget } from './store.js';
import { blocks, itemKey, doneN, itemLoad, setLoadsOf } from './plan.js';
import { gradeIdx, gradeAt } from './grades.js';
import { todayKey, addDays, fmtNum } from './dates.js';

const STRONG = ['muscu', 'doigts', 'epaule', 'renfo'];
const discOf = it => it.disc || (it.unit === 'Voie' ? 'voie' : 'bloc');
const exName = (b, it) => b.kind === 'doigts' && /main (droite|gauche)/i.test(it.label) ? 'Finger lift · ' + it.label.toLowerCase() : it.label;
const kgTxt = (v, u) => (u === '+kg' && v >= 0 ? '+' : '') + fmtNum(v) + ' kg';

// Ce qui a été fait chaque jour : meilleure charge par exercice, cotations enchaînées sans chute
function daily() {
  const out = [];
  for (const k of ids('j:').map(id => id.slice(2)).sort()) {
    if (k > todayKey()) continue;
    const e = jget(k), loads = new Map(), grades = [];
    for (const b of blocks(k)) {
      if (b.kind === 'rest') continue;
      for (const it of b.items || []) {
        const key = itemKey(b, it), n = doneN(e, key, it.n); if (!n || it.id === 'ech') continue;
        if (STRONG.includes(b.kind)) {
          const sl = setLoadsOf(e, key), ld = itemLoad(b, it, e); if (!sl && !ld) continue;
          const v = sl ? Math.max(...sl) : ld.v, name = exName(b, it), cur = loads.get(name);
          if (!cur || v > cur.v) loads.set(name, { name, v, u: (ld && ld.u) || it.unit_load || 'kg', reps: it.reps || null });
        }
        for (const x of (e.cl || {})[key] || []) if (x && x.g && !x.f) { const disc = discOf(it), i = gradeIdx(x.g, disc); if (i != null) grades.push({ disc, i }); }
      }
    }
    if (loads.size || grades.length) out.push({ k, loads: [...loads.values()], grades });
  }
  return out;
}

// Tous les records, dans l'ordre chronologique
export function allRecords() {
  const best = new Map(), bestG = {}, out = [];
  for (const d of daily()) {
    for (const l of d.loads) {
      const b = best.get(l.name);
      if (b && l.v > b.v) out.push({ k: d.k, kind: 'load', name: l.name, txt: l.name + ' ' + kgTxt(l.v, l.u) + (l.reps ? ' × ' + l.reps : ''), prev: kgTxt(b.v, b.u), prevK: b.k });
      if (!b || l.v > b.v) best.set(l.name, { v: l.v, u: l.u, k: d.k, reps: l.reps });
    }
    for (const disc of ['bloc', 'voie']) {
      const gs = d.grades.filter(x => x.disc === disc); if (!gs.length) continue;
      const top = Math.max(...gs.map(x => x.i)), b = bestG[disc];
      if (b && top > b.i) out.push({ k: d.k, kind: 'grade', name: disc === 'bloc' ? 'Bloc' : 'Voie', txt: (disc === 'bloc' ? 'Premier bloc en ' : 'Première voie en ') + gradeAt(top, disc), prev: gradeAt(b.i, disc), prevK: b.k });
      if (!b || top > b.i) bestG[disc] = { i: top, k: d.k };
    }
  }
  return { list: out, best: [...best.entries()].map(([name, b]) => Object.assign({ name }, b)), grades: Object.entries(bestG).map(([disc, b]) => ({ disc, g: gradeAt(b.i, disc), k: b.k })) };
}
export const recordsOn = k => allRecords().list.filter(x => x.k === k);
export function recentRecords(days) { const from = addDays(todayKey(), -(days || 30)); return allRecords().list.filter(x => x.k >= from).reverse(); }
