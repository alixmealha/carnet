// « Pas possible maintenant ? » : faire un bloc à un autre moment de la journée, un autre jour, ou pas du tout (avec la raison)
import { useState } from 'preact/hooks';
import { jget, planLocked, links, isSelf } from '../lib/store.js';
import { SKIP, skipLabel, blockState, setBlockState, moveBlock, unmoveBlock, day, sessionName, apartOf, moveTargets } from '../lib/plan.js';
import { heavyOf, groupsTxt } from '../lib/builder.js';
import { addDays, todayKey, fmtShort } from '../lib/dates.js';
import { Sheet, toast } from './kit.jsx';

const plain = s => String(s || '').replace(/\[[a-z]+\]\s*/g, '').trim();
// Alerte 48 h : le bloc sollicite-t-il en lourd les mêmes groupes que ce jour-là, la veille ou le lendemain ?
export function moveWarn(k, b, to) {
  const mine = heavyOf({ blocks: [b] }); if (!mine.size) return null;
  const hv = d => { const dd = day(d); return heavyOf(dd && d === k ? { blocks: dd.blocks.filter(x => x.id !== b.id) } : dd); };
  const out = [];
  const same = [...mine].filter(g => hv(to).has(g)); if (same.length) out.push(groupsTxt(same) + ' déjà en lourd ce jour-là');
  for (const [o, w] of [[-1, 'la veille'], [1, 'le lendemain']]) { const g = [...mine].filter(x => hv(addDays(to, o)).has(x)); if (g.length) out.push(groupsTxt(g) + ' en lourd ' + w); }
  return out.length ? out.join(' · ') : null;
}

export function BlockMenu({ k, b, onClose, top }) {
  const e = jget(k), st = blockState(e, b), locked = planLocked(), today = todayKey(), name = plain(b.title);
  const [mode, setMode] = useState(null);
  const days = moveTargets(k);
  const done = msg => { toast(msg); onClose(); };
  const apart = apartOf(e, b.id);
  return (
    <Sheet title={name} onClose={onClose} cls={top ? 'top' : ''}>
      <div class="stack" style="gap:10px">
        {st && <div class="bm-now">
          <p style="margin:0">{st === 'apart' ? (apart && apart.endedAt ? 'Fait à part.' : 'À faire à part, à un autre moment de la journée.') : st === 'moved' ? 'Déplacé au ' + fmtShort(e.moved[b.id].to).toLowerCase() + '.' : 'Pas fait · ' + (skipLabel(e.skip[b.id])).toLowerCase() + '.'}</p>
          {!(st === 'apart' && apart && apart.endedAt) && <button class="btn" onClick={() => { if (st === 'moved') unmoveBlock(k, b); else setBlockState(k, b, null); done('Remis dans la séance'); }}>Remettre dans la séance</button>}
        </div>}
        {st !== 'apart' && <button type="button" class="bm-opt" onClick={() => { setBlockState(k, b, 'apart'); done(name + ' : à faire à part'); }}>
          <b>{k === today ? 'À un autre moment de la journée' : 'À part ce jour-là'}</b>
          <span>Avant ou après la séance, par exemple le matin pour grimper l’après-midi. Il aura sa propre durée et son ressenti.</span>
        </button>}
        {st !== 'moved' && <>
          <button type="button" class={'bm-opt' + (mode === 'day' ? ' on' : '')} aria-expanded={mode === 'day' ? 'true' : 'false'} onClick={() => setMode(mode === 'day' ? null : 'day')}>
            <b>Un autre jour</b><span>{locked ? 'Ton plan est verrouillé par ton coach : demande-lui, ou fais-le à part aujourd’hui.' : 'Le bloc est ajouté au plan du jour choisi.'}</span>
          </button>
          {mode === 'day' && !locked && <div class="bm-days">{days.map(d => { const w = moveWarn(k, b, d); return (
            <button type="button" onClick={() => { moveBlock(k, b, d); done(name + ' déplacé au ' + fmtShort(d).toLowerCase()); }}>
              <b>{d === today ? 'Aujourd’hui' : fmtShort(d)}</b><span>{sessionName(d)}</span>{w && <em>{w}</em>}
            </button>); })}</div>}
        </>}
        {st !== 'skip' && <>
          <button type="button" class={'bm-opt' + (mode === 'skip' ? ' on' : '')} aria-expanded={mode === 'skip' ? 'true' : 'false'} onClick={() => setMode(mode === 'skip' ? null : 'skip')}>
            <b>Je ne le fais pas</b><span>La raison est gardée dans le journal{isSelf() && links.coaches && links.coaches.length ? ' et ton coach la voit' : ''}.</span>
          </button>
          {mode === 'skip' && <div class="chips">{SKIP.map(([v, l]) => <button type="button" class="chip" onClick={() => { setBlockState(k, b, 'skip', v); done(name + ' : pas fait'); }}>{l}</button>)}</div>}
        </>}
      </div>
    </Sheet>
  );
}
