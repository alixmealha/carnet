import { useEffect, useRef, useState } from 'preact/hooks';
import { jget, jset, get, put, isSelf, links, myProfile, subjectSettings, SELF, getSubject, nameOf } from '../lib/store.js';
import { blocks, target, weekOf, weekLabel, itemKey, doneN, progress, itemLoad, fingerCalc, testIdsOf, PHASE_LABEL, meta, day, eventOn } from '../lib/plan.js';
import { WELL, FLAGS, REPAS, RPE, STATUS, SIV, score, verdict, rpeCmp, rng, NSTAGE, NMET, parseDur, durShort, durLong, nightTotal, vfcAvg } from '../lib/rules.js';
import { dayInsights } from '../lib/insights.js';
import { testById, valueKeys, resultsOn, saveResults, lastResult, pct } from '../lib/tests.js';
import { fmtLong, addDays, todayKey, fmtNum, fmtShort } from '../lib/dates.js';
import { Seg, TextSeg, Icon, Rich, Src, toast } from '../ui/kit.jsx';
import { ActFields } from '../ui/ActFields.jsx';
import { plannedActs } from '../lib/activity.js';

export function DayHeader({ k, onNav, compact }) {
  const w = weekOf(k), m = meta(), ev = eventOn(k);
  const inRange = m && k >= m.start && k <= m.end;
  return (
    <div class="head" style={compact ? 'margin-bottom:10px' : ''}>
      <div style="min-width:0">
        <div class="eyebrow">{w ? weekLabel(w) + ' · ' + (PHASE_LABEL[w.phase] || w.bloc) + (w.xmas ? ' · Noël' : '') : (inRange ? '' : 'Hors plan')}{k === todayKey() ? ' · aujourd’hui' : ''}</div>
        <h2 class="h2" style="font-size:30px;margin-top:4px">{fmtLong(k)}</h2>
        {ev && <span class="pill comp" style="margin-top:6px"><i />{ev.label}</span>}
      </div>
      {onNav && <div class="row-btns" style="flex:none">
        <button class="icon-btn" aria-label="Jour précédent" onClick={() => onNav(addDays(k, -1))}><Icon name="left" /></button>
        <button class="icon-btn" aria-label="Jour suivant" onClick={() => onNav(addDays(k, 1))}><Icon name="right" /></button>
      </div>}
    </div>
  );
}

/* ---------- Forme du matin ---------- */
function Morning({ k, ro }) {
  const e = jget(k), t = score(e), st = subjectSettings();
  const [open, setOpen] = useState(t === null && !ro);
  const was = useRef(t);
  useEffect(() => { if (was.current === null && t !== null) { const id = setTimeout(() => setOpen(false), 650); was.current = t; return () => clearTimeout(id); } was.current = t; }, [t]);
  const fl = FLAGS.filter(([f]) => e.flags && e.flags[f]);
  const setWell = (key, v) => { const w = Object.assign({}, e.well); if (v == null) delete w[key]; else w[key] = v; jset(k, { well: w }); };
  const toggleFlag = f => {
    const flags = Object.assign({}, e.flags), ge = Object.assign({}, e.gene);
    if (flags[f]) { delete flags[f]; delete ge[f]; } else flags[f] = true;
    jset(k, { flags, gene: ge });
  };
  const setGene = (f, v) => { const ge = Object.assign({}, e.gene); if (v == null) delete ge[f]; else ge[f] = v; jset(k, { gene: ge }); };
  if (!open && (t !== null || ro)) return (
    <button type="button" class="card sum" onClick={() => setOpen(true)} aria-label="Voir la forme du matin">
      <span class="sum-k">Forme du matin</span>
      <span class="sum-v">{t !== null ? <><b class="num">{t}<small>/25</small></b><span class={'pill ' + verdict(t).cls}>{verdict(t).lbl}</span></> : <span class="muted">Pas encore remplie</span>}</span>
      {fl.length > 0 && <span class="sum-f">{fl.map(([f, l]) => l + (e.gene && typeof e.gene[f] === 'number' ? ' ' + e.gene[f] + '/10' : '')).join(' · ')}</span>}
      <span class="sum-e">{ro ? 'Voir' : 'Modifier'}</span>
    </button>
  );
  return (
    <section class="card">
      <h3 class="h3">Forme du matin <em>{t === null ? '1 = mauvais · 5 = au top' : <button class="btn ghost" style="min-height:28px;padding:0;font-size:13px" onClick={() => setOpen(false)}>Replier</button>}</em></h3>
      <fieldset class="ro" disabled={ro}>
        {WELL.map(([key, lbl, lo, hi]) =>
          <div class="wrow"><div class="lbl">{lbl}<small>{lo} → {hi}</small></div>
            <Seg value={e.well && e.well[key]} onChange={v => setWell(key, v)} label={lbl} /></div>)}
        {t !== null && <div class="score"><b>{t}<small>/25</small></b><span class={'pill ' + verdict(t).cls}>{verdict(t).lbl}</span></div>}
        <p class="sub-lbl">Gêne ou douleur au réveil</p>
        <div class="chips">{FLAGS.map(([f, l]) => <button type="button" class="chip" aria-pressed={e.flags && e.flags[f] ? 'true' : 'false'} onClick={() => toggleFlag(f)}>{l}</button>)}</div>
        {fl.map(([f, l]) =>
          <div><p class="sub-lbl">{l} : gêne<small>0 = rien · 10 = maximale</small></p>
            <Seg value={e.gene && e.gene[f]} onChange={v => setGene(f, v)} from={0} to={10} dense label={'Gêne ' + l} /></div>)}
        {fl.length > 0 && <TextField k={k} name="precis" label="Précisions" placeholder="Côté, endroit exact, ce qui la déclenche…" />}
        <details class="fold" style="margin-top:12px">
          <summary><span class="sub-lbl" style="margin:0">Plus de détails <small>facultatif</small></span></summary>
          <div class="stack" style="gap:10px;margin-top:10px">
            <div><p class="sub-lbl" style="margin-top:0">Hier, mangé avant et après la séance ?</p>
              <TextSeg value={e.repas} onChange={v => jset(k, { repas: v })} options={REPAS} label="Repas autour de la séance" /></div>
            {st.cycle && <NumField k={k} name="cycle" label="Jour du cycle (J1 = premier jour des règles)" int />}
          </div>
        </details>
      </fieldset>
    </section>
  );
}

function TextField({ k, name, label, placeholder }) {
  const cur = jget(k)[name] || '';
  const [v, setV] = useState(cur);
  useEffect(() => setV(jget(k)[name] || ''), [k, cur]);
  return <label class="fld" style="margin-top:10px">{label}<input class="in" value={v} placeholder={placeholder} onInput={e => setV(e.target.value)} onBlur={() => jset(k, { [name]: v.trim() || null })} /></label>;
}
function NumField({ k, name, label, int }) {
  const cur = jget(k)[name];
  const [v, setV] = useState(cur == null ? '' : String(cur));
  useEffect(() => setV(cur == null ? '' : String(cur)), [k, cur]);
  return <label class="fld">{label}<input class="in mono" inputmode={int ? 'numeric' : 'decimal'} value={v} onInput={e => setV(e.target.value)} onBlur={() => { const n = parseFloat(String(v).replace(',', '.')); jset(k, { [name]: isNaN(n) ? null : int ? Math.round(n) : n }); }} /></label>;
}

/* ---------- Sommeil ---------- */
function DurField({ k, name, label, placeholder }) {
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
  return <label class="fld">{label}<input class="in mono" inputmode="text" autocomplete="off" placeholder={placeholder || '1h12'} value={v} aria-invalid={bad ? 'true' : 'false'} onInput={e2 => setV(e2.target.value)} onBlur={commit} /></label>;
}
function MetField({ k, name, label, unit }) {
  const e = jget(k), cur = e.nuit && e.nuit[name];
  const [v, setV] = useState(typeof cur === 'number' ? String(cur) : '');
  useEffect(() => { setV(typeof cur === 'number' ? String(cur) : ''); }, [k, cur]);
  const commit = () => { const x = v === '' ? null : Math.round(+String(v).replace(',', '.')); const n = Object.assign({}, jget(k).nuit); if (x === null || isNaN(x)) delete n[name]; else n[name] = x; jset(k, { nuit: n }); };
  return <label class="fld">{label} ({unit})<input class="in mono" inputmode="numeric" value={v} onInput={e2 => setV(e2.target.value)} onBlur={commit} /></label>;
}
function Night({ k, ro }) {
  const e = jget(k), n = e.nuit || {}, tot = nightTotal(e), avg = vfcAvg(k);
  const hasStages = ['profond', 'leger', 'rem'].filter(s => typeof n[s] === 'number').length >= 2;
  const ev = typeof n.eveil === 'number' ? n.eveil : 0;
  return (
    <details class="card fold">
      <summary><h3 class="h3" style="margin:0">Sommeil <em>{tot !== null ? durLong(tot) + (typeof n.vfc === 'number' ? ' · VFC ' + n.vfc : '') : 'à renseigner'}</em></h3></summary>
      <fieldset class="ro" disabled={ro} style="margin-top:12px">
        {!hasStages && <div class="grid2"><DurField k={k} name="total" label="Durée de sommeil" placeholder="7h30" /><div /></div>}
        <p class="small" style={hasStages ? 'margin-top:0' : ''}><b>Facultatif.</b> Si tu as une montre (Garmin, WHOOP, Apple, Polar…), note aussi ses valeurs : la durée se calcule alors toute seule.</p>
        <div class="night" style="margin-top:10px">{NSTAGE.map(([key, l]) => <DurField k={k} name={key} label={l} />)}</div>
        <div class="grid3" style="margin-top:8px">{NMET.map(([key, l, u]) => <MetField k={k} name={key} label={l} unit={u} />)}</div>
        {tot !== null && hasStages && <>
          <div class="sbar" role="img" aria-label="Répartition de la nuit">{NSTAGE.filter(([key]) => typeof n[key] === 'number' && n[key] > 0).map(([key]) => <i style={'width:' + (n[key] / (tot + ev) * 100).toFixed(1) + '%;background:var(--s-' + key + ')'} />)}</div>
          <div class="nsum"><span><b>Sommeil {durLong(tot)}</b></span>{NSTAGE.filter(([key]) => typeof n[key] === 'number').map(([key, l]) => <span class="k"><i style={'background:var(--s-' + key + ')'} />{l} {key === 'eveil' ? durLong(n[key]) : Math.round(n[key] / tot * 100) + ' %'}</span>)}</div>
        </>}
        {(typeof n.vfc === 'number' || typeof n.fcr === 'number') && <div class="nsum">{typeof n.vfc === 'number' && <span>VFC <b>{n.vfc} ms</b>{avg !== null ? ' · moy. 7 j ' + avg : ''}</span>}{typeof n.fcr === 'number' && <span>FC <b>{n.fcr} bpm</b></span>}{typeof n.recup === 'number' && <span>Récup <b>{n.recup} %</b></span>}</div>}
        <p class="small">Durées : tape 7h30, 7:30 ou 450 (en minutes).</p>
      </fieldset>
    </details>
  );
}

/* ---------- Lecture du jour ---------- */
const LVC = { crit: 'var(--crit)', warn: 'var(--warn)', info: 'var(--accent)', good: 'var(--good)' };
function Reading({ k }) {
  const r = dayInsights(k);
  if (!r) return <section class="card"><h3 class="h3">Lecture du jour</h3><p class="small" style="margin:0">Remplis la forme du matin (et ton sommeil si tu l’as) : la séance s’ajuste ici, avec l’explication.</p></section>;
  return (
    <section class={'card reading ' + r.level}>
      <h3 class="h3">Lecture du jour</h3>
      <div class="light"><i />{r.head}</div>
      <div class="ins">{r.items.map(x => <div class="in-it" style={'--c:' + LVC[x.lvl]}><b>{x.t}</b><span>{x.d}</span><Src ids={x.src} /></div>)}</div>
      {r.adapt && <div class="adapt"><b>Adaptation prévue au plan.</b> <Rich text={r.adapt} /></div>}
    </section>
  );
}

/* ---------- Séance ---------- */
export function Goal({ k }) {
  const tg = target(k);
  if (!tg) return blocks(k).some(b => b.kind === 'kine') ? <div class="goal"><p class="goal-why" style="margin:0">Objectif fixé par le kiné.</p></div> : null;
  const charge = (tg.i || 0) + (tg.v || 0), climb = plannedActs(k).includes('grimpe');
  if (!climb) return tg.rpe || tg.why ? (
    <div class="goal">
      {tg.rpe && <div class="goal-top"><div class="goal-rpe"><small>Ressenti<br />visé</small><b>{rng(tg)}<i>/10</i></b></div></div>}
      {tg.why && <p class="goal-why">{tg.why}</p>}
    </div>
  ) : null;
  return (
    <div class="goal">
      <div class="goal-top">
        {tg.rpe ? <div class="goal-rpe"><small>Ressenti<br />visé</small><b>{rng(tg)}<i>/10</i></b></div>
          : <div class="goal-rpe"><small>Charge<br />visée</small><b>{charge}<i>/20</i></b></div>}
        <div class="siv" role="img" aria-label={'Profil visé : spécificité ' + tg.s + ', intensité ' + tg.i + ', volume ' + tg.v}>
          {SIV.map(([key, l]) => <div class="siv-row"><span>{l}</span><span class="bar"><i style={'width:' + (tg[key] || 0) * 10 + '%'} /></span><b>{tg[key]}</b></div>)}
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
    jset(k, { done });
    const p = progress(k);
    if (p.total && p.done === p.total && !jget(k).status) jset(k, { status: 'faite' });
  };
  return (
    <div class={'it' + (full ? ' done' : '')}>
      <button type="button" class="ck" aria-pressed={full ? 'true' : 'false'} aria-label={it.label} onClick={() => setDone(full ? 0 : it.n)}>✓</button>
      <div class="it-txt"><b><i class="lt" style="font-style:normal"><Rich text={it.label} />{ld && <span class={'load-tag' + (ld.changed ? ' chg' : '')}>{ld.text}</span>}</i>{it.n > 1 && <em class="pn" style="font-style:normal">{v}/{it.n}</em>}</b>{it.det && <span><Rich text={it.det} /></span>}</div>
      {it.n > 1 && <div class="pips" role="group" aria-label={it.label + ' : ' + v + ' sur ' + it.n}>
        {Array.from({ length: it.n }, (_, i) => i + 1).map(i => <button type="button" class="pip" style={'--c:' + color} aria-pressed={i <= v ? 'true' : 'false'} aria-label={(it.unit || 'Série') + ' ' + i} onClick={() => setDone(v === i ? i - 1 : i)}>{i}</button>)}
      </div>}
    </div>
  );
}

function SessionCard({ k, onStart, onEdit, ro }) {
  const e = jget(k), bl = blocks(k), pr = progress(k), d = day(k) || {}, w = weekOf(k);
  const active = bl.some(b => b.kind !== 'rest');
  return (
    <section class="card">
      <h3 class="h3">Séance du jour <em>{pr.total ? pr.done + '/' + pr.total + ' fait' : ''}{onEdit && <button class="btn ghost" style="min-height:28px;padding:0 0 0 10px;font-size:13px" onClick={() => onEdit(k)}>Modifier</button>}</em></h3>
      <div class="stack">
        {d.title && <div><h4 class="ses-title"><Rich text={d.title} /></h4>{(d.duree || d.essais) && <p class="small" style="margin:2px 0 0">{[d.duree && d.duree !== '—' ? 'Durée ' + d.duree : null, d.essais && d.essais !== '—' ? 'Essais ' + d.essais : null].filter(Boolean).join(' · ')}</p>}</div>}
        <Goal k={k} />
        {w && w.why && <details class="fold why-f"><summary><span class="small" style="margin:0;font-weight:600;color:var(--accent)">Pourquoi cette semaine</span></summary><p class="small" style="color:var(--ink)"><Rich text={w.why} /></p></details>}
        {bl.length === 0 && <p class="small" style="margin:0">Rien de prévu ce jour-là.</p>}
        <fieldset class="ro stack" disabled={ro}>
          {bl.map(b => {
            const color = 'var(--k-' + (b.kind === 'rest' ? 'rest' : b.kind) + ')', fc = b.kind === 'doigts' ? fingerCalc(b, k) : null;
            return (
              <div class="blk">
                <span class="tape" style={'background:' + color} />
                <div style="min-width:0">
                  <h4><Rich text={b.title} /></h4>
                  {b.desc && <p class="d"><Rich text={b.desc} /></p>}
                  {fc && <div class="calc">{fc.text}{fc.hint && <><br /><span class="muted">{fc.hint}</span></>}</div>}
                  {fc && fc.guard && <div class="guard">{fc.guard}</div>}
                  {b.sub && <div class="sub"><Rich text={b.sub} /></div>}
                  {b.items && b.items.length > 0 && (b.kind === 'rest'
                    ? <ul class="plain">{b.items.map(it => <li><Rich text={it.label} />{it.det ? ' · ' : ''}<Rich text={it.det} /></li>)}</ul>
                    : <div class="items">{b.items.map(it => <ItemRow k={k} b={b} it={it} e={e} color={color} />)}</div>)}
                </div>
              </div>
            );
          })}
        </fieldset>
        {d.edited && d.edited.uid && d.edited.uid !== links.me && <p class="edited">Modifiée par {d.edited.name || 'ton coach'} · {new Date(d.edited.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}
        {d.adapt && <details class="fold why-f"><summary><span class="small" style="margin:0;font-weight:600;color:var(--warn)">Si besoin d’adapter</span></summary><p class="small" style="color:var(--ink)"><Rich text={d.adapt} /></p></details>}
        {active && onStart && !ro && <button class="btn big primary" onClick={() => onStart(k)}><Icon name="play" size={20} />{e.startedAt && !e.endedAt ? 'Reprendre la séance' : pr.done ? 'Continuer la séance' : 'Démarrer la séance'}</button>}
      </div>
    </section>
  );
}

/* ---------- Résultats des tests du jour ---------- */
export function TestEntry({ k, tids, onOpenTest }) {
  const r = resultsOn(k);
  const [draft, setDraft] = useState(() => { const o = {}; for (const tid of tids) for (const vk of valueKeys(testById(tid) || { measures: [] })) { const v = r.res && r.res[tid] && r.res[tid][vk.key]; o[tid + '|' + vk.key] = typeof v === 'number' ? fmtNum(v) : ''; } o.bw = typeof r.bw === 'number' ? fmtNum(r.bw) : ''; return o; });
  const commit = () => {
    const res = {};
    for (const tid of tids) { const t = testById(tid); if (!t) continue; res[tid] = {}; for (const vk of valueKeys(t)) { const n = parseFloat(String(draft[tid + '|' + vk.key] || '').replace(',', '.')); if (!isNaN(n)) res[tid][vk.key] = n; } }
    const bw = parseFloat(String(draft.bw || '').replace(',', '.'));
    saveResults(k, { res, bw: isNaN(bw) ? null : bw });
  };
  return (
    <div class="stack" style="gap:12px">
      {tids.map(tid => {
        const t = testById(tid); if (!t) return null;
        const prev = lastResult(tid), pv = prev && prev.k < k ? prev : null;
        return <div class="te">
          <div class="te-h"><b>{t.name}</b>{onOpenTest && <button type="button" class="btn ghost" style="min-height:26px;padding:0;font-size:13px" onClick={() => onOpenTest(tid)}>Protocole</button>}</div>
          <div class="grid2">{valueKeys(t).map(vk => {
            const cur = parseFloat(String(draft[tid + '|' + vk.key] || '').replace(',', '.')), was = pv && pv.vals[vk.key], p = pct(cur, was);
            return <label class="fld">{(vk.label ? vk.label.charAt(0).toUpperCase() + vk.label.slice(1) : 'Résultat') + (vk.unit ? ' (' + vk.unit + ')' : '')}
              <input class="in mono" inputmode="decimal" value={draft[tid + '|' + vk.key]} onInput={e => setDraft(Object.assign({}, draft, { [tid + '|' + vk.key]: e.target.value }))} onBlur={commit} />
              {typeof was === 'number' && <span class="te-prev">avant : {fmtNum(was)}{p !== null && !isNaN(cur) ? <b class={p >= 0 ? 'up' : 'down'}> {p >= 0 ? '+' : ''}{fmtNum(Math.round(p * 10) / 10)} %</b> : ''}</span>}
            </label>;
          })}</div>
        </div>;
      })}
      <div class="grid2"><label class="fld">Poids de corps ce jour (kg)<input class="in mono" inputmode="decimal" value={draft.bw} onInput={e => setDraft(Object.assign({}, draft, { bw: e.target.value }))} onBlur={commit} /></label></div>
    </div>
  );
}
function TestsCard({ k, onOpenTest }) {
  const tids = testIdsOf(k); if (!tids.length) return null;
  return <section class="card"><h3 class="h3">Résultats des tests <em>{tids.length} test{tids.length > 1 ? 's' : ''}</em></h3><TestEntry k={k} tids={tids} onOpenTest={onOpenTest} key={k} /><p class="small">Tout est enregistré dans Suivi → Tests, avec l’évolution d’une passation à l’autre.</p></section>;
}

/* ---------- Échanges coach / athlète ---------- */
function Exchanges({ k }) {
  const self = isSelf(), show = !self || links.coaches.length > 0;
  const c = get('c:' + k) || {}, msgs = c.msgs || [];
  const [txt, setTxt] = useState('');
  if (!show) return null;
  const send = () => {
    const t = txt.trim(); if (!t) return;
    const me = links.me || SELF, name = myProfile().name || (self ? 'Moi' : 'Coach');
    put('c:' + k, { msgs: msgs.concat([{ uid: me, name, text: t, at: Date.now() }]) });
    setTxt(''); toast('Envoyé');
  };
  const other = self ? 'ton coach' : nameOf(getSubject());
  return (
    <section class="card">
      <h3 class="h3">Échanges <em>{msgs.length ? msgs.length + ' message' + (msgs.length > 1 ? 's' : '') : ''}</em></h3>
      {msgs.length > 0 ? <div class="thread">{msgs.map(m => { const mine = m.uid === (links.me || SELF); return <div class={'msg' + (mine ? ' mine' : '')}><span class="who">{mine ? 'Toi' : m.name}{m.at ? ' · ' + new Date(m.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span><p>{m.text}</p></div>; })}</div>
        : <p class="small" style="margin:0 0 10px">{self ? 'Un mot pour ton coach sur cette séance ?' : 'Ton retour sur cette séance, visible par ' + other + '.'}</p>}
      <div class="compose">
        <textarea class="in" rows="2" value={txt} placeholder={self ? 'Écrire à ton coach…' : 'Écrire à ' + other + '…'} onInput={e => setTxt(e.target.value)} />
        <button class="icon-btn send" aria-label="Envoyer" disabled={!txt.trim()} onClick={send}><Icon name="send" size={20} /></button>
      </div>
    </section>
  );
}

/* ---------- Après la séance ---------- */
export function After({ k, ro }) {
  const e = jget(k), tg = target(k), cmp = rpeCmp(tg, e.rpe);
  const [note, setNote] = useState(e.note || '');
  const [dur, setDur] = useState(typeof e.duree === 'number' ? String(e.duree) : '');
  const timer = useRef(null);
  useEffect(() => { setNote(jget(k).note || ''); const d = jget(k).duree; setDur(typeof d === 'number' ? String(d) : ''); }, [k, e.note, e.duree]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onNote = v => { setNote(v); clearTimeout(timer.current); timer.current = setTimeout(() => jset(k, { note: v || null }), 500); };
  const commitDur = () => { const n = dur === '' ? null : Math.max(0, Math.round(+dur)); jset(k, { duree: n === null || isNaN(n) ? null : n }); };
  const d = parseInt(dur, 10);
  return (
    <section class="card">
      <h3 class="h3">Après la séance</h3>
      <fieldset class="ro stack" disabled={ro}>
        <TextSeg value={e.status} onChange={v => jset(k, { status: v })} options={STATUS} label="Statut de la séance" />
        <div>
          <Seg value={e.rpe} onChange={v => jset(k, { rpe: v })} from={0} to={10} dense tgt={tg && tg.rpe ? i => i >= tg.rpe[0] && i <= tg.rpe[1] : null} label="Ressenti de 0 à 10" />
          <div class="rpe-lbl">{typeof e.rpe === 'number' ? <>Ressenti <b>{e.rpe}/10 · {RPE[e.rpe]}</b></> : 'Ressenti global de 0 à 10, environ 30 min après' + (tg && tg.rpe ? ' · en bleu, la zone visée' : '')}</div>
          {cmp && <p class={'cmp ' + cmp.cls}>{cmp.text}</p>}
        </div>
        <ActFields k={k} />
        <div class="grid2" style="align-items:end">
          <label class="fld">Durée totale (min)<input class="in mono" inputmode="numeric" value={dur} onInput={ev => setDur(ev.target.value)} onBlur={commitDur} /></label>
          <div class="loadbox">{typeof e.rpe === 'number' && d > 0 ? (e.rpe * d).toLocaleString('fr-FR') + ' UA' : '—'}<small>Charge = ressenti × durée</small></div>
        </div>
        <label class="fld">Note du jour<textarea class="in" value={note} placeholder="Ce que tu as vraiment fait, les sensations, les valeurs de test…" onInput={ev => onNote(ev.target.value)} onBlur={() => { clearTimeout(timer.current); jset(k, { note: note || null }); }} /></label>
      </fieldset>
    </section>
  );
}

export function DayView({ k, onNav, onStart, onEdit, onOpenTest }) {
  const ro = !isSelf();
  return (
    <div class="stack">
      <DayHeader k={k} onNav={onNav} />
      <Morning k={k} ro={ro} key={'m' + k} />
      <Night k={k} ro={ro} key={'n' + k} />
      <Reading k={k} />
      <SessionCard k={k} onStart={onStart} onEdit={onEdit} ro={ro} />
      <TestsCard k={k} onOpenTest={onOpenTest} />
      <Exchanges k={k} key={'c' + k} />
      <After k={k} ro={ro} />
    </div>
  );
}
