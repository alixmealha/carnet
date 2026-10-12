import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore, startAutoSync, syncState, syncNow, jget, links, isSelf, setSubject, getSubject, nameOf, myProfile, putFor, SELF } from './lib/store.js';
import { sb, cloud } from './lib/supa.js';
import { meta, newPlan } from './lib/plan.js';
import { setBadge } from './lib/push.js';
import { ImportPicker } from './ui/ImportPicker.jsx';
import { todayKey } from './lib/dates.js';
import { Icon, Sheet, toast } from './ui/kit.jsx';
import { Today } from './screens/Today.jsx';
import { Calendar } from './screens/Calendar.jsx';
import { DayView } from './screens/DayView.jsx';
import { SessionMode } from './screens/Session.jsx';
import { Stats } from './screens/Stats.jsx';
import { PlanScreen, DayEditor } from './screens/Plan.jsx';
import { More } from './screens/More.jsx';
import { Athletes, unreadCount, markSeen } from './screens/Athletes.jsx';

const BASE_TABS = [['today', 'Aujourd’hui', 'today'], ['cal', 'Calendrier', 'cal'], ['stats', 'Suivi', 'stats'], ['plan', 'Plan', 'plan'], ['more', 'Plus', 'more']];
const ls = {
  get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) {} }
};

function useSession() {
  const [s, setS] = useState(cloud ? undefined : { local: true });
  useEffect(() => {
    if (!cloud) return;
    sb.auth.getSession().then(({ data }) => setS(data.session || null));
    const { data } = sb.auth.onAuthStateChange((_ev, session) => setS(session || null));
    return () => data.subscription.unsubscribe();
  }, []);
  return s;
}

function Login() {
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const submit = async ev => {
    ev.preventDefault(); setErr(''); setBusy(true);
    try {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw });
      if (error) setErr(/invalid/i.test(error.message) ? 'Email ou mot de passe incorrect.' : navigator.onLine === false ? 'Pas de connexion internet.' : /fetch|network|load/i.test(error.message) ? 'Impossible de joindre le serveur. Vérifie ta connexion et réessaie.' : /confirm/i.test(error.message) ? 'Ce compte n’est pas encore confirmé.' : error.message);
    } catch (e) { setErr(navigator.onLine === false ? 'Pas de connexion internet.' : 'Connexion impossible pour le moment.'); }
    setBusy(false);
  };
  return (
    <form class="login" onSubmit={submit}>
      <div class="eyebrow">Carnet d’entraînement</div>
      <h1 class="title" style="font-size:56px">Carnet</h1>
      <p class="lead" style="margin:0 0 6px">Connecte-toi pour retrouver ton plan, ton journal et tes tests.</p>
      <label class="fld">Email<input class="in" type="email" autocomplete="username" inputmode="email" autocapitalize="off" value={email} onInput={e => setEmail(e.target.value)} required /></label>
      <label class="fld">Mot de passe<input class="in" type="password" autocomplete="current-password" value={pw} onInput={e => setPw(e.target.value)} required /></label>
      {err && <p class="err" role="alert">{err}</p>}
      <button class="btn big primary" type="submit" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
      <p class="small">Accès sur invitation : ton compte est créé par ton coach.</p>
    </form>
  );
}

function Onboarding({ onAthletes }) {
  const waiting = cloud && !syncState.last && (syncState.state === 'syncing' || syncState.state === 'idle');
  if (waiting) return <div class="login"><div class="eyebrow">Carnet</div><h1 class="title">Un instant</h1><p class="lead">Récupération de tes données…</p></div>;
  const self = isSelf(), who = nameOf(getSubject());
  if (!self) return (
    <div class="login">
      <div class="eyebrow">Carnet de {who}</div>
      <h1 class="title" style="font-size:44px">Pas encore de plan</h1>
      <p class="lead" style="margin:0">Importe le plan de {who} (fichier .json) : séances, cycles, repères, et son journal s’il y en a un.</p>
      <ImportPicker label={'Importer le plan de ' + who} />
      <button class="btn ghost" onClick={() => { newPlan(); toast('Plan vide créé'); }}>Créer un plan vide</button>
      <button class="btn" onClick={() => setSubject(SELF)}>Revenir à mon carnet</button>
    </div>
  );
  return (
    <div class="login">
      <div class="eyebrow">Premier lancement</div>
      <h1 class="title" style="font-size:52px">Bienvenue</h1>
      {links.coaches.length > 0 ? <p class="lead" style="margin:0">Ton coach prépare ton plan : il apparaîtra ici dès qu’il sera prêt. Tu peux aussi importer un fichier.</p>
        : <p class="lead" style="margin:0">Importe ton plan (fichier .json) : séances, cycles, repères et ton journal déjà rempli.</p>}
      <ImportPicker label="Importer un plan" />
      <button class="btn ghost" onClick={() => { newPlan(); toast('Plan vide créé, à remplir dans l’onglet Plan'); }}>Commencer avec un plan vide</button>
      {links.athletes.length > 0 && <button class="btn" onClick={onAthletes}>Voir mes athlètes</button>}
      {syncState.state === 'error' && <p class="err">Synchronisation impossible : {syncState.error}</p>}
    </div>
  );
}

function NamePrompt() {
  const [v, setV] = useState('');
  return (
    <Sheet title="Bienvenue" onClose={() => {}}>
      <div class="stack">
        <p class="lead" style="margin:0">Comment tu t’appelles ? Ton prénom s’affiche chez ton coach (ou tes athlètes) et dans les notifications.</p>
        <label class="fld">Prénom<input class="in" value={v} onInput={e => setV(e.target.value)} autofocus /></label>
        <button class="btn big primary" disabled={!v.trim()} onClick={() => putFor(SELF, 'profile', Object.assign({}, myProfile(), { name: v.trim() }))}>Continuer</button>
      </div>
    </Sheet>
  );
}

export function App() {
  useStore();
  const session = useSession();
  const [tab, setTab] = useState(() => ls.get('carnet-tab') || 'today');
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
      if (a && links.athletes.includes(a)) { setSubject(a); markSeen(a); } else if (!a) setSubject(SELF);
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

  if (session === undefined) return null;
  if (cloud && !session) return <Login />;
  const tabs = coach ? [BASE_TABS[0], ['athletes', 'Athlètes', 'people'], ...BASE_TABS.slice(1)] : BASE_TABS;
  const cur = tabs.some(t => t[0] === tab) ? tab : 'today';
  const needName = cloud && syncState.last && !myProfile().name;
  if (!meta() && cur !== 'athletes') return <>{needName && <NamePrompt />}<Onboarding onAthletes={() => setTab('athletes')} /></>;

  const openSession = k => { setDay(null); setSes(k); };
  const openTest = tid => { setDay(null); ls.set('carnet-stats-view', 'tests'); setTestFocus(tid); setTab('stats'); };
  const self = isSelf(), subj = getSubject();
  return (
    <>
      {!self && <div class="subj"><span><Icon name="people" size={18} />Carnet de <b>{nameOf(subj)}</b></span><button onClick={() => { setSubject(SELF); setTab(coach ? 'athletes' : 'today'); }}>Revenir au mien</button></div>}
      <main class={self ? '' : 'with-subj'} key={subj}>
        {cur === 'today' && <Today onStart={openSession} onEdit={setEdit} onOpenTest={openTest} />}
        {cur === 'athletes' && <Athletes onOpenAthlete={uid => { setSubject(uid); markSeen(uid); setTab('today'); }} onOpenDay={(uid, k) => { setSubject(uid); markSeen(uid); setDay(k); }} onGoMore={() => { setSubject(SELF); setTab('more'); }} />}
        {cur === 'cal' && <Calendar onOpen={setDay} />}
        {cur === 'stats' && <Stats onOpen={setDay} onOpenTest={openTest} testFocus={testFocus} key={testFocus || 'stats'} />}
        {cur === 'plan' && <PlanScreen />}
        {cur === 'more' && <More session={session} />}
      </main>
      <nav class={'tabbar' + (tabs.length > 5 ? ' six' : '')} role="tablist" aria-label="Navigation">
        {tabs.map(([id, l, ic]) => <button role="tab" aria-selected={cur === id ? 'true' : 'false'} onClick={() => { if (cur === id) window.scrollTo({ top: 0, behavior: 'smooth' }); setTab(id); if (id !== 'stats') setTestFocus(null); }}><span class="ti"><Icon name={ic} />{id === 'athletes' && unread > 0 && <i class="dotn">{unread > 9 ? '9+' : unread}</i>}</span>{l}</button>)}
      </nav>
      {day && !edit && <Sheet title={self ? 'Fiche du jour' : 'Fiche de ' + nameOf(subj)} onClose={() => setDay(null)}><DayView k={day} onNav={setDay} onStart={openSession} onEdit={setEdit} onOpenTest={openTest} key={day} /></Sheet>}
      {edit && <DayEditor k={edit} onClose={() => setEdit(null)} />}
      {ses && <SessionMode k={ses} onClose={() => setSes(null)} />}
      {needName && <NamePrompt />}
    </>
  );
}
