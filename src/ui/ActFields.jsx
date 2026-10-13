// Notation de la séance selon l'activité du jour (fiche du jour et fin du mode séance).
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { jget, jset } from '../lib/store.js';
import { target, uid, clone } from '../lib/plan.js';
import { SIV } from '../lib/rules.js';
import { ACTS, acts, plannedActs, hasLog, plannedLog, knownExercises } from '../lib/activity.js';
import { Seg, Icon, Src } from './kit.jsx';
import { relevantActs } from '../lib/sports.js';
import { lastPerf, perfText } from '../lib/history.js';

function LastHint({ k, label }) { const lp = lastPerf(label, k); return lp ? <p class="last-t" style="margin:2px 0 0">Dernière fois · {perfText(lp)}</p> : null; }

const ORDER = ACTS.map(a => a[0]);
const same = (a, b) => a.length === b.length && a.every(x => b.includes(x));
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };

function NumField({ label, value, onCommit, int, placeholder }) {
  const [v, setV] = useState(value == null ? '' : String(value).replace('.', ','));
  useEffect(() => setV(value == null ? '' : String(value).replace('.', ',')), [value]);
  return <label class="fld">{label}<input class="in mono" inputmode={int ? 'numeric' : 'decimal'} value={v} placeholder={placeholder} onInput={e => setV(e.target.value)}
    onBlur={() => { let n = num(v); if (n !== null && int) n = Math.round(n); if (n !== value) onCommit(n); }} /></label>;
}

// Exercices réellement faits : séries × répétitions (ou durée) × charge
function ExLog({ k }) {
  const saved = jget(k).log || [], sig = JSON.stringify(saved);
  const [rows, setRows] = useState(() => clone(saved));
  const mine = useRef(sig); // dernière version enregistrée d'ici : on ne recharge que les changements venus d'ailleurs
  useEffect(() => { if (sig !== mine.current) { mine.current = sig; setRows(clone(jget(k).log || [])); } }, [k, sig]);
  const names = useMemo(() => knownExercises(), [k]);
  const commit = r => {
    const out = r.length ? r.map(x => Object.assign({}, x, { label: (x.label || '').trim() })) : null;
    mine.current = JSON.stringify(out || []);
    jset(k, { log: out });
  };
  const upd = (i, patch) => setRows(rs => rs.map((x, j) => (j === i ? Object.assign({}, x, patch) : x)));
  const missing = plannedLog(k).filter(p => !rows.some(r => r.src === p.src));
  return (
    <div class="exlog">
      <p class="sub-lbl" style="margin-top:0">Ce que j’ai fait<small>séries × répétitions ou durée × charge</small></p>
      {rows.length === 0 && <p class="small" style="margin:0 0 8px">Liste les exercices réalisés, même s’ils diffèrent du plan.</p>}
      {rows.map((r, i) => (
        <div class="exl-row" key={r.id}>
          <div class="exl-top">
            <input class="in" list="ex-names" value={r.label} placeholder="Nom de l’exercice" aria-label="Exercice" onInput={e => upd(i, { label: e.target.value })} onBlur={() => commit(rows)} />
            <button type="button" class="icon-btn" aria-label={'Retirer ' + (r.label || 'cet exercice')} onClick={() => { const n = rows.filter((_, j) => j !== i); setRows(n); commit(n); }}><Icon name="close" size={16} /></button>
          </div>
          <div class="grid4 exl-g">
            <label class="fld">Séries<input class="in mono" inputmode="numeric" value={r.sets == null ? '' : r.sets} onInput={e => upd(i, { sets: e.target.value === '' ? null : (num(e.target.value) === null ? e.target.value : num(e.target.value)) })} onBlur={() => commit(rows)} /></label>
            <label class="fld">Rép. / durée<input class="in mono" value={r.reps || ''} placeholder="8 ou 30 s" onInput={e => upd(i, { reps: e.target.value })} onBlur={() => commit(rows)} /></label>
            <label class="fld">Charge<input class="in mono" value={r.load || ''} placeholder="kg, élastique" onInput={e => upd(i, { load: e.target.value })} onBlur={() => commit(rows)} /></label>
            <label class="fld">Réserve<select class="in mono" value={r.rir == null ? '' : String(r.rir)} onChange={e => { const n = rows.map((x, j) => (j === i ? Object.assign({}, x, { rir: e.target.value === '' ? null : +e.target.value }) : x)); setRows(n); commit(n); }}><option value="">—</option>{[0, 1, 2, 3, 4].map(x => <option value={String(x)}>{x === 4 ? '4+' : x}</option>)}</select></label>
          </div>
          {r.label && <LastHint k={k} label={r.label} />}
        </div>
      ))}
      <datalist id="ex-names">{names.map(n => <option value={n} />)}</datalist>
      <div class="row-btns">
        {missing.length > 0 && <button type="button" class="btn" onClick={() => { const n = rows.concat(missing); setRows(n); commit(n); }}>{rows.length ? 'Ajouter les exercices prévus (' + missing.length + ')' : 'Reprendre les exercices prévus (' + missing.length + ')'}</button>}
        <button type="button" class="btn" onClick={() => setRows(rows.concat([{ id: uid('l'), label: '', sets: null, reps: '', load: '' }]))}><Icon name="plus" size={18} />Ajouter un exercice</button>
      </div>
    </div>
  );
}

export function ActFields({ k }) {
  const e = jget(k), tg = target(k), list = acts(k), planned = plannedActs(k);
  const toggle = a => {
    const next = ORDER.filter(x => (x === a ? !list.includes(x) : list.includes(x)));
    jset(k, { act: same(next, planned) ? null : next });
  };
  const setSiv = (key, v) => { const s = Object.assign({}, jget(k).siv); if (v == null) delete s[key]; else s[key] = v; jset(k, { siv: Object.keys(s).length ? s : null }); };
  const setCardio = patch => { const c = Object.assign({}, jget(k).cardio, patch); for (const x of Object.keys(c)) if (c[x] == null) delete c[x]; jset(k, { cardio: Object.keys(c).length ? c : null }); };
  const pain = e.pain;
  // Activités du profil (sports pratiqués) + celles du jour ; le reste derrière « Autre »
  const rel = relevantActs(), [more, setMore] = useState(false);
  const shown = ACTS.filter(([a]) => !rel || more || rel.has(a) || list.includes(a) || planned.includes(a));
  const hidden = ACTS.length - shown.length;
  return (
    <div class="stack act-f" style="gap:16px">
      <div>
        <p class="sub-lbl" style="margin-top:0">Activité<small>{planned.length ? 'd’après le plan, modifiable' : 'ce que tu as fait'}</small></p>
        <div class="chips">{shown.map(([a, l]) => <button type="button" class="chip sel" aria-pressed={list.includes(a) ? 'true' : 'false'} onClick={() => toggle(a)}>{l}</button>)}
          {hidden > 0 && <button type="button" class="chip" style="border-style:dashed" onClick={() => setMore(true)}>Autre…</button>}</div>
      </div>
      {list.includes('grimpe') && <div>
        <p class="small" style="margin:0">Profil de la séance d’escalade, sur 10{tg && typeof tg.s === 'number' ? ' · en bleu, le profil visé' : ''}</p>
        {SIV.map(([key, l, q]) => <div><p class="sub-lbl">{l}<small>{q}</small></p>
          <Seg value={e.siv && e.siv[key]} onChange={v => setSiv(key, v)} from={0} to={10} dense tgt={tg && typeof tg[key] === 'number' ? i => tg[key] === i : null} label={l} /></div>)}
      </div>}
      {hasLog(list) && <ExLog k={k} />}
      {list.includes('kine') && <div>
        <p class="sub-lbl" style="margin-top:0">Douleur pendant la séance<small>0 aucune · 10 maximale</small></p>
        <Seg value={pain} onChange={v => jset(k, { pain: v })} from={0} to={10} dense label="Douleur pendant la séance" />
        {typeof pain === 'number' && <p class={'cmp ' + (pain <= 2 ? 'good' : 'warn')}>{pain <= 2 ? 'Zone sûre.' : pain <= 5 ? 'Acceptable si elle redescend d’ici demain matin et n’augmente pas d’une semaine à l’autre.' : 'Au-dessus de 5 : modifie ou allège ce qui la provoque, et parles-en à ton kiné.'}</p>}
        <Src ids={['silbernagel2007']} />
      </div>}
      {list.includes('cardio') && <div class="grid2">
        <NumField label="Distance (km)" value={e.cardio && e.cardio.km} onCommit={v => setCardio({ km: v })} />
        <NumField label="FC moyenne (bpm)" int value={e.cardio && e.cardio.fc} onCommit={v => setCardio({ fc: v })} placeholder="facultatif" />
      </div>}
    </div>
  );
}
