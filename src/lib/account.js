// Comptes : codes de partage athlète → coach, liens, verrou du plan, administration.
import { sb } from './supa.js';
import { links, syncNow } from './store.js';

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O ni 1/I
export const fmtCode = c => String(c || '').replace(/(.{4})(?=.)/g, '$1-');
const fr = e => {
  const m = (e && (e.message || e.error_description || String(e))) || 'Erreur';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Impossible de joindre le serveur. Vérifie ta connexion.';
  if (/schema cache|does not exist|Could not find the (table|function)/i.test(m)) return 'La base n’est pas à jour : lance le script de l’étape 2 dans Supabase.';
  if (/row-level security|permission denied/i.test(m)) return 'Action non autorisée pour ce compte.';
  return m;
};
async function run(p) { const { data, error } = await p; if (error) throw new Error(fr(error)); return data; }

/* ---------- Athlète : partager son carnet ---------- */
export async function newCode() {
  const b = new Uint8Array(8); crypto.getRandomValues(b);
  const code = Array.from(b, x => ALPHA[x % ALPHA.length]).join('');
  const rows = await run(sb.from('invite_codes').insert({ code }).select());
  return rows && rows[0] ? rows[0] : { code, expires_at: new Date(Date.now() + 7 * 864e5).toISOString() };
}
export const myCodes = () => run(sb.from('invite_codes').select('code,expires_at').order('created_at', { ascending: false }));
export const deleteCode = code => run(sb.from('invite_codes').delete().eq('code', code));

/* ---------- Coach : ajouter un athlète avec son code ---------- */
export async function redeem(code) {
  const r = await run(sb.rpc('redeem_code', { c: code }));
  await syncNow();
  return r && r.athlete_id;
}
export async function unlink(coach, athlete) {
  await run(sb.from('coach_links').delete().eq('coach_id', coach).eq('athlete_id', athlete));
  await syncNow();
}
export async function setLock(athlete, locked) {
  await run(sb.from('coach_links').update({ plan_locked: locked }).eq('coach_id', links.me).eq('athlete_id', athlete));
  links.locks = Object.assign({}, links.locks, { [athlete]: locked });
  await syncNow();
}

/* ---------- Administration ---------- */
export const adminUsers = () => run(sb.rpc('admin_users'));
export const adminSetRole = (uid, r) => run(sb.rpc('admin_set_role', { uid, r }));
export const adminLink = (coach, athlete, linked) => run(sb.rpc('admin_link', { coach, athlete, linked }));
// Adresse de l'appli, pour les liens des e-mails (invitation, mot de passe oublié)
export const appUrl = () => location.origin + location.pathname.replace(/index\.html$/, '');
export async function adminFn(body) {
  const { data, error } = await sb.functions.invoke('admin', { body: Object.assign({ redirectTo: appUrl() }, body) });
  if (error) {
    let msg = error.message || 'Erreur', status = error.context && error.context.status;
    try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (_) {}
    if (status === 404 || /not.?found/i.test(msg)) msg = 'La fonction « admin » n’est pas déployée dans Supabase (Edge Functions → nom exact : admin).';
    else if (status === 401 && !/Session/.test(msg)) msg = 'Supabase refuse l’appel : désactive « Verify JWT » sur la fonction admin (Edge Functions → admin → Details).';
    else if (/Failed to send|fetch|Load failed|NetworkError/i.test(msg)) msg = navigator.onLine === false ? 'Pas de connexion internet.' : 'Fonction « admin » injoignable. Dans Supabase → Edge Functions, vérifie qu’elle s’appelle exactement « admin » et que « Verify JWT » est désactivé, puis réessaie.';
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}
export function tempPassword() {
  const b = new Uint8Array(10); crypto.getRandomValues(b);
  const s = Array.from(b, x => 'abcdefghjkmnpqrstuvwxyz23456789'[x % 31]).join('');
  return s.slice(0, 5) + '-' + s.slice(5);
}

// Mot de passe oublié : e-mail avec un lien qui rouvre l'appli sur « Nouveau mot de passe »
export async function forgotPassword(email) {
  const { error } = await sb.auth.resetPasswordForEmail(String(email || '').trim().toLowerCase(), { redirectTo: appUrl() });
  if (error) {
    const m = error.message || '';
    if (/after \d+ seconds|rate limit|too many/i.test(m)) throw new Error('Un e-mail vient déjà de partir : attends une minute avant d’en redemander un.');
    if (/sending|smtp|not authorized/i.test(m)) throw new Error('L’e-mail n’a pas pu partir. Demande à ton coach ou à l’administrateur de te redéfinir un mot de passe.');
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) throw new Error('Impossible de joindre le serveur. Vérifie ta connexion.');
    throw new Error(m);
  }
}
