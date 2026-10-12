import { useState } from 'preact/hooks';
import { syncState, syncNow, settings, setSettings, wipeLocal } from '../lib/store.js';
import { sb, cloud } from '../lib/supa.js';
import { exerciseNames, renameExercise, meta } from '../lib/plan.js';
import { WELL, RPE, ZONES, SIV } from '../lib/rules.js';
import { downloadExport } from '../lib/io.js';
import { fmtDay } from '../lib/dates.js';
import { Sheet, toast } from '../ui/kit.jsx';
import { ImportPicker } from '../ui/ImportPicker.jsx';

const SYNC_LBL = { local: 'Sur cet appareil seulement', idle: 'À jour', syncing: 'Synchronisation…', error: 'Erreur de synchronisation', offline: 'Hors ligne : ça repartira tout seul', signedout: 'Déconnecté' };
const ago = t => { if (!t) return 'jamais'; const s = Math.round((Date.now() - t) / 1000); return s < 60 ? 'à l’instant' : s < 3600 ? 'il y a ' + Math.round(s / 60) + ' min' : 'il y a ' + Math.round(s / 3600) + ' h'; };

function Switch({ label, sub, on, onChange }) {
  return <label class="set"><span>{label}{sub && <small>{sub}</small>}</span><input type="checkbox" class="sw" checked={on} onChange={e => onChange(e.target.checked)} /></label>;
}

function RenameSheet({ ex, onClose }) {
  const [v, setV] = useState(ex.label), [fut, setFut] = useState(true);
  return (
    <Sheet title="Renommer" onClose={onClose} right={<button class="btn primary" disabled={!v.trim() || v.trim() === ex.label} onClick={() => { const n = renameExercise(ex.label, v.trim(), fut); toast(n + ' séance' + (n > 1 ? 's' : '') + ' modifiée' + (n > 1 ? 's' : '')); onClose(); }}>OK</button>}>
      <div class="stack">
        <label class="fld">Nouveau nom<input class="in" value={v} onInput={e => setV(e.target.value)} /></label>
        <div class="list"><Switch label="À partir d’aujourd’hui seulement" sub="Les séances passées gardent l’ancien nom" on={fut} onChange={setFut} /></div>
        <p class="small" style="margin:0">Pratique pour changer d’exercice sur tout le plan d’un coup, par exemple presse épaule → dips. Pour modifier les charges, passe par l’onglet Plan.</p>
      </div>
    </Sheet>
  );
}

export function More({ session }) {
  const s = settings();
  const [ren, setRen] = useState(null), [imp, setImp] = useState(false), [exAll, setExAll] = useState(false);
  const exs = exerciseNames();
  const st = syncState.state;
  return (
    <div class="screen">
      <div class="head"><div><div class="eyebrow">Carnet</div><h1 class="title">Plus</h1></div></div>
      <div class="stack">
        <section class="card">
          <h3 class="h3">Synchronisation <em><span class={'sync ' + st}><i />{SYNC_LBL[st] || st}</span></em></h3>
          {cloud ? <>
            <p class="small" style="margin:0">Connecté avec {session && session.user ? session.user.email : '—'}. Dernière synchro : {ago(syncState.last)}{syncState.pending ? ' · ' + syncState.pending + ' modification' + (syncState.pending > 1 ? 's' : '') + ' en attente' : ''}.</p>
            {st === 'error' && syncState.error && <p class="err" style="margin-top:6px">{syncState.error}</p>}
            <div class="row-btns" style="margin-top:12px">
              <button class="btn" onClick={() => syncNow()}>Synchroniser maintenant</button>
              <button class="btn danger" onClick={async () => { if (syncState.pending && !confirm('Des modifications ne sont pas encore envoyées. Se déconnecter quand même ?')) return; await sb.auth.signOut(); await wipeLocal(); }}>Se déconnecter</button>
            </div>
          </> : <p class="small" style="margin:0">Les données restent sur ce téléphone. Pense à exporter une sauvegarde de temps en temps.</p>}
        </section>

        <section class="card flat">
          <div style="padding:14px 14px 0"><h3 class="h3" style="margin:0">Pendant la séance</h3></div>
          <Switch label="Sons" sub="Bips de départ, de fin de repos et décompte 3-2-1" on={s.sound} onChange={v => setSettings({ sound: v })} />
          <Switch label="Voix" sub="Annonce « Main droite », « Repos »… pendant les minuteurs" on={s.voice} onChange={v => setSettings({ voice: v })} />
          <Switch label="Écran toujours allumé" sub="En mode séance uniquement" on={s.wake} onChange={v => setSettings({ wake: v })} />
          <p class="small" style="padding:0 14px 14px">Sur iPhone, une app web ne peut pas vibrer : les signaux passent par le son et l’écran. Le bouton silencieux coupe les bips.</p>
        </section>

        <section class="card">
          <h3 class="h3">Repères</h3>
          <details class="fold"><summary><span style="font-weight:600">Ressenti de séance (0 à 10)</span></summary>
            <div class="tw"><table class="t"><tbody>{RPE.map((l, i) => <tr><td class="num" style="width:2.5em">{i}</td><td>{l}</td><td class="muted">{ZONES[i <= 4 ? 0 : i <= 6 ? 1 : 2][0]}</td></tr>)}</tbody></table></div>
            <p class="small">Noté environ 30 min après la séance, pour toute la séance. Charge = ressenti × durée en minutes (UA).</p>
          </details>
          <hr style="border:0;border-top:1px solid var(--rule);margin:12px 0" />
          <details class="fold"><summary><span style="font-weight:600">Forme du matin (sur 25)</span></summary>
            <div class="tw"><table class="t"><tbody>
              <tr><td class="num">20–25</td><td>En forme</td><td class="muted">séance telle que prévue</td></tr>
              <tr><td class="num">15–19</td><td>Correct</td><td class="muted">séance telle que prévue</td></tr>
              <tr><td class="num">11–14</td><td>Fatigué</td><td class="muted">séance allégée</td></tr>
              <tr><td class="num">≤ 10</td><td>Très fatigué</td><td class="muted">version décharge</td></tr>
            </tbody></table></div>
            <p class="small">{WELL.map(w => w[1]).join(', ')} : chacun de 1 à 5.</p>
          </details>
          <hr style="border:0;border-top:1px solid var(--rule);margin:12px 0" />
          <details class="fold"><summary><span style="font-weight:600">Profil de séance</span></summary>
            <div class="tw"><table class="t"><tbody>{SIV.map(([, l, q]) => <tr><td>{l}</td><td class="muted">{q}</td></tr>)}</tbody></table></div>
            <p class="small">Chacun sur 10. Méthode de Marie Akrich ; l’étalonnage sur 10 est propre au carnet.</p>
          </details>
        </section>

        <section class="card flat">
          <div style="padding:14px 14px 4px"><h3 class="h3" style="margin:0">Exercices du plan</h3><p class="small" style="margin:4px 0 6px">Touche un exercice pour le renommer partout.</p></div>
          {(exAll ? exs : exs.slice(0, 8)).map(x => <button class="li" style="border-radius:0" onClick={() => setRen(x)}><span style="min-width:0">{x.label}<small>{x.n} séance{x.n > 1 ? 's' : ''} · du {fmtDay(x.first)} au {fmtDay(x.last)}</small></span><span class="r" /></button>)}
          {exs.length > 8 && <div style="padding:6px 14px 10px"><button class="btn ghost" onClick={() => setExAll(!exAll)}>{exAll ? 'Voir moins' : 'Voir les ' + exs.length + ' exercices'}</button></div>}
        </section>

        <section class="card">
          <h3 class="h3">Données</h3>
          <div class="stack" style="gap:8px">
            <button class="btn" onClick={() => downloadExport()}>Exporter une sauvegarde (.json)</button>
            {!imp ? <button class="btn" onClick={() => setImp(true)}>Importer un fichier</button> : <ImportPicker onDone={() => setImp(false)} />}
            {!cloud && <button class="btn danger" onClick={async () => { if (confirm('Effacer toutes les données de cet appareil ? Exporte une sauvegarde avant.')) { await wipeLocal(); location.reload(); } }}>Tout effacer sur cet appareil</button>}
          </div>
          <p class="small">La sauvegarde contient le plan et tout le journal. {cloud ? 'Tes données sont aussi stockées en ligne, dans ton espace privé.' : ''}</p>
        </section>

        <section class="card">
          <h3 class="h3">Installer sur l’iPhone</h3>
          <ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px;font-size:15px">
            <li>Ouvre l’adresse de l’appli dans <b>Safari</b>.</li>
            <li>Touche le bouton <b>Partager</b> (le carré avec la flèche).</li>
            <li>Choisis <b>Sur l’écran d’accueil</b>, puis <b>Ajouter</b>.</li>
            <li>Lance Carnet depuis son icône : plein écran, et ça marche hors ligne.</li>
          </ol>
        </section>
        <p class="small" style="text-align:center">{meta() ? meta().title + ' · ' : ''}Carnet v1</p>
      </div>
      {ren && <RenameSheet ex={ren} onClose={() => setRen(null)} />}
    </div>
  );
}
