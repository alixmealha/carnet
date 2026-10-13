// Profil : saisie à la première connexion, puis modifiable dans Paramètres.
import { useState } from 'preact/hooks';
import { myProfile, myRow, saveMyProfile, role as roleOf } from '../lib/store.js';
import { logWeight } from '../lib/tests.js';
import { TextSeg, toast } from '../ui/kit.jsx';
import { Mark } from '../ui/Logo.jsx';

export const SEXES = [['F', 'Femme'], ['M', 'Homme'], ['X', 'Autre']];
export const ROLE_LBL = { athlete: 'Athlète', coach: 'Coach', admin: 'Administrateur' };
const YEAR = new Date().getFullYear();
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };

// Vérifie les champs ; renvoie un message d'erreur ou les valeurs propres
export function checkBody(f) {
  const out = { sex: f.sex || null, birth_year: null, height_cm: null, weight_kg: null };
  if (String(f.birth_year || '').trim()) { const y = Math.round(num(f.birth_year)); if (!(y >= 1930 && y <= YEAR - 5)) return 'Année de naissance à vérifier.'; out.birth_year = y; }
  if (String(f.height_cm || '').trim()) { const h = num(f.height_cm); if (!(h >= 100 && h <= 230)) return 'Taille en centimètres, entre 100 et 230.'; out.height_cm = Math.round(h); }
  if (String(f.weight_kg || '').trim()) { const w = num(f.weight_kg); if (!(w >= 25 && w <= 200)) return 'Poids en kilos, entre 25 et 200.'; out.weight_kg = Math.round(w * 10) / 10; }
  return out;
}
export const bodyDraft = p => ({ sex: p.sex || null, birth_year: p.birth_year ? String(p.birth_year) : '', height_cm: p.height_cm ? String(p.height_cm) : '', weight_kg: p.weight_kg ? String(p.weight_kg).replace('.', ',') : '' });

export function BodyFields({ f, set }) {
  return (
    <div class="stack" style="gap:12px">
      <div><p class="sub-lbl" style="margin-top:0">Sexe</p><TextSeg value={f.sex} onChange={v => set({ sex: v })} options={SEXES} label="Sexe" />
        {f.sex === 'F' && <p class="small" style="margin:6px 0 0">Le suivi du cycle menstruel s’active : il ajoute le jour du cycle à la forme du matin (désactivable dans Paramètres).</p>}</div>
      <div class="grid3">
        <label class="fld">Naissance<input class="in mono" inputmode="numeric" placeholder="année" value={f.birth_year} onInput={e => set({ birth_year: e.target.value })} /></label>
        <label class="fld">Taille (cm)<input class="in mono" inputmode="numeric" value={f.height_cm} onInput={e => set({ height_cm: e.target.value })} /></label>
        <label class="fld">Poids (kg)<input class="in mono" inputmode="decimal" value={f.weight_kg} onInput={e => set({ weight_kg: e.target.value })} /></label>
      </div>
      <p class="small" style="margin:0">L’année de naissance adapte les repères de sommeil (8 à 10 h avant 18 ans). Le poids sert aux tests rapportés au poids de corps ; tu le mettras à jour quand il change, l’historique est gardé dans Suivi → Tests.</p>
    </div>
  );
}

export function ProfileSetup() {
  const p = myProfile(), row = myRow(), preset = row && row.role;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(p.name || '');
  const [role, setRole] = useState(preset || null);
  const [f, setF] = useState(() => bodyDraft(p));
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const steps = ['name'].concat(preset ? [] : ['role']).concat(role === 'coach' ? [] : ['body']);
  const cur = steps[Math.min(step, steps.length - 1)], last = step >= steps.length - 1;
  const next = async () => {
    setErr('');
    if (cur === 'name' && !name.trim()) { setErr('Ton prénom, pour que ton coach ou tes athlètes te reconnaissent.'); return; }
    if (cur === 'role' && !role) { setErr('Choisis athlète ou coach.'); return; }
    if (!last) { setStep(step + 1); return; }
    const body = role === 'coach' ? {} : checkBody(f);
    if (typeof body === 'string') { setErr(body); return; }
    setBusy(true);
    try {
      await saveMyProfile(Object.assign({ name: name.trim().slice(0, 40), role, onboarded: true }, body));
      if (role !== 'coach' && body.weight_kg) logWeight(body.weight_kg);
      toast('Profil enregistré');
    } catch (e) { setErr(/Failed to fetch|network|load/i.test(e.message || '') ? 'Pas de connexion : réessaie dans un instant.' : e.message); }
    setBusy(false);
  };
  return (
    <form class="login setup" onSubmit={e => { e.preventDefault(); next(); }}>
      {step === 0 && <Mark size={44} />}
      <div class="eyebrow">Premier lancement · {step + 1}/{steps.length}</div>
      {cur === 'name' && <>
        <h1 class="title" style="font-size:52px">Bienvenue</h1>
        <p class="lead" style="margin:0">Quelques infos pour régler ton carnet. Elles restent privées : seuls toi{preset === 'coach' ? ', tes athlètes' : ' et ton coach'} les voyez.</p>
        <label class="fld">Prénom<input class="in" value={name} autocomplete="given-name" onInput={e => setName(e.target.value)} autofocus /></label>
        {preset && <p class="small" style="margin:0">Ton compte : <b>{ROLE_LBL[preset]}</b>.</p>}
      </>}
      {cur === 'role' && <>
        <h1 class="title" style="font-size:44px">Tu es…</h1>
        <div class="stack" style="gap:10px">
          <button type="button" class={'role-c' + (role === 'athlete' ? ' on' : '')} onClick={() => setRole('athlete')}><b>Athlète</b><span>Tu suis ton plan, tu notes ta forme, tes séances et tes tests. Tu peux ouvrir ton carnet à un coach avec un code.</span></button>
          <button type="button" class={'role-c' + (role === 'coach' ? ' on' : '')} onClick={() => setRole('coach')}><b>Coach</b><span>Tu suis le carnet de tes athlètes grâce au code qu’ils te donnent : lecture, commentaires et modification de leurs séances. Pas de carnet personnel.</span></button>
        </div>
        <p class="small" style="margin:0">Ce choix est définitif : seul l’administrateur peut le changer ensuite.</p>
      </>}
      {cur === 'body' && <>
        <h1 class="title" style="font-size:44px">Ton profil</h1>
        <BodyFields f={f} set={patch => setF(Object.assign({}, f, patch))} />
      </>}
      {err && <p class="err" role="alert">{err}</p>}
      <div class="row-btns">
        {step > 0 && <button type="button" class="btn" onClick={() => { setErr(''); setStep(step - 1); }}>Retour</button>}
        <button type="submit" class="btn big primary" style="flex:1" disabled={busy}>{busy ? 'Enregistrement…' : last ? 'C’est parti' : 'Continuer'}</button>
      </div>
    </form>
  );
}

// Formulaire de profil dans Paramètres
export function ProfileForm() {
  const p = myProfile(), r = roleOf();
  const [name, setName] = useState(p.name || '');
  const [f, setF] = useState(() => bodyDraft(p));
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const coach = r === 'coach';
  const dirty = name.trim() !== (p.name || '') || JSON.stringify(f) !== JSON.stringify(bodyDraft(p));
  const save = async () => {
    setErr('');
    if (!name.trim()) { setErr('Le prénom ne peut pas être vide.'); return; }
    const body = coach ? {} : checkBody(f);
    if (typeof body === 'string') { setErr(body); return; }
    setBusy(true);
    try {
      const wasW = Number(p.weight_kg) || null;
      await saveMyProfile(Object.assign({ name: name.trim().slice(0, 40) }, body));
      if (!coach && body.weight_kg && body.weight_kg !== wasW) logWeight(body.weight_kg);
      toast('Profil enregistré');
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <div class="stack" style="gap:12px">
      <label class="fld">Prénom<input class="in" value={name} onInput={e => setName(e.target.value)} /></label>
      {!coach && <BodyFields f={f} set={patch => setF(Object.assign({}, f, patch))} />}
      {err && <p class="err">{err}</p>}
      <button class="btn primary" disabled={!dirty || busy} onClick={save}>{busy ? 'Enregistrement…' : 'Enregistrer le profil'}</button>
    </div>
  );
}
