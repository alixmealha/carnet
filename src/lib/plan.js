import { get, jget, put, putMany, remove, ids } from './store.js';
import { rangeKeys, r05, fmtNum, fmtDay, addDays, mondayOf, todayKey } from './dates.js';

export const KIND = { grimpe: 'Escalade', doigts: 'Finger lift', muscu: 'Muscu', kine: 'Kiné genou', epaule: 'Épaule', velo: 'Vélo', test: 'Test doigts', rest: 'Repos', autre: 'Autre' };
export const KIND_ORDER = ['grimpe', 'doigts', 'muscu', 'epaule', 'kine', 'velo', 'test', 'autre', 'rest'];

export const meta = () => get('plan');
export const day = k => get('p:' + k) || null;
export const blocks = k => { const d = day(k); return d && d.blocks ? d.blocks : []; };
export const target = k => { const d = day(k); return d && d.target ? d.target : null; };
export const kinds = k => new Set(blocks(k).map(b => b.kind));
export const isRestDay = k => blocks(k).every(b => b.kind === 'rest');
export function weekOf(k) { const m = meta(); return m ? m.weeks.find(w => k >= w.start && k <= w.end) || null : null; }
export function allKeys() { const m = meta(); return m ? rangeKeys(m.start, m.end) : []; }
export function weekKeys(w) { return rangeKeys(w.start, w.end); }
export const itemKey = (b, it) => b.id + '.' + it.id;
export function allItems(k) { const out = []; for (const b of blocks(k)) for (const it of (b.items || [])) out.push({ b, it, key: itemKey(b, it) }); return out; }
export function doneN(e, key, n) { const v = e && e.done && e.done[key]; return typeof v === 'number' ? Math.min(n, Math.max(0, v)) : 0; }
export function progress(k) {
  const e = jget(k); let total = 0, done = 0;
  for (const { it, key } of allItems(k)) { total++; if (doneN(e, key, it.n) >= it.n) done++; }
  return { total, done };
}
export function phaseOf(w) { return w.phase || 'volume'; }
export const PHASE_LABEL = { volume: 'Volume', force: 'Force', puissance: 'Puissance', deload: 'Décharge', transition: 'Transition', autre: 'Cycle' };
export const PHASE_Z = { volume: 'z1', force: 'z2', puissance: 'z3', deload: 'zr', transition: 'zr', autre: 'z2' };

export function latestTest(k) {
  const m = meta(); if (!m) return null;
  const ts = (m.tests || []).filter(t => t < k).sort();
  for (let i = ts.length - 1; i >= 0; i--) { const te = jget(ts[i]).tests; if (te && (te.semi || te.tendu)) return { te, key: ts[i] }; }
  return null;
}
export function isTestDay(k) { const m = meta(); return !!(m && (m.tests || []).includes(k)); }

// Charge affichée d'un exercice (prévue, ou modifiée dans le journal du jour)
export function itemLoad(b, it, e) {
  const key = itemKey(b, it), own = e && e.loads && typeof e.loads[key] === 'number' ? e.loads[key] : null;
  if (it.load == null && own == null) return null;
  const v = own != null ? own : it.load, u = it.unit_load || 'kg';
  return { v, u, changed: own != null && own !== it.load, text: (u === '+kg' ? '+' : '') + fmtNum(v) + ' kg' };
}
// Finger lift en % du test : charges calculées
export function fingerCalc(b, k) {
  const f = b.finger; if (!f) return null;
  if (f.unit === 'kg') return { text: fmtNum(f.load) + ' kg' };
  const lt = latestTest(k);
  if (!lt) return { text: f.load + ' % de ton max', hint: 'Note ton test dans la fiche du jour du test pour voir les kilos ici.' };
  const parts = [];
  if (lt.te.semi) parts.push('semi-arqué ' + fmtNum(r05(lt.te.semi * f.load / 100)) + ' kg');
  if (lt.te.tendu) parts.push('tendu ' + fmtNum(r05(lt.te.tendu * f.load / 100)) + ' kg');
  let guard = null;
  if (f.guardRef) {
    const g = [];
    for (const [kk, l] of [['semi', 'semi-arqué'], ['tendu', 'tendu']]) { const mx = lt.te[kk]; if (mx && mx * 0.6 > f.guardRef * 1.3) g.push(l + ' ' + fmtNum(r05((f.guardRef + mx * 0.6) / 2)) + ' kg'); }
    if (g.length) guard = 'Garde-fou : 60 % dépasse ta charge de S6 de plus de 30 %. Cette semaine, mi-chemin : ' + g.join(' · ') + '.';
  }
  return { text: f.load + ' % · ' + parts.join(' · '), hint: 'D’après ton test du ' + fmtDay(lt.key), guard };
}

export function sessionName(k) {
  const n = [];
  for (const b of blocks(k)) {
    if (b.kind === 'rest') continue;
    const s = b.kind === 'grimpe' ? b.title.replace('Escalade · ', 'Grimpe ') : b.kind === 'muscu' ? b.title.split(' · ')[0] : (KIND[b.kind] || b.title);
    if (!n.includes(s)) n.push(s);
  }
  return n.length ? n.join(', ') : 'Repos';
}

/* ---------- Modifier le plan ---------- */

export const KIND_LIST = ['grimpe', 'doigts', 'muscu', 'epaule', 'kine', 'velo', 'test', 'autre', 'rest'];
export const clone = x => JSON.parse(JSON.stringify(x));
export const uid = p => (p || 'x') + Math.random().toString(36).slice(2, 7);

export function newPlan() {
  const start = mondayOf(todayKey());
  const weeks = [];
  for (let i = 0; i < 12; i++) weeks.push({ id: uid('w'), n: i + 1, start: addDays(start, i * 7), end: addDays(start, i * 7 + 6), bloc: 'Cycle 1', phase: 'autre' });
  put('plan', { v: 1, title: 'Mon plan', goal: null, start, end: weeks[weeks.length - 1].end, tests: [], weeks, blocs: [], sections: [] });
}
export function savePlan(m) {
  const ws = m.weeks.slice().sort((a, b) => a.start < b.start ? -1 : 1);
  put('plan', Object.assign({}, m, { weeks: ws, start: ws.length ? ws[0].start : m.start, end: ws.length ? ws[ws.length - 1].end : m.end }));
}
export function addWeeks(n, phase, bloc) {
  const m = clone(meta()); const last = m.weeks[m.weeks.length - 1];
  let s = last ? addDays(last.end, 1) : mondayOf(todayKey()), num = last ? last.n + 1 : 1;
  for (let i = 0; i < n; i++) { const st = s; const en = addDays(mondayOf(st), 6); m.weeks.push({ id: uid('w'), n: num++, start: st, end: en, bloc, phase }); s = addDays(en, 1); }
  savePlan(m);
}
export function removeLastWeek() {
  const m = clone(meta()); const w = m.weeks.pop(); if (!w) return;
  for (const k of weekKeys(w)) { if (day(k)) remove('p:' + k); }
  savePlan(m);
}
export function setWeek(id, patch) { const m = clone(meta()); const w = m.weeks.find(x => x.id === id); Object.assign(w, patch); savePlan(m); }
export function saveDay(k, d) { if (!d || ((!d.blocks || !d.blocks.length) && !d.target)) remove('p:' + k); else put('p:' + k, d); }
export function copyDay(from, to) { const d = day(from); saveDay(to, d ? clone(d) : null); }
export function copyWeek(wFrom, wTo) {
  const a = weekKeys(wFrom), b = weekKeys(wTo);
  for (const k of b) { const src = a.find(x => dowOf(x) === dowOf(k)); copyDay(src || null, k); }
}
const dowOf = k => (new Date(k + 'T12:00:00Z').getUTCDay() + 6) % 7;

// Liste des exercices (libellés) présents dans le plan
export function exerciseNames() {
  const map = new Map();
  for (const id of ids('p:')) {
    const d = day(id.slice(2)); if (!d) continue;
    for (const b of d.blocks || []) for (const it of b.items || []) {
      if (it.id === 'ech' || b.kind === 'kine' || b.kind === 'rest') continue;
      const x = map.get(it.label) || { label: it.label, n: 0, kinds: new Set(), first: id.slice(2), last: id.slice(2) };
      x.n++; x.kinds.add(b.kind); x.last = id.slice(2); map.set(it.label, x);
    }
  }
  return [...map.values()].sort((a, b) => b.n - a.n);
}
export function renameExercise(from, to, onlyFuture) {
  const t = todayKey(), out = {}; let n = 0;
  for (const id of ids('p:')) {
    const k = id.slice(2); if (onlyFuture && k < t) continue;
    const d = day(k); if (!d) continue;
    let ch = false; const c = clone(d);
    for (const b of c.blocks || []) for (const it of b.items || []) if (it.label === from) { it.label = to; ch = true; n++; }
    if (ch) out[id] = c;
  }
  if (n) putMany(out);
  return n;
}
