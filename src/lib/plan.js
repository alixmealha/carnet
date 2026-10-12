import { get, jget, put, putMany, remove, ids } from './store.js';
import { rangeKeys, r05, fmtNum, fmtDay, addDays, mondayOf, todayKey } from './dates.js';
import { history } from './tests.js';

export const KIND = { grimpe: 'Escalade', doigts: 'Doigts', muscu: 'Muscu', renfo: 'Renfo', epaule: 'Épaule', kine: 'Kiné', velo: 'Cardio', test: 'Test', compet: 'Compétition', affut: 'Affûtage', recup: 'Récupération', autre: 'Autre', rest: 'Repos' };
export const KIND_ORDER = ['grimpe', 'doigts', 'muscu', 'renfo', 'epaule', 'kine', 'velo', 'test', 'compet', 'affut', 'recup', 'autre', 'rest'];

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
export function allItems(k) { const out = []; for (const b of blocks(k)) if (b.kind !== 'rest') for (const it of (b.items || [])) out.push({ b, it, key: itemKey(b, it) }); return out; }
export function doneN(e, key, n) { const v = e && e.done && e.done[key]; return typeof v === 'number' ? Math.min(n, Math.max(0, v)) : 0; }
export function progress(k) {
  const e = jget(k); let total = 0, done = 0;
  for (const { it, key } of allItems(k)) { total++; if (doneN(e, key, it.n) >= it.n) done++; }
  return { total, done };
}
export function phaseOf(w) { return w.phase || 'volume'; }
export const PHASE_LABEL = { volume: 'Volume', reprise: 'Reprise', force: 'Force', puissance: 'Puissance', specifique: 'Spécifique', affutage: 'Affûtage', recup: 'Récupération', deload: 'Décharge', transition: 'Transition', coupure: 'Coupure', autre: 'Cycle' };
export const PHASE_Z = { volume: 'z1', reprise: 'z1', force: 'z2', puissance: 'z3', specifique: 'z3', affutage: 'za', recup: 'zr', deload: 'zr', transition: 'zr', coupure: 'zr', autre: 'z2' };
export const weekLabel = w => w ? (w.label || 'S' + w.n) : '';
// Prochaine échéance : compétition à venir (events) ou objectif du plan
export function nextEvent(from) {
  const m = meta(); if (!m) return null; const t = from || todayKey();
  const ev = (m.events || []).filter(e => (e.end || e.date) >= t).sort((a, b) => a.date < b.date ? -1 : 1)[0];
  if (ev) return { date: ev.date, end: ev.end || ev.date, label: ev.label, lvl: ev.lvl };
  return m.goal && m.goal.date >= t ? { date: m.goal.date, end: m.goal.date, label: m.goal.label } : null;
}
export const eventOn = k => { const m = meta(); return m && (m.events || []).find(e => k >= e.date && k <= (e.end || e.date)) || null; };

// Dernier test de finger lift avant ce jour (module Tests, ou ancien format du journal)
export function latestTest(k) {
  let best = null;
  for (const [tid, key] of [['fl-semi', 'semi'], ['fl-tendu', 'tendu']]) {
    const h = history(tid).filter(x => x.k < k && typeof x.vals.v === 'number');
    if (h.length) { const x = h[h.length - 1]; if (!best || x.k > best.key) best = { te: {}, key: x.k }; }
  }
  if (best) { for (const [tid, key] of [['fl-semi', 'semi'], ['fl-tendu', 'tendu']]) { const x = history(tid).find(y => y.k === best.key); if (x) best.te[key] = x.vals.v; } return best; }
  const m = meta(); if (!m) return null;
  const ts = (m.tests || []).filter(t => t < k).sort();
  for (let i = ts.length - 1; i >= 0; i--) { const te = jget(ts[i]).tests; if (te && (te.semi || te.tendu)) return { te, key: ts[i] }; }
  return null;
}
// Tests prévus ce jour-là (blocs « test » qui listent des tests, ou anciens jours de test du plan)
export function testIdsOf(k) {
  const out = [];
  for (const b of blocks(k)) for (const t of (b.tests || [])) if (!out.includes(t)) out.push(t);
  const m = meta();
  if (!out.length && m && (m.tests || []).includes(k)) out.push('fl-semi', 'fl-tendu');
  return out;
}
export const isTestDay = k => testIdsOf(k).length > 0;

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
  const d = day(k); if (d && d.short) return d.short;
  const n = [];
  for (const b of blocks(k)) {
    if (b.kind === 'rest') continue;
    const s = b.kind === 'grimpe' ? b.title.replace('Escalade · ', 'Grimpe ') : b.kind === 'muscu' ? b.title.split(' · ')[0] : (KIND[b.kind] || b.title);
    if (!n.includes(s)) n.push(s);
  }
  return n.length ? n.join(', ') : 'Repos';
}

/* ---------- Modifier le plan ---------- */

export const KIND_LIST = KIND_ORDER;
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
