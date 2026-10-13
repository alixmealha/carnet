import { useRef, useState } from 'preact/hooks';
import { readImport, applyImport, filterImport } from '../lib/io.js';
import { toast } from './kit.jsx';
import { fmtDay } from '../lib/dates.js';

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
        {pending.patch ? <>
          <p style="margin:0"><b>{pending.patch.title}</b></p>
          {pending.n.days ? <p class="small">{pending.n.days} séance{pending.n.days > 1 ? 's' : ''} à venir modifiée{pending.n.days > 1 ? 's' : ''} ({pending.n.first === pending.n.last ? 'le ' + fmtDay(pending.n.first) : 'du ' + fmtDay(pending.n.first) + ' au ' + fmtDay(pending.n.last)}). Exercices concernés : {pending.patch.what.join(', ')}.</p>
            : <p class="small">Aucune séance à venir n’est concernée (ou la modification est déjà en place).</p>}
          <p class="small">Le reste du plan et ton journal ne changent pas. Les séances passées non plus.</p>
        </> : <>
          <p style="margin:0">{pending.n.plan ? 'Plan, ' : ''}{pending.n.days} jours de séances, {pending.n.journal} jours de journal{pending.n.tests ? ', ' + pending.n.tests + ' passations de tests' : ''}.</p>
          <p class="small">Les jours déjà présents ici sont remplacés par ceux du fichier.</p>
        </>}
        {(() => { const sk = filterImport(pending.docs).skipped; return <>
          {sk.journal > 0 && <p class="small">{sk.journal} jour{sk.journal > 1 ? 's' : ''} de journal déjà rempli{sk.journal > 1 ? 's' : ''} par l’athlète : conservé{sk.journal > 1 ? 's' : ''} tel{sk.journal > 1 ? 's' : ''} quel{sk.journal > 1 ? 's' : ''}.</p>}
          {sk.plan > 0 && <p class="small">Ton plan est verrouillé par ton coach : le plan et les séances du fichier ne seront pas importés.</p>}
        </>; })()}
        <div class="row-btns" style="margin-top:12px">
          <button class="btn" style="flex:1" onClick={() => setPending(null)}>Annuler</button>
          <button class="btn primary" style="flex:2" disabled={pending.patch && !pending.n.days} onClick={() => { applyImport(pending.docs); setPending(null); toast(pending.patch ? 'Programme modifié' : 'Import terminé'); onDone && onDone(); }}>{pending.patch ? 'Appliquer' : 'Importer'}</button>
        </div>
      </div>}
    </div>
  );
}
