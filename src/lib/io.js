// Import / export des données (fichier JSON).
import { putMany, exportAll, isSelf, getFor, getSubject, planLocked, idsFor } from './store.js';
import { cloud } from './supa.js';
import { norm } from './library.js';
import { todayKey } from './dates.js';

/* ---------- Modification de programme (fichier « patch ») ----------
   Ajoute ou modifie des exercices dans les séances à venir, sans toucher au reste du plan ni au journal.
   { app: 'alipto', kind: 'patch', title, from?: 'AAAA-MM-JJ', to?: 'AAAA-MM-JJ', ops: [...] }
   ops :
   - { op: 'update', match: 'Libellé', set: {...} }                     modifie chaque exercice de ce nom
   - { op: 'insertAfter', match: 'Libellé', item: {...} }               insère un exercice juste après
   - { op: 'append', block: { has: 'Libellé' } | { kind: 'epaule' }, at?: 'start', onlyIfDay?: 'Libellé', item: {...} }
   Chaque op accepte aussi from / to pour se limiter à une période.
   Dans set / item, « {n} », « {reps} », « {id} », « {load} » valent ceux de l'exercice repéré (nombre si la valeur est seule).
   Rejouer le fichier ne duplique rien : un exercice dont l'identifiant existe déjà dans le bloc n'est pas ajouté. */
const MAX_OPS = 50;
function fill(v, ctx) {
  if (typeof v === 'string') {
    const m = /^\{(n|reps|id|load)\}$/.exec(v); if (m) return ctx[m[1]];
    return v.replace(/\{(n|reps|id|load)\}/g, (_, x) => ctx[x] == null ? '' : String(ctx[x]).replace('.', ','));
  }
  if (Array.isArray(v)) return v.map(x => fill(x, ctx));
  if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) { const y = fill(x, ctx); if (y !== undefined && y !== null && y !== '') o[k] = y; } return o; }
  return v;
}
const ITEM_KEYS = ['id', 'label', 'det', 'n', 'unit', 'rest', 'load', 'unit_load', 'reps', 'timer', 'lib', 'rx', 'superset', 'pairRest', 'hold', 'opt'];
function cleanItem(x) {
  const o = {}; for (const k of ITEM_KEYS) if (x[k] !== undefined) o[k] = x[k];
  o.n = Math.max(1, Math.min(50, parseInt(o.n, 10) || 1)); o.label = String(o.label || 'Exercice').slice(0, 120); o.id = String(o.id || 'x').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'x';
  if (!o.unit) o.unit = 'Série';
  return o;
}
function patchDay(day, ops, k) {
  const d = JSON.parse(JSON.stringify(day)), bl = d.blocks || [];
  ops = ops.filter(o => (!o.from || k >= o.from) && (!o.to || k <= o.to));
  const has = lbl => { const t = norm(lbl); for (const b of bl) for (const it of (b.items || [])) if (norm(it.label) === t) return it; return null; };
  for (const o of ops) {
    if (o.op === 'update') {
      const t = norm(o.match);
      for (const b of bl) for (const it of (b.items || [])) if (norm(it.label) === t) {
        const set = fill(o.set || {}, it);
        for (const [k, v] of Object.entries(set)) if (ITEM_KEYS.includes(k) && k !== 'id') it[k] = v;
        for (const k of (o.unset || [])) if (k !== 'id' && k !== 'label' && k !== 'n') delete it[k];
      }
    } else if (o.op === 'insertAfter') {
      const t = norm(o.match);
      for (const b of bl) { const its = b.items || []; const j = its.findIndex(it => norm(it.label) === t); if (j < 0) continue;
        const item = cleanItem(fill(o.item || {}, its[j])); if (its.some(x => x.id === item.id)) continue;
        its.splice(j + 1, 0, item); b.items = its; }
    } else if (o.op === 'append') {
      if (o.onlyIfDay && !has(o.onlyIfDay)) continue;
      const ctx = (o.onlyIfDay && has(o.onlyIfDay)) || {};
      const q = o.block || {};
      const b = bl.find(b => b.kind !== 'rest' && (q.kind ? b.kind === q.kind : true) && (q.has ? (b.items || []).some(it => norm(it.label) === norm(q.has)) : true));
      if (!b) continue;
      const its = b.items || [], item = cleanItem(fill(o.item || {}, ctx)); if (its.some(x => x.id === item.id)) continue;
      if (o.at === 'start') { const j = its[0] && its[0].id === 'ech' ? 1 : 0; its.splice(j, 0, item); } else its.push(item);
      b.items = its;
    }
  }
  return d;
}
// Calcule les séances modifiées pour le carnet affiché, à partir d'aujourd'hui (jamais le passé)
export function planPatch(data) {
  const ops = (data.ops || []).filter(o => o && ['update', 'insertAfter', 'append'].includes(o.op)).slice(0, MAX_OPS);
  if (!ops.length) throw new Error('Ce fichier de modification ne contient aucun changement.');
  const today = todayKey(), from = data.from && data.from > today ? data.from : today, to = data.to || '9999-12-31';
  const o = getSubject(), docs = {}, labels = new Set();
  for (const id of idsFor(o, 'p:').sort()) {
    const k = id.slice(2); if (k < from || k > to) continue;
    const day = getFor(o, id); if (!day || !day.blocks) continue;
    const nd = patchDay(day, ops, k);
    if (JSON.stringify(nd) !== JSON.stringify(day)) { docs[id] = nd; }
  }
  const keys = Object.keys(docs).map(x => x.slice(2));
  for (const op of ops) labels.add(op.item ? op.item.label : op.match);
  return { docs, n: { days: keys.length, first: keys[0] || null, last: keys[keys.length - 1] || null, from }, patch: { title: String(data.title || 'Modification du programme').slice(0, 140), what: [...labels].filter(Boolean).slice(0, 12) } };
}

export async function readImport(file) {
  const txt = await file.text();
  let data;
  try { data = JSON.parse(txt); } catch (_) { throw new Error('Ce fichier n’est pas un fichier JSON lisible.'); }
  if (data && ['carnet', 'alipto'].includes(data.app) && data.kind === 'patch') return planPatch(data);
  if (!data || !['carnet', 'alipto'].includes(data.app) || !data.docs || typeof data.docs !== 'object') throw new Error('Ce fichier ne vient pas d’Alipto.');
  const docs = {};
  for (const [id, v] of Object.entries(data.docs)) if (['plan', 'settings', 'profile', 'tests', 'nutri', 'models'].includes(id) || /^[pjctn]:\d{4}-\d{2}-\d{2}$/.test(id)) docs[id] = v;
  const n = { plan: !!docs.plan, days: Object.keys(docs).filter(x => x.startsWith('p:')).length, journal: Object.keys(docs).filter(x => x.startsWith('j:')).length, tests: Object.keys(docs).filter(x => x.startsWith('t:')).length };
  return { docs, n };
}
// Ce que le carnet affiché accepte : le coach importe plan, séances, tests et échanges, et un historique de journal
// sans écraser ce que l'athlète a déjà rempli ; profil et réglages restent ceux du compte.
export function filterImport(docs) {
  const self = isSelf(), o = getSubject(), keep = {}, skipped = { journal: 0, plan: 0, other: 0 };
  for (const [id, v] of Object.entries(docs)) {
    if (id === 'profile' && cloud) { skipped.other++; continue; }
    if (!self && (id === 'profile' || id === 'settings' || id === 'nutri' || id === 'models' || id.startsWith('n:'))) { skipped.other++; continue; }
    if (!self && id.startsWith('j:') && getFor(o, id)) { skipped.journal++; continue; }
    if (self && planLocked() && (id === 'plan' || id.startsWith('p:'))) { skipped.plan++; continue; }
    keep[id] = v;
  }
  return { keep, skipped };
}
export function applyImport(docs) { const { keep } = filterImport(docs); putMany(keep); }

export async function downloadExport() {
  const data = exportAll();
  const name = 'alipto-' + new Date().toISOString().slice(0, 10) + '.json';
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Sauvegarde Alipto' }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
