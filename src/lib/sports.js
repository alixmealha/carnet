// Sports pratiqués et régime alimentaire : saisis dans le profil, ils adaptent l'appli
// (activités proposées, types de séance, tests, bibliothèque d'exercices, dépense énergétique).
import { profileOf, getSubject, getFor, SELF } from './store.js';

export const SPORTS = [
  ['escalade', 'Escalade'], ['muscu', 'Musculation'], ['course', 'Course à pied'], ['trail', 'Trail / montagne'],
  ['velo', 'Vélo'], ['natation', 'Natation'], ['hyrox', 'Hyrox / cross-training'], ['collectif', 'Sport collectif'],
  ['combat', 'Sport de combat'], ['autre', 'Autre sport']
];
export const SPORT_LBL = Object.fromEntries(SPORTS);
export const DIETS = [['omni', 'Omnivore'], ['vege', 'Végétarien'], ['vegan', 'Végan']];
export const DIET_LBL = Object.fromEntries(DIETS);

// Familles utiles ailleurs
export const CARDIO_SPORTS = ['course', 'trail', 'velo', 'natation'];
const SPORTISH = ['collectif', 'combat', 'autre'];

// Sports du profil affiché (null si pas encore renseigné : tout reste proposé)
export function sportsOf(o) { const s = profileOf(o == null ? getSubject() : o).sports; return Array.isArray(s) && s.length ? s : null; }
export const mySportsAsked = () => Array.isArray((getFor(SELF, 'profile') || {}).sports);
export const climber = o => { const s = sportsOf(o); return !s || s.includes('escalade'); };
export const hasCardio = o => { const s = sportsOf(o); return !s || s.some(x => CARDIO_SPORTS.includes(x) || x === 'hyrox'); };
export const hasOtherSport = o => { const s = sportsOf(o); return !!s && s.some(x => SPORTISH.includes(x)); };
export const dietOf = o => profileOf(o == null ? getSubject() : o).diet || 'omni';

// Activités proposées après la séance (les autres restent accessibles via « Autre activité »)
export function relevantActs(o) {
  const s = sportsOf(o);
  if (!s) return null;
  const out = new Set(['force', 'kine', 'mobi']);
  if (s.includes('escalade')) out.add('grimpe');
  if (s.some(x => CARDIO_SPORTS.includes(x) || x === 'hyrox')) out.add('cardio');
  if (s.some(x => SPORTISH.includes(x))) out.add('sport');
  return out;
}

// Types de séance mis en avant dans l'éditeur, selon les sports
export function relevantKinds(o) {
  const s = sportsOf(o);
  if (!s) return null;
  const out = new Set(['muscu', 'renfo', 'kine', 'recup', 'test', 'autre']);
  if (s.includes('escalade')) ['grimpe', 'doigts', 'epaule', 'compet', 'affut'].forEach(k => out.add(k));
  if (s.some(x => ['course', 'trail', 'hyrox'].includes(x))) out.add('course');
  if (s.some(x => ['velo', 'natation', 'hyrox', 'trail'].includes(x))) out.add('velo');
  if (s.some(x => SPORTISH.includes(x))) { out.add('sport'); out.add('compet'); }
  return out;
}

// Catégories de tests mises en avant
export function relevantTestCats(o) {
  const s = sportsOf(o);
  if (!s) return null;
  const out = new Set(['gainage', 'mobilite', 'corps', 'perso', 'force', 'puissance']);
  if (s.includes('escalade')) ['doigts', 'tirage', 'poussee', 'epaule'].forEach(c => out.add(c));
  if (s.some(x => ['muscu', 'hyrox', 'combat'].includes(x))) ['tirage', 'poussee'].forEach(c => out.add(c));
  if (s.some(x => CARDIO_SPORTS.includes(x) || ['hyrox', 'collectif', 'combat'].includes(x))) out.add('aerobie');
  return out;
}
