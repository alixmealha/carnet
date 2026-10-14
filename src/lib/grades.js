// Cotations d'escalade : bloc (Fontainebleau) et voie (cotation française), sur deux échelles ordonnées.
// L'intensité d'une séance s'exprime en niveaux d'écart avec ton flash (bloc) ou ton à vue (voie) :
// c'est ainsi que les grimpeurs dosent leurs séances, et c'est exact sur une échelle ordinale.
export const FONT = ['3', '4', '4+', '5', '5+', '6A', '6A+', '6B', '6B+', '6C', '6C+', '7A', '7A+', '7B', '7B+', '7C', '7C+', '8A', '8A+', '8B', '8B+', '8C', '8C+', '9A'];
export const FR = ['3', '4a', '4b', '4c', '5a', '5b', '5c', '6a', '6a+', '6b', '6b+', '6c', '6c+', '7a', '7a+', '7b', '7b+', '7c', '7c+', '8a', '8a+', '8b', '8b+', '8c', '8c+', '9a', '9a+', '9b', '9b+', '9c'];
export const SCALE = { bloc: FONT, voie: FR };
export const DISC_LBL = { bloc: 'bloc', voie: 'voie' };

// « 6a », « 6A+ », « 6 a », « 7b+ » → index sur l'échelle de la discipline (null si illisible)
export function gradeIdx(s, disc) {
  if (s == null) return null;
  const t = String(s).trim().replace(/\s+/g, '').toLowerCase();
  const sc = SCALE[disc] || FONT, i = sc.findIndex(g => g.toLowerCase() === t);
  return i >= 0 ? i : null;
}
export const gradeAt = (i, disc) => { const sc = SCALE[disc] || FONT; return i == null ? null : sc[Math.max(0, Math.min(sc.length - 1, i))]; };
export const shiftGrade = (g, n, disc) => { const i = gradeIdx(g, disc); return i == null ? null : gradeAt(i + n, disc); };
// Première cotation trouvée dans un texte (« 22 blocs 6a » → 6A en bloc)
export function gradeIn(text, disc) {
  const m = String(text || '').match(/\b([3-9](?:[abcABC]\+?|\+)?)(?=\b|\s|$|\+)/g);
  if (!m) return null;
  for (const x of m) { const i = gradeIdx(x, disc); if (i != null && /[abc+]/i.test(x)) return gradeAt(i, disc); }
  return null;
}
// Écart en niveaux : « 3 niveaux sous ton flash », « à ton flash », « 1 niveau au-dessus »
export function gapText(g, ref, disc, refLbl) {
  const a = gradeIdx(g, disc), b = gradeIdx(ref, disc); if (a == null || b == null) return null;
  const d = b - a;
  if (d === 0) return 'à ton ' + refLbl;
  return Math.abs(d) + ' niveau' + (Math.abs(d) > 1 ? 'x' : '') + (d > 0 ? ' sous ' : ' au-dessus de ') + 'ton ' + refLbl;
}
// Moyenne d'une liste de cotations (arrondie au niveau le plus proche)
export function meanGrade(list, disc) {
  const ix = (list || []).map(g => gradeIdx(g, disc)).filter(i => i != null);
  if (!ix.length) return null;
  return gradeAt(Math.round(ix.reduce((a, b) => a + b, 0) / ix.length), disc);
}
export function maxGrade(list, disc) {
  const ix = (list || []).map(g => gradeIdx(g, disc)).filter(i => i != null);
  return ix.length ? gradeAt(Math.max(...ix), disc) : null;
}
