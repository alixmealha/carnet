import { useEffect, useRef, useState } from 'preact/hooks';
import { jget, jset } from '../lib/store.js';
import { blocks, itemKey, doneN, progress, itemLoad, fingerCalc, target, KIND, setDoneCount, setLoadsOf, setsText } from '../lib/plan.js';
import { RPE, STATUS, rpeCmp } from '../lib/rules.js';
import { ActFields } from '../ui/ActFields.jsx';
import { mmss, fmtNum, fmtLong } from '../lib/dates.js';
import { unlockAudio, keepAwake, tick, goSignal, restSignal, doneSignal, say } from '../lib/audio.js';
import { Icon, Seg, TextSeg, Rich } from '../ui/kit.jsx';
import { Goal } from './DayView.jsx';
import { lastPerf, perfText, suggestLoad, applySuggested } from '../lib/history.js';
import { LIB_BY_ID } from '../lib/library.js';

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
    // Bloc fait d'éléments simples (échauffement, consignes) : une seule étape en liste à cocher
    if (its.length > 1 && its.every(x => x.n === 1 && !x.rest && !x.timer && x.load == null) && !b.timer) { st.push({ b, items: its, list: true }); continue; }
    const grp = b.timer && b.timer.items ? its.filter(x => b.timer.items.includes(x.id)) : null;
    let pushed = false;
    for (const x of its) {
      if (grp && b.timer.items.includes(x.id)) { if (!pushed) { st.push({ b, items: grp, group: true }); pushed = true; } continue; }
      // exercice à faire en alternance avec le précédent (ex. pince entre les séries de tractions)
      const prev = st[st.length - 1];
      // (pas avec un exercice qui a son propre minuteur, ex. clusters : il reste alors une étape à part)
      if (x.superset && prev && prev.b === b && prev.items.length === 1 && !prev.list && !prev.group && prev.items[0].id === x.superset && !prev.items[0].timer && !x.timer && prev.items[0].n > 1) { prev.items.push(x); prev.pair = true; continue; }
      st.push({ b, items: [x] });
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
function bump(k, b, it, by = 1) { const key = itemKey(b, it), cur = doneN(jget(k), key, it.n); setDoneCount(k, b, it, Math.min(it.n, cur + by)); }

/* ---------- Repos ---------- */
function RestBar({ rest, onAdd, onSkip }) {
  const now = useNow(200);
  const left = Math.max(0, Math.ceil((rest.until - now) / 1000));
  const last = useRef(null);
  useEffect(() => { if (rest.hold) goSignal(); }, [rest.until - rest.total * 1000]);
  useEffect(() => {
    if (left === last.current) return; last.current = left;
    if (left > 0 && left <= 3) tick();
    if (left <= 0) { doneSignal(); if (rest.say) say(rest.say); const id = setTimeout(onSkip, rest.hold ? 400 : 1200); return () => clearTimeout(id); }
  }, [left]);
  const pct = Math.max(0, Math.min(1, (rest.until - now) / (rest.total * 1000)));
  return (
    <div class={'rest' + (rest.hold ? ' hold-t' : '')} role="timer" aria-live="off">
      <span class="ring" style={'width:' + (pct * 100) + '%'} />
      <span class="t">{left > 0 ? mmss(left) : rest.hold ? 'Lâche' : 'Go'}</span>
      <span class="l">{left > 0 ? rest.label : rest.hold ? 'Terminé' : 'C’est reparti'}</span>
      <span class="rb">
        {!rest.hold && <button onClick={() => onAdd(-15)} aria-label="Moins 15 secondes">−15 s</button>}
        {!rest.hold && <button onClick={() => onAdd(15)} aria-label="Plus 15 secondes">+15 s</button>}
        <button onClick={onSkip}>{rest.hold ? 'Fini' : 'Passer'}</button>
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
// Tempo : mise en place, puis pour chaque répétition excentrique et retour ; en unilatéral, changement de bras entre les côtés
export function buildTempoPhases(spec) {
  const ph = [], sides = spec.sides && spec.sides.length ? spec.sides : [null], sets = Math.max(1, spec.sets || 1);
  for (let s = 0; s < sets; s++) {
    sides.forEach((side, si) => {
      if (spec.prep) ph.push({ type: 'prep', dur: spec.prep, label: 'Mise en place', side, si, set: s + 1 });
      for (let r = 1; r <= spec.reps; r++) {
        ph.push({ type: 'ecc', dur: spec.ecc, label: 'Excentrique · descends', side, si, set: s + 1, rep: r });
        if (spec.ret && r < spec.reps) ph.push({ type: 'ret', dur: spec.ret, label: 'Retour · remets-toi en place', side, si, set: s + 1, rep: r });
      }
      if (si < sides.length - 1) ph.push({ type: 'sw', dur: spec.sideRest || 10, label: 'Change de bras', side: sides[si + 1], si: si + 1, set: s + 1 });
    });
    ph.push({ type: 'mark', set: s + 1 });
    if (s < sets - 1) ph.push({ type: 'setrest', dur: spec.setRest || 60, label: 'Repos', side: sides[0], si: 0, set: s + 2, next: true });
  }
  ph.push({ type: 'done', dur: 0, label: 'Terminé' });
  return ph;
}
const TEMPO_NEXT = { ecc: 'excentrique', ret: 'retour', sw: 'changement de bras', setrest: 'repos', prep: 'mise en place' };
function IntervalTimer({ spec, title, onMark, onClose }) {
  // Tout est calculé à partir de l'heure de départ : si l'iPhone met l'appli en pause,
  // le minuteur reprend au bon endroit et coche les séries passées entre-temps.
  const plan = useRef(null), tempo = spec.kind === 'tempo';
  if (!plan.current) {
    const ph = tempo ? buildTempoPhases(spec) : buildPhases(spec); let t = 0;
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
    if (ph.type === 'work' || ph.type === 'ecc') { goSignal(); if (ph.type === 'work' && ph.rep === 1 && ph.side) say(ph.side); }
    else if (ph.type === 'rest' || ph.type === 'ret') restSignal();
    else if (ph.type === 'prep' && tempo && ph.side) say(ph.side);
    else if (ph.type === 'sw') { restSignal(); say('Change de bras'); }
    else if (ph.type === 'setrest') { restSignal(); say('Repos'); }
    else if (ph.type === 'done') { doneSignal(); say('Terminé'); }
  }, [idx]);
  // décompte 3-2-1 ; en tempo, un bip par seconde pendant l'excentrique pour tenir le rythme
  const sec = Math.ceil(left / 1000);
  useEffect(() => {
    if (st.pausedAt || !ph.dur) return;
    const key = idx + ':' + sec; if (lastTick.current === key) return; lastTick.current = key;
    if (ph.type === 'ecc' ? sec > 0 && sec < ph.dur : sec > 0 && sec <= 3 && ph.dur >= 5) tick();
  }, [sec, idx]);
  const toggle = () => setSt(s => s.pausedAt ? { ...s, acc: s.acc + (Date.now() - s.pausedAt), pausedAt: null } : { ...s, pausedAt: Date.now() });
  const skip = () => setSt(s => ({ ...s, skip: s.skip + Math.max(0, left) + 1 }));
  if (tempo) return <TempoView spec={spec} title={title} ph={ph} phases={phases} idx={idx} left={left} sec={sec} paused={!!st.pausedAt} frac={Math.min(1, elapsed / total)} onToggle={toggle} onSkip={skip} onClose={onClose} />;
  const cls = ph.type === 'work' ? 'work' : ph.type === 'rest' ? 'pause' : ph.type === 'done' ? 'done' : ph.type === 'prep' ? 'prep' : 'setrest';
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

// Écran du minuteur tempo : phase, secondes, répétitions faites, bande excentrique / retour
function TempoView({ spec, title, ph, phases, idx, left, sec, paused, frac, onToggle, onSkip, onClose }) {
  const cls = { ecc: 'work', ret: 'pause', prep: 'prep', sw: 'sw', setrest: 'setrest', done: 'done' }[ph.type] || 'prep';
  const doneReps = ph.type === 'ecc' ? ph.rep - 1 : ph.type === 'ret' ? ph.rep : ph.type === 'sw' ? spec.reps : 0; // la dernière excentrique n'a pas de retour
  const f = ph.dur ? 1 - left / (ph.dur * 1000) : 0;
  const nx = phases.slice(idx + 1).find(p => p.dur);
  const nxt = !nx ? 'Ensuite : fin' : nx.type === 'prep' && nx.side ? 'Ensuite : ' + nx.side.toLowerCase() : 'Ensuite : ' + TEMPO_NEXT[nx.type] + ' ' + (nx.dur >= 60 ? mmss(nx.dur) : nx.dur + ' s');
  const sets = Math.max(1, spec.sets || 1);
  return (
    <div class={'tmr tempo ' + cls} role="timer">
      <div class="tmr-top"><span>{title}</span><button onClick={onClose}>{ph.type === 'done' ? 'Fermer' : 'Arrêter'}</button></div>
      <div class="tmr-mid">
        <div class="tmr-ph">{ph.type === 'setrest' ? 'Repos · ensuite la série ' + ph.set : ph.label}</div>
        <div class="tmr-big">{ph.type === 'done' ? '✓' : (ph.dur >= 60 ? mmss(sec) : sec)}</div>
        <div class="tmr-sub">{ph.type === 'done' ? 'Les séries sont cochées dans la séance.' : ph.type === 'sw' ? 'Ensuite : ' + (ph.side || 'autre côté').toLowerCase() : [ph.side, 'série ' + ph.set + '/' + sets, ph.rep ? 'rép. ' + ph.rep + '/' + spec.reps : null].filter(Boolean).join(' · ')}</div>
        {!['done', 'setrest'].includes(ph.type) && <div class="tp-dots" aria-label={doneReps + ' répétitions faites sur ' + spec.reps}>{Array.from({ length: spec.reps }, (_, i) => <i class={i < doneReps ? 'on' : ''} />)}</div>}
      </div>
      <div class="tmr-meta">{paused && <span>En pause</span>}{ph.type !== 'done' && <span>{nxt}</span>}</div>
      {ph.type !== 'done' && <>
        <div class="tp-strip"><div style={'flex:' + spec.ecc}><i style={'width:' + (ph.type === 'ecc' ? f * 100 : ph.type === 'ret' ? 100 : 0) + '%'} /></div>{spec.ret > 0 && <div style={'flex:' + spec.ret}><i style={'width:' + (ph.type === 'ret' ? f * 100 : 0) + '%'} /></div>}</div>
        <div class="tp-lbl"><span>excentrique {spec.ecc} s</span>{spec.ret > 0 && <span>retour {spec.ret} s</span>}</div>
      </>}
      <div class="tmr-bar"><i style={'width:' + frac * 100 + '%'} /></div>
      {ph.type !== 'done' && <div class="tmr-ctl">
        <button onClick={onToggle}>{paused ? 'Reprendre' : 'Pause'}</button>
        <button onClick={onSkip}>Passer</button>
      </div>}
    </div>
  );
}
export const tempoText = T => 'Tempo : ' + (T.prep ? T.prep + ' s de mise en place, ' : '') + T.ecc + ' s d’excentrique' + (T.ret ? ', ' + T.ret + ' s de retour' : '') + ', ' + T.reps + ' rép.' + (T.sides && T.sides.length > 1 ? ' par côté, ' + (T.sideRest || 10) + ' s pour changer de côté' : '') + '.';

/* ---------- Une étape ---------- */
const STRENGTH = ['muscu', 'renfo', 'doigts', 'epaule'];
function LoadStepper({ k, b, it }) {
  const e = jget(k), ld = itemLoad(b, it, e), key = itemKey(b, it);
  const sug = STRENGTH.includes(b.kind) ? suggestLoad(b, it, k) : null;
  const [own, setOwn] = useState('');
  if (!ld) {
    const x = it.lib && LIB_BY_ID[it.lib];
    if (!STRENGTH.includes(b.kind) || it.id === 'ech' || it.timer && it.unit_load !== '+kg' || x && (x.t === 'iso' || x.t === 'mob' || (x.ld === 'bw' && !it.unit_load))) return null;
    const commit = () => { const n = parseFloat(String(own).replace(',', '.')); if (!isNaN(n)) { const loads = Object.assign({}, jget(k).loads, { [key]: n }); jset(k, { loads }); } };
    return <div class="sug">
      {sug ? <><div><small>Charge conseillée</small><b>{sug.text}</b><span>{sug.why}</span></div><button class="btn primary" onClick={() => applySuggested(k, b, it, sug)}>Utiliser</button></>
        : <div><small>Charge du jour</small><span>{it.rx ? 'Première fois : prends une charge qui respecte la fourchette et la réserve visées.' : 'Note la charge pour suivre ta progression.'}</span></div>}
      <label class="fld sug-in">{sug ? 'Autre' : it.unit_load === '+kg' ? 'Lest (kg)' : 'Charge (kg)'}<input class="in mono" inputmode="decimal" value={own} onInput={ev => setOwn(ev.target.value)} onBlur={commit} /></label>
    </div>;
  }
  const set = v => { const loads = Object.assign({}, jget(k).loads); if (v === it.load) delete loads[key]; else loads[key] = v; jset(k, { loads }); };
  const step = Math.abs(ld.v) >= 20 ? 2.5 : 0.5, done = doneN(e, key, it.n), sl = setLoadsOf(e, key);
  const showSug = sug && it.load != null && sug.v !== ld.v && !ld.changed;
  return (
    <>
      <div class="stepper">
        <button onClick={() => set(Math.round((ld.v - step) * 2) / 2)} aria-label="Moins">−</button>
        <div class="v">{ld.text}<small>{ld.changed ? 'modifié · prévu ' + (ld.u === '+kg' ? '+' : '') + fmtNum(it.load) + ' kg' : ld.chosen ? 'charge du jour' : 'charge prévue'}</small></div>
        <button onClick={() => set(Math.round((ld.v + step) * 2) / 2)} aria-label="Plus">+</button>
      </div>
      {done > 0 && sl && <p class="set-l">Séries faites : {setsText(sl, ld.u)}{sl[sl.length - 1] !== ld.v ? ' · la suivante à ' + ld.text : ''}</p>}
      {showSug && <div class="sug"><div><small>Conseillé d’après ta dernière séance</small><b>{sug.text}</b><span>{sug.why}</span></div><button class="btn" onClick={() => applySuggested(k, b, it, sug)}>Utiliser</button></div>}
    </>
  );
}
// Dernière réalisation du même exercice
function LastTime({ k, it }) {
  const lp = lastPerf(it.label, k, it.lib);
  return lp ? <p class="last-t">Dernière fois · {perfText(lp)}</p> : null;
}
// Réserve sur la dernière série : règle la progression de la séance suivante
const RIRL = ['0 · échec', '1', '2', '3', '4 et +'];
function Reserve({ k, b, it }) {
  const key = itemKey(b, it), e = jget(k), v = e.rir && typeof e.rir[key] === 'number' ? e.rir[key] : null;
  const set = x => { const r = Object.assign({}, jget(k).rir); if (x == null) delete r[key]; else r[key] = x; jset(k, { rir: Object.keys(r).length ? r : null }); };
  return <div class="rir-box">
    <p class="sub-lbl" style="margin:0 0 6px">Réserve sur la dernière série<small>combien de répétitions de plus tu aurais pu faire{it.rx && typeof it.rx.rir === 'number' ? ' · visée ' + it.rx.rir : ''}</small></p>
    <Seg value={v} onChange={set} from={0} to={4} dense label="Réserve" labels={RIRL} tgt={it.rx && typeof it.rx.rir === 'number' ? i => i === Math.min(4, it.rx.rir) : null} />
  </div>;
}

function Pips({ k, b, it, color, onTick }) {
  const key = itemKey(b, it), v = doneN(jget(k), key, it.n);
  return (
    <div class="bigpips" style={'--c:' + color} role="group" aria-label={it.label}>
      {Array.from({ length: it.n }, (_, i) => i + 1).map(i => <button aria-pressed={i <= v ? 'true' : 'false'} aria-label={(it.unit || 'Série') + ' ' + i} onClick={() => { const nv = v === i ? i - 1 : i; setDoneCount(k, b, it, nv); if (nv > v && onTick) onTick(nv); }}>{i}</button>)}
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
  const ttl = step.pair ? items.map(x => x.label).join(' + ') : step.group ? (b.timer && b.timer.name) || b.title : step.list || !it ? b.title : it.label;
  const head = <>
    <div class="step-k"><i style={'background:' + color} /><Rich text={b.title} /></div>
    <h2 class={'step-t' + (String(ttl).length > 34 ? ' long' : '')}><Rich text={ttl} /></h2>
    {!step.group && !step.list && !step.pair && it && it.det && <p class="step-d"><Rich text={it.det} /></p>}
    {!step.group && !step.list && !step.pair && it && STRENGTH.includes(b.kind) && it.id !== 'ech' && <LastTime k={k} it={it} />}
    {(step.group || step.list || !it) && b.desc && <p class="step-d"><Rich text={b.desc} /></p>}
    {fc && <div class="calc" style="margin-top:10px">{fc.text}{fc.hint && <><br /><span class="muted">{fc.hint}</span></>}</div>}
    {fc && fc.guard && <div class="guard">{fc.guard}</div>}
  </>;
  if (!it) {
    const key = b.id + '.*', on = !!(e.done && e.done[key]);
    return <div>{head}{on ? <>{nextBtn}<button class="btn ghost" style="margin-top:6px" onClick={() => setDone(k, key, 0)}>Pas fait finalement</button></> : <button class="btn big primary" style="margin-top:20px" onClick={() => setDone(k, key, 1)}>Marquer comme fait</button>}</div>;
  }
  if (step.list) {
    const all = items.every(x => doneN(e, itemKey(b, x), 1) >= 1);
    return <div>{head}
      <div class="items" style="margin-top:16px">{items.map(x => { const on = doneN(e, itemKey(b, x), 1) >= 1; return (
        <button type="button" class={'it chk-row' + (on ? ' done' : '')} onClick={() => setDoneCount(k, b, x, on ? 0 : 1)}>
          <span class="ck" aria-pressed={on ? 'true' : 'false'}>✓</span>
          <span class="it-txt"><b><i class="lt" style="font-style:normal"><Rich text={x.label} /></i></b>{x.det && <span><Rich text={x.det} /></span>}</span>
        </button>); })}</div>
      {all ? nextBtn : <button class="btn big primary" style="margin-top:18px" onClick={() => { const done = Object.assign({}, jget(k).done); for (const x of items) done[itemKey(b, x)] = 1; jset(k, { done }); }}>Tout est fait</button>}
      {b.sub && <p class="small"><Rich text={b.sub} /></p>}
    </div>;
  }
  if (step.group) {
    return <div>{head}
      {items.map(x => <div style="margin-top:16px"><div class="sub-lbl" style="margin:0 0 -8px">{x.label} <small>{doneN(e, itemKey(b, x), x.n)}/{x.n}</small></div><Pips k={k} b={b} it={x} color={color} /></div>)}
      {items.every(x => doneN(e, itemKey(b, x), x.n) >= x.n) ? <>{nextBtn}<button class="btn ghost" style="margin-top:6px" onClick={() => openTimer(b.timer, b, items)}>Relancer le minuteur</button></> :
        <button class="btn big primary" style="margin-top:20px" onClick={() => openTimer(b.timer, b, items)}><Icon name="timer" />Lancer le minuteur {b.timer.work}:{b.timer.rest}</button>}
      <p class="small">Le minuteur enchaîne {b.timer.sides ? b.timer.sides.join(' et ').toLowerCase() + ', ' : ''}{b.timer.reps} répétitions de {b.timer.work} s, {b.timer.rest} s de pause, {mmss(b.timer.setRest)} entre les séries, et coche les séries tout seul.</p>
    </div>;
  }
  if (step.pair) return <PairStep k={k} step={step} head={head} color={color} startRest={startRest} nextBtn={nextBtn} />;
  const key = itemKey(b, it), v = doneN(e, key, it.n), full = v >= it.n;
  const T = it.timer;
  if (it.n === 1) return <div>{head}<LoadStepper k={k} b={b} it={it} />
    {full ? <>{nextBtn}<button class="btn ghost" style="margin-top:6px" onClick={() => setDoneCount(k, b, it, 0)}>Pas fait finalement</button></> : <button class="btn big primary" style="margin-top:20px" onClick={() => setDoneCount(k, b, it, 1)}>Marquer comme fait</button>}</div>;
  let action = null;
  if (T && T.kind === 'interval') {
    action = <button class="btn big primary" style="margin-top:18px" onClick={() => openTimer(T, b, [it])}><Icon name="timer" />Lancer le minuteur</button>;
  } else if (T && T.kind === 'tempo') {
    const spec = tempoSpec(T, it, v);
    action = <><button class="btn big primary" style="margin-top:18px" disabled={full} onClick={() => openTimer(spec, b, [it])}><Icon name="timer" />Lancer le minuteur tempo</button>
      <p class="small">{tempoText(spec)} {spec.sets > 1 ? mmss(spec.setRest) + ' de repos entre les séries. ' : ''}Les séries se cochent toutes seules.</p></>;
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
  const askRir = full && STRENGTH.includes(b.kind) && it.unit !== 'Bloc' && it.unit !== 'Essai' && !(T && T.kind === 'interval');
  return <div>{head}<LoadStepper k={k} b={b} it={it} />
    <Pips k={k} b={b} it={it} color={color} onTick={nv => { if (it.rest && !T && nv < it.n) startRest(it.rest, 'Repos'); }} />
    {b.sub && <p class="small" style="margin-top:12px"><Rich text={b.sub} /></p>}
    {askRir && <Reserve k={k} b={b} it={it} />}
    {full ? nextBtn : action}
    {!full && it.rest && !T && <p class="small">{mmss(it.rest)} de repos se lancent tout seuls après chaque {it.unit === 'Bloc' ? 'bloc' : it.unit === 'Essai' ? 'essai' : 'série'}.</p>}
  </div>;
}

// Réglages du minuteur tempo pour les séries qui restent
export function tempoSpec(T, it, v = 0) {
  return { ...T, kind: 'tempo', name: it.label, sets: Math.max(1, it.n - v), reps: T.reps || it.reps || 8, ecc: T.ecc || 6, ret: T.ret != null ? T.ret : 4, prep: T.prep != null ? T.prep : 5, sideRest: T.sideRest || 10, setRest: T.setRest != null ? T.setRest : it.rest || 60 };
}

// Deux exercices en alternance : A, repos court, B (tenue chronométrée si prévue), repos, A…
// La phase se déduit des séries cochées : tant que B a moins de séries que A, c'est au tour de B.
function PairStep({ k, step, head, color, startRest, nextBtn }) {
  const { b, items } = step, [A, B] = items, e = jget(k);
  const vA = doneN(e, itemKey(b, A), A.n), vB = doneN(e, itemKey(b, B), B.n);
  const fullA = vA >= A.n, fullB = vB >= B.n, all = fullA && fullB;
  const turnB = !fullB && (vB < vA || fullA);
  const restA = A.pairRest || 60, restB = B.rest || 90;
  const doneB = () => { const cur = doneN(jget(k), itemKey(b, B), B.n); setDoneCount(k, b, B, Math.min(B.n, cur + 1)); if (doneN(jget(k), itemKey(b, A), A.n) < A.n) startRest(restB, 'Repos · ' + A.label.toLowerCase() + ' ensuite', A.label); };
  const doA = () => { bump(k, b, A); startRest(fullB ? (A.rest || 120) : restA, fullB ? 'Repos' : 'Repos · ' + B.label.toLowerCase() + ' ensuite', fullB ? null : B.label); };
  const lab = x => x.unit === 'Bloc' ? 'Bloc fait' : 'Série faite';
  return <div>{head}
    <div class="pair">
      {[A, B].map((x, j) => { const on = j === 0 ? !turnB && !fullA : turnB;
        // l'exercice qui n'est pas en cours reste replié : le bouton de la série reste visible sans défiler
        if (!on) { const ld = itemLoad(b, x, e), sl = setLoadsOf(e, itemKey(b, x)), dn = doneN(e, itemKey(b, x), x.n); return (
          <div class="pair-it mini"><div class="sub-lbl" style="margin:0"><span class="pair-n">{j ? 'B' : 'A'}</span><Rich text={x.label} /> <small>{dn}/{x.n}{dn > 0 && sl ? ' · ' + setsText(sl, ld ? ld.u : 'kg') : ld ? ' · ' + ld.text : ''}{x.hold ? ' · ' + x.hold + ' s' : ''}</small></div></div>); }
        return (
        <div class={'pair-it' + (on ? ' on' : '')}>
          <div class="sub-lbl" style="margin:0"><span class="pair-n">{j ? 'B' : 'A'}</span><Rich text={x.label} /> <small>{doneN(e, itemKey(b, x), x.n)}/{x.n}</small></div>
          {x.det && <p class="step-d" style="margin:4px 0 0"><Rich text={x.det} /></p>}
          {j === 0 && STRENGTH.includes(b.kind) && <LastTime k={k} it={x} />}
          <LoadStepper k={k} b={b} it={x} />
          <Pips k={k} b={b} it={x} color={color} />
        </div>); })}
    </div>
    {fullA && STRENGTH.includes(b.kind) && <Reserve k={k} b={b} it={A} />}
    {all ? nextBtn : turnB ? <>
      {B.hold ? <button class="btn big primary" style="margin-top:18px" onClick={() => startRest(B.hold, 'Tiens · ' + B.label.toLowerCase(), null, { hold: true, then: doneB })}><Icon name="timer" />Lancer {B.label.toLowerCase()} · {B.hold} s</button> : null}
      <button class={'btn big' + (B.hold ? '' : ' primary')} style={B.hold ? 'margin-top:8px' : 'margin-top:18px'} onClick={doneB}>{B.label} faite{B.n > 1 ? ' · ' + (vB + 1) + '/' + B.n : ''}</button>
    </> : <button class="btn big primary" style="margin-top:18px" onClick={doA}>{lab(A)} · {A.label.toLowerCase()} {vA + 1}/{A.n}</button>}
    <p class="small">En alternance : {A.label.toLowerCase()}, {mmss(restA)} de repos, {B.label.toLowerCase()}{B.hold ? ' (' + B.hold + ' s)' : ''}, puis {mmss(restB)} avant la série suivante. Les repos se lancent tout seuls.</p>
  </div>;
}

/* ---------- Fin de séance ---------- */
function Finish({ k, minutes, onSave, onBack }) {
  const e = jget(k), tg = target(k), pr = progress(k);
  const [dur, setDur] = useState(String(minutes));
  const [status, setStatus] = useState(e.status || (pr.total && pr.done === pr.total ? 'faite' : 'adaptee'));
  const cmp = rpeCmp(tg, e.rpe);
  return (
    <div class="stack">
      <h2 class="h2" style="font-size:30px">Fin de séance</h2>
      <p class="lead" style="margin:0">{pr.done}/{pr.total} exercices faits. Le ressenti se note idéalement 30 min après : tu peux aussi le remplir plus tard dans la fiche du jour.</p>
      <TextSeg value={status} onChange={v => setStatus(v || status)} options={STATUS} label="Statut" />
      <label class="fld">Durée totale (min)<input class="in mono" inputmode="numeric" value={dur} onInput={ev => setDur(ev.target.value)} /></label>
      <div>
        <Seg value={e.rpe} onChange={v => jset(k, { rpe: v })} from={0} to={10} dense tgt={tg && tg.rpe ? i => i >= tg.rpe[0] && i <= tg.rpe[1] : null} label="Ressenti" />
        <div class="rpe-lbl">{typeof e.rpe === 'number' ? <>Ressenti <b>{e.rpe}/10 · {RPE[e.rpe]}</b></> : 'Ressenti global de 0 à 10' + (tg ? ' · en bleu, la zone visée' : '')}</div>
        {cmp && <p class={'cmp ' + cmp.cls}>{cmp.text}</p>}
      </div>
      <ActFields k={k} />
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
  const startRest = (sec, label, sayText, opt) => setRest({ until: Date.now() + sec * 1000, total: sec, label, say: sayText, ...(opt || {}) });
  const endRest = () => { const r = rest; setRest(null); if (r && r.then) r.then(); };
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
              return <button aria-current={j === i ? 'step' : undefined} onClick={() => setI(j)}><span class={'dot' + (d ? ' on' : p ? ' part' : '')}>{d ? '✓' : ''}</span><span style="flex:1;min-width:0"><Rich text={s.group ? (s.b.timer.name || s.b.title) : s.list ? s.b.title : s.pair ? s.items.map(x => x.label).join(' + ') : s.items[0] ? s.items[0].label : s.b.title} /><br /><small class="muted">{s.list ? s.items.length + ' éléments' : (KIND[s.b.kind] || s.b.title)}</small></span></button>;
            })}
          </div>
        </>}
      </div>
      {!finish && <div class="ses-foot">
        <button class="btn" disabled={i === 0} onClick={() => setI(i - 1)}>Précédent</button>
        {i < steps.length - 1 ? <button class="btn primary" onClick={() => setI(i + 1)}>Étape suivante</button> : <button class="btn primary" onClick={() => setFinish(true)}>Terminer</button>}
      </div>}
      {rest && !timer && !finish && <RestBar rest={rest} onAdd={d => setRest(r => ({ ...r, until: r.until + d * 1000, total: Math.max(1, r.total + d) }))} onSkip={endRest} />}
      {timer && <IntervalTimer spec={timer.spec} title={timer.spec.name || timer.b.title} onMark={onMark} onClose={() => setTimer(null)} />}
    </div>
  );
}
