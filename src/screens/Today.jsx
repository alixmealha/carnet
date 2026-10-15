import { useState } from 'preact/hooks';
import { jget, isSelf, nameOf, getSubject } from '../lib/store.js';
import { blocks, weekOf, weekLabel, meta, progress, PHASE_LABEL, nextEvent, eventOn, sessionName, day, blockState, apartOf, skipLabel } from '../lib/plan.js';
import { score, verdict } from '../lib/rules.js';
import { dayInsights } from '../lib/insights.js';
import { todayKey, mondayOf, addDays, DOW_1, dom, fmtRange, diffDays, fmtLong } from '../lib/dates.js';
import { Icon, Rich, useWide } from '../ui/kit.jsx';
import { DayView } from './DayView.jsx';
import { SessionMenu } from '../ui/SessionMenu.jsx';
import { WeekReview } from '../ui/WeekReview.jsx';
import { adjSummary } from '../lib/adapt.js';

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

// Anneau de forme (sur 25), coloré selon le verdict : la lecture d'un coup d'œil
export function Ring({ value, max = 25, cls, size = 84 }) {
  const r = 34, c = 2 * Math.PI * r, f = value == null ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <svg class={'ring ' + (cls || 'none')} width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
      <circle cx="40" cy="40" r={r} class="ring-bg" />
      {value != null && <circle cx="40" cy="40" r={r} class="ring-fg" stroke-dasharray={c} stroke-dashoffset={c * (1 - f)} transform="rotate(-90 40 40)" />}
    </svg>
  );
}

function weekCount(k) {
  const mon = mondayOf(k); let planned = 0, done = 0; const days = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i), act = blocks(d).some(b => b.kind !== 'rest'), st = jget(d).status;
    const ok = st === 'faite' || st === 'adaptee';
    if (act) planned++; if (act && ok) done++;
    days.push(act ? (ok ? 'ok' : st === 'sautee' ? 'ko' : d < todayKey() ? 'miss' : 'todo') : 'off');
  }
  return { planned, done, days };
}
const scrollToId = id => { const el = document.getElementById(id); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' }); };

// Le résumé du jour : forme, séance, consigne et semaine, avant les détails
function Hero({ k, onStart }) {
  const e = jget(k), sc = score(e), v = sc !== null ? verdict(sc) : null, self = isSelf();
  const active = !e.cancel && blocks(k).some(b => b.kind !== 'rest' && !['apart', 'moved', 'skip'].includes(blockState(e, b))), d = day(k) || {}, pr = progress(k);
  const real = blocks(k).filter(b => b.kind !== 'rest'), hasSes = real.length > 0, allMoved = hasSes && real.every(b => blockState(e, b) === 'moved');
  const adj = adjSummary(k), [menu, setMenu] = useState(false);
  const aparts = blocks(k).filter(b => blockState(e, b) === 'apart' && !apartOf(e, b.id).endedAt);
  const r = sc !== null ? dayInsights(k) : null, wk = weekCount(k);
  const meta2 = e.cancel ? skipLabel(e.cancel.r) + (e.cancel.note ? ' · « ' + e.cancel.note + ' »' : '')
    : [d.duree && d.duree !== '—' ? d.duree : null, adj ? (adj.mode === 'time' ? 'adaptée à ' + jget(k).adj.min + ' min' : 'allégée') : null, pr.total ? pr.done + '/' + pr.total + ' fait' : null].filter(Boolean).join(' · ');
  return (
    <section class={'card hero' + (r ? ' ' + r.level : '')}>
      <div class="hero-top">
        <button type="button" class="ring-b" onClick={() => scrollToId('morning')} aria-label={sc !== null ? 'Forme ' + sc + ' sur 25, ' + v.lbl : 'Forme du matin à remplir'}>
          <Ring value={sc} cls={v ? v.cls : null} />
          <span class="ring-c">{sc !== null ? <><b>{sc}</b><small>/25</small></> : <><b>?</b><small>forme</small></>}</span>
        </button>
        <div class="hero-txt">
          <div class="eyebrow">{e.cancel ? (e.cancel.started ? 'Séance arrêtée' : 'Séance annulée') : active ? 'Séance du jour' : 'Aujourd’hui'}</div>
          <b class="hero-t"><Rich text={allMoved ? 'Séance déplacée' : hasSes ? sessionName(k) : 'Repos'} /></b>
          {meta2 && <span class="hero-m">{meta2}</span>}
        </div>
        {self && onStart && hasSes && !allMoved && <button type="button" class="ses-m hero-mb" aria-label="Options de la séance" onClick={() => setMenu(true)}>•••</button>}
      </div>
      {r ? <button type="button" class="hero-r" onClick={() => scrollToId('reading')}><i />{r.head}<span class="chev r" aria-hidden="true" /></button>
        : self ? <button type="button" class="hero-r todo" onClick={() => scrollToId('morning')}><i />{active ? 'Remplis ta forme du matin : la séance s’ajuste' : 'Note ta forme du matin : elle compte aussi les jours sans séance'}<span class="chev r" aria-hidden="true" /></button>
        : <p class="hero-r todo"><i />{nameOf(getSubject())} n’a pas encore rempli sa forme du matin</p>}
      {active && self && onStart && <button class="btn big primary" onClick={() => onStart(k)}><Icon name="play" size={20} />{e.startedAt && !e.endedAt ? 'Reprendre la séance' : pr.done ? 'Continuer la séance' : 'Démarrer la séance'}</button>}
      {self && onStart && aparts.map(b => <div class="hero-ap"><span>À part aujourd’hui · <b><Rich text={b.title} /></b></span><button class="btn" onClick={() => onStart(k, b.id)}>{apartOf(e, b.id).startedAt ? 'Reprendre' : 'Lancer'}</button></div>)}
      {menu && <SessionMenu k={k} onClose={() => setMenu(false)} />}
      {wk.planned > 0 && <div class="hero-wk" aria-label={'Semaine : ' + wk.done + ' séances faites sur ' + wk.planned}>
        <span>Cette semaine</span>
        <span class="wk-d">{wk.days.map((x, i) => <i class={x} title={DOW_1[i]} />)}</span>
        <b>{wk.done}/{wk.planned}</b>
      </div>}
    </section>
  );
}

export function Today({ onStart, onEdit, onOpenTest }) {
  const t = todayKey();
  const [sel, setSel] = useState(t);
  const m = meta(), goal = nextEvent(), left = goal ? diffDays(t, goal.date) : null, isToday = sel === t, wide = useWide();
  return (
    <div class="screen">
      <div class="head">
        <div style="flex:none"><div class="eyebrow">{fmtLong(t)}</div><h1 class="title">Aujourd’hui</h1></div>
        {left !== null && left > 0 && <div class="count" aria-label={'J moins ' + left + ' avant ' + goal.label}><b>J−{left}</b><span>avant<br />{goal.label}</span></div>}
        {left !== null && left <= 0 && <div class="count"><b style="font-size:24px">Jour J</b><span>{goal.label}</span></div>}
      </div>
      <div class="stack">
        <WeekStrip sel={sel} onSel={setSel} />
        {!isToday && <button class="btn ghost" style="align-self:center" onClick={() => setSel(t)}>Revenir à aujourd’hui</button>}
        {isToday && m && <WeekReview />}
        <DayView k={sel} onStart={onStart} onEdit={onEdit} onOpenTest={onOpenTest} noHeader={isToday} split={wide} hero={isToday && m ? <Hero k={sel} onStart={onStart} /> : null} />
      </div>
    </div>
  );
}
