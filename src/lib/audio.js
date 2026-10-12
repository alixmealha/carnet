// Sons, voix et écran allumé pendant la séance.
// Sur iPhone, une app web ne peut pas faire vibrer le téléphone : les signaux passent par le son et l'écran.
import { settings } from './store.js';

let ctx = null;
export function unlockAudio() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch (_) {}
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator(), g = ctx.createGain();
    g.gain.value = 0.0001; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.02);
  } catch (_) {}
}
export function beep(freq = 880, dur = 0.12, vol = 0.25, delay = 0) {
  if (!settings().sound || !ctx) return;
  try {
    const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch (_) {}
}
export const tick = () => beep(660, 0.08, 0.18);
export const goSignal = () => { beep(1046, 0.18, 0.3); };
export const restSignal = () => { beep(523, 0.22, 0.28); };
export const doneSignal = () => { beep(784, 0.14, 0.28); beep(988, 0.14, 0.28, 0.16); beep(1318, 0.24, 0.28, 0.32); };

export function say(text) {
  if (!settings().voice || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = 'fr-FR'; u.rate = 1.05;
    window.speechSynthesis.speak(u);
  } catch (_) {}
}

let lock = null, wanted = false;
async function acquire() {
  try { if (wanted && 'wakeLock' in navigator && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen'); } catch (_) { lock = null; }
}
export function keepAwake(on) {
  wanted = on && settings().wake;
  if (wanted) acquire();
  else if (lock) { lock.release().catch(() => {}); lock = null; }
}
document.addEventListener('visibilitychange', () => { if (wanted && document.visibilityState === 'visible') acquire(); });
