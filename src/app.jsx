import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore, startAutoSync, syncState, syncNow, jget, links, isSelf, setSubject, getSubject, nameOf, SELF, role, myRow, canEditPlan, planLocked } from './lib/store.js';
import { sb, cloud } from './lib/supa.js';
import { meta, newPlan } from './lib/plan.js';
import { setBadge } from './lib/push.js';
import { forgotPassword } from './lib/account.js';
import { Brand, Mark } from './ui/Logo.jsx';
import { ImportPicker } from './ui/ImportPicker.jsx';
import { todayKey } from './lib/dates.js';
import { Icon, Sheet, toast } from './ui/kit.jsx';
import { Today } from './screens/Today.jsx';
import { DayView } from './screens/DayView.jsx';
import { SessionMode } from './screens/Session.jsx';
import { Stats } from './screens/Stats.jsx';
import { DayEditor } from './screens/Plan.jsx';
import { PlanTab, setPlanView } from './screens/PlanTab.jsx';
import { More } from './screens/More.jsx';
import { Athletes, unreadCount, markSeen } from './screens/Athletes.jsx';
import { ProfileSetup } from './screens/Setup.jsx';

// 4 onglets pour un athlète, 5 avec « Athlètes » (recommandation Apple : 5 au plus). Le calendrier vit dans « Plan ».
const BASE_TABS = [['today', 'Aujourd’hui', 'today'], ['plan', 'Plan', 'cal'], ['stats', 'Suivi', 'stats'], ['more', 'Plus', 'more']];
const ls = {
  get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) {} }
};

// Lien reçu par e-mail (invitation ou mot de passe oublié) : jetons dans l'adresse, à lire avant tout
const AUTH_LINK = (() => {
  try {
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    let r = null;
    if (h.get('access_token') && h.get('refresh_token')) r = { type: h.get('type') || 'magiclink', at: h.get('access_token'), rt: h.get('refresh_token') };
    else if (h.get('error_code') || h.get('error_description')) r = { error: /expired|invalid/i.test(h.get('error_code') + ' ' + h.get('error_description')) ? 'Ce lien a expiré ou a déjà servi. Redemande un e-mail avec « Mot de passe oublié ».' : (h.get('error_description') || 'Lien invalide.').replace(/\+/g, ' ') };
    if (r) history.replaceState(null, '', location.pathname + location.search);
    return r;
  } catch (_) { return null; }
})();

function useSession() {
  const [s, setS] = useState(cloud ? undefined : { local: true });
  useEffect(() => {
    if (!cloud) return;
    const start = async () => {
      if (AUTH_LINK && AUTH_LINK.at) {
        const { error } = await sb.auth.setSession({ access_token: AUTH_LINK.at, refresh_token: AUTH_LINK.rt });
        if (!error && (AUTH_LINK.type === 'invite' || AUTH_LINK.type === 'recovery')) ls.set('carnet-setpw', AUTH_LINK.type);
      }
      const { data } = await sb.auth.getSession();
      setS(data.session || null);
    };
    start();
    const { data } = sb.auth.onAuthStateChange((ev, session) => { if (ev === 'PASSWORD_RECOVERY') ls.set('carnet-setpw', 'recovery'); if (ev === 'SIGNED_OUT') ls.set('carnet-setpw', null); setS(session || null); });
    return () => data.subscription.unsubscribe();
  }, []);
  return s;
}

function Login() {
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(AUTH_LINK && AUTH_LINK.error || ''), [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false), [sent, setSent] = useState(false);
  const submit = async ev => {
    ev.preventDefault(); setErr(''); setBusy(true);
    if (forgot) {
      try { await forgotPassword(email); setSent(true); } catch (e) { setErr(e.message); }
      setBusy(false); return;
    }
    try {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw });
      if (error) setErr(/invalid/i.test(error.message) ? 'Email ou mot de passe incorrect.' : navigator.onLine === false ? 'Pas de connexion internet.' : /fetch|network|load/i.test(error.message) ? 'Impossible de joindre le serveur. Vérifie ta connexion et réessaie.' : /confirm/i.test(error.message) ? 'Ce compte n’est pas encore confirmé.' : error.message);
    } catch (e) { setErr(navigator.onLine === false ? 'Pas de connexion internet.' : 'Connexion impossible pour le moment.'); }
    setBusy(false);
  };
  return (
    <form class="login" onSubmit={submit}>
      {forgot ? <><Mark size={44} /><h1 class="title" style="font-size:48px">Mot de passe</h1></> : <Brand size={56} tagline="Entraînement · coaching" />}
      {forgot ? (sent ? <p class="lead" style="margin:0">Si un compte existe pour <b>{email.trim()}</b>, un e-mail vient de partir. Ouvre le lien qu’il contient : tu choisiras un nouveau mot de passe.</p>
        : <p class="lead" style="margin:0 0 6px">Indique l’email de ton compte : tu recevras un lien pour choisir un nouveau mot de passe.</p>)
        : <p class="lead" style="margin:0 0 6px">Connecte-toi pour retrouver ton plan, ton journal et tes tests.</p>}
      {!sent && <label class="fld">Email<input class="in" type="email" autocomplete="username" inputmode="email" autocapitalize="off" value={email} onInput={e => setEmail(e.target.value)} required /></label>}
      {!forgot && <label class="fld">Mot de passe<input class="in" type="password" autocomplete="current-password" value={pw} onInput={e => setPw(e.target.value)} required /></label>}
      {err && <p class="err" role="alert">{err}</p>}
      {!sent && <button class="btn big primary" type="submit" disabled={busy}>{busy ? (forgot ? 'Envoi…' : 'Connexion…') : forgot ? 'Recevoir le lien' : 'Se connecter'}</button>}
      <button type="button" class="btn ghost" onClick={() => { setForgot(!forgot); setSent(false); setErr(''); }}>{forgot ? 'Retour à la connexion' : 'Mot de passe oublié ?'}</button>
      {!forgot && <p class="small">Accès sur invitation : ton compte est créé par ton coach.</p>}
    </form>
  );
}

// Après un lien d'invitation ou de réinitialisation : choisir son mot de passe
function SetPassword({ type, onDone }) {
  const [pw, setPw] = useState(''), [pw2, setPw2] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const submit = async ev => {
    ev.preventDefault(); setErr('');
    if (pw.length < 8) { setErr('8 caractères minimum.'); return; }
    if (pw !== pw2) { setErr('Les deux mots de passe ne correspondent pas.'); return; }
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setErr(/different|same/i.test(error.message) ? 'Choisis un mot de passe différent de l’ancien.' : /fetch|network/i.test(error.message) ? 'Pas de connexion : réessaie.' : error.message); return; }
    toast('Mot de passe enregistré'); onDone();
  };
  return (
    <form class="login" onSubmit={submit}>
      <Mark size={44} />
      <div class="eyebrow">{type === 'invite' ? 'Bienvenue sur Alipto' : 'Mot de passe oublié'}</div>
      <h1 class="title" style="font-size:44px">{type === 'invite' ? 'Choisis ton mot de passe' : 'Nouveau mot de passe'}</h1>
      <p class="lead" style="margin:0 0 6px">{type === 'invite' ? 'Ton compte est prêt. Choisis un mot de passe : il te servira à te connecter, aussi depuis l’appli installée sur ton écran d’accueil.' : 'Choisis un nouveau mot de passe pour ton compte.'}</p>
      <label class="fld">Mot de passe<input class="in" type="password" autocomplete="new-password" value={pw} onInput={e => setPw(e.target.value)} required autofocus /></label>
      <label class="fld">Confirmer<input class="in" type="password" autocomplete="new-password" value={pw2} onInput={e => setPw2(e.target.value)} required /></label>
      {err && <p class="err" role="alert">{err}</p>}
      <button class="btn big primary" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
    </form>
  );
}

function Onboarding({ onSettings }) {
  const self = isSelf(), who = nameOf(getSubject());
  if (!self) return (
    <div class="login">
      <div class="eyebrow">Carnet de {who}</div>
      <h1 class="title" style="font-size:44px">Pas encore de plan</h1>
      <p class="lead" style="margin:0">Importe le plan de {who} (fichier .json) : séances, cycles, repères, tests. Son journal déjà rempli n’est jamais écrasé.</p>
      <ImportPicker label={'Importer le plan de ' + who} />
      <button class="btn ghost" onClick={() => { newPlan(); toast('Plan vide créé'); }}>Créer un plan vide</button>
    </div>
  );
  const coached = links.coaches.length > 0, locked = planLocked();
  return (
    <div class="login">
      <Mark size={44} />
      <div class="eyebrow">Premier lancement</div>
      <h1 class="title" style="font-size:52px">Bienvenue</h1>
      {coached ? <p class="lead" style="margin:0">Ton coach prépare ton plan : il apparaîtra ici dès qu’il sera prêt.{locked ? '' : ' Tu peux aussi importer un fichier.'}</p>
        : <p class="lead" style="margin:0">Importe ton plan (fichier .json) ou pars d’un plan vide. Si un coach te suit, donne-lui accès à ton carnet : il pourra préparer ton plan.</p>}
      {!locked && <ImportPicker label="Importer un plan" />}
      {!locked && <button class="btn ghost" onClick={() => { newPlan(); toast('Plan vide créé, à remplir dans l’onglet Plan'); }}>Commencer avec un plan vide</button>}
      {cloud && !coached && !links.legacy && <button class="btn" onClick={onSettings}>Donner accès à mon coach</button>}
      {syncState.state === 'error' && <p class="err">Synchronisation impossible : {syncState.error}</p>}
    </div>
  );
}

function Waiting() {
  const err = syncState.state === 'error' || syncState.state === 'offline';
  return <div class="login"><Mark size={56} cls={err ? '' : 'pulse'} /><h1 class="title">{err ? 'Hors ligne' : 'Un instant'}</h1>
    <p class="lead">{err ? 'Impossible de récupérer ton compte pour le moment.' : 'Récupération de ton compte…'}</p>
    {err && syncState.error && <p class="err">{syncState.error}</p>}
    {err && <button class="btn primary" onClick={() => syncNow()}>Réessayer</button>}</div>;
}

// Choix du carnet affiché (coach : ses athlètes ; administrateur : le sien et ceux qu'il suit)
function SubjectBar({ onSelf }) {
  const subj = getSubject(), r = role();
  const opts = (r === 'coach' ? [] : [[SELF, 'Mon carnet']]).concat(links.athletes.map(a => [a, nameOf(a)]));
  return (
    <div class="subj">
      <label class="subj-sel">
        <span class="av sm">{nameOf(subj).slice(0, 1).toUpperCase()}</span>
        <span class="subj-t"><small>{r === 'coach' ? 'Athlète' : 'Carnet de'}</small><b>{nameOf(subj)}</b></span>
        {opts.length > 1 && <Icon name="chevd" size={18} />}
        {opts.length > 1 && <select value={subj} aria-label="Changer de carnet" onChange={e => { const v = e.target.value; setSubject(v); if (v !== SELF) markSeen(v); }}>{opts.map(([v, l]) => <option value={v}>{l}</option>)}</select>}
      </label>
      {r !== 'coach' && <button onClick={onSelf}>Mon carnet</button>}
    </div>
  );
}

export function App() {
  useStore();
  const session = useSession();
  const [tab, setTab] = useState(() => { const t = ls.get('carnet-tab') || 'today'; return t === 'cal' ? 'plan' : t; });
  const [day, setDay] = useState(null);
  const [edit, setEdit] = useState(null);
  const [testFocus, setTestFocus] = useState(null);
  const [ses, setSes] = useState(() => {
    const k = ls.get('carnet-ses'); if (!k) return null;
    const e = jget(k); return k === todayKey() && e.startedAt && !e.endedAt ? k : null;
  });
  const started = useRef(false);
  useEffect(() => {
    if (!session || session.local) return;
    if (!started.current) { started.current = true; startAutoSync(); } else { syncNow(); setTab('today'); setDay(null); setEdit(null); setSes(null); }
  }, [session && session.user && session.user.id]);
  useEffect(() => { ls.set('carnet-tab', tab); window.scrollTo(0, 0); }, [tab]);
  useEffect(() => { ls.set('carnet-ses', ses); }, [ses]);

  // Liens profonds : ?a=<athlète>&d=AAAA-MM-JJ (notifications)
  const openLink = url => {
    try {
      const u = new URL(url, location.href), a = u.searchParams.get('a'), d = u.searchParams.get('d');
      if (!d && !a) return;
      if (a && links.athletes.includes(a)) { setSubject(a); markSeen(a); } else if (!a && role() !== 'coach') setSubject(SELF);
      if (d) { setEdit(null); setSes(null); setDay(d); }
      if (location.search) history.replaceState(null, '', location.pathname);
    } catch (_) {}
  };
  useEffect(() => {
    if (location.search) setTimeout(() => openLink(location.href), 300);
    const onMsg = ev => { if (ev.data && ev.data.type === 'open') openLink(ev.data.url); };
    if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', onMsg);
    return () => { if ('serviceWorker' in navigator) navigator.serviceWorker.removeEventListener('message', onMsg); };
  }, []);
  const coach = links.athletes.length > 0;
  const unread = coach ? unreadCount() : 0;
  useEffect(() => { if (coach) setBadge(unread); }, [unread, coach]);
  const r = role();
  const [setpw, setSetpw] = useState(null);
  useEffect(() => { setSetpw(ls.get('carnet-setpw')); }, [session && session.user && session.user.id]);
  // Un coach n'a pas de carnet : on affiche toujours celui d'un de ses athlètes
  useEffect(() => {
    if (r === 'coach' && isSelf() && links.athletes.length) { const last = ls.get('carnet-subject'); setSubject(links.athletes.includes(last) ? last : links.athletes[0]); }
    if (!isSelf()) ls.set('carnet-subject', getSubject());
  });
  const rej = useRef(syncState.rejectedAt);
  useEffect(() => {
    if (syncState.rejectedAt && syncState.rejectedAt !== rej.current) { rej.current = syncState.rejectedAt; toast(links.myLock ? 'Modification refusée : ton plan est verrouillé par ton coach' : 'Modification refusée par le serveur'); }
  });

  if (session === undefined) return null;
  if (cloud && !session) return <Login />;
  if (cloud && setpw) return <SetPassword type={setpw} onDone={() => { ls.set('carnet-setpw', null); setSetpw(null); }} />;
  if (cloud && !links.legacy && !myRow() && !syncState.last) return <Waiting />;
  if (cloud && !links.legacy && (!myRow() || !myRow().onboarded)) return <ProfileSetup />;

  const athTab = ['athletes', 'Athlètes', 'people'];
  const tabs = r === 'coach' ? (coach ? [athTab, ...BASE_TABS] : [athTab, BASE_TABS[3]]) : coach ? [BASE_TABS[0], athTab, ...BASE_TABS.slice(1)] : BASE_TABS;
  const cur = tabs.some(t => t[0] === tab) ? tab : tabs[0][0];
  const noPlan = !meta() && ['today', 'stats', 'plan'].includes(cur);
  const openSession = k => { setDay(null); setSes(k); };
  const openTest = tid => { setDay(null); ls.set('carnet-stats-view', 'tests'); setTestFocus(tid); setTab('stats'); };
  const goSettings = () => { try { sessionStorage.setItem('carnet-more', 'settings'); } catch (_) {} setTab('more'); };
  const self = isSelf(), subj = getSubject(), bar = !self && cur !== 'athletes';
  const onEdit = canEditPlan() ? setEdit : null;
  return (
    <>
      {bar && <SubjectBar onSelf={() => { setSubject(SELF); setTab('today'); }} />}
      <main class={bar ? 'with-subj' : ''} key={subj}>
        {noPlan && <Onboarding onSettings={goSettings} />}
        {!noPlan && cur === 'today' && <Today onStart={openSession} onEdit={onEdit} onOpenTest={openTest} />}
        {cur === 'athletes' && <Athletes onOpenAthlete={uid => { setSubject(uid); markSeen(uid); setTab('today'); }} onOpenDay={(uid, k) => { setSubject(uid); markSeen(uid); setDay(k); }} onOpenPlan={uid => { setSubject(uid); markSeen(uid); setPlanView('prog'); setTab('plan'); }} onGoMore={goSettings} />}
        {!noPlan && cur === 'stats' && <Stats onOpen={setDay} onOpenTest={openTest} testFocus={testFocus} key={testFocus || 'stats'} />}
        {!noPlan && cur === 'plan' && <PlanTab onOpen={setDay} />}
        {cur === 'more' && <More session={session} />}
      </main>
      <nav class={'tabbar' + (tabs.length > 5 ? ' six' : '')} style={tabs.length < 5 ? 'grid-template-columns:repeat(' + tabs.length + ',minmax(0,1fr))' + (tabs.length < 4 ? ';padding-left:15%;padding-right:15%' : '') : ''} role="tablist" aria-label="Navigation">
        {tabs.map(([id, l, ic]) => <button role="tab" aria-selected={cur === id ? 'true' : 'false'} onClick={() => { if (cur === id) window.scrollTo({ top: 0, behavior: 'smooth' }); setTab(id); if (id !== 'stats') setTestFocus(null); }}><span class="ti"><Icon name={ic} />{id === 'athletes' && unread > 0 && <i class="dotn">{unread > 9 ? '9+' : unread}</i>}</span>{l}</button>)}
      </nav>
      {day && !edit && <Sheet title={self ? 'Fiche du jour' : 'Fiche de ' + nameOf(subj)} onClose={() => setDay(null)}><DayView k={day} onNav={setDay} onStart={openSession} onEdit={onEdit} onOpenTest={openTest} key={day} /></Sheet>}
      {edit && <DayEditor k={edit} onClose={() => setEdit(null)} />}
      {ses && <SessionMode k={ses} onClose={() => setSes(null)} />}
    </>
  );
}
