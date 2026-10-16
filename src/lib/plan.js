import { get, jget, jset, put, putMany, remove, ids, links, myProfile } from './store.js';
import { cloud } from './supa.js';
import { rangeKeys, r05, fmtNum, fmtDay, addDays, mondayOf, todayKey } from './dates.js';
import { history } from './tests.js';

export const KIND = { grimpe: 'Escalade', doigts: 'Doigts', muscu: 'Muscu', renfo: 'Renfo', epaule: 'Épaule', kine: 'Kiné', velo: 'Cardio', course: 'Course', sport: 'Sport', test: 'Test', compet: 'Compétition', affut: 'Affûtage', recup: 'Récupération', autre: 'Autre', rest: 'Repos' };
export const KIND_ORDER = ['grimpe', 'doigts', 'muscu', 'renfo', 'epaule', 'kine', 'velo', 'course', 'sport', 'test', 'compet', 'affut', 'recup', 'autre', 'rest'];

export const meta = () => get('plan');
export const day = k => get('p:' + k) || null;
export const rawBlocks = k => { const d = day(k); return d && d.blocks ? d.blocks : []; };
// Séance adaptée (moins de temps que prévu, ou allégée) : l'adaptation est gardée dans le journal du jour (adj)
// et appliquée ici, pour que la fiche, le mode séance et le suivi voient la même séance. Le plan n'est pas modifié :
// on revient à la séance prévue en retirant adj (et ça marche aussi quand le coach a verrouillé le plan).
const _adjCache = new Map();
export const blocks = k => {
  const bl = rawBlocks(k), a = jget(k).adj;
  if (!a || !a.items) return bl;
  const c = _adjCache.get(k); if (c && c.bl === bl && c.a === a) return c.out;
  const out = applyAdj(bl, a); _adjCache.set(k, { bl, a, out }); return out;
};
function adjItem(it, n, note) {
  const c = Object.assign({}, it, { adj: { n0: it.n, note: note || null } });
  if (n == null || n === it.n) return c;
  c.n = n;
  // « 20 blocs 6a » → « 12 blocs 6a »
  const lead = String(it.n) + ' ';
  if (typeof it.label === 'string' && it.label.startsWith(lead)) c.label = n + ' ' + it.label.slice(lead.length);
  if (it.timer) c.timer = Object.assign({}, it.timer, it.timer.markEach === 'rep' ? { reps: n } : it.timer.sets ? { sets: n } : {});
  if (Array.isArray(it.repsBySet)) c.repsBySet = it.repsBySet.slice(0, n);
  return c;
}
function applyAdj(bl, a) {
  const out = [];
  for (const b of bl) {
    const g = a.items['b:' + b.id];
    if (g && g.drop) continue;
    const items = [];
    for (const it of b.items || []) {
      const x = a.items[b.id + '.' + it.id];
      if (x && x.drop) continue;
      if (g && b.timer && it.id !== 'ech') { items.push(adjItem(it, g.n, null)); continue; }
      items.push(x ? adjItem(it, x.n, x.note) : it);
    }
    if ((b.items || []).length && !items.length) continue;
    const nb = Object.assign({}, b, { items });
    if (g && b.timer && g.n != null) nb.timer = Object.assign({}, b.timer, { sets: g.n });
    out.push(nb);
  }
  return out;
}
export const target = k => { const d = day(k); return d && d.target ? d.target : null; };
export const kinds = k => new Set(blocks(k).map(b => b.kind));
export const isRestDay = k => blocks(k).every(b => b.kind === 'rest');
export function weekOf(k) { const m = meta(); return m ? m.weeks.find(w => k >= w.start && k <= w.end) || null : null; }
export function allKeys() { const m = meta(); return m ? rangeKeys(m.start, m.end) : []; }
export function weekKeys(w) { return rangeKeys(w.start, w.end); }
export const itemKey = (b, it) => b.id + '.' + it.id;
export function allItems(k) { const out = []; for (const b of blocks(k)) if (b.kind !== 'rest') for (const it of (b.items || [])) out.push({ b, it, key: itemKey(b, it) }); return out; }
export function doneN(e, key, n) { const v = e && e.done && e.done[key]; return typeof v === 'number' ? Math.min(n, Math.max(0, v)) : 0; }
// Blocs (voies, essais) faits en plus du plan : compteur séparé, le « fait / prévu » reste plafonné au plan
export function plusN(e, key) { const v = e && e.plus && e.plus[key]; return typeof v === 'number' ? Math.max(0, Math.min(99, Math.floor(v))) : 0; }
export function setPlus(k, key, val) {
  const e = jget(k), plus = Object.assign({}, e.plus), v = Math.max(0, Math.min(99, Math.floor(val)));
  if (v > 0) plus[key] = v; else delete plus[key];
  jset(k, { plus: Object.keys(plus).length ? plus : null });
}
// Progression de la séance (ou d'un bloc fait à part si part = id du bloc).
// Les blocs faits à part ou déplacés sortent de la séance principale ; un bloc « pas fait » est compté à part (skipped).
export function progress(k, part) {
  const e = jget(k); let total = 0, done = 0, skipped = 0;
  for (const { b, it, key } of allItems(k)) {
    const st = blockState(e, b);
    if (part) { if (b.id !== part) continue; }
    else if (st === 'apart' || st === 'moved') continue;
    else if (st === 'skip') { skipped++; continue; }
    // un exercice facultatif ne compte que s'il a été commencé
    const v = doneN(e, key, it.n); if (it.opt && !v) continue; total++; if (v >= it.n) done++;
  }
  return { total, done, skipped };
}

/* ---------- Bloc sorti de la séance : à un autre moment du jour, un autre jour, ou pas fait ---------- */
export const SKIP = [['fatigue', 'Fatigue'], ['malade', 'Malade'], ['gene', 'Gêne ou douleur'], ['temps', 'Pas le temps'], ['materiel', 'Pas le matériel'], ['autre', 'Autre raison']];
export const skipLabel = v => (SKIP.find(x => x[0] === v) || SKIP[SKIP.length - 1])[1];
// Annuler toute la séance (ou l'arrêter là si elle est commencée), avec la raison et un mot : le coach les voit
export function cancelSession(k, r, note) {
  const e = jget(k), skip = Object.assign({}, e.skip), ids = [];
  for (const b of rawBlocks(k)) { if (b.kind === 'rest' || blockState(e, b)) continue; skip[b.id] = r; ids.push(b.id); }
  const started = progress(k).done > 0 || Object.values(e.done || {}).some(v => v > 0);
  const patch = { skip, status: started ? 'adaptee' : 'sautee', cancel: { r, note: note || null, at: Date.now(), ids, started } };
  if (note && !e.note) patch.note = note;
  jset(k, patch);
}
export function restoreSession(k) {
  const e = jget(k), c = e.cancel; if (!c) return;
  const skip = Object.assign({}, e.skip); for (const id of c.ids || []) if (skip[id] === c.r) delete skip[id];
  const patch = { skip: Object.keys(skip).length ? skip : null, cancel: null };
  if (e.status === (c.started ? 'adaptee' : 'sautee')) patch.status = null;
  if (c.note && e.note === c.note) patch.note = null;
  jset(k, patch);
}
export function blockState(e, b) {
  if (!e || !b) return null;
  if (e.apart && e.apart[b.id]) return 'apart';
  if (e.moved && e.moved[b.id]) return 'moved';
  if (e.skip && e.skip[b.id]) return 'skip';
  return null;
}
const without = (o, id) => { const x = Object.assign({}, o); delete x[id]; return Object.keys(x).length ? x : null; };
// state : null (retour dans la séance), 'apart', 'skip' (val = raison)
export function setBlockState(k, b, state, val) {
  const e = jget(k), patch = { apart: without(e.apart, b.id), skip: without(e.skip, b.id) };
  if (state === 'apart') patch.apart = Object.assign({}, e.apart, { [b.id]: Object.assign({ at: Date.now() }, e.apart && e.apart[b.id]) });
  if (state === 'skip') patch.skip = Object.assign({}, e.skip, { [b.id]: val || 'autre' });
  jset(k, patch);
}
export const apartOf = (e, bid) => (e && e.apart && e.apart[bid]) || null;
export function setApart(k, bid, patch) { const e = jget(k), cur = apartOf(e, bid); if (!cur) return; jset(k, { apart: Object.assign({}, e.apart, { [bid]: Object.assign({}, cur, patch) }) }); }
// Séances réelles du jour (pour la charge) : la principale et chaque bloc fait à part
export function sessionsOf(e) {
  const out = [];
  if (e && typeof e.rpe === 'number' && typeof e.duree === 'number' && e.duree > 0) out.push({ rpe: e.rpe, duree: e.duree });
  for (const p of Object.values((e && e.apart) || {})) if (p && typeof p.rpe === 'number' && typeof p.duree === 'number' && p.duree > 0) out.push({ rpe: p.rpe, duree: p.duree, apart: true });
  return out;
}
// Où se place le bloc fait à part par rapport à la séance : « fait 4 h avant la séance », « ordre changé »…
export function apartNote(k, b) {
  const e = jget(k), p = apartOf(e, b.id); if (!p || !p.startedAt) return null;
  const real = blocks(k).filter(x => x.kind !== 'rest'), i = real.findIndex(x => x.id === b.id);
  const others = real.map((x, j) => ({ x, j })).filter(o => o.x.id !== b.id && !blockState(e, o.x));
  if (!others.length) return null;
  const plannedBefore = others.every(o => o.j > i), plannedAfter = others.every(o => o.j < i);
  const hm = t => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const gap = ms => { const m = Math.round(ms / 60000); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 >= 10 ? ' ' + String(m % 60).padStart(2, '0') : ''); };
  const pEnd = p.endedAt || p.startedAt;
  if (!e.startedAt) return { text: 'Fait à ' + hm(p.startedAt) + ', avant la séance', changed: plannedAfter };
  if (pEnd <= e.startedAt) return { text: 'Fait ' + gap(e.startedAt - pEnd) + ' avant la séance', changed: plannedAfter };
  const mEnd = e.endedAt || e.startedAt;
  if (p.startedAt >= mEnd) return { text: 'Fait ' + gap(p.startedAt - mEnd) + ' après la séance', changed: plannedBefore };
  return { text: 'Fait à ' + hm(p.startedAt), changed: false };
}
// Déplacer un bloc à un autre jour : copie dans le plan de ce jour, trace dans le journal d'origine
export function moveBlock(k, b, to) {
  const src = day(k) || { blocks: [] }, dst = day(to) || { blocks: [] };
  const srcReal = src.blocks.filter(x => x.kind !== 'rest'), i = srcReal.findIndex(x => x.id === b.id);
  const taken = new Set((dst.blocks || []).map(x => x.id)), base = 'mv' + k.slice(5, 7) + k.slice(8, 10);
  let id = base, n = 2; while (taken.has(id)) id = base + '-' + n++;
  const copy = JSON.parse(JSON.stringify(b)); copy.id = id; copy.movedFrom = k; delete copy.heavy;
  const rest = (dst.blocks || []).filter(x => x.kind === 'rest'), real = (dst.blocks || []).filter(x => x.kind !== 'rest');
  const before = i === 0 && srcReal.length > 1;
  const nd = Object.assign({}, dst, { blocks: before ? [copy].concat(real) : real.concat([copy]) });
  if (rest.length && !real.length) nd.restBak = rest; // un jour de repos devient un jour avec ce bloc ; on garde le repos pour l'annulation
  put('p:' + to, nd);
  const e = jget(k);
  jset(k, { moved: Object.assign({}, e.moved, { [b.id]: { to, id } }), apart: without(e.apart, b.id), skip: without(e.skip, b.id) });
}
// Jours proposés pour déplacer une séance ou un bloc : à partir d'aujourd'hui, avant (jusqu'à 7 jours) et après le jour d'origine
export function moveTargets(k) {
  const t = todayKey(), out = [];
  if (k > t) for (let d = k > addDays(t, 7) ? addDays(k, -7) : t; d < k; d = addDays(d, 1)) out.push(d);
  const from = k < t ? t : addDays(k, 1);
  for (let i = 0; i < 7; i++) out.push(addDays(from, i));
  return out;
}
// Blocs propres à un jour (sans ceux déjà déplacés, faits à part ou pas faits) ; ceux venus d'un autre jour seulement s'il n'y a rien d'autre
export function ownBlocks(k) {
  const e = jget(k), all = rawBlocks(k).filter(b => b.kind !== 'rest' && !blockState(e, b));
  const own = all.filter(b => !b.movedFrom);
  return own.length ? own : all;
}
// Un bloc venu du jour « to » qui y retourne : on annule le déplacement plutôt que d'en faire une copie
function sendTo(k, b, to) {
  if (b.movedFrom === to) {
    const e = jget(to), orig = rawBlocks(to).find(x => e.moved && e.moved[x.id] && e.moved[x.id].id === b.id && e.moved[x.id].to === k);
    if (orig) { unmoveBlock(to, orig); return; }
  }
  moveBlock(k, b, to);
}
// Toute la séance d'un jour passe à un autre jour (avant ou après)
export function moveSession(k, to) { for (const b of ownBlocks(k)) sendTo(k, b, to); }
// Échanger les séances de deux jours
export function swapSessions(a, b) {
  const A = ownBlocks(a), B = ownBlocks(b);
  for (const x of A) sendTo(a, x, b);
  for (const y of B) sendTo(b, y, a);
}
export function unmoveBlock(k, b) {
  const e = jget(k), m = e.moved && e.moved[b.id]; if (!m) return;
  const dst = day(m.to);
  if (dst) {
    const de = jget(m.to), started = Object.keys(de.done || {}).some(x => x.startsWith(m.id + '.'));
    if (!started) {
      const bl = dst.blocks.filter(x => x.id !== m.id), nd = Object.assign({}, dst, { blocks: bl.length || !dst.restBak ? bl : dst.restBak });
      if (!bl.length) delete nd.restBak;
      put('p:' + m.to, nd);
    }
  }
  jset(k, { moved: without(e.moved, b.id) });
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
  return { v, u, changed: it.load != null && own != null && own !== it.load, chosen: it.load == null && own != null, text: (u === '+kg' && v >= 0 ? '+' : '') + fmtNum(v) + ' kg' };
}
// Charge de chaque série faite : si on baisse la charge en cours d'exercice, seules les séries suivantes changent
export function setLoadsOf(e, key) { const a = e && e.setLoads && e.setLoads[key]; return Array.isArray(a) && a.length ? a : null; }
export function setDoneCount(k, b, it, val) {
  const e = jget(k), key = itemKey(b, it), cur = doneN(e, key, it.n);
  val = Math.max(0, Math.min(it.n, val));
  const done = Object.assign({}, e.done); if (val > 0) done[key] = val; else delete done[key];
  const patch = { done }, ld = itemLoad(b, it, e);
  if (ld || setLoadsOf(e, key)) {
    const sl = Object.assign({}, e.setLoads), arr = (sl[key] || []).slice(0, Math.min(cur, val));
    for (let i = arr.length; i < val; i++) arr[i] = ld ? ld.v : arr[arr.length - 1];
    if (arr.length && arr.every(x => typeof x === 'number')) sl[key] = arr; else delete sl[key];
    patch.setLoads = Object.keys(sl).length ? sl : null;
  }
  jset(k, patch);
}
// « 17,5 kg × 6 · 15 kg × 1 » (séries consécutives à la même charge regroupées)
export function setsText(arr, u) {
  const g = []; for (const v of arr) { const l = g[g.length - 1]; if (l && l.v === v) l.n++; else g.push({ v, n: 1 }); }
  const f = v => ((u === '+kg' && v >= 0) ? '+' : '') + fmtNum(v) + ' kg';
  return g.length === 1 ? f(g[0].v) : g.map(x => f(x.v) + (x.n > 1 ? ' × ' + x.n : '')).join(' · ');
}
// Charge de travail d'un exercice fait : la plus fréquente (à égalité, la plus lourde)
export function workLoad(arr) {
  const c = new Map(); for (const v of arr) c.set(v, (c.get(v) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
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
// Trace de modification : qui a touché la séance ou le plan, et quand (affichée à l'athlète et au coach)
export const stamp = () => (cloud && links.me ? { uid: links.me, name: myProfile().name || '', at: Date.now() } : undefined);
// Vidéos de démo des exercices (lien Instagram, TikTok, YouTube…), gardées dans le plan par nom d'exercice
const dkey = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\[[a-z]+\]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const okUrl = u => /^https:\/\/[^\s]+\.[^\s]+$/i.test(String(u || '').trim());
export function demoOf(it) { const m = meta(), d = m && m.demos; if (!d || !it) return null; return d[dkey(it.label)] || (it.lib && d['lib:' + it.lib]) || null; }
export function setDemo(label, url, lib) {
  const m = meta(); if (!m) return;
  const demos = Object.assign({}, m.demos), k = dkey(label), u = String(url || '').trim();
  if (okUrl(u)) { demos[k] = u; if (lib) demos['lib:' + lib] = u; } else { delete demos[k]; if (lib) delete demos['lib:' + lib]; }
  savePlan(Object.assign({}, m, { demos }));
}
export function savePlan(m) {
  const ws = m.weeks.slice().sort((a, b) => a.start < b.start ? -1 : 1);
  put('plan', Object.assign({}, m, { weeks: ws, start: ws.length ? ws[0].start : m.start, end: ws.length ? ws[ws.length - 1].end : m.end, edited: stamp() }));
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
export function saveDay(k, d) { if (!d || ((!d.blocks || !d.blocks.length) && !d.target)) remove('p:' + k); else put('p:' + k, Object.assign({}, d, { edited: stamp() })); }
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
