// Petites fonctions pour l'appli iPhone : ce qui, dans la version web, passe par des fonctions stockées dans les données
// (dérivés de tests, « Utiliser » d'un conseil…) ou par l'interface (termes du lexique).
import { GLOSS_RE, glossIdOf } from '../../src/lib/glossary.js';
import { testById } from '../../src/lib/tests.js';
import { blocks } from '../../src/lib/plan.js';
import { climbSuggest } from '../../src/lib/quantify.js';

// Texte découpé en morceaux : [texte, idTerme|null] ; chaque terme n'est souligné qu'une fois par texte
export function glossSplit(s) {
  s = String(s || ''); const out = [], seen = new Set(); let last = 0, m; GLOSS_RE.lastIndex = 0;
  while ((m = GLOSS_RE.exec(s))) {
    const id = glossIdOf(m[2]), start = m.index + m[1].length;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (start > last) out.push([s.slice(last, start), null]);
    out.push([m[2], id]);
    last = start + m[2].length;
  }
  if (last < s.length) out.push([s.slice(last), null]);
  return out;
}
export function testDerive(tid, vals) { const t = testById(tid); return t && t.derive ? t.derive(vals || {}) : null; }
const find = (k, bid, iid) => { const b = blocks(k).find(x => x.id === bid); const it = b && (b.items || []).find(x => x.id === iid); return { b, it }; };
export function climbSuggestOf(k, bid, iid) {
  const { b, it } = find(k, bid, iid); if (!b || !it) return null;
  const s = climbSuggest(k, b, it); if (!s) return null;
  return { text: s.text, why: s.why, canApply: !!s.apply };
}
export function climbSuggestApply(k, bid, iid) {
  const { b, it } = find(k, bid, iid); if (!b || !it) return false;
  const s = climbSuggest(k, b, it); if (s && s.apply) { s.apply(); return true; }
  return false;
}

// Alerte 48 h quand on déplace un bloc (copie de ui/BlockMenu.jsx)
import { heavyOf, groupsTxt } from '../../src/lib/builder.js';
import { day } from '../../src/lib/plan.js';
import { addDays } from '../../src/lib/dates.js';
export function moveWarn(k, bid, to) {
  const d0 = day(k), b = d0 && (d0.blocks || []).find(x => x.id === bid); if (!b) return null;
  const mine = heavyOf({ blocks: [b] }); if (!mine.size) return null;
  const hv = d => { const dd = day(d); return heavyOf(dd && d === k ? { blocks: dd.blocks.filter(x => x.id !== b.id) } : dd); };
  const out = [];
  const same = [...mine].filter(g => hv(to).has(g)); if (same.length) out.push(groupsTxt(same) + ' déjà en lourd ce jour-là');
  for (const [o, w] of [[-1, 'la veille'], [1, 'le lendemain']]) { const g = [...mine].filter(x => hv(addDays(to, o)).has(x)); if (g.length) out.push(groupsTxt(g) + ' en lourd ' + w); }
  return out.length ? out.join(' · ') : null;
}

/* ---------- Base d'aliments : chargée dans la logique partagée, sans renvoyer toute la liste à l'appli ---------- */
import { loadFoods as loadFoodsAll } from '../../src/lib/nutrition.js';
export async function loadFoods() { const f = await loadFoodsAll(); return f.length; }

/* ---------- Assistant de programme (Builder.jsx) ---------- */
import { getSubject, profileOf, isSelf, getFor, putFor, SELF } from './store-shim.js';
import { uid } from '../../src/lib/plan.js';
import { sportsOf } from '../../src/lib/sports.js';
import { GOAL_BY_ID, LIB_BY_ID } from '../../src/lib/library.js';
import { generate, writeProgram, conflicts, nextMonday, alternatives, sessionSummary, FORMATS, fmtFamily, fmtOf, fmtReco, weekPlanTypes, buildSession } from '../../src/lib/builder.js';
import { missingFor } from '../../src/lib/needs.js';
import { levelsDoc, LIFT_OF_LIB, LIFTS, CLIMB_KEYS, oneRM, climbLevel, vmaOf, fcmaxOf, srcTxt, csOf, cssOf, swimPace, vo2Of, ftpOf, runProfile } from '../../src/lib/levels.js';
import { SCALE } from '../../src/lib/grades.js';
import { DOW_L, todayKey } from '../../src/lib/dates.js';

const DEFAULT_EQ = { escalade: ['salle-esc'], muscu: ['salle'], course: ['exterieur'], trail: ['exterieur'], velo: ['velo'], natation: ['piscine'], hyrox: ['salle', 'exterieur'], collectif: ['exterieur'], combat: [], autre: [] };
const cloneJ = x => JSON.parse(JSON.stringify(x));

// Réglages de départ (saved : derniers réglages retenus sur l'appareil)
export function builderInitial(saved) {
  const o = getSubject(), p = profileOf(o), sp = sportsOf(o) || [];
  const eq = [...new Set(sp.flatMap(s => DEFAULT_EQ[s] || []))];
  return Object.assign({ goal: null, goal2: null, days: [0, 2, 4], fixed: [], fixedLbl: '', dur: 60, lvl: 2, equip: eq, weeks: 8, start: nextMonday(), event: null, eventLbl: '' },
    saved ? { days: saved.days, fixed: saved.fixed || [], fixedLbl: saved.fixedLbl || '', dur: saved.dur, lvl: saved.lvl, equip: saved.equip, weeks: saved.weeks } : {},
    { sports: sp, sex: p.sex, u18: !!p.under18, swap: {}, fmt: (saved && saved.fmt) || {} },
    isSelf() ? {} : { lv: cloneJ(levelsDoc(o)) });
}

// Modèles : réglages d'un programme gardés dans son propre carnet
export const builderModels = () => ((getFor(SELF, 'models') || {}).list || []);
export function builderSaveModel(name, cfg) {
  const keep = ['goal', 'goal2', 'days', 'fixed', 'fixedLbl', 'dur', 'lvl', 'equip', 'weeks', 'swap', 'fmt'], c = {};
  for (const k of keep) c[k] = cfg[k];
  putFor(SELF, 'models', { list: builderModels().filter(m => m.name !== name).concat([{ id: uid('m'), name, cfg: c, at: Date.now() }]) });
}
export function builderDeleteModel(id) { putFor(SELF, 'models', { list: builderModels().filter(m => m.id !== id) }); }

const FAM_LBL = { int: 'Séance d’intervalles (course)', intV: 'Séance d’intervalles (vélo)', intN: 'Séance d’intervalles (natation)', conti: 'Séance de volume', resist: 'Séance de résistance', bloc: 'Séance de puissance', doigts: 'Séance de doigts', compet: 'Séance de compétition', force: 'Muscu · force', hyper: 'Muscu · masse', puiss: 'Muscu · puissance' };
const RECO_WHY = {
  conti: r => r === 'voies' ? 'Tu as renseigné un niveau en voie : le volume se fait en voie.' : 'Beaucoup de mouvements à intensité basse : la base aérobie des avant-bras et de la technique.',
  resist: r => r === 'voies' ? 'Ton objectif est la résistance en voie : on la travaille dans des voies.' : 'Le 4 × 4 fait durer l’effort 2 à 3 min, la durée de la filière lactique.',
  bloc: () => 'Les blocs à ta limite recrutent au maximum, frais à chaque essai.',
  doigts: r => r === 'f80' ? 'Le 10/6 à 80 % de ta force max est le meilleur compromis force et endurance de l’étude de Devise (2022) : environ +12 % de force en 4 semaines.' : r === 'hangs' ? 'Avec une poutre, la charge des suspensions se règle au kilo près.' : 'Sans poutre (ou avant 18 ans), les petites prises en bloc font progresser sans risque.',
  compet: () => 'Le format des qualifications : blocs nouveaux, temps limité, repos imposé.',
  force: () => 'Repos complets entre les séries : la base la plus simple pour progresser en force.',
  hyper: (r, c) => r === 'supersets' ? 'Séance de ' + c.dur + ' min : les supersets gardent le volume en moins de temps.' : 'Un exercice à la fois, repos complets : le plus simple pour bien charger.',
  puiss: r => r === 'contraste' ? 'Avec une barre et de l’expérience : la série lourde potentialise la série explosive.' : 'Charges légères lancées vite : la base, sans matériel lourd.',
  int: () => 'Alterner 30/30 et 3 min varie le stimulus près de la VO2max ; le 4 × 4 min et le 15/15 font encore mieux sur la VO2max (Helgerud 2007) ; le seuil se cale sur ta vitesse critique quand tu l’as testée.',
  intV: () => 'Le 4 × 4 min est le format le plus étudié pour la VO2max ; le 30/15 de Rønnestad (2015) a donné plus de VO2max à effort égal ; le sweet spot et le seuil construisent l’endurance autour de la FTP.',
  intN: () => 'La vitesse critique (CSS) se mesure avec un 400 m et un 200 m : les séries à son allure travaillent le seuil aérobie, et le volume réduit à haute intensité ne fait pas perdre de performance.'
};
const WK0 = { step: 1, meso: 0, phase: 'volume' };
const tutTxt = s => s >= 120 ? Math.round(s / 60) + ' min' : s + ' s';

// Étape « niveau et formats » : repères utiles et formats de chaque famille de séance
export function builderFormats(cfg) {
  const types = [...new Set(weekPlanTypes(cfg))];
  const fams = [...new Set(types.map(t => fmtFamily(t, cfg)).filter(Boolean))];
  const lifts = new Set();
  for (const t of types) { const ss = buildSession(t, cfg, WK0, new Set(), {}); for (const b of ss.blocks) for (const it of b.items || []) { const l = LIFT_OF_LIB[it.lib]; if (l && it.rx && it.rx.role === 'main') lifts.add(l); } }
  if (fams.includes('puiss')) ['squat', 'bench', 'pull'].forEach(l => lifts.add(l));
  const need = { climb: types.some(t => ['conti', 'resist', 'bloc', 'doigts', 'compet'].includes(t)), lifts: [...lifts], cardio: types.some(t => ['ef', 'int', 'long', 'lact', 'sprint', 'circuit', 'hxc', 'hxs', 'hxsim'].includes(t)), hyrox: types.some(t => ['hxc', 'hxs', 'hxsim'].includes(t)) };
  const out = fams.map(f => {
    const t = types.find(x => fmtFamily(x, cfg) === f), cur = fmtOf(f, cfg), reco = fmtReco(f, cfg);
    return { f, label: FAM_LBL[f] || f, cur, reco, why: RECO_WHY[f] ? RECO_WHY[f](reco, cfg) : '', opts: FORMATS[f].map(([id, l, d]) => {
      const ss = buildSession(t, Object.assign({}, cfg, { fmt: Object.assign({}, cfg.fmt, { [f]: id }) }), WK0, new Set(), {}), ex = ss.est || {};
      const main = sessionSummary(ss).filter(it => it.id !== 'ech')[0];
      return { id, l, d,
        main: main ? (main.n > 1 ? main.n + ' × ' : '') + main.label + (main.det ? ' · ' + main.det.split(' · ').slice(0, 2).join(' · ') : '') : '',
        est: [ex.min ? '≈ ' + ex.min + ' min' : '', ex.tut ? '≈ ' + tutTxt(ex.tut) + ' sous tension' : ''].filter(Boolean).join(' · ') };
    }) };
  });
  return { need, fams: out };
}

// Aperçu : le programme généré est gardé ici, l'appli n'en reçoit qu'une version lisible
let lastProg = null;
export function builderGenerate(cfg) {
  const prog = generate(cfg), t = todayKey(); lastProg = prog;
  const fams = [...new Set(prog.types.map(x => fmtFamily(x, cfg)).filter(Boolean))];
  const fmts = fams.map(f => FAM_LBL[f].replace('Séance de ', '').replace('Muscu · ', '').toLowerCase() + ' en ' + FORMATS[f].find(x => x[0] === fmtOf(f, cfg))[1].toLowerCase()).join(' · ');
  const nSes = prog.weeks.reduce((a, x) => a + Object.keys(x.days).filter(d => addDays(x.start, +d) >= t).length, 0);
  const weeks = prog.weeks.map(w => ({ start: w.start, phase: w.phase, light: !!w.light, taper: !!w.taper,
    days: Object.keys(w.days).map(d => { const s = w.days[d]; return { k: addDays(w.start, +d), short: s.short || '', blocks: (s.blocks || []).map(b => ({ kind: b.kind,
      items: (b.items || []).filter(it => it.id !== 'ech' && it.id !== 'rac').map(it => ({ label: it.label, det: it.det || '', n: it.n || 1, unit: it.unit || '', rest: it.rest || 0, lib: it.lib || null, alt: it.lib ? alternatives(it.lib, cfg).length : 0 })) })) }; }) }));
  const warn = prog.warnings.map(x => DOW_L[x.d].toLowerCase() + ' et ' + DOW_L[x.d2].toLowerCase() + ' (' + groupsTxt(x.groups) + ')').join(' ; ');
  return { start: prog.start, end: prog.end, nSes, fmts, weeks, warn, phases: [...new Set(prog.weeks.map(x => x.phase))], needs: missingFor(prog) };
}
export const builderAlternatives = (lib, cfg) => alternatives(lib, cfg).map(x => ({ id: x.id, n: x.n, c: x.c || '' }));
export const libName = id => (LIB_BY_ID[id] || {}).n || id;
export const builderConflicts = () => (lastProg ? conflicts(lastProg) : []);
export const builderWrite = mode => (lastProg ? writeProgram(lastProg, mode) : 0);

/* ---------- Repères de niveau (Levels.jsx) ---------- */
export function levelGroups(sports, need) {
  const s = sports || [], all = !s.length;
  return {
    climb: need ? need.climb : all || s.includes('escalade'),
    lifts: need ? need.lifts : (all || s.some(x => ['muscu', 'hyrox', 'combat', 'collectif', 'escalade'].includes(x))) ? (s.length && s.every(x => x === 'escalade') ? ['pull', 'dips'] : Object.keys(LIFTS)) : [],
    cardio: need ? need.cardio : all || s.some(x => ['course', 'trail', 'velo', 'natation', 'hyrox', 'collectif', 'combat'].includes(x)),
    hyrox: need ? !!need.hyrox : all || s.includes('hyrox')
  };
}
const fmtN = v => v == null ? '' : String(v).replace('.', ',');
// Ce qu'affiche le formulaire : champs, valeurs déclarées et estimations (lvIn : repères propres à un programme)
export function levelsForm(need, lvIn) {
  const lv = lvIn || levelsDoc();
  const g = levelGroups(sportsOf(), need);
  const cl = climbLevel(null, lvIn), vma = vmaOf(null, lvIn), fc = fcmaxOf(null, lvIn), cs = csOf(), css = cssOf(), vo2 = vo2Of(null, lvIn), ftp = ftpOf(null, lvIn), rp = runProfile(null, lvIn);
  return {
    climb: g.climb ? CLIMB_KEYS.map(([k, disc, , l]) => ({ k, l, v: lv[k] || '', hint: cl[k] && cl[k].src !== 'déclaré' ? cl[k].g + ' (' + cl[k].src + ')' : '', opts: SCALE[disc].filter((x, i) => i >= 3) })) : [],
    lifts: g.lifts.map(id => { const L = LIFTS[id], rm = oneRM(id, null, lvIn); return { id, l: L.l + (L.lest ? ' (lest)' : '') + ' · kg', v: lv.rm && lv.rm[id] != null ? lv.rm[id] : null, hint: rm && rm.src !== 'déclaré' ? rm.txt + ' · ' + srcTxt(rm) : '' }; }),
    cardio: g.cardio ? [
      { k: 'vma', l: 'VMA (km/h)', v: lv.vma ?? null, int: false, hint: vma && vma.src !== 'déclarée' ? fmtN(vma.v) + ' · ' + srcTxt(vma) : '' },
      { k: 'vo2', l: 'VO2max (ml/kg/min)', v: lv.vo2 ?? null, int: true, hint: vo2 && vo2.src !== 'déclarée' ? vo2.v + ' · ' + vo2.src : 'montre, labo…' },
      { k: 'fcmax', l: 'FC max (bpm)', v: lv.fcmax ?? null, int: true, hint: fc && fc.src !== 'déclarée' ? fc.v + ' · ' + fc.src : '' },
      { k: 'ftp', l: 'FTP vélo (W)', v: lv.ftp ?? null, int: true, hint: ftp && ftp.src !== 'déclarée' ? ftp.v + ' W · ' + srcTxt(ftp) : '' }
    ] : [],
    hyrox: g.hyrox ? { k: 'hdiv', l: 'Catégorie Hyrox', v: lv.hdiv === 'pro' ? 'pro' : 'open', opts: [['open', 'Open'], ['pro', 'Pro']] } : null,
    cardioNote: g.cardio ? (cs ? 'Vitesse critique ' + fmtN(cs.v) + ' km/h · D′ ≈ ' + cs.dp + ' m (test du ' + srcTxt(cs).replace('test le ', '') + '). ' : 'Vitesse critique : passe le test 3 min + 12 min dans Suivi → Tests. ') + (css ? 'CSS natation ' + fmtN(Math.round(css.ms * 100) / 100) + ' m/s (' + swimPace(css, 100) + ' /100 m). ' : '') + (rp ? rp.txt : '') : ''
  };
}

/* ---------- Import d'un fichier (ImportPicker.jsx) : le texte du fichier, lu par l'appli ---------- */
import { planPatch, filterImport, applyImport as applyImportDocs } from '../../src/lib/io.js';
export function readImportText(txt) {
  let data;
  try { data = JSON.parse(txt); } catch (_) { throw new Error('Ce fichier n’est pas un fichier JSON lisible.'); }
  let r;
  if (data && ['carnet', 'alipto'].includes(data.app) && data.kind === 'patch') r = planPatch(data);
  else {
    if (!data || !['carnet', 'alipto'].includes(data.app) || !data.docs || typeof data.docs !== 'object') throw new Error('Ce fichier ne vient pas d’Alipto.');
    const docs = {};
    for (const [id, v] of Object.entries(data.docs)) if (['plan', 'settings', 'profile', 'tests', 'nutri', 'models'].includes(id) || /^[pjctn]:\d{4}-\d{2}-\d{2}$/.test(id)) docs[id] = v;
    r = { docs, n: { plan: !!docs.plan, days: Object.keys(docs).filter(x => x.startsWith('p:')).length, journal: Object.keys(docs).filter(x => x.startsWith('j:')).length, tests: Object.keys(docs).filter(x => x.startsWith('t:')).length } };
  }
  r.skipped = filterImport(r.docs).skipped;
  return r;
}
export function applyImport(docs) { applyImportDocs(docs); return true; }
