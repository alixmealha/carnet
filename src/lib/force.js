// Analyse d'une mesure de force (capteur Tindeq Progressor ou autre dynamomètre) : échantillons [temps en s, force en kg].
// Force max : pic de la force lissée sur 0,25 s. Force critique : test de Giles et al. 2019, 24 tractions de 7 s avec 3 s de repos,
// force critique = moyenne des moyennes des 6 dernières tractions.

// Force lissée : moyenne glissante sur `win` secondes ; retourne [[t, kg], …]
export function smooth(samples, win = 0.25) {
  const out = [];
  let j = 0, sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i][1];
    while (samples[i][0] - samples[j][0] > win) { sum -= samples[j][1]; j++; }
    out.push([samples[i][0], sum / (i - j + 1)]);
  }
  return out;
}
const r1 = x => Math.round(x * 10) / 10;

// Début de l'effort : première force au-dessus de max(2 kg, 8 % du pic)
export function startOf(samples) {
  if (!samples.length) return null;
  const pk = Math.max(...samples.map(s => s[1])), thr = Math.max(2, pk * 0.08);
  const s = samples.find(x => x[1] >= thr);
  return s ? s[0] : null;
}

// Test de force max : pic lissé (0,25 s) et meilleure moyenne sur 5 s (force tenue)
export function maxTest(samples) {
  if (samples.length < 5) return null;
  const sm = smooth(samples), peak = Math.max(...sm.map(s => s[1]));
  if (!(peak > 0)) return null;
  const sm5 = smooth(samples, 5);
  let hold = 0; const t0 = startOf(samples) || 0;
  for (const s of sm5) if (s[0] - t0 >= 4.9 && s[1] > hold) hold = s[1];
  return { peak: r1(peak), hold5: hold ? r1(hold) : null, n: samples.length };
}

// Test de force critique : `reps` tractions de `on` s, `off` s de repos, départ au premier effort
export function cfTest(samples, opts) {
  const o = Object.assign({ on: 7, off: 3, reps: 24, last: 6, skip: 0.5 }, opts || {});
  const t0 = startOf(samples);
  if (t0 == null) return null;
  const reps = [];
  for (let i = 0; i < o.reps; i++) {
    const a = t0 + i * (o.on + o.off) + o.skip, b = t0 + i * (o.on + o.off) + o.on;
    const w = samples.filter(s => s[0] >= a && s[0] <= b);
    if (w.length < 3) break;
    reps.push(w.reduce((x, s) => x + s[1], 0) / w.length);
  }
  if (reps.length < o.last + 2) return null;
  const sm = smooth(samples), peak = Math.max(...sm.map(s => s[1])), tail = reps.slice(-o.last);
  const cf = tail.reduce((x, v) => x + v, 0) / tail.length;
  return { cf: r1(cf), pic: r1(peak), reps: reps.map(r1), complete: reps.length >= o.reps, ratio: Math.round(cf / peak * 100) };
}

// Qu'est-ce que le capteur peut remplir : tests de force des doigts
export const TINDEQ_TESTS = { 'fmax-semi': 'max', 'fmax-tendu': 'max', pinch: 'max', cf: 'cf' };
export const tindeqKind = tid => TINDEQ_TESTS[tid] || null;
