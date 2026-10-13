// Onglet « Plan » : le calendrier (jour par jour) et le programme (blocs, semaines, repères) réunis.
import { useState } from 'preact/hooks';
import { Calendar } from './Calendar.jsx';
import { PlanScreen } from './Plan.jsx';
import { TextSeg } from '../ui/kit.jsx';

const KEY = 'alipto-plan-view';
export function setPlanView(v) { try { localStorage.setItem(KEY, v); } catch (_) {} }
function getPlanView() { try { return localStorage.getItem(KEY) || 'cal'; } catch (_) { return 'cal'; } }

export function PlanTab({ onOpen }) {
  const [v, setV] = useState(getPlanView);
  const seg = <div style="margin-bottom:14px"><TextSeg value={v} onChange={x => { const n = x || v; setV(n); setPlanView(n); window.scrollTo(0, 0); }} options={[['cal', 'Calendrier'], ['prog', 'Programme']]} label="Vue du plan" /></div>;
  return v === 'prog' ? <PlanScreen seg={seg} /> : <Calendar onOpen={onOpen} seg={seg} />;
}
