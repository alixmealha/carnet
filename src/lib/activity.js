// Type d'activité d'une journée : décide quelle notation proposer après la séance.
// - Escalade : profil spécificité / intensité / volume (méthode de Marie Akrich).
// - Muscu, renfo, doigts, épaule : exercices réalisés (séries × répétitions × charge).
// - Kiné : exercices réalisés + douleur pendant la séance (modèle de surveillance de la douleur).
// - Cardio : distance et fréquence cardiaque moyenne.
// Pour toutes : ressenti 0-10 × durée = charge de séance (Foster).
import { jget, ids } from './store.js';
import { blocks, itemKey, doneN, itemLoad, uid } from './plan.js';
import { climber } from './sports.js';

export const ACTS = [['grimpe', 'Escalade'], ['force', 'Muscu / renfo'], ['kine', 'Kiné'], ['cardio', 'Cardio'], ['sport', 'Autre sport'], ['mobi', 'Récup / mobilité']];
export const ACT_LBL = Object.fromEntries(ACTS);
export const KIND_ACT = { grimpe: 'grimpe', compet: 'grimpe', affut: 'grimpe', doigts: 'force', muscu: 'force', renfo: 'force', epaule: 'force', kine: 'kine', velo: 'cardio', course: 'cardio', sport: 'sport', recup: 'mobi', autre: 'mobi' };

// Compétition et affûtage : escalade pour un grimpeur, « autre sport » sinon
export const actOfKind = kind => (['compet', 'affut'].includes(kind) && !climber() ? 'sport' : KIND_ACT[kind]);
export function plannedActs(k) {
  const out = [];
  for (const b of blocks(k)) { const a = actOfKind(b.kind); if (a && !out.includes(a)) out.push(a); }
  return ACTS.map(x => x[0]).filter(a => out.includes(a));
}
// Activités du jour : celles cochées par l'athlète, sinon celles du plan
export function acts(k) { const e = jget(k); return Array.isArray(e.act) ? e.act : plannedActs(k); }
export const hasLog = list => list.includes('force') || list.includes('kine');

// Répétitions lues dans le détail d'un exercice : « 4 × 8 », « 3 × 30 s », « 8 rép. »…
export function repsOf(det) {
  const s = String(det || '');
  let m = s.match(/\d+\s*[×x]\s*(\d+(?:[.,]\d+)?\s*(?:s\b|sec|min|rép\.?|reps?)?(?:\s*\/\s*côté)?)/i);
  if (m) return m[1].trim();
  m = s.match(/(\d+(?:[.,]\d+)?\s*(?:rép\.?|reps?|s\b|sec|min)(?:\s*\/\s*côté)?)/i);
  return m ? m[1].trim() : '';
}

// Exercices prévus ce jour-là (muscu, renfo, doigts, épaule, kiné), pour préremplir « Ce que j'ai fait »
export function plannedLog(k) {
  const e = jget(k), out = [];
  for (const b of blocks(k)) {
    const a = KIND_ACT[b.kind]; if (a !== 'force' && a !== 'kine') continue;
    for (const it of b.items || []) {
      if (it.id === 'ech' || !it.label) continue;
      const key = itemKey(b, it), ld = itemLoad(b, it, e), dn = doneN(e, key, it.n);
      const rir = e.rir && typeof e.rir[key] === 'number' ? e.rir[key] : null;
      out.push(Object.assign({ id: uid('l'), label: it.label.replace(/\[[a-z]+\]\s*/gi, ''), sets: dn || it.n || null, reps: repsOf(it.det), load: ld ? ld.text : '', src: key }, rir != null ? { rir } : {}));
    }
  }
  return out;
}

// Noms d'exercices déjà utilisés (plan et journal) pour les suggestions de saisie
export function knownExercises() {
  const set = new Set(), clean = l => l.replace(/\[[a-z]+\]\s*/gi, '').trim();
  for (const id of ids('p:')) for (const b of blocks(id.slice(2))) {
    if (b.kind === 'rest') continue;
    for (const it of b.items || []) if (it.label && it.id !== 'ech') set.add(clean(it.label));
  }
  for (const id of ids('j:')) for (const x of jget(id.slice(2)).log || []) if (x.label) set.add(clean(x.label));
  return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b, 'fr'));
}

// Résumé court pour les fils d'activité
export function logSummary(e) {
  const p = [];
  if (Array.isArray(e.log) && e.log.length) p.push(e.log.length + ' exercice' + (e.log.length > 1 ? 's' : ''));
  if (typeof e.pain === 'number') p.push('douleur ' + e.pain + '/10');
  if (e.cardio && typeof e.cardio.km === 'number') p.push(String(e.cardio.km).replace('.', ',') + ' km');
  return p.join(' · ');
}
