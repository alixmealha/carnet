// Paramètres : profil, apparence, séance, suivi, notifications, coach / athlètes, compte, données, administration.
import { useEffect, useState } from 'preact/hooks';
import { syncState, syncNow, settings, setSettings, wipeLocal, links, role, isAdmin, getFor, SELF, myProfile, nameOf, isSelf, getSubject, setSubject, removeAllMine, hasCarnet } from '../lib/store.js';
import { sb, cloud } from '../lib/supa.js';
import { pushState, enablePush, disablePush } from '../lib/push.js';
import { newCode, myCodes, deleteCode, redeem, unlink, setLock, fmtCode } from '../lib/account.js';
import { getTheme, setTheme } from '../lib/theme.js';
import { downloadExport } from '../lib/io.js';
import { Icon, TextSeg, toast } from '../ui/kit.jsx';
import { ImportPicker } from '../ui/ImportPicker.jsx';
import { ProfileForm, ROLE_LBL } from './Setup.jsx';

const SYNC_LBL = { local: 'Sur cet appareil seulement', idle: 'À jour', syncing: 'Synchronisation…', error: 'Erreur de synchronisation', offline: 'Hors ligne : ça repartira tout seul', signedout: 'Déconnecté' };
const ago = t => { if (!t) return 'jamais'; const s = Math.round((Date.now() - t) / 1000); return s < 60 ? 'à l’instant' : s < 3600 ? 'il y a ' + Math.round(s / 60) + ' min' : 'il y a ' + Math.round(s / 3600) + ' h'; };
const ask = m => window.confirm(m);

export function Switch({ label, sub, on, onChange, disabled }) {
  return <label class="set"><span>{label}{sub && <small>{sub}</small>}</span><input type="checkbox" class="sw" checked={on} disabled={disabled} onChange={e => onChange(e.target.checked)} /></label>;
}
const Sec = ({ title, right, children, flat }) => <section class={'card' + (flat ? ' flat' : '')}>{flat ? <div style="padding:14px 14px 0"><h3 class="h3" style="margin:0 0 4px">{title}{right && <em>{right}</em>}</h3></div> : <h3 class="h3">{title}{right && <em>{right}</em>}</h3>}{children}</section>;

function Appearance() {
  const [t, setT] = useState(getTheme());
  return <Sec title="Apparence">
    <TextSeg value={t} onChange={v => { const x = v || 'system'; setT(x); setTheme(x); }} options={[['system', 'Système'], ['light', 'Clair'], ['dark', 'Sombre']]} label="Thème" />
    <p class="small" style="margin:8px 0 0">« Système » suit le réglage de l’iPhone (clair le jour, sombre le soir s’il est en automatique).</p>
  </Sec>;
}

function SessionPrefs() {
  const s = settings();
  return <Sec title="Pendant la séance" flat>
    <Switch label="Sons" sub="Bips de départ, de fin de repos et décompte 3-2-1" on={s.sound} onChange={v => setSettings({ sound: v })} />
    <Switch label="Voix" sub="Annonce « Main droite », « Repos »… pendant les minuteurs" on={s.voice} onChange={v => setSettings({ voice: v })} />
    <Switch label="Écran toujours allumé" sub="En mode séance uniquement" on={s.wake} onChange={v => setSettings({ wake: v })} />
    <p class="small" style="padding:0 14px 14px">Sur iPhone, une app web ne peut pas vibrer : les signaux passent par le son et l’écran. Le bouton silencieux coupe les bips.</p>
  </Sec>;
}

function Tracking() {
  const own = getFor(SELF, 'settings') || {}, female = myProfile().sex === 'F';
  const cyc = typeof own.cycle === 'boolean' ? own.cycle : female;
  return <Sec title="Suivi" flat>
    <Switch label="Cycle menstruel" sub={'Ajoute le jour du cycle à la forme du matin' + (female ? ' · actif d’office avec un profil femme' : '')} on={cyc} onChange={v => setSettings({ cycle: v })} />
  </Sec>;
}

function Notifications() {
  const [st, setSt] = useState('…'), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  useEffect(() => { pushState().then(setSt); }, []);
  if (!cloud) return null;
  const r = role(), coachSide = r === 'coach' || links.athletes.length > 0;
  const on = async () => { setBusy(true); setErr(''); try { await enablePush(); setSt('on'); toast('Notifications activées'); } catch (e) { setErr(/schema cache|push_subs/.test(e.message) ? 'La base n’est pas à jour : lance le script de l’étape 2 dans Supabase, puis réessaie.' : e.message); } setBusy(false); };
  const off = async () => { setBusy(true); await disablePush(); setSt('off'); setBusy(false); };
  return (
    <Sec title="Notifications" right={st === 'on' ? 'activées' : st === 'denied' ? 'refusées' : st === 'install' ? 'appli à installer' : st === 'unsupported' ? 'indisponibles' : 'désactivées'}>
      <p class="small" style="margin:0">{coachSide ? 'Une notification quand un de tes athlètes valide sa séance ou t’écrit.' : 'Une notification quand ton coach commente une de tes séances.'}</p>
      {st === 'install' && <p class="small">Sur iPhone, les notifications ne marchent que dans l’appli installée : Safari → Partager → Sur l’écran d’accueil, puis ouvre Alipto depuis son icône.</p>}
      {st === 'denied' && <p class="small">Refusées pour Alipto : Réglages de l’iPhone → Notifications → Alipto.</p>}
      {err && <p class="err" style="margin-top:8px">{err}</p>}
      <div class="row-btns" style="margin-top:12px">
        {st === 'on' ? <button class="btn" disabled={busy} onClick={off}>Désactiver sur cet appareil</button>
          : <button class="btn primary" disabled={busy || st === 'unsupported'} onClick={on}>Activer les notifications</button>}
      </div>
    </Sec>
  );
}

/* ---------- Athlète : mon coach et codes de partage ---------- */
function MyCoach() {
  const [codes, setCodes] = useState(null), [fresh, setFresh] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const load = () => myCodes().then(c => setCodes(c.filter(x => Date.parse(x.expires_at) > Date.now()))).catch(() => setCodes([]));
  useEffect(() => { load(); }, []);
  const gen = async () => { setBusy(true); setErr(''); try { const c = await newCode(); setFresh(c); load(); } catch (e) { setErr(e.message); } setBusy(false); };
  const share = async c => {
    const txt = 'Mon code Alipto : ' + fmtCode(c.code) + '\nÀ saisir dans Plus → Paramètres → Mes athlètes (valable 7 jours, une seule fois).';
    try { if (navigator.share) { await navigator.share({ text: txt }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(txt); toast('Code copié'); } catch (_) { toast(fmtCode(c.code)); }
  };
  return (
    <Sec title="Mon coach" right={links.coaches.length ? links.coaches.length + ' coach' + (links.coaches.length > 1 ? 's' : '') : ''}>
      {links.coaches.length > 0 ? <div class="list" style="margin-bottom:10px">{links.coaches.map(c => <div class="li noarrow"><span style="min-width:0"><b style="font-weight:600">{nameOf(c)}</b><small>Lit ton carnet, commente et peut modifier tes séances</small></span>
        <button class="btn ghost" style="color:var(--crit)" onClick={async () => { if (ask('Retirer ' + nameOf(c) + ' ? Il n’aura plus accès à ton carnet.')) { try { await unlink(c, links.me); toast('Accès retiré'); } catch (e) { toast(e.message); } } }}>Retirer</button></div>)}</div>
        : <p class="small" style="margin:0 0 10px">Aucun coach n’a accès à ton carnet.</p>}
      {links.myLock && <p class="lock-n"><Icon name="lock" size={16} />Ton coach a verrouillé ton plan : tu le consultes et tu remplis ton journal, mais seules ses modifications passent.</p>}
      {fresh && <div class="code-box"><small>Code à donner à ton coach</small><b>{fmtCode(fresh.code)}</b><span>Valable 7 jours, une seule utilisation</span>
        <button class="btn primary" onClick={() => share(fresh)}>Partager le code</button></div>}
      {err && <p class="err">{err}</p>}
      <button class="btn" disabled={busy} onClick={gen}><Icon name="key" size={18} />{fresh ? 'Générer un autre code' : 'Donner accès à un coach'}</button>
      <p class="small">Ton coach saisit le code dans son appli : il pourra lire ton carnet (forme, séances, tests), te laisser des retours et modifier tes séances. Tu peux lui retirer l’accès à tout moment.</p>
      {codes && codes.filter(c => !fresh || c.code !== fresh.code).length > 0 && <details class="fold"><summary><span class="small" style="margin:0;font-weight:600">Codes encore valables</span></summary>
        <div class="list" style="margin-top:8px">{codes.filter(c => !fresh || c.code !== fresh.code).map(c => <div class="li noarrow"><span class="num">{fmtCode(c.code)}<small>jusqu’au {new Date(c.expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</small></span>
          <span style="display:flex;gap:4px"><button class="btn ghost" onClick={() => share(c)}>Partager</button><button class="btn ghost" style="color:var(--crit)" onClick={async () => { await deleteCode(c.code).catch(() => {}); load(); }}>Annuler</button></span></div>)}</div>
      </details>}
    </Sec>
  );
}

/* ---------- Coach : mes athlètes ---------- */
export function AddAthlete({ compact }) {
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const go = async () => {
    setBusy(true); setErr('');
    try { const a = await redeem(code); setCode(''); toast((a ? nameOf(a) : 'Athlète') + ' ajouté·e'); if (a) setSubject(a); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <div class="stack" style="gap:8px">
      {!compact && <p class="small" style="margin:0">Demande à ton athlète son code : Plus → Paramètres → Mon coach → Donner accès à un coach.</p>}
      <div style="display:flex;gap:8px;align-items:flex-end">
        <label class="fld" style="flex:1">Code de l’athlète<input class="in mono code-in" value={code} placeholder="ABCD-EFGH" autocapitalize="characters" autocomplete="off" spellcheck={false} onInput={e => setCode(e.target.value.toUpperCase())} /></label>
        <button class="btn primary" disabled={busy || code.replace(/[^A-Za-z0-9]/g, '').length < 8} onClick={go}>Ajouter</button>
      </div>
      {err && <p class="err">{err}</p>}
    </div>
  );
}
function MyAthletes() {
  const [busy, setBusy] = useState('');
  return (
    <Sec title="Mes athlètes" right={links.athletes.length || ''}>
      {links.athletes.length > 0 && <div class="list" style="margin-bottom:12px">{links.athletes.map(a => {
        const locked = !!links.locks[a];
        return <div class="ath-set">
          <div class="li noarrow" style="border:0"><span style="min-width:0"><b style="font-weight:600">{nameOf(a)}</b><small>{locked ? 'Plan verrouillé : seules tes modifications passent' : 'Non verrouillé : peut aussi modifier son plan'}</small></span>
            <button class="btn ghost" style="color:var(--crit)" disabled={busy === a} onClick={async () => { if (ask('Retirer ' + nameOf(a) + ' de tes athlètes ? Tu n’auras plus accès à son carnet.')) { setBusy(a); try { await unlink(links.me, a); if (getSubject() === a) setSubject(SELF); toast('Athlète retiré'); } catch (e) { toast(e.message); } setBusy(''); } }}>Retirer</button></div>
          <Switch label="Verrouiller son plan" sub="L’athlète ne peut plus modifier ses séances ni son plan (son journal reste à lui)" on={locked} disabled={busy === a} onChange={async v => { setBusy(a); try { await setLock(a, v); toast(v ? 'Plan verrouillé' : 'Plan déverrouillé'); } catch (e) { toast(e.message); } setBusy(''); }} />
        </div>;
      })}</div>}
      <AddAthlete />
    </Sec>
  );
}

function Account({ session }) {
  const [pw, setPw] = useState(''), [pw2, setPw2] = useState(''), [open, setOpen] = useState(false), [msg, setMsg] = useState('');
  const st = syncState.state;
  const change = async () => {
    if (pw.length < 8) { setMsg('8 caractères minimum.'); return; }
    if (pw !== pw2) { setMsg('Les deux mots de passe ne correspondent pas.'); return; }
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) setMsg(/different|same/i.test(error.message) ? 'Choisis un mot de passe différent de l’actuel.' : error.message); else { setMsg(''); setPw(''); setPw2(''); setOpen(false); toast('Mot de passe changé'); }
  };
  return (
    <Sec title="Compte" right={<span class={'sync ' + st}><i />{SYNC_LBL[st] || st}</span>}>
      {cloud ? <>
        <p class="small" style="margin:0">Connecté avec <b>{(session && session.user && session.user.email) || links.email || '—'}</b>{role() ? ' · ' + ROLE_LBL[role()] : ''}. Dernière synchro : {ago(syncState.last)}{syncState.pending ? ' · ' + syncState.pending + ' modification' + (syncState.pending > 1 ? 's' : '') + ' en attente' : ''}.</p>
        {role() !== 'admin' && <p class="small" style="margin:6px 0 0">Le rôle ne se change pas ici : seul l’administrateur peut le modifier.</p>}
        {st === 'error' && syncState.error && <p class="err" style="margin-top:6px">{syncState.error}</p>}
        <div class="row-btns" style="margin-top:12px">
          <button class="btn" onClick={() => syncNow()}>Synchroniser</button>
          <button class="btn" onClick={() => setOpen(!open)}>Mot de passe</button>
          <button class="btn danger" onClick={async () => { if (syncState.pending && !ask('Des modifications ne sont pas encore envoyées. Se déconnecter quand même ?')) return; await disablePush(); await sb.auth.signOut(); await wipeLocal(); }}>Se déconnecter</button>
        </div>
        {open && <div class="stack" style="gap:8px;margin-top:12px">
          <label class="fld">Nouveau mot de passe<input class="in" type="password" autocomplete="new-password" value={pw} onInput={e => setPw(e.target.value)} /></label>
          <label class="fld">Confirmer<input class="in" type="password" autocomplete="new-password" value={pw2} onInput={e => setPw2(e.target.value)} /></label>
          {msg && <p class="err">{msg}</p>}
          <button class="btn primary" onClick={change}>Changer le mot de passe</button>
        </div>}
      </> : <p class="small" style="margin:0">Les données restent sur ce téléphone. Pense à exporter une sauvegarde de temps en temps.</p>}
    </Sec>
  );
}

function Data() {
  const [imp, setImp] = useState(false);
  const self = isSelf(), who = nameOf(getSubject());
  if (!hasCarnet() && self) return null;
  return (
    <Sec title="Données" right={!self ? 'carnet de ' + who : ''}>
      <div class="stack" style="gap:8px">
        <button class="btn" onClick={() => downloadExport()}>Exporter une sauvegarde (.json)</button>
        {!imp ? <button class="btn" onClick={() => setImp(true)}>Importer un fichier{self ? '' : ' dans le carnet de ' + who}</button> : <ImportPicker onDone={() => setImp(false)} />}
        {cloud && self && <button class="btn danger" onClick={() => { if (ask('Supprimer définitivement ton plan, ton journal et tes tests, ici et en ligne ? Exporte une sauvegarde avant.')) { removeAllMine(); toast('Données supprimées'); } }}>Supprimer toutes mes données</button>}
        {!cloud && <button class="btn danger" onClick={async () => { if (ask('Effacer toutes les données de cet appareil ? Exporte une sauvegarde avant.')) { await wipeLocal(); location.reload(); } }}>Tout effacer sur cet appareil</button>}
      </div>
      <p class="small">La sauvegarde contient le plan, le journal et les tests du carnet affiché.{cloud ? ' Les données sont stockées en ligne dans un espace privé : seuls toi et ton coach y avez accès.' : ''}{!self ? ' En important pour ton athlète, son journal déjà rempli n’est jamais écrasé.' : ''}</p>
    </Sec>
  );
}

export function SettingsPage({ session, onBack, onAdmin }) {
  const r = role(), athleteSide = r !== 'coach', coachSide = r === 'coach' || r === 'admin';
  useEffect(() => { window.scrollTo(0, 0); }, []);
  return (
    <div class="screen">
      <div class="page-h"><button class="icon-btn" aria-label="Retour" onClick={onBack}><Icon name="back" /></button><h1 class="title">Paramètres</h1></div>
      <div class="stack cols2">
        <Sec title="Profil" right={r ? ROLE_LBL[r] : ''}><ProfileForm key={myProfile().name} /></Sec>
        <Appearance />
        {athleteSide && <SessionPrefs />}
        {athleteSide && <Tracking />}
        <Notifications />
        {cloud && athleteSide && !links.legacy && <MyCoach />}
        {cloud && coachSide && !links.legacy && <MyAthletes />}
        <Account session={session} />
        <Data />
        {isAdmin() && <button class="card li-card" onClick={onAdmin}><Icon name="shield" /><span><b>Administration</b><small>Comptes, rôles, accès</small></span><span class="chev r" aria-hidden="true" /></button>}
        {links.legacy && <p class="err">La base n’est pas encore à jour : lance le script de l’étape 2 dans Supabase (profils, codes, notifications).</p>}
        <p class="small" style="text-align:center">Alipto v3.3</p>
      </div>
    </div>
  );
}
