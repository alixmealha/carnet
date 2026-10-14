// Le téléphone comme inclinomètre : posé à plat sur le segment (tibia, cuisse, avant-bras), il donne l'angle avec le sol.
// iPhone : l'accès aux capteurs de mouvement se demande une fois (bouton « Activer le capteur »).
import { useEffect, useRef, useState } from 'preact/hooks';
import { Sheet } from './kit.jsx';

// Pente du grand axe du téléphone par rapport à l'horizontale, signée (−90 à 90°).
// Avec les angles d'Euler du navigateur (alpha z, beta x', gamma y''), le grand axe vaut (0, cos β, sin β) :
// sa pente ne dépend que de beta, quel que soit le roulis (gamma).
export function tiltOf(beta) {
  const b = (beta || 0) * Math.PI / 180;
  return Math.round(Math.atan2(Math.sin(b), Math.abs(Math.cos(b))) * 180 / Math.PI);
}
export function Inclinometer({ onTake, onClose }) {
  const [deg, setDeg] = useState(null), [need, setNeed] = useState(false), [err, setErr] = useState('');
  const zero = useRef(0), [z, setZ] = useState(0);
  const start = () => {
    const on = e => { if (e.beta == null) return; setDeg(tiltOf(e.beta)); };
    window.addEventListener('deviceorientation', on);
    return () => window.removeEventListener('deviceorientation', on);
  };
  useEffect(() => {
    const D = window.DeviceOrientationEvent;
    if (!D) { setErr('Ce téléphone ne donne pas accès à ses capteurs de mouvement.'); return; }
    if (typeof D.requestPermission === 'function') { setNeed(true); return; }
    return start();
  }, []);
  const ask = async () => {
    try { const r = await window.DeviceOrientationEvent.requestPermission(); if (r === 'granted') { setNeed(false); start(); } else setErr('Accès aux capteurs refusé : tu peux saisir l’angle à la main.'); } catch (e) { setErr('Accès aux capteurs impossible : saisis l’angle à la main.'); }
  };
  const val = deg == null ? null : Math.abs(Math.round(deg - z));
  return <Sheet title="Mesurer l’angle" onClose={onClose} cls="top">
    <div class="stack incl">
      <p class="small" style="margin:0">Pose le téléphone à plat dans la longueur du segment (tibia, cuisse, avant-bras). L’angle est celui du téléphone avec le sol ; « Remettre à zéro » mesure par rapport à une autre position de départ.</p>
      {need && <button class="btn big primary" onClick={ask}>Activer le capteur</button>}
      <div class="incl-v" aria-live="polite">{val == null ? '—' : val + '°'}</div>
      {err && <p class="err">{err}</p>}
      <div class="row-btns">
        <button class="btn" style="flex:1" disabled={deg == null} onClick={() => { zero.current = deg; setZ(deg); }}>{z ? 'Zéro fait' : 'Remettre à zéro'}</button>
        <button class="btn primary" style="flex:1" disabled={val == null} onClick={() => onTake(val)}>Prendre {val == null ? '' : val + '°'}</button>
      </div>
    </div>
  </Sheet>;
}
