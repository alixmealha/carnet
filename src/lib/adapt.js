// Adapter la séance du jour : moins de temps que prévu, ou forme basse (alléger).
// La séance prévue est estimée exercice par exercice (séries, travail, repos, minuteurs) ; avec moins de temps,
// on garde d'abord l'échauffement (raccourci) et les exercices principaux, puis les accessoires, puis la prévention.
// Les séries restent complètes : on en retire, on ne les raccourcit pas. Tout est gardé dans le journal (adj) et réversible.
import { jget, jset } from './store.js';
import { rawBlocks, itemKey, doneN, blockState } from './plan.js';
import { warmupFor } from './warmup.js';

const MAIN_KINDS = ['grimpe', 'doigts', 'muscu', 'velo', 'course', 'compet', 'test', 'sport'];
const STRENGTH = ['muscu', 'renfo', 'epaule'];
// « 30–40 min », « 10 à 15 min », « 45 min » → minutes (milieu de la fourchette)
export function minsOf(s) {
  const str = String(s || ''), h = str.match(/(\d+)\s*h\s*(\d{2})?(?![a-zà-ÿ])/i);
  const m = str.match(/(\d+(?:[.,]\d+)?)\s*(?:(?:à|-|–)\s*(\d+(?:[.,]\d+)?)\s*)?min/);
  if (!m) return h ? +h[1] * 60 + (h[2] ? +h[2] : 0) : null;
  const a = parseFloat(m[1].replace(',', '.')), b = m[2] ? parseFloat(m[2].replace(',', '.')) : null;
  return b ? (a + b) / 2 : a;
}
const DEFAULT_MIN = { kine: 30, recup: 20, velo: 40, course: 40, sport: 60, compet: 60 };

// Coût en secondes d'un exercice pour n séries (ou blocs, essais, répétitions selon le minuteur)
function costFn(b, it) {
  const T = it.timer, u = it.unit;
  const perMin = it.n > 1 ? minsOf(it.label) : null; // « 3 × 12 min »
  if (T && T.kind === 'interval') {
    const prep = T.prep || 10, sides = (T.sides && T.sides.length) || 1;
    if (T.markEach === 'rep') return n => prep + n * (T.work + T.rest) - T.rest;
    return n => prep + n * ((T.reps || 1) * (T.work + T.rest) - T.rest) * sides + Math.max(0, n - 1) * (T.setRest || 0);
  }
  if (T && T.kind === 'cluster') return n => n * (T.reps * 5 + (T.reps - 1) * (T.intra || 20)) + Math.max(0, n - 1) * (T.setRest || 180);
  if (T && T.kind === 'contrast') return n => n * (30 + (T.heavyRest || 240) + 15) + Math.max(0, n - 1) * (T.lightRest || 180);
  if (T && T.kind === 'tempo') { const sides = T.sides && T.sides.length > 1 ? 2 : 1; return n => n * ((T.prep != null ? T.prep : 5) + (T.reps || it.reps || 8) * ((T.ecc || 6) + (T.ret != null ? T.ret : 4)) * sides) + Math.max(0, n - 1) * (T.setRest || it.rest || 60); }
  const work = perMin ? perMin * 60 : u === 'Bloc' ? 60 : u === 'Voie' ? 240 : u === 'Essai' ? 30 : it.reps ? it.reps * 3 + 10 : 40;
  const rest = it.rest != null ? it.rest : u === 'Bloc' ? 90 : u === 'Voie' ? 300 : u === 'Essai' ? 180 : STRENGTH.includes(b.kind) ? 120 : 60;
  return n => n * work + Math.max(0, n - 1) * rest;
}
// Séance faite d'un bloc à minuteur (finger lift, épaule en circuit…) : un seul ensemble de séries pour tous ses exercices
function groupCost(b) { const T = b.timer, sides = (T.sides && T.sides.length) || 1; return n => (T.prep || 10) + n * ((T.reps || 1) * (T.work + T.rest) - T.rest) * sides + Math.max(0, n - 1) * (T.setRest || 0); }

// Priorité : 0 échauffement, 1 principal (et rééducation), 2 accessoire, 3 prévention et compléments, 4 retour au calme, facultatif
function prioOf(b, it, idx) {
  if (it.id === 'ech') return 0;
  if (it.id === 'rac' || it.opt) return 4;
  if (it.extra) return 3;
  if (b.kind === 'kine' || b.kind === 'test') return 1;
  const r = it.rx && it.rx.role;
  if (r === 'main' || r === 'puiss') return 1;
  if (r === 'acc') return 2;
  if (r === 'prev') return 3;
  if (['epaule', 'renfo', 'recup'].includes(b.kind)) return 3;
  if (!MAIN_KINDS.includes(b.kind)) return 2;
  if (['Bloc', 'Voie', 'Essai'].includes(it.unit) || b.kind === 'doigts') return 1;
  if (b.kind === 'muscu') return (it.reps && it.reps <= 6) || it.n >= 5 || idx === 0 ? 1 : 2;
  return idx === 0 ? 1 : 2;
}
// Minimum gardé avant de retirer l'exercice
function minOf(it, prio, done) {
  const n = it.n;
  let m = ['Bloc', 'Voie'].includes(it.unit) ? Math.ceil(n * 0.3) : it.timer && it.timer.markEach === 'rep' ? Math.ceil(n * 0.5) : prio === 1 ? Math.min(n, 2) : n >= 3 ? 2 : 1;
  return Math.max(m, done || 0, 1);
}

// Ce qui compose la séance (blocs de la séance principale, pas ceux faits à part, déplacés ou pas faits)
export function unitsOf(k) {
  const e = jget(k), out = [];
  let warmed = false;
  for (const b of rawBlocks(k)) {
    // la séance de kiné se fait le plus souvent à part (au cabinet) : elle ne compte pas dans le temps de la séance
    if (b.kind === 'rest' || b.kind === 'kine' || blockState(e, b)) continue;
    const its = b.items || [];
    if (b.timer && its.some(it => it.id !== 'ech')) {
      const ech = its.find(it => it.id === 'ech'); if (ech) { out.push(warmUnit(k, b, ech, warmed)); warmed = true; }
      const g = its.filter(it => it.id !== 'ech'), n0 = b.timer.sets || 1, done = Math.min(...g.map(it => doneN(e, itemKey(b, it), it.n)));
      out.push({ key: 'b:' + b.id, b, label: (b.timer && b.timer.name) || b.title, prio: b.kind === 'doigts' ? 1 : prioOf(b, g[0], 0), n0, min: Math.max(1, done), done0: done, started: done > 0, cost: groupCost(b), order: out.length });
      continue;
    }
    its.forEach((it, i) => {
      if (it.id === 'ech') { out.push(warmUnit(k, b, it, warmed)); warmed = true; return; }
      const prio = prioOf(b, it, its.filter(x => x.id !== 'ech').indexOf(it)), done = doneN(e, itemKey(b, it), it.n);
      if (it.n === 1 && !it.timer) {
        // exercice d'un seul tenant : une durée (« Vélo Z2 · 30–40 min »), raccourcissable s'il s'agit d'endurance
        const m0 = minsOf(it.label) || minsOf(it.det) || DEFAULT_MIN[b.kind] || 10;
        const elastic = ['velo', 'course', 'recup'].includes(b.kind) || (b.kind === 'grimpe' && (minsOf(it.label) || /continuit|travers|volume/i.test(it.label + ' ' + (it.det || ''))));
        out.push({ key: itemKey(b, it), b, it, label: it.label, prio, mins: m0, minMins: elastic ? Math.min(m0, Math.max(15, Math.round(m0 / 3))) : m0, done: done > 0, order: out.length });
        return;
      }
      out.push({ key: itemKey(b, it), b, it, label: it.label, prio, n0: it.n, min: minOf(it, prio, done), done0: done, started: done > 0, cost: costFn(b, it), order: out.length });
    });
  }
  return out;
}
// second échauffement de la séance (deuxième bloc) : le corps est déjà chaud, une remise en route suffit
function warmUnit(k, b, it, again) {
  const w = warmupFor(k, b), m0 = (w && w.min) || minsOf(it.det) || 10;
  return { key: itemKey(b, it), b, it, label: again ? 'Remise en route' : 'Échauffement', prio: 0, mins: m0, minMins: Math.min(m0, again ? 4 : 6), again, warm: true, order: 0 };
}
const secOf = (u, n, m) => u.mins != null ? (m != null ? m : u.mins) * 60 : u.cost(n != null ? n : u.n0);
export const plannedMin = units => Math.round(units.reduce((a, u) => a + secOf(u), 0) / 60);

// Plus de temps disponible : propose la séance qui tient dans « minutes »
export function fitToTime(k, minutes) {
  const units = unitsOf(k), budget = minutes * 60, res = new Map();
  let left = budget;
  // 1. échauffements : raccourcis jusqu'à ~18 % du temps disponible, jamais sous leur minimum
  for (const u of units.filter(x => x.warm)) {
    const m = u.again ? u.minMins : Math.max(u.minMins, Math.min(u.mins, Math.round(minutes * 0.18)));
    res.set(u.key, { m }); left -= m * 60;
  }
  const rest = units.filter(x => !x.warm).sort((a, b) => a.prio - b.prio || a.order - b.order);
  // 2. principaux : tous gardés ; s'ils ne tiennent pas, on retire des séries à chacun, dans la même proportion
  const p1 = rest.filter(x => x.prio <= 1);
  const full1 = p1.reduce((a, u) => a + secOf(u), 0);
  if (full1 <= left) { p1.forEach(u => res.set(u.key, u.mins != null ? { m: u.mins } : { n: u.n0 })); left -= full1; }
  else {
    let pick = null;
    for (let f = 0.95; f >= 0; f -= 0.05) {
      const t = p1.map(u => u.mins != null ? { u, m: Math.max(u.minMins, Math.round(u.mins * f)) } : { u, n: Math.max(u.min, Math.round(u.n0 * f)) });
      const s = t.reduce((a, x) => a + secOf(x.u, x.n, x.m), 0);
      pick = { t, s }; if (s <= left) break;
    }
    // même au minimum ça ne tient pas : on retire les derniers principaux
    const t = pick.t.slice();
    let s = pick.s;
    while (s > left && t.length > 1) { const x = t.pop(); s -= secOf(x.u, x.n, x.m); res.set(x.u.key, { drop: true }); }
    left -= s;
    // le temps qui reste (arrondis) revient d'abord aux principaux, une série à la fois
    for (let grew = true; grew;) {
      grew = false;
      for (const x of t) {
        if (x.m != null) { const m2 = Math.min(x.u.mins, x.m + 5); if (m2 > x.m && (m2 - x.m) * 60 <= left) { left -= (m2 - x.m) * 60; x.m = m2; grew = true; } continue; }
        if (x.n < x.u.n0) { const d = x.u.cost(x.n + 1) - x.u.cost(x.n); if (d <= left) { left -= d; x.n++; grew = true; } }
      }
    }
    t.forEach(x => res.set(x.u.key, x.m != null ? { m: x.m } : { n: x.n }));
  }
  // 3. le reste dans l'ordre de priorité : complet si ça tient, sinon moins de séries, sinon retiré
  for (const u of rest.filter(x => x.prio > 1)) {
    if (u.mins != null) {
      if (u.mins * 60 <= left) { res.set(u.key, { m: u.mins }); left -= u.mins * 60; }
      else if (u.minMins < u.mins && Math.floor(left / 60) >= u.minMins) { const m = Math.floor(left / 60 / 5) * 5 || Math.floor(left / 60); res.set(u.key, { m }); left -= m * 60; }
      else res.set(u.key, u.done ? { m: u.mins } : { drop: true });
      continue;
    }
    let n = u.n0; while (n > u.min && u.cost(n) > left) n--;
    if (u.cost(n) <= left) { res.set(u.key, { n }); left -= u.cost(n); }
    else if (u.started) { res.set(u.key, { n: u.min }); left -= u.cost(u.min); } // déjà commencé : on garde ce qui est fait
    else res.set(u.key, { drop: true });
  }
  return result(k, units, res, 'time', { min: minutes });
}

// Forme basse : un tiers de séries en moins (fatigué) ou la moitié (version décharge), mêmes exercices
export function lighten(k, frac) {
  const units = unitsOf(k), res = new Map();
  for (const u of units) {
    if (u.warm) { res.set(u.key, { m: u.mins }); continue; }
    if (u.mins != null) { res.set(u.key, { m: u.minMins < u.mins ? Math.max(u.minMins, Math.round(u.mins * (1 - frac) / 5) * 5) : u.mins }); continue; }
    res.set(u.key, { n: Math.max(1, u.done0 || 0, Math.round(u.n0 * (1 - frac))) });
  }
  return result(k, units, res, 'light', { frac });
}

function result(k, units, res, mode, extra) {
  const rows = units.map(u => {
    const r = res.get(u.key) || {};
    if (r.drop) return { u, act: 'drop', sec: 0 };
    if (u.mins != null) { const m = r.m != null ? r.m : u.mins; return { u, act: m < u.mins ? 'short' : 'full', m, sec: m * 60 }; }
    const n = r.n != null ? r.n : u.n0; return { u, act: n < u.n0 ? 'reduce' : 'full', n, sec: u.cost(n) };
  });
  const base = plannedMin(units), total = Math.round(rows.reduce((a, x) => a + x.sec, 0) / 60);
  return Object.assign({ k, mode, base, total, rows }, extra);
}

const fmtM = m => Math.round(m) + ' min';
// Enregistre l'adaptation dans le journal du jour
export function applyAdjust(r) {
  const items = {};
  for (const x of r.rows) {
    if (x.act === 'full') continue;
    if (x.act === 'drop') { items[x.u.key] = { drop: true }; continue; }
    if (x.act === 'reduce') { items[x.u.key] = { n: x.n }; continue; }
    if (x.act === 'short') items[x.u.key] = { note: (x.u.warm ? 'Raccourci à ' : '') + fmtM(x.m) + (x.u.warm ? '' : ' au lieu de ' + fmtM(x.u.mins)) };
  }
  jset(r.k, { adj: { mode: r.mode, min: r.min || null, frac: r.frac || null, base: r.base, total: r.total, at: Date.now(), items } });
}
export function clearAdjust(k) { jset(k, { adj: null }); }
// Résumé d'une adaptation pour la fiche du jour
export function adjSummary(k) {
  const a = jget(k).adj; if (!a || !a.items) return null;
  const raw = rawBlocks(k), name = key => {
    if (key.startsWith('b:')) { const b = raw.find(x => x.id === key.slice(2)); return b ? ((b.timer && b.timer.name) || b.title) : null; }
    const [bid, iid] = key.split('.'), b = raw.find(x => x.id === bid), it = b && (b.items || []).find(x => x.id === iid); return it ? it.label : null;
  };
  const dropped = Object.entries(a.items).filter(([, v]) => v.drop).map(([key]) => name(key)).filter(Boolean);
  const reduced = Object.entries(a.items).filter(([, v]) => v.n != null).length;
  const head = a.mode === 'time' ? 'Séance adaptée à ' + a.min + ' min' + (a.base ? ' (prévue ≈ ' + a.base + ' min)' : '')
    : a.frac >= 0.5 ? 'Version décharge : moitié des séries' : 'Séance allégée : un tiers de séries en moins';
  const tip = a.mode === 'light' ? (a.frac >= 0.5 ? 'Rien au maximum : garde 2 à 3 répétitions en réserve, cotations un cran en dessous.' : 'Pas de nouveau palier de charge aujourd’hui.') : null;
  return { head, dropped, reduced, tip, mode: a.mode };
}
