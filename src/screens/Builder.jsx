// Assistant de programme : objectif (ou quiz), disponibilités, matériel, aperçu, puis écriture dans le plan.
import { useMemo, useState } from 'preact/hooks';
import { getSubject, profileOf, isSelf, nameOf, getFor, putFor, SELF, links } from '../lib/store.js';
import { uid } from '../lib/plan.js';
import { sportsOf } from '../lib/sports.js';
import { GOALS, GOAL_BY_ID, SYSTEMS, EQUIP, LIB_BY_ID, quiz, quizResult } from '../lib/library.js';
import { generate, writeProgram, conflicts, LEVELS, DURS, nextMonday, alternatives, groupsTxt, sessionSummary, SESSION_LBL, FORMATS, fmtFamily, fmtOf, fmtReco, weekPlanTypes, buildSession } from '../lib/builder.js';
import { LevelsForm } from '../ui/Levels.jsx';
import { levelsDoc, LIFT_OF_LIB, climbLevel } from '../lib/levels.js';
import { clone } from '../lib/plan.js';
import { PHASE_LABEL, PHASE_Z } from '../lib/plan.js';
import { DOW_3, DOW_L, todayKey, mondayOf, addDays, fmtDay, fmtShort, diffDays } from '../lib/dates.js';
import { Sheet, TextSeg, Src, Icon, toast } from '../ui/kit.jsx';

const DEFAULT_EQ = { escalade: ['salle-esc'], muscu: ['salle'], course: ['exterieur'], trail: ['exterieur'], velo: ['velo'], natation: ['piscine'], hyrox: ['salle', 'exterieur'], collectif: ['exterieur'], combat: [], autre: [] };
const KEY = 'alipto-builder';
// derniers réglages, retenus sur l'appareil par compte et par carnet
const prefKey = () => KEY + ':' + (links.me || 'local') + ':' + getSubject();
// Modèles : réglages d'un programme gardés dans son propre carnet (un coach peut les appliquer à plusieurs athlètes)
const models = () => ((getFor(SELF, 'models') || {}).list || []);
function saveModel(name, cfg) {
  const keep = ['goal', 'goal2', 'days', 'fixed', 'fixedLbl', 'dur', 'lvl', 'equip', 'weeks', 'swap', 'fmt'], c = {};
  for (const k of keep) c[k] = cfg[k];
  putFor(SELF, 'models', { list: models().filter(m => m.name !== name).concat([{ id: uid('m'), name, cfg: c, at: Date.now() }]) });
}
function deleteModel(id) { putFor(SELF, 'models', { list: models().filter(m => m.id !== id) }); }
function initial() {
  const o = getSubject(), p = profileOf(o), sp = sportsOf(o) || [];
  let saved = null; try { saved = JSON.parse(localStorage.getItem(prefKey()) || 'null'); } catch (_) {}
  const eq = [...new Set(sp.flatMap(s => DEFAULT_EQ[s] || []))];
  return Object.assign({ goal: null, goal2: null, days: [0, 2, 4], fixed: [], fixedLbl: '', dur: 60, lvl: 2, equip: eq, weeks: 8, start: nextMonday(), event: null, eventLbl: '' },
    saved ? { days: saved.days, fixed: saved.fixed || [], fixedLbl: saved.fixedLbl || '', dur: saved.dur, lvl: saved.lvl, equip: saved.equip, weeks: saved.weeks } : {},
    { sports: sp, u18: !!p.under18, swap: {}, fmt: (saved && saved.fmt) || {} },
    // coach qui prépare le programme d'un athlète : repères de l'athlète, complétables pour ce programme seulement
    isSelf() ? {} : { lv: clone(levelsDoc(o)) });
}

function Card({ on, title, sub, onClick }) {
  return <button type="button" class={'role-c' + (on ? ' on' : '')} onClick={onClick}><b>{title}</b>{sub && <span>{sub}</span>}</button>;
}
function DayChips({ value, onChange, disabled }) {
  return <div class="daychips" role="group">{DOW_3.map((d, i) => <button type="button" class="chip sel" disabled={disabled && disabled.includes(i)} aria-pressed={value.includes(i) ? 'true' : 'false'} onClick={() => onChange(value.includes(i) ? value.filter(x => x !== i) : value.concat([i]).sort())}>{d}</button>)}</div>;
}

/* ---------- Étape : objectif ---------- */
function GoalStep({ cfg, set, onQuiz, onModel }) {
  const cl = (cfg.sports || []).includes('escalade') || !(cfg.sports || []).length;
  const list = GOALS.filter(g => cl || g.sp !== 'escalade'), ms = models();
  return <div class="stack">
    {ms.length > 0 && <div><p class="sub-lbl" style="margin-top:0">Mes modèles</p>
      <div class="list">{ms.map(m => <div class="li noarrow"><button type="button" class="li-in" onClick={() => onModel(m)}><span style="min-width:0">{m.name}<small>{GOAL_BY_ID[m.cfg.goal].l}{m.cfg.goal2 ? ' + ' + GOAL_BY_ID[m.cfg.goal2].l.toLowerCase() : ''} · {m.cfg.days.length} j/sem. · {m.cfg.dur} min</small></span></button>
        <button type="button" class="btn ghost" style="color:var(--crit)" onClick={() => { if (confirm('Supprimer le modèle « ' + m.name + ' » ?')) deleteModel(m.id); }}>Supprimer</button></div>)}</div></div>}
    <button type="button" class="card li-card" onClick={onQuiz}><Icon name="flask" /><span><b>Je ne sais pas</b><small>Trois questions pour trouver ce qui te fera le plus progresser</small></span><span class="chev r" aria-hidden="true" /></button>
    <p class="sub-lbl" style="margin:4px 0 0">Ce que tu veux améliorer en priorité</p>
    <div class="goal-grid">{list.map(g => <Card on={cfg.goal === g.id} title={g.l} sub={g.d} onClick={() => set({ goal: g.id, goal2: cfg.goal2 === g.id ? null : cfg.goal2 })} />)}</div>
    {cfg.goal && <div>
      <p class="sub-lbl">En second <small>facultatif : une séance par semaine environ</small></p>
      <div class="chips"><button type="button" class="chip sel" aria-pressed={!cfg.goal2 ? 'true' : 'false'} onClick={() => set({ goal2: null })}>Rien</button>
        {list.filter(g => g.id !== cfg.goal).map(g => <button type="button" class="chip sel" aria-pressed={cfg.goal2 === g.id ? 'true' : 'false'} onClick={() => set({ goal2: g.id })}>{g.l}</button>)}</div>
    </div>}
    {cfg.goal && <SysCard id={GOAL_BY_ID[cfg.goal].sys} />}
  </div>;
}
function SysCard({ id }) {
  const s = SYSTEMS[id]; if (!s) return null;
  return <div class="sys"><b>{s.l}</b><span>{s.d}</span><Src ids={s.src} /></div>;
}

/* ---------- Étape : quiz ---------- */
function QuizStep({ cfg, set, onDone }) {
  const cl = (cfg.sports || []).includes('escalade');
  const qs = quiz(cl), [ans, setAns] = useState({});
  const done = qs.every(q => ans[q.id]);
  const res = done ? quizResult(ans, cl) : [];
  return <div class="stack">
    {qs.map((q, i) => <div class="stack" style="gap:8px">
      <p class="sub-lbl" style="margin:0">{i + 1}. {q.q}</p>
      {q.opts.map(o => <button type="button" class={'role-c q-opt' + (ans[q.id] === o.id ? ' on' : '')} onClick={() => { const a = Object.assign({}, ans, { [q.id]: o.id }); setAns(a); if (qs.every(x => a[x.id])) setTimeout(() => { const el = document.querySelector('.quiz-res'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80); }}>{o.l}</button>)}
    </div>)}
    {done && res.length > 0 && <section class="card quiz-res">
      <h3 class="h3">Ce qui te fera le plus progresser</h3>
      <p class="lead" style="margin:0"><b>{GOAL_BY_ID[res[0]].l}</b>{res[1] ? <> puis <b>{GOAL_BY_ID[res[1]].l.toLowerCase()}</b></> : null}</p>
      <SysCard id={GOAL_BY_ID[res[0]].sys} />
      {res[1] && GOAL_BY_ID[res[1]].sys !== GOAL_BY_ID[res[0]].sys && <SysCard id={GOAL_BY_ID[res[1]].sys} />}
      <button class="btn primary" style="margin-top:10px" onClick={() => { set({ goal: res[0], goal2: res[1] || null }); onDone(); }}>Partir là-dessus</button>
    </section>}
    {done && !res.length && <p class="small">Pas de priorité nette : choisis un objectif dans la liste, ou « Prévention » pour une base solide.</p>}
  </div>;
}

/* ---------- Étape : disponibilités ---------- */
function DaysStep({ cfg, set }) {
  return <div class="stack">
    <div><p class="sub-lbl" style="margin-top:0">Jours d’entraînement <small>{cfg.days.length} par semaine</small></p>
      <DayChips value={cfg.days} disabled={cfg.fixed} onChange={v => set({ days: v })} /></div>
    <div><p class="sub-lbl">Jours déjà pris par ton sport <small>club, match : facultatif</small></p>
      <DayChips value={cfg.fixed} disabled={cfg.days} onChange={v => set({ fixed: v })} />
      {cfg.fixed.length > 0 && <label class="fld" style="margin-top:8px">Nom<input class="in" value={cfg.fixedLbl} placeholder="Basket, match, entraînement du club…" onInput={e => set({ fixedLbl: e.target.value })} /></label>}
      <p class="small">L’assistant place les séances lourdes loin de ces jours (règle des 48 h).</p></div>
    <div><p class="sub-lbl">Durée d’une séance</p><TextSeg value={String(cfg.dur)} onChange={v => v && set({ dur: +v })} options={DURS.map(d => [String(d), d + ' min'])} label="Durée" /></div>
    <div><p class="sub-lbl">Ton niveau dans ce type d’entraînement</p>
      <div class="stack" style="gap:8px">{LEVELS.map(([n, l, d]) => <Card on={cfg.lvl === n} title={l} sub={d} onClick={() => set({ lvl: n })} />)}</div></div>
  </div>;
}

/* ---------- Étape : niveau et formats ---------- */
const FAM_LBL = { conti: 'Séance de volume', resist: 'Séance de résistance', bloc: 'Séance de puissance', doigts: 'Séance de doigts', compet: 'Séance de compétition', force: 'Muscu · force', hyper: 'Muscu · masse', puiss: 'Muscu · puissance' };
const RECO_WHY = {
  conti: (r, c) => r === 'voies' ? 'Tu as renseigné un niveau en voie : le volume se fait en voie.' : 'Beaucoup de mouvements à intensité basse : la base aérobie des avant-bras et de la technique.',
  resist: r => r === 'voies' ? 'Ton objectif est la résistance en voie : on la travaille dans des voies.' : 'Le 4 × 4 fait durer l’effort 2 à 3 min, la durée de la filière lactique.',
  bloc: () => 'Les blocs à ta limite recrutent au maximum, frais à chaque essai.',
  doigts: r => r === 'hangs' ? 'Avec une poutre, la charge des suspensions se règle au kilo près.' : 'Sans poutre (ou avant 18 ans), les petites prises en bloc font progresser sans risque.',
  compet: () => 'Le format des qualifications : blocs nouveaux, temps limité, repos imposé.',
  force: () => 'Repos complets entre les séries : la base la plus simple pour progresser en force.',
  hyper: (r, c) => r === 'supersets' ? 'Séance de ' + c.dur + ' min : les supersets gardent le volume en moins de temps.' : 'Un exercice à la fois, repos complets : le plus simple pour bien charger.',
  puiss: r => r === 'contraste' ? 'Avec une barre et de l’expérience : la série lourde potentialise la série explosive.' : 'Charges légères lancées vite : la base, sans matériel lourd.'
};
function LevelStep({ cfg, set }) {
  const types = [...new Set(weekPlanTypes(cfg))], wk = { step: 1, meso: 0, phase: 'volume' };
  const fams = [...new Set(types.map(t => fmtFamily(t, cfg)).filter(Boolean))];
  // repères utiles : ceux qu'utilisent les séances de ce programme
  const lifts = new Set(), sample = {};
  for (const t of types) { const ss = buildSession(t, cfg, wk, new Set(), {}); sample[t] = ss; for (const b of ss.blocks) for (const it of b.items || []) { const l = LIFT_OF_LIB[it.lib]; if (l && it.rx && it.rx.role === 'main') lifts.add(l); } }
  if (fams.includes('puiss')) ['squat', 'bench', 'pull'].forEach(l => lifts.add(l));
  const need = { climb: types.some(t => ['conti', 'resist', 'bloc', 'doigts', 'compet'].includes(t)), lifts: [...lifts], cardio: types.some(t => ['ef', 'int', 'long', 'lact', 'sprint'].includes(t)) };
  const self = isSelf();
  const setLv = (key, val, sub) => { const lv = clone(cfg.lv || {}); if (sub) { lv[key] = Object.assign({}, lv[key]); if (val == null) delete lv[key][sub]; else lv[key][sub] = val; } else if (val == null) delete lv[key]; else lv[key] = val; set({ lv }); };
  return <div class="stack">
    {(need.climb || need.lifts.length || need.cardio) && <section class="card">
      <h3 class="h3" style="margin-bottom:4px">Ton niveau <em>facultatif</em></h3>
      <p class="small" style="margin:0 0 12px">Avec ces repères, les séances donnent des cotations, des charges et des allures précises. Sans eux, les consignes restent relatives (« 3 niveaux sous ton flash »).{self ? ' Ils sont gardés dans ton profil.' : ' Ce que tu complètes ici sert à ce programme seulement.'}</p>
      <LevelsForm need={need} lv={self ? undefined : cfg.lv || {}} onSet={self ? undefined : setLv} />
    </section>}
    {fams.map(f => {
      const t = types.find(x => fmtFamily(x, cfg) === f), cur = fmtOf(f, cfg), reco = fmtReco(f, cfg);
      return <div>
        <p class="sub-lbl" style="margin:4px 0 6px">{FAM_LBL[f]} <small>{FORMATS[f].length} formats</small></p>
        <div class="stack" style="gap:8px">{FORMATS[f].map(([id, l, d]) => {
          const ss = buildSession(t, Object.assign({}, cfg, { fmt: Object.assign({}, cfg.fmt, { [f]: id }) }), wk, new Set(), {}), ex = ss.est || {};
          const main = sessionSummary(ss).filter(it => it.id !== 'ech')[0];
          return <button type="button" class={'role-c fmt-c' + (cur === id ? ' on' : '')} onClick={() => set({ fmt: Object.assign({}, cfg.fmt, { [f]: id }) })}>
            <b>{l}{id === reco && <span class="fmt-reco">Conseillé</span>}</b>
            <span>{d}</span>
            {main && <span class="fmt-main">{main.n > 1 ? main.n + ' × ' : ''}{main.label}{main.det ? ' · ' + main.det.split(' · ').slice(0, 2).join(' · ') : ''}</span>}
            {(ex.min || ex.tut) && <span class="fmt-est">{ex.min ? '≈ ' + ex.min + ' min' : ''}{ex.min && ex.tut ? ' · ' : ''}{ex.tut ? '≈ ' + (ex.tut >= 120 ? Math.round(ex.tut / 60) + ' min' : ex.tut + ' s') + ' sous tension' : ''}</span>}
          </button>;
        })}</div>
        <p class="small" style="margin:6px 0 0">Conseillé : {RECO_WHY[f] ? RECO_WHY[f](reco, cfg) : ''}</p>
      </div>;
    })}
  </div>;
}

/* ---------- Étape : matériel et dates ---------- */
function EquipStep({ cfg, set }) {
  const t = todayKey(), thisMon = mondayOf(t), nm = nextMonday();
  const starts = [[nm, 'Lundi ' + fmtDay(nm)]].concat(thisMon !== nm ? [[thisMon, 'Cette semaine (à partir d’aujourd’hui)']] : []);
  const ev = !!cfg.event;
  return <div class="stack">
    <div><p class="sub-lbl" style="margin-top:0">Matériel disponible <small>plusieurs choix possibles</small></p>
      <div class="chips">{EQUIP.map(([id, l]) => <button type="button" class="chip sel" aria-pressed={cfg.equip.includes(id) ? 'true' : 'false'} onClick={() => set({ equip: cfg.equip.includes(id) ? cfg.equip.filter(x => x !== id) : cfg.equip.concat([id]) })}>{l}</button>)}</div>
      <p class="small">Sans rien coché : poids du corps uniquement.</p></div>
    <div><p class="sub-lbl">Début</p><TextSeg value={cfg.start} onChange={v => v && set({ start: v })} options={starts} label="Début du programme" /></div>
    <div><p class="sub-lbl">Durée du programme</p>
      <TextSeg value={ev ? 'event' : String(cfg.weeks)} onChange={v => { if (!v) return; if (v === 'event') set({ event: addDays(cfg.start, 8 * 7 - 1) }); else set({ weeks: +v, event: null }); }} options={[['4', '4 sem.'], ['8', '8 sem.'], ['12', '12 sem.'], ['event', 'Jusqu’à une date']]} label="Durée" />
      {ev && <div class="grid2" style="margin-top:8px">
        <label class="fld">Date de l’objectif<input class="in mono" type="date" min={addDays(cfg.start, 13)} value={cfg.event} onInput={e => e.target.value && set({ event: e.target.value })} /></label>
        <label class="fld">Nom<input class="in" value={cfg.eventLbl} placeholder="Compétition, course, voyage…" onInput={e => set({ eventLbl: e.target.value })} /></label>
      </div>}
      <p class="small">{ev ? 'Les deux dernières semaines deviennent un affûtage : moins de volume, même intensité (Bosquet 2007).' : 'Toutes les 4 semaines, une semaine de décharge pour digérer le travail (Bell 2023).'}</p></div>
  </div>;
}

/* ---------- Étape : aperçu ---------- */
function Preview({ cfg, set, prog }) {
  const [wi, setWi] = useState(0), [swap, setSwap] = useState(null);
  const w = prog.weeks[Math.min(wi, prog.weeks.length - 1)], t = todayKey();
  const g = GOAL_BY_ID[cfg.goal], g2 = cfg.goal2 && GOAL_BY_ID[cfg.goal2];
  const nSes = prog.weeks.reduce((a, x) => a + Object.keys(x.days).filter(d => addDays(x.start, +d) >= t).length, 0);
  return <div class="stack">
    <section class="card">
      <h3 class="h3" style="margin-bottom:2px">Ton programme</h3>
      <p class="small" style="margin:0 0 8px;font-family:var(--f-mono)">{prog.weeks.length} semaines · {fmtDay(prog.start)} → {fmtDay(prog.end)}</p>
      <p class="lead" style="margin:0"><b>{g.l}</b>{g2 ? <> + {g2.l.toLowerCase()}</> : null} · {cfg.days.length} séance{cfg.days.length > 1 ? 's' : ''} par semaine de {cfg.dur} min</p>
      {(() => { const fams = [...new Set(prog.types.map(t => fmtFamily(t, cfg)).filter(Boolean))]; return fams.length ? <p class="small" style="margin:6px 0 0">Formats : {fams.map(f => FAM_LBL[f].replace('Séance de ', '').replace('Muscu · ', '').toLowerCase() + ' en ' + FORMATS[f].find(x => x[0] === fmtOf(f, cfg))[1].toLowerCase()).join(' · ')}</p> : null; })()}
      <div class="phw" role="img" aria-label="Phases du programme">{prog.weeks.map((x, i) => <button type="button" class={'phw-b' + (i === wi ? ' on' : '')} onClick={() => setWi(i)} aria-label={'Semaine ' + (i + 1)}><span class={'tl-bar ' + (PHASE_Z[x.phase] || 'z2')} /><small>{i + 1}</small></button>)}</div>
      <div class="leg" style="margin-top:6px">{[...new Set(prog.weeks.map(x => x.phase))].map(p => <span><i class={PHASE_Z[p] || 'z2'} />{PHASE_LABEL[p]}</span>)}</div>
      <SysCard id={g.sys} />
      <ModelSave cfg={cfg} />
    </section>
    {prog.warnings.length > 0 && <div class="guard">Règle des 48 h : {prog.warnings.map(x => DOW_L[x.d].toLowerCase() + ' et ' + DOW_L[x.d2].toLowerCase() + ' (' + groupsTxt(x.groups) + ')').join(' ; ')}. Avec ces jours imposés, deux séances dures se suivent : allège l’une des deux ou décale un jour si tu peux.</div>}
    <div class="wk-nav" style="margin:0"><button class="icon-btn" disabled={wi === 0} aria-label="Semaine précédente" onClick={() => setWi(wi - 1)}><Icon name="left" /></button>
      <div class="lbl"><b>Semaine {wi + 1}</b> · {PHASE_LABEL[w.phase]}{w.light ? ' (décharge)' : w.taper ? ' (affûtage)' : ''}</div>
      <button class="icon-btn" disabled={wi === prog.weeks.length - 1} aria-label="Semaine suivante" onClick={() => setWi(wi + 1)}><Icon name="right" /></button></div>
    {Object.keys(w.days).map(d => {
      const s = w.days[d], k = addDays(w.start, +d), past = k < t;
      return <section class={'card pv-day' + (past ? ' past' : '')}>
        <div class="pv-h"><span class="pv-d">{fmtShort(k)}</span><b>{s.short}</b>{past && <small>passé</small>}</div>
        {s.blocks.map(b => <div class="pv-b" style={'--c:var(--k-' + b.kind + ')'}>
          {(b.items || []).filter(it => it.id !== 'ech' && it.id !== 'rac').map(it => <div class="pv-i">
            <span class="pv-n">{it.n > 1 || it.unit ? it.n + ' ×' : ''}</span>
            <span class="pv-t"><b>{it.label}</b>{it.det && <small>{it.det}{it.rest ? ' · repos ' + (it.rest >= 60 ? Math.floor(it.rest / 60) + ' min' + (it.rest % 60 ? ' ' + (it.rest % 60) : '') : it.rest + ' s') : ''}</small>}</span>
            {it.lib && alternatives(it.lib, cfg).length > 0 && !past && <button type="button" class="btn ghost pv-sw" onClick={() => setSwap(it.lib)}>Changer</button>}
          </div>)}
        </div>)}
      </section>;
    })}
    <p class="small" style="margin:0">{nSes} séances seront écrites dans {isSelf() ? 'ton plan' : 'le plan de ' + nameOf(getSubject())}. Tout reste modifiable ensuite, jour par jour.</p>
    {swap && <Sheet title="Remplacer" onClose={() => setSwap(null)}>
      <div class="stack">
        <p class="small" style="margin:0">À la place de <b>{LIB_BY_ID[swap].n}</b>, dans tout le programme :</p>
        <div class="list">{alternatives(swap, cfg).map(x => <button class="li" onClick={() => { set({ swap: Object.assign({}, cfg.swap, { [swap]: x.id }) }); setSwap(null); }}><span style="min-width:0">{x.n}<small>{x.c}</small></span><span class="r" /></button>)}</div>
      </div>
    </Sheet>}
  </div>;
}

function ModelSave({ cfg }) {
  const [name, setName] = useState(''), [open, setOpen] = useState(false);
  if (!open) return <button type="button" class="btn ghost" style="align-self:flex-start" onClick={() => { setName(GOAL_BY_ID[cfg.goal].l + ' · ' + cfg.days.length + ' j'); setOpen(true); }}>Enregistrer ces réglages comme modèle</button>;
  return <div style="display:flex;gap:8px;align-items:flex-end"><label class="fld" style="flex:1">Nom du modèle<input class="in" value={name} onInput={e => setName(e.target.value)} /></label>
    <button class="btn" disabled={!name.trim()} onClick={() => { saveModel(name.trim(), cfg); setOpen(false); toast('Modèle enregistré'); }}>OK</button></div>;
}

const STEPS = ['goal', 'days', 'equip', 'level', 'preview'];
const TITLES = { goal: 'Objectif', quiz: 'Trouver ton objectif', days: 'Disponibilités', equip: 'Matériel et dates', level: 'Niveau et formats', preview: 'Aperçu' };
export function Builder({ onClose }) {
  const [cfg, setCfg] = useState(initial), [step, setStep] = useState('goal'), [ask, setAsk] = useState(null);
  const set = patch => setCfg(c => Object.assign({}, c, patch));
  const prog = useMemo(() => (step === 'preview' && cfg.goal ? generate(cfg) : null), [step, cfg]);
  const idx = STEPS.indexOf(step === 'quiz' ? 'goal' : step);
  const err = step === 'goal' && !cfg.goal ? 'Choisis un objectif (ou réponds au quiz).' : step === 'days' && !cfg.days.length ? 'Choisis au moins un jour.' : step === 'equip' && cfg.event && diffDays(cfg.start, cfg.event) < 13 ? 'La date de l’objectif doit être au moins deux semaines après le début.' : '';
  const next = () => {
    if (err) { toast(err); return; }
    if (step === 'level') { try { localStorage.setItem(prefKey(), JSON.stringify({ days: cfg.days, fixed: cfg.fixed, fixedLbl: cfg.fixedLbl, dur: cfg.dur, lvl: cfg.lvl, equip: cfg.equip, weeks: cfg.weeks, fmt: cfg.fmt })); } catch (_) {} }
    setStep(STEPS[idx + 1]); document.querySelector('.sheet-b') && (document.querySelector('.sheet-b').scrollTop = 0);
  };
  const back = () => { if (step === 'quiz') setStep('goal'); else if (idx > 0) setStep(STEPS[idx - 1]); else onClose(); };
  const save = mode => {
    const n = writeProgram(prog, mode);
    toast('Programme ajouté : ' + n + ' séance' + (n > 1 ? 's' : ''));
    onClose(true);
  };
  const add = () => { const c = conflicts(prog); if (c.length) setAsk(c); else save('replace'); };
  return (
    <Sheet title={TITLES[step]} onClose={() => onClose(false)} right={<span class="eyebrow">{idx + 1}/{STEPS.length}</span>}>
      <div class="stack builder">
        {step === 'goal' && <GoalStep cfg={cfg} set={set} onQuiz={() => setStep('quiz')} onModel={m => { set(Object.assign({}, m.cfg, { swap: m.cfg.swap || {}, fixed: m.cfg.fixed || [], start: nextMonday(), event: null })); setStep('preview'); }} />}
        {step === 'quiz' && <QuizStep cfg={cfg} set={set} onDone={() => setStep('days')} />}
        {step === 'days' && <DaysStep cfg={cfg} set={set} />}
        {step === 'equip' && <EquipStep cfg={cfg} set={set} />}
        {step === 'level' && <LevelStep cfg={cfg} set={set} />}
        {step === 'preview' && prog && <Preview cfg={cfg} set={set} prog={prog} />}
        {ask && <section class="card"><h3 class="h3">Séances déjà prévues</h3>
          <p class="small" style="margin:0 0 10px">{ask.length} jour{ask.length > 1 ? 's ont' : ' a'} déjà une séance sur cette période (à partir du {fmtDay(ask[0])}).</p>
          <div class="stack" style="gap:8px">
            <button class="btn primary" onClick={() => save('replace')}>Remplacer par le programme</button>
            <button class="btn" onClick={() => save('merge')}>Garder et ajouter le programme à côté</button>
            <button class="btn ghost" onClick={() => setAsk(null)}>Annuler</button>
          </div></section>}
        {!ask && <div class="row-btns builder-nav">
          <button class="btn" style="flex:1" onClick={back}>{idx === 0 && step !== 'quiz' ? 'Annuler' : 'Retour'}</button>
          {step === 'preview' ? <button class="btn primary" style="flex:2" onClick={add}>Ajouter au plan</button>
            : step !== 'quiz' && <button class="btn primary" style="flex:2" onClick={next}>Continuer</button>}
        </div>}
      </div>
    </Sheet>
  );
}

// Bouton d'entrée, réutilisé dans l'écran Plan et au premier lancement
export function BuilderEntry({ big, compact, onDone }) {
  const [open, setOpen] = useState(false);
  return <>
    {big ? <button class="btn big primary" onClick={() => setOpen(true)}><Icon name="flask" size={20} />Créer mon programme</button>
      : compact ? <button class="btn" onClick={() => setOpen(true)}><Icon name="flask" size={18} />Assistant</button>
      : <button type="button" class="card li-card" onClick={() => setOpen(true)}><Icon name="flask" /><span><b>Assistant de programme</b><small>Objectif, filières, exercices, repos et progression, écrits dans ton plan</small></span><span class="chev r" aria-hidden="true" /></button>}
    {open && <Builder onClose={ok => { setOpen(false); if (ok && onDone) onDone(); }} />}
  </>;
}
