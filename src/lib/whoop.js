// Données Whoop (récupération, sommeil, séances) fusionnées dans le journal. Logique partagée web + iPhone, sans réseau :
// la fonction Supabase « whoop » renvoie les jours, ce module décide ce qui s'écrit.
// Règles : ce que la personne a noté à la main n'est jamais écrasé (on ne remplit que les cases vides) ;
// Whoop passe avant Apple Santé pour la nuit (VFC et FC de repos de Whoop sont plus complètes), la source est gardée dans « src ».
// La VFC de Whoop (RMSSD) et celle d'Apple Santé (SDNN) ne se mesurent pas pareil : une nuit vient d'une seule source.
import { jget, jset } from './store.js';

const SLEEP_KEYS = ['profond', 'leger', 'rem', 'eveil'];
const isNum = v => typeof v === 'number' && isFinite(v);

function mergeNight(cur, w) {
  const n = Object.assign({}, cur || {});
  const mine = !n.src || n.src === 'whoop' || n.src === 'sante';       // pas de source = saisie à la main si des cases sont remplies
  const manual = !n.src && Object.keys(n).length > 0;
  const before = JSON.stringify(n);
  const take = (key, v) => { if (isNum(v) && (!manual ? true : !isNum(n[key]))) n[key] = v; };
  // durée et phases : un bloc cohérent (on n'en mélange pas deux sources, ni une saisie manuelle)
  const hasSleep = SLEEP_KEYS.some(k => isNum(n[k])) || isNum(n.total);
  if (isNum(w.total) && w.total > 0 && (!manual || !hasSleep)) {
    for (const k of SLEEP_KEYS) take(k, w[k]);
    delete n.total;
  }
  take('vfc', w.vfc); take('fcr', w.fcr); take('rec', w.rec);
  if (JSON.stringify(n) === before) return null;
  if (!manual && mine) n.src = 'whoop';
  return n;
}

// Durée, distance et FC moyenne des séances du jour, dans les cases encore vides
function mergeWorkouts(cur, list) {
  const patch = {};
  const min = list.reduce((a, x) => a + (x.min || 0), 0);
  if (min >= 10 && !isNum(cur.duree)) patch.duree = min;
  const km = list.reduce((a, x) => a + (x.km || 0), 0);
  if (km > 0) {
    const c = Object.assign({}, cur.cardio || {});
    let ch = false;
    if (!isNum(c.km)) { c.km = Math.round(km * 10) / 10; ch = true; }
    const hrs = list.filter(x => x.hr && x.min);
    const hrMin = hrs.reduce((a, x) => a + x.min, 0);
    if (!isNum(c.fc) && hrMin > 0) { c.fc = Math.round(hrs.reduce((a, x) => a + x.hr * x.min, 0) / hrMin); ch = true; }
    if (ch) { c.src = 'whoop'; patch.cardio = c; }
  }
  return patch;
}

// days : { 'AAAA-MM-JJ': { nuit: {total, profond, leger, rem, eveil, vfc, fcr, rec}, workouts: [{min, km, hr, …}] } }
// Renvoie le nombre de jours modifiés.
export function mergeDays(days) {
  let changed = 0;
  for (const [k, w] of Object.entries(days || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !w) continue;
    const cur = jget(k), patch = {};
    if (w.nuit) { const n = mergeNight(cur.nuit, w.nuit); if (n) patch.nuit = n; }
    if (w.workouts && w.workouts.length) Object.assign(patch, mergeWorkouts(cur, w.workouts));
    if (Object.keys(patch).length) { jset(k, patch); changed++; }
  }
  return changed;
}
