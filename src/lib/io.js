// Import / export des données (fichier JSON).
import { putMany, exportAll } from './store.js';

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
export function applyImport(docs) { putMany(docs); }

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
