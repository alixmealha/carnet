// Bilan de la semaine sur l'accueil : le dimanche soir et le lundi. Masquable ; le coach le voit pour chaque athlète.
import { useState } from 'preact/hooks';
import { isSelf, nameOf, getSubject } from '../lib/store.js';
import { weekOf, weekLabel } from '../lib/plan.js';
import { reviewWeek, weekReview } from '../lib/week.js';
import { durLong, verdictColor } from '../lib/rules.js';
import { fmtShort, DOW_3, dow, fmtNum } from '../lib/dates.js';
import { Icon } from './kit.jsx';

const seenKey = mon => 'alipto-week-seen:' + getSubject() + ':' + mon;
export function WeekReview({ force }) {
  const mon = force || reviewWeek();
  const [hidden, setHidden] = useState(() => { try { return !!mon && localStorage.getItem(seenKey(mon)) === '1'; } catch (_) { return false; } });
  if (!mon || hidden) return null;
  const r = weekReview(mon), w = weekOf(mon), self = isSelf();
  if (!r.planned && !r.formN) return null;
  const hide = () => { try { localStorage.setItem(seenKey(mon), '1'); } catch (_) {} setHidden(true); };
  return (
    <section class="card wkr" aria-label="Bilan de la semaine">
      <div class="wkr-h">
        <div style="min-width:0"><div class="eyebrow">{self ? 'Ta semaine' : 'Semaine de ' + nameOf(getSubject())}{w ? ' · ' + weekLabel(w) : ''}</div>
          <h3 class="wkr-t">{r.planned ? r.done + ' séance' + (r.done > 1 ? 's' : '') + ' sur ' + r.planned : 'Semaine sans séance prévue'}</h3></div>
        <button class="icon-btn" aria-label="Masquer le bilan de la semaine" onClick={hide}><Icon name="close" /></button>
      </div>
      {(r.load > 0 || r.form !== null || r.sleep !== null) && <div class="wkr-g">
        {r.load > 0 && <div><small>Charge</small><b>{r.load.toLocaleString('fr-FR') + ' UA'}</b>{r.loadCh !== null && <span>{(r.loadCh >= 0 ? '+' : '') + r.loadCh} % vs la semaine d’avant</span>}</div>}
        {r.form !== null && <div><small>Forme moyenne</small><b style={r.formCls ? 'color:' + verdictColor(r.formCls) : ''}>{fmtNum(r.form) + '/25'}</b><span>{r.formN} matin{r.formN > 1 ? 's' : ''} noté{r.formN > 1 ? 's' : ''}</span></div>}
        {r.sleep !== null && <div><small>Sommeil moyen</small><b>{durLong(r.sleep)}</b></div>}
      </div>}
      {r.missed.length > 0 && <p class="wkr-m">Pas faites : {r.missed.map(x => fmtShort(x.k).toLowerCase() + ' (' + x.why.toLowerCase() + (x.note ? ' · « ' + x.note + ' »' : '') + ')').join(', ')}</p>}
      {r.recs.length > 0 && <div class="recs" style="margin:10px 0 0">{r.recs.map(x => <div class="rec-i"><b>{x.txt}</b><span>{fmtShort(x.k)} · avant : {x.prev}</span></div>)}</div>}
      {r.next.length > 0 && <div class="wkr-n">
        <p class="sub-lbl" style="margin:0 0 6px">Semaine prochaine{r.nextPhase ? ' · ' + r.nextPhase.toLowerCase() : ''}{r.nextLight ? ' : on récupère' : ''}</p>
        <div class="wkr-days">{r.next.map(x => <span><b>{DOW_3[dow(x.k)]}</b>{x.ev ? x.ev.label : x.name}</span>)}</div>
      </div>}
    </section>
  );
}
