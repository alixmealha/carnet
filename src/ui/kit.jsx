import { useEffect, useRef, useState } from 'preact/hooks';
import { SOURCES } from '../lib/sources.js';

const P = { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
const ICONS = {
  today: <g {...P}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3.2" /></g>,
  cal: <g {...P}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /><path d="M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 17h2M11 17h2" /></g>,
  stats: <g {...P}><path d="M4 20h16" /><rect x="5.5" y="11" width="3" height="7" rx="1" /><rect x="10.5" y="6" width="3" height="12" rx="1" /><rect x="15.5" y="13.5" width="3" height="4.5" rx="1" /></g>,
  plan: <g {...P}><path d="M4 6.5h3M4 12h3M4 17.5h3M10 6.5h10M10 12h10M10 17.5h7" /></g>,
  more: <g {...P}><circle cx="12" cy="12" r="8.5" /><circle cx="8" cy="12" r=".6" fill="currentColor" /><circle cx="12" cy="12" r=".6" fill="currentColor" /><circle cx="16" cy="12" r=".6" fill="currentColor" /></g>,
  left: <path {...P} d="M14.5 5.5 8 12l6.5 6.5" />,
  right: <path {...P} d="M9.5 5.5 16 12l-6.5 6.5" />,
  close: <path {...P} d="M6 6l12 12M18 6 6 18" />,
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />,
  pause: <g fill="currentColor"><rect x="7" y="5.5" width="3.5" height="13" rx="1" /><rect x="13.5" y="5.5" width="3.5" height="13" rx="1" /></g>,
  timer: <g {...P}><circle cx="12" cy="13.5" r="7" /><path d="M12 13.5V10M10 3.5h4M18 7l1.5-1.5" /></g>,
  check: <path {...P} stroke-width="2.4" d="M5.5 12.5 10 17l8.5-9.5" />,
  edit: <g {...P}><path d="M14.5 5.5 18.5 9.5 9 19H5v-4z" /></g>,
  plus: <path {...P} d="M12 5v14M5 12h14" />,
  up: <path {...P} d="M6 14.5 12 8.5l6 6" />,
  down: <path {...P} d="M6 9.5 12 15.5l6-6" />,
  trash: <g {...P}><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></g>,
  people: <g {...P}><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /><circle cx="16.8" cy="9.5" r="2.5" /><path d="M15.5 14.2c2.6-.3 4.6 1.3 5 4.3" /></g>,
  bell: <g {...P}><path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></g>,
  send: <g {...P}><path d="M4 12 20 4l-6 16-3-7z" /><path d="M11 13 20 4" /></g>,
  flask: <g {...P}><path d="M9.5 3.5h5M10.5 3.5v6L5 19a1.3 1.3 0 0 0 1.1 2h11.8a1.3 1.3 0 0 0 1.1-2l-5.5-9.5v-6" /><path d="M7.5 15h9" /></g>,
  back: <path {...P} d="M19 12H6M11 6l-6 6 6 6" />,
  lock: <g {...P}><rect x="5" y="10.5" width="14" height="10" rx="2.2" /><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" /></g>,
  key: <g {...P}><circle cx="8" cy="14.5" r="4" /><path d="M11 11.5 19.5 3M16 6.5l2.5 2.5M14 8.5l2 2" /></g>,
  shield: <g {...P}><path d="M12 3.5 19 6v5.5c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6z" /><path d="m9 12 2.2 2.2L15.5 10" /></g>,
  chevd: <path {...P} d="M7 10l5 5 5-5" />
};
export function Icon({ name, size }) {
  return <svg viewBox="0 0 24 24" width={size || 24} height={size || 24} aria-hidden="true">{ICONS[name]}</svg>;
}

export function Seg({ value, onChange, from = 1, to = 5, tgt, label, dense, labels }) {
  const out = [];
  for (let i = from; i <= to; i++) out.push(
    <button type="button" aria-pressed={value === i ? 'true' : 'false'} class={tgt && tgt(i) ? 'tgt' : ''} onClick={() => onChange(value === i ? null : i)} aria-label={(labels && labels[i]) || String(i)}>{i}</button>
  );
  return <div class={'seg' + (dense ? ' dense' : '')} role="group" aria-label={label}>{out}</div>;
}
export function TextSeg({ value, onChange, options, label }) {
  return <div class="seg txt" role="group" aria-label={label}>{options.map(([k, l]) =>
    <button type="button" aria-pressed={value === k ? 'true' : 'false'} onClick={() => onChange(value === k ? null : k)}>{l}</button>)}</div>;
}

export function Sheet({ title, onClose, right, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, []);
  // glisser vers le bas pour fermer
  const drag = useRef(null);
  const onTouchStart = e => { const b = ref.current && ref.current.querySelector('.sheet-b'); drag.current = { y: e.touches[0].clientY, top: b ? b.scrollTop : 0, dy: 0 }; };
  const onTouchMove = e => {
    const d = drag.current; if (!d || d.top > 0) return;
    d.dy = Math.max(0, e.touches[0].clientY - d.y);
    if (d.dy > 0 && ref.current) ref.current.style.transform = 'translateY(' + d.dy + 'px)';
  };
  const onTouchEnd = () => {
    const d = drag.current; drag.current = null; if (!ref.current) return;
    if (d && d.dy > 110) onClose(); else { ref.current.style.transition = 'transform .2s'; ref.current.style.transform = ''; setTimeout(() => { if (ref.current) ref.current.style.transition = ''; }, 220); }
  };
  return (
    <div class="sheet-wrap" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="sheet" ref={ref} role="dialog" aria-modal="true" aria-label={title} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div class="sheet-h">
          <button class="btn ghost" onClick={onClose}>Fermer</button>
          <div class="t">{title}</div>
          <div style="min-width:64px;display:flex;justify-content:flex-end">{right}</div>
        </div>
        <div class="sheet-b">{children}</div>
      </div>
    </div>
  );
}

// Écran large (ordinateur, iPad à l'horizontale) : mise en page sur deux colonnes et menu latéral
export const WIDE = '(min-width: 1000px)';
export function useWide() {
  const mq = typeof matchMedia === 'function' ? matchMedia(WIDE) : null;
  const [w, setW] = useState(mq ? mq.matches : false);
  useEffect(() => {
    if (!mq) return;
    const f = () => setW(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', f); else mq.addListener(f);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', f); else mq.removeListener(f); };
  }, []);
  return w;
}
export function useWidth(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(es => { for (const e of es) setW(Math.round(e.contentRect.width)); });
    ro.observe(ref.current); return () => ro.disconnect();
  }, []);
  return w;
}

let toastTimer = null;
export function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

export function NumberInput({ value, onCommit, step, placeholder, label, suffix }) {
  const [v, setV] = useState(value == null ? '' : String(value).replace('.', ','));
  useEffect(() => { setV(value == null ? '' : String(value).replace('.', ',')); }, [value]);
  return <label class="fld">{label}<input class="in mono" inputmode="decimal" value={v} placeholder={placeholder}
    onInput={e => setV(e.target.value)}
    onBlur={() => { const n = parseFloat(String(v).replace(',', '.')); onCommit(isNaN(n) ? null : n); }} />{suffix}</label>;
}

/* ---------- Texte avec couleurs de prises : « 4 blocs [violet] » ---------- */
const HOLD = /\[(jaune|vert|bleu|violet|rouge|blanc|noir|rose|orange|gris|marron)\]/g;
export function Rich({ text }) {
  if (!text) return null;
  const s = String(text), out = []; let last = 0, m; HOLD.lastIndex = 0;
  while ((m = HOLD.exec(s))) { if (m.index > last) out.push(s.slice(last, m.index)); out.push(<span class={'hold h-' + m[1]}>{m[1]}</span>); last = m.index + m[0].length; }
  if (last < s.length) out.push(s.slice(last));
  return <>{out}</>;
}

/* ---------- Carte dépliable (état retenu sur l'appareil) ---------- */
export function Fold({ id, title, summary, right, children, open: dflt, cls }) {
  const key = 'fold:' + id;
  const [open, setOpen] = useState(() => { try { const v = localStorage.getItem(key); return v === null ? !!dflt : v === '1'; } catch (_) { return !!dflt; } });
  const toggle = () => { const v = !open; setOpen(v); try { localStorage.setItem(key, v ? '1' : '0'); } catch (_) {} };
  return (
    <section class={'card fold-card' + (open ? ' open' : '') + (cls ? ' ' + cls : '')}>
      <button type="button" class="fold-h" aria-expanded={open ? 'true' : 'false'} onClick={toggle}>
        <span class="fold-t"><span class="ch-t">{title}</span>{summary && <span class="fold-s">{summary}</span>}</span>
        {right}<span class="chev" aria-hidden="true" />
      </button>
      {open && <div class="fold-b">{children}</div>}
    </section>
  );
}

/* ---------- Sources scientifiques ---------- */
export function Src({ ids }) {
  const [open, setOpen] = useState(false);
  const list = (ids || []).filter(id => SOURCES[id]);
  if (!list.length) return null;
  return <>
    <button type="button" class="src" onClick={e => { e.stopPropagation(); setOpen(true); }}>{list.map(id => SOURCES[id].s).join(' · ')}</button>
    {open && <Sheet title="Sources" onClose={() => setOpen(false)}>
      <div class="stack">{list.map(id => <div class="card"><b>{SOURCES[id].s}</b><p class="small" style="color:var(--ink)">{SOURCES[id].n}</p><p class="small">{SOURCES[id].r}</p></div>)}</div>
    </Sheet>}
  </>;
}
