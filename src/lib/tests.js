// Tests physiques : catalogue, tests perso, résultats datés (docs t:AAAA-MM-JJ) et historique.
// Résultat : res[idTest] = { v: 30 } ou, avec deux côtés, { 'v.D': 33.3, 'v.G': 38.1 } ; plusieurs mesures : { cf: 20, wp: 1800 }.
import { get, ids, put, remove, profileOf, getSubject, getFor, putFor, SELF } from './store.js';
import { todayKey } from './dates.js';

export const CATS = [
  ['doigts', 'Doigts'], ['tirage', 'Tirage'], ['poussee', 'Poussée'], ['force', 'Force (muscu)'], ['gainage', 'Gainage'],
  ['puissance', 'Puissance'], ['epaule', 'Épaule'], ['mobilite', 'Mobilité'], ['aerobie', 'Aérobie'], ['corps', 'Mesures'], ['perso', 'Mes tests']
];
const M = (k, l, unit, better) => ({ k, l, unit, better: better || 'up' });
const V = unit => [M('v', 'Résultat', unit)];

export const CATALOG = [
  { id: 'fmax-semi', cat: 'doigts', name: 'Force max semi-arquée 20 mm', sides: true, measures: V('kg'), rel: true,
    equip: 'Réglette de 20 mm, dynamomètre (ou baudrier et charges pour la version suspension).',
    proto: ['Échauffement doigts progressif : 3 tractions de 10 s à 50, 70 et 85 % de l’effort.', 'Une main, prise semi-arquée, bras tendu, épaule engagée.', 'Tirer au maximum pendant 10 s, garder le pic (ou la charge tenue 10 s).', '2 essais par main, 3 min entre essais, 5 min entre les mains. Garder le meilleur.'],
    tips: 'Même réglette, même position et même heure à chaque passation. La valeur rapportée au poids de corps est la plus parlante.', src: ['michailov2018', 'balas2012'] },
  { id: 'fmax-tendu', cat: 'doigts', name: 'Force max tendu 3 doigts 20 mm', sides: true, measures: V('kg'), rel: true,
    equip: 'Réglette de 20 mm, dynamomètre ou charges.',
    proto: ['Même protocole que la semi-arquée, prise tendue à 3 doigts (index, majeur, annulaire).', '2 essais par main, 3 min entre essais, 5 min entre les mains.'],
    tips: 'À faire après la semi-arquée, dans le même ordre à chaque passation.', src: ['michailov2018'] },
  { id: 'fl-semi', cat: 'doigts', name: 'Finger lift max · semi-arqué', sides: false, measures: V('kg'),
    equip: 'Bloc de finger lift (ou réglette de 20 mm), chargeur et disques.',
    proto: ['Échauffement progressif sur le bloc : 3 levées de 7 s en montant la charge.', 'Prise semi-arquée, une main, soulever 7 s sans à-coup.', 'Monter par paliers de 2,5 à 5 kg, 3 min entre les essais, jusqu’à l’échec.', 'Noter la charge la plus lourde tenue 7 s.'],
    tips: 'Le finger lift sert de référence pour calculer les charges en % des blocs suivants.', src: ['michailov2018'] },
  { id: 'fl-tendu', cat: 'doigts', name: 'Finger lift max · tendu', sides: false, measures: V('kg'),
    equip: 'Bloc de finger lift, chargeur et disques.',
    proto: ['Même protocole que le semi-arqué, prise tendue.', 'Noter la charge la plus lourde tenue 7 s.'], src: ['michailov2018'] },
  { id: 'cf', cat: 'doigts', name: 'Force critique (7 s / 3 s)', sides: true, measures: [M('cf', 'Force critique', 'kg'), M('pic', 'Pic', 'kg')], rel: true,
    equip: 'Réglette de 20 mm et dynamomètre avec enregistrement.',
    proto: ['Échauffement complet des doigts.', '24 tractions de 7 s à effort maximal, 3 s de repos entre chaque (4 min au total), une main.', 'Force critique = moyenne des 6 dernières tractions ; pic = meilleure traction.'],
    tips: 'Test le plus fatigant : toujours en dernier.', src: ['giles2019'] },
  { id: 'repeaters', cat: 'doigts', name: 'Répétiteurs 7 s / 3 s à l’échec', sides: false, measures: V('rép.'),
    equip: 'Poutre ou réglette de 20 mm.',
    proto: ['Deux mains, semi-arquée, poids de corps.', 'Suspensions de 7 s, 3 s de repos, jusqu’à l’échec.', 'Noter le nombre de suspensions complètes.'], src: ['balas2012'] },
  { id: 'pinch', cat: 'doigts', name: 'Pince (pinch)', sides: true, measures: V('kg'), rel: true,
    equip: 'Bloc de pince et charges, ou dynamomètre de pince.',
    proto: ['Pince de largeur fixe, bras tendu.', 'Tenir 7 s à la charge maximale (ou pic sur 5 s au dynamomètre).', '2 essais par main, 3 min de repos.'] },

  { id: 'pull-1rm', cat: 'tirage', name: 'Traction 1RM (lest)', sides: false, measures: V('kg'), rel: 'lest',
    equip: 'Barre, baudrier ou ceinture de lest (ou sac à dos pesé).',
    proto: ['Échauffement : 2 séries au poids de corps puis 2 à 3 montées en charge.', 'Prise pronation, départ bras tendus, menton au-dessus de la barre, sans élan.', 'Paliers de 2,5 kg, 3 à 4 min de repos, 4 à 5 tentatives au maximum.', 'Noter le lest de la meilleure répétition (0 = poids de corps).'],
    tips: 'En % du poids de corps : (poids + lest) ÷ poids.' },
  { id: 'pull-5rm', cat: 'tirage', name: 'Traction 5RM (lest)', sides: false, measures: V('kg'), rel: 'lest',
    equip: 'Barre et lest pesé.',
    proto: ['Même échauffement que le 1RM.', 'Charge la plus lourde pour 5 répétitions strictes.', '1RM estimé ≈ (poids + lest) × 1,167.'] },
  { id: 'pull-max', cat: 'tirage', name: 'Max tractions strictes', sides: false, measures: V('rép.'),
    equip: 'Barre de traction.',
    proto: ['Prise pronation, amplitude complète.', 'La série s’arrête à la dernière répétition stricte (sans kipping ni demi-amplitude).'] },
  { id: 'lock-90', cat: 'tirage', name: 'Blocage 1 bras à 90°', sides: true, measures: V('s'),
    equip: 'Barre, sangle pour l’autre main si besoin, chrono.',
    proto: ['Se hisser, coude à 90°, lâcher l’autre main.', 'Tenir le plus longtemps possible.', '2 essais par bras, 3 min de repos.'] },
  { id: 'power-slap', cat: 'tirage', name: 'Power slap', sides: false, measures: V('cm'),
    equip: 'Pan incliné ou barre, ruban gradué vertical.',
    proto: ['Départ suspendu bras tendus sur deux prises.', 'Tirage explosif et lancer d’une main le plus haut possible le long du ruban.', '3 essais, 2 min de repos, garder le meilleur.'], src: ['laffaye2014'] },

  { id: 'dips-1rm', cat: 'poussee', name: 'Dips 1RM (lest)', sides: false, measures: V('kg'), rel: 'lest',
    equip: 'Barres parallèles, lest.',
    proto: ['Échauffement progressif.', 'Descente jusqu’à épaule sous le coude, remontée complète.', 'Paliers de 2,5 kg, 3 à 4 min de repos.'] },
  { id: 'dips-max', cat: 'poussee', name: 'Max dips', sides: false, measures: V('rép.'),
    equip: 'Barres parallèles (élastique d’assistance noté si utilisé).',
    proto: ['Amplitude complète, rythme régulier.', 'Arrêt à la dernière répétition complète.', 'Noter l’élastique éventuel dans la note.'] },
  { id: 'pushups', cat: 'poussee', name: 'Max pompes', sides: false, measures: V('rép.'),
    proto: ['Corps gainé, poitrine à un poing du sol.', 'Arrêt quand le gainage ou l’amplitude se dégrade.'] },

  { id: 'squat-1rm', cat: 'force', name: 'Squat 1RM', sides: false, measures: V('kg'), rel: true,
    equip: 'Barre, rack avec sécurités, disques.',
    proto: ['Échauffement : 2 séries légères puis montées en charge (5, 3, 2, 1 répétitions).', 'Descente au moins cuisses parallèles, remontée complète, sans rebond.', 'Paliers de 2,5 à 5 kg, 3 à 5 min de repos, 3 à 5 tentatives au maximum.', 'Ou plus prudent : 3 à 5 répétitions maximales, 1RM estimé = charge × (1 + rép. ÷ 30).'],
    tips: 'Toujours avec sécurités ou pareur. L’estimation sur 3 à 5 répétitions suffit pour régler les charges du programme.' },
  { id: 'bench-1rm', cat: 'force', name: 'Développé couché 1RM', sides: false, measures: V('kg'), rel: true,
    equip: 'Banc, barre, sécurités ou pareur.',
    proto: ['Même échauffement progressif que le squat.', 'Barre touchée à la poitrine sans rebond, fesses sur le banc.', 'Paliers de 1 à 2,5 kg, 3 à 5 min de repos.', 'Ou 3 à 5 répétitions maximales : 1RM estimé = charge × (1 + rép. ÷ 30).'] },
  { id: 'deadlift-1rm', cat: 'force', name: 'Soulevé de terre 1RM', sides: false, measures: V('kg'), rel: true,
    equip: 'Barre et disques.',
    proto: ['Échauffement progressif.', 'Dos neutre du début à la fin, barre près du corps, verrouillage hanches et genoux en haut.', 'Paliers de 5 kg puis 2,5 kg, 3 à 5 min de repos.', 'Ou 3 à 5 répétitions maximales : 1RM estimé = charge × (1 + rép. ÷ 30).'] },

  { id: 'plank-side', cat: 'gainage', name: 'Gainage latéral', sides: true, measures: V('s'),
    proto: ['Sur l’avant-bras, jambes tendues, corps aligné.', 'Arrêt dès que le bassin s’affaisse.', '1 essai par côté, 2 min de repos.'] },
  { id: 'plank-arms', cat: 'gainage', name: 'Gainage bras tendus', sides: false, measures: V('s'),
    proto: ['Planche sur les mains, bras tendus.', 'Arrêt dès que le bassin bouge ou que le dos se creuse.'] },
  { id: 'lever', cat: 'gainage', name: 'Levée de jambes suspendu', sides: false, measures: V('rép.'),
    proto: ['Suspendu à la barre, jambes tendues jusqu’à la barre ou à l’horizontale (à préciser).', 'Sans balancement.'] },

  { id: 'cmj', cat: 'puissance', name: 'CMJ (saut contre-mouvement)', sides: false, measures: V('cm'),
    equip: 'Tapis de saut, appli vidéo (type My Jump) ou cellules.',
    proto: ['Mains aux hanches, descente rapide puis saut vertical maximal.', 'Réception sur les deux pieds, genoux dans l’axe.', '3 essais, 30 s de repos, garder le meilleur (ou la moyenne).'],
    tips: 'Filmer de face pour vérifier l’axe des genoux à la réception.', src: ['claudino2017'] },
  { id: 'dyno-h', cat: 'puissance', name: 'Dyno horizontal max', sides: false, measures: V('cm'),
    equip: 'Pan, prises de départ et d’arrivée standardisées, mètre.',
    proto: ['Départ et prises toujours identiques.', 'Jeté latéral, distance entre prise de départ et prise attrapée.', '3 essais, 2 min de repos.'] },

  { id: 'ir-90', cat: 'epaule', name: 'Rotation interne à 90°', sides: true, measures: V('kg'),
    equip: 'Dynamomètre (ou peson) et sangle.',
    proto: ['Bras à 90° d’abduction, coude à 90°.', 'Poussée maximale de 5 s vers la rotation interne.', '3 essais par côté, 30 s de repos, garder le meilleur.'], src: ['byram2010'] },
  { id: 'er-90', cat: 'epaule', name: 'Rotation externe à 90°', sides: true, measures: V('kg'),
    equip: 'Dynamomètre (ou peson) et sangle.',
    proto: ['Même position que la rotation interne.', 'Poussée maximale de 5 s vers la rotation externe.', '3 essais par côté, garder le meilleur.'],
    tips: 'Le rapport RE/RI se calcule tout seul quand les deux tests sont faits le même jour.', src: ['byram2010'] },

  { id: 'wall-test', cat: 'mobilite', name: 'Wall test cheville (genou-mur)', sides: true, measures: V('cm'),
    equip: 'Mur, mètre ruban au sol.',
    proto: ['Pied face au mur, talon au sol, genou qui vient toucher le mur.', 'Reculer le pied jusqu’à la distance maximale où le genou touche sans décoller le talon.', 'Mesurer la distance orteil-mur.'], src: ['bennell1998'] },
  { id: 'shoulder-flex', cat: 'mobilite', name: 'Flexion d’épaule dos au mur', sides: true, measures: V('°'),
    proto: ['Dos et lombaires plaqués au mur, bras tendus.', 'Monter les bras le plus haut possible sans décoller les lombaires.', 'Mesurer l’angle (appli inclinomètre) ou noter 180° si le pouce touche le mur.'] },
  { id: 'hip-ri', cat: 'mobilite', name: 'Rotation interne de hanche à 90°', sides: true, measures: V('°'),
    proto: ['Assis ou sur le dos, hanche et genou à 90°.', 'Rotation interne passive maximale, mesurer l’angle.', 'Noter toute gêne à l’aine.'] },
  { id: 'hip-re', cat: 'mobilite', name: 'Rotation externe de hanche à 90°', sides: true, measures: V('°'),
    proto: ['Même position, rotation externe passive maximale.'] },

  { id: 'sit-reach', cat: 'mobilite', name: 'Sit and reach (souplesse postérieure)', sides: false, measures: V('cm'),
    equip: 'Une marche ou une boîte, un mètre ruban.',
    proto: ['Échauffement léger, assis jambes tendues, plante des pieds contre la marche.', 'Mains l’une sur l’autre, aller le plus loin possible en 2 s, sans à-coup, genoux tendus.', 'Mesurer le bout des doigts par rapport aux orteils : positif au-delà, négatif avant.', '3 essais, garder le meilleur.'], src: ['acsm2021'] },
  { id: 'slr', cat: 'mobilite', name: 'Élévation jambe tendue (ischio-jambiers)', sides: true, measures: V('°'),
    equip: 'Un partenaire, le téléphone en inclinomètre.',
    proto: ['Sur le dos, l’autre jambe à plat au sol, bassin qui ne bouge pas.', 'Le partenaire lève la jambe tendue, cheville relâchée, jusqu’à la tension franche.', 'Téléphone posé sur le tibia : angle de la jambe avec le sol.'] },
  { id: 'thomas', cat: 'mobilite', name: 'Test de Thomas modifié (fléchisseurs de hanche)', sides: true, measures: [M('v', 'Angle de la cuisse', '°', 'down')],
    equip: 'Une table ou un banc haut, le téléphone en inclinomètre.',
    proto: ['Assis au bord de la table, s’allonger en ramenant un genou contre la poitrine (bas du dos plaqué).', 'L’autre jambe pend librement.', 'Téléphone sur la cuisse qui pend : angle avec l’horizontale. Positif = cuisse au-dessus de l’horizontale (fléchisseurs raides).'], tips: 'Plus l’angle est bas, mieux c’est ; une cuisse sous l’horizontale est normale.', src: ['harvey1998'] },
  { id: 'shoulder-er', cat: 'mobilite', name: 'Rotation externe d’épaule à 90°', sides: true, measures: V('°'),
    equip: 'Le téléphone en inclinomètre.',
    proto: ['Sur le dos, bras écarté à 90°, coude plié à 90°.', 'Laisser la main partir vers l’arrière en rotation externe, sans cambrer.', 'Téléphone sur l’avant-bras : « Remettre à zéro » avant-bras vertical, puis mesurer en fin de rotation.'] },
  { id: 'frog', cat: 'mobilite', name: 'Grenouille au mur (ouverture de hanche)', sides: false, measures: [M('v', 'Distance bassin-mur', 'cm', 'down')],
    equip: 'Un mur, un mètre ruban.',
    proto: ['Face au mur, pieds au mur, talons joints, genoux ouverts sur les côtés, comme en escalade.', 'Rapprocher le bassin du mur le plus possible, buste droit.', 'Mesurer la distance entre le pubis et le mur.'], tips: 'Le test de l’ouverture de hanche utile pour rester près du mur en grimpe.' },
  { id: 'foot-raise', cat: 'mobilite', name: 'Montée de pied (high step)', sides: true, measures: [M('v', 'Hauteur du pied', 'cm')],
    equip: 'Un mur, un mètre ruban (ou des marques au mur).',
    proto: ['Face au mur, pieds au sol, mains au mur à hauteur d’épaules.', 'Monter un pied le plus haut possible le long du mur, sans décoller l’autre talon.', 'Mesurer la hauteur de la pointe du pied.'], tips: 'Rapporté à ta taille, c’est le meilleur indicateur de souplesse utile en grimpe.', src: ['draper2009'] },
  { id: 'leg-span', cat: 'mobilite', name: 'Écart latéral (leg span)', sides: false, measures: [M('v', 'Écart entre les pieds', 'cm')],
    equip: 'Un mur, un mètre ruban au sol.',
    proto: ['Dos au mur, jambes tendues écartées sur les côtés.', 'Écarter le plus possible sans douleur, talons au sol.', 'Mesurer la distance entre les deux talons.'], src: ['draper2009'] },

  { id: 'vma', cat: 'aerobie', name: 'VMA palier 1 min (tapis)', sides: false, measures: V('km/h'),
    equip: 'Tapis de course.',
    proto: ['Échauffement 10 min.', 'Départ à 8 km/h, +1 km/h chaque minute.', 'VMA = vitesse du dernier palier complet (+ fraction du palier entamé).'] },

  { id: 'vameval', cat: 'aerobie', name: 'VAMEVAL (piste, bips)', sides: false, measures: V('km/h'),
    equip: 'Piste avec plots tous les 20 m, bande sonore VAMEVAL (bips) ou application.',
    proto: ['Échauffement 15 min avec quelques accélérations.', 'Départ à 8 km/h, +0,5 km/h chaque minute : à chaque bip, tu es à la hauteur d’un plot.', 'Arrêt après deux plots manqués de plus de 3 m.', 'VMA = vitesse du dernier palier tenu (si tu as couru la moitié du palier suivant, ajoute 0,25).'],
    tips: 'Sur piste, le résultat est plus fiable que sur tapis. Refais le test toutes les 6 à 8 semaines : les allures des intervalles en dépendent.', src: ['billat2001'] },
  { id: 'css', cat: 'aerobie', name: 'Vitesse critique en natation (400 m + 200 m)', sides: false, measures: [M('t400', 'Temps du 400 m', 's', 'down'), M('t200', 'Temps du 200 m', 's', 'down')],
    equip: 'Bassin de 25 ou 50 m, chronomètre.',
    proto: ['Échauffement 400 m avec quelques accélérations de 25 m.', '400 m le plus vite possible, allure régulière. Note le temps en secondes (6 min 30 s = 390).', 'Récupération complète : idéalement un autre jour (au moins 30 min sinon).', '200 m le plus vite possible. Note le temps en secondes.', 'CSS = 200 m ÷ (temps du 400 − temps du 200), en m/s ; allure au 100 m = 100 ÷ CSS.'],
    tips: 'Un écart de moins de 0,07 à 0,12 m/s entre deux tests n’est pas un vrai changement. Refais-le toutes les 8 à 10 semaines.', src: ['wakayoshi1992'],
    derive: v => { if (!(v.t400 > 0 && v.t200 > 0 && v.t400 > v.t200 * 2)) return null; const c = 200 / (v.t400 - v.t200), s = Math.round(100 / c); return 'CSS ' + (Math.round(c * 100) / 100).toString().replace('.', ',') + ' m/s · ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' /100 m'; } },
  { id: 'run-5k', cat: 'aerobie', name: '5 km chrono', sides: false, measures: [M('v', 'Temps', 'min', 'down')],
    equip: 'Piste, parcours plat mesuré ou montre GPS.',
    proto: ['Échauffement 10 à 15 min avec quelques accélérations.', '5 km le plus vite possible, allure régulière.', 'Temps en minutes décimales : 22 min 30 s = 22,5.'] },
  { id: 'cooper', cat: 'aerobie', name: 'Test de Cooper (12 min)', sides: false, measures: V('m'),
    equip: 'Piste de 400 m ou montre GPS.',
    proto: ['Échauffement 10 min.', 'Courir la plus grande distance possible en 12 min.', 'VO2max estimée ≈ (distance − 504,9) ÷ 44,73 (Cooper, 1968).'] },
  { id: 'cs', cat: 'aerobie', name: 'Vitesse critique (3 min + 12 min)', sides: false, measures: [M('d3', 'Distance en 3 min', 'm'), M('d12', 'Distance en 12 min', 'm')],
    equip: 'Piste de 400 m ou montre GPS.',
    proto: ['Échauffement 15 min avec quelques accélérations.', '3 min à fond : la plus grande distance possible.', 'Au moins 30 min de récupération (ou un autre jour).', '12 min à fond, allure régulière.', 'Vitesse critique = (distance 12 min − distance 3 min) ÷ 9 min ; D′ = ce que tu peux courir au-dessus.'],
    tips: 'La vitesse critique sépare les efforts tenables longtemps de ceux qui épuisent vite : c’est la meilleure référence pour les séances au seuil.', src: ['poole2016', 'jones2017'],
    derive: v => { if (!(v.d3 > 0 && v.d12 > v.d3)) return null; const cs = (v.d12 - v.d3) / 540, dp = v.d3 - cs * 180; return 'Vitesse critique ' + (Math.round(cs * 36) / 10).toString().replace('.', ',') + ' km/h · D′ ≈ ' + Math.max(0, Math.round(dp / 5) * 5) + ' m'; } },
  { id: 'vo2max', cat: 'aerobie', name: 'VO2max (montre ou laboratoire)', sides: false, measures: V('ml/kg/min'),
    proto: ['Valeur donnée par ta montre (Garmin, Polar, Coros…) après plusieurs sorties, ou mesurée en laboratoire.', 'À défaut, l’appli l’estime d’après ta VMA (environ 3,5 × VMA).'], tips: 'Les estimations des montres varient de quelques points : compare-la à elle-même dans le temps.' },
  { id: 'ftp', cat: 'aerobie', name: 'FTP vélo (20 min)', sides: false, measures: [M('p20', 'Puissance moyenne sur 20 min', 'W')],
    equip: 'Vélo avec capteur de puissance ou home-trainer connecté.',
    proto: ['Échauffement 20 min avec 3 accélérations d’1 min.', '5 min à fond puis 10 min faciles (version complète), ou directement :', '20 min le plus fort possible, puissance régulière.', 'FTP ≈ 95 % de la puissance moyenne des 20 min.'], src: ['allen2010'],
    derive: v => v.p20 > 0 ? 'FTP ≈ ' + Math.round(v.p20 * 0.95) + ' W' : null },
  { id: 'poids', cat: 'corps', name: 'Poids de corps', sides: false, measures: [M('v', 'Poids', 'kg', 'none')],
    proto: ['Le matin, à jeun, après être passé aux toilettes.', 'Sert à calculer les valeurs en % du poids de corps.'] }
];

export const customTests = () => ((get('tests') || {}).list || []);
export function allTests() { return CATALOG.concat(customTests().map(t => Object.assign({ cat: 'perso', measures: V(t.unit || '') }, t, { custom: true }))); }
export const testById = id => allTests().find(t => t.id === id);
export function saveCustomTest(t) {
  const list = customTests().filter(x => x.id !== t.id); list.push(t); put('tests', { list });
}
export function deleteCustomTest(id) { put('tests', { list: customTests().filter(x => x.id !== id) }); }

// Clés de valeur d'un test : [{ key, label, unit, better }]
export function valueKeys(t) {
  const out = [];
  for (const m of t.measures) {
    if (t.sides) for (const [s, l] of [['D', 'droite'], ['G', 'gauche']]) out.push({ key: m.k + '.' + s, label: (t.measures.length > 1 ? m.l + ' ' : '') + l, unit: m.unit, better: m.better, side: s, m: m.k });
    else out.push({ key: m.k, label: t.measures.length > 1 || m.l !== 'Résultat' ? m.l : '', unit: m.unit, better: m.better, m: m.k });
  }
  return out;
}

export const testDays = () => ids('t:').map(id => id.slice(2));
export const resultsOn = k => (get('t:' + k) || {});
export function saveResults(k, patch) {
  const cur = resultsOn(k), res = Object.assign({}, cur.res);
  for (const [tid, vals] of Object.entries(patch.res || {})) {
    const clean = {}; for (const [kk, v] of Object.entries(vals)) if (typeof v === 'number' && !isNaN(v)) clean[kk] = v;
    if (Object.keys(clean).length) res[tid] = clean; else delete res[tid];
  }
  const next = Object.assign({}, cur, patch, { res });
  if (patch.bw === null) delete next.bw;
  if (next.note === undefined) delete next.note;
  if (!Object.keys(res).length && !next.note && typeof next.bw !== 'number') { if (get('t:' + k)) remove('t:' + k); return; }
  if (JSON.stringify(next) === JSON.stringify(cur)) return;
  put('t:' + k, next);
}

// Poids de corps connu à une date (noté avec les tests ou test « poids »)
export function bodyWeightAt(k) {
  let best = null;
  for (const d of testDays()) {
    if (d > k) break;
    const r = resultsOn(d);
    if (typeof r.bw === 'number') best = r.bw;
    else if (r.res && r.res.poids && typeof r.res.poids.v === 'number') best = r.res.poids.v;
  }
  if (best === null) { const w = Number(profileOf(getSubject()).weight_kg); if (w > 0) best = w; } // à défaut, le poids du profil
  return best;
}

// Historique d'un test : [{ k, vals, bw, note }]
export function history(tid) {
  const out = [];
  for (const d of testDays()) { const r = resultsOn(d); if (r.res && r.res[tid]) out.push({ k: d, vals: r.res[tid], bw: typeof r.bw === 'number' ? r.bw : bodyWeightAt(d), note: r.note }); }
  return out;
}
export function lastResult(tid) { const h = history(tid); return h.length ? h[h.length - 1] : null; }
export const pct = (a, b) => (typeof a === 'number' && typeof b === 'number' && b !== 0) ? (a - b) / Math.abs(b) * 100 : null;
// Valeur rapportée au poids de corps (en %)
export function relValue(t, v, bw) {
  if (!t.rel || typeof v !== 'number' || !bw) return null;
  return t.rel === 'lest' ? (bw + v) / bw * 100 : v / bw * 100;
}

// Poids saisi dans le profil : noté aussi comme mesure du jour (test « Poids de corps ») pour garder l'historique
export function logWeight(w) {
  if (!(w > 0)) return;
  const k = todayKey(), cur = getFor(SELF, 't:' + k) || {}, res = Object.assign({}, cur.res);
  if (res.poids && res.poids.v === w) return;
  res.poids = { v: w };
  putFor(SELF, 't:' + k, Object.assign({}, cur, { res }));
}
