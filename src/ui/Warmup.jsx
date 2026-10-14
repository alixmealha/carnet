// Échauffement conseillé (RAMP) affiché à l'étape d'échauffement de la séance et dans la fiche du jour
import { useState } from 'preact/hooks';
import { warmupFor, PH_LBL } from '../lib/warmup.js';
import { Src } from './kit.jsx';
import { Gloss } from './Gloss.jsx';

export function Warmup({ k, b, fold, onTimer }) {
  const w = warmupFor(k, b), [on, setOn] = useState({}), [open, setOpen] = useState(!fold);
  if (!w) return null;
  const head = <span class="wu-h"><b>Échauffement conseillé</b><small>≈ {w.min} min · méthode RAMP</small></span>;
  if (fold && !open) return <button type="button" class="wu-open" onClick={() => setOpen(true)}>{head}<span class="chev" aria-hidden="true" /></button>;
  let lastPh = null;
  return <div class="wu">
    {head}
    <ol class="wu-l">{w.steps.map((x, i) => { const ph = x.ph !== lastPh ? PH_LBL[x.ph] : null; lastPh = x.ph; return <>
      {ph && <li class="wu-ph" aria-hidden="true">{ph}</li>}
      <li class={'wu-s' + (on[i] ? ' on' : '')}><button type="button" class="ck" aria-pressed={on[i] ? 'true' : 'false'} aria-label={x.t + (on[i] ? ' : fait' : ' : à faire')} onClick={() => setOn(Object.assign({}, on, { [i]: !on[i] }))}>✓</button><span><b>{x.t}</b><span><Gloss text={x.d} /></span>{x.timer && onTimer && <button type="button" class="btn wu-tm" onClick={() => onTimer(x.timer)}>Lancer le minuteur {x.timer.work}/{x.timer.rest}</button>}</span></li>
    </>; })}</ol>
    <p class="small" style="margin:6px 0 0"><Gloss text={w.why} /> <Src ids={['jeffreys2007', 'mcgowan2015'].concat(w.steps.some(x => x.src) ? ['remilieux'] : [])} /></p>
  </div>;
}
