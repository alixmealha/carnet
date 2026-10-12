import { useState } from 'preact/hooks';
import { jget, ids } from '../lib/store.js';
import { meta, sessionName, PHASE_LABEL, weekKeys } from '../lib/plan.js';
import { weeksStats, currentWeekIndex, loadSeries, alerts, tiles } from '../lib/stats.js';
import { score, verdict, nightTotal, durLong, durShort, ZONES, RPE, STATUS } from '../lib/rules.js';
import { todayKey, addDays, rangeKeys, fmtShort, fmtDay, dom, MON_S, fmtNum, dow } from '../lib/dates.js';
import { Chart, niceMax, linePath } from '../ui/charts.jsx';
import { TextSeg } from '../ui/kit.jsx';

const fmtInt = n => Math.round(n).toLocaleString('fr-FR');
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

function Card({ title, sub, right, children }) {
  return <section class="card ch-card"><div class="ch-h"><div><h3 class="ch-t">{title}</h3>{sub && <p class="ch-s">{sub}</p>}</div>{right}</div>{children}</section>;
}
const Empty = ({ children }) => <div class="empty">{children}</div>;

/* ---------- Tuiles ---------- */
function Tiles({ ws }) {
  const t = tiles(ws);
  return (
    <div class="tiles">
      <div class="tile"><span class="k">Séances faites</span><b class="num">{t.done}<small>/{t.planned}</small></b><span class="s">depuis le début du plan</span></div>
      <div class="tile"><span class="k">Forme sur 7 jours</span><b class="num">{t.well !== null ? fmtNum(Math.round(t.well * 10) / 10) : '—'}{t.well !== null && <small>/25</small>}</b><span class="s">{t.wellLbl || 'pas encore de données'}</span></div>
      <div class="tile"><span class="k">Sommeil sur 7 jours</span><b class="num">{t.sleep !== null ? durShort(t.sleep) : '—'}</b><span class="s">{t.sleepN ? 'moyenne de ' + t.sleepN + ' nuit' + (t.sleepN > 1 ? 's' : '') : 'nuits non renseignées'}</span></div>
      <div class="tile"><span class="k">Charge de la semaine</span><b class="num">{t.ua ? fmtInt(t.ua) : '—'}{t.ua ? <small> UA</small> : null}</b><span class="s">{t.uaDelta !== null ? (t.uaDelta > 0 ? '+' : '') + t.uaDelta + ' % vs semaine passée' : 'ressenti × durée'}</span></div>
    </div>
  );
}

/* ---------- Alertes ---------- */
function Alerts({ ws, onOpen }) {
  const [all, setAll] = useState(false);
  const a = alerts(ws);
  if (!a.length) return null;
  const shown = all ? a : a.slice(0, 4);
  return (
    <Card title="Signaux" sub="Ce qui mérite ton attention, du plus récent au plus ancien.">
      <div class="stack" style="gap:6px">
        {shown.map(x => <button class="alert" style={'--zc:' + x.c + ';text-align:left;border-top:0;border-right:0;border-bottom:0;width:100%'} onClick={() => onOpen(x.k)}><span class="ad">{fmtShort(x.k)}</span><b>{x.t}</b><span style="flex-basis:100%;color:var(--muted);font-size:13px">{x.d}</span></button>)}
      </div>
      {a.length > 4 && <button class="btn ghost" style="margin-top:6px" onClick={() => setAll(!all)}>{all ? 'Voir moins' : 'Voir les ' + a.length + ' signaux'}</button>}
    </Card>
  );
}

/* ---------- Semaines : prévu / réalisé ---------- */
function PlanVsReal({ ws, ci }) {
  const mx = niceMax(Math.max(10, ...ws.map(x => Math.max(x.plan, x.real || 0))));
  if (!ws.some(x => x.real !== null)) return <Card title="Prévu ou réalisé" sub="Intensité + volume de chaque séance, cumulés sur la semaine."><Empty>Note le profil réalisé (intensité, volume) après tes séances pour voir la comparaison.</Empty></Card>;
  return (
    <Card title="Prévu ou réalisé" sub="Intensité + volume de chaque séance (sur 10), cumulés sur la semaine." right={<div class="leg"><span><i style="background:var(--plan)" />Prévu</span><span><i style="background:var(--accent)" />Réalisé</span></div>}>
      <Chart n={ws.length} yMax={mx.max} ticks={mx.ticks} xLabels={ws.map(x => x.label)} hl={ci}
        tip={i => { const x = ws[i]; return x.label + ' · ' + x.range + '\nPrévu ' + x.plan + (x.real !== null ? ' · réalisé ' + x.real : '') + (x.adherence !== null ? '\nExercices cochés ' + Math.round(x.adherence * 100) + ' %' : ''); }}
        draw={c => ws.map((x, i) => {
          const bw = Math.min(14, c.slot * 0.34), x0 = c.cx(i);
          return <g>
            <rect x={x0 - bw - 1} y={c.y(x.plan)} width={bw} height={c.pt + c.ih - c.y(x.plan)} rx="2" fill="var(--plan)" />
            {x.real !== null && <rect x={x0 + 1} y={c.y(x.real)} width={bw} height={c.pt + c.ih - c.y(x.real)} rx="2" fill="var(--accent)" />}
          </g>;
        })} />
    </Card>
  );
}

/* ---------- Charge interne ---------- */
function Load({ ws, ci }) {
  if (!ws.some(x => x.ua)) return <Card title="Charge interne" sub="Ressenti × durée de chaque séance (UA), par semaine."><Empty>Note le ressenti et la durée de tes séances pour suivre ta charge.</Empty></Card>;
  const mx = niceMax(Math.max(...ws.map(x => x.ua || 0)) * 1.12);
  return (
    <Card title="Charge interne" sub="Ressenti × durée de chaque séance (UA), par semaine. En orange : plus de 30 % de hausse d’un coup." >
      <Chart n={ws.length} yMax={mx.max} ticks={mx.ticks} fmtY={v => v >= 1000 ? fmtNum(v / 1000) + 'k' : v} xLabels={ws.map(x => x.label)} hl={ci}
        tip={i => { const x = ws[i], p = ws[i - 1]; return x.label + ' · ' + x.range + '\n' + (x.ua ? fmtInt(x.ua) + ' UA' + (p && p.ua ? ' (' + (x.ua >= p.ua ? '+' : '') + Math.round((x.ua / p.ua - 1) * 100) + ' %)' : '') : 'Pas de données'); }}
        draw={c => ws.map((x, i) => {
          if (!x.ua) return null;
          const p = ws[i - 1], spike = p && p.ua && x.ua > p.ua * 1.3, bw = Math.min(22, c.slot * 0.6);
          return <g>
            <rect x={c.cx(i) - bw / 2} y={c.y(x.ua)} width={bw} height={c.pt + c.ih - c.y(x.ua)} rx="3" fill={spike ? 'var(--warn)' : 'var(--accent)'} />
            {spike && c.slot >= 26 && <text x={c.cx(i)} y={c.y(x.ua) - 4} text-anchor="middle" font-size="10" font-family="var(--f-mono)" fill="var(--warn)">+{Math.round((x.ua / p.ua - 1) * 100)}%</text>}
          </g>;
        })} />
    </Card>
  );
}

/* ---------- Répartition de l'intensité ---------- */
function Zones({ ws, ci }) {
  if (!ws.some(x => x.tz[0] + x.tz[1] + x.tz[2] > 0)) return <Card title="Répartition de l’intensité" sub="Minutes d’escalade et de doigts selon le ressenti de la séance."><Empty>Ressenti et durée des séances de grimpe : la répartition apparaîtra ici.</Empty></Card>;
  return (
    <Card title="Répartition de l’intensité" sub="Minutes d’escalade et de doigts selon le ressenti. Le trait marque 80 % de facile, en repère seulement pour la force et la puissance."
      right={<div class="leg">{ZONES.map(([l, z, r]) => <span><i class={z} />{l} {r}</span>)}</div>}>
      <Chart n={ws.length} yMax={100} ticks={[0, 50, 100]} fmtY={v => v + '%'} xLabels={ws.map(x => x.label)} hl={ci}
        tip={i => { const x = ws[i], t = x.tz[0] + x.tz[1] + x.tz[2]; if (!t) return x.label + '\nPas de données'; return x.label + ' · ' + x.phase + '\n' + ZONES.map(([l], j) => l + ' ' + x.tz[j] + ' min (' + pct(x.tz[j], t) + ' %)').join('\n'); }}
        draw={c => ws.map((x, i) => {
          const t = x.tz[0] + x.tz[1] + x.tz[2], bw = Math.min(22, c.slot * 0.6), x0 = c.cx(i) - bw / 2;
          const strong = x.w.phase === 'force' || x.w.phase === 'puissance';
          const mark = strong ? <line x1={c.cx(i) - bw / 2 - 3} x2={c.cx(i) + bw / 2 + 3} y1={c.y(80)} y2={c.y(80)} stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="3 2" /> : null;
          if (!t) return mark;
          let acc = 0;
          return <g>{x.tz.map((m, j) => { if (!m) return null; const y1 = c.y(acc / t * 100), y2 = c.y((acc + m) / t * 100); acc += m; return <rect x={x0} y={y2} width={bw} height={y1 - y2} fill={'var(--z' + (j + 1) + ')'} />; })}{mark}</g>;
        })} />
    </Card>
  );
}

/* ---------- Séries journalières ---------- */
function useRange() {
  const [r, setR] = useState('28');
  const m = meta(), t = todayKey();
  const end = m && m.end < t ? m.end : t;
  let start = r === '28' ? addDays(end, -27) : (m ? m.start : addDays(end, -27));
  if (m && start < m.start) start = m.start;
  return [r, setR, rangeKeys(start < end ? start : end, end)];
}
const dayLabel = k => dom(k) === 1 || dow(k) === 0 ? dom(k) + (dom(k) <= 7 ? ' ' + MON_S[+k.slice(5, 7) - 1].replace('.', '') : '') : null;
const RangeSeg = ({ r, setR }) => <div style="width:132px"><TextSeg value={r} onChange={v => v && setR(v)} options={[['28', '28 j'], ['all', 'Tout']]} label="Période" /></div>;

function Wellness() {
  const [r, setR, ks] = useRange();
  const pts = ks.map((k, i) => ({ i, k, v: score(jget(k)) })).filter(p => p.v !== null);
  return (
    <Card title="Forme du matin" sub="Sommeil, fatigue, courbatures, stress, humeur : total sur 25." right={<RangeSeg r={r} setR={setR} />}>
      {pts.length === 0 ? <Empty>Remplis la forme du matin pour voir ta courbe.</Empty> :
        <Chart n={ks.length} yMin={5} yMax={25} ticks={[5, 10, 15, 20, 25]} xLabels={ks.map(dayLabel)} hl={ks.indexOf(todayKey())}
          tip={i => { const v = score(jget(ks[i])); return fmtShort(ks[i]) + '\n' + (v !== null ? v + '/25 · ' + verdict(v).lbl : 'Non renseigné'); }}
          draw={c => <g>
            <rect x={c.pl} y={c.y(25)} width={c.iw} height={c.y(20) - c.y(25)} fill="var(--good)" opacity=".08" />
            <rect x={c.pl} y={c.y(14)} width={c.iw} height={c.y(10) - c.y(14)} fill="var(--warn)" opacity=".08" />
            <rect x={c.pl} y={c.y(10)} width={c.iw} height={c.y(5) - c.y(10)} fill="var(--crit)" opacity=".08" />
            <path d={linePath(pts.map(p => [c.cx(p.i), c.y(p.v)]))} fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" />
            {pts.map(p => <circle cx={c.cx(p.i)} cy={c.y(p.v)} r={c.slot > 9 ? 3.5 : 2.5} fill={verdict(p.v).cls === 'good' ? 'var(--good)' : verdict(p.v).cls === 'warn' ? 'var(--warn)' : verdict(p.v).cls === 'crit' ? 'var(--crit)' : 'var(--accent)'} stroke="var(--surface)" stroke-width="1.5" />)}
          </g>} />}
    </Card>
  );
}

function Sleep() {
  const [r, setR, ks] = useRange();
  const has = ks.some(k => nightTotal(jget(k)) !== null);
  const vf = ks.map((k, i) => ({ i, v: jget(k).nuit && jget(k).nuit.vfc })).filter(p => typeof p.v === 'number');
  const ST = [['profond', 'Profond'], ['leger', 'Léger'], ['rem', 'Paradoxal']];
  const mx = Math.max(540, ...ks.map(k => nightTotal(jget(k)) || 0));
  const top = Math.ceil(mx / 60) * 60;
  return (
    <Card title="Sommeil" sub="Nuits mesurées par phase. Le trait marque 7 h." right={<RangeSeg r={r} setR={setR} />}>
      {!has ? <Empty>Renseigne ta nuit mesurée (Garmin, WHOOP) dans la fiche du jour.</Empty> : <>
        <div class="leg" style="margin-bottom:6px">{ST.map(([s, l]) => <span><i style={'background:var(--s-' + s + ')'} />{l}</span>)}</div>
        <Chart n={ks.length} yMax={top} ticks={[0, 180, 360, 540].filter(t => t <= top)} fmtY={v => v / 60 + 'h'} xLabels={ks.map(dayLabel)} hl={ks.indexOf(todayKey())}
          tip={i => { const e = jget(ks[i]), t = nightTotal(e); if (t === null) return fmtShort(ks[i]) + '\nPas de mesure'; const n = e.nuit; return fmtShort(ks[i]) + ' · ' + durLong(t) + '\n' + ST.filter(([s]) => typeof n[s] === 'number').map(([s, l]) => l + ' ' + durShort(n[s])).join(' · ') + (typeof n.vfc === 'number' ? '\nVFC ' + n.vfc + ' ms' : '') + (typeof n.fcr === 'number' ? ' · FC ' + n.fcr : ''); }}
          draw={c => <g>
            {ks.map((k, i) => {
              const n = jget(k).nuit; if (!n || nightTotal(jget(k)) === null) return null;
              const bw = Math.max(2, Math.min(16, c.slot * 0.66)); let acc = 0;
              return <g>{ST.map(([s]) => { const v = n[s]; if (typeof v !== 'number' || !v) return null; const y1 = c.y(acc), y2 = c.y(acc + v); acc += v; return <rect x={c.cx(i) - bw / 2} y={y2} width={bw} height={y1 - y2} fill={'var(--s-' + s + ')'} />; })}</g>;
            })}
            <line x1={c.pl} x2={c.W - c.pr} y1={c.y(420)} y2={c.y(420)} stroke="var(--ink)" stroke-width="1.2" stroke-dasharray="4 3" />
          </g>} />
        {vf.length >= 2 && <>
          <p class="sub-lbl" style="margin-top:14px">VFC (ms)<small>variabilité cardiaque nocturne : plus haut = mieux récupéré, à comparer à ta propre moyenne</small></p>
          <VfcChart ks={ks} vf={vf} />
        </>}
      </>}
    </Card>
  );
}
function VfcChart({ ks, vf }) {
  const lo = Math.floor((Math.min(...vf.map(p => p.v)) - 5) / 10) * 10, hi = Math.ceil((Math.max(...vf.map(p => p.v)) + 5) / 10) * 10;
  const avg = Math.round(vf.reduce((a, p) => a + p.v, 0) / vf.length);
  const ticks = []; for (let t = lo; t <= hi; t += Math.max(10, Math.round((hi - lo) / 30) * 10)) ticks.push(t);
  return <Chart n={ks.length} height={110} yMin={lo} yMax={hi} ticks={ticks} xLabels={ks.map(dayLabel)}
    tip={i => { const n = jget(ks[i]).nuit; return fmtShort(ks[i]) + '\n' + (n && typeof n.vfc === 'number' ? 'VFC ' + n.vfc + ' ms (moyenne ' + avg + ')' : 'Pas de mesure'); }}
    draw={c => <g>
      <line x1={c.pl} x2={c.W - c.pr} y1={c.y(avg)} y2={c.y(avg)} stroke="var(--muted)" stroke-width="1" stroke-dasharray="2 3" />
      <path d={linePath(vf.map(p => [c.cx(p.i), c.y(p.v)]))} fill="none" stroke="var(--s-rem)" stroke-width="2" />
      {vf.map(p => <circle cx={c.cx(p.i)} cy={c.y(p.v)} r="3" fill="var(--s-rem)" stroke="var(--surface)" stroke-width="1.5" />)}
    </g>} />;
}

/* ---------- Progression des charges ---------- */
function Loads() {
  const series = loadSeries();
  const [sel, setSel] = useState(null);
  if (!series.length) return <Card title="Charges" sub="Progression des charges de muscu, de finger lift et d’épaule."><Empty>Coche tes séries de muscu : les charges utilisées s’afficheront ici, séance après séance.</Empty></Card>;
  const s = series.find(x => x.name === sel) || series[0];
  const vals = s.pts.map(p => p.v), lo0 = Math.min(...vals), hi0 = Math.max(...vals);
  const st = hi0 - lo0 > 20 ? 10 : hi0 - lo0 > 8 ? 5 : 2.5;
  const lo = Math.max(0, Math.floor((lo0 - st) / st) * st), hi = Math.ceil((hi0 + st) / st) * st;
  const ticks = []; for (let t = lo; t <= hi + 1e-9; t += st) ticks.push(t);
  const unit = s.unit === '+kg' ? '+' : '';
  const first = s.pts[0], last = s.pts[s.pts.length - 1];
  return (
    <Card title="Charges" sub="Charge utilisée à chaque séance où l’exercice est coché.">
      <div class="chipsel" role="group" aria-label="Exercice">{series.map(x => <button class="chip sel" aria-pressed={x.name === s.name ? 'true' : 'false'} onClick={() => setSel(x.name)} style="flex:none">{x.name}</button>)}</div>
      <div class="ch-h" style="margin:10px 0 2px"><div class="num" style="font-size:22px">{unit}{fmtNum(last.v)} kg</div><div class="small" style="margin:0">{s.pts.length > 1 ? (last.v - first.v >= 0 ? '+' : '−') + fmtNum(Math.abs(last.v - first.v)) + ' kg depuis le ' + fmtDay(first.k) : 'Première séance le ' + fmtDay(first.k)}</div></div>
      <Chart n={s.pts.length} height={150} yMin={lo} yMax={hi} ticks={ticks} fmtY={v => unit + fmtNum(v)} xLabels={s.pts.map(p => dom(p.k) + ' ' + MON_S[+p.k.slice(5, 7) - 1].replace('.', ''))} padL={38} minLabelGap={44}
        tip={i => { const p = s.pts[i]; return fmtShort(p.k) + '\n' + unit + fmtNum(p.v) + ' kg · ' + p.sets + '/' + p.n + ' séries'; }}
        draw={c => <g>
          <path d={linePath(s.pts.map((p, i) => [c.cx(i), c.y(p.v)]))} fill="none" stroke="var(--k-muscu)" stroke-width="2" />
          {s.pts.map((p, i) => <circle cx={c.cx(i)} cy={c.y(p.v)} r="4" fill={p.sets >= p.n ? 'var(--k-muscu)' : 'var(--surface)'} stroke="var(--k-muscu)" stroke-width="2" />)}
        </g>} />
      <p class="small">Point plein : toutes les séries faites. Point vide : séance incomplète.</p>
    </Card>
  );
}

/* ---------- Tests ---------- */
function Tests({ onOpen }) {
  const m = meta(); const ts = (m && m.tests) || [];
  if (!ts.length) return null;
  const rows = ts.map(k => ({ k, te: jget(k).tests || {} }));
  return (
    <Card title="Tests doigts" sub="Charge maximale par préhension (kg ajoutés ou total, comme tu le notes).">
      <div class="tw" style="margin-top:0"><table class="t">
        <thead><tr><th>Date</th><th>Semi-arqué</th><th>Tendu</th></tr></thead>
        <tbody>{rows.map((r, i) => {
          const p = rows[i - 1] && rows[i - 1].te;
          const d = key => r.te[key] != null && p && p[key] != null ? ' (' + (r.te[key] >= p[key] ? '+' : '−') + fmtNum(Math.abs(Math.round((r.te[key] - p[key]) * 10) / 10)) + ')' : '';
          return <tr onClick={() => onOpen(r.k)} style="cursor:pointer"><td>{fmtShort(r.k)}</td><td class="num">{r.te.semi != null ? fmtNum(r.te.semi) + ' kg' + d('semi') : '—'}</td><td class="num">{r.te.tendu != null ? fmtNum(r.te.tendu) + ' kg' + d('tendu') : '—'}</td></tr>;
        })}</tbody>
      </table></div>
    </Card>
  );
}

/* ---------- Journal ---------- */
function Journal({ onOpen }) {
  const [n, setN] = useState(10);
  const keys = ids('j:').map(id => id.slice(2)).filter(k => { const e = jget(k); return Object.keys(e).length > 0; }).reverse();
  if (!keys.length) return null;
  return (
    <section class="card flat">
      <div style="padding:14px 14px 4px"><h3 class="ch-t">Journal</h3><p class="ch-s">Tous les jours renseignés. Touche une ligne pour ouvrir la fiche.</p></div>
      {keys.slice(0, n).map(k => {
        const e = jget(k), sc = score(e), nt = nightTotal(e), st = STATUS.find(s => s[0] === e.status);
        return (
          <button class="jrow" onClick={() => onOpen(k)}>
            <span class="t">{fmtShort(k)}<span>{sessionName(k)}</span></span>
            <span class="m">
              {sc !== null && <span>Forme <b>{sc}</b></span>}
              {nt !== null && <span>Nuit <b>{durShort(nt)}</b></span>}
              {typeof e.rpe === 'number' && <span>Ressenti <b>{e.rpe}</b></span>}
              {typeof e.duree === 'number' && <span><b>{e.duree}</b> min</span>}
              {typeof e.rpe === 'number' && typeof e.duree === 'number' && <span><b>{fmtInt(e.rpe * e.duree)}</b> UA</span>}
              {st && <span><b>{st[1]}</b></span>}
            </span>
            {e.note && <span class="nt">{e.note}</span>}
          </button>
        );
      })}
      {keys.length > n && <div style="padding:8px 14px 12px"><button class="btn ghost" onClick={() => setN(n + 20)}>Afficher plus</button></div>}
    </section>
  );
}

export function Stats({ onOpen }) {
  const ws = weeksStats(), ci = currentWeekIndex(ws), m = meta();
  return (
    <div class="screen">
      <div class="head"><div><div class="eyebrow">{m ? m.title : ''}</div><h1 class="title">Suivi</h1></div></div>
      <div class="stack">
        <Tiles ws={ws} />
        <Alerts ws={ws} onOpen={onOpen} />
        <PlanVsReal ws={ws} ci={ci} />
        <Load ws={ws} ci={ci} />
        <Zones ws={ws} ci={ci} />
        <Wellness />
        <Sleep />
        <Loads />
        <Tests onOpen={onOpen} />
        <Journal onOpen={onOpen} />
      </div>
    </div>
  );
}
