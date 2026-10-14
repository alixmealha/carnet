// Texte dont les termes techniques s'expliquent d'un appui (souligné en pointillés). Chaque terme n'est souligné
// qu'une fois par texte, pour ne pas surcharger.
import { useState } from 'preact/hooks';
import { GLOSS, GLOSS_BY_ID, GLOSS_RE, glossIdOf } from '../lib/glossary.js';
import { Sheet, Src } from './kit.jsx';

export function TermSheet({ id, onClose }) {
  const g = GLOSS_BY_ID[id]; if (!g) return null;
  return <Sheet title={g.t} onClose={onClose} cls="top"><div class="stack"><p style="margin:0">{g.d}</p>{g.src && <p class="small" style="margin:0"><Src ids={g.src} /></p>}</div></Sheet>;
}
export function glossParts(s, open, seen) {
  const out = []; let last = 0, m; GLOSS_RE.lastIndex = 0;
  while ((m = GLOSS_RE.exec(s))) {
    const id = glossIdOf(m[2]), start = m.index + m[1].length;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (start > last) out.push(s.slice(last, start));
    out.push(<button type="button" class="term" onClick={e => { e.stopPropagation(); open(id); }}>{m[2]}</button>);
    last = start + m[2].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
export function Gloss({ text }) {
  const [id, setId] = useState(null);
  if (!text) return null;
  return <>{glossParts(String(text), setId, new Set())}{id && <TermSheet id={id} onClose={() => setId(null)} />}</>;
}
// Lexique complet (Plus → Repères → Lexique)
export function Lexicon() {
  return <div class="stack" style="gap:10px">{GLOSS.slice().sort((a, b) => a.t.localeCompare(b.t, 'fr')).map(g => <div class="lex"><b>{g.t}</b><p>{g.d}</p>{g.src && <Src ids={g.src} />}</div>)}</div>;
}
