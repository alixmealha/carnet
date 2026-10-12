// Lecture du suivi : interprétation des valeurs du jour et de la semaine, avec un conseil d'adaptation.
// Les seuils viennent de la littérature (voir sources.js) ; c'est l'écart à sa propre moyenne qui compte le plus.
import { jget, get, subjectSettings } from './store.js';
import { day, target, kinds, eventOn } from './plan.js';
import { score, verdict, nightTotal, durLong, nightCompare, FLAGS, rng, WELL } from './rules.js';
import { addDays, todayKey, fmtNum } from './dates.js';

const LV = { crit: 0, warn: 1, info: 2, good: 3 };
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const sd = a => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1)); };
const f1 = x => fmtNum(Math.round(x * 10) / 10);
const range = (k, from, to) => { const out = []; for (let i = from; i <= to; i++) out.push(addDays(k, i)); return out; };
export const sleepTarget = () => ((get('profile') || {}).under18 ? 480 : 420);
const FL = Object.fromEntries(FLAGS);

export function dayLoad(k) { const e = jget(k); return typeof e.rpe === 'number' && typeof e.duree === 'number' && e.duree > 0 ? e.rpe * e.duree : 0; }
// Ratio aigu (7 j) / chronique (moyenne hebdo sur 28 j), seulement avec au moins 3 semaines de données
export function loadRatio(k) {
  const d28 = range(k, -27, 0), loads = d28.map(dayLoad);
  const firstIdx = loads.findIndex(x => x > 0);
  if (firstIdx < 0 || firstIdx > 7) return null;
  const acute = loads.slice(21).reduce((a, b) => a + b, 0), chronic = loads.reduce((a, b) => a + b, 0) / 4;
  return chronic > 0 ? { ratio: acute / chronic, acute, chronic } : null;
}
export function monotony(k) {
  const l = range(k, -6, 0).map(dayLoad), tot = l.reduce((a, b) => a + b, 0);
  if (tot <= 0 || l.filter(x => x > 0).length < 3) return null;
  const s = sd(l); return s > 0 ? { mono: mean(l) / s, strain: tot * mean(l) / s, total: tot } : null;
}
function vfcSeries(k, from, to) { return range(k, from, to).map(d => jget(d).nuit).filter(n => n && typeof n.vfc === 'number' && n.vfc > 0).map(n => Math.log(n.vfc)); }
export function hrvStatus(k) {
  const base = vfcSeries(k, -60, -1), last7 = vfcSeries(k, -6, 0);
  if (base.length < 14 || last7.length < 3) return null;
  const m = mean(base), s = sd(base), a = mean(last7), swc = 0.5 * s;
  return { avg7: Math.exp(a), base: Math.exp(m), lo: Math.exp(m - swc), hi: Math.exp(m + swc), state: a < m - swc ? 'low' : a > m + swc ? 'high' : 'normal' };
}

function painAdvice(zone, ks) {
  const climb = ks.has('grimpe') || ks.has('doigts') || ks.has('test') || ks.has('compet');
  const pull = ks.has('muscu') || ks.has('renfo') || climb;
  switch (zone) {
    case 'doigts': return climb ? ' Pas de charge maximale sur les doigts aujourd’hui : ni suspensions max ni réglettes en arqué, grimpe sur grosses prises ou en technique. Une douleur sur le dos d’une articulation de doigt, même brève : arrêt du travail de doigts et avis médical.' : ' Rien pour les doigts aujourd’hui : revérifie demain matin avant de grimper.';
    case 'coude': return pull ? ' Réduis les tirages (tractions, rowing, blocages) et évite les pinces serrées.' : '';
    case 'epaule': return pull ? ' Évite les poussées au-dessus de la tête, le développé couché lourd et les jetés ; garde un travail des rotateurs léger.' : '';
    case 'poignet': return ' Évite les appuis paume à plat chargés (pompes, dips) et les prises inversées.';
    case 'dos': return ' Évite les charges lourdes et les exercices qui la réveillent ; mobilité douce.';
    case 'hanche': return ' Pas de drop-knee forcé ni d’écart en force ; adapte le renfo des jambes.';
    case 'genou': return ' Évite les réceptions de haut et les crochets talon appuyés ; cardio seulement sans douleur.';
    case 'cheville': return ' Désescalade plutôt que sauts, réceptions contrôlées.';
    default: return '';
  }
}
const WELL_TIPS = {
  fatigue: 'Fatigue générale : priorise la qualité et coupe le volume.',
  courbatures: 'Courbatures marquées : évite l’excentrique lourd et les gros volumes sur les mêmes muscles.',
  stress: 'Stress élevé : la charge mentale s’ajoute à l’entraînement ; garde l’intensité mais raccourcis la séance.',
  humeur: 'Humeur basse : une séance plaisir ou technique passe mieux qu’une séance très dure.',
  sommeil: 'Sommeil ressenti mauvais : regarde la lecture du sommeil ci-dessous.'
};

export function dayInsights(k) {
  const e = jget(k), items = [], add = (lvl, t, d, src) => items.push({ lvl, t, d, src: src || [] });
  const t = score(e), ks = kinds(k), st = subjectSettings();
  // 1. Forme du matin
  if (t !== null) {
    const vd = verdict(t), lv = vd.cls === 'ok' ? 'good' : vd.cls;
    add(lv, 'Forme du matin · ' + t + '/25 · ' + vd.lbl, vd.txt, lv === 'good' ? ['mclean2010', 'saw2016'] : ['saw2016', 'hooper1995']);
    const past = range(k, -28, -1).map(d => score(jget(d))).filter(x => x !== null);
    if (past.length >= 7 && (vd.cls === 'good' || vd.cls === 'ok')) {
      const m = mean(past), s = Math.max(2, sd(past));
      if (t <= m - s) add('warn', 'Nettement sous ta moyenne', 'Ta moyenne sur 4 semaines est de ' + f1(m) + '/25. C’est l’écart à ta propre habitude qui compte le plus : allège un peu même si le total reste correct.', ['saw2016']);
    }
    const low = WELL.map(([key, l]) => [key, l, e.well && e.well[key]]).filter(x => typeof x[2] === 'number' && x[2] <= 2).sort((a, b) => a[2] - b[2])[0];
    if (low && low[0] !== 'sommeil') add('info', low[1] + ' · ' + low[2] + '/5', WELL_TIPS[low[0]], ['mclean2010']);
    const seq = range(k, -3, 0).map(d => score(jget(d)));
    if (seq.every(x => x !== null) && seq[1] < seq[0] && seq[2] < seq[1] && seq[3] < seq[2]) add('warn', 'Forme en baisse 3 jours de suite', 'Gèle la progression : reprends le niveau de la semaine précédente jusqu’à ce que ça remonte.', ['hooper1995', 'saw2016']);
  }
  // 2. Sommeil
  const tot = nightTotal(e), tgt = sleepTarget(), u18 = tgt === 480;
  if (tot !== null) {
    const prev = nightTotal(jget(addDays(k, -1)));
    if (tot < tgt && prev !== null && prev < tgt) add('warn', 'Deux nuits courtes de suite', durLong(prev) + ' puis ' + durLong(tot) + '. Le manque de sommeil répété baisse la performance et augmente le risque de blessure : garde la séance mais retire les efforts maximaux. Une sieste de 20 à 30 min avant 16 h aide.', u18 ? ['walsh2021', 'milewski2014'] : ['walsh2021']);
    else if (tot < tgt) add('info', 'Nuit courte · ' + durLong(tot), 'Une nuit isolée change peu la performance. Vise ' + (u18 ? '8 à 10 h' : '7 à 9 h') + ' ; une sieste de moins de 30 min est possible.', u18 ? ['walsh2021', 'hirsh2015', 'milewski2014'] : ['walsh2021', 'hirsh2015']);
    const cmp = nightCompare(e); if (cmp && !/même sens/.test(cmp)) add('info', 'Ressenti et mesure diffèrent', cmp, ['saw2016']);
  }
  // 3. VFC et FC de repos (montre)
  const n = e.nuit || {};
  if (typeof n.vfc === 'number') {
    const h = hrvStatus(k);
    if (!h) add('info', 'VFC notée · ' + n.vfc + ' ms', 'La lecture devient fiable après 2 semaines de mesures (au moins 3 par semaine) : on compare alors ta moyenne sur 7 jours à ta zone habituelle.', ['plews2014', 'ais2023']);
    else if (h.state === 'low') add('warn', 'VFC sous ta zone habituelle', 'Moyenne 7 j ' + Math.round(h.avg7) + ' ms pour une zone de ' + Math.round(h.lo) + ' à ' + Math.round(h.hi) + ' ms. Signe possible de fatigue accumulée, de stress ou d’un début de maladie : si la forme ou la FC de repos vont dans le même sens, allège l’intensité 1 à 2 jours.', ['plews2013', 'ais2023', 'buchheit2014']);
    else if (h.state === 'high') add('info', 'VFC au-dessus de ta zone', 'Moyenne 7 j ' + Math.round(h.avg7) + ' ms (zone ' + Math.round(h.lo) + '-' + Math.round(h.hi) + '). Souvent un bon signe de récupération ; si tu te sens très fatigué malgré tout, reste prudent.', ['ais2023', 'buchheit2014']);
    else add('good', 'VFC dans ta zone habituelle', 'Moyenne 7 j ' + Math.round(h.avg7) + ' ms (zone ' + Math.round(h.lo) + '-' + Math.round(h.hi) + ').', ['plews2013', 'ais2023']);
  }
  if (typeof n.fcr === 'number') {
    const base = range(k, -7, -1).map(d => jget(d).nuit).filter(x => x && typeof x.fcr === 'number').map(x => x.fcr);
    if (base.length >= 4) {
      const m = mean(base), up = n.fcr - m, y = jget(addDays(k, -1)).nuit;
      if (up >= 5) add('warn', 'FC de repos haute · +' + Math.round(up) + ' bpm', 'Au-dessus de ta moyenne de la semaine (' + Math.round(m) + ' bpm). Fatigue, stress, début de maladie, chaleur ou alcool peuvent la faire monter. ' + (y && typeof y.fcr === 'number' && y.fcr - m >= 5 ? 'Deuxième jour de suite : allège la séance.' : 'Un seul jour : surveille demain.') + ' (+5 bpm est un repère pratique.)', ['buchheit2014']);
    }
  }
  if (typeof n.recup === 'number' && n.recup <= 33) add('warn', 'Récupération basse selon ta montre · ' + n.recup + ' %', 'À croiser avec ta forme du matin : les scores des montres sont peu validés scientifiquement, ta tendance compte plus que le chiffre du jour.', ['ais2023']);
  // 4. Gênes (modèle de surveillance de la douleur)
  for (const [f, lbl] of FLAGS) {
    if (!(e.flags && e.flags[f])) continue;
    const g = e.gene && typeof e.gene[f] === 'number' ? e.gene[f] : null, spec = painAdvice(f, ks), srcs = f === 'doigts' ? ['silbernagel2007', 'schoffl2015'] : ['silbernagel2007'];
    const g7 = jget(addDays(k, -7)).gene, rising = g !== null && g7 && typeof g7[f] === 'number' && g > g7[f];
    const trend = rising ? ' Elle est plus haute qu’il y a une semaine : ne l’ignore pas.' : '';
    if (g === null) add('info', lbl + ' sensible', 'Note la gêne de 0 à 10 pour suivre son évolution.' + spec, srcs);
    else if (g <= 2) add('info', lbl + ' · gêne ' + g + '/10', 'Zone sûre : entraînement normal, en surveillant.' + trend, srcs);
    else if (g <= 5) add('warn', lbl + ' · gêne ' + g + '/10', 'Acceptable si elle ne dépasse pas 5/10 pendant l’effort, redescend d’ici demain matin et n’augmente pas d’une semaine à l’autre.' + spec + trend, srcs);
    else add('crit', lbl + ' · gêne ' + g + '/10', 'Au-dessus de 5/10 : supprime ou modifie ce qui la provoque aujourd’hui. Si ça dure plus de quelques jours, consulte (kiné, médecin).' + spec, srcs);
  }
  // 5. Charge des derniers jours
  const lr = loadRatio(k);
  if (lr && lr.ratio > 1.5) add('warn', 'Charge en forte hausse · ratio ' + f1(lr.ratio), 'Les 7 derniers jours pèsent ' + f1(lr.ratio) + ' fois ta moyenne des 4 semaines. Zone 0,8-1,3 décrite comme favorable (repère discuté) : garde les prochains jours à ce niveau plutôt que d’ajouter.', ['gabbett2016', 'impellizzeri2020']);
  else if (lr && lr.ratio > 1.3) add('info', 'Charge en hausse · ratio ' + f1(lr.ratio), 'Progression rapide : ça passe si la forme suit.', ['gabbett2016', 'impellizzeri2020']);
  const mo = monotony(k);
  if (mo && mo.mono > 2) add('info', 'Semaine monotone · ' + f1(mo.mono), 'Les jours se ressemblent trop en charge : alterne jours durs et jours faciles.', ['foster1998']);
  const y = addDays(k, -1), ye = jget(y), yt = target(y);
  if (yt && yt.rpe && typeof ye.rpe === 'number' && ye.rpe >= yt.rpe[1] + 2) add('info', 'Séance d’hier plus dure que prévu', 'Ressenti ' + ye.rpe + '/10 pour une cible de ' + rng(yt) + '. Si tu te sens entamé ce matin, commence prudemment.', ['foster2001']);
  // 6. Cycle
  if (st.cycle && typeof e.cycle === 'number') {
    const c = e.cycle;
    if (c > 35) add('warn', 'Cycle · J' + c, 'Cycle de plus de 35 jours : des cycles longs, irréguliers ou absents peuvent signaler un déficit énergétique (REDs). À évoquer avec un médecin.', ['mountjoy2023']);
    else {
      const ph = c <= 5 ? 'règles, début de phase folliculaire' : c <= 13 ? 'phase folliculaire' : c <= 15 ? 'ovulation (estimée)' : 'phase lutéale';
      add('info', 'Cycle · J' + c + ' · ' + ph, c <= 5 ? 'En moyenne l’effet du cycle sur la performance est trivial (léger creux possible en ce moment) et très variable d’une personne à l’autre. On ne change rien par principe ; si les symptômes gênent, traite la journée comme une forme basse.' : 'On ne change rien par principe. Après 3 ou 4 cycles notés, ta propre tendance apparaîtra dans le suivi.', ['mcnulty2020']);
    }
  }
  // 7. Repas
  if (e.repas === 'non' || e.repas === 'partiel') {
    const miss = range(k, -6, 0).filter(d => jget(d).repas === 'non').length;
    if (miss >= 3) add('warn', 'Repas manqués ' + miss + ' fois en 7 jours', 'Un apport insuffisant et répété fatigue et fragilise (déficit énergétique, REDs). À surveiller, et à en parler si ça continue.', ['mountjoy2023']);
    else add('info', 'Peu mangé autour de la séance d’hier', 'Glucides et protéines dans les heures qui suivent l’effort aident à récupérer.', ['kerksick2017']);
  }
  if (!items.length) return null;
  items.sort((a, b) => LV[a.lvl] - LV[b.lvl]);
  const worst = items[0].lvl;
  const level = worst === 'crit' ? 'crit' : worst === 'warn' ? 'warn' : 'good';
  const head = level === 'crit' ? 'Feu rouge : version décharge ou repos actif' : level === 'warn' ? 'Feu orange : séance allégée ou adaptée' : 'Feu vert : séance telle que prévue';
  const d = day(k), adapt = d && d.adapt && level !== 'good' ? d.adapt : null;
  return { level, head, items, adapt, event: eventOn(k) };
}

/* ---------- Bilan de la semaine (7 derniers jours) ---------- */
export function weekInsights(k) {
  k = k || todayKey();
  const items = [], add = (lvl, t, d, src) => items.push({ lvl, t, d, src: src || [] });
  const cur = range(k, -6, 0), prev = range(k, -13, -7);
  const lc = cur.reduce((a, d) => a + dayLoad(d), 0), lp = prev.reduce((a, d) => a + dayLoad(d), 0);
  if (lc > 0) {
    const ch = lp > 0 ? (lc / lp - 1) * 100 : null, lr = loadRatio(k);
    const txt = Math.round(lc).toLocaleString('fr-FR') + ' UA sur 7 jours' + (ch !== null ? ' (' + (ch >= 0 ? '+' : '') + Math.round(ch) + ' % vs les 7 jours d’avant)' : '') + (lr ? ', ratio aigu/chronique ' + f1(lr.ratio) : '') + '.';
    if (lr && lr.ratio > 1.5) add('warn', 'Charge en forte hausse', txt + ' Au-delà de 1,5, garde le même niveau la semaine prochaine.', ['gabbett2016', 'impellizzeri2020']);
    else if (lr && lr.ratio < 0.8) add('info', 'Charge en baisse', txt + ' Normal en décharge ou en affûtage ; sinon reprends progressivement.', ['gabbett2016']);
    else add('good', 'Charge', txt, ['foster2001', 'gabbett2016']);
    const mo = monotony(k);
    if (mo) add(mo.mono > 2 ? 'info' : 'good', 'Monotonie · ' + f1(mo.mono), mo.mono > 2 ? 'Au-dessus de 2 : alterne davantage jours durs et faciles.' : 'Bonne alternance entre jours durs et faciles.', ['foster1998']);
  }
  const w7 = cur.map(d => score(jget(d))).filter(x => x !== null), w28 = range(k, -34, -7).map(d => score(jget(d))).filter(x => x !== null);
  if (w7.length >= 3) {
    const m7 = mean(w7), m28 = w28.length >= 7 ? mean(w28) : null;
    const diff = m28 !== null ? m7 - m28 : 0;
    const vm = verdict(Math.round(m7)).cls;
    add(vm === 'warn' || vm === 'crit' || diff <= -2 ? 'warn' : 'good', 'Forme moyenne · ' + f1(m7) + '/25', m28 !== null ? (diff <= -2 ? 'En baisse par rapport aux semaines d’avant (' + f1(m28) + ') : la charge est peut-être trop haute.' : 'Stable par rapport aux semaines d’avant (' + f1(m28) + ').') : 'La comparaison à ta moyenne viendra après quelques semaines.', ['saw2016', 'mclean2010']);
  }
  const nights = cur.map(d => nightTotal(jget(d))).filter(x => x !== null), tgt = sleepTarget();
  if (nights.length >= 3) {
    const short = nights.filter(x => x < tgt).length, m = mean(nights);
    add(short >= 3 ? 'warn' : 'good', 'Sommeil moyen · ' + durLong(Math.round(m)), short ? short + ' nuit' + (short > 1 ? 's' : '') + ' sous ' + (tgt / 60) + ' h cette semaine.' + (short >= 3 ? ' Avance le coucher ou allonge la nuit avant les grosses séances.' : '') : 'Pas de nuit courte cette semaine.', tgt === 480 ? ['walsh2021', 'milewski2014'] : ['walsh2021']);
  }
  const h = hrvStatus(k);
  if (h) add(h.state === 'low' ? 'warn' : 'good', 'VFC · ' + Math.round(h.avg7) + ' ms sur 7 j', h.state === 'low' ? 'Sous ta zone habituelle (' + Math.round(h.lo) + '-' + Math.round(h.hi) + ' ms).' : h.state === 'high' ? 'Au-dessus de ta zone habituelle (' + Math.round(h.lo) + '-' + Math.round(h.hi) + ' ms).' : 'Dans ta zone habituelle (' + Math.round(h.lo) + '-' + Math.round(h.hi) + ' ms).', ['plews2013', 'ais2023']);
  const pains = {};
  for (const d of cur) { const e = jget(d); for (const [f] of FLAGS) if (e.flags && e.flags[f]) { const g = e.gene && typeof e.gene[f] === 'number' ? e.gene[f] : 0; pains[f] = Math.max(pains[f] || 0, g); } }
  const pk = Object.keys(pains);
  if (pk.length) { const mx = Math.max(...pk.map(f => pains[f])); add(mx > 5 ? 'crit' : mx >= 3 ? 'warn' : 'info', 'Gênes cette semaine', pk.map(f => FL[f] + (pains[f] ? ' ' + pains[f] + '/10' : '')).join(' · ') + (mx > 5 ? '. Au-dessus de 5/10 : à adapter, et à faire voir si ça dure.' : '.'), ['silbernagel2007']);
  }
  items.sort((a, b) => LV[a.lvl] - LV[b.lvl]);
  return items;
}
