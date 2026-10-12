import { useEffect, useState } from 'preact/hooks';
import { syncState, syncNow, settings, setSettings, wipeLocal, myProfile, putFor, SELF, isSelf, getSubject, nameOf, links, removeAllMine } from '../lib/store.js';
import { sb, cloud } from '../lib/supa.js';
import { exerciseNames, renameExercise, meta, KIND, KIND_ORDER } from '../lib/plan.js';
import { WELL, RPE, ZONES, SIV, bands } from '../lib/rules.js';
import { SOURCES } from '../lib/sources.js';
import { pushState, enablePush, disablePush } from '../lib/push.js';
import { downloadExport } from '../lib/io.js';
import { fmtDay } from '../lib/dates.js';
import { Sheet, Fold, toast } from '../ui/kit.jsx';
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

function Profile() {
  const p = myProfile(), s = settings();
  const [name, setName] = useState(p.name || '');
  useEffect(() => setName(myProfile().name || ''), [p.name]);
  const saveP = patch => putFor(SELF, 'profile', Object.assign({}, myProfile(), patch));
  return (
    <section class="card flat">
      <div style="padding:14px 14px 4px"><h3 class="h3" style="margin:0">Ton profil</h3></div>
      <div style="padding:6px 14px 10px"><label class="fld">Prénom<input class="in" value={name} placeholder="Affiché à ton coach et dans les notifications" onInput={e => setName(e.target.value)} onBlur={() => { if (name.trim() !== (p.name || '')) saveP({ name: name.trim() }); }} /></label></div>
      <Switch label="Moins de 18 ans" sub="Les repères de sommeil passent à 8-10 h par nuit" on={!!p.under18} onChange={v => saveP({ under18: v })} />
      <Switch label="Suivi du cycle menstruel" sub="Ajoute le jour du cycle à la forme du matin" on={!!s.cycle} onChange={v => setSettings({ cycle: v })} />
    </section>
  );
}

function Notifications() {
  const [st, setSt] = useState('…'), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  useEffect(() => { pushState().then(setSt); }, []);
  if (!cloud) return null;
  const coach = links.athletes.length > 0;
  const on = async () => { setBusy(true); setErr(''); try { await enablePush(); setSt('on'); toast('Notifications activées'); } catch (e) { setErr(e.message); } setBusy(false); };
  const off = async () => { setBusy(true); await disablePush(); setSt('off'); setBusy(false); };
  return (
    <section class="card">
      <h3 class="h3">Notifications <em>{st === 'on' ? 'activées' : st === 'denied' ? 'refusées' : st === 'install' ? 'appli à installer' : st === 'unsupported' ? 'indisponibles' : 'désactivées'}</em></h3>
      <p class="small" style="margin:0">{coach ? 'Une notification quand un de tes athlètes valide sa séance ou t’écrit.' : links.coaches.length ? 'Une notification quand ton coach commente une de tes séances.' : 'Une notification quand un coach ou un athlète t’écrit.'}</p>
      {st === 'install' && <p class="small">Sur iPhone, les notifications ne marchent que dans l’appli installée : Safari → Partager → Sur l’écran d’accueil, puis ouvre Carnet depuis son icône.</p>}
      {err && <p class="err" style="margin-top:8px">{err}</p>}
      <div class="row-btns" style="margin-top:12px">
        {st === 'on' ? <button class="btn" disabled={busy} onClick={off}>Désactiver sur cet appareil</button>
          : <button class="btn primary" disabled={busy || st === 'unsupported'} onClick={on}>Activer les notifications</button>}
      </div>
    </section>
  );
}

function Account({ session }) {
  const [pw, setPw] = useState(''), [pw2, setPw2] = useState(''), [open, setOpen] = useState(false), [msg, setMsg] = useState('');
  const st = syncState.state;
  const change = async () => {
    if (pw.length < 8) { setMsg('8 caractères minimum.'); return; }
    if (pw !== pw2) { setMsg('Les deux mots de passe ne correspondent pas.'); return; }
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) setMsg(error.message); else { setMsg(''); setPw(''); setPw2(''); setOpen(false); toast('Mot de passe changé'); }
  };
  return (
    <section class="card">
      <h3 class="h3">Compte et synchronisation <em><span class={'sync ' + st}><i />{SYNC_LBL[st] || st}</span></em></h3>
      {cloud ? <>
        <p class="small" style="margin:0">Connecté avec {(session && session.user && session.user.email) || links.email || '—'}. Dernière synchro : {ago(syncState.last)}{syncState.pending ? ' · ' + syncState.pending + ' modification' + (syncState.pending > 1 ? 's' : '') + ' en attente' : ''}.</p>
        {st === 'error' && syncState.error && <p class="err" style="margin-top:6px">{syncState.error}</p>}
        <div class="row-btns" style="margin-top:12px">
          <button class="btn" onClick={() => syncNow()}>Synchroniser</button>
          <button class="btn" onClick={() => setOpen(!open)}>Mot de passe</button>
          <button class="btn danger" onClick={async () => { if (syncState.pending && !confirm('Des modifications ne sont pas encore envoyées. Se déconnecter quand même ?')) return; await disablePush(); await sb.auth.signOut(); await wipeLocal(); }}>Se déconnecter</button>
        </div>
        {open && <div class="stack" style="gap:8px;margin-top:12px">
          <label class="fld">Nouveau mot de passe<input class="in" type="password" autocomplete="new-password" value={pw} onInput={e => setPw(e.target.value)} /></label>
          <label class="fld">Confirmer<input class="in" type="password" autocomplete="new-password" value={pw2} onInput={e => setPw2(e.target.value)} /></label>
          {msg && <p class="err">{msg}</p>}
          <button class="btn primary" onClick={change}>Changer le mot de passe</button>
        </div>}
      </> : <p class="small" style="margin:0">Les données restent sur ce téléphone. Pense à exporter une sauvegarde de temps en temps.</p>}
    </section>
  );
}

function Exercises() {
  const [ren, setRen] = useState(null);
  const exs = exerciseNames();
  const groups = {};
  for (const x of exs) { const k = KIND_ORDER.find(kd => x.kinds.has(kd)) || 'autre'; (groups[k] = groups[k] || []).push(x); }
  const cats = KIND_ORDER.filter(k => groups[k]);
  if (!cats.length) return null;
  return (
    <section class="card">
      <h3 class="h3">Exercices du plan <em>{exs.length}</em></h3>
      <p class="small" style="margin:0 0 6px">Rangés par type de séance. Touche un exercice pour le renommer partout.</p>
      {cats.map(k => <details class="fold ex-cat">
        <summary><span class="kdot" style={'background:var(--k-' + k + ')'} /><span style="flex:1;font-weight:600">{KIND[k]}</span><span class="muted" style="font-size:13px;margin-right:8px">{groups[k].length}</span></summary>
        <div class="list" style="margin:8px 0 4px">{groups[k].map(x => <button class="li" onClick={() => setRen(x)}><span style="min-width:0">{x.label}<small>{x.n} séance{x.n > 1 ? 's' : ''} · du {fmtDay(x.first)} au {fmtDay(x.last)}</small></span><span class="r" /></button>)}</div>
      </details>)}
      {ren && <RenameSheet ex={ren} onClose={() => setRen(null)} />}
    </section>
  );
}

function Reperes() {
  return (
    <section class="card">
      <h3 class="h3">Repères</h3>
      <details class="fold"><summary><span style="font-weight:600">Ressenti de séance (0 à 10)</span></summary>
        <div class="tw"><table class="t"><tbody>{RPE.map((l, i) => <tr><td class="num" style="width:2.5em">{i}</td><td>{l}</td><td class="muted">{ZONES[i <= 4 ? 0 : i <= 6 ? 1 : 2][0]}</td></tr>)}</tbody></table></div>
        <p class="small">Noté environ 30 min après la séance, pour toute la séance. Charge = ressenti × durée en minutes (UA).</p>
      </details>
      <hr class="sep" />
      <details class="fold"><summary><span style="font-weight:600">Forme du matin (sur 25)</span></summary>
        <div class="tw"><table class="t"><tbody>
          {bands().map((b, i, a) => <tr><td class="num" style="white-space:nowrap">{i === 0 ? b[0] + '–25' : i === a.length - 1 ? '≤ ' + (a[i - 1][0] - 1) : b[0] + '–' + (a[i - 1][0] - 1)}</td><td>{b[1]}</td><td class="muted">{b[3]}</td></tr>)}
        </tbody></table></div>
        <p class="small">{WELL.map(w => w[1]).join(', ')} : chacun de 1 à 5. L’écart à ta propre moyenne compte plus que le chiffre seul.</p>
      </details>
      <hr class="sep" />
      <details class="fold"><summary><span style="font-weight:600">Profil de séance</span></summary>
        <div class="tw"><table class="t"><tbody>{SIV.map(([, l, q]) => <tr><td>{l}</td><td class="muted">{q}</td></tr>)}</tbody></table></div>
        <p class="small">Chacun sur 10. Charge de séance = intensité + volume. Méthode de Marie Akrich ; l’étalonnage sur 10 est propre au carnet.</p>
      </details>
      <hr class="sep" />
      <details class="fold"><summary><span style="font-weight:600">Gênes et douleurs</span></summary>
        <p class="small" style="color:var(--ink)">0 à 2 : zone sûre. 3 à 5 : acceptable si ça redescend d’ici le lendemain matin et que ça n’augmente pas d’une semaine à l’autre. Au-dessus de 5 : on modifie ou on arrête ce qui la provoque.</p>
      </details>
      <hr class="sep" />
      <details class="fold"><summary><span style="font-weight:600">Sources scientifiques</span><span class="muted" style="font-size:13px;margin-left:auto;margin-right:8px">{Object.keys(SOURCES).length}</span></summary>
        <div class="stack" style="gap:10px;margin-top:10px">{Object.values(SOURCES).map(s => <div><b style="font-size:14px">{s.s}</b><p class="small" style="margin:2px 0 0;color:var(--ink)">{s.n}</p><p class="small" style="margin:2px 0 0">{s.r}</p></div>)}</div>
      </details>
    </section>
  );
}

export function More({ session }) {
  const s = settings();
  const [imp, setImp] = useState(false);
  const self = isSelf(), who = nameOf(getSubject());
  return (
    <div class="screen">
      <div class="head"><div><div class="eyebrow">Carnet</div><h1 class="title">Plus</h1></div></div>
      <div class="stack">
        <Profile />
        <Notifications />
        <Account session={session} />
        <section class="card flat">
          <div style="padding:14px 14px 0"><h3 class="h3" style="margin:0">Pendant la séance</h3></div>
          <Switch label="Sons" sub="Bips de départ, de fin de repos et décompte 3-2-1" on={s.sound} onChange={v => setSettings({ sound: v })} />
          <Switch label="Voix" sub="Annonce « Main droite », « Repos »… pendant les minuteurs" on={s.voice} onChange={v => setSettings({ voice: v })} />
          <Switch label="Écran toujours allumé" sub="En mode séance uniquement" on={s.wake} onChange={v => setSettings({ wake: v })} />
          <p class="small" style="padding:0 14px 14px">Sur iPhone, une app web ne peut pas vibrer : les signaux passent par le son et l’écran. Le bouton silencieux coupe les bips.</p>
        </section>
        <Exercises />
        <Reperes />
        <section class="card">
          <h3 class="h3">Données {!self && <em>carnet de {who}</em>}</h3>
          <div class="stack" style="gap:8px">
            <button class="btn" onClick={() => downloadExport()}>Exporter une sauvegarde (.json)</button>
            {!imp ? <button class="btn" onClick={() => setImp(true)}>Importer un fichier{self ? '' : ' dans le carnet de ' + who}</button> : <ImportPicker onDone={() => setImp(false)} />}
            {cloud && self && <button class="btn danger" onClick={() => { if (confirm('Supprimer définitivement ton plan, ton journal et tes tests, ici et en ligne ? Exporte une sauvegarde avant.')) { removeAllMine(); toast('Données supprimées'); } }}>Supprimer toutes mes données</button>}
            {!cloud && <button class="btn danger" onClick={async () => { if (confirm('Effacer toutes les données de cet appareil ? Exporte une sauvegarde avant.')) { await wipeLocal(); location.reload(); } }}>Tout effacer sur cet appareil</button>}
          </div>
          <p class="small">La sauvegarde contient le plan, le journal et les tests du carnet affiché. {cloud ? 'Les données sont aussi stockées en ligne, dans un espace privé : seuls toi et ton coach y ont accès.' : ''}</p>
        </section>
        <section class="card">
          <h3 class="h3">Installer sur l’iPhone</h3>
          <ol class="proto">
            <li>Ouvre l’adresse de l’appli dans <b>Safari</b>.</li>
            <li>Touche le bouton <b>Partager</b> (le carré avec la flèche).</li>
            <li>Choisis <b>Sur l’écran d’accueil</b>, puis <b>Ajouter</b>.</li>
            <li>Lance Carnet depuis son icône : plein écran, hors ligne, et notifications possibles.</li>
          </ol>
        </section>
        <p class="small" style="text-align:center">{meta() ? meta().title + ' · ' : ''}Carnet v2</p>
      </div>
    </div>
  );
}
