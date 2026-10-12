// Notifications push (iPhone : appli installée sur l'écran d'accueil, iOS 16.4 ou plus).
import { sb, cloud, vapidKey } from './supa.js';

export const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
export const supported = () => cloud && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function keyBytes(b64) { const s = b64.replace(/-/g, '+').replace(/_/g, '/'); const p = s + '='.repeat((4 - (s.length % 4)) % 4); return Uint8Array.from(atob(p), c => c.charCodeAt(0)); }
async function reg() { return navigator.serviceWorker.ready; }

export async function pushState() {
  if (!supported()) return isIOS() && !standalone() ? 'install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try { const r = await reg(); const s = await r.pushManager.getSubscription(); return s && Notification.permission === 'granted' ? 'on' : 'off'; } catch (_) { return 'off'; }
}
export async function enablePush() {
  if (!supported()) throw new Error(isIOS() && !standalone() ? 'Installe d’abord l’appli sur l’écran d’accueil (Safari → Partager → Sur l’écran d’accueil), puis ouvre-la depuis son icône.' : 'Les notifications ne sont pas disponibles sur cet appareil.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications refusées. Tu peux les réautoriser dans Réglages → Notifications → Carnet.');
  const r = await reg();
  let s = await r.pushManager.getSubscription();
  if (!s) s = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey) });
  const j = s.toJSON();
  const { error } = await sb.from('push_subs').upsert({ endpoint: j.endpoint, sub: { endpoint: j.endpoint, keys: j.keys } }, { onConflict: 'endpoint' });
  if (error) throw new Error(error.message);
  return true;
}
export async function disablePush() {
  try {
    const r = await reg(); const s = await r.pushManager.getSubscription();
    if (s) { await sb.from('push_subs').delete().eq('endpoint', s.endpoint); await s.unsubscribe(); }
  } catch (_) {}
}
export function setBadge(n) { try { if (n > 0 && navigator.setAppBadge) navigator.setAppBadge(n); else if (navigator.clearAppBadge) navigator.clearAppBadge(); } catch (_) {} }
