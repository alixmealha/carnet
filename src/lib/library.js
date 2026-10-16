// Bibliothèque d'exercices pour l'assistant de programme.
// Chaque exercice : type de séance (k), sports (sp), qualités travaillées (q), groupes sollicités (g, pour la règle des 48 h),
// matériel (eq : un seul suffit), niveau minimal (lvl 1 à 3), forme (t), charge (ld), séance « lourde » (heavy),
// déconseillé aux moins de 18 ans (u18: false), schéma de mouvement (pat) et consigne (c).
// Repères de prescription : ACSM 2009, NSCA (Haff & Triplett 2016), Schoenfeld 2016-2017, Helms 2016.

export const EQUIP = [
  ['salle', 'Salle de muscu'], ['halteres', 'Haltères / kettlebell'], ['traction', 'Barre de traction'], ['poutre', 'Poutre (pan, fingerboard)'],
  ['salle-esc', 'Salle d’escalade'], ['elastique', 'Élastiques'], ['exterieur', 'Extérieur (piste, route)'], ['velo', 'Vélo / home-trainer'], ['piscine', 'Piscine'], ['bfr', 'Brassards BFR']
];
// Ce qu'apporte chaque choix (une salle de muscu a des barres, des haltères, une barre de traction…)
export function equipSet(list) {
  const s = new Set(['rien']);
  for (const e of list || []) {
    s.add(e);
    if (e === 'salle') ['barre', 'halteres', 'machines', 'traction', 'elastique'].forEach(x => s.add(x));
    if (e === 'salle-esc') ['poutre', 'traction', 'pan'].forEach(x => s.add(x));
  }
  return s;
}

const E = (id, n, k, o) => Object.assign({ id, n, k, sp: ['all'], q: [], g: [], eq: ['rien'], lvl: 1, t: 'reps', ld: 'kg', heavy: false, pat: '' }, o);
export const LIB = [
  // ---- Jambes : squat
  E('squat', 'Squat barre', 'muscu', { q: ['force', 'hyper', 'endu_f'], g: ['jambes'], eq: ['barre'], heavy: true, pat: 'squat', c: 'Cuisses au moins parallèles, dos neutre, genoux dans l’axe des pieds.' }),
  E('front-squat', 'Squat avant', 'muscu', { q: ['force', 'hyper'], g: ['jambes'], eq: ['barre'], lvl: 2, heavy: true, pat: 'squat', c: 'Coudes hauts, buste droit.' }),
  E('presse', 'Presse à cuisses', 'muscu', { q: ['force', 'hyper', 'endu_f'], g: ['jambes'], eq: ['machines'], heavy: true, pat: 'squat', c: 'Bas du dos plaqué au dossier, amplitude sans décoller le bassin.' }),
  E('goblet', 'Goblet squat', 'muscu', { q: ['hyper', 'endu_f', 'force'], g: ['jambes'], eq: ['halteres'], pat: 'squat', c: 'Haltère ou kettlebell contre la poitrine, descente contrôlée.' }),
  E('squat-pdc', 'Squat au poids du corps', 'muscu', { q: ['endu_f'], g: ['jambes'], ld: 'bw', pat: 'squat', c: 'Tempo contrôlé, amplitude complète.' }),
  // ---- Jambes : unilatéral
  E('bulgare', 'Squat bulgare', 'muscu', { q: ['hyper', 'force', 'endu_f', 'prev'], g: ['jambes'], eq: ['halteres', 'rien'], pat: 'unilat', c: 'Pied arrière sur un banc, genou avant dans l’axe. Charges en main si possible.' }),
  E('fentes', 'Fentes marchées', 'muscu', { q: ['hyper', 'endu_f'], g: ['jambes'], eq: ['halteres', 'rien'], pat: 'unilat', c: 'Grand pas, genou arrière qui frôle le sol.' }),
  E('step-up', 'Montées sur banc', 'muscu', { q: ['endu_f', 'prev', 'hyper'], g: ['jambes'], eq: ['halteres', 'rien'], pat: 'unilat', c: 'Pousser avec la jambe du haut, sans élan de la jambe d’appui.' }),
  // ---- Chaîne postérieure
  E('sdt', 'Soulevé de terre', 'muscu', { q: ['force', 'hyper'], g: ['jambes', 'dos'], eq: ['barre'], heavy: true, pat: 'hinge', c: 'Dos neutre, barre au contact des jambes, poussée dans le sol.' }),
  E('rdl', 'Soulevé de terre jambes tendues', 'muscu', { q: ['hyper', 'force', 'endu_f'], g: ['jambes', 'dos'], eq: ['barre', 'halteres'], heavy: true, pat: 'hinge', c: 'Genoux légèrement fléchis, on recule les hanches, dos neutre.' }),
  E('hip-thrust', 'Hip thrust', 'muscu', { q: ['hyper', 'force', 'endu_f'], g: ['jambes'], eq: ['barre', 'halteres'], pat: 'hinge', c: 'Haut du dos sur un banc, extension complète des hanches en serrant les fessiers.' }),
  E('swing', 'Kettlebell swing', 'muscu', { q: ['puiss', 'endu_f'], g: ['jambes', 'dos'], eq: ['halteres'], pat: 'hinge', c: 'Mouvement de hanches explosif, bras relâchés.' }),
  E('nordic', 'Nordic hamstring', 'renfo', { q: ['prev', 'hyper'], g: ['jambes'], ld: 'bw', heavy: true, rr: [4, 6], pat: 'ischio', c: 'Chevilles bloquées, descente la plus lente possible, on se rattrape avec les mains.', src: ['vandyk2019'] }),
  E('pont', 'Pont fessier unipodal', 'renfo', { q: ['prev', 'endu_f'], g: ['jambes'], ld: 'bw', pat: 'ischio', c: 'Bassin aligné, 2 s en haut.' }),
  E('iso-mollets', 'Isométrie lourde des mollets', 'renfo', { q: ['prev'], g: [], eq: ['halteres', 'machines', 'rien'], t: 'iso', hold: '3 s', ld: 'kg', pat: 'tendon', c: 'Pointe de pied sur une marche, genou tendu (et genou plié pour le soléaire) : pousser 3 s presque au maximum contre une charge ou un point fixe.', src: ['bohm2015'] }),
  E('iso-quad', 'Isométrie lourde des quadriceps', 'renfo', { q: ['prev'], g: ['jambes'], eq: ['machines', 'halteres', 'rien'], t: 'iso', hold: '3 s', ld: 'kg', pat: 'tendon', c: 'Leg extension bloqué ou chaise lestée, genou vers 60° : pousser 3 s presque au maximum.', src: ['bohm2015'] }),
  E('leg-ext', 'Leg extension', 'muscu', { q: ['hyper'], g: ['jambes'], eq: ['machines', 'elastique'], pat: 'quad-iso', c: 'Assis, tendre les genoux puis redescendre en 2 s. Se fait aussi avec un élastique accroché à la cheville.' }),
  E('curl', 'Curl biceps', 'muscu', { q: ['hyper'], g: [], eq: ['halteres', 'elastique', 'machines'], pat: 'bras', c: 'Coudes près du corps, monter puis redescendre en 2 s, sans balancer le buste.' }),
  E('mollets', 'Extensions de mollets', 'renfo', { q: ['prev', 'endu_f'], g: [], eq: ['halteres', 'rien'], pat: 'mollet', c: 'Sur une marche, montée sur la pointe, descente lente talon sous la marche.' }),
  // ---- Poussée
  E('dc', 'Développé couché', 'muscu', { q: ['force', 'hyper'], g: ['poussee'], eq: ['barre'], heavy: true, pat: 'push-h', c: 'Omoplates serrées, barre au bas des pectoraux, pieds ancrés.' }),
  E('dc-halt', 'Développé couché haltères', 'muscu', { q: ['hyper', 'force', 'endu_f'], g: ['poussee'], eq: ['halteres'], pat: 'push-h', c: 'Descente contrôlée, coudes à 45°.' }),
  E('pompes', 'Pompes', 'muscu', { q: ['endu_f', 'hyper', 'prev'], g: ['poussee'], ld: 'bw', pat: 'push-h', c: 'Corps gainé, poitrine à un poing du sol. Pieds surélevés ou lest pour durcir.' }),
  E('dips', 'Dips', 'muscu', { q: ['force', 'hyper'], g: ['poussee'], eq: ['machines'], ld: '+kg', lvl: 2, heavy: true, pat: 'push-h', c: 'Épaule qui descend sous le coude sans douleur, remontée complète.' }),
  E('dm', 'Développé militaire', 'muscu', { q: ['force', 'hyper'], g: ['poussee', 'epaule'], eq: ['barre'], heavy: true, pat: 'push-v', c: 'Debout, fessiers serrés, barre qui passe près du visage.' }),
  E('dm-halt', 'Développé épaules haltères', 'muscu', { q: ['hyper', 'endu_f', 'force'], g: ['poussee', 'epaule'], eq: ['halteres'], pat: 'push-v', c: 'Assis ou debout, sans cambrer.' }),
  E('pike', 'Pompes piquées', 'muscu', { q: ['endu_f', 'hyper'], g: ['poussee', 'epaule'], ld: 'bw', pat: 'push-v', c: 'Bassin haut, tête qui descend entre les mains.' }),
  // ---- Tirage
  E('tractions', 'Tractions', 'muscu', { q: ['force', 'hyper', 'endu_f'], g: ['tirage'], eq: ['traction'], ld: 'bw', heavy: true, pat: 'pull-v', c: 'Départ bras tendus épaules engagées, menton au-dessus de la barre.' }),
  E('tractions-lest', 'Tractions lestées', 'muscu', { q: ['force'], g: ['tirage'], eq: ['traction'], ld: '+kg', lvl: 2, heavy: true, pat: 'pull-v', c: 'Lest à la ceinture, répétitions strictes sans élan.' }),
  E('tirage-poulie', 'Tirage vertical à la poulie', 'muscu', { q: ['hyper', 'endu_f', 'force'], g: ['tirage'], eq: ['machines'], pat: 'pull-v', c: 'Barre vers le haut de la poitrine, buste légèrement incliné.' }),
  E('rowing', 'Rowing barre', 'muscu', { q: ['force', 'hyper'], g: ['tirage', 'dos'], eq: ['barre'], heavy: true, pat: 'pull-h', c: 'Buste penché à 45°, dos neutre, barre vers le nombril.' }),
  E('rowing-halt', 'Rowing haltère un bras', 'muscu', { q: ['hyper', 'endu_f', 'force'], g: ['tirage'], eq: ['halteres'], pat: 'pull-h', c: 'Main et genou sur un banc, coude le long du corps.' }),
  E('rowing-inv', 'Rowing inversé', 'muscu', { q: ['endu_f', 'hyper', 'prev'], g: ['tirage'], eq: ['traction', 'barre'], ld: 'bw', pat: 'pull-h', c: 'Barre basse ou anneaux, corps gainé, poitrine à la barre.' }),
  E('tirage-elast', 'Tirage horizontal à l’élastique', 'muscu', { q: ['endu_f', 'prev'], g: ['tirage'], eq: ['elastique'], pat: 'pull-h', c: 'Omoplates qui se rapprochent en fin de mouvement.' }),
  // ---- Tronc
  E('gainage', 'Gainage ventral', 'renfo', { q: ['prev', 'endu_f'], t: 'iso', ld: 'bw', pat: 'core', c: 'Bassin aligné, on respire. Arrêt dès que le dos se creuse.' }),
  E('gainage-lat', 'Gainage latéral', 'renfo', { q: ['prev', 'endu_f'], t: 'iso', ld: 'bw', pat: 'core', c: 'Sur l’avant-bras, corps aligné, chaque côté.' }),
  E('releve-jambes', 'Relevés de jambes suspendu', 'renfo', { q: ['force', 'endu_f'], eq: ['traction'], ld: 'bw', pat: 'core', c: 'Sans balancer, bassin qui s’enroule.' }),
  E('pallof', 'Pallof press', 'renfo', { q: ['prev', 'endu_f'], eq: ['elastique', 'machines'], pat: 'core', c: 'Élastique sur le côté, bras tendus devant sans laisser tourner le buste.' }),
  E('dead-bug', 'Dead bug', 'renfo', { q: ['prev'], ld: 'bw', pat: 'core', c: 'Bas du dos plaqué au sol, bras et jambe opposés qui s’allongent lentement.' }),
  // ---- Épaules, avant-bras : prévention et antagonistes
  E('rot-ext', 'Rotation externe à l’élastique', 'epaule', { q: ['prev'], eq: ['elastique', 'halteres'], pat: 'epaule', c: 'Coude au corps, rotation lente, 2 s de retour.' }),
  E('face-pull', 'Face pull', 'epaule', { q: ['prev', 'hyper'], eq: ['elastique', 'machines'], pat: 'epaule', c: 'Corde vers le front, coudes hauts, rotation externe en fin de mouvement.' }),
  E('ytw', 'Y-T-W allongé', 'epaule', { q: ['prev'], eq: ['halteres', 'rien'], pat: 'epaule', c: 'À plat ventre sur un banc incliné, charges très légères.' }),
  E('scap-pull', 'Tractions scapulaires', 'epaule', { q: ['prev'], sp: ['escalade'], eq: ['traction'], ld: 'bw', pat: 'epaule', c: 'Bras tendus, on monte et descend seulement avec les omoplates.' }),
  E('ext-poignet', 'Extenseurs du poignet', 'renfo', { q: ['prev'], sp: ['escalade'], eq: ['halteres', 'elastique'], pat: 'avantbras', c: 'Avant-bras posé, haltère léger, descente lente (3 s). Antagoniste des fléchisseurs des doigts.' }),
  // ---- Puissance, pliométrie, vitesse
  E('cmj', 'Sauts verticaux', 'muscu', { q: ['puiss', 'vit'], g: ['jambes'], ld: 'bw', pat: 'plyo', c: 'Contre-mouvement rapide, saut maximal, réception amortie genoux dans l’axe.' }),
  E('box-jump', 'Sauts sur box', 'muscu', { q: ['puiss', 'vit'], g: ['jambes'], ld: 'bw', pat: 'plyo', c: 'Saut maximal, on descend du box en marchant.' }),
  E('saut-longueur', 'Sauts en longueur sans élan', 'muscu', { q: ['puiss', 'vit'], g: ['jambes'], ld: 'bw', pat: 'plyo', c: 'Bras qui lancent, réception stable.' }),
  E('squat-saute', 'Squat sauté chargé léger', 'muscu', { q: ['puiss'], g: ['jambes'], eq: ['barre', 'halteres'], lvl: 2, pat: 'squat-puiss', c: '20 à 30 % de la charge max, intention maximale de vitesse.' }),
  E('pompes-expl', 'Pompes explosives', 'muscu', { q: ['puiss'], g: ['poussee'], ld: 'bw', lvl: 2, pat: 'push-puiss', c: 'Mains qui décollent du sol à chaque répétition.' }),
  E('tractions-expl', 'Tractions explosives', 'muscu', { q: ['puiss'], g: ['tirage'], eq: ['traction'], ld: 'bw', lvl: 2, pat: 'pull-puiss', c: 'Tirage le plus rapide possible, poitrine vers la barre.' }),
  E('sprint', 'Sprints 20 m départ arrêté', 'course', { q: ['vit', 'puiss'], g: ['jambes'], eq: ['exterieur'], t: 'essai', ld: 'bw', heavy: true, pat: 'sprint', c: 'Effort maximal (environ 3 à 4 s), récupération complète.' }),
  E('sprint-lance', 'Sprints lancés 20 m', 'course', { q: ['vit'], g: ['jambes'], eq: ['exterieur'], t: 'essai', ld: 'bw', lvl: 2, heavy: true, pat: 'sprint', c: '20 m d’élan progressif puis 20 m à vitesse maximale.' }),
  E('cote', 'Sprints en côte 8 s', 'course', { q: ['vit', 'puiss'], g: ['jambes'], eq: ['exterieur'], t: 'essai', ld: 'bw', heavy: true, pat: 'sprint', c: 'Côte à 5-10 %, 8 s à fond, retour en marchant.' }),
  // ---- Course
  E('ef', 'Footing en endurance fondamentale', 'course', { q: ['aero'], sp: ['course', 'trail', 'hyrox', 'collectif', 'combat', 'autre', 'muscu'], g: [], eq: ['exterieur'], t: 'cont', ld: 'bw', pat: 'run-easy', c: 'Zone 1-2 : tu peux parler en phrases complètes.' }),
  E('sortie-longue', 'Sortie longue', 'course', { q: ['aero'], sp: ['course', 'trail', 'hyrox'], eq: ['exterieur'], t: 'cont', ld: 'bw', pat: 'run-long', c: 'Allure facile du début à la fin. En trail, du dénivelé.' }),
  E('30-30', 'Intervalles 30/30', 'course', { q: ['aero'], g: ['cardio'], eq: ['exterieur'], t: 'int', ld: 'bw', pat: 'run-int', c: '30 s vite (proche de ta VMA), 30 s en trottinant.', src: ['buchheit2013'] }),
  E('3min', 'Intervalles longs 3 min', 'course', { q: ['aero'], g: ['cardio'], eq: ['exterieur'], t: 'int', ld: 'bw', lvl: 2, pat: 'run-int', c: '3 min à allure 3 000-5 000 m, 2 min de trot.', src: ['buchheit2013'] }),
  E('300m', 'Répétitions de 300 m', 'course', { q: ['endu_f', 'vit'], g: ['cardio', 'jambes'], eq: ['exterieur'], t: 'int', ld: 'bw', lvl: 2, pat: 'run-lact', c: 'Environ 60 s très vite, 3 à 4 min de récupération (1:3 à 1:4).', src: ['nsca2016'] }),
  E('lignes', 'Lignes droites', 'course', { q: ['vit', 'aero'], eq: ['exterieur'], t: 'essai', ld: 'bw', pat: 'run-strides', c: '20 s en accélérant progressivement jusqu’à 90 %, retour en marchant.' }),
  // ---- Vélo, rameur, natation, circuit
  E('velo-z2', 'Vélo en endurance', 'velo', { q: ['aero'], eq: ['velo'], t: 'cont', ld: 'bw', pat: 'bike-easy', c: 'Zone 1-2, cadence souple.' }),
  E('velo-4x4', 'Vélo 4 × 4 min', 'velo', { q: ['aero'], g: ['cardio'], eq: ['velo'], t: 'int', ld: 'bw', pat: 'bike-int', c: '4 min à 90-95 % de ta FC max, 3 min faciles.', src: ['helgerud2007'] }),
  E('velo-sprint', 'Sprints vélo 10 s', 'velo', { q: ['vit', 'puiss'], g: ['jambes'], eq: ['velo'], t: 'int', ld: 'bw', pat: 'bike-sprint', c: '10 s à fond, 2 min très faciles (1:12).' }),
  E('rameur', 'Rameur 500 m', 'velo', { q: ['endu_f', 'aero'], g: ['cardio'], eq: ['machines'], t: 'int', ld: 'bw', pat: 'row-int', c: '500 m vite, 2 min de récupération.' }),
  E('nage-ef', 'Natation en endurance', 'velo', { q: ['aero'], sp: ['natation'], eq: ['piscine'], t: 'cont', ld: 'bw', pat: 'swim-easy', c: 'Nage continue à allure confortable.' }),
  E('nage-100', 'Natation 100 m', 'velo', { q: ['aero', 'endu_f'], sp: ['natation'], g: ['cardio'], eq: ['piscine'], t: 'int', ld: 'bw', pat: 'swim-int', c: '100 m soutenu, 20 à 30 s de repos.' }),
  E('circuit', 'Circuit fonctionnel', 'velo', { q: ['endu_f', 'aero'], sp: ['hyrox', 'collectif', 'combat', 'autre', 'muscu'], g: ['cardio'], eq: ['rien', 'halteres'], t: 'int', ld: 'bw', pat: 'circuit', c: 'Burpees, fentes, squats, pompes, gainage : 40 s par atelier, 20 s de transition.' }),
  // ---- Escalade
  E('max-hangs', 'Suspensions max', 'doigts', { q: ['force', 'doigts'], sp: ['escalade'], g: ['doigts'], eq: ['poutre'], t: 'hang', ld: '+kg', lvl: 2, heavy: true, u18: false, pat: 'finger-max', c: '20 mm, semi-arqué. Charge (lest ou décharge) que tu tiendrais environ 13 s : marge de 3 s.', src: ['lopezrivera2012'] }),
  E('repeaters', 'Suspensions 7/3', 'doigts', { q: ['endu_f', 'resist'], sp: ['escalade'], g: ['doigts'], eq: ['poutre'], t: 'hang', ld: '+kg', lvl: 2, u18: false, pat: 'finger-endu', c: '7 s suspendu, 3 s de pause, 6 fois. Prise moyenne, sans aller à l’échec.' }),
  E('limite', 'Blocs à ta limite', 'grimpe', { q: ['puiss', 'force', 'bloc', 'doigts'], sp: ['escalade'], g: ['doigts', 'tirage'], eq: ['pan', 'salle-esc'], t: 'essai', ld: 'bw', heavy: true, pat: 'climb-limit', c: '3 à 6 mouvements très durs, frais à chaque essai.', src: ['nsca2016'] }),
  E('pan-dur', 'Pan : blocs durs', 'grimpe', { q: ['puiss', 'bloc', 'force'], sp: ['escalade'], g: ['doigts', 'tirage'], eq: ['pan'], t: 'essai', ld: 'bw', lvl: 2, heavy: true, pat: 'climb-limit', c: 'Moonboard, Kilter ou pan maison : mouvements de puissance sur petites prises.' }),
  E('campus', 'Campus sur prises larges', 'grimpe', { q: ['puiss', 'bloc'], sp: ['escalade'], g: ['doigts', 'tirage'], eq: ['pan'], t: 'essai', ld: 'bw', lvl: 3, heavy: true, u18: false, pat: 'climb-power', c: 'Échelons larges, montées 1-3-5, arrêt dès que la qualité baisse.' }),
  E('4x4', '4 blocs enchaînés (4 × 4)', 'grimpe', { q: ['resist', 'endu_f'], sp: ['escalade'], g: ['doigts'], eq: ['salle-esc', 'pan'], t: 'serie', ld: 'bw', pat: 'climb-lact', c: '4 blocs enchaînés sans pause, 2 à 3 niveaux sous ta limite.' }),
  E('int-pan', 'Intervalles 1 min sur pan', 'grimpe', { q: ['resist', 'endu_f'], sp: ['escalade'], g: ['doigts'], eq: ['pan', 'salle-esc'], t: 'int', ld: 'bw', pat: 'climb-lact', c: '1 min de grimpe soutenue, 3 min de repos (1:3).', src: ['nsca2016'] }),
  E('enchainement', 'Enchaînement de deux voies', 'grimpe', { q: ['resist'], sp: ['escalade'], g: ['doigts'], eq: ['salle-esc'], t: 'serie', ld: 'bw', pat: 'climb-lact', c: 'Deux voies d’affilée sans redescendre au sol si possible, niveau à vue moins 2.' }),
  E('volume-blocs', 'Volume de blocs faciles', 'grimpe', { q: ['aero', 'conti', 'tech'], sp: ['escalade'], eq: ['salle-esc', 'pan'], t: 'bloc', ld: 'bw', pat: 'climb-aero', c: 'Beaucoup de blocs nettement sous ton flash, 1 min de repos : enchaîner sans « bouteiller ».' }),
  E('compet-sim', 'Simulation de compétition', 'grimpe', { q: ['puiss', 'bloc', 'compet'], sp: ['escalade'], g: ['doigts', 'tirage'], eq: ['salle-esc'], t: 'essai', ld: 'bw', heavy: true, pat: 'climb-comp', c: 'Blocs nouveaux, temps limité par bloc, autant de repos : lecture, engagement, gestion des essais.' }),
  E('flash', 'Flash de blocs nouveaux', 'grimpe', { q: ['compet', 'tech'], sp: ['escalade'], eq: ['salle-esc'], t: 'essai', ld: 'bw', pat: 'climb-comp', c: 'Un seul essai après une lecture d’1 min : comme en qualification.' }),
  E('finger-lift', 'Finger lift', 'doigts', { q: ['force', 'doigts'], sp: ['escalade'], g: ['doigts'], eq: ['halteres', 'salle'], t: 'hang', ld: 'kg', lvl: 2, heavy: true, u18: false, pat: 'finger-max', c: 'Bloc ou réglette chargé, une main, semi-arqué : levée de 7 s sans à-coup.' }),
  E('conti', 'Continuité', 'grimpe', { q: ['aero', 'conti'], sp: ['escalade'], eq: ['salle-esc', 'pan'], t: 'bloc', ld: 'bw', pat: 'climb-aero', c: 'Grimpe facile sans t’arrêter, avant-bras chauds mais jamais « bouteillés ».' }),
  E('volume', 'Volume de voies faciles', 'grimpe', { q: ['aero', 'conti', 'tech'], sp: ['escalade'], eq: ['salle-esc'], t: 'essai', ld: 'bw', pat: 'climb-aero', c: 'Beaucoup de voies 2 à 3 niveaux sous ton max, en soignant les placements.' }),
  E('technique', 'Technique', 'grimpe', { q: ['tech'], sp: ['escalade'], eq: ['salle-esc', 'pan'], t: 'essai', ld: 'bw', pat: 'climb-tech', c: 'Un thème par séance : pieds précis, lecture, chutes, dynamique.' }),
  E('blocage', 'Blocages bras à 90°', 'muscu', { q: ['force'], sp: ['escalade'], g: ['tirage'], eq: ['traction'], t: 'iso', hold: '5-10 s', ld: 'bw', lvl: 2, pat: 'pull-iso', c: 'Coude à 90°, 5 à 10 s, une ou deux mains selon le niveau.' }),
  // ---- Course : intervalles (Helgerud 2007, Gist 2014)
  E('run-1515', 'Course 15/15', 'cardio', { q: ['aero'], sp: ['course', 'trail', 'hyrox', 'collectif'], g: ['cardio'], eq: ['exterieur'], t: 'int', ld: 'bw', pat: 'run-vo2', c: '15 s vite (90-95 % de la FC max), 15 s de trot lent, en séries de 10 à 14 répétitions.', src: ['helgerud2007'] }),
  E('run-4x4', 'Course 4 × 4 min', 'cardio', { q: ['aero'], sp: ['course', 'trail', 'hyrox', 'collectif'], g: ['cardio'], eq: ['exterieur'], t: 'int', ld: 'bw', pat: 'run-vo2', c: '4 min à 90-95 % de la FC max, 3 min de trot lent (environ 70 %).', src: ['helgerud2007'] }),
  E('sprint-30s', 'Sprints de 30 s', 'cardio', { q: ['aero', 'endu_f'], g: ['cardio'], eq: ['exterieur', 'velo'], t: 'int', ld: 'bw', lvl: 2, pat: 'sprint-30', c: '4 à 6 sprints de 30 s à fond, environ 4 min de récupération facile.', src: ['gist2014'] }),
  // ---- Vélo : 30/15 (Rønnestad 2015), seuil
  E('velo-3015', 'Vélo 30/15', 'velo', { q: ['aero'], sp: ['velo'], g: ['cardio'], eq: ['velo'], t: 'int', ld: 'bw', lvl: 2, pat: 'bike-vo2', c: '30 s très fort, 15 s facile, 13 répétitions par série, 2 à 3 séries.', src: ['ronnestad2015'] }),
  E('velo-z4', 'Vélo au seuil', 'velo', { q: ['aero'], sp: ['velo'], g: ['cardio'], eq: ['velo'], t: 'int', ld: 'bw', pat: 'bike-thr', c: '2 × 20 min en zone 4, soit 91 à 105 % de la FTP, 5 min faciles entre les blocs.' }),
  // ---- Natation : CSS, allure de course, volume réduit
  E('nage-css', 'Natation au seuil CSS', 'velo', { q: ['aero', 'endu_f'], sp: ['natation'], g: ['cardio'], eq: ['piscine'], t: 'int', ld: 'bw', pat: 'swim-css', c: '100 m à l’allure de ta vitesse critique (CSS), départ fixe, environ 15 s de repos.', src: ['wakayoshi1992'] }),
  E('nage-usrpt', 'Natation ultra-court à l’allure de course', 'velo', { q: ['aero', 'endu_f'], sp: ['natation'], g: ['cardio'], eq: ['piscine'], t: 'int', ld: 'bw', lvl: 2, pat: 'swim-usrpt', c: '25 m à l’allure de ton record sur 100 m, 35 s de récupération.', src: ['williamson2020'] }),
  E('nage-sup', 'Natation supramaximale', 'velo', { q: ['endu_f', 'vit'], sp: ['natation'], g: ['cardio'], eq: ['piscine'], t: 'int', ld: 'bw', lvl: 2, pat: 'swim-sup', c: '25 m plus vite que ton allure de course, 1 min 30 de récupération.', src: ['johansen2010'] }),
  // ---- Hyrox : stations aux charges de la catégorie
  E('hx-run', 'Course 1 km Hyrox', 'cardio', { q: ['aero'], sp: ['hyrox'], g: ['cardio'], eq: ['exterieur'], t: 'cont', ld: 'bw', pat: 'hx-run', c: '1 km à l’allure de course visée, enchaîné avec la station.', src: ['brandt2025'] }),
  E('hx-ski', 'SkiErg Hyrox', 'velo', { q: ['aero', 'endu_f'], sp: ['hyrox'], g: ['cardio'], eq: ['machines'], t: 'cont', ld: 'bw', pat: 'hx-ski', c: '1 000 m en course ; tirage avec le dos et les jambes, pas seulement les bras.' }),
  E('hx-push', 'Poussée de traîneau', 'muscu', { q: ['endu_f', 'force'], sp: ['hyrox'], g: ['jambes'], eq: ['machines', 'salle'], t: 'reps', ld: 'kg', pat: 'hx-push', c: '50 m en course ; buste incliné, petits pas rapides, bras tendus.' }),
  E('hx-pull', 'Tirage de traîneau', 'muscu', { q: ['endu_f', 'force'], sp: ['hyrox'], g: ['dos'], eq: ['machines', 'salle'], t: 'reps', ld: 'kg', pat: 'hx-pull', c: '50 m en course ; recule en tirant main sur main, dos gainé.' }),
  E('hx-burpee', 'Burpees sauts en longueur', 'muscu', { q: ['endu_f'], sp: ['hyrox'], g: ['cardio'], eq: ['rien'], t: 'reps', ld: 'bw', pat: 'hx-burpee', c: '80 m en course : burpee, puis saut en longueur, on enchaîne.' }),
  E('hx-row', 'Rameur Hyrox', 'velo', { q: ['aero', 'endu_f'], sp: ['hyrox'], g: ['cardio'], eq: ['machines'], t: 'cont', ld: 'bw', pat: 'hx-row', c: '1 000 m en course ; allure régulière, jambes puis dos puis bras.' }),
  E('hx-farmer', 'Farmer’s carry', 'muscu', { q: ['endu_f', 'force'], sp: ['hyrox'], g: ['dos'], eq: ['halteres'], t: 'reps', ld: 'kg', pat: 'hx-farmer', c: '200 m en course ; deux charges, épaules basses, pas courts et rapides.' }),
  E('hx-lunge', 'Fentes avec sac', 'muscu', { q: ['endu_f'], sp: ['hyrox'], g: ['jambes'], eq: ['halteres', 'salle'], t: 'reps', ld: 'kg', pat: 'hx-lunge', c: '100 m en course ; sac sur les épaules, genou arrière qui touche le sol.' }),
  E('hx-wall', 'Wall balls', 'muscu', { q: ['endu_f'], sp: ['hyrox'], g: ['jambes'], eq: ['halteres', 'salle'], t: 'reps', ld: 'kg', pat: 'hx-wall', c: '100 répétitions en course ; squat complet, lancer à la cible sans pause longue.' }),
  // ---- Doigts : protocoles à un pourcentage du max (Devise 2022)
  E('hang-1main', 'Suspensions une main 6 s', 'doigts', { q: ['force', 'doigts'], sp: ['escalade'], g: ['doigts'], eq: ['poutre'], t: 'hang', ld: '+kg', lvl: 3, heavy: true, u18: false, pat: 'finger-max', c: '6 suspensions de 6 s par main, mains alternées, à 100 % de ta force max, réglette de 12 mm.', src: ['devise2022'] }),
  E('hang-106', 'Suspensions 10/6', 'doigts', { q: ['endu_f', 'force', 'doigts'], sp: ['escalade'], g: ['doigts'], eq: ['poutre'], t: 'hang', ld: '+kg', lvl: 2, u18: false, pat: 'finger-endu', c: '10 s suspendu, 6 s de pause, à 60 ou 80 % de ta force max.', src: ['devise2022'] }),
  E('hang-bfr', 'Suspensions avec brassards', 'doigts', { q: ['endu_f', 'prev'], sp: ['escalade'], g: ['doigts'], eq: ['poutre', 'bfr'], t: 'hang', ld: '+kg', lvl: 2, u18: false, pat: 'finger-endu', c: '7 s / 3 s pendant 1 min à 30 % de la force max, brassard serré à 40-80 % de la pression qui bloque le sang.', src: ['patterson2019'] }),
  E('ext-doigts', 'Extension des doigts à l’élastique', 'renfo', { q: ['prev'], sp: ['escalade'], eq: ['elastique'], pat: 'avantbras', c: 'Doigts en extension contre un élastique, charge légère à modérée, 2 séances par semaine.' }),
  // ---- Mobilité
  E('mob-hanches', 'Mobilité des hanches', 'recup', { q: ['mobi'], t: 'mob', ld: 'bw', pat: 'mobi', c: '90/90, fente basse, papillon : 1 min par position.' }),
  E('mob-epaules', 'Mobilité des épaules', 'recup', { q: ['mobi'], t: 'mob', ld: 'bw', pat: 'mobi', c: 'Passages de bâton, ouvertures thoraciques au sol.' }),
  E('mob-chevilles', 'Mobilité des chevilles', 'recup', { q: ['mobi'], t: 'mob', ld: 'bw', pat: 'mobi', c: 'Genou au mur, 10 répétitions par côté.' }),
  E('mob-doigts', 'Étirements des fléchisseurs', 'recup', { q: ['mobi'], sp: ['escalade'], t: 'mob', ld: 'bw', pat: 'mobi', c: 'Doigts en extension, poignet en arrière, 30 s, sans douleur.' }),
  E('mob-dos', 'Mobilité du dos', 'recup', { q: ['mobi'], t: 'mob', ld: 'bw', pat: 'mobi', c: 'Chat-vache, rotations thoraciques allongé.' })
];
export const LIB_BY_ID = Object.fromEntries(LIB.map(x => [x.id, x]));

// Reconnaître un exercice tapé à la main (règle des 48 h, « dernière fois »)
export const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\[[a-z]+\]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const BY_NAME = new Map(LIB.map(x => [norm(x.n), x]));
export function libMatch(label) {
  const n = norm(label); if (!n) return null;
  if (BY_NAME.has(n)) return BY_NAME.get(n);
  let best = null;
  for (const [k, x] of BY_NAME) if (n.startsWith(k) && (!best || k.length > norm(best.n).length)) best = x;
  return best;
}

/* ---------- Objectifs ---------- */
// sys : filière dominante · alactique (≤ 10 s), lactique (20 s-2 min), aérobie (> 2-3 min), structure (force, masse)
export const GOALS = [
  { id: 'force', l: 'Force maximale', d: 'Soulever, tirer ou pousser plus lourd', sys: 'neuro' },
  { id: 'hyper', l: 'Masse musculaire', d: 'Prendre du muscle', sys: 'hyper' },
  { id: 'puiss', l: 'Puissance', d: 'Sauter, lancer, être explosif', sys: 'alac' },
  { id: 'vit', l: 'Vitesse', d: 'Démarrer et sprinter plus vite', sys: 'alac' },
  { id: 'endu_f', l: 'Endurance de force', d: 'Répéter des efforts intenses sans s’effondrer', sys: 'lact' },
  { id: 'aero', l: 'Endurance', d: 'Tenir longtemps, courir ou pédaler plus loin', sys: 'aero' },
  { id: 'doigts', l: 'Force des doigts', d: 'Tenir des prises plus petites', sys: 'neuro', sp: 'escalade' },
  { id: 'bloc', l: 'Puissance en bloc', d: 'Passer les mouvements durs', sys: 'alac', sp: 'escalade' },
  { id: 'resist', l: 'Résistance', d: 'Ne plus « bouteiller » dans les voies', sys: 'lact', sp: 'escalade' },
  { id: 'conti', l: 'Continuité', d: 'Grimper longtemps sans fatigue', sys: 'aero', sp: 'escalade', hidden: true },
  { id: 'compet', l: 'Compétition de bloc', d: 'Passer des blocs nouveaux, vite et sous pression', sys: 'alac', sp: 'escalade' },
  { id: 'hyrox', l: 'Hyrox', d: 'Courir 8 × 1 km et enchaîner les 8 stations', sys: 'aero', sp: 'hyrox' },
  { id: 'prev', l: 'Prévention', d: 'Se blesser moins : épaules, doigts, dos, genoux', sys: 'prev' }
];
// Objectifs proposés : sans ceux masqués (continuité retirée), ceux d'escalade et d'Hyrox selon les sports
export const goalsFor = (cl, hx) => GOALS.filter(g => !g.hidden && (g.sp === 'escalade' ? cl : g.sp === 'hyrox' ? hx : true));
export const GOAL_BY_ID = Object.fromEntries(GOALS.map(g => [g.id, g]));
export const SYSTEMS = {
  neuro: { l: 'Force neuromusculaire', d: 'Charges lourdes (environ 80 % du max et plus), 1 à 6 répétitions, 2 à 5 min de récupération : le système nerveux apprend à recruter plus de fibres.', src: ['acsm2009', 'nsca2016'] },
  hyper: { l: 'Hypertrophie', d: '6 à 12 répétitions proches de l’échec, au moins 10 séries par muscle et par semaine, 1 min 30 à 3 min de repos.', src: ['schoenfeld2017', 'schoenfeld2016'] },
  alac: { l: 'Filière anaérobie alactique', d: 'Efforts quasi maximaux de moins de 10 s, alimentés par la phosphocréatine. Récupération longue : 1:12 à 1:20 (2 à 3 min pour 10 s).', src: ['nsca2016'] },
  lact: { l: 'Filière anaérobie lactique', d: 'Efforts intenses de 20 s à 2 min, ceux qui « brûlent ». Récupération de 1:3 à 1:5.', src: ['nsca2016', 'buchheit2013'] },
  aero: { l: 'Filière aérobie', d: 'Efforts de plus de 2 à 3 min. Environ 80 % du temps en facile et 20 % en intervalles intenses (entraînement polarisé).', src: ['stoggl2014', 'buchheit2013'] },
  prev: { l: 'Prévention', d: 'Renforcer les zones fragiles de ton sport et les antagonistes, entretenir la mobilité.', src: ['vandyk2019'] }
};

/* ---------- Quiz « je ne sais pas » ---------- */
export function quiz(cl) {
  return [
    { id: 'lim', q: cl ? 'En voie ou en bloc, tu échoues plutôt parce que…' : 'Dans ton sport, ce qui te limite le plus, c’est…', opts: [
      { id: 'force', l: cl ? 'Les prises sont trop petites ou les mouvements trop durs, même frais' : 'La force : charges lourdes, duels, contacts', w: cl ? { doigts: 3, bloc: 1 } : { force: 3, puiss: 1 } },
      { id: 'expl', l: cl ? 'Il manque de l’explosivité : jetés, mouvements dynamiques' : 'L’explosivité : sauts, démarrages, lancers', w: cl ? { bloc: 3, puiss: 1 } : { puiss: 3, vit: 1 } },
      { id: 'lact', l: cl ? 'Les avant-bras « bouteillent » au bout de 20 à 40 mouvements' : 'Ça brûle et je lâche après 30 s à 2 min d’effort intense', w: cl ? { resist: 3 } : { endu_f: 3 } },
      { id: 'aero', l: cl ? 'Je fatigue sur les longues voies ou les longues séances' : 'Je m’essouffle ou je ralentis quand ça dure', w: cl ? { resist: 2, aero: 1 } : { aero: 3 } },
      { id: 'vit', l: 'La vitesse : les premiers mètres, les sprints répétés', w: { vit: 3, puiss: 1 }, hide: cl },
      { id: 'hyper', l: 'Je veux surtout prendre du muscle', w: { hyper: 3 } },
      { id: 'blesse', l: 'Je me blesse souvent ou j’ai des douleurs qui reviennent', w: { prev: 3 } }
    ].filter(o => !o.hide) },
    { id: 'duree', q: 'L’effort le plus important de ton sport dure…', opts: [
      { id: 'court', l: 'Moins de 10 s (un mouvement, un sprint, un saut)', w: { force: 1, puiss: 1, vit: 1, doigts: 1, bloc: 1 } },
      { id: 'moyen', l: 'De 20 s à 2 min', w: { endu_f: 1, resist: 1 } },
      { id: 'long', l: 'Plusieurs minutes ou plus', w: { aero: 1, resist: 1 } },
      { id: 'mixte', l: 'Un peu de tout', w: {} }
    ] },
    { id: 'pref', q: 'Ce qui te motive le plus en ce moment…', opts: [
      { id: 'perf', l: 'Un objectif de performance (compétition, projet, chrono)', w: cl ? { compet: 1 } : {} },
      { id: 'phys', l: 'Mon physique', w: { hyper: 1 } },
      { id: 'sante', l: 'Être en forme et sans douleur', w: { prev: 1, aero: 1 } }
    ] }
  ];
}
export function quizResult(answers, cl) {
  const sc = {};
  for (const q of quiz(cl)) { const o = q.opts.find(x => x.id === answers[q.id]); if (o) for (const [g, v] of Object.entries(o.w)) sc[g] = (sc[g] || 0) + v; }
  const ok = GOALS.filter(g => !g.hidden && g.sp !== 'hyrox' && (cl || g.sp !== 'escalade')).map(g => g.id);
  return Object.entries(sc).filter(([g]) => ok.includes(g)).sort((a, b) => b[1] - a[1]).map(x => x[0]);
}
