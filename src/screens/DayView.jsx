import { useEffect, useRef, useState } from 'preact/hooks';
import { jget, jset } from '../lib/store.js';
import { blocks, target, weekOf, itemKey, doneN, progress, allItems, itemLoad, fingerCalc, isTestDay, PHASE_LABEL, meta } from '../lib/plan.js';
import { WELL, FLAGS, RPE, STATUS, SIV, score, verdict, advice, rpeCmp, rng, NSTAGE, NMET, parseDur, durShort, durLong, nightTotal, vfcAvg, nightCompare } from '../lib/rules.js';
import { fmtLong, addDays, todayKey, fmtNum } from '../lib/dates.js';
import { Seg, TextSeg, Icon } from '../ui/kit.jsx';

export function DayHeader({ k, onNav, compact }) {
  const w = weekOf(k), m = meta();
  const inRange = m && k >= m.start && k <= m.end;
  return (
    <div class="head" style={compact ? 'margin-bottom:10px' : ''}>
      <div style="min-width:0">
        <div class="eyebrow">{w ? 'S' + w.n + ' · ' + (PHASE_LABEL[w.phase] || w.bloc) + (w.xmas ? ' · Noël' : '') : (inRange ? '' : 'Hors plan')}{k === todayKey() ? ' · aujourd’hui' : ''}</div>
        <h2 class="h2" style="font-size:30px;margin-top:4px">{fmtLong(k)}</h2>
      </div>
      {onNav && <div class="row-btns" style="flex:none">
        <button class="icon-btn" aria-label="Jour précédent" onClick={() => onNav(addDays(k, -1))}><Icon name="left" /></button>
        <button class="icon-btn" aria-label="Jour suivant" onClick={() => onNav(addDays(k, 1))}><Icon name="right" /></button>
      </div>}
    </div>
  );
}

function Morning({ k }) {
  const e = jget(k), t = score(e);
  const [open, setOpen] = useState(t === null);
  const was = useRef(t);
  useEffect(() => { if (was.current === null && t !== null) { const id = setTimeout(() => setOpen(false), 650); was.current = t; return () => clearTimeout(id); } was.current = t; }, [t]);
  const fl = FLAGS.filter(([f]) => e.flags && e.flags[f]);
  if (!open && t !== null) return (
    <button type="button" class="card sum" onClick={() => setOpen(true)} aria-label="Modifier la forme du matin">
      <span class="sum-k">Forme du matin</span>
      <span class="sum-v"><b class="num">{t}<small>/25</small></b><span class={'pill ' + verdict(t).cls}>{verdict(t).lbl}</span></span>
      {fl.length > 0 && <span class="sum-f">{fl.map(([f, l]) => l + (e.gene && typeof e.gene[f] === 'number' ? ' ' + e.gene[f] + '/10' : '')).join(' · ')}</span>}
      <span class="sum-e">Modifier</span>
    </button>
  );
  const setWell = (key, v) => { const w = Object.assign({}, e.well); if (v == null) delete w[key]; else w[key] = v; jset(k, { well: w }); };
  const toggleFlag = f => {
    const fl = Object.assign({}, e.flags), ge = Object.assign({}, e.gene);
    if (fl[f]) { delete fl[f]; delete ge[f]; } else fl[f] = true;
    jset(k, { flags: fl, gene: ge });
  };
  const setGene = (f, v) => { const ge = Object.assign({}, e.gene); if (v == null) delete ge[f]; else ge[f] = v; jset(k, { gene: ge }); };
  return (
    <section class="card">
      <h3 class="h3">Forme du matin <em>{t === null ? '1 = mauvais · 5 = au top' : <button class="btn ghost" style="min-height:28px;padding:0;font-size:13px" onClick={() => setOpen(false)}>Replier</button>}</em></h3>
      {WELL.map(([key, lbl, lo, hi]) =>
        <div class="wrow"><div class="lbl">{lbl}<small>{lo} → {hi}</small></div>
          <Seg value={e.well && e.well[key]} onChange={v => setWell(key, v)} label={lbl} /></div>)}
      {t !== null && <div class="score"><b>{t}<small>/25</small></b><span class={'pill ' + verdict(t).cls}>{verdict(t).lbl}</span></div>}
      <p class="sub-lbl">Sensible au réveil</p>
      <div class="chips">{FLAGS.map(([f, l]) => <button type="button" class="chip" aria-pressed={e.flags && e.flags[f] ? 'true' : 'false'} onClick={() => toggleFlag(f)}>{l}</button>)}</div>
      {FLAGS.filter(([f]) => e.flags && e.flags[f]).map(([f, l]) =>
        <div><p class="sub-lbl">Gêne {l.toLowerCase()}<small>0 = rien · 10 = maximale</small></p>
          <Seg value={e.gene && e.gene[f]} onChange={v => setGene(f, v)} from={0} to={10} dense label={'Gêne ' + l} /></div>)}
    </section>
  );
}

function DurField({ k, name, label }) {
  const e = jget(k), cur = e.nuit && e.nuit[name];
  const [v, setV] = useState(typeof cur === 'number' ? durShort(cur) : '');
  const [bad, setBad] = useState(false);
  useEffect(() => { setV(typeof cur === 'number' ? durShort(cur) : ''); }, [k, cur]);
  const commit = () => {
    const m = parseDur(v);
    if (Number.isNaN(m)) { setBad(true); return; }
    setBad(false);
    const n = Object.assign({}, jget(k).nuit); if (m === null) delete n[name]; else n[name] = m;
    jset(k, { nuit: n });
  };
  return <label class="fld">{label}<input class="in mono" inputmode="text" autocomplete="off" placeholder="1h12" value={v} aria-invalid={bad ? 'true' : 'false'} onInput={e2 => setV(e2.target.value)} onBlur={commit} /></label>;
}
function MetField({ k, name, label, unit }) {
  const e = jget(k), cur = e.nuit && e.nuit[name];
  const [v, setV] = useState(typeof cur === 'number' ? String(cur) : '');
  useEffect(() => { setV(typeof cur === 'number' ? String(cur) : ''); }, [k, cur]);
  const commit = () => { const x = v === '' ? null : Math.round(+String(v).replace(',', '.')); const n = Object.assign({}, jget(k).nuit); if (x === null || isNaN(x)) delete n[name]; else n[name] = x; jset(k, { nuit: n }); };
  return <label class="fld">{label} ({unit})<input class="in mono" inputmode="numeric" value={v} onInput={e2 => setV(e2.target.value)} onBlur={commit} /></label>;
}
function Night({ k }) {
  const e = jget(k), n = e.nuit || {}, tot = nightTotal(e), avg = vfcAvg(k), cmp = nightCompare(e);
  const ev = typeof n.eveil === 'number' ? n.eveil : 0;
  return (
    <details class="card fold">
      <summary><h3 class="h3" style="margin:0">Nuit mesurée <em>{tot !== null ? durLong(tot) + (typeof n.vfc === 'number' ? ' · VFC ' + n.vfc : '') : 'à renseigner'}</em></h3></summary>
      <div style="margin-top:12px">
        <div class="night">{NSTAGE.map(([key, l]) => <DurField k={k} name={key} label={l} />)}</div>
        <div class="grid3" style="margin-top:8px">{NMET.map(([key, l, u]) => <MetField k={k} name={key} label={l} unit={u} />)}</div>
        {tot !== null ? <>
          <div class="sbar" role="img" aria-label="Répartition de la nuit">{NSTAGE.filter(([key]) => typeof n[key] === 'number' && n[key] > 0).map(([key]) => <i style={'width:' + (n[key] / (tot + ev) * 100).toFixed(1) + '%;background:var(--s-' + key + ')'} />)}</div>
          <div class="nsum"><span><b>Sommeil {durLong(tot)}</b></span>{NSTAGE.filter(([key]) => typeof n[key] === 'number').map(([key, l]) => <span class="k"><i style={'background:var(--s-' + key + ')'} />{l} {key === 'eveil' ? durLong(n[key]) : Math.round(n[key] / tot * 100) + ' %'}</span>)}</div>
        </> : <p class="small">Tape 1h12, 1:12 ou 72 (en minutes).</p>}
        {(typeof n.vfc === 'number' || typeof n.fcr === 'number' || typeof n.recup === 'number') &&
          <div class="nsum">{typeof n.vfc === 'number' && <span>VFC <b>{n.vfc} ms</b>{avg !== null ? ' · moy. 7 j ' + avg : ''}</span>}{typeof n.fcr === 'number' && <span>FC <b>{n.fcr} bpm</b></span>}{typeof n.recup === 'number' && <span>Récup <b>{n.recup} %</b></span>}</div>}
        {cmp && <p class="small">{cmp}</p>}
      </div>
    </details>
  );
}

export function Goal({ k }) {
  const tg = target(k);
  if (!tg) return blocks(k).some(b => b.kind === 'kine') ? <div class="goal"><p class="goal-why" style="margin:0">Objectif fixé par le kiné.</p></div> : null;
  return (
    <div class="goal">
      <div class="goal-top">
        <div class="goal-rpe"><small>Ressenti<br />visé</small><b>{rng(tg)}<i>/10</i></b></div>
        <div class="siv" role="img" aria-label={'Profil visé : spécificité ' + tg.s + ', intensité ' + tg.i + ', volume ' + tg.v}>
          {SIV.map(([key, l]) => <div class="siv-row"><span>{l}</span><span class="bar"><i style={'width:' + tg[key] * 10 + '%'} /></span><b>{tg[key]}</b></div>)}
        </div>
      </div>
      {tg.why && <p class="goal-why">{tg.why}</p>}
    </div>
  );
}

export function ItemRow({ k, b, it, e, color }) {
  const key = itemKey(b, it), v = doneN(e, key, it.n), full = v >= it.n, ld = itemLoad(b, it, e);
  const setDone = val => {
    const cur = jget(k), done = Object.assign({}, cur.done);
    if (val > 0) done[key] = val; else delete done[key];
    const patch = { done };
    jset(k, patch);
    const p = progress(k);
    if (p.total && p.done === p.total && !jget(k).status) jset(k, { status: 'faite' });
  };
  return (
    <div class={'it' + (full ? ' done' : '')}>
      <button type="button" class="ck" aria-pressed={full ? 'true' : 'false'} aria-label={it.label} onClick={() => setDone(full ? 0 : it.n)}>✓</button>
      <div class="it-txt"><b><i class="lt" style="font-style:normal">{it.label}{ld && <span class={'load-tag' + (ld.changed ? ' chg' : '')}>{ld.text}</span>}</i>{it.n > 1 && <em class="pn" style="font-style:normal">{v}/{it.n}</em>}</b>{it.det && <span>{it.det}</span>}</div>
      {it.n > 1 && <div class="pips" role="group" aria-label={it.label + ' : ' + v + ' sur ' + it.n}>
        {Array.from({ length: it.n }, (_, i) => i + 1).map(i => <button type="button" class="pip" style={'--c:' + color} aria-pressed={i <= v ? 'true' : 'false'} aria-label={(it.unit || 'Série') + ' ' + i} onClick={() => setDone(v === i ? i - 1 : i)}>{i}</button>)}
      </div>}
    </div>
  );
}

function SessionCard({ k, onStart, onEdit }) {
  const e = jget(k), bl = blocks(k), pr = progress(k);
  const active = bl.some(b => b.kind !== 'rest');
  return (
    <section class="card">
      <h3 class="h3">Séance du jour <em>{pr.total ? pr.done + '/' + pr.total + ' fait' : ''}{onEdit && <button class="btn ghost" style="min-height:28px;padding:0 0 0 10px;font-size:13px" onClick={() => onEdit(k)}>Modifier</button>}</em></h3>
      <div class="stack">
        <Goal k={k} />
        {bl.length === 0 && <p class="small" style="margin:0">Rien de prévu ce jour-là.</p>}
        {bl.map(b => {
          const color = 'var(--k-' + (b.kind === 'rest' ? 'rest' : b.kind) + ')', fc = b.kind === 'doigts' ? fingerCalc(b, k) : null;
          return (
            <div class="blk">
              <span class="tape" style={'background:' + color} />
              <div style="min-width:0">
                <h4>{b.title}</h4>
                {b.desc && <p class="d">{b.desc}</p>}
                {fc && <div class="calc">{fc.text}{fc.hint && <><br /><span class="muted">{fc.hint}</span></>}</div>}
                {fc && fc.guard && <div class="guard">{fc.guard}</div>}
                {b.sub && <div class="sub">{b.sub}</div>}
                {b.items && b.items.length > 0 && <div class="items">{b.items.map(it => <ItemRow k={k} b={b} it={it} e={e} color={color} />)}</div>}
              </div>
            </div>
          );
        })}
        {active && onStart && <button class="btn big primary" onClick={() => onStart(k)}><Icon name="play" size={20} />{e.startedAt && !e.endedAt ? 'Reprendre la séance' : pr.done ? 'Continuer la séance' : 'Démarrer la séance'}</button>}
      </div>
    </section>
  );
}

function Tests({ k }) {
  const te = jget(k).tests || {};
  const set = (key, raw) => { const n = parseFloat(String(raw).replace(',', '.')); const t2 = Object.assign({}, jget(k).tests); if (isNaN(n) || n <= 0) delete t2[key]; else t2[key] = n; jset(k, { tests: t2 }); };
  return (
    <section class="card">
      <h3 class="h3">Résultats du test</h3>
      <div class="grid2">
        <label class="fld">Max semi-arqué (kg)<input class="in mono" inputmode="decimal" defaultValue={te.semi != null ? fmtNum(te.semi) : ''} onBlur={e => set('semi', e.target.value)} /></label>
        <label class="fld">Max tendu (kg)<input class="in mono" inputmode="decimal" defaultValue={te.tendu != null ? fmtNum(te.tendu) : ''} onBlur={e => set('tendu', e.target.value)} /></label>
      </div>
      <p class="small">Meilleure valeur par préhension. Les charges en % du bloc suivant se calculent dessus.</p>
    </section>
  );
}

export function After({ k }) {
  const e = jget(k), tg = target(k), cmp = rpeCmp(tg, e.rpe);
  const [note, setNote] = useState(e.note || '');
  const [dur, setDur] = useState(typeof e.duree === 'number' ? String(e.duree) : '');
  const timer = useRef(null);
  useEffect(() => { setNote(jget(k).note || ''); const d = jget(k).duree; setDur(typeof d === 'number' ? String(d) : ''); }, [k]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onNote = v => { setNote(v); clearTimeout(timer.current); timer.current = setTimeout(() => jset(k, { note: v || null }), 500); };
  const commitDur = () => { const n = dur === '' ? null : Math.max(0, Math.round(+dur)); jset(k, { duree: n === null || isNaN(n) ? null : n }); };
  const setSiv = (key, v) => { const s = Object.assign({}, jget(k).siv); if (v == null) delete s[key]; else s[key] = v; jset(k, { siv: s }); };
  const d = parseInt(dur, 10);
  return (
    <section class="card">
      <h3 class="h3">Après la séance</h3>
      <div class="stack">
        <TextSeg value={e.status} onChange={v => jset(k, { status: v })} options={STATUS} label="Statut de la séance" />
        <div>
          <Seg value={e.rpe} onChange={v => jset(k, { rpe: v })} from={0} to={10} dense tgt={tg ? i => i >= tg.rpe[0] && i <= tg.rpe[1] : null} label="Ressenti de 0 à 10" />
          <div class="rpe-lbl">{typeof e.rpe === 'number' ? <>Ressenti <b>{e.rpe}/10 · {RPE[e.rpe]}</b></> : 'Ressenti global de 0 à 10, environ 30 min après' + (tg ? ' · en bleu, la zone visée' : '')}</div>
          {cmp && <p class={'cmp ' + cmp.cls}>{cmp.text}</p>}
        </div>
        <div>
          <p class="small" style="margin:0">Profil réalisé, sur 10{tg ? ' · en bleu, le profil visé' : ''}</p>
          {SIV.map(([key, l, q]) => <div><p class="sub-lbl">{l}<small>{q}</small></p>
            <Seg value={e.siv && e.siv[key]} onChange={v => setSiv(key, v)} from={0} to={10} dense tgt={tg ? i => tg[key] === i : null} label={l} /></div>)}
        </div>
        <div class="grid2" style="align-items:end">
          <label class="fld">Durée totale (min)<input class="in mono" inputmode="numeric" value={dur} onInput={ev => setDur(ev.target.value)} onBlur={commitDur} /></label>
          <div class="loadbox">{typeof e.rpe === 'number' && d > 0 ? (e.rpe * d).toLocaleString('fr-FR') + ' UA' : '—'}<small>Charge = ressenti × durée</small></div>
        </div>
        <label class="fld">Note du jour<textarea class="in" value={note} placeholder="Ce que tu as vraiment fait, les sensations…" onInput={ev => onNote(ev.target.value)} onBlur={() => { clearTimeout(timer.current); jset(k, { note: note || null }); }} /></label>
      </div>
    </section>
  );
}

export function DayView({ k, onNav, onStart, onEdit }) {
  const adv = advice(k);
  return (
    <div class="stack">
      <DayHeader k={k} onNav={onNav} />
      <Morning k={k} key={'m' + k} />
      <Night k={k} key={'n' + k} />
      {adv && <section class="card"><h3 class="h3">Adaptation du jour</h3>
        <div class="adv">{adv.map(([c, t]) => <p class={c}>{t}</p>)}</div>
      </section>}
      <SessionCard k={k} onStart={onStart} onEdit={onEdit} />
      {isTestDay(k) && <Tests k={k} key={'t' + k} />}
      <After k={k} />
    </div>
  );
}
