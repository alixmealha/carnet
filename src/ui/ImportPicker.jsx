import { useRef, useState } from 'preact/hooks';
import { readImport, applyImport, filterImport } from '../lib/io.js';
import { toast } from './kit.jsx';

export function ImportPicker({ onDone, label, secondary }) {
  const ref = useRef(null);
  const [pending, setPending] = useState(null), [err, setErr] = useState('');
  const pick = async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    setErr('');
    try { setPending(await readImport(f)); } catch (x) { setErr(x.message); }
  };
  return (
    <div class="stack" style="gap:10px">
      <input ref={ref} type="file" accept="application/json,.json" hidden onChange={pick} />
      {!pending && <button class={'btn big' + (secondary ? '' : ' primary')} onClick={() => ref.current.click()}>{label || 'Choisir le fichier'}</button>}
      {err && <p class="err" role="alert">{err}</p>}
      {pending && <div class="card">
        <p style="margin:0">{pending.n.plan ? 'Plan, ' : ''}{pending.n.days} jours de séances, {pending.n.journal} jours de journal{pending.n.tests ? ', ' + pending.n.tests + ' passations de tests' : ''}.</p>
        <p class="small">Les jours déjà présents ici sont remplacés par ceux du fichier.</p>
        {(() => { const sk = filterImport(pending.docs).skipped; return <>
          {sk.journal > 0 && <p class="small">{sk.journal} jour{sk.journal > 1 ? 's' : ''} de journal déjà rempli{sk.journal > 1 ? 's' : ''} par l’athlète : conservé{sk.journal > 1 ? 's' : ''} tel{sk.journal > 1 ? 's' : ''} quel{sk.journal > 1 ? 's' : ''}.</p>}
          {sk.plan > 0 && <p class="small">Ton plan est verrouillé par ton coach : le plan et les séances du fichier ne seront pas importés.</p>}
        </>; })()}
        <div class="row-btns" style="margin-top:12px">
          <button class="btn" style="flex:1" onClick={() => setPending(null)}>Annuler</button>
          <button class="btn primary" style="flex:2" onClick={() => { applyImport(pending.docs); setPending(null); toast('Import terminé'); onDone && onDone(); }}>Importer</button>
        </div>
      </div>}
    </div>
  );
}
