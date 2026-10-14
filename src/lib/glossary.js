// Petit lexique : les termes techniques s'expliquent d'un appui là où ils apparaissent (et tous ensemble dans Plus → Lexique).
// t : terme affiché, d : explication courte, a : autres formes reconnues dans les textes, src : sources.
export const GLOSS = [
  { id: 'potentialisation', t: 'Potentialisation', a: ['potentialiser', 'potentialise', 'potentialisée'], d: 'Une série lourde ou explosive rend les efforts qui suivent un peu plus forts et rapides pendant quelques minutes. On s’en sert à la fin de l’échauffement et dans le contraste.', src: ['seitz2016'] },
  { id: 'reserve', t: 'Réserve', a: ['RIR'], d: 'Le nombre de répétitions que tu aurais encore pu faire à la fin de la série. Réserve 2 : il t’en restait 2. Elle règle l’intensité sans connaître ton max.', src: ['helms2016'] },
  { id: 'ressenti', t: 'Ressenti', a: ['RPE'], d: 'Note de 0 à 10 de la difficulté de toute la séance, idéalement 30 min après. Multipliée par la durée, elle donne la charge de la séance.', src: ['foster2001'] },
  { id: 'charge', t: 'Charge (ressenti × durée)', a: ['UA'], d: 'Ressenti × durée en minutes, en unités arbitraires (UA) : une séance de 60 min à 6/10 vaut 360. On suit son évolution d’une semaine à l’autre.', src: ['foster2001'] },
  { id: '1rm', t: '1RM', a: [], d: 'La charge la plus lourde soulevée une seule fois avec une bonne technique. Les charges se donnent en % de ce max.', src: ['acsm2009'] },
  { id: 'vma', t: 'VMA', a: [], d: 'Vitesse maximale aérobie : la vitesse de course à partir de laquelle tu utilises le maximum d’oxygène. Tenable environ 4 à 8 min.', src: ['billat2001'] },
  { id: 'vo2max', t: 'VO2max', a: [], d: 'La quantité maximale d’oxygène que ton corps peut utiliser par minute et par kilo : le plafond de ton moteur aérobie.' },
  { id: 'vc', t: 'Vitesse critique', a: ['VC'], d: 'La vitesse la plus haute que tu peux tenir longtemps : en dessous, l’effort se stabilise ; au-dessus, tu t’épuises en quelques minutes. La meilleure référence pour le seuil.', src: ['poole2016'] },
  { id: 'dprime', t: 'D′', a: ['D\''], d: 'La distance que tu peux courir au-dessus de ta vitesse critique avant d’être à bout : une réserve qui se vide pendant l’effort et se recharge au repos.', src: ['jones2017'] },
  { id: 'ftp', t: 'FTP', a: [], d: 'Puissance au seuil fonctionnel : la puissance (en watts) tenable environ une heure à vélo. Les zones d’entraînement se donnent en % de la FTP.', src: ['allen2010'] },
  { id: 'sweetspot', t: 'Sweet spot', a: [], d: 'Juste sous la FTP (88 à 94 %) : beaucoup de travail utile pour une fatigue modérée.', src: ['allen2010'] },
  { id: 'alac', t: 'Filière alactique', a: ['alactique'], d: 'L’énergie des efforts maximaux de moins de 10 s (phosphocréatine). Elle se recharge en 2 à 3 min : d’où les longs repos.', src: ['nsca2016'] },
  { id: 'lact', t: 'Filière lactique', a: ['lactique'], d: 'L’énergie des efforts intenses de 20 s à 2 min, ceux qui « brûlent ». Récupération de 1:3 à 1:5.', src: ['nsca2016'] },
  { id: 'aero', t: 'Filière aérobie', a: ['aérobie'], d: 'L’énergie des efforts de plus de 2 à 3 min, avec l’oxygène. La base de l’endurance et de la récupération entre les efforts.', src: ['nsca2016'] },
  { id: 'decharge', t: 'Décharge', a: ['semaine de décharge'], d: 'Semaine allégée (environ 40 % de séries en moins, loin de l’échec) pour digérer le travail des semaines précédentes et repartir plus fort.' },
  { id: 'affutage', t: 'Affûtage', a: [], d: 'Les 1 à 2 semaines avant l’objectif : volume réduit de 40 à 60 %, intensité et fréquence gardées, pour arriver frais.', src: ['bosquet2007'] },
  { id: 'meso', t: 'Mésocycle', a: ['mésocycles'], d: 'Bloc de quelques semaines avec le même objectif. Ici : 3 semaines qui montent, puis 1 semaine de décharge.' },
  { id: 'cluster', t: 'Clusters', a: ['cluster'], d: 'Une série coupée en répétitions isolées par 15 à 30 s de pause : chaque répétition reste rapide, et on peut charger un peu plus.', src: ['tufano2017'] },
  { id: 'superset', t: 'Supersets', a: ['superset'], d: 'Deux exercices en alternance, souvent une poussée et un tirage : le volume reste le même, la séance raccourcit.', src: ['robbins2010'] },
  { id: 'contraste', t: 'Contraste', a: [], d: 'Une série lourde, quelques minutes de repos, puis le même geste en explosif : on profite de la potentialisation.', src: ['seitz2016'] },
  { id: 'excentrique', t: 'Excentrique', a: [], d: 'La phase où le muscle s’allonge en freinant la charge (la descente). Lente, elle renforce particulièrement les tendons.' },
  { id: 'tempo', t: 'Tempo', a: [], d: 'Durée imposée à chaque phase du mouvement, par exemple 6 s de descente : on contrôle mieux le geste et le temps sous tension.' },
  { id: 'tut', t: 'Temps sous tension', a: [], d: 'Le temps passé à produire l’effort (sur le mur, sous la charge), sans compter les repos.' },
  { id: 'tonnage', t: 'Tonnage', a: [], d: 'La somme charge × répétitions de toutes les séries : le volume de travail d’une séance de muscu.' },
  { id: 'flash', t: 'Flash', a: [], d: 'Bloc réussi du premier coup. Ton flash : la cotation que tu passes en général du premier coup. Les séances de volume s’y calent.' },
  { id: 'avue', t: 'À vue', a: [], d: 'Voie réussie du premier coup, sans aucune information avant. Ton à vue : la cotation que tu passes ainsi en général.' },
  { id: 'max', t: 'Max enchaîné', a: ['ton max', 'ta limite'], d: 'La cotation la plus dure que tu as réussie, même après l’avoir travaillée. Les séances de force et de puissance s’y calent.' },
  { id: 'bouteiller', t: 'Bouteiller', a: ['bouteillés', 'bouteillé', 'bouteillent'], d: 'Avant-bras gonflés et durs qui ne serrent plus : la fatigue de la filière lactique.' },
  { id: '4x4', t: '4 × 4', a: [], d: '4 blocs enchaînés sans pause, 4 fois, avec 3 à 4 min de repos : le classique de la résistance en bloc.' },
  { id: 'polarise', t: 'Entraînement polarisé', a: ['polarisé'], d: 'Environ 80 % du temps en facile et 20 % en intense, très peu entre les deux.', src: ['stoggl2014'] },
  { id: 'zone2', t: 'Zone 1-2', a: ['zone 2'], d: 'Intensité facile : tu peux parler en phrases complètes. Le gros du volume en endurance.' },
  { id: 'r48', t: 'Règle des 48 h', a: [], d: 'Pas deux séances lourdes de suite sur les mêmes muscles : il faut environ 48 h pour récupérer.', src: ['acsm2009'] },
  { id: 'dp', t: 'Double progression', a: [], d: 'On monte d’abord les répétitions jusqu’au haut de la fourchette, puis la charge, et on recommence.', src: ['acsm2009'] },
  { id: 'ramp', t: 'RAMP', a: [], d: 'Méthode d’échauffement en trois temps : monter en température, activer et mobiliser, puis potentialiser en montant vers l’intensité de la séance.', src: ['jeffreys2007'] },
  { id: 'hyper', t: 'Hypertrophie', a: [], d: 'La prise de muscle : séries de 6 à 12 répétitions proches de l’échec, au moins 10 séries par muscle et par semaine.', src: ['schoenfeld2017'] },
  { id: 'bfr', t: 'BFR', a: ['occlusion vasculaire'], d: 'Blood flow restriction : un brassard en haut du bras ou de la cuisse freine le retour du sang. Une charge très légère (20 à 30 % du max) fait alors progresser la masse musculaire presque comme une charge lourde. À éviter sans avis médical en cas de problème de circulation ou de coagulation, d’hypertension, de maladie cardiaque ou de grossesse.', src: ['patterson2019', 'lixandrao2018', 'hughes2017'] },
  { id: 'aop', t: 'Pression d’occlusion', a: ['pression d\'occlusion'], d: 'La pression de brassard qui coupe complètement le sang d’un membre, mesurée avec un manomètre. En BFR, on serre à 40-80 % de cette pression ; sans manomètre, un serrage ressenti d’environ 7 sur 10, jamais douloureux ni engourdissant.', src: ['patterson2019', 'wilson2013'] }
];
export const GLOSS_BY_ID = Object.fromEntries(GLOSS.map(g => [g.id, g]));
// Expression qui repère tous les termes (le plus long d'abord), en mots entiers
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const FORMS = GLOSS.flatMap(g => [g.t].concat(g.a).map(f => [f, g.id])).sort((a, b) => b[0].length - a[0].length);
const BY_FORM = new Map(FORMS.map(([f, id]) => [f.toLowerCase(), id]));
export const GLOSS_RE = new RegExp('(^|[^\\p{L}\\d])(' + FORMS.map(([f]) => esc(f)).join('|') + ')(?=$|[^\\p{L}\\d])', 'giu');
export const glossIdOf = form => BY_FORM.get(String(form).toLowerCase()) || null;
