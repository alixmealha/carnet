// Bilan de la semaine (lundi → dimanche) : séances faites, annulées et pourquoi, charge, forme, sommeil, records,
// et ce qui arrive la semaine suivante. Affiché le dimanche soir et le lundi sur l'accueil (athlète et coach).
import { jget } from './store.js';
import { rawBlocks, blockState, weekOf, PHASE_LABEL, sessionName, skipLabel, eventOn, progress } from './plan.js';
import { dayLoad } from './insights.js';
import { score, nightTotal, verdict } from './rules.js';
import { allRecords } from './records.js';
import { addDays, mondayOf, todayKey, rangeKeys } from './dates.js';

const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
// Semaine à montrer : celle qui se termine aujourd'hui (dimanche à partir de 17 h) ou hier (lundi)
export function reviewWeek(now) {
  const d = now || new Date(), t = todayKey(), dw = (d.getDay() + 6) % 7; // 0 = lundi
  if (dw === 6 && d.getHours() >= 17) return mondayOf(t);
  if (dw === 0) return mondayOf(addDays(t, -1));
  return null;
}
export function weekReview(mon) {
  const days = rangeKeys(mon, addDays(mon, 6));
  let planned = 0, done = 0; const missed = [];
  for (const k of days) {
    const e = jget(k), real = rawBlocks(k).filter(b => b.kind !== 'rest' && blockState(e, b) !== 'moved');
    if (!real.length) continue;
    planned++;
    // faite : statut noté, ou des exercices cochés sans statut
    if (e.status === 'faite' || e.status === 'adaptee' || (!e.status && progress(k).done > 0)) done++;
    else if (e.cancel || e.status === 'sautee') missed.push({ k, why: e.cancel ? skipLabel(e.cancel.r) : 'sautée', note: e.cancel && e.cancel.note });
    else if (k < todayKey()) missed.push({ k, why: 'rien de noté' });
  }
  const load = days.reduce((a, k) => a + dayLoad(k), 0), prev = rangeKeys(addDays(mon, -7), addDays(mon, -1)).reduce((a, k) => a + dayLoad(k), 0);
  const sc = days.map(k => score(jget(k))).filter(x => x !== null), nights = days.map(k => nightTotal(jget(k))).filter(x => x !== null);
  const recs = allRecords().list.filter(x => x.k >= mon && x.k <= addDays(mon, 6));
  // semaine suivante
  const nmon = addDays(mon, 7), nw = weekOf(nmon);
  const next = rangeKeys(nmon, addDays(nmon, 6)).map(k => ({ k, name: rawBlocks(k).some(b => b.kind !== 'rest') ? sessionName(k) : null, ev: eventOn(k) })).filter(x => x.name || x.ev);
  const f = mean(sc);
  return {
    mon, planned, done, missed,
    load: Math.round(load), loadCh: prev > 0 && load > 0 ? Math.round((load / prev - 1) * 100) : null,
    form: f !== null ? Math.round(f * 10) / 10 : null, formCls: f !== null ? verdict(Math.round(f)).cls : null, formN: sc.length,
    sleep: nights.length ? Math.round(mean(nights)) : null,
    recs, next, nextPhase: nw ? PHASE_LABEL[nw.phase] || nw.bloc : null, nextLight: nw ? nw.phase === 'deload' : false
  };
}
