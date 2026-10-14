import { jget, ids } from './store.js';
import { meta, target, blocks, weekKeys, allItems, doneN, itemLoad, sessionName, PHASE_LABEL, weekLabel, setLoadsOf, workLoad, sessionsOf } from './plan.js';
import { score, nightTotal, zoneOf, rng, FLAGS, verdict } from './rules.js';
import { addDays, todayKey, fmtRange } from './dates.js';
import { climber } from './sports.js';

export function dayPlanned(k) { const t = target(k); return t ? (t.i || 0) + (t.v || 0) : 0; }
export function dayReal(k) {
  const e = jget(k);
  if (e.siv && typeof e.siv.i === 'number' && typeof e.siv.v === 'number') return e.siv.i + e.siv.v;
  if (e.status === 'faite') return dayPlanned(k);
  if (e.status === 'sautee') return 0;
  return null;
}
const climbing = k => blocks(k).some(b => ['grimpe', 'doigts', 'test', 'compet', 'affut'].includes(b.kind));

export function weeksStats() {
  const m = meta(); if (!m) return [];
  const cl = climber(); // grimpeur : intensité des séances d'escalade et de doigts ; sinon toutes les séances
  return m.weeks.map((w, wi) => {
    const ks = weekKeys(w); let plan = 0, real = 0, rh = false, ua = 0, uh = false, wsum = 0, wn = 0, ssum = 0, sn = 0, items = 0, itemsDone = 0;
    const tz = [0, 0, 0];
    for (const k of ks) {
      plan += dayPlanned(k);
      const r = dayReal(k); if (r !== null) { real += r; rh = true; }
      const e = jget(k);
      for (const x of sessionsOf(e)) {
        ua += x.rpe * x.duree; uh = true;
        if (!cl || climbing(k)) tz[zoneOf(x.rpe)] += x.duree;
      }
      const t = score(e); if (t !== null) { wsum += t; wn++; }
      const nt = nightTotal(e); if (nt !== null) { ssum += nt; sn++; }
      if (k <= todayKey()) for (const { b, it, key } of allItems(k)) { if (e.moved && e.moved[b.id]) continue; const v = doneN(e, key, it.n); if (it.opt && !v) continue; items++; if (v >= it.n) itemsDone++; }
    }
    return { wi, w, ks, label: weekLabel(w), range: fmtRange(w.start, w.end), phase: PHASE_LABEL[w.phase] || w.bloc, plan, real: rh ? real : null, ua: uh ? ua : null, tz,
      well: wn ? wsum / wn : null, sleep: sn ? Math.round(ssum / sn) : null, adherence: items ? itemsDone / items : null };
  });
}
export function currentWeekIndex(ws) {
  const t = todayKey();
  const i = ws.findIndex(x => t >= x.w.start && t <= x.w.end);
  if (i >= 0) return i;
  return ws.length && t < ws[0].w.start ? -1 : ws.length;
}

// Séries d'une variable par jour (forme, sommeil)
export function daySeries(fn) {
  const m = meta(); if (!m) return [];
  const out = [];
  for (const id of ids('j:')) { const k = id.slice(2); const v = fn(jget(k), k); if (v !== null && v !== undefined) out.push({ k, v }); }
  return out;
}

// Progression des charges : un point par jour où l'exercice a été fait
export function loadSeries() {
  const map = new Map();
  for (const id of ids('j:')) {
    const k = id.slice(2), e = jget(k);
    for (const { b, it, key } of allItems(k)) {
      if (!['muscu', 'doigts', 'epaule', 'renfo'].includes(b.kind)) continue;
      if (doneN(e, key, it.n) <= 0) continue;
      const ld = itemLoad(b, it, e);
      if (!ld) continue;
      const name = b.kind === 'doigts' ? 'Finger lift · ' + it.label.toLowerCase() : it.label;
      if (!map.has(name)) map.set(name, { name, unit: ld.u, pts: [] });
      const sl = setLoadsOf(e, key);
      map.get(name).pts.push({ k, v: sl ? workLoad(sl) : ld.v, sets: doneN(e, key, it.n), n: it.n, sl });
    }
  }
  return [...map.values()].filter(s => s.pts.length).sort((a, b) => b.pts.length - a.pts.length);
}

export function alerts(ws) {
  const a = [];
  const keys = ids('j:').map(id => id.slice(2));
  for (const k of keys) {
    const e = jget(k), t = score(e);
    if (t !== null && t <= 10) a.push({ k, c: 'var(--crit)', t: 'Forme ' + t + '/25', d: 'Très fatigué : version décharge ce jour-là.' });
    const n1 = nightTotal(e), n0 = nightTotal(jget(addDays(k, -1))), nm = nightTotal(jget(addDays(k, -2)));
    if (n1 !== null && n0 !== null && n1 < 420 && n0 < 420 && !(nm !== null && nm < 420)) a.push({ k, c: 'var(--warn)', t: 'Deux nuits sous 7 h', d: 'La séance la plus lourde de la semaine passe en version décharge.' });
    for (const [f, lbl] of FLAGS) {
      if (!(e.flags && e.flags[f])) continue;
      const g = e.gene && typeof e.gene[f] === 'number' ? e.gene[f] : null;
      a.push({ k, c: g !== null && g >= 4 ? 'var(--crit)' : 'var(--warn)', t: lbl + (g !== null ? ' ' + g + '/10' : ' sensible'), d: g !== null && g >= 4 ? 'Gêne marquée : suis la règle du jour et parles-en au kiné si ça dure.' : 'Sensible au réveil : la séance s’adapte ce jour-là.' });
    }
    const p = target(k);
    if (p && p.rpe && p.fam !== 'test' && typeof e.rpe === 'number' && e.rpe > p.rpe[1]) a.push({ k, c: 'var(--warn)', t: 'Ressenti ' + e.rpe + '/10', d: sessionName(k) + ' : au-dessus de la cible (' + rng(p) + ').' });
  }
  const wl = keys.map(k => ({ k, t: score(jget(k)) })).filter(x => x.t !== null);
  for (let i = 3; i < wl.length; i++) {
    const s = wl.slice(i - 3, i + 1);
    const span = (Date.parse(s[3].k) - Date.parse(s[0].k)) / 864e5;
    if (span <= 4 && s[1].t < s[0].t && s[2].t < s[1].t && s[3].t < s[2].t) a.push({ k: s[3].k, c: 'var(--warn)', t: 'Forme en baisse 3 jours de suite', d: 'Si ça continue, garde le même palier la semaine suivante.' });
  }
  ws.forEach((x, i) => {
    const p = ws[i - 1];
    if (p && p.ua && x.ua && x.ua > p.ua * 1.3) {
      const lastLogged = x.ks.filter(k => Object.keys(jget(k)).length).pop() || x.w.end;
      a.push({ k: lastLogged, c: 'var(--warn)', t: 'Charge +' + Math.round((x.ua / p.ua - 1) * 100) + ' % en ' + x.label, d: 'Grosse hausse sur une semaine : garde la suivante au même niveau.' });
    }
  });
  return a.sort((u, v) => u.k < v.k ? 1 : u.k > v.k ? -1 : 0);
}

export function tiles(ws) {
  const today = todayKey(), m = meta();
  const past = m ? [] : [];
  if (m) for (const w of m.weeks) for (const k of weekKeys(w)) if (k <= today && (target(k) || blocks(k).some(b => b.kind === 'kine'))) past.push(k);
  const done = past.filter(k => { const s = jget(k).status; return s === 'faite' || s === 'adaptee'; }).length;
  const last7 = []; for (let i = 0; i < 7; i++) last7.push(addDays(today, -i));
  const sc = last7.map(k => score(jget(k))).filter(x => x !== null), sl = last7.map(k => nightTotal(jget(k))).filter(x => x !== null);
  const avg = a => a.reduce((s, x) => s + x, 0) / a.length;
  const ci = currentWeekIndex(ws), cur = ws[ci], prv = ws[ci - 1];
  return {
    done, planned: past.length,
    well: sc.length ? avg(sc) : null, wellLbl: sc.length ? verdict(Math.round(avg(sc))).lbl : null,
    sleep: sl.length ? Math.round(avg(sl)) : null, sleepN: sl.length,
    ua: cur && cur.ua, uaDelta: cur && cur.ua && prv && prv.ua ? Math.round((cur.ua / prv.ua - 1) * 100) : null
  };
}
