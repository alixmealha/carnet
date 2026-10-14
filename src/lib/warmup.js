// Échauffement conseillé selon la séance, sur le modèle RAMP (Jeffreys 2007) :
// Raise (monter en température), Activate & Mobilise (activer, mobiliser), Potentiate (monter vers l'intensité de la séance).
// Il dépend du bloc qu'il précède : doigts et bloc à la limite, volume, résistance, compétition, muscu (séries de montée
// calculées sur la charge du jour), course, vélo, épaule. Les éléments propres à l'escalade s'enrichiront avec ceux fournis par Alix.
import { jget } from './store.js';
import { blocks, itemLoad } from './plan.js';
import { climbLevel } from './levels.js';
import { shiftGrade } from './grades.js';
import { fmtNum } from './dates.js';

const R = (t, d) => ({ ph: 'R', t, d }), A = (t, d) => ({ ph: 'A', t, d }), P = (t, d) => ({ ph: 'P', t, d });
export const PH_LBL = { R: 'Monter en température', A: 'Activer et mobiliser', P: 'Potentialiser' };
const r25 = v => Math.round(v / 2.5) * 2.5;

// Focus du bloc : ce qui décide de la fin de l'échauffement
function focusOf(b) {
  const its = (b.items || []).filter(it => it.id !== 'ech' && it.id !== 'rac');
  const has = re => its.some(it => re.test((it.label || '') + ' ' + (it.det || '') + ' ' + (it.lib || '')));
  if (b.kind === 'doigts') return 'doigts';
  if (b.kind === 'compet' || has(/qualif|contest|flash|compet/i)) return 'compet';
  if (b.kind === 'grimpe') {
    if (its.some(it => it.unit === 'Essai') || has(/limite|campus|pan/i)) return 'limite';
    if (has(/4 ?[×x] ?4|résistance|intervalles|enchaîn/i)) return 'resist';
    return 'volume';
  }
  if (['muscu', 'renfo'].includes(b.kind)) return its.some(it => it.timer && it.timer.kind === 'contrast') || has(/explosi|saut|puissance/i) ? 'puiss' : 'force';
  if (b.kind === 'epaule') return 'epaule';
  if (b.kind === 'course') return has(/sprint|vitesse/i) ? 'sprint' : has(/intervalle|30\/30|seuil|300 m|vite/i) ? 'int' : 'easy';
  if (b.kind === 'velo') return has(/4 ?× ?4|sweet|lactique|vite|circuit/i) ? 'velo-int' : 'velo-easy';
  if (b.kind === 'sport') return 'sport';
  return null;
}
// Séries de montée en charge pour le premier exercice chargé du bloc
function rampSets(k, b) {
  const e = jget(k);
  for (const it of b.items || []) {
    if (it.id === 'ech') continue;
    const ld = itemLoad(b, it, e); if (!ld || ld.v == null) continue;
    const w = ld.v;
    if (ld.u === '+kg') return { it, txt: 'poids de corps × 5, puis ' + (w > 5 ? '+' + fmtNum(r25(w * 0.5)) + ' kg × 3, +' + fmtNum(r25(w * 0.8)) + ' kg × 1' : 'une série à la charge du jour × 2') };
    if (w < 30) return { it, txt: fmtNum(r25(w * 0.5)) + ' kg × 8, puis ' + fmtNum(r25(w * 0.75)) + ' kg × 4' };
    const bar = 20, steps = [[Math.max(bar, r25(w * 0.4)), 8], [r25(w * 0.6), 5], [r25(w * 0.75), 3], [r25(w * 0.88), 1]].filter((x, i, a) => i === 0 || x[0] > a[i - 1][0]);
    return { it, txt: steps.map(([v, n]) => fmtNum(v) + ' kg × ' + n).join(', ') };
  }
  return null;
}

export function warmupFor(k, b) {
  const f = focusOf(b); if (!f) return null;
  const lv = climbLevel(), bf = lv.bf && lv.bf.g, bm = lv.bm && lv.bm.g;
  const climbUp = top => bf ? 'de ' + shiftGrade(bf, -4, 'bloc') + ' à ' + (top || shiftGrade(bf, -1, 'bloc')) : 'de très facile jusqu’à 1 ou 2 niveaux sous ' + (top ? 'ta limite' : 'ton niveau du jour');
  const mobUp = A('Mobilité du haut du corps', 'Cercles d’épaules, rotations externes à l’élastique 2 × 10, flexions-extensions des poignets, ouverture des doigts');
  switch (f) {
    case 'doigts':
    case 'limite':
    case 'compet': return { min: f === 'compet' ? 25 : 20, steps: [
      R('Grimpe très facile ou cardio léger', '5 à 8 min, jusqu’à transpirer un peu'),
      mobUp,
      A('Hanches et gainage', 'Grenouille au mur, fentes, 2 × 20 s de gainage'),
      Object.assign(P('Doigts en rampe · 7 × 7/3', '7 suspensions de 7 s, 3 s de pause, en montant progressivement la charge d’une suspension à l’autre et en changeant de préhension (tendu, semi-arqué, arqué, pince)'), { timer: { kind: 'interval', name: 'Doigts 7/3', work: 7, rest: 3, reps: 7, sets: 1, setRest: 0, prep: 10, workLabel: 'Suspends', restLabel: 'Pause' }, src: ['remilieux'] }),
      P('Blocs de plus en plus durs', '4 à 6 blocs ' + climbUp(f === 'doigts' ? null : bm) + ', repos complet entre les derniers'),
      P(f === 'compet' ? 'Mise en situation' : '1 ou 2 essais proches du max', f === 'compet' ? '1 bloc lu puis tenté comme en compétition, 3 min de repos avant de commencer' : 'Mouvements durs mais propres : tu dois finir l’échauffement frais')
    ], why: 'Les doigts et les épaules montent en charge progressivement avant les efforts maximaux : force et précision sont meilleures, le risque de blessure plus bas. Doigts : 7 × 7/3 de Julien Remilieux.' };
    case 'resist': return { min: 15, steps: [
      R('Grimpe très facile', '5 min'),
      mobUp,
      P('Blocs progressifs', '3 ou 4 blocs ' + climbUp(null)),
      P('Un avant-goût', '1 enchaînement court (2 blocs) au niveau de la séance, puis 3 min de repos')
    ], why: 'La filière lactique se prépare avec un effort court au niveau de la séance.' };
    case 'volume': return { min: 10, steps: [
      R('Traversées faciles', '5 min de grimpe très facile'),
      mobUp,
      P('Monter jusqu’à la cotation du jour', '2 ou 3 blocs de plus en plus proches de celle de la séance')
    ], why: 'Séance à intensité modérée : un échauffement court suffit, le début de séance finit le travail.' };
    case 'force':
    case 'puiss': {
      const rs = rampSets(k, b);
      const steps = [
        R('Cardio léger', '5 min de vélo, rameur ou corde à sauter'),
        A('Mobiliser et activer', 'Hanches et chevilles (squats lents, fentes), épaules (élastique), 2 × 20 s de gainage'),
        P('Séries de montée en charge', rs ? rs.it.label + ' : ' + rs.txt + ' · repos court entre les séries' : '3 ou 4 séries de plus en plus lourdes sur le premier exercice, de moins en moins de répétitions')
      ];
      if (f === 'puiss') steps.push(P('Réveil nerveux', '3 sauts verticaux ou 2 lancers, intention maximale'));
      return { min: 12, steps, why: 'Les séries de montée préparent le mouvement et le système nerveux sans fatiguer : environ 40, 60, 75 puis 85-90 % de la charge du jour.' };
    }
    case 'epaule': return { min: 5, steps: [
      R('Cercles de bras', '2 à 3 min de mouvements d’épaules'),
      A('Activer la coiffe', 'Rotations externes à l’élastique léger, 2 × 12'),
      P('Une série légère', 'Le premier exercice à environ 50 % de la charge, 8 répétitions')
    ], why: 'Petits muscles stabilisateurs : une activation légère suffit.' };
    case 'int':
    case 'sprint': return { min: 20, steps: [
      R('Footing', '10 à 15 min faciles'),
      A('Gammes', 'Montées de genoux, talons-fesses, pas chassés, foulées bondissantes : 2 × 20 m chacun'),
      P('Accélérations', (f === 'sprint' ? '4 accélérations de 30 m jusqu’à la vitesse maximale' : '3 accélérations progressives de 80 m, la dernière à l’allure de la séance') + ', retour en marchant')
    ], why: 'Les accélérations amènent progressivement à l’intensité de la séance (potentialisation).' };
    case 'easy': return { min: 5, steps: [R('Démarrer très lentement', 'Les 5 à 10 premières minutes plus lentes que l’allure prévue : c’est l’échauffement')], why: 'En endurance facile, le début de la sortie sert d’échauffement.' };
    case 'velo-int': return { min: 15, steps: [
      R('Pédalage progressif', '10 min en endurance, en montant doucement'),
      P('Rappels d’intensité', '3 × 1 min à l’intensité de la séance, 1 min facile entre')
    ], why: 'Les rappels courts préparent le cœur et les jambes à l’intensité des intervalles.' };
    case 'velo-easy': return { min: 5, steps: [R('Démarrer souple', '5 à 10 min très faciles, cadence haute')], why: 'En endurance, le début de la sortie sert d’échauffement.' };
    case 'sport': return { min: 15, steps: [
      R('Course légère', '5 min'),
      A('Mobiliser', 'Hanches, chevilles, épaules : mouvements dynamiques du sport'),
      P('Gestes du sport', 'Démarrages, changements de direction, gestes techniques à vitesse croissante')
    ], why: 'Échauffement RAMP : du général au spécifique.' };
  }
  return null;
}
// Échauffement de la séance du jour : celui du premier bloc qui en a un
export function warmupOfDay(k) { for (const b of blocks(k)) { const w = warmupFor(k, b); if (w) return { b, w }; } return null; }
