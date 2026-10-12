import { jget } from './store.js';
import { addDays, pad } from './dates.js';
import { kinds } from './plan.js';

export const WELL = [
  ['sommeil', 'Sommeil', 'très mauvais', 'excellent'],
  ['fatigue', 'Fatigue', 'épuisé', 'frais'],
  ['courbatures', 'Courbatures', 'très courbaturé', 'aucune'],
  ['stress', 'Stress', 'très stressé', 'détendu'],
  ['humeur', 'Humeur', 'très basse', 'excellente']
];
export const FLAGS = [['doigts', 'Doigts'], ['coude', 'Coude'], ['epaule', 'Épaule'], ['genou', 'Genou']];
export const RPE = ['Repos', 'Très très facile', 'Facile', 'Modéré', 'Un peu dur', 'Dur', 'Dur', 'Très dur', 'Très dur', 'Presque maximal', 'Maximal'];
export const STATUS = [['faite', 'Faite'], ['adaptee', 'Adaptée'], ['sautee', 'Sautée']];
export const SIV = [['s', 'Spécificité', 'proche de grimper en bloc à ton niveau ?'], ['i', 'Intensité', 'proche de ton max ?'], ['v', 'Volume', 'proche de ta plus grosse séance ?']];

export function score(e) {
  if (!e || !e.well) return null;
  let t = 0;
  for (const [k] of WELL) { const v = e.well[k]; if (typeof v !== 'number') return null; t += v; }
  return t;
}
export function verdict(t) {
  if (t >= 20) return { lbl: 'En forme', cls: 'good' };
  if (t >= 15) return { lbl: 'Correct', cls: 'ok' };
  if (t >= 11) return { lbl: 'Fatigué', cls: 'warn' };
  return { lbl: 'Très fatigué', cls: 'crit' };
}
export const verdictColor = cls => cls === 'good' ? 'var(--good)' : cls === 'warn' ? 'var(--warn)' : cls === 'crit' ? 'var(--crit)' : 'var(--muted)';

/* ---------- Nuit ---------- */
export const NSTAGE = [['profond', 'Profond'], ['leger', 'Léger'], ['rem', 'Paradoxal'], ['eveil', 'Éveillé']];
export const NMET = [['vfc', 'VFC', 'ms'], ['fcr', 'FC repos', 'bpm'], ['recup', 'Récup', '%']];
export function parseDur(raw) {
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;
  let m = s.match(/^(\d{1,2})[h:.,](\d{0,2})(?:min|mn|m)?$/);
  if (m) return (+m[1]) * 60 + (m[2] ? +m[2] : 0);
  m = s.match(/^(\d{1,3})(?:min|mn|m)?$/);
  if (m) return +m[1];
  return NaN;
}
export const durShort = min => { const h = Math.floor(min / 60), m = min % 60; return h ? h + 'h' + pad(m) : m + 'min'; };
export const durLong = min => { const h = Math.floor(min / 60), m = min % 60; return h ? h + ' h ' + pad(m) : m + ' min'; };
export function nightTotal(e) {
  const n = e && e.nuit; if (!n) return null;
  const v = ['profond', 'leger', 'rem'].map(k => n[k]).filter(x => typeof x === 'number');
  return v.length ? v.reduce((a, b) => a + b, 0) : null;
}
export function nightShort(k) {
  const e = jget(k), tot = nightTotal(e);
  if (tot !== null) return tot < 420;
  const s = e.well && e.well.sommeil; return typeof s === 'number' ? s <= 2 : null;
}
export function vfcAvg(k) {
  const vals = [];
  for (let j = 1; j <= 7; j++) { const e = jget(addDays(k, -j)); if (e.nuit && typeof e.nuit.vfc === 'number') vals.push(e.nuit.vfc); }
  return vals.length >= 3 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}
export function nightCompare(e) {
  const tot = nightTotal(e), s = e.well && e.well.sommeil;
  if (tot === null || typeof s !== 'number') return null;
  if (s <= 2 && tot >= 450) return 'Ressenti ' + s + '/5 mais nuit longue : la fatigue vient peut-être d’ailleurs (stress, charge, qualité du sommeil).';
  if (s >= 4 && tot < 360) return 'Ressenti ' + s + '/5 malgré une nuit courte : la dette peut se faire sentir dans un ou deux jours.';
  return 'Ressenti ' + s + '/5 et mesure vont dans le même sens.';
}

/* ---------- Adaptation du jour ---------- */
export function advice(k) {
  const e = jget(k), ks = kinds(k), t = score(e), f = e.flags || {}, out = [];
  if (t !== null) {
    if (t <= 10) out.push(['crit', 'Version décharge : moitié du volume, rien au max. Si c’est la séance la plus lourde de la semaine, décale-la.']);
    else if (t <= 14) out.push(['warn', 'Séance allégée : un tiers de séries en moins, RIR +1, et pas de nouveau palier aujourd’hui.']);
  }
  if (nightShort(k) === true && nightShort(addDays(k, -1)) === true) out.push(['warn', 'Deuxième nuit courte d’affilée (moins de 7 h, ou mal dormi) : la séance la plus lourde de la semaine passe en version décharge.']);
  if (f.doigts) out.push(['crit', (ks.has('doigts') || ks.has('grimpe') || ks.has('test')) ? 'Doigts sensibles : ni finger lift ni réglettes arquées aujourd’hui. Grimpe sur pinces et plats, ou en technique.' : 'Doigts sensibles : rien de prévu pour eux aujourd’hui. Revérifie demain matin.']);
  if (f.coude) out.push(['warn', ks.has('muscu') ? 'Coude interne : 2 séries de tractions et de pendlay en moins.' : 'Coude interne : à surveiller avant la prochaine séance de tirage.']);
  if (f.epaule) out.push(['warn', ks.has('muscu') ? 'Épaule : ni presse épaule ni bench aujourd’hui, garde les tirages.' : 'Épaule : si ça persiste, ni presse ni bench à la prochaine muscu.']);
  if (f.genou) out.push(['warn', ks.has('velo') ? 'Genou : pas de vélo aujourd’hui, et signale-le au kiné.' : 'Genou : signale-le au kiné, c’est lui qui décide pour la séance genou.']);
  if (t !== null && t >= 15 && out.length === 0) out.push(['good', 'Séance telle que prévue.']);
  if (t === null && out.length === 0) return null;
  return out;
}

/* ---------- Ressenti visé ---------- */
export const ADJ = {
  vol: ['Plus facile que prévu. Si ça se répète à la prochaine séance volume, passe un tiers des blocs une cotation au-dessus.', 'Plus dur que prévu. Regarde ta nuit et ta forme du matin ; si ça se répète, n’ajoute pas de blocs la semaine suivante.'],
  easy: ['Plus facile que prévu, sans gravité pour ce type de séance.', 'Plus dur que prévu pour une séance qui doit rester facile : baisse les cotations ou la charge la prochaine fois.'],
  hard: ['Plus facile que prévu : prends des blocs plus durs la prochaine fois.', 'Au-dessus de la cible : moins de blocs ou d’essais la prochaine fois, surtout si les doigts tirent.'],
  light: ['Sous la cible : aucun souci sur une séance légère.', 'Trop dur pour une séance légère : lève le pied, c’est elle qui te fait récupérer.'],
  muscu: ['Plus facile que prévu : vérifie le RIR des dernières séries. S’il te restait plus de 2 répétitions, la charge est trop légère.', 'Plus dur que prévu : si le RIR visé n’est pas tenu, garde la même charge la prochaine fois.'],
  test: ['', '']
};
export const rng = tg => tg.rpe[0] === tg.rpe[1] ? String(tg.rpe[0]) : tg.rpe[0] + '–' + tg.rpe[1];
export function rpeCmp(tg, rpe) {
  if (!tg || tg.fam === 'test' || typeof rpe !== 'number') return null;
  const adj = ADJ[tg.fam] || ADJ.easy;
  if (rpe < tg.rpe[0]) return { cls: 'warn', text: 'Sous la cible (' + rng(tg) + '). ' + adj[0] };
  if (rpe > tg.rpe[1]) return { cls: 'warn', text: 'Au-dessus de la cible (' + rng(tg) + '). ' + adj[1] };
  return { cls: 'good', text: 'Dans la cible (' + rng(tg) + ').' };
}
export const zoneOf = r => r <= 4 ? 0 : r <= 6 ? 1 : 2;
export const ZONES = [['Facile', 'z1', '0–4'], ['Modéré', 'z2', '5–6'], ['Dur', 'z3', '7–10']];
