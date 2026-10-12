import { useEffect, useRef, useState } from 'preact/hooks';
import { jget, jset } from '../lib/store.js';
import { blocks, itemKey, doneN, progress, itemLoad, fingerCalc, target, KIND } from '../lib/plan.js';
import { RPE, STATUS, SIV, rpeCmp } from '../lib/rules.js';
import { mmss, fmtNum, fmtLong } from '../lib/dates.js';
import { unlockAudio, keepAwake, tick, goSignal, restSignal, doneSignal, say } from '../lib/audio.js';
import { Icon, Seg, TextSeg } from '../ui/kit.jsx';
import { Goal } from './DayView.jsx';

function useNow(ms) {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setN(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return n;
}

export function buildSteps(k) {
  const st = [];
  for (const b of blocks(k)) {
    if (b.kind === 'rest') continue;
    const its = b.items || [];
    if (!its.length) { st.push({ b, items: [] }); continue; }
    const grp = b.timer && b.timer.items ? its.filter(x => b.timer.items.includes(x.id)) : null;
    let pushed = false;
    for (const x of its) {
      if (grp && b.timer.items.includes(x.id)) { if (!pushed) { st.push({ b, items: grp, group: true }); pushed = true; } }
      else st.push({ b, items: [x] });
    }
  }
  return st;
}
const stepDone = (k, s) => { const e = jget(k); return s.items.length ? s.items.every(it => doneN(e, itemKey(s.b, it), it.n) >= it.n) : !!(e.done && e.done[s.b.id + '.*']); };
const stepPart = (k, s) => { const e = jget(k); return s.items.some(it => doneN(e, itemKey(s.b, it), it.n) > 0); };

function setDone(k, key, val) {
  const done = Object.assign({}, jget(k).done);
  if (val > 0) done[key] = val; else delete done[key];
  jset(k, { done });
}
function bump(k, b, it, by = 1) { const key = itemKey(b, it), cur = doneN(jget(k), key, it.n); setDone(k, key, Math.min(it.n, cur + by)); }

/* ---------- Repos ---------- */
function RestBar({ rest, onAdd, onSkip }) {
  const now = useNow(200);
  const left = Math.max(0, Math.ceil((rest.until - now) / 1000));
  const last = useRef(null);
  useEffect(() => {
    if (left === last.current) return; last.current = left;
    if (left > 0 && left <= 3) tick();
    if (left <= 0) { doneSignal(); if (rest.say) say(rest.say); const id = setTimeout(onSkip, 1200); return () => clearTimeout(id); }
  }, [left]);
  const pct = Math.max(0, Math.min(1, (rest.until - now) / (rest.total * 1000)));
  return (
    <div class="rest" role="timer" aria-live="off">
      <span class="ring" style={'width:' + (pct * 100) + '%'} />
      <span class="t">{left > 0 ? mmss(left) : 'Go'}</span>
      <span class="l">{left > 0 ? rest.label : 'C’est reparti'}</span>
      <span class="rb">
        <button onClick={() => onAdd(-15)} aria-label="Moins 15 secondes">−15 s</button>
        <button onClick={() => onAdd(15)} aria-label="Plus 15 secondes">+15 s</button>
        <button onClick={onSkip}>Passer</button>
      </span>
    </div>
  );
}

/* ---------- Minuteur à intervalles ---------- */
function buildPhases(spec) {
  const ph = [], sides = spec.sides || [null];
  if (spec.prep) ph.push({ type: 'prep', dur: spec.prep, label: 'Prépare-toi', side: sides[0] });
  for (let s = 0; s < spec.sets; s++) for (let si = 0; si < sides.length; si++) {
    for (let r = 0; r < spec.reps; r++) {
      ph.push({ type: 'work', dur: spec.work, label: spec.workLabel || 'Tire', side: sides[si], si, set: s + 1, rep: r + 1 });
      if (spec.markEach === 'rep') ph.push({ type: 'mark', si, set: s + 1, rep: r + 1 });
      if (r < spec.reps - 1) ph.push({ type: 'rest', dur: spec.rest, label: spec.restLabel || 'Relâche', side: sides[si], si, set: s + 1, rep: r + 1 });
    }
    if (spec.markEach !== 'rep') ph.push({ type: 'mark', si, set: s + 1 });
    const last = s === spec.sets - 1 && si === sides.length - 1;
    if (!last) { const nsi = (si + 1) % sides.length; ph.push({ type: 'setrest', dur: spec.setRest, label: 'Repos', side: sides[nsi], si: nsi, set: nsi === 0 ? s + 2 : s + 1, next: true }); }
  }
  ph.push({ type: 'done', dur: 0, label: 'Terminé' });
  return ph;
}
function IntervalTimer({ spec, title, onMark, onClose }) {
  // Tout est calculé à partir de l'heure de départ : si l'iPhone met l'appli en pause,
  // le minuteur reprend au bon endroit et coche les séries passées entre-temps.
  const plan = useRef(null);
  if (!plan.current) {
    const ph = buildPhases(spec); let t = 0;
    for (const p of ph) { p.at = t * 1000; t += p.dur || 0; }
    plan.current = { ph, total: t * 1000 };
  }
  const { ph: phases, total } = plan.current;
  const [st, setSt] = useState(() => ({ t0: Date.now(), acc: 0, pausedAt: null, skip: 0 }));
  const now = useNow(100);
  const elapsed = Math.max(0, (st.pausedAt || now) - st.t0 - st.acc + st.skip);
  let idx = phases.length - 1;
  for (let i = 0; i < phases.length; i++) { const p = phases[i]; if (p.dur && elapsed < p.at + p.dur * 1000) { idx = i; break; } }
  const ph = phases[idx];
  const left = ph.dur ? Math.max(0, ph.at + ph.dur * 1000 - elapsed) : 0;
  const marked = useRef(-1), entered = useRef(-1), lastTick = useRef(null);
  // cocher les séries terminées (y compris celles passées pendant une mise en veille)
  useEffect(() => {
    for (let j = marked.current + 1; j < idx; j++) if (phases[j].type === 'mark') onMark(phases[j]);
    if (idx - 1 > marked.current) marked.current = idx - 1;
  }, [idx]);
  // signaux à l'entrée d'une phase
  useEffect(() => {
    if (entered.current === idx) return; entered.current = idx;
    if (ph.type === 'work') { goSignal(); if (ph.rep === 1 && ph.side) say(ph.side); }
    else if (ph.type === 'rest') restSignal();
    else if (ph.type === 'setrest') { restSignal(); say('Repos'); }
    else if (ph.type === 'done') { doneSignal(); say('Terminé'); }
  }, [idx]);
  // décompte 3-2-1
  const sec = Math.ceil(left / 1000);
  useEffect(() => {
    if (st.pausedAt || !ph.dur) return;
    const key = idx + ':' + sec; if (lastTick.current === key) return; lastTick.current = key;
    if (sec > 0 && sec <= 3 && ph.dur >= 5) tick();
  }, [sec, idx]);
  const toggle = () => setSt(s => s.pausedAt ? { ...s, acc: s.acc + (Date.now() - s.pausedAt), pausedAt: null } : { ...s, pausedAt: Date.now() });
  const skip = () => setSt(s => ({ ...s, skip: s.skip + Math.max(0, left) + 1 }));
  const cls = ph.type === 'work' ? 'work' : ph.type === 'rest' ? 'rest' : ph.type === 'done' ? 'done' : ph.type === 'prep' ? 'prep' : 'setrest';
  const doneWork = Math.min(total, elapsed) / 1000, totalWork = total / 1000;
  const nextWork = phases.slice(idx + 1).find(p => p.type === 'work');
  return (
    <div class={'tmr ' + cls} role="timer">
      <div class="tmr-top"><span>{title}</span><button onClick={onClose}>{ph.type === 'done' ? 'Fermer' : 'Arrêter'}</button></div>
      <div class="tmr-mid">
        <div class="tmr-ph">{ph.type === 'setrest' ? 'Repos · ensuite ' + (ph.side ? ph.side.toLowerCase() : 'la série suivante') : ph.label}</div>
        <div class="tmr-big">{ph.type === 'done' ? '✓' : (ph.dur >= 60 ? mmss(sec) : sec)}</div>
        {ph.type !== 'done' && <div class="tmr-sub">{ph.side ? ph.side + ' · ' : ''}{ph.set ? 'série ' + ph.set + '/' + spec.sets : ''}{ph.rep ? ' · répétition ' + ph.rep + '/' + spec.reps : ''}</div>}
        {ph.type === 'done' && <div class="tmr-sub">Les séries sont cochées dans la séance.</div>}
      </div>
      <div class="tmr-meta">{st.pausedAt && <span>En pause</span>}{nextWork && ph.type !== 'work' && <span>Ensuite : {(nextWork.side ? nextWork.side.toLowerCase() + ', ' : '') + (spec.workLabel || 'tire').toLowerCase()} {nextWork.dur >= 60 ? mmss(nextWork.dur) : nextWork.dur + ' s'}</span>}</div>
      <div class="tmr-bar"><i style={'width:' + Math.min(100, doneWork / totalWork * 100) + '%'} /></div>
      {ph.type !== 'done' && <div class="tmr-ctl">
        <button onClick={toggle}>{st.pausedAt ? 'Reprendre' : 'Pause'}</button>
        <button onClick={skip}>Passer</button>
      </div>}
    </div>
  );
}

/* ---------- Une étape ---------- */
function LoadStepper({ k, b, it }) {
  const e = jget(k), ld = itemLoad(b, it, e); if (!ld) return null;
  const key = itemKey(b, it);
  const set = v => { const loads = Object.assign({}, jget(k).loads); if (v === it.load) delete loads[key]; else loads[key] = v; jset(k, { loads }); };
  const step = ld.v >= 20 ? 2.5 : 0.5;
  return (
    <div class="stepper">
      <button onClick={() => set(Math.max(0, Math.round((ld.v - step) * 2) / 2))} aria-label="Moins">−</button>
      <div class="v">{ld.text}<small>{ld.changed ? 'modifié · prévu ' + (ld.u === '+kg' ? '+' : '') + fmtNum(it.load) + ' kg' : 'charge prévue'}</small></div>
      <button onClick={() => set(Math.round((ld.v + step) * 2) / 2)} aria-label="Plus">+</button>
    </div>
  );
}

function Pips({ k, b, it, color, onTick }) {
  const key = itemKey(b, it), v = doneN(jget(k), key, it.n);
  return (
    <div class="bigpips" style={'--c:' + color} role="group" aria-label={it.label}>
      {Array.from({ length: it.n }, (_, i) => i + 1).map(i => <button aria-pressed={i <= v ? 'true' : 'false'} aria-label={(it.unit || 'Série') + ' ' + i} onClick={() => { const nv = v === i ? i - 1 : i; setDone(k, key, nv); if (nv > v && onTick) onTick(); }}>{i}</button>)}
    </div>
  );
}

function StepView({ k, step, startRest, openTimer, onNext, isLast }) {
  const { b, items } = step, color = 'var(--k-' + b.kind + ')', e = jget(k);
  const [sub, setSub] = useState({ rep: 0, phase: 'heavy' });
  const sk = b.id + ':' + items.map(x => x.id).join(',');
  useEffect(() => { setSub({ rep: 0, phase: 'heavy' }); }, [k, sk]);
  const it = items[0];
  const fc = b.kind === 'doigts' ? fingerCalc(b, k) : null;
  const nextBtn = <button class="btn big ink" style="margin-top:18px" onClick={onNext}>{isLast ? 'Terminer la séance' : 'Étape suivante'}<Icon name="right" size={20} /></button>;
  const head = <>
    <div class="step-k"><i style={'background:' + color} />{b.title}</div>
    <h2 class="step-t">{step.group ? (b.timer && b.timer.name) || b.title : it ? it.label : b.title}</h2>
    {!step.group && it && it.det && <p class="step-d">{it.det}</p>}
    {(step.group || !it) && b.desc && <p class="step-d">{b.desc}</p>}
    {fc && <div class="calc" style="margin-top:10px">{fc.text}{fc.hint && <><br /><span class="muted">{fc.hint}</span></>}</div>}
    {fc && fc.guard && <div class="guard">{fc.guard}</div>}
  </>;
  if (!it) {
    const key = b.id + '.*', on = !!(e.done && e.done[key]);
    return <div>{head}{on ? <>{nextBtn}<button class="btn ghost" style="margin-top:6px" onClick={() => setDone(k, key, 0)}>Pas fait finalement</button></> : <button class="btn big primary" style="margin-top:20px" onClick={() => setDone(k, key, 1)}>Marquer comme fait</button>}</div>;
  }
  if (step.group) {
    return <div>{head}
      {items.map(x => <div style="margin-top:16px"><div class="sub-lbl" style="margin:0 0 -8px">{x.label} <small>{doneN(e, itemKey(b, x), x.n)}/{x.n}</small></div><Pips k={k} b={b} it={x} color={color} /></div>)}
      {items.every(x => doneN(e, itemKey(b, x), x.n) >= x.n) ? <>{nextBtn}<button class="btn ghost" style="margin-top:6px" onClick={() => openTimer(b.timer, b, items)}>Relancer le minuteur</button></> :
        <button class="btn big primary" style="margin-top:20px" onClick={() => openTimer(b.timer, b, items)}><Icon name="timer" />Lancer le minuteur {b.timer.work}:{b.timer.rest}</button>}
      <p class="small">Le minuteur enchaîne {b.timer.sides ? b.timer.sides.join(' et ').toLowerCase() + ', ' : ''}{b.timer.reps} répétitions de {b.timer.work} s, {b.timer.rest} s de pause, {mmss(b.timer.setRest)} entre les séries, et coche les séries tout seul.</p>
    </div>;
  }
  const key = itemKey(b, it), v = doneN(e, key, it.n), full = v >= it.n;
  const T = it.timer;
  if (it.n === 1) return <div>{head}<LoadStepper k={k} b={b} it={it} />
    {full ? <>{nextBtn}<button class="btn ghost" style="margin-top:6px" onClick={() => setDone(k, key, 0)}>Pas fait finalement</button></> : <button class="btn big primary" style="margin-top:20px" onClick={() => setDone(k, key, 1)}>Marquer comme fait</button>}</div>;
  let action = null;
  if (T && T.kind === 'interval') {
    action = <button class="btn big primary" style="margin-top:18px" onClick={() => openTimer(T, b, [it])}><Icon name="timer" />Lancer le minuteur</button>;
  } else if (T && T.kind === 'cluster') {
    const rep = sub.rep;
    action = <div class="phase-box"><div class="ph">Série {Math.min(it.n, v + 1)}/{it.n} · en clusters</div><div class="pv">Répétition {Math.min(T.reps, rep + 1)}/{T.reps}</div>
      <button class="btn big primary" style="margin-top:12px" disabled={full} onClick={() => {
        if (rep + 1 >= T.reps) { setSub({ rep: 0 }); bump(k, b, it); if (v + 1 < it.n) startRest(T.setRest, 'Repos avant la série ' + (v + 2), 'Série suivante'); }
        else { setSub({ rep: rep + 1 }); startRest(T.intra, 'Pause courte, répétition ' + (rep + 2) + ' ensuite'); }
      }}>Répétition faite</button></div>;
  } else if (T && T.kind === 'contrast') {
    const heavy = sub.phase !== 'light';
    action = <div class="phase-box"><div class="ph">Contraste {Math.min(it.n, v + 1)}/{it.n}</div><div class="pv">{heavy ? 'Série lourde' : 'Série explosive'}</div>
      <button class="btn big primary" style="margin-top:12px" disabled={full} onClick={() => {
        if (heavy) { setSub({ phase: 'light' }); startRest(T.heavyRest, 'Repos avant la série explosive', 'Explosive'); }
        else { setSub({ phase: 'heavy' }); bump(k, b, it); if (v + 1 < it.n) startRest(T.lightRest, 'Repos avant le contraste suivant', 'Série lourde'); }
      }}>{heavy ? 'Lourde faite' : 'Explosive faite'}</button></div>;
  } else {
    action = <button class="btn big primary" style="margin-top:18px" disabled={full} onClick={() => { bump(k, b, it); if (it.rest && v + 1 < it.n) startRest(it.rest, 'Repos · ' + (it.unit === 'Bloc' ? 'bloc ' : it.unit === 'Essai' ? 'essai ' : 'série ') + (v + 2) + ' ensuite'); }}>
      {full ? 'Tout est fait ✓' : (it.unit === 'Bloc' ? 'Bloc fait' : it.unit === 'Essai' ? 'Essai fait' : 'Série faite') + ' · ' + (v + 1) + '/' + it.n}</button>;
  }
  return <div>{head}<LoadStepper k={k} b={b} it={it} />
    <Pips k={k} b={b} it={it} color={color} onTick={() => { if (it.rest && !T) startRest(it.rest, 'Repos'); }} />
    {full ? nextBtn : action}
    {!full && it.rest && !T && <p class="small">{mmss(it.rest)} de repos se lancent tout seuls après chaque {it.unit === 'Bloc' ? 'bloc' : it.unit === 'Essai' ? 'essai' : 'série'}.</p>}
  </div>;
}

/* ---------- Fin de séance ---------- */
function Finish({ k, minutes, onSave, onBack }) {
  const e = jget(k), tg = target(k), pr = progress(k);
  const [dur, setDur] = useState(String(minutes));
  const [status, setStatus] = useState(e.status || (pr.total && pr.done === pr.total ? 'faite' : 'adaptee'));
  const cmp = rpeCmp(tg, e.rpe);
  const setSiv = (key, v) => { const s = Object.assign({}, jget(k).siv); if (v == null) delete s[key]; else s[key] = v; jset(k, { siv: s }); };
  return (
    <div class="stack">
      <h2 class="h2" style="font-size:30px">Fin de séance</h2>
      <p class="lead" style="margin:0">{pr.done}/{pr.total} exercices faits. Le ressenti se note idéalement 30 min après : tu peux aussi le remplir plus tard dans la fiche du jour.</p>
      <TextSeg value={status} onChange={v => setStatus(v || status)} options={STATUS} label="Statut" />
      <label class="fld">Durée totale (min)<input class="in mono" inputmode="numeric" value={dur} onInput={ev => setDur(ev.target.value)} /></label>
      <div>
        <Seg value={e.rpe} onChange={v => jset(k, { rpe: v })} from={0} to={10} dense tgt={tg ? i => i >= tg.rpe[0] && i <= tg.rpe[1] : null} label="Ressenti" />
        <div class="rpe-lbl">{typeof e.rpe === 'number' ? <>Ressenti <b>{e.rpe}/10 · {RPE[e.rpe]}</b></> : 'Ressenti global de 0 à 10' + (tg ? ' · en bleu, la zone visée' : '')}</div>
        {cmp && <p class={'cmp ' + cmp.cls}>{cmp.text}</p>}
      </div>
      {SIV.map(([key, l, q]) => <div><p class="sub-lbl">{l}<small>{q}</small></p><Seg value={e.siv && e.siv[key]} onChange={v => setSiv(key, v)} from={0} to={10} dense tgt={tg ? i => tg[key] === i : null} label={l} /></div>)}
      <div class="row-btns" style="margin-top:6px">
        <button class="btn big" style="flex:1" onClick={onBack}>Retour</button>
        <button class="btn big primary" style="flex:2" onClick={() => onSave(Math.max(0, parseInt(dur, 10) || 0), status)}>Enregistrer</button>
      </div>
    </div>
  );
}

/* ---------- Mode séance ---------- */
export function SessionMode({ k, onClose }) {
  const steps = buildSteps(k);
  const [i, setI] = useState(() => { const f = steps.findIndex(s => !stepDone(k, s)); return f < 0 ? 0 : f; });
  const [rest, setRest] = useState(null);
  const [timer, setTimer] = useState(null);
  const [finish, setFinish] = useState(false);
  const now = useNow(1000);
  useEffect(() => {
    unlockAudio(); keepAwake(true);
    const e = jget(k); if (!e.startedAt || e.endedAt) jset(k, { startedAt: Date.now(), endedAt: null });
    return () => keepAwake(false);
  }, []);
  const e = jget(k), started = e.startedAt || now, pr = progress(k);
  const startRest = (sec, label, sayText) => setRest({ until: Date.now() + sec * 1000, total: sec, label, say: sayText });
  const step = steps[i];
  const openTimer = (spec, b, items) => setTimer({ spec, b, items });
  const onMark = ph => {
    const t = timer; if (!t) return;
    const it = t.items.length > 1 ? t.items[ph.si] : t.items[0];
    if (it) bump(k, t.b, it);
  };
  const save = (minutes, status) => { jset(k, { duree: minutes || null, status, endedAt: Date.now() }); keepAwake(false); onClose(); };
  return (
    <div class="ses" role="dialog" aria-label="Mode séance">
      <div class="ses-top">
        <button class="icon-btn" aria-label="Fermer le mode séance" onClick={onClose}><Icon name="close" /></button>
        <div class="mid"><b>{fmtLong(k)}</b><span>{mmss((now - started) / 1000)} · {pr.done}/{pr.total} fait</span></div>
        <button class="btn" onClick={() => setFinish(true)}>Terminer</button>
      </div>
      <div class="ses-prog"><i style={'width:' + (pr.total ? pr.done / pr.total * 100 : 0) + '%'} /></div>
      <div class="ses-body" style={rest && !timer && !finish ? "padding-bottom:200px" : ""}>
        {finish ? <Finish k={k} minutes={Math.max(1, Math.round((now - started) / 60000 / 5) * 5)} onSave={save} onBack={() => setFinish(false)} /> : <>
          {i === 0 && <div style="margin-bottom:16px"><Goal k={k} /></div>}
          {step ? <StepView k={k} step={step} startRest={startRest} openTimer={openTimer} isLast={i === steps.length - 1} onNext={() => { setRest(null); if (i < steps.length - 1) { setI(i + 1); document.querySelector('.ses-body') && (document.querySelector('.ses-body').scrollTop = 0); } else setFinish(true); }} /> : <p>Rien à faire aujourd’hui.</p>}
          <div class="steps-list" aria-label="Étapes">
            {steps.map((s, j) => {
              const d = stepDone(k, s), p = !d && stepPart(k, s);
              return <button aria-current={j === i ? 'step' : undefined} onClick={() => setI(j)}><span class={'dot' + (d ? ' on' : p ? ' part' : '')}>{d ? '✓' : ''}</span><span style="flex:1;min-width:0">{s.group ? (s.b.timer.name || s.b.title) : s.items[0] ? s.items[0].label : s.b.title}<br /><small class="muted">{KIND[s.b.kind] || s.b.title}</small></span></button>;
            })}
          </div>
        </>}
      </div>
      {!finish && <div class="ses-foot">
        <button class="btn" disabled={i === 0} onClick={() => setI(i - 1)}>Précédent</button>
        {i < steps.length - 1 ? <button class="btn primary" onClick={() => setI(i + 1)}>Étape suivante</button> : <button class="btn primary" onClick={() => setFinish(true)}>Terminer</button>}
      </div>}
      {rest && !timer && !finish && <RestBar rest={rest} onAdd={d => setRest(r => ({ ...r, until: r.until + d * 1000, total: Math.max(1, r.total + d) }))} onSkip={() => setRest(null)} />}
      {timer && <IntervalTimer spec={timer.spec} title={timer.spec.name || timer.b.title} onMark={onMark} onClose={() => setTimer(null)} />}
    </div>
  );
}
