import { jget } from '../lib/store.js';
import { meta, weekKeys, PHASE_LABEL, progress } from '../lib/plan.js';
import { score, verdict, verdictColor } from '../lib/rules.js';
import { todayKey, dow, dom, MON_S, DOW_1, fmtDay } from '../lib/dates.js';
import { tapesOf } from './Today.jsx';

export function Calendar({ onOpen }) {
  const m = meta(); if (!m) return null;
  const t = todayKey();
  const groups = [];
  for (const w of m.weeks) {
    const g = groups[groups.length - 1];
    if (g && g.phase === w.phase && g.bloc === w.bloc) g.weeks.push(w);
    else groups.push({ phase: w.phase, bloc: w.bloc, weeks: [w] });
  }
  return (
    <div class="screen">
      <div class="head"><div><div class="eyebrow">{m.title} · S{m.weeks[0].n} à S{m.weeks[m.weeks.length - 1].n}</div><h1 class="title">Calendrier</h1></div></div>
      <div class="card">
        <div class="cal">
          <div />{DOW_1.map(d => <div class="dow">{d}</div>)}
          {groups.map((g, gi) => {
            const a = g.weeks[0], z = g.weeks[g.weeks.length - 1];
            const rest = g.phase === 'deload' || g.phase === 'transition';
            return [
              <div class={'bloc' + (gi === 0 ? ' first' : '') + (rest ? ' dim' : '')}><b>{PHASE_LABEL[g.phase] || g.bloc}</b><span>S{a.n}{a.n !== z.n ? '–S' + z.n : ''} · {fmtDay(a.start)} → {fmtDay(z.end)}</span></div>,
              ...g.weeks.map(w => {
                const ks = weekKeys(w), pad = dow(ks[0]);
                return [
                  <div class="wl">S{w.n}</div>,
                  ...Array.from({ length: pad }, () => <div class="cd void" aria-hidden="true" />),
                  ...ks.map(k => {
                    const e = jget(k), sc = score(e), st = e.status, logged = st || sc !== null;
                    return (
                      <button type="button" class={'cd' + (k === t ? ' today' : '') + (k < t ? ' past' : '') + (logged ? ' logged' : '')} onClick={() => onOpen(k)} aria-label={k}>
                        <span class="n">{dom(k)}{(dom(k) === 1 || k === m.start) && <small> {MON_S[+k.slice(5, 7) - 1].replace('.', '')}</small>}</span>
                        <span class="tp">{tapesOf(k).map(kd => <i style={'background:var(--k-' + kd + ')'} />)}</span>
                        <span class="ft"><span style={sc !== null ? 'color:' + verdictColor(verdict(sc).cls) : ''}>{sc !== null ? sc : ''}</span><span class="ok">{st === 'faite' ? '✓' : st === 'adaptee' ? '~' : st === 'sautee' ? '×' : ''}</span></span>
                      </button>
                    );
                  })
                ];
              })
            ];
          })}
        </div>
        <div class="leg" style="margin-top:14px;padding-top:10px;border-top:1px solid var(--rule)">
          {['grimpe', 'doigts', 'muscu', 'kine', 'epaule', 'velo', 'test'].map(kd => <span><i style={'background:var(--k-' + kd + ')'} />{{ grimpe: 'Escalade', doigts: 'Finger lift', muscu: 'Muscu', kine: 'Kiné', epaule: 'Épaule', velo: 'Vélo', test: 'Test' }[kd]}</span>)}
          <span>Chiffre = forme /25</span><span>✓ faite · ~ adaptée · × sautée</span>
        </div>
      </div>
    </div>
  );
}
