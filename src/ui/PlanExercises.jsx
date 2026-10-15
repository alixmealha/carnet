// Exercices du plan, rangés par type de séance : un appui renomme un exercice partout (onglet Plan → Programme).
import { useState } from 'preact/hooks';
import { canEditPlan } from '../lib/store.js';
import { exerciseNames, renameExercise, KIND, KIND_ORDER, demoOf, setDemo, okUrl } from '../lib/plan.js';
import { fmtDay } from '../lib/dates.js';
import { Sheet, Fold, toast } from './kit.jsx';
import { Switch } from '../screens/Settings.jsx';

function RenameSheet({ ex, onClose }) {
  const d0 = demoOf({ label: ex.label }) || '';
  const [v, setV] = useState(ex.label), [fut, setFut] = useState(true), [vid, setVid] = useState(d0);
  const nameCh = v.trim() && v.trim() !== ex.label, vidCh = vid.trim() !== d0, badVid = vid.trim() && !okUrl(vid);
  const save = () => {
    const to = nameCh ? v.trim() : ex.label;
    if (nameCh) { const n = renameExercise(ex.label, to, fut); toast(n + ' séance' + (n > 1 ? 's' : '') + ' modifiée' + (n > 1 ? 's' : '')); }
    if (vidCh || (nameCh && vid.trim())) { if (nameCh) setDemo(ex.label, ''); setDemo(to, vid.trim()); if (!nameCh) toast(vid.trim() ? 'Vidéo de démo ajoutée' : 'Vidéo retirée'); }
    onClose();
  };
  return (
    <Sheet title="Exercice" onClose={onClose} right={<button class="btn primary" disabled={!(nameCh || vidCh) || badVid} onClick={save}>OK</button>}>
      <div class="stack">
        <label class="fld">Nom<input class="in" value={v} onInput={e => setV(e.target.value)} /></label>
        {nameCh && <div class="list"><Switch label="À partir d’aujourd’hui seulement" sub="Les séances passées gardent l’ancien nom" on={fut} onChange={setFut} /></div>}
        <label class="fld">Vidéo de démo <small>lien Instagram, TikTok, YouTube…</small><input class="in" type="url" inputmode="url" value={vid} placeholder="https://" onInput={e => setVid(e.target.value)} /></label>
        {badVid && <p class="err" style="margin:0">Colle un lien complet, qui commence par https://</p>}
        <p class="small" style="margin:0">Renommer sert à changer d’exercice sur tout le plan d’un coup, par exemple presse épaule → dips. La vidéo s’ouvre d’un appui sur la fiche du jour et en séance{'.'}</p>
      </div>
    </Sheet>
  );
}

export function PlanExercises() {
  const [ren, setRen] = useState(null);
  const exs = exerciseNames();
  const groups = {};
  for (const x of exs) { const k = KIND_ORDER.find(kd => x.kinds.has(kd)) || 'autre'; (groups[k] = groups[k] || []).push(x); }
  const cats = KIND_ORDER.filter(k => groups[k]);
  if (!cats.length) return null;
  const ed = canEditPlan();
  return (
    <Fold id="plan-exos" title="Exercices" summary={exs.length + ' exercice' + (exs.length > 1 ? 's' : '') + (ed ? ' · nom et vidéo de démo' : '')}>
      <div class="plan-exos" style="margin-top:-6px">
        {cats.map(k => <details class="fold ex-cat">
          <summary><span class="kdot" style={'background:var(--k-' + k + ')'} /><span style="flex:1;font-weight:600">{KIND[k]}</span><span class="muted" style="font-size:13px;margin-right:8px">{groups[k].length}</span></summary>
          <div class="list" style="margin:8px 0 4px">{groups[k].map(x => <button class="li" disabled={!ed} onClick={() => setRen(x)}><span style="min-width:0">{x.label}<small>{x.n} séance{x.n > 1 ? 's' : ''} · du {fmtDay(x.first)} au {fmtDay(x.last)}{demoOf({ label: x.label }) ? ' · vidéo' : ''}</small></span><span class="r" /></button>)}</div>
        </details>)}
      </div>
      {ren && <RenameSheet ex={ren} onClose={() => setRen(null)} />}
    </Fold>
  );
}
