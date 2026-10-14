// Notification de fin de repos quand l'appli passe en arrière-plan (iPhone : appli web en pause dès qu'on la quitte).
// Les minuteurs en cours déclarent leur prochaine fin de repos ; quand l'écran passe en arrière-plan, on demande
// à la fonction « minuteur » une notification à cette heure-là, et on l'annule en revenant dans l'appli.
// Envoi en texte simple (sendBeacon) : il part même pendant la mise en pause, sans pré-vol CORS.
import { sb, cloud } from './supa.js';
import { SUPABASE_URL } from '../config.js';

const MIN_LEFT = 25000; // en dessous, la notification arriverait trop tard pour être utile
const sources = new Map();
let token = null, armed = null;
export function setAlert(key, fn) { sources.set(key, fn); }
export function clearAlert(key) { sources.delete(key); }

function send(body) {
  const url = SUPABASE_URL + '/functions/v1/minuteur', data = JSON.stringify(body);
  try { if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([data], { type: 'text/plain' }))) return; } catch (_) {}
  try { fetch(url, { method: 'POST', body: data, headers: { 'Content-Type': 'text/plain' }, keepalive: true }).catch(() => {}); } catch (_) {}
}
// prochaine fin de repos parmi les minuteurs en cours
export function nextAlert(now) {
  let best = null;
  for (const fn of sources.values()) {
    let a = null; try { a = fn && fn(); } catch (_) {}
    if (a && a.at - now >= MIN_LEFT && (!best || a.at < best.at)) best = a;
  }
  return best;
}
const allowed = () => cloud && SUPABASE_URL && typeof Notification !== 'undefined' && Notification.permission === 'granted';

export function initRestPush() {
  if (!cloud || !sb || !sb.auth || !SUPABASE_URL) return;
  try { sb.auth.getSession().then(r => { token = r && r.data && r.data.session ? r.data.session.access_token : null; }).catch(() => {}); } catch (_) {}
  try { sb.auth.onAuthStateChange((ev, s) => { token = s ? s.access_token : null; }); } catch (_) {}
  document.addEventListener('visibilitychange', () => {
    if (!token || !allowed()) return;
    if (document.visibilityState === 'hidden') {
      const a = nextAlert(Date.now()); if (!a) return;
      armed = 'r' + Math.random().toString(36).slice(2, 12);
      send({ token, id: armed, at: Math.round(a.at), msg: { title: a.title || 'Repos terminé', body: a.body || '' } });
    } else if (armed) { send({ token, id: armed, cancel: true }); armed = null; }
  });
}
