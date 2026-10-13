import { useState } from 'preact/hooks';
import { CATS, allTests, testById, valueKeys, history, lastResult, pct, relValue, testDays, resultsOn, saveCustomTest, deleteCustomTest, saveResults } from '../lib/tests.js';
import { todayKey, fmtShort, fmtDay, fmtNum, dom, MON_S } from '../lib/dates.js';
import { Sheet, Fold, Icon, Src, toast } from '../ui/kit.jsx';
import { Chart, linePath } from '../ui/charts.jsx';
import { TestEntry } from './DayView.jsx';
import { relevantTestCats } from '../lib/sports.js';

const f1 = x => fmtNum(Math.round(x * 10) / 10);
const sideName = { D: 'droite', G: 'gauche' };
function Delta({ p }) { if (p === null || isNaN(p)) return null; return <b class={'delta ' + (p > 0.05 ? 'up' : p < -0.05 ? 'down' : 'eq')}>{p > 0 ? '+' : ''}{f1(p)} %</b>; }
function fmtVals(t, vals) {
  return valueKeys(t).filter(vk => typeof vals[vk.key] === 'number').map(vk => (vk.side ? vk.side + ' ' : vk.label ? vk.label + ' ' : '') + fmtNum(vals[vk.key]) + (vk.unit ? ' ' + vk.unit : '')).join(' · ');
}

/* ---------- Historique d'un test ---------- */
function TestChart({ t, h }) {
  const vks = valueKeys(t).filter(vk => h.some(x => typeof x.vals[vk.key] === 'number'));
  if (h.length < 2 || !vks.length) return null;
  const all = h.flatMap(x => vks.map(vk => x.vals[vk.key]).filter(v => typeof v === 'number'));
  const lo0 = Math.min(...all), hi0 = Math.max(...all), span = Math.max(1, hi0 - lo0);
  const st = span > 40 ? 10 : span > 16 ? 5 : span > 6 ? 2 : span > 2.5 ? 1 : 0.5;
  const lo = Math.floor((lo0 - st) / st) * st, hi = Math.ceil((hi0 + st) / st) * st;
  const ticks = []; for (let v = Math.max(0, lo); v <= hi + 1e-9; v += st) ticks.push(Math.round(v * 10) / 10);
  const colors = ['var(--accent)', 'var(--k-doigts)', 'var(--k-kine)', 'var(--k-epaule)'];
  return <>
    {vks.length > 1 && <div class="leg" style="margin:4px 0 6px">{vks.map((vk, i) => <span><i style={'background:' + colors[i]} />{vk.label || 'Résultat'}</span>)}</div>}
    <Chart n={h.length} height={160} yMin={Math.max(0, lo)} yMax={hi} ticks={ticks} fmtY={v => fmtNum(v)} padL={38} minLabelGap={46}
      xLabels={h.map(x => dom(x.k) + ' ' + MON_S[+x.k.slice(5, 7) - 1].replace('.', ''))}
      tip={i => fmtShort(h[i].k) + '\n' + fmtVals(t, h[i].vals)}
      draw={c => <g>{vks.map((vk, j) => { const pts = h.map((x, i) => [i, x.vals[vk.key]]).filter(p => typeof p[1] === 'number'); return <g>
        <path d={linePath(pts.map(p => [c.cx(p[0]), c.y(p[1])]))} fill="none" stroke={colors[j]} stroke-width="2" />
        {pts.map(p => <circle cx={c.cx(p[0])} cy={c.y(p[1])} r="4" fill={colors[j]} stroke="var(--surface)" stroke-width="1.5" />)}
      </g>; })}</g>} />
  </>;
}

function TestSheet({ tid, onClose, onAdd, onOpenDay }) {
  const [edit, setEdit] = useState(false);
  const t = testById(tid); if (!t) return null;
  const h = history(tid), vks = valueKeys(t);
  const first = h[0], last = h[h.length - 1], prev = h[h.length - 2];
  const better = vks[0] && vks[0].better === 'down' ? -1 : 1;
  return (
    <Sheet title={t.name} onClose={onClose} right={<button class="btn primary" onClick={() => onAdd(tid)}>Ajouter</button>}>
      <div class="stack">
        {last ? <section class="card">
          <h3 class="h3">Dernier résultat <em>{fmtShort(last.k)}</em></h3>
          <div class="res-grid">{vks.filter(vk => typeof last.vals[vk.key] === 'number').map(vk => {
            const v = last.vals[vk.key], rel = relValue(t, v, last.bw);
            return <div class="res">
              <span class="k">{vk.label || 'Résultat'}</span>
              <b class="num">{fmtNum(v)}<small> {vk.unit}</small></b>
              {rel !== null && <span class="s">{f1(rel)} % du poids de corps</span>}
              {prev && typeof prev.vals[vk.key] === 'number' && <span class="s">vs précédent <Delta p={pct(v, prev.vals[vk.key]) * better} /></span>}
              {h.length > 2 && typeof first.vals[vk.key] === 'number' && <span class="s">vs premier ({fmtDay(first.k)}) <Delta p={pct(v, first.vals[vk.key]) * better} /></span>}
            </div>;
          })}</div>
          {t.id === 'er-90' || t.id === 'ir-90' ? <RatioNote k={last.k} /> : null}
          <TestChart t={t} h={h} />
        </section> : <div class="empty">Pas encore de résultat. Touche « Ajouter » après une passation.</div>}
        {h.length > 0 && <section class="card flat">
          <div style="padding:14px 14px 4px"><h3 class="h3" style="margin:0">Historique</h3></div>
          {h.slice().reverse().map((x, i, arr) => { const p = arr[i + 1]; return <button class="jrow" onClick={() => onOpenDay && onOpenDay(x.k)}>
            <span class="t">{fmtShort(x.k)}<span>{x.bw ? 'poids ' + fmtNum(x.bw) + ' kg' : ''}</span></span>
            <span class="m">{vks.filter(vk => typeof x.vals[vk.key] === 'number').map(vk => <span>{(vk.label || 'Résultat')} <b>{fmtNum(x.vals[vk.key])} {vk.unit}</b>{p && typeof p.vals[vk.key] === 'number' ? <> <Delta p={pct(x.vals[vk.key], p.vals[vk.key]) * better} /></> : null}</span>)}</span>
            {x.note && <span class="nt">{x.note}</span>}
          </button>; })}
        </section>}
        <section class="card">
          <h3 class="h3">Protocole</h3>
          {t.proto && t.proto.length ? <ol class="proto">{t.proto.map(p => <li>{p}</li>)}</ol> : <p class="small" style="margin:0">{t.desc || 'Pas de protocole écrit.'}</p>}
          {t.equip && <p class="small"><b style="color:var(--ink)">Matériel.</b> {t.equip}</p>}
          {t.tips && <p class="small"><b style="color:var(--ink)">À savoir.</b> {t.tips}</p>}
          {t.src && t.src.length > 0 && <p class="small">Références : <Src ids={t.src} /></p>}
          <p class="small">Mêmes conditions à chaque passation : même heure, même échauffement, même ordre, 48 h sans séance dure.</p>
        </section>
        {t.custom && <div class="row-btns"><button class="btn" onClick={() => setEdit(true)}>Modifier ce test</button><button class="btn danger" onClick={() => { if (confirm('Supprimer ce test ? Les résultats déjà notés restent dans l’historique.')) { deleteCustomTest(tid); onClose(); } }}>Supprimer</button></div>}
      </div>
      {edit && <CustomTestSheet t={t} onClose={() => setEdit(false)} />}
    </Sheet>
  );
}
function RatioNote({ k }) {
  const r = resultsOn(k).res || {}, ir = r['ir-90'], er = r['er-90'];
  if (!ir || !er) return null;
  const parts = ['D', 'G'].filter(s => ir['v.' + s] && er['v.' + s]).map(s => sideName[s] + ' ' + f1(er['v.' + s] / ir['v.' + s] * 100) + ' %');
  return parts.length ? <p class="small">Rapport RE/RI : {parts.join(' · ')}. Une rotation externe nettement plus faible que l’interne est associée à plus de blessures d’épaule <Src ids={['byram2010']} />.</p> : null;
}

/* ---------- Saisie d'une passation ---------- */
function EntrySheet({ k0, pre, onClose }) {
  const [k, setK] = useState(k0 || todayKey());
  const done = Object.keys(resultsOn(k).res || {});
  const [sel, setSel] = useState(() => [...new Set([...(pre || []), ...done])]);
  const [cat, setCat] = useState(null);
  const tests = allTests();
  const [note, setNote] = useState(resultsOn(k).note || '');
  return (
    <Sheet title="Passation de tests" onClose={() => { saveResults(k, { note: note.trim() || undefined }); onClose(); }} right={<button class="btn primary" onClick={() => { saveResults(k, { note: note.trim() || undefined }); toast('Résultats enregistrés'); onClose(); }}>OK</button>}>
      <div class="stack">
        <label class="fld">Date<input class="in mono" type="date" value={k} onInput={e => { if (e.target.value) { setK(e.target.value); setSel([...new Set([...sel, ...Object.keys(resultsOn(e.target.value).res || {})])]); setNote(resultsOn(e.target.value).note || ''); } }} /></label>
        <div>
          <p class="sub-lbl" style="margin-top:0">Tests de la passation <small>{sel.length ? sel.length + ' choisi' + (sel.length > 1 ? 's' : '') : 'touche pour ajouter'}</small></p>
          <div class="chipsel" style="margin-bottom:8px">{CATS.filter(([c]) => tests.some(t => t.cat === c)).map(([c, l]) => <button type="button" class="chip sel" style="flex:none" aria-pressed={cat === c ? 'true' : 'false'} onClick={() => setCat(cat === c ? null : c)}>{l}</button>)}</div>
          {cat && <div class="chips">{tests.filter(t => t.cat === cat).map(t => <button type="button" class="chip sel" aria-pressed={sel.includes(t.id) ? 'true' : 'false'} onClick={() => setSel(sel.includes(t.id) ? sel.filter(x => x !== t.id) : sel.concat([t.id]))}>{t.name}</button>)}</div>}
        </div>
        {sel.length > 0 ? <TestEntry k={k} tids={sel} key={k + sel.join(',')} /> : <div class="empty">Choisis une catégorie puis les tests réalisés.</div>}
        <label class="fld">Note de la passation<textarea class="in" value={note} placeholder="Conditions, heure, sensations, matériel…" onInput={e => setNote(e.target.value)} /></label>
      </div>
    </Sheet>
  );
}

/* ---------- Créer / modifier un test ---------- */
function CustomTestSheet({ t, onClose }) {
  const [d, setD] = useState(() => t ? { ...t, proto: (t.proto || []).join('\n') } : { id: 'perso-' + Math.random().toString(36).slice(2, 7), name: '', unit: '', sides: false, better: 'up', proto: '', equip: '' });
  const set = patch => setD(Object.assign({}, d, patch));
  const save = () => {
    if (!d.name.trim()) { toast('Donne un nom au test'); return; }
    saveCustomTest({ id: d.id, name: d.name.trim(), unit: d.unit.trim(), sides: !!d.sides, cat: 'perso', measures: [{ k: 'v', l: 'Résultat', unit: d.unit.trim(), better: d.better }], proto: d.proto.split('\n').map(x => x.trim()).filter(Boolean), equip: d.equip.trim() || undefined });
    toast('Test enregistré'); onClose();
  };
  return (
    <Sheet title={t ? 'Modifier le test' : 'Nouveau test'} onClose={onClose} right={<button class="btn primary" onClick={save}>OK</button>}>
      <div class="stack">
        <label class="fld">Nom<input class="in" value={d.name} placeholder="Ex. Suspension max 15 mm" onInput={e => set({ name: e.target.value })} /></label>
        <div class="grid2">
          <label class="fld">Unité<input class="in" value={d.unit} placeholder="kg, s, cm, rép.…" onInput={e => set({ unit: e.target.value })} /></label>
          <label class="fld">Meilleur résultat<select class="in" value={d.better} onChange={e => set({ better: e.target.value })}><option value="up">Plus haut = mieux</option><option value="down">Plus bas = mieux</option></select></label>
        </div>
        <label class="set" style="padding:4px 0;border:0"><span>Côté droit et gauche séparés</span><input type="checkbox" class="sw" checked={d.sides} onChange={e => set({ sides: e.target.checked })} /></label>
        <label class="fld">Matériel<input class="in" value={d.equip} onInput={e => set({ equip: e.target.value })} /></label>
        <label class="fld">Protocole (une étape par ligne)<textarea class="in" style="min-height:140px" value={d.proto} onInput={e => set({ proto: e.target.value })} /></label>
      </div>
    </Sheet>
  );
}

/* ---------- Vue Tests ---------- */
export function TestsView({ onOpenDay, focus }) {
  const [sheet, setSheet] = useState(focus ? { t: 'test', id: focus } : null);
  const tests = allTests(), days = testDays().slice().reverse();
  const done = new Set(); for (const d of testDays()) for (const id of Object.keys(resultsOn(d).res || {})) done.add(id);
  // Catégories utiles pour les sports du profil ; les autres derrière un bouton (sauf si déjà des résultats)
  const rel = relevantTestCats(), [all, setAll] = useState(false);
  const visible = c => !rel || all || rel.has(c) || tests.some(t => t.cat === c && done.has(t.id));
  const hiddenN = CATS.filter(([c]) => !visible(c) && tests.some(t => t.cat === c)).length;
  return (
    <div class="stack">
      <div class="row-btns">
        <button class="btn primary" style="flex:2" onClick={() => setSheet({ t: 'entry' })}><Icon name="plus" size={18} />Nouvelle passation</button>
        <button class="btn" style="flex:1" onClick={() => setSheet({ t: 'custom' })}>Créer un test</button>
      </div>
      {days.length > 0 && <Fold id="tests-days" title="Passations" open summary={days.length + ' passation' + (days.length > 1 ? 's' : '') + ' · dernière le ' + fmtDay(days[0])} cls="flat-b">
        {days.slice(0, 12).map(d => { const res = resultsOn(d).res || {}, idsD = Object.keys(res); return <button class="jrow" onClick={() => setSheet({ t: 'entry', k: d })}>
          <span class="t">{fmtShort(d)}<span>{idsD.length} test{idsD.length > 1 ? 's' : ''}</span></span>
          <span class="nt" style="white-space:normal">{idsD.map(id => (testById(id) || { name: id }).name).join(' · ')}</span>
        </button>; })}
      </Fold>}
      {CATS.map(([c, l]) => {
        const list = tests.filter(t => t.cat === c); if (!list.length || !visible(c)) return null;
        const n = list.filter(t => done.has(t.id)).length;
        return <Fold key={c + (n > 0 ? '1' : '0')} id={'tests-cat-' + c} title={l} open={n > 0} summary={list.length + ' test' + (list.length > 1 ? 's' : '') + (n ? ' · ' + n + ' avec résultats' : '')} cls="flat-b">
          {list.map(t => {
            const h = history(t.id), last = h[h.length - 1], prev = h[h.length - 2], vk = valueKeys(t)[0];
            const better = vk && vk.better === 'down' ? -1 : 1;
            return <button class="li" onClick={() => setSheet({ t: 'test', id: t.id })}>
              <span style="min-width:0">{t.name}<small>{last ? fmtShort(last.k) + ' · ' + fmtVals(t, last.vals) : 'Pas encore testé'}</small></span>
              <span class="r">{last && prev && vk && typeof last.vals[vk.key] === 'number' && typeof prev.vals[vk.key] === 'number' ? <Delta p={pct(last.vals[vk.key], prev.vals[vk.key]) * better} /> : null}</span>
            </button>;
          })}
        </Fold>;
      })}
      {hiddenN > 0 && <button class="btn ghost" onClick={() => setAll(true)}>Voir les autres tests ({hiddenN} catégorie{hiddenN > 1 ? 's' : ''})</button>}
      <p class="small" style="text-align:center">Les pourcentages comparent au résultat précédent (côté droit ou première mesure).</p>
      {sheet && sheet.t === 'test' && <TestSheet tid={sheet.id} onClose={() => setSheet(null)} onAdd={id => setSheet({ t: 'entry', pre: [id] })} onOpenDay={onOpenDay} />}
      {sheet && sheet.t === 'entry' && <EntrySheet k0={sheet.k} pre={sheet.pre} onClose={() => setSheet(null)} />}
      {sheet && sheet.t === 'custom' && <CustomTestSheet onClose={() => setSheet(null)} />}
    </div>
  );
}
