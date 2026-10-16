// Whoop côté web : appels à la fonction Supabase « whoop » (secret et jetons restent sur le serveur) puis fusion dans le journal.
import { sb } from './supa.js';
import { mergeDays } from './whoop.js';
import { todayKey, addDays } from './dates.js';

const ON = 'alipto-whoop';
export const whoopWanted = () => { try { return localStorage.getItem(ON) === '1'; } catch (_) { return false; } };
const setWanted = v => { try { if (v) localStorage.setItem(ON, '1'); else localStorage.removeItem(ON); } catch (_) {} };

// Retour de Whoop : l'adresse contient ?whoop=ok ou ?whoop=error (lue une fois, puis effacée)
export const WHOOP_RETURN = (() => {
  try {
    const q = new URLSearchParams(location.search), r = q.get('whoop');
    if (!r) return null;
    q.delete('whoop');
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    return r === 'ok' ? 'ok' : 'error';
  } catch (_) { return null; }
})();

async function fn(body) {
  const { data, error } = await sb.functions.invoke('whoop', { body });
  if (error) {
    let msg = error.message || 'Erreur', status = error.context && error.context.status;
    try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (_) {}
    if (status === 404 || /not.?found/i.test(msg)) msg = 'La fonction « whoop » n’est pas déployée dans Supabase (Edge Functions → nom exact : whoop).';
    else if (status === 401 && !/Session/.test(msg)) msg = 'Supabase refuse l’appel : désactive « Verify JWT » sur la fonction whoop.';
    else if (/Failed to send|fetch|Load failed|NetworkError/i.test(msg)) msg = navigator.onLine === false ? 'Pas de connexion internet.' : 'Fonction « whoop » injoignable : vérifie qu’elle est déployée.';
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

export const whoopStatus = async () => { const s = await fn({ action: 'status' }); setWanted(!!(s && s.connected)); return s; };
export async function whoopConnect() { const r = await fn({ action: 'connect', ret: 'web' }); location.href = r.url; }
export async function whoopDisconnect() { await fn({ action: 'disconnect' }); setWanted(false); }
// Les `days` derniers jours (aujourd'hui compris) ; renvoie le nombre de jours modifiés
export async function whoopSync(days = 7) {
  const to = todayKey(), from = addDays(to, -days);
  let tz = 'Europe/Paris'; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch (_) {}
  const r = await fn({ action: 'sync', from, to, tz });
  if (!r.connected) { setWanted(false); throw new Error('La connexion Whoop a expiré : reconnecte-toi dans Paramètres → Connexions.'); }
  return mergeDays(r.days || {});
}
