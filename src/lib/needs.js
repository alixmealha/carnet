// Ce qui manque à un programme selon le sport et l'objectif.
// Repères de dose minimale par tissu (muscle, os, tendon, cartilage) et besoins propres à chaque sport.
// Proposé dans l'aperçu de l'assistant : un appui ajoute le complément au programme (cfg.extras) ou un second objectif.
// Niveau de preuve affiché tel quel : « solide », « modéré » ou « hypothèse de travail ».
import { LIB_BY_ID, equipSet } from './library.js';
import { uid } from './plan.js';

export const LVL_LBL = { solide: 'Preuves solides', 'modéré': 'Preuves modérées', 'hypothèse': 'Hypothèse de travail' };
const ISO = name => ({ kind: 'interval', name, work: 3, rest: 3, reps: 4, sets: 5, setRest: 60, prep: 5, workLabel: 'Pousse', restLabel: 'Relâche', markEach: 'set' });

// BFR : précautions, affichées dans l'aperçu et à chaque exercice
export const BFR_WARN = 'Pas de BFR sans avis médical en cas d’antécédent de phlébite ou d’embolie, de trouble de la coagulation, d’hypertension, de maladie du cœur ou des vaisseaux, de varices importantes, de drépanocytose ou de grossesse. Arrête si fourmillements, engourdissement, douleur vive ou peau qui blanchit.';
export const BFR_DET = '30, 15, 15, 15 rép. à 20-30 % de ton max · 30 s de repos, brassards gardés · BFR : serrage à 40-80 % de la pression d’occlusion (bas de la fourchette pour les bras), ou environ 7/10 ressenti sans manomètre';

// Compléments ajoutables : un exercice glissé dans « per » séances par semaine.
// libs : exercices possibles, le premier disponible avec ton matériel est retenu.
export const EXTRAS = {
  impacts: { t: 'Impacts pour l’os', lvl: 'solide', src: ['turner2003'], per: 2, first: true, libs: ['cmj'],
    why: 'L’os se renforce avec des impacts courts et variés : 20 à 40 par séance suffisent, au-delà l’effet plafonne. Ton sport en apporte peu.',
    item: { det: '4 × 8 sauts, réception amortie, jambes fraîches de préférence', n: 4, unit: 'Série', rest: 60 } },
  achille: { t: 'Tendon d’Achille', lvl: 'modéré', src: ['bohm2015'], per: 2, libs: ['iso-mollets'],
    why: 'Le tendon se renforce avec des mises en tension longues et fortes (environ 90 % de ton max), plusieurs semaines de suite : utile quand on court beaucoup.',
    item: { det: '5 séries de 4 poussées de 3 s presque au maximum, 3 s de relâchement', n: 5, unit: 'Série', timer: ISO('Isométrie mollets') } },
  rotulien: { t: 'Tendon rotulien', lvl: 'modéré', src: ['bohm2015'], per: 2, libs: ['iso-quad'],
    why: 'Sauts et changements de direction chargent le tendon rotulien : des mises en tension longues et fortes le préparent.',
    item: { det: '5 séries de 4 poussées de 3 s presque au maximum, 3 s de relâchement', n: 5, unit: 'Série', timer: ISO('Isométrie quadriceps') } },
  nordic: { t: 'Ischio-jambiers', lvl: 'solide', src: ['vandyk2019'], per: 2, libs: ['nordic'],
    why: 'Dans les sports de sprint, le Nordic divise environ par deux les blessures des ischio-jambiers, avec très peu de volume.',
    item: { det: '2 × 5 descentes les plus lentes possible', n: 2, unit: 'Série', rest: 90 } },
  coiffe: { t: 'Coiffe des rotateurs', lvl: 'modéré', src: ['byram2010'], per: 2, libs: ['rot-ext', 'face-pull', 'ytw'],
    why: 'Grimpe, combat, nage : la coiffe stabilise l’épaule sous charge. Chez les lanceurs, des rotateurs externes faibles vont avec plus de blessures d’épaule.',
    item: { det: '2 × 15, lent et contrôlé', n: 2, unit: 'Série', rest: 45 } },
  pousse: { t: 'Antagonistes : poussée', lvl: 'hypothèse', src: [], per: 2, libs: ['pompes'],
    why: 'La grimpe tire beaucoup : un peu de poussée équilibre l’épaule. Peu d’études le testent directement.',
    item: { det: '2 × 10 à 15, réserve 2', n: 2, unit: 'Série', rest: 60 } },
  poignet: { t: 'Extenseurs du poignet', lvl: 'hypothèse', src: [], per: 2, libs: ['ext-poignet'],
    why: 'Antagonistes des fléchisseurs des doigts, souvent proposés contre les douleurs du coude du grimpeur. Peu d’études le testent directement.',
    item: { det: '2 × 15, descente lente (3 s)', n: 2, unit: 'Série', rest: 45 } },
  bfr: { t: 'Finisher BFR', lvl: 'solide', src: ['lixandrao2018', 'patterson2019', 'wilson2013'], per: 2, bfr: true,
    why: 'Avec des brassards, une charge très légère (20 à 30 % du max) donne presque le même gain de masse qu’une charge lourde, avec moins de contrainte sur les articulations. La force progresse moins : ça complète le lourd, ça ne le remplace pas.',
    item: { det: BFR_DET, n: 4, unit: 'Série', rest: 30, repsBySet: [30, 15, 15, 15], warn: BFR_WARN } }
};
// Repères sans exercice à ajouter : affichés comme conseils
const TIPS = {
  cartilage: { t: 'Mouvement léger tous les jours', lvl: 'modéré', why: 'Le cartilage se nourrit de charges modérées répétées : 10 à 20 min de marche ou de mobilité les jours sans séance.' },
  variete: { t: 'Varier les gestes', lvl: 'hypothèse', why: 'Changer de directions, d’amplitudes et de vitesses d’une séance à l’autre sollicite les tissus dans tous les sens.' },
  bfrEq: { t: 'BFR', lvl: 'solide', src: ['lixandrao2018'], why: 'Si tu as des brassards BFR, coche-les dans le matériel : l’assistant te proposera des finishers à charge très légère pour la masse musculaire.' }
};
// Besoins propres à chaque sport
const BY_SPORT = {
  escalade: ['coiffe', 'pousse', 'poignet', 'impacts'],
  course: ['achille', 'force'], trail: ['achille', 'rotulien', 'force'],
  velo: ['impacts', 'force'], natation: ['impacts', 'force', 'coiffe'],
  collectif: ['nordic', 'rotulien', 'force'], combat: ['coiffe', 'force'],
  hyrox: ['achille', 'force'], muscu: ['impacts'], autre: ['force', 'impacts']
};
const IMPACT_SPORTS = ['course', 'trail', 'collectif', 'hyrox'];
const STRENGTH_TYPES = ['fbA', 'fbB', 'haut', 'bas', 'renfo', 'prevS', 'puiss'];
const MASS_GOALS = ['hyper', 'force', 'prev', 'endu_f'];

const libOk = (id, eq) => { const x = LIB_BY_ID[id]; return !!x && x.eq.some(e => eq.has(e)); };
const libOf = (E, eq) => (E.libs || []).find(id => libOk(id, eq)) || null;

// Ce que couvre déjà le programme (semaine type : la première qui n'est ni décharge ni affûtage)
function coverage(prog) {
  const w = prog.weeks.find(x => !x.light && !x.taper) || prog.weeks[0];
  const out = { libs: new Set(), pats: new Set(), strength: 0, impacts: 0 };
  for (const s of Object.values(w.days)) {
    let heavy = false, impact = false;
    for (const b of s.blocks || []) for (const it of b.items || []) {
      if (it.extra) continue;
      if (it.lib) out.libs.add(it.lib);
      const x = it.lib && LIB_BY_ID[it.lib]; if (x) out.pats.add(x.pat);
      if (it.rx && it.rx.role === 'main' && ['force', 'hyper'].includes(it.rx.goal)) heavy = true;
      if (x && (x.pat === 'plyo' || x.pat === 'squat-puiss' || x.pat === 'sprint')) impact = true;
    }
    if (heavy) out.strength++;
    if (impact) out.impacts++;
  }
  return out;
}
// Suggestions pour un programme : { list: [{ id, kind: 'extra' | 'goal2', t, why, lvl, src, added, warn }], tips }
export function missingFor(prog) {
  const c = prog.cfg, sports = c.sports && c.sports.length ? c.sports : ['autre'], cov = coverage(prog), eq = equipSet(c.equip);
  const added = new Set(c.extras || []), out = [];
  const goals = [c.goal, c.goal2].filter(Boolean);
  const want = [...new Set(sports.flatMap(sp => BY_SPORT[sp] || []).concat(goals.includes('prev') ? ['impacts', 'force'] : []))];
  for (const id of want) {
    if (id === 'force') {
      // séances de force lourdes : 1 par semaine au moins, 2 dès 4 jours d'entraînement
      const need = c.days.length >= 4 ? 2 : 1;
      if (cov.strength >= need || goals.some(g => ['force', 'hyper'].includes(g)) || c.goal2 || c.days.length < 3) continue;
      out.push({ id, kind: 'goal2', t: 'Force : ' + need + ' séance' + (need > 1 ? 's' : '') + ' par semaine', lvl: 'solide', src: ['acsm2009'], why: 'Des charges lourdes une à deux fois par semaine développent la force utile à tous les sports et renforcent muscles et tendons. Ajoute la force en second objectif.' });
      continue;
    }
    const E = EXTRAS[id]; if (!E) continue;
    const lib = libOf(E, eq); if (!lib) continue; // pas le matériel
    const has = cov.libs.has(lib)
      || (id === 'impacts' && (sports.some(sp => IMPACT_SPORTS.includes(sp)) || cov.impacts >= 2))
      || (id === 'coiffe' && cov.pats.has('epaule'))
      || (id === 'pousse' && [...cov.pats].some(p => String(p).startsWith('push')))
      || (id === 'poignet' && cov.pats.has('avantbras'));
    if (has && !added.has(id)) continue;
    out.push({ id, kind: 'extra', t: E.t, why: E.why, lvl: E.lvl, src: E.src, added: added.has(id) });
  }
  // BFR : quand l'objectif touche la masse musculaire ou la prévention, et seulement avec des brassards
  const massy = goals.some(g => MASS_GOALS.includes(g)) || cov.strength > 0;
  const tips = [TIPS.cartilage];
  if (massy && eq.has('bfr')) { const E = EXTRAS.bfr; out.push({ id: 'bfr', kind: 'extra', t: E.t, why: E.why, lvl: E.lvl, src: E.src, added: added.has('bfr'), warn: BFR_WARN }); }
  else if (goals.some(g => ['hyper', 'prev'].includes(g))) tips.push(TIPS.bfrEq);
  if (sports.length === 1) tips.push(TIPS.variete);
  // compléments ajoutés qui ne sont plus proposés (sport ou matériel changé) : toujours retirables
  for (const id of added) if (EXTRAS[id] && !out.some(x => x.id === id)) { const E = EXTRAS[id]; out.push({ id, kind: 'extra', t: E.t, why: E.why, lvl: E.lvl, src: E.src, added: true, warn: E.bfr ? BFR_WARN : undefined }); }
  return { list: out, tips };
}

// Exercice du finisher BFR : jambes ou bras selon la séance, avec le matériel disponible
function bfrLib(type, j, eq) {
  const legs = ['bas', 'prevS'].includes(type) || (!['haut', 'renfo'].includes(type) && j % 2 === 0);
  const opts = legs ? ['leg-ext', 'goblet', 'squat-pdc'] : ['curl', 'pompes'];
  return opts.find(id => libOk(id, eq));
}
// Ajoute les compléments choisis aux séances d'une semaine : au plus « per » séances, de préférence celles de muscu
export function applyExtras(days, cfg, wk) {
  const extras = (cfg.extras || []).filter(id => EXTRAS[id]);
  if (!extras.length) return;
  const eq = equipSet(cfg.equip);
  const keys = Object.keys(days).filter(d => days[d] && days[d].type && days[d].type !== 'mobi');
  const str = keys.filter(d => STRENGTH_TYPES.includes(days[d].type)), other = keys.filter(d => !str.includes(d));
  extras.forEach((id, ei) => {
    const E = EXTRAS[id];
    if (E.bfr && (!eq.has('bfr') || !str.length)) return; // le finisher BFR suit une séance de muscu
    // plusieurs compléments : on les répartit pour ne pas tout mettre dans la même séance
    const pool = E.bfr ? str : str.concat(other);
    const picks = (pool.length > E.per ? rotate(pool.slice(0, Math.max(E.per, str.length)), ei) : pool).slice(0, E.per);
    picks.forEach((d, j) => {
      const s = days[d], lib = E.bfr ? bfrLib(s.type, j, eq) : libOf(E, eq); if (!lib) return;
      const x = LIB_BY_ID[lib];
      const it = Object.assign(JSON.parse(JSON.stringify(E.item)), { id: uid('i'), label: x.n + (E.bfr ? ' en BFR' : ''), lib, extra: id, rx: { role: 'prev', light: true } });
      if (wk.light || wk.taper) {
        it.n = Math.max(1, Math.round(it.n * (wk.taper ? 0.5 : 0.6)));
        if (it.timer && it.timer.sets) it.timer.sets = it.n;
        if (it.repsBySet) it.repsBySet = it.repsBySet.slice(0, it.n);
      }
      let b = (s.blocks || []).find(y => ['muscu', 'renfo'].includes(y.kind));
      if (!b) {
        // nouveau bloc après la séance : l'échauffement de la séance sert aussi au complément
        b = { id: uid('b'), kind: 'renfo', title: 'Complément', desc: 'Ajouté pour ton sport', items: [] };
        s.blocks = (s.blocks || []).concat([b]);
      }
      const its = b.items || (b.items = []);
      if (E.first) { const i0 = its.findIndex(y => y.id === 'ech'); its.splice(i0 + 1, 0, it); }
      else { const i1 = its.findIndex(y => y.id === 'rac'); if (i1 >= 0) its.splice(i1, 0, it); else its.push(it); }
    });
  });
}
const rotate = (a, n) => a.slice(n % a.length).concat(a.slice(0, n % a.length));
