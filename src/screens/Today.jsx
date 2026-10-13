import { useState } from 'preact/hooks';
import { jget } from '../lib/store.js';
import { blocks, weekOf, weekLabel, meta, progress, PHASE_LABEL, nextEvent, eventOn } from '../lib/plan.js';
import { score, verdict } from '../lib/rules.js';
import { todayKey, mondayOf, addDays, DOW_1, dom, fmtRange, diffDays } from '../lib/dates.js';
import { Icon } from '../ui/kit.jsx';
import { DayView } from './DayView.jsx';

export function tapesOf(k) {
  const ks = []; for (const b of blocks(k)) if (b.kind !== 'rest' && !ks.includes(b.kind)) ks.push(b.kind); return ks;
}

export function WeekStrip({ sel, onSel }) {
  const mon = mondayOf(sel), t = todayKey(), w = weekOf(sel);
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  return (
    <div>
      <div class="wk-nav">
        <button class="icon-btn" aria-label="Semaine précédente" onClick={() => onSel(addDays(sel, -7))}><Icon name="left" /></button>
        <div class="lbl">{w ? <><b>{weekLabel(w)}</b> · {PHASE_LABEL[w.phase] || w.bloc} · </> : null}{fmtRange(days[0], days[6])}</div>
        <button class="icon-btn" aria-label="Semaine suivante" onClick={() => onSel(addDays(sel, 7))}><Icon name="right" /></button>
      </div>
      <div class="strip">{days.map((k, i) => {
        const e = jget(k), sc = score(e), st = e.status, pr = progress(k);
        const mark = st === 'faite' ? '✓' : st === 'adaptee' ? '~' : st === 'sautee' ? '×' : pr.done ? '·' : '';
        return (
          <button type="button" class={'sd' + (k === t ? ' today' : '') + (eventOn(k) ? ' evd' : '')} aria-pressed={k === sel ? 'true' : 'false'} aria-label={k} onClick={() => onSel(k)}>
            <span class="w">{DOW_1[i]}</span>
            <span class="d">{dom(k)}</span>
            <span class="tp">{tapesOf(k).slice(0, 3).map(kd => <i style={'background:var(--k-' + kd + ')'} />)}</span>
            <span class="st" style={sc !== null ? '' : ''}>{mark || (sc !== null ? <span style={'color:' + (verdict(sc).cls === 'good' ? 'var(--good)' : verdict(sc).cls === 'warn' ? 'var(--warn)' : verdict(sc).cls === 'crit' ? 'var(--crit)' : 'var(--muted)')}>{sc}</span> : '')}</span>
          </button>
        );
      })}</div>
    </div>
  );
}

export function Today({ onStart, onEdit, onOpenTest }) {
  const [sel, setSel] = useState(todayKey());
  const m = meta(), goal = nextEvent(), left = goal ? diffDays(todayKey(), goal.date) : null;
  return (
    <div class="screen">
      <div class="head">
        <div><div class="eyebrow">{m ? m.title : 'Alipto'}</div><h1 class="title">Aujourd’hui</h1></div>
        {left !== null && left > 0 && <div class="count" aria-label={'J moins ' + left + ' avant ' + goal.label}><b>J−{left}</b><span>avant<br />{goal.label}</span></div>}
        {left !== null && left <= 0 && <div class="count"><b style="font-size:24px">Jour J</b><span>{goal.label}</span></div>}
      </div>
      <div class="stack">
        <WeekStrip sel={sel} onSel={setSel} />
        {sel !== todayKey() && <button class="btn ghost" style="align-self:center" onClick={() => setSel(todayKey())}>Revenir à aujourd’hui</button>}
        <DayView k={sel} onStart={onStart} onEdit={onEdit} onOpenTest={onOpenTest} />
      </div>
    </div>
  );
}
