import { useState } from 'preact/hooks';
import { syncState, myProfile, isSelf, links, role, isAdmin, hasCarnet, canEditPlan } from '../lib/store.js';
import { cloud } from '../lib/supa.js';
import { exerciseNames, renameExercise, meta, KIND, KIND_ORDER } from '../lib/plan.js';
import { WELL, RPE, ZONES, SIV, bands } from '../lib/rules.js';
import { SOURCES } from '../lib/sources.js';
import { fmtDay } from '../lib/dates.js';
import { Icon, Sheet, toast } from '../ui/kit.jsx';
import { SettingsPage, Switch } from './Settings.jsx';
import { AdminPage } from './Admin.jsx';
import { ROLE_LBL } from './Setup.jsx';
import { Mark, Wordmark } from '../ui/Logo.jsx';

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
      <p class="small" style="margin:0 0 6px">{canEditPlan() ? 'Rangés par type de séance. Touche un exercice pour le renommer partout.' : 'Rangés par type de séance. Ton plan est verrouillé par ton coach.'}</p>
      {cats.map(k => <details class="fold ex-cat">
        <summary><span class="kdot" style={'background:var(--k-' + k + ')'} /><span style="flex:1;font-weight:600">{KIND[k]}</span><span class="muted" style="font-size:13px;margin-right:8px">{groups[k].length}</span></summary>
        <div class="list" style="margin:8px 0 4px">{groups[k].map(x => <button class="li" disabled={!canEditPlan()} onClick={() => setRen(x)}><span style="min-width:0">{x.label}<small>{x.n} séance{x.n > 1 ? 's' : ''} · du {fmtDay(x.first)} au {fmtDay(x.last)}</small></span><span class="r" /></button>)}</div>
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
      <details class="fold"><summary><span style="font-weight:600">Notation de la séance</span></summary>
        <div class="tw"><table class="t"><tbody>{SIV.map(([, l, q]) => <tr><td>{l}</td><td class="muted">{q}</td></tr>)}</tbody></table></div>
        <p class="small">Pour les séances d’escalade, chacun sur 10. Charge de séance = intensité + volume. Méthode de Marie Akrich ; l’étalonnage sur 10 est propre au carnet. Pour la muscu, le renfo et la kiné, on note les exercices réalisés (séries × répétitions × charge), la douleur en kiné ; pour le cardio, la distance et la fréquence cardiaque. Le ressenti × la durée reste la charge commune à toutes les activités.</p>
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
  const [page, setPage] = useState(() => { try { return sessionStorage.getItem('carnet-more') || null; } catch (_) { return null; } });
  const go = p => { setPage(p); try { if (p) sessionStorage.setItem('carnet-more', p); else sessionStorage.removeItem('carnet-more'); } catch (_) {} window.scrollTo(0, 0); };
  if (page === 'admin' && isAdmin()) return <AdminPage onBack={() => go('settings')} />;
  if (page === 'settings' || page === 'admin') return <SettingsPage session={session} onBack={() => go(null)} onAdmin={() => go('admin')} />;
  const r = role(), p = myProfile(), self = isSelf();
  return (
    <div class="screen">
      <div class="head"><div><div class="eyebrow">Alipto</div><h1 class="title">Plus</h1></div></div>
      <div class="stack cols2">
        <button class="card li-card" onClick={() => go('settings')}>
          <span class="av">{(p.name || '?').slice(0, 1).toUpperCase()}</span>
          <span><b>Paramètres</b><small>{[p.name, r && cloud ? ROLE_LBL[r] : null].filter(Boolean).join(' · ') || 'Profil, apparence, compte'}</small></span>
          <span class="chev r" aria-hidden="true" />
        </button>
        {syncState.rejectedAt > 0 && Date.now() - syncState.rejectedAt < 6e4 && <p class="lock-n"><Icon name="lock" size={16} />Une modification a été refusée par le serveur{links.myLock ? ' : ton plan est verrouillé par ton coach' : ''}.</p>}
        {meta() && (self ? hasCarnet() : true) && <Exercises />}
        <Reperes />
        <section class="card">
          <h3 class="h3">Installer sur l’iPhone</h3>
          <ol class="proto">
            <li>Ouvre l’adresse de l’appli dans <b>Safari</b>.</li>
            <li>Touche le bouton <b>Partager</b> (le carré avec la flèche).</li>
            <li>Choisis <b>Sur l’écran d’accueil</b>, puis <b>Ajouter</b>.</li>
            <li>Lance Alipto depuis son icône : plein écran, hors ligne, et notifications possibles.</li>
          </ol>
        </section>
        <section class="card about">
          <Mark size={52} />
          <div><Wordmark size={30} />
            <p>Du grec <i>aleiptès</i> : celui qui préparait les athlètes, à la fois entraîneur et soigneur. Ton plan, ta forme, tes tests et ton coach au même endroit.</p>
            <p class="small" style="margin-top:6px">Version 3.3{meta() ? ' · ' + meta().title : ''}</p></div>
        </section>
      </div>
    </div>
  );
}
