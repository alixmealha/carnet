import { useEffect } from 'preact/hooks';
import { jget } from '../lib/store.js';
import { meta, weekKeys, weekLabel, PHASE_LABEL, progress, eventOn } from '../lib/plan.js';
import { score, verdict, verdictColor } from '../lib/rules.js';
import { todayKey, dow, dom, MON_S, DOW_1, fmtDay } from '../lib/dates.js';
import { tapesOf } from './Today.jsx';
import { KIND, KIND_ORDER } from '../lib/plan.js';
import { ids, get } from '../lib/store.js';

function legendKinds(m) {
  const seen = new Set();
  for (const id of ids('p:')) { const d = get(id); for (const b of (d && d.blocks) || []) if (b.kind !== 'rest') seen.add(b.kind); }
  return KIND_ORDER.filter(k => seen.has(k));
}

export function Calendar({ onOpen, seg }) {
  // à l'ouverture, on se place sur la semaine en cours plutôt qu'au début du plan
  useEffect(() => { const el = document.querySelector('.cal .cd.today'); if (el && el.getBoundingClientRect().top > window.innerHeight * 0.6) window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - 220)); }, []);
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
      <div class="head"><div><div class="eyebrow">{m.title} · {weekLabel(m.weeks[0])} à {weekLabel(m.weeks[m.weeks.length - 1])}</div><h1 class="title">Calendrier</h1></div></div>
      {seg}
      <div class="card">
        <div class="cal">
          <div />{DOW_1.map(d => <div class="dow">{d}</div>)}
          {groups.map((g, gi) => {
            const a = g.weeks[0], z = g.weeks[g.weeks.length - 1];
            const rest = ['deload', 'transition', 'recup', 'coupure'].includes(g.phase);
            return [
              <div class={'bloc' + (gi === 0 ? ' first' : '') + (rest ? ' dim' : '')}><b>{PHASE_LABEL[g.phase] || g.bloc}</b><span>{weekLabel(a)}{a.id !== z.id ? '–' + weekLabel(z) : ''} · {fmtDay(a.start)} → {fmtDay(z.end)}</span></div>,
              ...g.weeks.map(w => {
                const ks = weekKeys(w), pad = dow(ks[0]);
                return [
                  <div class="wl">{weekLabel(w)}</div>,
                  ...Array.from({ length: pad }, () => <div class="cd void" aria-hidden="true" />),
                  ...ks.map(k => {
                    const e = jget(k), sc = score(e), st = e.status, logged = st || sc !== null;
                    return (
                      <button type="button" class={'cd' + (k === t ? ' today' : '') + (k < t ? ' past' : '') + (logged ? ' logged' : '') + (eventOn(k) ? ' evd' : '')} onClick={() => onOpen(k)} aria-label={k}>
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
          {legendKinds(m).map(kd => <span><i style={'background:var(--k-' + kd + ')'} />{KIND[kd]}</span>)}
          {(m.events || []).length > 0 && <span><i style="background:var(--k-compet);border-radius:50%" />Compétition</span>}
          <span>Chiffre = forme /25</span><span>✓ faite · ~ adaptée · × sautée</span>
        </div>
      </div>
    </div>
  );
}
