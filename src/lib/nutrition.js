// Alimentation : base d'aliments Ciqual, repas du jour, dépense estimée, repères du jour et bilan de la semaine.
// Dépense : Mifflin-St Jeor (Frankenfield 2005) + METs du Compendium 2024 (Herrmann 2024).
// Repères : Thomas, Erdman & Burke 2016 (ACSM/AND/DC), Morton 2018 (protéines), ANSES 2021 (vitamines et minéraux).
// Compléments : consensus du CIO 2018 (Maughan). Garde-fous : consensus REDs du CIO 2023 (Mountjoy).
import { get, getFor, put, putFor, putMany, idsFor, jget, ids, profileOf, getSubject, SELF, isSelf, links } from './store.js';
import { blocks, target, day } from './plan.js';
import { acts, plannedActs, actOfKind } from './activity.js';
import { sportsOf, dietOf } from './sports.js';
import { bodyWeightAt } from './tests.js';
import { addDays, todayKey, fmtNum } from './dates.js';
import { norm } from './library.js';

/* ---------- Base d'aliments ---------- */
export const NUT = [
  ['kcal', 'Énergie', 'kcal'], ['p', 'Protéines', 'g'], ['g', 'Glucides', 'g'], ['su', 'dont sucres', 'g'], ['l', 'Lipides', 'g'], ['ags', 'dont saturés', 'g'], ['fib', 'Fibres', 'g'], ['sel', 'Sel', 'g'],
  ['ca', 'Calcium', 'mg'], ['fe', 'Fer', 'mg'], ['mg', 'Magnésium', 'mg'], ['zn', 'Zinc', 'mg'], ['k', 'Potassium', 'mg'], ['io', 'Iode', 'µg'], ['se', 'Sélénium', 'µg'],
  ['va', 'Vitamine A', 'µg'], ['vd', 'Vitamine D', 'µg'], ['vc', 'Vitamine C', 'mg'], ['b9', 'Folates (B9)', 'µg'], ['b12', 'Vitamine B12', 'µg'], ['ala', 'Oméga-3 ALA', 'g'], ['epa', 'EPA', 'g'], ['dha', 'DHA', 'g']
];
export const NUT_LBL = Object.fromEntries(NUT.map(x => [x[0], x]));
let FOODS = null, LOADING = null, BY_CODE = new Map(), META = null;
export const foodsReady = () => !!FOODS;
export function loadFoods() {
  if (FOODS) return Promise.resolve(FOODS);
  if (LOADING) return LOADING;
  const base = (import.meta.env && import.meta.env.BASE_URL) || '/';
  LOADING = fetch(base + 'aliments.json').then(r => { if (!r.ok) throw new Error('Base d’aliments indisponible'); return r.json(); }).then(d => {
    META = { v: d.v, grp: d.grp };
    FOODS = d.f.map(a => { const o = { c: a[0], n: a[1], grp: a[2], v: {} }; d.k.forEach((k, i) => { o.v[k] = a[3 + i]; }); o.s = norm(a[1]); o.w = o.s.split(' '); return o; });
    BY_CODE = new Map(FOODS.map(f => [f.c, f]));
    return FOODS;
  }).catch(e => { LOADING = null; throw e; });
  return LOADING;
}
export const foodByCode = c => BY_CODE.get(c) || customFoods().find(f => f.c === c) || null;
// Aliments créés par l'utilisateur (produit de marque, complément…) : valeurs pour 100 g lues sur l'étiquette
export function customFoods() {
  return ((get('nutri') || {}).custom || []).map(x => Object.assign({ custom: true, grp: 0, s: norm(x.n), w: norm(x.n).split(' ') }, x));
}
export function saveCustomFood(name, v) {
  const id = 'u' + Date.now().toString(36), list = (nutriDoc().custom || []).concat([{ c: id, n: name, v }]);
  putFor(SELF, 'nutri', Object.assign({}, nutriDoc(), { custom: list }));
  return Object.assign({ custom: true, grp: 0, s: norm(name), w: norm(name).split(' ') }, { c: id, n: name, v });
}
export const foodsMeta = () => META;

const COOK = /^(riz|pates|semoule|quinoa|boulgour|ble|lentille|pois|haricot|feve|polenta|millet|sarrasin|epeautre|orge|pomme de terre|patate)/;
// Recherche : chaque mot tapé doit commencer un mot du nom ; les noms courts et les aliments récents d'abord
export function searchFoods(q, recentCodes, limit) {
  if (!FOODS) return [];
  // pluriels : « lentilles » trouve « lentille »
  const toks = norm(q).split(' ').filter(Boolean).map(t => (t.length > 3 ? t.replace(/(s|x)$/, '') : t));
  if (!toks.length) return [];
  const rec = new Set(recentCodes || []), out = [], qa = String(q).toLowerCase().trim().replace(/\s+/g, ' ');
  for (const f of FOODS.concat(customFoods())) {
    let ok = true, sc = 0;
    for (const [i, t] of toks.entries()) {
      const wi = f.w.findIndex(w => w.startsWith(t));
      if (wi < 0) { ok = false; break; }
      sc += wi === 0 ? (i === 0 ? 30 : 6) : Math.max(0, 6 - wi);
      if (f.w[wi] === t || f.w[wi] === t + 's' || f.w[wi] === t + 'x') sc += 4;
    }
    if (!ok) continue;
    // l'aliment lui-même avant ses dérivés : « Pomme, crue » avant « Pomme de terre »
    const head = f.n.split(',')[0].toLowerCase().trim();
    if (head === qa || head + 's' === qa || head + 'x' === qa) sc += 12;
    if (f.custom) sc += 10;
    sc -= f.n.length / 12;
    // féculents, légumineuses, viandes et poissons se pèsent souvent cuits ; le reste (flocons, fruits…) tel quel
    const cookable = f.grp === 4 || COOK.test(f.s);
    const cooked = /\b(cuit|cuite|cuits|cuites|roti|rotie|grille|grillee|poele|poelee|dur|poche)\b/.test(f.s);
    if (cookable && cooked) sc += 6;
    else if (cookable && /\b(sec|seche|secs|seches|deshydrate|deshydratee|cru|crue|crus|crues)\b/.test(f.s)) sc -= 8;
    if (/\((blanc|jaune) d/i.test(f.n)) sc -= 14;
    const proc = f.s.match(/\b(en poudre|appertise|appertisee|concentre|deshydrate|deshydratee|lyophilise|puree)\b/);
    if (proc && !norm(qa).includes(proc[1].split(' ').pop())) sc -= 10;
    if (!cookable && /\b(sec|seche|seches|sechee|sechees)\b/.test(f.s) && !/\bs[eè]c/.test(qa)) sc -= 4;
    if (/aliment moyen|sans precision/.test(f.s)) sc += 1;
    if (rec.has(f.c)) sc += 25;
    out.push([sc, f]);
  }
  return out.sort((a, b) => b[0] - a[0]).slice(0, limit || 40).map(x => x[1]);
}

/* ---------- Repas ---------- */
export const MEALS = [['pdj', 'Petit-déjeuner'], ['dej', 'Déjeuner'], ['col', 'Collation'], ['din', 'Dîner']];
export const mealsOf = (k, o) => ((o != null ? getFor(o, 'n:' + k) : get('n:' + k)) || {}).m || {};
export function setMeal(k, meal, items) {
  const cur = Object.assign({}, mealsOf(k, SELF));
  if (items && items.length) cur[meal] = items; else delete cur[meal];
  putFor(SELF, 'n:' + k, { m: cur });
}
export function addFood(k, meal, f, grams) {
  const cur = (mealsOf(k, SELF)[meal] || []).concat([{ c: f.c, n: f.n, g: Math.round(grams) }]);
  setMeal(k, meal, cur);
  rememberFood(f, grams);
}
// Aliments récents et portion habituelle (dans son propre carnet)
const nutriDoc = () => getFor(SELF, 'nutri') || {};
export const recents = () => (nutriDoc().recent || []);
function rememberFood(f, grams) {
  const r = recents().filter(x => x.c !== f.c);
  r.unshift({ c: f.c, n: f.n, g: Math.round(grams) });
  putFor(SELF, 'nutri', Object.assign({}, nutriDoc(), { recent: r.slice(0, 40) }), { silent: true });
}
export const savedMeals = () => (nutriDoc().saved || []);
export function saveMealPreset(name, items) { putFor(SELF, 'nutri', Object.assign({}, nutriDoc(), { saved: savedMeals().filter(s => s.name !== name).concat([{ id: 's' + Date.now().toString(36), name, items }]) })); }
export function deleteMealPreset(id) { putFor(SELF, 'nutri', Object.assign({}, nutriDoc(), { saved: savedMeals().filter(s => s.id !== id) })); }

// Totaux : nutriments et grammes dont la valeur est inconnue dans la table
export function totals(items) {
  const t = { grams: 0, unk: {} }; for (const [k] of NUT) t[k] = 0;
  for (const it of items) {
    const f = foodByCode(it.c), g = it.g || 0; t.grams += g;
    for (const [k] of NUT) { const v = f ? f.v[k] : null; if (v == null) t.unk[k] = (t.unk[k] || 0) + g; else t[k] += v * g / 100; }
  }
  t.epadha = t.epa + t.dha; t.unk.epadha = Math.max(t.unk.epa || 0, t.unk.dha || 0);
  return t;
}
export const dayItems = (k, o) => { const m = mealsOf(k, o); return MEALS.flatMap(([id]) => m[id] || []); };
export const dayTotals = (k, o) => totals(dayItems(k, o));
export const loggedDay = (k, o) => dayItems(k, o).length > 0;

/* ---------- Réglages ---------- */
export function nutriPrefs(o) {
  const p = profileOf(o == null ? getSubject() : o), n = p.nutri || {};
  return { numbers: typeof n.numbers === 'boolean' ? n.numbers : !p.under18, share: !!n.share, life: n.life || 'assis', goal: p.under18 ? 'maintien' : (n.goal || 'maintien') };
}
// Le coach ne voit l'alimentation que si l'athlète l'a partagée
export const nutriVisible = () => isSelf() || nutriPrefs().share;
// Partage activé : on renvoie les repas déjà notés pour que l'appli du coach les reçoive
export function resendNutrition() {
  const map = {};
  for (const id of idsFor(SELF, 'n:').concat(['nutri'])) { const d = getFor(SELF, id); if (d) map[id] = d; }
  if (Object.keys(map).length) putMany(map, SELF);
}

/* ---------- Dépense énergétique ---------- */
export const LIFE = [['assis', 'Plutôt assis', 1.4], ['debout', 'Debout, en mouvement', 1.6], ['physique', 'Travail physique', 1.8]];
export const GOALS_W = [['maintien', 'Garder mon poids'], ['perte', 'Perdre un peu'], ['prise', 'Prendre du muscle']];
function ageOf(p) { return p.birth_year ? new Date().getFullYear() - p.birth_year : 30; }
export function weightOf(o, k) { const w = bodyWeightAt(k || todayKey()); return w || Number(profileOf(o == null ? getSubject() : o).weight_kg) || null; }
// Mifflin-St Jeor : 10 × poids + 6,25 × taille − 5 × âge + 5 (homme) ou − 161 (femme)
export function bmr(o, k) {
  const p = profileOf(o == null ? getSubject() : o), w = weightOf(o, k), h = Number(p.height_cm);
  if (!w || !h) return null;
  const s = p.sex === 'M' ? 5 : p.sex === 'F' ? -161 : -78;
  return 10 * w + 6.25 * h - 5 * ageOf(p) + s;
}
// METs bruts du Compendium 2024 selon l'activité et le ressenti de la séance
const RUN = [[4.1, 6.5], [4.55, 7.8], [5.1, 8.5], [5.65, 9.0], [6.15, 9.3], [6.7, 10.5], [7, 11.0], [7.5, 11.8], [8, 12.0], [8.6, 12.5], [9, 13.0], [9.45, 14.8], [10, 14.8], [11, 16.8], [12, 18.5], [13, 19.8], [14, 23.0]];
function runMet(kmh) {
  const mph = kmh / 1.609;
  if (mph <= RUN[0][0]) return RUN[0][1];
  for (let i = 1; i < RUN.length; i++) if (mph <= RUN[i][0]) { const [a, ma] = RUN[i - 1], [b, mb] = RUN[i]; return ma + (mb - ma) * (mph - a) / (b - a); }
  return RUN[RUN.length - 1][1];
}
function met(act, r, ctx) {
  r = typeof r === 'number' ? r : 6;
  if (act === 'grimpe') return r <= 4 ? 5.8 : r <= 6 ? 7.3 : 8.0;
  if (act === 'force') return r <= 5 ? 3.5 : r <= 7 ? 5.0 : 6.0;
  if (act === 'kine') return 3.0;
  if (act === 'mobi') return 2.3;
  if (act === 'cardio') {
    if (ctx.kmh && ctx.run) return runMet(ctx.kmh);
    if (ctx.bike) return r <= 4 ? 6.8 : r <= 6 ? 8.0 : 10.0;
    return r <= 4 ? 7.8 : r <= 6 ? 9.3 : 11.0;
  }
  if (act === 'sport') {
    const s = sportsOf() || [];
    if (s.includes('combat')) return r <= 4 ? 5.3 : 10.3;
    if (s.includes('collectif')) return r >= 7 ? 8.0 : r <= 4 ? 5.5 : 7.5;
    return r <= 4 ? 5.0 : 7.0;
  }
  return 3.0;
}
const parseMin = s => { const m = String(s || '').match(/(\d+)\s*h\s*(\d+)?|(\d+)\s*min/); if (!m) return null; return m[3] ? +m[3] : (+m[1]) * 60 + (+m[2] || 0); };
// Séances du jour : celles notées dans le journal, sinon celles du plan
export function dayActivity(k, o) {
  const e = jget(k), list = acts(k), real = typeof e.duree === 'number' && e.duree > 0;
  const bl = blocks(k).filter(b => b.kind !== 'rest' && b.kind !== 'test');
  if (!real && (!bl.length || e.status === 'sautee')) return { min: 0, items: [], real: false };
  const tg = target(k), d = day(k) || {};
  const min = real ? e.duree : (parseMin(d.duree) || (bl.some(b => ['grimpe', 'compet'].includes(b.kind)) ? 90 : 60));
  const r = typeof e.rpe === 'number' ? e.rpe : tg && tg.rpe ? (tg.rpe[0] + tg.rpe[1]) / 2 : 6;
  const as = (list.length ? list : plannedActs(k)).filter(a => a);
  const run = bl.some(b => b.kind === 'course'), bike = bl.some(b => b.kind === 'velo') && !run;
  const kmh = e.cardio && e.cardio.km && real ? e.cardio.km / (e.duree / 60) : null;
  const per = as.length ? min / as.length : min;
  return { min, r, real, items: (as.length ? as : ['force']).map(a => ({ act: a, min: per, met: met(a, r, { run, bike, kmh }) })) };
}
export function dayExpenditure(k, o) {
  const b = bmr(o, k); if (!b) return null;
  const pr = nutriPrefs(o), pal = (LIFE.find(x => x[0] === pr.life) || LIFE[0])[2], w = weightOf(o, k);
  const a = dayActivity(k, o), ex = a.items.reduce((s, x) => s + (x.met - 1) * w * x.min / 60, 0);
  const tot = b * pal + ex;
  return { bmr: b, base: b * pal, ex, tot, lo: tot * 0.9, hi: tot * 1.1, act: a };
}

/* ---------- Repères du jour (Thomas 2016, Morton 2018) ---------- */
// Charge du jour → glucides en g/kg
export function dayLoad(k, o) {
  const a = dayActivity(k, o), min = a.min, hard = a.r >= 7;
  const strengthOnly = a.items.length > 0 && a.items.every(x => x.act === 'force' || x.act === 'kine' || x.act === 'mobi');
  if (!min || a.items.every(x => x.act === 'mobi' || x.act === 'kine')) return { lvl: 'leger', cho: [3, 5], lbl: 'Journée légère ou de repos' };
  if (min > 240) return { lvl: 'tres', cho: [8, 12], lbl: 'Très grosse journée (plus de 4 h)' };
  if (min > 75 || (min >= 60 && hard && !strengthOnly)) return { lvl: 'eleve', cho: [6, 10], lbl: 'Grosse journée (1 à 3 h, intensité modérée à élevée)' };
  return { lvl: 'modere', cho: strengthOnly ? [4, 7] : [5, 7], lbl: strengthOnly ? 'Séance de force (environ 1 h)' : 'Journée modérée (environ 1 h)' };
}
export function dayTargets(k, o) {
  const w = weightOf(o, k), ex = dayExpenditure(k, o), ld = dayLoad(k, o), pr = nutriPrefs(o), p = profileOf(o == null ? getSubject() : o);
  if (!w) return null;
  const goal = pr.goal;
  const prot = goal === 'perte' ? [1.8, 2.2] : goal === 'prise' ? [1.6, 2.2] : [1.4, 2.0];
  let kcal = ex ? [ex.lo, ex.hi] : null;
  if (kcal && goal === 'perte') kcal = [Math.max(ex.bmr, ex.tot - 500), Math.max(ex.bmr, ex.tot - 300)];
  if (kcal && goal === 'prise') kcal = [ex.tot + 200, ex.tot + 400];
  const mid = kcal ? (kcal[0] + kcal[1]) / 2 : null;
  return {
    w, ld, ex, kcal, goal,
    p: [Math.round(prot[0] * w), Math.round(prot[1] * w)], pk: 1.6,
    g: [Math.round(ld.cho[0] * w), Math.round(ld.cho[1] * w)],
    l: mid ? [Math.round(mid * 0.2 / 9), Math.round(mid * 0.35 / 9)] : null,
    fib: p.under18 ? 21 : 30
  };
}

/* ---------- Références vitamines et minéraux (ANSES 2021) ---------- */
// RNP (couvre presque toute la population) ou AS (apport satisfaisant) ; zinc selon les phytates (plus en végétarien / végan)
export function refs(o) {
  const p = profileOf(o == null ? getSubject() : o), f = p.sex === 'F', u18 = p.under18, age = ageOf(p), diet = dietOf(o);
  const phy = diet === 'omni' ? 1 : 2; // 600 ou 900 mg de phytates par jour
  if (u18) return { ca: 1150, fe: f ? 11 : 11, mg: f ? 225 : 295, zn: f ? 11.9 : 14.2, k: 3500, io: 130, se: 70, va: f ? 650 : 750, vd: 15, vc: 100, b9: 330, b12: 2.5, epadha: 0.25, fib: 21, src: 'ANSES 2021, 15-17 ans' };
  return { ca: age < 25 ? 1000 : 950, fe: 11, mg: f ? 300 : 380, zn: f ? [7.5, 9.3, 11][phy] : [9.4, 11.7, 14][phy], k: 3500, io: 150, se: 70, va: f ? 650 : 750, vd: 15, vc: 110, b9: 330, b12: 4, epadha: 0.5, fib: 30, src: 'ANSES 2021, adultes' };
}
// Nutriments suivis dans le bilan (vitamine D et iode : affichés mais sans alerte, voir plus bas)
export const MICROS = [['fe', 'Fer', 'mg'], ['ca', 'Calcium', 'mg'], ['mg', 'Magnésium', 'mg'], ['zn', 'Zinc', 'mg'], ['k', 'Potassium', 'mg'], ['b12', 'Vitamine B12', 'µg'], ['b9', 'Folates (B9)', 'µg'], ['vc', 'Vitamine C', 'mg'], ['va', 'Vitamine A', 'µg'], ['se', 'Sélénium', 'µg'], ['epadha', 'Oméga-3 EPA + DHA', 'g'], ['io', 'Iode', 'µg'], ['vd', 'Vitamine D', 'µg']];
export const NO_ALERT = { vd: 'La vitamine D vient surtout du soleil : l’alimentation n’en couvre presque jamais la référence. D’octobre à mars, parles-en à ton médecin (un dosage sanguin dit s’il en faut).', io: 'Le sel iodé n’est pas compté dans les aliments : la valeur affichée sous-estime ton apport réel.' };
export const SOURCES_FOOD = {
  fe: 'Boudin noir, viande rouge, foie, moules ; lentilles, pois chiches, haricots, tofu. Avec de la vitamine C au même repas (agrumes, poivron, kiwi), et le thé ou le café à distance : le fer végétal passe alors bien mieux.',
  ca: 'Laitages (yaourt, fromage), eaux minérales riches en calcium, tofu au calcium, sardines avec arêtes, amandes, choux.',
  mg: 'Oléagineux (amandes, noix de cajou), chocolat noir, légumineuses, céréales complètes, eaux riches en magnésium.',
  zn: 'Viande, fruits de mer (huîtres), œufs, fromage ; légumineuses trempées ou germées, graines de courge.',
  k: 'Fruits et légumes, légumineuses, pommes de terre, bananes.',
  b12: 'Uniquement dans les produits animaux (viande, poisson, œufs, laitages). En végan, un complément de B12 (ou des aliments enrichis) est indispensable.',
  b9: 'Légumes à feuilles vertes, légumineuses, asperges, agrumes.',
  vc: 'Kiwi, agrumes, poivron, choux, fruits rouges, persil (cru de préférence).',
  va: 'Carotte, patate douce, courge, épinards, mangue ; foie et œufs.',
  se: 'Poissons, fruits de mer, œufs, noix du Brésil (1 à 2 suffisent).',
  epadha: 'Poissons gras (sardine, maquereau, hareng, saumon) une à deux fois par semaine. En végétarien ou végan, l’huile d’algue en apporte.',
  fib: 'Légumineuses, céréales complètes, fruits et légumes avec la peau, oléagineux.'
};

/* ---------- Bilan sur 7 jours ---------- */
export function weekSummary(endK, o) {
  endK = endK || todayKey();
  const days = []; for (let i = 6; i >= 0; i--) days.push(addDays(endK, -i));
  const logged = days.filter(k => loggedDay(k, o));
  const R = refs(o), sum = {}, unk = {}, grams = { t: 0 };
  let exp = 0, expN = 0, ua = 0, prot = 0, cho = 0;
  for (const k of logged) {
    const t = dayTotals(k, o); grams.t += t.grams;
    for (const key of Object.keys(t)) if (typeof t[key] === 'number') sum[key] = (sum[key] || 0) + t[key];
    for (const [key, g] of Object.entries(t.unk)) unk[key] = (unk[key] || 0) + g;
    const ex = dayExpenditure(k, o); if (ex) { exp += ex.tot; expN++; }
  }
  const n = logged.length, avg = {};
  for (const key of Object.keys(sum)) avg[key] = n ? sum[key] / n : 0;
  const cov = MICROS.map(([key, l, u]) => ({ key, l, u, v: avg[key] || 0, ref: R[key], pct: R[key] ? (avg[key] || 0) / R[key] : null, unk: grams.t ? (unk[key] || 0) / grams.t : 0 }));
  if (R.fib) cov.push({ key: 'fib', l: 'Fibres', u: 'g', v: avg.fib || 0, ref: R.fib, pct: (avg.fib || 0) / R.fib, unk: grams.t ? (unk.fib || 0) / grams.t : 0 });
  const w = weightOf(o, endK);
  return { days, logged, n, avg, cov, R, exp: expN ? exp / expN : null, w, protKg: w && n ? avg.p / w : null, choKg: w && n ? avg.g / w : null, fatPct: avg.kcal ? avg.l * 9 / avg.kcal * 100 : null };
}

// Conseils de la semaine : manques répétés, régime, énergie (avec garde-fous)
export function weekAdvice(ws, o) {
  const out = [], add = (lvl, t, d, src, key) => out.push({ lvl, t, d, src: src || [], key });
  if (ws.n < 3) return out;
  const p = profileOf(o == null ? getSubject() : o), diet = dietOf(o), pr = nutriPrefs(o);
  // Énergie très en dessous de la dépense : soit la saisie est incomplète, soit le déficit est réel (signal REDs)
  const lowE = ws.exp && ws.avg.kcal && ws.avg.kcal < ws.exp * 0.7 && !(pr.goal === 'perte' && ws.avg.kcal >= ws.exp * 0.75);
  if (lowE) add('warn', 'Apport nettement sous ta dépense', 'Sur ' + ws.n + ' jours saisis, ' + (pr.numbers ? 'tu manges en moyenne ' + Math.round(ws.avg.kcal) + ' kcal pour une dépense estimée autour de ' + Math.round(ws.exp) + ' kcal' : 'tes apports sont nettement sous ta dépense estimée') + '. Si tous tes repas ne sont pas notés, complète-les : le bilan (et les manques ci-dessous) n’est fiable qu’avec une saisie complète. Si elle l’est, c’est un déficit important pour un sportif : fatigue, blessures, cycle irrégulier et baisse de performance en sont les signaux. Augmente les portions les jours d’entraînement, et parles-en à un médecin ou un diététicien du sport si ça dure.', ['mountjoy2023'], 'reds');
  // Manques répétés : les 4 plus marqués en détail, les autres en une ligne
  const lows = ws.cov.filter(c => !NO_ALERT[c.key] && c.pct != null && c.unk <= 0.3 && c.pct < 0.7).sort((a, b) => a.pct - b.pct);
  for (const c of lows.slice(0, 4)) add(c.pct < 0.5 ? 'warn' : 'info', c.l + ' : ' + Math.round(c.pct * 100) + ' % de la référence', SOURCES_FOOD[c.key] + (c.key === 'fe' ? ' Si tu es souvent fatigué(e), parles-en à ton médecin : seul un dosage (ferritine) dit s’il faut un complément, et le fer en trop n’est pas anodin.' : ''), ['anses2021'], c.key);
  if (lows.length > 4) add('info', 'Aussi un peu bas', lows.slice(4).map(c => c.l.toLowerCase() + ' (' + Math.round(c.pct * 100) + ' %)').join(', ') + '. Plus de fruits, de légumes et de légumineuses relève la plupart de ces apports d’un coup.', ['anses2021'], 'more');
  if (diet === 'vegan') add('info', 'Végan : vitamine B12', 'La B12 n’existe pas dans les végétaux : un complément régulier (ou des aliments enrichis) est indispensable, quel que soit le bilan ci-dessus.', ['anses2021'], 'b12v');
  if (diet !== 'omni' && !out.some(x => x.key === 'fe')) add('info', (diet === 'vegan' ? 'Végan' : 'Végétarien') + ' : fer et zinc', 'Le fer et le zinc des végétaux s’absorbent moins bien : légumineuses, céréales complètes et oléagineux à chaque repas, avec de la vitamine C, et le thé ou le café à distance.', ['anses2021'], 'fezn');
  if (ws.w && ws.protKg != null && ws.protKg < 1.2) add('info', 'Protéines : ' + fmtNum(Math.round(ws.protKg * 10) / 10) + ' g/kg par jour', 'Le repère pour un sportif est d’environ 1,6 g/kg (1,2 à 2,0), réparti sur 3 à 4 prises de 0,3 g/kg : œufs, laitages, viande, poisson, légumineuses, tofu.', ['morton2018', 'thomas2016'], 'prot');
  return out;
}

/* ---------- Compléments (consensus du CIO 2018) ---------- */
export const SUPPS = [
  { id: 'cafeine', l: 'Caféine', lvl: 'Bon niveau de preuve', d: 'Améliore l’endurance et les efforts répétés. 3 à 6 mg/kg environ 60 min avant ; des doses plus faibles (moins de 3 mg/kg) marchent aussi chez certains. Attention au sommeil si la séance est tard.', perf: true },
  { id: 'creatine', l: 'Créatine monohydrate', lvl: 'Bon niveau de preuve', d: 'Pour les efforts courts et répétés et la prise de force en musculation. Charge de 20 g par jour en 4 prises pendant 5 à 7 jours puis 3 à 5 g par jour, ou directement 3 à 5 g par jour. Prise de poids de 1 à 2 kg (eau) possible : à peser pour l’escalade.', perf: true },
  { id: 'nitrate', l: 'Nitrates (jus de betterave)', lvl: 'Bon niveau de preuve', d: 'Effet surtout chez les sportifs peu ou moyennement entraînés, sur les efforts de 12 à 40 min. Environ 310 à 560 mg de nitrate 2 à 3 h avant.', perf: true },
  { id: 'beta', l: 'Bêta-alanine', lvl: 'Bon niveau de preuve', d: 'Efforts intenses de 30 s à 10 min (filière lactique). Environ 65 mg/kg par jour en plusieurs petites prises pendant 10 à 12 semaines ; picotements fréquents.', perf: true },
  { id: 'bicar', l: 'Bicarbonate de sodium', lvl: 'Bon niveau de preuve', d: 'Efforts intenses de 30 s à 10 min. 0,2 à 0,4 g/kg 60 à 150 min avant ; troubles digestifs fréquents : à tester à l’entraînement, jamais le jour J.', perf: true },
  { id: 'vitd', l: 'Vitamine D', lvl: 'Médical', d: 'Utile en cas de carence, fréquente l’hiver en France. Un dosage sanguin et l’avis d’un médecin décident de la dose.' },
  { id: 'fer', l: 'Fer', lvl: 'Médical', d: 'Seulement en cas de carence prouvée par une prise de sang (ferritine), sur avis médical : un excès de fer est toxique.' },
  { id: 'b12', l: 'Vitamine B12', lvl: 'Médical / régime', d: 'Indispensable en alimentation végane, conseillée si les produits animaux sont rares.' },
  { id: 'prot', l: 'Poudre de protéines', lvl: 'Aliment de sport', d: 'Pratique pour atteindre ses besoins ou après la séance, mais pas plus efficace que des aliments équivalents (laitages, œufs, viande, légumineuses).' }
];
export const SUPP_WARN = 'Un complément peut contenir des substances interdites non déclarées. Choisis uniquement des produits certifiés anti-dopage (norme AFNOR NF V94-001 en France), et parles-en à un professionnel de santé.';

/* ---------- Conseils du jour ---------- */
export function dayAdvice(k, o) {
  const tg = dayTargets(k, o); if (!tg) return [];
  const a = tg.ld, out = [], act = dayActivity(k, o), w = tg.w, nb = nutriPrefs(o).numbers, diet = dietOf(o);
  const g = (x, u) => nb ? ' (' + x + (u || ' g') + ')' : '';
  if (act.min) {
    out.push({ t: 'Avant la séance', d: 'Un repas riche en glucides 1 à 4 h avant' + g(Math.round(w) + ' à ' + Math.round(4 * w)) + ', pauvre en graisses et en fibres si l’effort est intense. Bois 5 à 7 ml/kg environ 4 h avant' + g(Math.round(5 * w) + ' à ' + Math.round(7 * w), ' ml') + '.', src: ['thomas2016'] });
    if (act.min > 75) out.push({ t: 'Pendant', d: 'Séance de plus de 75 min : 30 à 60 g de glucides par heure (boisson, compote, fruit sec), et de l’eau selon la soif.', src: ['thomas2016'] });
    out.push({ t: 'Après', d: 'Des protéines dans les 2 h' + g(Math.round(0.3 * w)) + ' avec des glucides' + (a.lvl === 'eleve' || a.lvl === 'tres' ? ', surtout si tu t’entraînes de nouveau dans moins de 8 h (1 à 1,2 g/kg par heure pendant 4 h)' : '') + '.', src: ['thomas2016', 'kerksick2017'] });
  } else out.push({ t: 'Jour de repos', d: 'Moins de glucides que les jours chargés, mais toujours des protéines à chaque repas : c’est là que la récupération se fait.', src: ['thomas2016'] });
  out.push({ t: 'Protéines sur la journée', d: (nb ? 'Environ ' + tg.p[0] + ' à ' + tg.p[1] + ' g, ' : '') + 'en 3 à 4 prises (œufs, laitages, viande, poisson, légumineuses, tofu).', src: ['morton2018', 'thomas2016'] });
  if (diet === 'vegan') out.push({ t: 'Végan', d: 'Associe légumineuses et céréales sur la journée, pense à la B12 (complément) et aux sources d’oméga-3 (noix, colza, lin, huile d’algue).', src: ['anses2021'] });
  return out;
}
