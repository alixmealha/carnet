// Mises à jour de l'appli installée : on enregistre le service worker, on vérifie régulièrement s'il existe
// une nouvelle version (au retour dans l'appli, puis toutes les 30 min) et on recharge dès qu'elle est active.
// Pendant une séance en cours, on attend la fin pour ne pas couper les minuteurs.
const busy = () => { try { return !!localStorage.getItem('carnet-ses'); } catch (_) { return false; } };
let pending = false;
export function applyUpdateIfIdle() { if (pending && !busy()) location.reload(); }

export function setupUpdates() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const base = import.meta.env.BASE_URL;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // première installation : rien à recharger
    pending = true; applyUpdateIfIdle();
  });
  navigator.serviceWorker.register(base + 'sw.js', { scope: base }).then(reg => {
    const check = () => { if (navigator.onLine !== false) reg.update().catch(() => {}); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    setInterval(check, 30 * 60 * 1000);
  }).catch(() => {});
}
