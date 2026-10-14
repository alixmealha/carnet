// Repères : les échelles de l'appli (ressenti, forme du matin, douleur, notation escalade), le lexique et les sources.
// Une tuile par échelle avec un aperçu visuel ; le détail s'ouvre d'un appui.
import { useState } from 'preact/hooks';
import { WELL, RPE, ZONES, SIV, bands } from '../lib/rules.js';
import { SOURCES } from '../lib/sources.js';
import { GLOSS } from '../lib/glossary.js';
import { Sheet, Src } from './kit.jsx';
import { Gloss, Lexicon } from './Gloss.jsx';

// vert, vert-jaune, orange, rouge (le « correct » de la forme du matin entre le vert et l'orange)
const col = cls => cls === 'good' ? 'var(--good)' : cls === 'ok' ? 'color-mix(in srgb, var(--good) 55%, var(--warn))' : cls === 'warn' ? 'var(--warn)' : cls === 'crit' ? 'var(--crit)' : 'var(--muted)';
const zoneOf = i => (i <= 4 ? 0 : i <= 6 ? 1 : 2);
const PAIN = [[0, 2, 'good', 'Zone sûre', 'Tu continues normalement.'], [3, 5, 'warn', 'Acceptable', 'Si la douleur redescend d’ici le lendemain matin et n’augmente pas d’une semaine à l’autre.'], [6, 10, 'crit', 'Trop', 'On modifie ou on arrête ce qui la provoque.']];
const painCls = v => PAIN.find(p => v >= p[0] && v <= p[1])[2];
// paliers de la forme du matin, avec leurs bornes (le score va de 5 à 25)
function bandRanges() {
  const b = bands();
  return b.map((x, i) => ({ lo: Math.max(5, x[0]), hi: i === 0 ? 25 : b[i - 1][0] - 1, lbl: x[1], cls: x[2], txt: x[3] }));
}

const TILES = [
  { id: 'rpe', t: 'Ressenti de séance', s: '0 à 10', viz: () => <span class="rep-viz">{RPE.map((_, i) => <i class={ZONES[zoneOf(i)][1]} />)}</span> },
  { id: 'well', t: 'Forme du matin', s: 'sur 25', viz: () => <span class="rep-viz">{bandRanges().slice().reverse().map(r => <i style={'flex:' + (r.hi - r.lo + 1) + ';background:' + col(r.cls)} />)}</span> },
  { id: 'pain', t: 'Douleur', s: '0 à 10', viz: () => <span class="rep-viz">{Array.from({ length: 11 }, (_, v) => <i style={'background:' + col(painCls(v))} />)}</span> },
  { id: 'siv', t: 'Notation escalade', s: 'spécificité · intensité · volume', viz: () => <span class="rep-bars">{[0.7, 0.9, 0.5].map(w => <i style={'width:' + w * 100 + '%'} />)}</span> },
  { id: 'lex', t: 'Lexique', s: GLOSS.length + ' termes expliqués', viz: () => <span class="rep-words">RIR · VMA · D′ · BFR</span> },
  { id: 'src', t: 'Sources', s: Object.keys(SOURCES).length + ' références', viz: () => <span class="rep-words">Études et consensus</span> }
];

export function ReperesCard() {
  const [open, setOpen] = useState(null);
  const T = TILES.find(x => x.id === open);
  return <section class="card">
    <h3 class="h3" style="margin-bottom:4px">Repères</h3>
    <p class="small" style="margin:0 0 12px">Les échelles utilisées dans l’appli, les mots techniques et d’où viennent les chiffres.</p>
    <div class="rep-grid">{TILES.map(x => <button type="button" class="rep-t" onClick={() => setOpen(x.id)}><b>{x.t}</b><small>{x.s}</small>{x.viz()}</button>)}</div>
    {T && <Sheet title={T.t} onClose={() => setOpen(null)}>{BODY[T.id]()}</Sheet>}
  </section>;
}

const BODY = {
  rpe: () => <div class="stack" style="gap:14px">
    <p class="small" style="margin:0">Noté environ 30 min après, pour toute la séance. <Gloss text="Charge = ressenti × durée en minutes (UA)." /></p>
    {ZONES.map(([l, z, r], zi) => <div>
      <p class="sub-lbl" style="margin:0 0 6px">{l} <small>{r}</small></p>
      <div class="sc-list">{RPE.map((lbl, i) => zoneOf(i) !== zi ? null : <div class="sc-row"><span class="sc-n" style={'--c:var(--' + z + ')'}>{i}</span><span>{lbl}</span></div>)}</div>
    </div>)}
    <Src ids={['foster2001']} />
  </div>,
  well: () => { const rs = bandRanges(); return <div class="stack" style="gap:14px">
    <p class="small" style="margin:0">{WELL.map(w => w[1]).join(', ')} : chacun de 1 à 5, chaque matin. L’écart à ta propre moyenne compte plus que le chiffre seul.</p>
    <div class="sc-band">{rs.slice().reverse().map(r => <span style={'flex:' + (r.hi - r.lo + 1)}><i style={'background:' + col(r.cls)} /><small>{r.lo}–{r.hi}</small></span>)}</div>
    <div class="sc-list">{rs.map(r => <div class="sc-row top"><span class="sc-n wide" style={'--c:' + col(r.cls)}>{r.lo}–{r.hi}</span><span><b>{r.lbl}</b><small>{r.txt}</small></span></div>)}</div>
    <Src ids={['mclean2010', 'saw2016']} />
  </div>; },
  pain: () => <div class="stack" style="gap:14px">
    <p class="small" style="margin:0">Pendant l’effort et le lendemain matin, de 0 (rien) à 10 (insupportable).</p>
    <div class="sc-band">{Array.from({ length: 11 }, (_, v) => <span style="flex:1"><i style={'background:' + col(painCls(v))} /><small>{v}</small></span>)}</div>
    <div class="sc-list">{PAIN.map(([a, b, c, l, d]) => <div class="sc-row top"><span class="sc-n wide" style={'--c:' + col(c)}>{a}–{b}</span><span><b>{l}</b><small>{d}</small></span></div>)}</div>
    <Src ids={['silbernagel2007']} />
  </div>,
  siv: () => <div class="stack" style="gap:14px">
    <p class="small" style="margin:0">Pour les séances d’escalade, chacun sur 10. Charge de séance = intensité + volume.</p>
    <div class="sc-list">{SIV.map(([k, l, q]) => <div class="sc-row top"><span class="sc-n" style="--c:var(--k-grimpe)">{k.toUpperCase()}</span><span><b>{l}</b><small>{q.charAt(0).toUpperCase() + q.slice(1)}</small></span></div>)}</div>
    <p class="small" style="margin:0">Méthode de Marie Akrich ; l’étalonnage sur 10 est propre à l’appli. Pour la muscu, le renfo et la kiné, on note les exercices réalisés (séries × répétitions × charge), la douleur en kiné ; pour le cardio, la distance et la fréquence cardiaque. Le ressenti × la durée reste la charge commune à toutes les activités.</p>
  </div>,
  lex: () => <><p class="small" style="margin:0 0 12px">Les mêmes explications s’ouvrent d’un appui sur les mots soulignés en pointillés, partout dans l’appli.</p><Lexicon /></>,
  src: () => <div class="stack" style="gap:12px">{Object.values(SOURCES).slice().sort((a, b) => a.s.localeCompare(b.s, 'fr')).map(s => <div class="lex"><b>{s.s}</b><p>{s.n}</p><p class="small" style="margin:4px 0 0">{s.r}</p></div>)}</div>
};
