import { useEffect, useState } from 'preact/hooks';
import { links, getFor, metaFor, idsFor, putFor, SELF, nameOf } from '../lib/store.js';
import { score, verdict, verdictColor, FLAGS, STATUS, nightTotal, durShort } from '../lib/rules.js';
import { KIND } from '../lib/plan.js';
import { pushState } from '../lib/push.js';
import { todayKey, addDays, fmtShort, rangeKeys } from '../lib/dates.js';
import { Icon } from '../ui/kit.jsx';
import { AddAthlete } from './Settings.jsx';

const FL = Object.fromEntries(FLAGS), ST = Object.fromEntries(STATUS);
export const seenMap = () => getFor(SELF, 'seen') || {};
export function markSeen(uid) { putFor(SELF, 'seen', Object.assign({}, seenMap(), { [uid]: Date.now() })); }

function dayName(uid, k) {
  const d = getFor(uid, 'p:' + k);
  if (!d) return 'Repos';
  if (d.short) return d.short;
  const ks = []; for (const b of d.blocks || []) if (b.kind !== 'rest' && !ks.includes(KIND[b.kind])) ks.push(KIND[b.kind]);
  return ks.length ? ks.join(', ') : 'Repos';
}

// Fil d'activité : séances validées et messages des athlètes (14 derniers jours)
export function activity(uid) {
  const out = [], from = addDays(todayKey(), -14);
  for (const id of idsFor(uid, 'j:')) {
    const k = id.slice(2); if (k < from) continue;
    const e = getFor(uid, id), m = metaFor(uid, id);
    // un jour rempli plus de 3 jours après coup (import, rattrapage) ne compte pas comme nouveauté
    if (m.updatedAt - Date.parse(k + 'T23:59:59') > 3 * 864e5) continue;
    if (e && (e.status || typeof e.rpe === 'number' || e.note)) out.push({ uid, k, kind: 'session', at: m.updatedAt, e });
  }
  // séances ou plan modifiés par l'athlète lui-même
  const since = Date.now() - 14 * 864e5;
  for (const id of idsFor(uid, 'p:')) {
    const d = getFor(uid, id), ed = d && d.edited;
    if (ed && ed.uid === uid && ed.at > since) out.push({ uid, k: id.slice(2), kind: 'edit', at: ed.at });
  }
  const pl = getFor(uid, 'plan');
  if (pl && pl.edited && pl.edited.uid === uid && pl.edited.at > since) out.push({ uid, k: null, kind: 'planedit', at: pl.edited.at });
  for (const id of idsFor(uid, 'c:')) {
    const k = id.slice(2); if (k < from) continue;
    const c = getFor(uid, id), msgs = (c && c.msgs) || [], last = msgs[msgs.length - 1];
    if (last && last.uid === uid) out.push({ uid, k, kind: 'msg', at: last.at || metaFor(uid, id).updatedAt, text: last.text });
  }
  return out;
}
export function unreadCount() {
  const seen = seenMap(); let n = 0;
  for (const uid of links.athletes) n += activity(uid).filter(a => a.at > (seen[uid] || 0)).length;
  return n;
}

export function Athletes({ onOpenAthlete, onOpenDay, onOpenPlan, onGoMore }) {
  const t = todayKey(), seen = seenMap();
  const [ps, setPs] = useState('…');
  useEffect(() => { pushState().then(setPs); }, []);
  const feed = links.athletes.flatMap(activity).sort((a, b) => b.at - a.at).slice(0, 30);
  const unread = feed.filter(a => a.at > (seen[a.uid] || 0)).length;
  return (
    <div class="screen">
      <div class="head"><div><div class="eyebrow">Coach · {links.athletes.length} athlète{links.athletes.length > 1 ? 's' : ''}</div><h1 class="title">Athlètes</h1></div>
        {unread > 0 && <button class="btn ghost" onClick={() => { for (const uid of links.athletes) markSeen(uid); }}>Tout marquer lu</button>}</div>
      <div class="stack">
        {links.athletes.length === 0 && <section class="card"><h3 class="h3">Ajoute ton premier athlète</h3><AddAthlete /></section>}
        {ps !== 'on' && ps !== '…' && links.athletes.length > 0 && <button class="card notif-cta" onClick={onGoMore}><Icon name="bell" /><span><b>Active les notifications</b><small>Pour être prévenu dès qu’un athlète valide sa séance ou t’écrit. Ça se règle dans Plus → Paramètres.</small></span></button>}
        {links.athletes.map(uid => {
          const e = getFor(uid, 'j:' + t) || {}, sc = score(e), fl = FLAGS.filter(([f]) => e.flags && e.flags[f]);
          const week = rangeKeys(addDays(t, -6), t), done = week.filter(k => { const s = (getFor(uid, 'j:' + k) || {}).status; return s === 'faite' || s === 'adaptee'; }).length;
          const planned = week.filter(k => dayName(uid, k) !== 'Repos').length;
          const scores = week.map(k => score(getFor(uid, 'j:' + k) || {})).filter(x => x !== null);
          const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : null;
          const nUnread = activity(uid).filter(a => a.at > (seen[uid] || 0)).length;
          const nt = nightTotal(e);
          return (
            <section class="card ath">
              <button class="ath-h" onClick={() => onOpenAthlete(uid)}>
                <span class="av">{(nameOf(uid) || '?').slice(0, 1).toUpperCase()}</span>
                <span style="flex:1;min-width:0"><b>{nameOf(uid)}{links.locks[uid] && <span class="lk" title="Plan verrouillé"><Icon name="lock" size={14} /></span>}</b><small>Aujourd’hui : {dayName(uid, t)}{e.status ? ' · ' + ST[e.status].toLowerCase() : ''}</small></span>
                {nUnread > 0 && <span class="badge-n">{nUnread}</span>}
                <span class="chev r" aria-hidden="true" />
              </button>
              <div class="ath-m">
                <span><small>Forme</small><b style={sc !== null ? 'color:' + verdictColor(verdict(sc).cls) : ''}>{sc !== null ? sc + '/25' : '—'}</b></span>
                <span><small>Nuit</small><b>{nt !== null ? durShort(nt) : '—'}</b></span>
                <span><small>7 jours</small><b>{done}/{planned}</b></span>
                <span><small>Forme 7 j</small><b>{avg !== null ? String(avg).replace('.', ',') : '—'}</b></span>
              </div>
              {fl.length > 0 && <p class="ath-f">{fl.map(([f, l]) => l + (e.gene && typeof e.gene[f] === 'number' ? ' ' + e.gene[f] + '/10' : '')).join(' · ')}</p>}
              <div class="row-btns" style="margin-top:10px">
                <button class="btn" style="flex:1" onClick={() => onOpenDay(uid, t)}>Séance du jour</button>
                <button class="btn" style="flex:1" onClick={() => onOpenAthlete(uid)}>Ouvrir son carnet</button>
              </div>
            </section>
          );
        })}
        {links.athletes.length > 0 && <section class="card"><h3 class="h3">Ajouter un athlète</h3><AddAthlete compact /></section>}
        {links.athletes.length > 0 && <section class="card flat">
          <div style="padding:14px 14px 4px"><h3 class="h3" style="margin:0">Activité récente <em>{unread ? unread + ' non lu' + (unread > 1 ? 's' : '') : ''}</em></h3></div>
          {feed.length === 0 && <p class="small" style="padding:0 14px 14px">Rien sur les 14 derniers jours.</p>}
          {feed.map(a => {
            const isNew = a.at > (seen[a.uid] || 0), sc = a.e ? score(a.e) : null;
            return <button class={'jrow' + (isNew ? ' new' : '')} onClick={() => a.kind === 'planedit' ? onOpenPlan(a.uid) : onOpenDay(a.uid, a.k)}>
              <span class="t">{nameOf(a.uid)} · {a.kind === 'msg' ? 'message' : a.kind === 'edit' ? 'a modifié sa séance' : a.kind === 'planedit' ? 'a modifié son plan' : a.e.status ? 'séance ' + ST[a.e.status].toLowerCase() : 'journal'}<span>{a.k ? fmtShort(a.k) : new Date(a.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span></span>
              {a.kind === 'session' ? <span class="m">
                {sc !== null && <span>Forme <b>{sc}</b></span>}
                {typeof a.e.rpe === 'number' && <span>Ressenti <b>{a.e.rpe}</b></span>}
                {a.e.siv && typeof a.e.siv.i === 'number' && <span>I <b>{a.e.siv.i}</b> V <b>{a.e.siv.v}</b></span>}
                {typeof a.e.duree === 'number' && <span><b>{a.e.duree}</b> min</span>}
              </span> : null}
              {(a.kind === 'msg' ? a.text : a.e && a.e.note) && <span class="nt">{a.kind === 'msg' ? a.text : a.e.note}</span>}
            </button>;
          })}
        </section>}
      </div>
    </div>
  );
}
