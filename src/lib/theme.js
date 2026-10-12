// Apparence : système, clair ou sombre (réglage de l'appareil). Le script en tête d'index.html l'applique avant l'affichage.
const KEY = 'carnet-theme';
export function getTheme() { try { return localStorage.getItem(KEY) || 'system'; } catch (_) { return 'system'; } }
export function applyTheme(t) {
  const el = document.documentElement;
  if (t === 'light' || t === 'dark') el.setAttribute('data-theme', t); else el.removeAttribute('data-theme');
  document.querySelectorAll('meta[name=theme-color]').forEach(m => {
    const dark = t === 'dark' || (t !== 'light' && /dark/.test(m.getAttribute('media') || ''));
    m.setAttribute('content', dark ? '#0f1214' : '#e8ebe8');
  });
}
export function setTheme(t) {
  try { if (t === 'light' || t === 'dark') localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); } catch (_) {}
  applyTheme(t);
}
