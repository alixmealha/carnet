// Administration (compte administrateur) : créer des comptes, changer un rôle, gérer l'accès, supprimer.
// L'administrateur ne lit pas le carnet des autres : seulement celui des athlètes dont il est le coach.
import { useEffect, useState } from 'preact/hooks';
import { links, syncNow } from '../lib/store.js';
import { adminUsers, adminSetRole, adminLink, adminFn, tempPassword, appUrl } from '../lib/account.js';
import { Icon, Sheet, TextSeg, toast } from '../ui/kit.jsx';
import { ROLE_LBL } from './Setup.jsx';
import { Switch } from './Settings.jsx';

const when = t => t ? new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'jamais';
async function shareText(txt) {
  try { if (navigator.share) { await navigator.share({ text: txt }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(txt); toast('Copié'); } catch (_) { toast('Copie impossible : recopie le texte à la main'); }
}
const welcome = (email, pw) => 'Ton compte Carnet est prêt.\nAdresse : ' + appUrl() + '\nEmail : ' + email + '\nMot de passe provisoire : ' + pw + '\nSur iPhone : ouvre l’adresse dans Safari, Partager → Sur l’écran d’accueil. Change ton mot de passe dans Plus → Paramètres.';

function Create({ onDone }) {
  const [email, setEmail] = useState(''), [pw, setPw] = useState(tempPassword()), [role, setRole] = useState('athlete'), [name, setName] = useState(''), [mine, setMine] = useState(true);
  const [mode, setMode] = useState('invite');
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [made, setMade] = useState(null);
  const go = async () => {
    setBusy(true); setErr('');
    try {
      const invite = mode === 'invite';
      const r = await adminFn({ action: 'create', email: email.trim(), password: invite ? undefined : pw, invite, role: role === 'free' ? null : role, name: name.trim(), linkMe: mine && role !== 'coach' });
      setMade({ email: r.email || email.trim(), pw: invite ? null : pw }); setEmail(''); setName(''); setPw(tempPassword()); onDone();
      if (mine && role !== 'coach') syncNow();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <section class="card">
      <h3 class="h3">Créer un compte</h3>
      {made ? <div class="stack" style="gap:10px">
        {made.pw ? <>
          <div class="code-box left"><small>Compte créé</small><span>Email : <b>{made.email}</b></span><span>Mot de passe provisoire : <b class="num">{made.pw}</b></span></div>
          <p class="small" style="margin:0">Envoie ces infos à la personne (message privé). À la première connexion, elle remplit son profil.</p>
          <div class="row-btns"><button class="btn primary" style="flex:1" onClick={() => shareText(welcome(made.email, made.pw))}>Partager les accès</button><button class="btn" onClick={() => setMade(null)}>Nouveau</button></div>
        </> : <>
          <div class="code-box left"><small>Invitation envoyée</small><span>à <b>{made.email}</b></span></div>
          <p class="small" style="margin:0">La personne reçoit un e-mail avec un lien pour choisir son mot de passe, puis remplit son profil. Pense à vérifier ses spams si elle ne le voit pas.</p>
          <div class="row-btns"><button class="btn" onClick={() => setMade(null)}>Nouveau</button></div>
        </>}
      </div> : <div class="stack" style="gap:10px">
        <label class="fld">Email<input class="in" type="email" inputmode="email" autocapitalize="off" autocomplete="off" value={email} onInput={e => setEmail(e.target.value)} /></label>
        <label class="fld">Prénom (facultatif)<input class="in" value={name} onInput={e => setName(e.target.value)} /></label>
        <div><p class="sub-lbl" style="margin-top:0">Accès</p><TextSeg value={mode} onChange={v => setMode(v || mode)} options={[['invite', 'Invitation par e-mail'], ['pw', 'Mot de passe provisoire']]} label="Accès" />
          <p class="small" style="margin:6px 0 0">{mode === 'invite' ? 'Un e-mail part tout de suite : la personne choisit elle-même son mot de passe. Nécessite l’envoi d’e-mails configuré dans Supabase.' : 'Tu envoies toi-même l’email et le mot de passe provisoire (message privé).'}</p></div>
        {mode === 'pw' && <div style="display:flex;gap:8px;align-items:flex-end">
          <label class="fld" style="flex:1">Mot de passe provisoire<input class="in mono" value={pw} onInput={e => setPw(e.target.value)} autocomplete="off" /></label>
          <button class="btn" type="button" onClick={() => setPw(tempPassword())}>Autre</button>
        </div>}
        <div><p class="sub-lbl" style="margin-top:0">Rôle</p><TextSeg value={role} onChange={v => setRole(v || 'free')} options={[['athlete', 'Athlète'], ['coach', 'Coach'], ['free', 'Au choix']]} label="Rôle" />
          <p class="small" style="margin:6px 0 0">{role === 'free' ? 'La personne choisira athlète ou coach à sa première connexion.' : role === 'coach' ? 'Un coach n’a pas de carnet : il suit des athlètes avec leur code.' : 'Un athlète a son carnet et peut l’ouvrir à un coach.'}</p></div>
        {role !== 'coach' && <div class="list"><Switch label="Je suis son coach" sub="Tu auras accès à son carnet tout de suite, sans code" on={mine} onChange={setMine} /></div>}
        {err && <p class="err">{err}</p>}
        <button class="btn primary" disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || (mode === 'pw' && pw.length < 8)} onClick={go}>{busy ? 'Création…' : mode === 'invite' ? 'Créer et envoyer l’invitation' : 'Créer le compte'}</button>
      </div>}
    </section>
  );
}

function UserSheet({ u, onClose, onChange }) {
  const me = u.id === links.me, linked = links.athletes.includes(u.id);
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [pw, setPw] = useState(null), [del, setDel] = useState(false);
  const act = async (fn, ok) => { setBusy(true); setErr(''); try { await fn(); if (ok) toast(ok); onChange(); } catch (e) { setErr(e.message); } setBusy(false); };
  return (
    <Sheet title={u.name || u.email} onClose={onClose}>
      <div class="stack">
        <p class="small" style="margin:0">{u.email} · créé le {when(u.created_at)} · dernière connexion : {when(u.last_sign_in_at)}{!u.onboarded ? ' · profil pas encore rempli' : ''}</p>
        <section class="card">
          <h3 class="h3">Rôle</h3>
          <TextSeg value={u.role} onChange={v => { if (!v || v === u.role) return; if (!window.confirm('Passer ' + (u.name || u.email) + ' en ' + ROLE_LBL[v].toLowerCase() + ' ?' + (v === 'athlete' ? ' Ses liens de coach seront retirés.' : v === 'coach' ? ' Ses coachs perdront l’accès à son carnet.' : ' Il aura accès à l’administration.'))) return; act(() => adminSetRole(u.id, v).then(() => syncNow()), 'Rôle changé'); }} options={[['athlete', 'Athlète'], ['coach', 'Coach'], ['admin', 'Admin']]} label="Rôle" />
          {me && <p class="small" style="margin:8px 0 0">C’est ton compte : il reste administrateur.</p>}
        </section>
        {!me && u.role !== 'coach' && <section class="card">
          <h3 class="h3">Accès à son carnet</h3>
          <p class="small" style="margin:0 0 10px">{linked ? 'Tu es son coach : tu lis son carnet et tu peux modifier ses séances.' : 'Tu n’as pas accès à son carnet. En te liant comme coach, tu le verras dans Athlètes.'}</p>
          <button class="btn" disabled={busy} onClick={() => act(() => adminLink(links.me, u.id, !linked).then(() => syncNow()), linked ? 'Lien retiré' : 'Tu es maintenant son coach')}>{linked ? 'Ne plus être son coach' : 'Devenir son coach'}</button>
        </section>}
        {!me && <section class="card">
          <h3 class="h3">Mot de passe</h3>
          {pw ? <><div class="code-box left"><small>Nouveau mot de passe provisoire</small><b class="num" style="font-size:22px">{pw}</b></div>
            <button class="btn primary" style="margin-top:10px" onClick={() => shareText('Nouveau mot de passe Carnet pour ' + u.email + ' : ' + pw + '\nChange-le dans Plus → Paramètres → Compte.')}>Partager</button></>
            : <><p class="small" style="margin:0 0 10px">En cas d’oubli : un e-mail avec un lien pour choisir un nouveau mot de passe, ou un mot de passe provisoire que tu lui transmets.</p>
              <div class="row-btns"><button class="btn" disabled={busy} onClick={() => act(() => adminFn({ action: 'recover', id: u.id }), 'E-mail de réinitialisation envoyé')}>Envoyer un e-mail</button>
              <button class="btn" disabled={busy} onClick={() => { const p = tempPassword(); act(() => adminFn({ action: 'password', id: u.id, password: p }).then(() => setPw(p)), 'Mot de passe redéfini'); }}>Mot de passe provisoire</button></div></>}
        </section>}
        {!me && <section class="card">
          <h3 class="h3">Supprimer le compte</h3>
          <p class="small" style="margin:0 0 10px">Efface le compte et toutes ses données (plan, journal, tests, messages). Irréversible.</p>
          {!del ? <button class="btn danger" onClick={() => setDel(true)}>Supprimer…</button>
            : <div class="row-btns"><button class="btn" onClick={() => setDel(false)}>Annuler</button><button class="btn danger" style="flex:1" disabled={busy} onClick={() => act(() => adminFn({ action: 'delete', id: u.id }).then(() => { syncNow(); onClose(); }), 'Compte supprimé')}>Confirmer la suppression</button></div>}
        </section>}
        {err && <p class="err">{err}</p>}
      </div>
    </Sheet>
  );
}

export function AdminPage({ onBack }) {
  const [users, setUsers] = useState(null), [err, setErr] = useState(''), [sel, setSel] = useState(null);
  const load = () => adminUsers().then(u => { setUsers(u); setErr(''); setSel(s => (s ? u.find(x => x.id === s.id) || null : null)); }).catch(e => setErr(e.message));
  useEffect(() => { window.scrollTo(0, 0); load(); }, []);
  const count = r => (users || []).filter(u => u.role === r).length;
  return (
    <div class="screen">
      <div class="page-h"><button class="icon-btn" aria-label="Retour" onClick={onBack}><Icon name="back" /></button><h1 class="title">Administration</h1></div>
      <div class="stack">
        <p class="small" style="margin:0">Les inscriptions sont fermées : les comptes se créent ici. Tu gères les rôles et les accès, sans lire les carnets des autres (sauf ceux dont tu es le coach).</p>
        <Create onDone={load} />
        <section class="card flat">
          <div style="padding:14px 14px 4px"><h3 class="h3" style="margin:0">Comptes <em>{users ? users.length + ' · ' + count('athlete') + ' athlète' + (count('athlete') > 1 ? 's' : '') + ', ' + count('coach') + ' coach' + (count('coach') > 1 ? 's' : '') : ''}</em></h3></div>
          {err && <p class="err" style="padding:0 14px 14px">{err}</p>}
          {!users && !err && <p class="small" style="padding:0 14px 14px">Chargement…</p>}
          {users && users.map(u => <button class="li" onClick={() => setSel(u)}>
            <span style="min-width:0"><b style="font-weight:600">{u.name || 'Profil à remplir'}</b>{u.id === links.me ? ' (toi)' : ''}<small>{u.email} · {u.role === 'coach' ? u.athletes + ' athlète' + (u.athletes > 1 ? 's' : '') : u.coaches ? u.coaches + ' coach' + (u.coaches > 1 ? 's' : '') : 'sans coach'}{links.athletes.includes(u.id) ? ' · tu le suis' : ''}</small></span>
            <span class="r"><span class={'role-b ' + u.role}>{ROLE_LBL[u.role]}</span></span>
          </button>)}
        </section>
      </div>
      {sel && <UserSheet u={sel} onClose={() => setSel(null)} onChange={load} key={sel.id + sel.role} />}
    </div>
  );
}
