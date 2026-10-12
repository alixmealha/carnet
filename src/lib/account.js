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
export async function adminFn(body) {
  const { data, error } = await sb.functions.invoke('admin', { body });
  if (error) {
    let msg = error.message || 'Erreur';
    try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (_) {}
    if (/not.?found|404/i.test(msg)) msg = 'La fonction « admin » n’est pas encore déployée dans Supabase (voir le guide).';
    else if (/Failed to send|fetch/i.test(msg)) msg = 'Fonction « admin » injoignable : vérifie qu’elle est déployée et ta connexion.';
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
