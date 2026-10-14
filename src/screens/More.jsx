// Onglet Plus : Profil en haut, les repères (échelles, lexique, sources), l'installation, puis Paramètres en bas.
import { useState } from 'preact/hooks';
import { syncState, myProfile, links, role, isAdmin } from '../lib/store.js';
import { cloud } from '../lib/supa.js';
import { meta } from '../lib/plan.js';
import { SPORT_LBL } from '../lib/sports.js';
import { Icon } from '../ui/kit.jsx';
import { SettingsPage, ProfilePage } from './Settings.jsx';
import { AdminPage } from './Admin.jsx';
import { ROLE_LBL } from './Setup.jsx';
import { Mark, Wordmark } from '../ui/Logo.jsx';
import { ReperesCard } from '../ui/Reperes.jsx';

// appli déjà installée sur l'écran d'accueil : la marche à suivre ne sert plus
const installed = () => { try { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (_) { return false; } };

export function More({ session }) {
  const [page, setPage] = useState(() => { try { return sessionStorage.getItem('carnet-more') || null; } catch (_) { return null; } });
  const go = p => { setPage(p); try { if (p) sessionStorage.setItem('carnet-more', p); else sessionStorage.removeItem('carnet-more'); } catch (_) {} window.scrollTo(0, 0); };
  if (page === 'admin' && isAdmin()) return <AdminPage onBack={() => go('settings')} />;
  if (page === 'settings' || page === 'admin') return <SettingsPage session={session} onBack={() => go(null)} onAdmin={() => go('admin')} />;
  if (page === 'profile') return <ProfilePage onBack={() => go(null)} />;
  const r = role(), p = myProfile();
  const sp = (p.sports || []).map(x => SPORT_LBL[x]).filter(Boolean);
  return (
    <div class="screen">
      <div class="head"><div><div class="eyebrow">Alipto</div><h1 class="title">Plus</h1></div></div>
      <div class="stack cols2">
        <button class="card li-card" onClick={() => go('profile')}>
          <span class="av">{(p.name || '?').slice(0, 1).toUpperCase()}</span>
          <span><b>Profil</b><small>{[p.name, r && cloud ? ROLE_LBL[r] : null, sp.length ? sp.join(', ') : null].filter(Boolean).join(' · ') || 'Toi, ton niveau, ton coach'}</small></span>
          <span class="chev r" aria-hidden="true" />
        </button>
        {syncState.rejectedAt > 0 && Date.now() - syncState.rejectedAt < 6e4 && <p class="lock-n"><Icon name="lock" size={16} />Une modification a été refusée par le serveur{links.myLock ? ' : ton plan est verrouillé par ton coach' : ''}.</p>}
        <ReperesCard />
        {!installed() && <section class="card">
          <h3 class="h3">Installer sur l’iPhone</h3>
          <ol class="proto">
            <li>Ouvre l’adresse de l’appli dans <b>Safari</b>.</li>
            <li>Touche le bouton <b>Partager</b> (le carré avec la flèche).</li>
            <li>Choisis <b>Sur l’écran d’accueil</b>, puis <b>Ajouter</b>.</li>
            <li>Lance Alipto depuis son icône : plein écran, hors ligne, et notifications possibles.</li>
          </ol>
        </section>}
        <button class="card li-card" onClick={() => go('settings')}>
          <Icon name="sliders" />
          <span><b>Paramètres</b><small>Apparence, séance, notifications, compte, données</small></span>
          <span class="chev r" aria-hidden="true" />
        </button>
        <div class="more-foot">
          <Mark size={40} />
          <div><Wordmark size={24} />
            <p>Du grec <i>aleiptès</i> : celui qui préparait les athlètes, à la fois entraîneur et soigneur. Ton plan, ta forme, tes tests et ton coach au même endroit.</p>
            <p style="margin-top:4px">Version 3.5{meta() ? ' · ' + meta().title : ''}</p></div>
        </div>
      </div>
    </div>
  );
}
