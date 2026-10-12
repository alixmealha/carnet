import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore, startAutoSync, syncState, syncNow, jget, put } from './lib/store.js';
import { sb, cloud } from './lib/supa.js';
import { meta, newPlan } from './lib/plan.js';
import { ImportPicker } from './ui/ImportPicker.jsx';
import { todayKey, fmtLong } from './lib/dates.js';
import { Icon, Sheet, toast } from './ui/kit.jsx';
import { Today } from './screens/Today.jsx';
import { Calendar } from './screens/Calendar.jsx';
import { DayView } from './screens/DayView.jsx';
import { SessionMode } from './screens/Session.jsx';
import { Stats } from './screens/Stats.jsx';
import { PlanScreen, DayEditor } from './screens/Plan.jsx';
import { More } from './screens/More.jsx';

const TABS = [['today', 'Aujourd’hui', 'today'], ['cal', 'Calendrier', 'cal'], ['stats', 'Suivi', 'stats'], ['plan', 'Plan', 'plan'], ['more', 'Plus', 'more']];
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
      if (error) setErr(/invalid/i.test(error.message) ? 'Email ou mot de passe incorrect.' : navigator.onLine === false ? 'Pas de connexion internet.' : /fetch|network|load/i.test(error.message) ? 'Impossible de joindre le serveur. Vérifie ta connexion et réessaie.' : /confirm/i.test(error.message) ? 'Ce compte n’est pas encore confirmé (coche « Auto Confirm User » dans Supabase).' : error.message);
    } catch (e) { setErr(navigator.onLine === false ? 'Pas de connexion internet.' : 'Connexion impossible pour le moment.'); }
    setBusy(false);
  };
  return (
    <form class="login" onSubmit={submit}>
      <div class="eyebrow">Carnet d’entraînement</div>
      <h1 class="title" style="font-size:56px">Carnet</h1>
      <p class="lead" style="margin:0 0 6px">Connecte-toi pour retrouver ton plan et ton journal.</p>
      <label class="fld">Email<input class="in" type="email" autocomplete="username" inputmode="email" autocapitalize="off" value={email} onInput={e => setEmail(e.target.value)} required /></label>
      <label class="fld">Mot de passe<input class="in" type="password" autocomplete="current-password" value={pw} onInput={e => setPw(e.target.value)} required /></label>
      {err && <p class="err" role="alert">{err}</p>}
      <button class="btn big primary" type="submit" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
      <p class="small">Accès privé. Il n’y a pas d’inscription : le compte se crée depuis Supabase.</p>
    </form>
  );
}

function Onboarding() {
  const waiting = cloud && !syncState.last && (syncState.state === 'syncing' || syncState.state === 'idle');
  if (waiting) return <div class="login"><div class="eyebrow">Carnet</div><h1 class="title">Un instant</h1><p class="lead">Récupération de tes données…</p></div>;
  return (
    <div class="login">
      <div class="eyebrow">Premier lancement</div>
      <h1 class="title" style="font-size:52px">Bienvenue</h1>
      <p class="lead" style="margin:0">Importe ton plan (le fichier <span class="num">carnet-import.json</span>) : séances, blocs, repères et ton journal déjà rempli.</p>
      <ImportPicker label="Importer mon plan" />
      <button class="btn ghost" onClick={() => { newPlan(); toast('Plan vide créé, à remplir dans l’onglet Plan'); }}>Commencer avec un plan vide</button>
      {syncState.state === 'error' && <p class="err">Synchronisation impossible : {syncState.error}</p>}
    </div>
  );
}

export function App() {
  useStore();
  const session = useSession();
  const [tab, setTab] = useState(() => ls.get('carnet-tab') || 'today');
  const [day, setDay] = useState(null);
  const [edit, setEdit] = useState(null);
  const [ses, setSes] = useState(() => {
    const k = ls.get('carnet-ses'); if (!k) return null;
    const e = jget(k); return k === todayKey() && e.startedAt && !e.endedAt ? k : null;
  });
  const started = useRef(false);
  useEffect(() => {
    if (!session || session.local) return;
    if (!started.current) { started.current = true; startAutoSync(); } else syncNow();
  }, [session && session.user && session.user.id]);
  useEffect(() => { ls.set('carnet-tab', tab); window.scrollTo(0, 0); }, [tab]);
  useEffect(() => { ls.set('carnet-ses', ses); }, [ses]);

  if (session === undefined) return null;
  if (cloud && !session) return <Login />;
  if (!meta()) return <Onboarding />;

  const openSession = k => { setDay(null); setSes(k); };
  return (
    <>
      <main>
        {tab === 'today' && <Today onStart={openSession} onEdit={setEdit} />}
        {tab === 'cal' && <Calendar onOpen={setDay} />}
        {tab === 'stats' && <Stats onOpen={setDay} />}
        {tab === 'plan' && <PlanScreen />}
        {tab === 'more' && <More session={session} />}
      </main>
      <nav class="tabbar" role="tablist" aria-label="Navigation">
        {TABS.map(([id, l, ic]) => <button role="tab" aria-selected={tab === id ? 'true' : 'false'} onClick={() => { if (tab === id) window.scrollTo({ top: 0, behavior: 'smooth' }); setTab(id); }}><Icon name={ic} />{l}</button>)}
      </nav>
      {day && !edit && <Sheet title="Fiche du jour" onClose={() => setDay(null)}><DayView k={day} onNav={setDay} onStart={openSession} onEdit={setEdit} key={day} /></Sheet>}
      {edit && <DayEditor k={edit} onClose={() => setEdit(null)} />}
      {ses && <SessionMode k={ses} onClose={() => setSes(null)} />}
    </>
  );
}
