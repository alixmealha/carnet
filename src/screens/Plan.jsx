import { useState } from 'preact/hooks';
import { jget } from '../lib/store.js';
import { meta, day, blocks, weekKeys, savePlan, addWeeks, removeLastWeek, saveDay, copyDay, copyWeek, clone, uid, KIND, KIND_LIST, PHASE_LABEL, PHASE_Z, sessionName, weekOf, weekLabel } from '../lib/plan.js';
import { isSelf, getSubject, nameOf, canEditPlan, links } from '../lib/store.js';
import { setLock } from '../lib/account.js';
import { Rich, Fold } from '../ui/kit.jsx';
import { CATS, allTests, testById } from '../lib/tests.js';
import { SIV } from '../lib/rules.js';
import { md } from '../lib/md.js';
import { todayKey, fmtRange, fmtShort, fmtDay, fmtNum, addDays, mondayOf } from '../lib/dates.js';
import { Icon, Sheet, Seg, toast } from '../ui/kit.jsx';
import { tapesOf } from './Today.jsx';
import { Goal } from './DayView.jsx';

const PHASES = ['volume', 'reprise', 'force', 'puissance', 'specifique', 'affutage', 'recup', 'deload', 'transition', 'coupure', 'autre'];
const SHORT = { volume: 'Vol.', reprise: 'Rep.', force: 'Force', puissance: 'Puiss.', specifique: 'Spéc.', affutage: 'Affût.', recup: 'Récup.', deload: 'Déch.', transition: 'Trans.', coupure: 'Coup.', autre: 'Cycle' };
const FAMS = [['vol', 'Volume (modéré)'], ['easy', 'Facile'], ['hard', 'Dur'], ['light', 'Léger / récup'], ['muscu', 'Muscu'], ['test', 'Test']];
const UNITS = ['Série', 'Bloc', 'Essai'];
const TIMERS = [['', 'Aucun'], ['cluster', 'Clusters'], ['contrast', 'Contraste'], ['interval', 'Intervalles']];
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
const ask = q => window.confirm(q);

/* ---------- Petits champs ---------- */
function Txt({ label, value, onInput, placeholder, area, mono }) {
  return <label class="fld">{label}{area
    ? <textarea class="in" value={value || ''} placeholder={placeholder} onInput={e => onInput(e.target.value)} />
    : <input class={'in' + (mono ? ' mono' : '')} value={value || ''} placeholder={placeholder} onInput={e => onInput(e.target.value)} />}</label>;
}
function Num({ label, value, onCommit, placeholder, int }) {
  const [v, setV] = useState(value == null ? '' : fmtNum(value));
  return <label class="fld">{label}<input class="in mono" inputmode={int ? 'numeric' : 'decimal'} value={v} placeholder={placeholder}
    onInput={e => { setV(e.target.value); const n = num(e.target.value); onCommit(n === null ? null : int ? Math.round(n) : n); }} /></label>;
}
function Sel({ label, value, options, onChange }) {
  return <label class="fld">{label}<select class="in" value={value} onChange={e => onChange(e.target.value)}>{options.map(([v, l]) => <option value={v}>{l}</option>)}</select></label>;
}
function Bar({ onUp, onDown, onDel, first, last }) {
  return <div class="bar">
    <button type="button" onClick={onUp} disabled={first} aria-label="Monter"><Icon name="up" size={16} /></button>
    <button type="button" onClick={onDown} disabled={last} aria-label="Descendre"><Icon name="down" size={16} /></button>
    <button type="button" onClick={onDel} aria-label="Supprimer" style="color:var(--crit)"><Icon name="trash" size={16} /></button>
  </div>;
}
const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; const t = arr[i]; arr[i] = arr[j]; arr[j] = t; };

/* ---------- Éditeur d'un exercice ---------- */
function ItemEd({ it, set, i, n, onMove, onDel }) {
  const T = it.timer || null, tk = T ? T.kind : '';
  const setT = patch => set(x => { x.timer = Object.assign({}, x.timer, patch); });
  const setKind = kd => set(x => {
    if (!kd) delete x.timer;
    else if (kd === 'cluster') x.timer = { kind: 'cluster', reps: 3, intra: 25, setRest: 180 };
    else if (kd === 'contrast') x.timer = { kind: 'contrast', heavyRest: 300, lightRest: 180 };
    else x.timer = { kind: 'interval', name: x.label, work: 60, rest: 60, reps: x.n || 4, sets: 1, setRest: 0, prep: 10, workLabel: 'Effort', restLabel: 'Repos' };
  });
  const [open, setOpen] = useState(it.label === 'Nouvel exercice');
  const summary = [it.n + ' × ' + (it.unit || 'Série').toLowerCase(), it.load != null ? (it.unit_load === '+kg' ? '+' : '') + fmtNum(it.load) + ' kg' : null, it.rest ? it.rest + ' s de repos' : null, tk ? TIMERS.find(t => t[0] === tk)[1].toLowerCase() : null].filter(Boolean).join(' · ');
  if (!open) return (
    <div class="ed-item row">
      <button type="button" class="ed-sum" onClick={() => setOpen(true)}><b>{it.label || 'Sans nom'}</b><span>{summary}</span></button>
      <Bar first={i === 0} last={i === n - 1} onUp={() => onMove(-1)} onDown={() => onMove(1)} onDel={onDel} />
    </div>
  );
  return (
    <div class="ed-item">
      <div style="display:flex;gap:8px;align-items:flex-end"><div style="flex:1;min-width:0"><Txt label="Exercice" value={it.label} onInput={v => set(x => { x.label = v; })} /></div>
        <Bar first={i === 0} last={i === n - 1} onUp={() => onMove(-1)} onDown={() => onMove(1)} onDel={onDel} /></div>
      <Txt label="Détail" value={it.det} placeholder="5 répétitions, cotation, consigne…" onInput={v => set(x => { x.det = v || undefined; })} />
      <div class="grid3">
        <Num label="Nombre" int value={it.n} onCommit={v => set(x => { x.n = Math.max(1, v || 1); })} />
        <Sel label="Unité" value={it.unit || 'Série'} options={UNITS.map(u => [u, u])} onChange={v => set(x => { x.unit = v; })} />
        <Num label="Repos (s)" int value={it.rest} placeholder="—" onCommit={v => set(x => { if (v) x.rest = v; else delete x.rest; })} />
      </div>
      <div class="grid3">
        <Num label="Charge" value={it.load} placeholder="—" onCommit={v => set(x => { if (v === null) { delete x.load; delete x.unit_load; } else { x.load = v; x.unit_load = x.unit_load || 'kg'; } })} />
        <Sel label="Type de charge" value={it.unit_load || 'kg'} options={[['kg', 'kg'], ['+kg', 'lest +kg']]} onChange={v => set(x => { x.unit_load = v; })} />
        <Sel label="Minuteur" value={tk} options={TIMERS} onChange={setKind} />
      </div>
      {tk === 'cluster' && <div class="grid3">
        <Num label="Rép. par série" int value={T.reps} onCommit={v => setT({ reps: v || 1 })} />
        <Num label="Entre rép. (s)" int value={T.intra} onCommit={v => setT({ intra: v || 0 })} />
        <Num label="Entre séries (s)" int value={T.setRest} onCommit={v => setT({ setRest: v || 0 })} />
      </div>}
      {tk === 'contrast' && <div class="grid2">
        <Num label="Après la lourde (s)" int value={T.heavyRest} onCommit={v => setT({ heavyRest: v || 0 })} />
        <Num label="Après l’explosive (s)" int value={T.lightRest} onCommit={v => setT({ lightRest: v || 0 })} />
      </div>}
      {tk === 'interval' && <div class="grid4">
        <Num label="Effort (s)" int value={T.work} onCommit={v => setT({ work: v || 1 })} />
        <Num label="Pause (s)" int value={T.rest} onCommit={v => setT({ rest: v || 0 })} />
        <Num label="Répétitions" int value={T.reps} onCommit={v => setT({ reps: v || 1 })} />
        <Num label="Séries" int value={T.sets} onCommit={v => setT({ sets: v || 1 })} />
      </div>}
      <button type="button" class="btn ghost" style="align-self:flex-start" onClick={() => setOpen(false)}>Replier</button>
    </div>
  );
}

/* ---------- Éditeur d'un bloc ---------- */
function BlockEd({ b, set, i, n, onMove, onDel }) {
  const items = b.items || [];
  const setItem = (j, fn) => set(x => { fn(x.items[j]); });
  const BT = b.timer;
  const [info, setInfo] = useState(!b.title);
  return (
    <div class="ed-blk" style={'border-left:4px solid var(--k-' + b.kind + ')'}>
      <div style="display:flex;gap:8px;align-items:flex-end">
        <div style="flex:1;min-width:0"><Sel label="Type" value={b.kind} options={KIND_LIST.map(kd => [kd, KIND[kd]])} onChange={v => set(x => { x.kind = v; })} /></div>
        <div class="ed-item" style="padding:0;border:0;background:none"><Bar first={i === 0} last={i === n - 1} onUp={() => onMove(-1)} onDown={() => onMove(1)} onDel={onDel} /></div>
      </div>
      {!info ? <button type="button" class="ed-sum" onClick={() => setInfo(true)}><b>{b.title || KIND[b.kind]}</b><span>{b.desc || 'Ajouter un résumé'}</span><span style="color:var(--accent)">Titre, résumé, note</span></button> : <>
        <Txt label="Titre" value={b.title} onInput={v => set(x => { x.title = v; })} />
        <Txt label="Résumé" value={b.desc} placeholder="7 × 5 · RIR 1–2…" onInput={v => set(x => { x.desc = v; })} />
        <Txt label="Note" value={b.sub} placeholder="Consigne de progression…" onInput={v => set(x => { x.sub = v; })} />
      </>}
      {b.kind === 'doigts' && <div class="grid2">
        <Num label="Charge finger lift" value={b.finger && b.finger.load} placeholder="—" onCommit={v => set(x => { if (v === null) delete x.finger; else x.finger = Object.assign({ unit: 'kg' }, x.finger, { load: v }); })} />
        <Sel label="En" value={(b.finger && b.finger.unit) || 'kg'} options={[['kg', 'kg'], ['%', '% du test']]} onChange={v => set(x => { x.finger = Object.assign({ load: 0 }, x.finger, { unit: v }); })} />
      </div>}
      {BT && <div>
        <p class="sub-lbl" style="margin-top:0">Minuteur du bloc<small>{BT.sides ? BT.sides.join(' puis ').toLowerCase() : ''}</small></p>
        <div class="grid4">
          <Num label="Effort (s)" int value={BT.work} onCommit={v => set(x => { x.timer.work = v || 1; })} />
          <Num label="Pause (s)" int value={BT.rest} onCommit={v => set(x => { x.timer.rest = v || 0; })} />
          <Num label="Répétitions" int value={BT.reps} onCommit={v => set(x => { x.timer.reps = v || 1; })} />
          <Num label="Séries" int value={BT.sets} onCommit={v => set(x => { x.timer.sets = v || 1; })} />
        </div>
        <div class="grid2" style="margin-top:8px"><Num label="Entre séries (s)" int value={BT.setRest} onCommit={v => set(x => { x.timer.setRest = v || 0; })} />
          <div class="fld" style="justify-content:flex-end"><button type="button" class="btn danger" onClick={() => set(x => { delete x.timer; })}>Retirer le minuteur</button></div></div>
      </div>}
      {b.kind === 'test' && <details class="fold">
        <summary><span class="sub-lbl" style="margin:0">Tests à saisir ce jour-là <small>{(b.tests || []).length ? (b.tests || []).map(id => (testById(id) || { name: id }).name).join(' · ') : 'aucun'}</small></span></summary>
        <div class="stack" style="gap:8px;margin-top:8px">{CATS.filter(([c]) => allTests().some(t => t.cat === c)).map(([c, l]) => <div><p class="small" style="margin:0 0 4px">{l}</p><div class="chips">{allTests().filter(t => t.cat === c).map(t => { const on = (b.tests || []).includes(t.id); return <button type="button" class="chip sel" aria-pressed={on ? 'true' : 'false'} onClick={() => set(x => { const l2 = x.tests || []; x.tests = on ? l2.filter(y => y !== t.id) : l2.concat([t.id]); })}>{t.name}</button>; })}</div></div>)}</div>
      </details>}
      {b.kind !== 'rest' && <>
        {items.map((it, j) => <ItemEd key={it.id} it={it} i={j} n={items.length} set={fn => setItem(j, fn)} onMove={d => set(x => move(x.items, j, d))} onDel={() => set(x => { x.items.splice(j, 1); })} />)}
        <button type="button" class="btn" onClick={() => set(x => { x.items = x.items || []; x.items.push({ id: uid('i'), label: 'Nouvel exercice', n: 3, unit: b.kind === 'grimpe' ? 'Bloc' : 'Série' }); })}><Icon name="plus" size={18} />Ajouter un exercice</button>
      </>}
    </div>
  );
}

/* ---------- Éditeur d'un jour ---------- */
function DayEditor({ k, onClose }) {
  const [d, setD] = useState(() => clone(day(k) || { blocks: [] }));
  const [dirty, setDirty] = useState(false);
  const [to, setTo] = useState('');
  const up = fn => { setD(cur => { const c = clone(cur); c.blocks = c.blocks || []; fn(c); return c; }); setDirty(true); };
  const save = () => {
    const c = clone(d);
    c.blocks = (c.blocks || []).map(b => Object.assign(b, { title: b.title || KIND[b.kind] }));
    saveDay(k, c); toast('Séance enregistrée'); onClose(true);
  };
  const close = () => { if (!dirty || ask('Abandonner les modifications ?')) onClose(false); };
  const tg = d.target;
  const setTg = fn => up(c => { fn(c.target); });
  const bl = d.blocks || [];
  const hasJournal = Object.keys(jget(k)).length > 0;
  return (
    <Sheet title={'Séance · ' + fmtShort(k)} onClose={close} right={<button class="btn primary" onClick={save} disabled={!dirty}>OK</button>}>
      <div class="stack">
        {hasJournal && <p class="small" style="margin:0">Ce jour a déjà un journal. Les cases cochées restent liées aux exercices existants ; un exercice supprimé perd ses cases.</p>}
        {bl.length === 0 && <div class="empty">Jour de repos. Ajoute un bloc pour y mettre une séance.</div>}
        {bl.map((b, i) => <BlockEd key={b.id} b={b} i={i} n={bl.length} set={fn => up(c => fn(c.blocks[i]))} onMove={dd => up(c => move(c.blocks, i, dd))} onDel={() => { if (ask('Supprimer le bloc « ' + (b.title || KIND[b.kind]) + ' » ?')) up(c => { c.blocks.splice(i, 1); }); }} />)}
        <div>
          <p class="sub-lbl" style="margin-top:0">Ajouter un bloc</p>
          <div class="chips">{KIND_LIST.filter(kd => kd !== 'rest').map(kd => <button type="button" class="chip" onClick={() => up(c => { c.blocks.push({ id: uid('b'), kind: kd, title: KIND[kd], desc: '', sub: '', items: [] }); })}><span class="kdot" style={'background:var(--k-' + kd + ')'} />{KIND[kd]}</button>)}</div>
        </div>
        <section class="card">
          <h3 class="h3">Objectif de la séance <em><label style="display:inline-flex;align-items:center;gap:8px">Actif <input type="checkbox" class="sw" checked={!!tg} onChange={e => up(c => { if (e.target.checked) c.target = { rpe: [5, 6], s: 5, i: 5, v: 5, fam: 'vol', why: '' }; else delete c.target; })} /></label></em></h3>
          {tg ? <div class="stack" style="gap:10px">
            <div class="grid3">
              <Sel label="Ressenti min" value={tg.rpe ? String(tg.rpe[0]) : ''} options={[['', '—']].concat(Array.from({ length: 11 }, (_, i) => [String(i), String(i)]))} onChange={v => setTg(t => { if (v === '') { delete t.rpe; return; } const hi = t.rpe ? t.rpe[1] : +v; t.rpe = [+v, Math.max(+v, hi)]; })} />
              <Sel label="Ressenti max" value={tg.rpe ? String(tg.rpe[1]) : ''} options={[['', '—']].concat(Array.from({ length: 11 }, (_, i) => [String(i), String(i)]))} onChange={v => setTg(t => { if (v === '') { delete t.rpe; return; } const lo = t.rpe ? t.rpe[0] : +v; t.rpe = [Math.min(+v, lo), +v]; })} />
              <Sel label="Type" value={tg.fam} options={FAMS} onChange={v => setTg(t => { t.fam = v; })} />
            </div>
            {SIV.map(([key, l]) => <div><p class="sub-lbl" style="margin-top:0">{l} visée</p><Seg value={tg[key]} onChange={v => setTg(t => { t[key] = v == null ? 0 : v; })} from={0} to={10} dense label={l} /></div>)}
            <Txt label="Pourquoi" area value={tg.why} onInput={v => setTg(t => { t.why = v; })} />
          </div> : <p class="small" style="margin:0">Sans objectif, pas de zone visée ni de comparaison du ressenti.</p>}
        </section>
        <section class="card">
          <h3 class="h3">Copier ce jour</h3>
          <div style="display:flex;gap:8px;align-items:flex-end">
            <label class="fld" style="flex:1">Vers le<input class="in mono" type="date" value={to} onInput={e => setTo(e.target.value)} /></label>
            <button class="btn" disabled={!to || to === k} onClick={() => {
              if (day(to) && !ask('Le ' + fmtDay(to) + ' a déjà une séance. La remplacer ?')) return;
              saveDay(to, clone(d)); toast('Copié vers le ' + fmtDay(to));
            }}>Copier</button>
          </div>
          <p class="small">Copie la version affichée ici, y compris les modifications pas encore enregistrées.</p>
        </section>
        {bl.length > 0 && <button class="btn danger" onClick={() => { if (ask('Vider ce jour (repos) ?')) up(c => { c.blocks = []; delete c.target; }); }}>Passer ce jour en repos</button>}
      </div>
    </Sheet>
  );
}

/* ---------- Semaine ---------- */
function WeekSheet({ w, onClose, onDay }) {
  const m = meta(); const cur = m.weeks.find(x => x.id === w.id) || w;
  const [to, setTo] = useState('');
  const set = patch => { const mm = clone(meta()); Object.assign(mm.weeks.find(x => x.id === w.id), patch); savePlan(mm); };
  return (
    <Sheet title={weekLabel(cur) + ' · ' + fmtRange(cur.start, cur.end)} onClose={onClose}>
      <div class="stack">
        <div class="grid2">
          <Sel label="Phase" value={cur.phase || 'autre'} options={PHASES.map(p => [p, PHASE_LABEL[p]])} onChange={v => set({ phase: v })} />
          <label class="fld">Nom du bloc<input class="in" value={cur.bloc || ''} onChange={e => set({ bloc: e.target.value })} /></label>
        </div>
        <div class="list">
          {weekKeys(cur).map(k => {
            const tp = tapesOf(k);
            return <button class={'li' + (k === todayKey() ? ' now' : '')} onClick={() => onDay(k)}>
              <span style="min-width:0">{fmtShort(k)}<small>{sessionName(k)}</small></span>
              <span class="r"><span style="display:flex;gap:3px">{tp.map(kd => <i style={'display:block;width:8px;height:8px;border-radius:2px;background:var(--k-' + kd + ')'} />)}</span></span>
            </button>;
          })}
        </div>
        <section class="card">
          <h3 class="h3">Copier toute la semaine</h3>
          <div style="display:flex;gap:8px;align-items:flex-end">
            <div style="flex:1"><Sel label="Vers" value={to} options={[['', 'Choisir une semaine']].concat(m.weeks.filter(x => x.id !== cur.id).map(x => [x.id, weekLabel(x) + ' · ' + fmtRange(x.start, x.end)]))} onChange={setTo} /></div>
            <button class="btn" disabled={!to} onClick={() => {
              const tw = m.weeks.find(x => x.id === to);
              if (!ask('Remplacer toutes les séances de ' + weekLabel(tw) + ' par celles de ' + weekLabel(cur) + ' ?')) return;
              copyWeek(cur, tw); toast(weekLabel(cur) + ' copiée vers ' + weekLabel(tw));
            }}>Copier</button>
          </div>
          <p class="small">Chaque jour va sur le même jour de la semaine choisie. Le journal n’est pas touché.</p>
        </section>
      </div>
    </Sheet>
  );
}

/* ---------- Réglages du plan ---------- */
function PlanSheet({ onClose }) {
  const m = meta();
  const set = patch => savePlan(Object.assign(clone(meta()), patch));
  const [n, setN] = useState('4'), [ph, setPh] = useState('autre'), [bn, setBn] = useState('Nouveau cycle');
  const [nt, setNt] = useState('');
  const last = m.weeks[m.weeks.length - 1];
  return (
    <Sheet title="Réglages du plan" onClose={onClose}>
      <div class="stack">
        <section class="card stack" style="gap:10px">
          <label class="fld">Nom du plan<input class="in" value={m.title} onChange={e => set({ title: e.target.value })} /></label>
          <div class="grid2">
            <label class="fld">Objectif<input class="in" value={(m.goal && m.goal.label) || ''} placeholder="Compétition, voyage…" onChange={e => set({ goal: Object.assign({}, m.goal, { label: e.target.value }) })} /></label>
            <label class="fld">Date<input class="in mono" type="date" value={(m.goal && m.goal.date) || ''} onChange={e => set({ goal: e.target.value ? Object.assign({ label: 'Objectif' }, m.goal, { date: e.target.value }) : null })} /></label>
          </div>
          <p class="small" style="margin:0">Le compte à rebours de l’écran Aujourd’hui vise cette date.</p>
        </section>
        <section class="card">
          <h3 class="h3">Jours de test doigts</h3>
          <div class="list">{(m.tests || []).map(t => <div class="li noarrow"><span>{fmtShort(t)}</span><button class="btn ghost danger" onClick={() => set({ tests: m.tests.filter(x => x !== t) })}>Retirer</button></div>)}</div>
          <div style="display:flex;gap:8px;align-items:flex-end;margin-top:10px">
            <label class="fld" style="flex:1">Ajouter<input class="in mono" type="date" value={nt} onInput={e => setNt(e.target.value)} /></label>
            <button class="btn" disabled={!nt} onClick={() => { set({ tests: [...new Set([...(m.tests || []), nt])].sort() }); setNt(''); }}>Ajouter</button>
          </div>
          <p class="small">Ces jours affichent la saisie du test, et les charges en % s’appuient sur le dernier test.</p>
        </section>
        <section class="card stack" style="gap:10px">
          <h3 class="h3" style="margin:0">Prolonger le plan</h3>
          <div class="grid3">
            <Sel label="Semaines" value={n} options={[1, 2, 3, 4, 5, 6, 8, 10, 12].map(x => [String(x), String(x)])} onChange={setN} />
            <Sel label="Phase" value={ph} options={PHASES.map(p => [p, PHASE_LABEL[p]])} onChange={setPh} />
            <label class="fld">Bloc<input class="in" value={bn} onInput={e => setBn(e.target.value)} /></label>
          </div>
          <button class="btn primary" onClick={() => { addWeeks(+n, ph, bn); toast(n + ' semaine' + (+n > 1 ? 's' : '') + ' ajoutée' + (+n > 1 ? 's' : '')); }}>Ajouter après {last ? weekLabel(last) : 'le début'}</button>
          <p class="small" style="margin:0">Les nouvelles semaines sont vides : remplis-les jour par jour, ou copie une semaine existante.</p>
          {last && <button class="btn danger" onClick={() => { if (ask('Retirer ' + weekLabel(last) + ' et ses séances ? Le journal est conservé.')) removeLastWeek(); }}>Retirer la dernière semaine ({weekLabel(last)})</button>}
        </section>
      </div>
    </Sheet>
  );
}

/* ---------- Bloc d'entraînement (texte) ---------- */
function BlocSheet({ idx, onClose }) {
  const m = meta(); const isNew = idx === -1;
  const [b, setB] = useState(() => isNew ? { name: 'Nouveau bloc', from: m.start, to: m.end, obj: '', notes: '' } : clone(m.blocs[idx]));
  const save = () => { const mm = clone(meta()); mm.blocs = mm.blocs || []; if (isNew) mm.blocs.push(b); else mm.blocs[idx] = b; mm.blocs.sort((x, y) => x.from < y.from ? -1 : 1); savePlan(mm); onClose(); };
  return (
    <Sheet title={isNew ? 'Nouveau bloc' : b.name} onClose={onClose} right={<button class="btn primary" onClick={save}>OK</button>}>
      <div class="stack">
        <Txt label="Nom" value={b.name} onInput={v => setB(Object.assign({}, b, { name: v }))} />
        <div class="grid2">
          <label class="fld">Du<input class="in mono" type="date" value={b.from} onInput={e => setB(Object.assign({}, b, { from: e.target.value }))} /></label>
          <label class="fld">Au<input class="in mono" type="date" value={b.to} onInput={e => setB(Object.assign({}, b, { to: e.target.value }))} /></label>
        </div>
        <Txt label="Objectif" area value={b.obj} onInput={v => setB(Object.assign({}, b, { obj: v }))} />
        <label class="fld">Notes<textarea class="in" style="min-height:200px" value={b.notes || ''} onInput={e => setB(Object.assign({}, b, { notes: e.target.value }))} /></label>
        <p class="small" style="margin:0">Mise en forme : **gras**, lignes qui commencent par « - » pour une liste.</p>
        {!isNew && <button class="btn danger" onClick={() => { if (ask('Supprimer ce bloc de texte ? Les séances ne sont pas touchées.')) { const mm = clone(meta()); mm.blocs.splice(idx, 1); savePlan(mm); onClose(); } }}>Supprimer ce bloc</button>}
      </div>
    </Sheet>
  );
}

/* ---------- Section de repères ---------- */
function SectionSheet({ idx, onClose }) {
  const m = meta(); const isNew = idx === -1;
  const [s, setS] = useState(() => isNew ? { id: uid('s'), title: 'Nouvelle section', body: '' } : clone(m.sections[idx]));
  const save = () => { const mm = clone(meta()); mm.sections = mm.sections || []; if (isNew) mm.sections.push(s); else mm.sections[idx] = s; savePlan(mm); onClose(); };
  const mv = d => { const mm = clone(meta()); move(mm.sections, idx, d); savePlan(mm); onClose(); };
  return (
    <Sheet title={isNew ? 'Nouvelle section' : s.title} onClose={onClose} right={<button class="btn primary" onClick={save}>OK</button>}>
      <div class="stack">
        <Txt label="Titre" value={s.title} onInput={v => setS(Object.assign({}, s, { title: v }))} />
        <label class="fld">Texte<textarea class="in mono" style="min-height:320px;font-size:14px" value={s.body} onInput={e => setS(Object.assign({}, s, { body: e.target.value }))} /></label>
        <p class="small" style="margin:0">**gras**, « - » pour une liste, « ### » pour un sous-titre, et les tableaux en | colonnes | séparées |.</p>
        {!isNew && <div class="row-btns">
          <button class="btn" disabled={idx === 0} onClick={() => mv(-1)}>Monter</button>
          <button class="btn" disabled={idx === m.sections.length - 1} onClick={() => mv(1)}>Descendre</button>
          <button class="btn danger" style="margin-left:auto" onClick={() => { if (ask('Supprimer la section « ' + s.title + ' » ?')) { const mm = clone(meta()); mm.sections.splice(idx, 1); savePlan(mm); onClose(); } }}>Supprimer</button>
        </div>}
      </div>
    </Sheet>
  );
}

/* ---------- Écran ---------- */
function Timeline({ m, onWeek }) {
  const t = todayKey(), ws = m.weeks;
  const groups = [];
  for (const w of ws) { const g = groups[groups.length - 1]; if (g && g.bloc === w.bloc && g.phase === w.phase) g.n++; else groups.push({ bloc: w.bloc, phase: w.phase, n: 1 }); }
  const cols = 'repeat(' + ws.length + ',minmax(0,1fr))';
  return (
    <div>
      <div class="tl-names" style={'grid-template-columns:' + cols}>{groups.map(g => <span style={'grid-column:span ' + g.n} title={g.bloc}>{g.n >= 4 ? (PHASE_LABEL[g.phase] || g.bloc) : g.n >= 2 ? (SHORT[g.phase] || g.bloc) : ''}</span>)}</div>
      <div class="tl" style={'grid-template-columns:' + cols}>
        {ws.map(w => {
          const now = t >= w.start && t <= w.end, test = (m.tests || []).some(x => x >= w.start && x <= w.end), comp = (m.events || []).some(e => e.date >= w.start && e.date <= w.end);
          return <button class={'tl-w' + (now ? ' now' : '')} onClick={() => onWeek(w)} aria-label={'Semaine ' + weekLabel(w)}>
            <span class={'tl-bar ' + (PHASE_Z[w.phase] || 'z2')} />{test && <span class="tl-test" />}{comp && <span class="tl-comp" />}<b>{w.label ? '' : w.n}</b>
          </button>;
        })}
      </div>
      <div class="leg" style="margin-top:10px">
        {[...new Set(ws.map(w => w.phase))].map(p => <span><i class={PHASE_Z[p] || 'z2'} />{PHASE_LABEL[p] || p}</span>)}
        {(m.tests || []).length > 0 && <span><i class="tl-test" />Test</span>}{(m.events || []).length > 0 && <span><i class="tl-comp" />Compétition</span>}
      </div>
    </div>
  );
}

function weekSummary(w) {
  const c = {};
  for (const k of weekKeys(w)) for (const kd of tapesOf(k)) c[kd] = (c[kd] || 0) + 1;
  return Object.entries(c).sort((a, b) => KIND_LIST.indexOf(a[0]) - KIND_LIST.indexOf(b[0])).map(([kd, n]) => (n > 1 ? n + ' × ' : '') + (KIND[kd] || kd).toLowerCase()).join(' · ') || 'repos';
}

export function PlanScreen({ seg }) {
  const m = meta();
  const [sh, setSh] = useState(null);
  if (!m) return null;
  const t = todayKey(), cw = weekOf(t), ed = canEditPlan(), subj = getSubject(), coachView = !isSelf() && links.athletes.includes(subj);
  const open = x => { if (ed) setSh(x); };
  return (
    <div class="screen">
      <div class="head">
        <div style="min-width:0"><div class="eyebrow">{!isSelf() ? 'Plan de ' + nameOf(getSubject()) : m.goal ? m.goal.label + ' · ' + fmtShort(m.goal.date) : 'Plan'}</div><h1 class="title">{m.title}</h1></div>
        {ed && <button class="icon-btn" aria-label="Réglages du plan" onClick={() => setSh({ t: 'plan' })}><Icon name="edit" /></button>}
      </div>
      {seg}
      <div class="stack">
        {!ed && <p class="lock-n"><Icon name="lock" size={16} />Plan verrouillé par ton coach : tu le consultes, lui seul le modifie.</p>}
        {coachView && <label class="card lock-c"><Icon name="lock" size={18} /><span><b>Verrouiller le plan</b><small>{links.locks[subj] ? nameOf(subj) + ' ne peut plus modifier ses séances ni son plan.' : nameOf(subj) + ' peut aussi modifier ses séances.'}</small></span>
          <input type="checkbox" class="sw" checked={!!links.locks[subj]} onChange={async e => { const v = e.target.checked; try { await setLock(subj, v); toast(v ? 'Plan verrouillé' : 'Plan déverrouillé'); } catch (x) { toast(x.message); } }} /></label>}
        {m.edited && m.edited.uid && m.edited.uid !== links.me && <p class="edited" style="margin:-4px 0 0">Plan modifié par {m.edited.name || 'ton coach'} · {new Date(m.edited.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>}
        <section class="card"><h3 class="h3">Les {m.weeks.length} semaines <em>{fmtDay(m.start)} → {fmtDay(m.end)}</em></h3><Timeline m={m} onWeek={w => open({ t: 'week', w })} /></section>
        {(m.events || []).length > 0 && <Fold id="plan-events" title="Compétitions" open summary={(() => { const nx = m.events.find(e => (e.end || e.date) >= t); return nx ? 'Prochaine : ' + nx.label + ' · ' + fmtDay(nx.date) : m.events.length + ' compétitions'; })()}><div class="evs">{m.events.map(e => <div class={'ev' + ((e.end || e.date) < t ? ' past' : '')}><span class="d">{fmtDay(e.date)}{e.end && e.end !== e.date ? ' → ' + fmtDay(e.end) : ''}</span><b>{e.label}</b>{e.lvl && <small>{e.lvl}</small>}</div>)}</div></Fold>}

        {(m.blocs || []).map((b, i) => {
          const now = t >= b.from && t <= b.to;
          return <section class="card">
            <div class="head" style="margin-bottom:6px;align-items:flex-start">
              <div style="min-width:0"><div class="eyebrow">{fmtDay(b.from)} → {fmtDay(b.to)}{now ? ' · en cours' : ''}</div><h2 class="h2" style="margin-top:4px">{b.name}</h2></div>
              {ed && <button class="icon-btn" aria-label={'Modifier ' + b.name} onClick={() => setSh({ t: 'bloc', i })}><Icon name="edit" /></button>}
            </div>
            {b.obj && <p class="lead" style="margin:0"><Rich text={b.obj} /></p>}
            {b.notes && <details class="fold" style="margin-top:10px"><summary><span class="small" style="margin:0;font-weight:600;color:var(--accent)">Détails du bloc</span></summary><div class="mdx" style="margin-top:8px" dangerouslySetInnerHTML={{ __html: md(b.notes) }} /></details>}
          </section>;
        })}
        {ed && <button class="btn" onClick={() => setSh({ t: 'bloc', i: -1 })}><Icon name="plus" size={18} />Ajouter un bloc de texte</button>}

        <Fold id="plan-weeks" title="Semaines" summary={m.weeks.length + ' semaines' + (cw ? ' · en cours : ' + weekLabel(cw) + ' (' + (PHASE_LABEL[cw.phase] || cw.bloc) + ')' : '')} cls="flat-b">
          {m.weeks.map(w => <button class={'li' + (cw && cw.id === w.id ? ' now' : '') + (ed ? '' : ' noarrow')} onClick={() => open({ t: 'week', w })}>
            <span style="min-width:0"><b style="font-weight:600">{weekLabel(w)}</b> · {fmtRange(w.start, w.end)}<small>{(PHASE_LABEL[w.phase] || w.bloc) + ' · ' + weekSummary(w)}</small></span><span class="r" />
          </button>)}
        </Fold>

        <h3 class="h3" style="margin:8px 0 -4px">Repères du plan</h3>
        {(m.sections || []).map((s, i) => <details class="card fold">
          <summary><span style="font-weight:600">{s.title}</span></summary>
          <div class="mdx" style="margin-top:10px" dangerouslySetInnerHTML={{ __html: md(s.body) }} />
          {ed && <button class="btn ghost" style="margin-top:8px" onClick={() => setSh({ t: 'sec', i })}><Icon name="edit" size={18} />Modifier</button>}
        </details>)}
        {ed && <button class="btn" onClick={() => setSh({ t: 'sec', i: -1 })}><Icon name="plus" size={18} />Ajouter une section</button>}
      </div>

      {sh && sh.t === 'plan' && <PlanSheet onClose={() => setSh(null)} />}
      {sh && sh.t === 'week' && <WeekSheet w={sh.w} onClose={() => setSh(null)} onDay={k => setSh({ t: 'day', k, back: sh.w })} />}
      {sh && sh.t === 'day' && <DayEditor k={sh.k} onClose={() => setSh(sh.back ? { t: 'week', w: sh.back } : null)} />}
      {sh && sh.t === 'bloc' && <BlocSheet idx={sh.i} onClose={() => setSh(null)} />}
      {sh && sh.t === 'sec' && <SectionSheet idx={sh.i} onClose={() => setSh(null)} />}
    </div>
  );
}

export { DayEditor };
