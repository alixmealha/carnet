// Exercices du plan, rangés par type de séance : un appui renomme un exercice partout (onglet Plan → Programme).
import { useState } from 'preact/hooks';
import { canEditPlan } from '../lib/store.js';
import { exerciseNames, renameExercise, KIND, KIND_ORDER } from '../lib/plan.js';
import { fmtDay } from '../lib/dates.js';
import { Sheet, Fold, toast } from './kit.jsx';
import { Switch } from '../screens/Settings.jsx';

function RenameSheet({ ex, onClose }) {
  const [v, setV] = useState(ex.label), [fut, setFut] = useState(true);
  return (
    <Sheet title="Renommer" onClose={onClose} right={<button class="btn primary" disabled={!v.trim() || v.trim() === ex.label} onClick={() => { const n = renameExercise(ex.label, v.trim(), fut); toast(n + ' séance' + (n > 1 ? 's' : '') + ' modifiée' + (n > 1 ? 's' : '')); onClose(); }}>OK</button>}>
      <div class="stack">
        <label class="fld">Nouveau nom<input class="in" value={v} onInput={e => setV(e.target.value)} /></label>
        <div class="list"><Switch label="À partir d’aujourd’hui seulement" sub="Les séances passées gardent l’ancien nom" on={fut} onChange={setFut} /></div>
        <p class="small" style="margin:0">Pratique pour changer d’exercice sur tout le plan d’un coup, par exemple presse épaule → dips. Pour modifier les charges, passe par les semaines ci-dessus.</p>
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
    <Fold id="plan-exos" title="Exercices" summary={exs.length + ' exercice' + (exs.length > 1 ? 's' : '') + (ed ? ' · un appui pour renommer partout' : '')}>
      <div class="plan-exos" style="margin-top:-6px">
        {cats.map(k => <details class="fold ex-cat">
          <summary><span class="kdot" style={'background:var(--k-' + k + ')'} /><span style="flex:1;font-weight:600">{KIND[k]}</span><span class="muted" style="font-size:13px;margin-right:8px">{groups[k].length}</span></summary>
          <div class="list" style="margin:8px 0 4px">{groups[k].map(x => <button class="li" disabled={!ed} onClick={() => setRen(x)}><span style="min-width:0">{x.label}<small>{x.n} séance{x.n > 1 ? 's' : ''} · du {fmtDay(x.first)} au {fmtDay(x.last)}</small></span><span class="r" /></button>)}</div>
        </details>)}
      </div>
      {ren && <RenameSheet ex={ren} onClose={() => setRen(null)} />}
    </Fold>
  );
}
