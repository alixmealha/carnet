// « ••• » de la séance du jour : moins de temps que prévu, alléger, déplacer à un autre jour, annuler (avec la raison).
// Tout passe par le journal du jour (sauf le déplacement, qui modifie le plan) et se défait d'un appui.
import { useState } from 'preact/hooks';
import { jget, planLocked, links, isSelf } from '../lib/store.js';
import { rawBlocks, blockState, moveBlock, sessionName, SKIP, skipLabel, cancelSession, restoreSession, progress, moveTargets, ownBlocks, moveSession, swapSessions } from '../lib/plan.js';
import { unitsOf, plannedMin, fitToTime, lighten, applyAdjust, clearAdjust, adjSummary } from '../lib/adapt.js';
import { dayInsights } from '../lib/insights.js';
import { moveWarn } from './BlockMenu.jsx';
import { addDays, todayKey, fmtShort } from '../lib/dates.js';
import { Sheet, toast } from './kit.jsx';

const plain = s => String(s || '').replace(/\[[a-z]+\]\s*/g, '').trim();
const unitW = (u, n) => {
  const it = u.it, w = !it ? 'série' : it.unit === 'Bloc' ? 'bloc' : it.unit === 'Essai' ? 'essai' : it.unit === 'Voie' ? 'voie' : it.timer && it.timer.markEach === 'rep' ? 'répétition' : 'série';
  return n + ' ' + w + (n > 1 ? 's' : '');
};
// Une ligne de l'aperçu : ce qui est gardé, réduit, raccourci ou retiré
function Row({ x }) {
  const u = x.u, lbl = plain(u.label);
  const what = x.act === 'drop' ? 'retiré'
    : u.mins != null ? (x.act === 'short' ? x.m + ' min au lieu de ' + Math.round(u.mins) : Math.round(u.mins) + ' min')
    : x.act === 'reduce' ? unitW(u, x.n) + ' au lieu de ' + u.n0 : unitW(u, u.n0);
  return <li class={'fit-r ' + x.act}><span>{lbl}</span><em>{what}</em></li>;
}

export function SessionMenu({ k, onClose }) {
  const e = jget(k), locked = planLocked(), name = plain(sessionName(k));
  const [mode, setMode] = useState(null);
  const units = unitsOf(k), base = plannedMin(units);
  const adj = adjSummary(k), cancel = e.cancel;
  const r = dayInsights(k), lvl = r ? r.level : null;
  const started = progress(k).done > 0;
  const toggle = m => setMode(mode === m ? null : m);
  const done = msg => { toast(msg); onClose(); };
  const coach = isSelf() && links.coaches && links.coaches.length > 0;
  return (
    <Sheet title={name || 'Séance du jour'} onClose={onClose}>
      <div class="stack" style="gap:10px">
        {cancel && <div class="bm-now">
          <p style="margin:0"><b>{cancel.started ? 'Séance arrêtée' : 'Séance annulée'}</b> · {skipLabel(cancel.r).toLowerCase()}{cancel.note ? ' · « ' + cancel.note + ' »' : ''}</p>
          <button class="btn" onClick={() => { restoreSession(k); done('Séance rétablie'); }}>Rétablir la séance</button>
        </div>}
        {adj && !cancel && <div class="bm-now">
          <p style="margin:0"><b>{adj.head}</b>{adj.dropped.length ? ' · retiré : ' + adj.dropped.map(plain).join(', ') : ''}</p>
          <button class="btn" onClick={() => { clearAdjust(k); done('Retour à la séance prévue'); }}>Revenir à la séance prévue</button>
        </div>}
        {!cancel && units.length > 0 && <>
          <button type="button" class={'bm-opt' + (mode === 'time' ? ' on' : '')} aria-expanded={mode === 'time' ? 'true' : 'false'} onClick={() => toggle('time')}>
            <b>J’ai moins de temps que prévu</b><span>Séance prévue ≈ {base} min. Indique le temps que tu as : l’appli garde l’essentiel et te montre ce qui change.</span>
          </button>
          {mode === 'time' && <TimeFit k={k} base={base} onDone={done} />}
          <button type="button" class={'bm-opt' + (mode === 'light' ? ' on' : '')} aria-expanded={mode === 'light' ? 'true' : 'false'} onClick={() => toggle('light')}>
            <b>Alléger ma séance</b><span>{lvl === 'crit' ? 'Ta forme du matin conseille la version décharge.' : lvl === 'warn' ? 'Ta forme du matin conseille d’alléger d’un tiers.' : 'Fatigue, courbatures, mauvaise nuit : mêmes exercices, moins de séries.'}</span>
          </button>
          {mode === 'light' && <Lighten k={k} reco={lvl === 'crit' ? 0.5 : 1 / 3} onDone={done} />}
        </>}
        {!cancel && !started && units.length > 0 && <>
          <button type="button" class={'bm-opt' + (mode === 'move' ? ' on' : '')} aria-expanded={mode === 'move' ? 'true' : 'false'} onClick={() => toggle('move')}>
            <b>Déplacer à un autre jour</b><span>{locked ? 'Ton plan est verrouillé par ton coach : demande-lui.' : 'Plus tôt ou plus tard : toute la séance passe au jour choisi, ou s’échange avec celle de ce jour.'}</span>
          </button>
          {mode === 'move' && !locked && <MoveDays k={k} onDone={done} />}
        </>}
        {!cancel && <>
          <button type="button" class={'bm-opt warn' + (mode === 'cancel' ? ' on' : '')} aria-expanded={mode === 'cancel' ? 'true' : 'false'} onClick={() => toggle('cancel')}>
            <b>{started ? 'Arrêter la séance ici' : 'Annuler la séance'}</b><span>{started ? 'Ce qui est fait est gardé ; le reste passe en « pas fait ». ' : ''}Avec la raison{coach ? ' : ton coach la voit' : ', gardée dans le journal'}.</span>
          </button>
          {mode === 'cancel' && <CancelForm k={k} started={started} coach={coach} onDone={done} />}
        </>}
      </div>
    </Sheet>
  );
}

function TimeFit({ k, base, onDone }) {
  const sugg = [20, 30, 45, 60, 75, 90].filter(m => m < base);
  const [min, setMin] = useState(() => sugg.length ? sugg[Math.max(0, sugg.findIndex(m => m >= base * 0.55))] || sugg[sugg.length - 1] : Math.max(10, base - 10));
  const [txt, setTxt] = useState(String(min));
  const r = min >= 10 ? fitToTime(k, min) : null;
  const set = v => { setMin(v); setTxt(String(v)); };
  const changed = r && r.rows.some(x => x.act !== 'full');
  return <div class="fit">
    <div class="fit-in">
      <label class="fld" style="flex:none;width:110px">Temps dispo<input class="in mono" inputmode="numeric" value={txt} onInput={ev => { setTxt(ev.target.value); const n = parseInt(ev.target.value, 10); if (n >= 10 && n <= 300) setMin(n); }} /></label>
      <span class="fit-u">min</span>
      <div class="chips" style="flex:1">{sugg.map(m => <button type="button" class="chip sel" aria-pressed={m === min ? 'true' : 'false'} onClick={() => set(m)}>{m}</button>)}</div>
    </div>
    {r && <>
      <p class="fit-t"><b>≈ {r.total} min</b> au lieu de ≈ {r.base}{r.total > min + 2 ? ' · ce qui est déjà fait ne peut pas être retiré' : ''}</p>
      <ul class="fit-l">{r.rows.map(x => <Row x={x} />)}</ul>
      <p class="small" style="margin:0">Gardés en priorité : l’échauffement (raccourci) et les exercices principaux, en séries complètes. Ensuite les accessoires, puis la prévention.</p>
      <button class="btn primary" disabled={!changed} onClick={() => { applyAdjust(r); onDone('Séance adaptée à ' + min + ' min'); }}>{changed ? 'Adapter la séance' : 'Ta séance tient déjà dans ce temps'}</button>
    </>}
  </div>;
}

function Lighten({ k, reco, onDone }) {
  const [frac, setFrac] = useState(reco);
  const r = lighten(k, frac);
  const less = r.rows.reduce((a, x) => a + (x.u.n0 && x.n != null ? x.u.n0 - x.n : 0), 0);
  return <div class="fit">
    <div class="chips">
      {[[1 / 3, 'Un tiers en moins', 'fatigué'], [0.5, 'Moitié · version décharge', 'très fatigué']].map(([f, l, s]) => <button type="button" class="chip sel" aria-pressed={Math.abs(f - frac) < 0.01 ? 'true' : 'false'} onClick={() => setFrac(f)}>{l}{Math.abs(f - reco) < 0.01 ? ' · conseillé' : ''}</button>)}
    </div>
    <p class="fit-t"><b>{less} série{less > 1 ? 's' : ''} en moins</b> · ≈ {r.total} min au lieu de ≈ {r.base}</p>
    <ul class="fit-l">{r.rows.filter(x => !x.u.warm).map(x => <Row x={x} />)}</ul>
    <p class="small" style="margin:0">{frac >= 0.5 ? 'Rien au maximum : garde 2 à 3 répétitions en réserve, cotations un cran en dessous.' : 'Mêmes charges, pas de nouveau palier aujourd’hui.'}</p>
    <button class="btn primary" onClick={() => { applyAdjust(r); onDone(frac >= 0.5 ? 'Version décharge' : 'Séance allégée'); }}>Alléger la séance</button>
  </div>;
}

function MoveDays({ k, onDone }) {
  const today = todayKey(), bl = ownBlocks(k);
  return <div class="bm-days">{moveTargets(k).map(d => {
    const w = [...new Set(bl.map(b => moveWarn(k, b, d)).filter(Boolean))].join(' · '), other = rawBlocks(d).some(b => b.kind !== 'rest');
    const lbl = d === today ? 'Aujourd’hui' : fmtShort(d);
    return <div class="bm-day">
      <button type="button" onClick={() => { moveSession(k, d); onDone('Séance déplacée ' + (d === today ? 'à aujourd’hui' : 'au ' + fmtShort(d).toLowerCase())); }}>
        <b>{lbl}</b><span>{sessionName(d) || 'Repos'}</span>{w && <em>{w}</em>}
      </button>
      {other && <button type="button" class="bm-swap" aria-label={'Échanger avec ' + lbl} onClick={() => { swapSessions(k, d); onDone('Séances échangées avec ' + (d === today ? 'aujourd’hui' : 'le ' + fmtShort(d).toLowerCase())); }}>Échanger</button>}
    </div>;
  })}</div>;
}

function CancelForm({ k, started, coach, onDone }) {
  const [r, setR] = useState(null), [note, setNote] = useState('');
  return <div class="fit">
    <p class="sub-lbl" style="margin:0">Pourquoi ?</p>
    <div class="chips">{SKIP.filter(([v]) => v !== 'materiel').map(([v, l]) => <button type="button" class="chip sel" aria-pressed={r === v ? 'true' : 'false'} onClick={() => setR(v)}>{l}</button>)}</div>
    <label class="fld">Un mot <small>facultatif{coach ? ', ton coach le lit' : ''}</small><textarea class="in" rows="3" value={note} placeholder="Mal dormi, journée chargée, douleur au genou…" onInput={ev => setNote(ev.target.value)} /></label>
    <button class="btn danger" disabled={!r} onClick={() => { cancelSession(k, r, note.trim()); onDone(started ? 'Séance arrêtée' : 'Séance annulée'); }}>{started ? 'Arrêter la séance' : 'Annuler la séance'}</button>
    {!r && <p class="small" style="margin:0">Choisis une raison : elle aide à comprendre ta semaine{coach ? ', et ton coach à adapter la suite' : ''}.</p>}
  </div>;
}
