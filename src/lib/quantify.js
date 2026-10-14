// Bilan chiffré d'une séance : escalade (blocs, chutes, temps sur le mur, cotation par rapport à ton niveau)
// et muscu (tonnage, % du 1RM). Plus le conseil pour la prochaine séance de grimpe (chutes + ressenti).
import { jget, get, put, planLocked, ids } from './store.js';
import { blocks, itemKey, doneN, setLoadsOf, itemLoad, target, blockState, day } from './plan.js';
import { meanGrade, maxGrade, gapText, shiftGrade } from './grades.js';
import { climbLevel, oneRM, LIFT_OF_LIB } from './levels.js';
import { libMatch, norm } from './library.js';
import { bodyWeightAt } from './tests.js';
import { mmss, fmtShort, addDays } from './dates.js';

export const discOf = it => it.disc || (it.unit === 'Voie' ? 'voie' : 'bloc');
const UNIT = { Bloc: 'bloc', Voie: 'voie', Essai: 'essai' };
const pl = (n, w) => n + ' ' + w + (n > 1 ? 's' : '');
const isClimb = it => ['Bloc', 'Voie', 'Essai'].includes(it.unit);

// Lignes du bilan d'un exercice de grimpe
export function climbBilan(k, b, it) {
  const e = jget(k), key = itemKey(b, it), n = doneN(e, key, it.n), disc = discOf(it);
  const log = (e.cl || {})[key] || [], falls = (e.falls || {})[key] || 0, wall = (e.wall || {})[key] || 0;
  const out = [pl(n, UNIT[it.unit] || 'bloc')];
  if (falls || log.length) out.push(pl(falls, 'chute'));
  if (wall) out.push(mmss(wall) + ' sur ' + (disc === 'voie' ? 'les voies' : 'le mur'));
  const gs = log.map(x => x.g).filter(Boolean);
  if (gs.length) {
    const m = meanGrade(gs, disc), lv = climbLevel(), ref = disc === 'voie' ? lv.vf : lv.bf, gap = ref ? gapText(m, ref.g, disc, disc === 'voie' ? 'à vue' : 'flash') : null;
    out.push((gs.every(g => g === gs[0]) ? m : m + ' en moyenne, ' + maxGrade(gs, disc) + ' au plus') + (gap ? ' (' + gap + ')' : ''));
  }
  return out;
}

// Reps par série pour le tonnage
function repsPerSet(it) {
  if (it.reps) return it.reps;
  if (it.rx && Array.isArray(it.rx.r)) return Math.round((it.rx.r[0] + it.rx.r[1]) / 2);
  const m = String(it.det || '').match(/(\d+)\s*(?:-\s*\d+\s*)?(?:rép|répétitions)/i);
  return m ? +m[1] : null;
}
// Bilan muscu : tonnage (poids de corps compris pour les exercices lestés) et % du 1RM des mouvements de base
export function strengthBilan(k, part) {
  const e = jget(k); let ton = 0; const pcts = [];
  for (const b of blocks(k)) {
    if (part ? b.id !== part : ['apart', 'moved', 'skip'].includes(blockState(e, b))) continue;
    if (!['muscu', 'renfo', 'epaule', 'doigts'].includes(b.kind)) continue;
    for (const it of b.items || []) {
      const key = itemKey(b, it), n = doneN(e, key, it.n); if (!n || it.id === 'ech') continue;
      const r = repsPerSet(it); if (!r) continue;
      const sl = setLoadsOf(e, key), ld = itemLoad(b, it, e); if (!sl && !ld) continue;
      const bw = it.unit_load === '+kg' ? bodyWeightAt(k) || 0 : 0;
      const loads = sl || Array.from({ length: n }, () => ld.v);
      ton += loads.reduce((a, w) => a + (bw + w) * r, 0);
      const lift = LIFT_OF_LIB[it.lib || (libMatch(it.label) || {}).id];
      const rm = lift ? oneRM(lift) : null;
      if (rm && rm.v > 0) { const avg = loads.reduce((a, w) => a + bw + w, 0) / loads.length; pcts.push(it.label + ' ≈ ' + Math.round(avg / rm.v * 100) + ' % de ton 1RM'); }
    }
  }
  const out = [];
  if (ton > 0) out.push('Tonnage ' + Math.round(ton).toLocaleString('fr-FR') + ' kg');
  return out.concat(pcts);
}

// Bilan complet d'une séance (ou d'un bloc fait à part)
export function sessionBilan(k, part) {
  const e = jget(k), out = [];
  for (const b of blocks(k)) {
    if (part ? b.id !== part : ['apart', 'moved', 'skip'].includes(blockState(e, b))) continue;
    for (const it of b.items || []) {
      if (!isClimb(it)) continue;
      const key = itemKey(b, it);
      if (!((e.cl || {})[key] || (e.falls || {})[key] != null || (e.wall || {})[key])) continue;
      out.push({ label: it.label + ' · ' + doneN(e, key, it.n) + '/' + it.n, lines: climbBilan(k, b, it).slice(1) });
    }
  }
  const sb = strengthBilan(k, part); if (sb.length) out.push({ label: 'Muscu', lines: sb });
  return out;
}

/* ---------- Conseil pour la prochaine séance de grimpe ---------- */
// même exercice : même identifiant de bibliothèque, ou même libellé une fois retirés nombres et cotations (« 22 blocs 6a » ≈ « 24 blocs 6b »)
const shape = it => it.lib || norm(String(it.label || '').replace(/\b\d+[abcABC]?\+?\b/g, ''));
function lastClimb(k, it) {
  const s = shape(it);
  for (const id of ids('j:').filter(x => x.slice(2) < k).sort().reverse().slice(0, 90)) {
    const d = id.slice(2), e = get(id) || {};
    for (const b of blocks(d)) for (const x of b.items || []) {
      if (x.unit !== it.unit || shape(x) !== s) continue;
      const key = itemKey(b, x), n = doneN(e, key, x.n); if (!n) continue;
      return { k: d, n, planned: x.n, falls: (e.falls || {})[key] || 0, log: (e.cl || {})[key] || [], rpe: typeof e.rpe === 'number' ? e.rpe : null, tg: target(d) && target(d).rpe };
    }
  }
  return null;
}
function setItem(k, b, it, patch) {
  const d = day(k); if (!d) return;
  put('p:' + k, Object.assign({}, d, { blocks: d.blocks.map(x => x.id !== b.id ? x : Object.assign({}, x, { items: x.items.map(y => y.id !== it.id ? y : Object.assign({}, y, patch)) })) }));
}
export function climbSuggest(k, b, it) {
  if (it.unit === 'Essai' || doneN(jget(k), itemKey(b, it), it.n) > 0) return null;
  const lp = lastClimb(k, it); if (!lp) return null;
  const u = UNIT[it.unit] || 'bloc', disc = discOf(it), ratio = lp.falls / lp.n;
  const g = lp.log.length ? meanGrade(lp.log.map(x => x.g).filter(Boolean), disc) : null;
  const when = fmtShort(lp.k).toLowerCase(), rp = lp.rpe != null ? ', ressenti ' + lp.rpe + (lp.tg ? ' (cible ' + lp.tg[0] + '-' + lp.tg[1] + ')' : '') : '';
  const can = !planLocked();
  if (lp.n < lp.planned) return { text: 'Même volume que prévu', why: 'Le ' + when + ' : ' + lp.n + '/' + lp.planned + ' ' + u + 's' + rp + '. On consolide avant d’ajouter.' };
  if (ratio >= 0.25 || (lp.rpe != null && lp.tg && lp.rpe > lp.tg[1])) {
    if (g) { const g2 = shiftGrade(g, -1, disc); return { text: 'Une cotation en dessous : ' + g2, why: 'Le ' + when + ' : ' + pl(lp.falls, 'chute') + ' sur ' + lp.n + rp + '. Même volume, un peu plus facile, pour garder la qualité.', apply: can ? () => setItem(k, b, it, { grade: g2 }) : null }; }
    const n2 = Math.max(1, lp.n - 2); if (n2 >= it.n) return null;
    return { text: n2 + ' ' + u + 's', why: 'Le ' + when + ' : ' + pl(lp.falls, 'chute') + ' sur ' + lp.n + rp + '. Un peu moins de volume pour garder la qualité.', apply: can ? () => setItem(k, b, it, { n: n2 }) : null };
  }
  if (ratio <= 0.1 && lp.rpe != null && (!lp.tg || lp.rpe <= lp.tg[1])) {
    const n2 = lp.n + 2; if (it.n >= n2) return null; // le plan progresse déjà
    return { text: n2 + ' ' + u + 's' + (g ? ' en ' + g : ''), why: 'Le ' + when + ' : ' + pl(lp.falls, 'chute') + ' sur ' + lp.n + rp + '. Une seule chose change à la fois : 2 ' + u + 's de plus.', apply: can ? () => setItem(k, b, it, Object.assign({ n: n2 }, g ? { grade: g } : {})) : null };
  }
  return null;
}
