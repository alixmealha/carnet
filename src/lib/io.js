// Import / export des données (fichier JSON).
import { putMany, exportAll, isSelf, getFor, getSubject, planLocked } from './store.js';
import { cloud } from './supa.js';

export async function readImport(file) {
  const txt = await file.text();
  let data;
  try { data = JSON.parse(txt); } catch (_) { throw new Error('Ce fichier n’est pas un fichier JSON lisible.'); }
  if (!data || data.app !== 'carnet' || !data.docs || typeof data.docs !== 'object') throw new Error('Ce fichier ne vient pas du Carnet.');
  const docs = {};
  for (const [id, v] of Object.entries(data.docs)) if (['plan', 'settings', 'profile', 'tests'].includes(id) || /^[pjct]:\d{4}-\d{2}-\d{2}$/.test(id)) docs[id] = v;
  const n = { plan: !!docs.plan, days: Object.keys(docs).filter(x => x.startsWith('p:')).length, journal: Object.keys(docs).filter(x => x.startsWith('j:')).length, tests: Object.keys(docs).filter(x => x.startsWith('t:')).length };
  return { docs, n };
}
// Ce que le carnet affiché accepte : le coach importe plan, séances, tests et échanges, et un historique de journal
// sans écraser ce que l'athlète a déjà rempli ; profil et réglages restent ceux du compte.
export function filterImport(docs) {
  const self = isSelf(), o = getSubject(), keep = {}, skipped = { journal: 0, plan: 0, other: 0 };
  for (const [id, v] of Object.entries(docs)) {
    if (id === 'profile' && cloud) { skipped.other++; continue; }
    if (!self && (id === 'profile' || id === 'settings')) { skipped.other++; continue; }
    if (!self && id.startsWith('j:') && getFor(o, id)) { skipped.journal++; continue; }
    if (self && planLocked() && (id === 'plan' || id.startsWith('p:'))) { skipped.plan++; continue; }
    keep[id] = v;
  }
  return { keep, skipped };
}
export function applyImport(docs) { const { keep } = filterImport(docs); putMany(keep); }

export async function downloadExport() {
  const data = exportAll();
  const name = 'carnet-' + new Date().toISOString().slice(0, 10) + '.json';
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Sauvegarde du Carnet' }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
