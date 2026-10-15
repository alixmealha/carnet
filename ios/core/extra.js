// Petites fonctions pour l'appli iPhone : ce qui, dans la version web, passe par des fonctions stockées dans les données
// (dérivés de tests, « Utiliser » d'un conseil…) ou par l'interface (termes du lexique).
import { GLOSS_RE, glossIdOf } from '../../src/lib/glossary.js';
import { testById } from '../../src/lib/tests.js';
import { blocks } from '../../src/lib/plan.js';
import { climbSuggest } from '../../src/lib/quantify.js';

// Texte découpé en morceaux : [texte, idTerme|null] ; chaque terme n'est souligné qu'une fois par texte
export function glossSplit(s) {
  s = String(s || ''); const out = [], seen = new Set(); let last = 0, m; GLOSS_RE.lastIndex = 0;
  while ((m = GLOSS_RE.exec(s))) {
    const id = glossIdOf(m[2]), start = m.index + m[1].length;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (start > last) out.push([s.slice(last, start), null]);
    out.push([m[2], id]);
    last = start + m[2].length;
  }
  if (last < s.length) out.push([s.slice(last), null]);
  return out;
}
export function testDerive(tid, vals) { const t = testById(tid); return t && t.derive ? t.derive(vals || {}) : null; }
const find = (k, bid, iid) => { const b = blocks(k).find(x => x.id === bid); const it = b && (b.items || []).find(x => x.id === iid); return { b, it }; };
export function climbSuggestOf(k, bid, iid) {
  const { b, it } = find(k, bid, iid); if (!b || !it) return null;
  const s = climbSuggest(k, b, it); if (!s) return null;
  return { text: s.text, why: s.why, canApply: !!s.apply };
}
export function climbSuggestApply(k, bid, iid) {
  const { b, it } = find(k, bid, iid); if (!b || !it) return false;
  const s = climbSuggest(k, b, it); if (s && s.apply) { s.apply(); return true; }
  return false;
}

// Alerte 48 h quand on déplace un bloc (copie de ui/BlockMenu.jsx)
import { heavyOf, groupsTxt } from '../../src/lib/builder.js';
import { day } from '../../src/lib/plan.js';
import { addDays } from '../../src/lib/dates.js';
export function moveWarn(k, bid, to) {
  const d0 = day(k), b = d0 && (d0.blocks || []).find(x => x.id === bid); if (!b) return null;
  const mine = heavyOf({ blocks: [b] }); if (!mine.size) return null;
  const hv = d => { const dd = day(d); return heavyOf(dd && d === k ? { blocks: dd.blocks.filter(x => x.id !== b.id) } : dd); };
  const out = [];
  const same = [...mine].filter(g => hv(to).has(g)); if (same.length) out.push(groupsTxt(same) + ' déjà en lourd ce jour-là');
  for (const [o, w] of [[-1, 'la veille'], [1, 'le lendemain']]) { const g = [...mine].filter(x => hv(addDays(to, o)).has(x)); if (g.length) out.push(groupsTxt(g) + ' en lourd ' + w); }
  return out.length ? out.join(' · ') : null;
}
