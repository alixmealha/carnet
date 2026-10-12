import { useRef, useState, useEffect } from 'preact/hooks';
import { useWidth } from './kit.jsx';

// Cadre de graphique : axes, grille, étiquettes, info-bulle au toucher.
// draw(ctx) renvoie les éléments SVG ; tip(i) renvoie le texte de l'info-bulle de l'index i.
export function Chart({ n, height = 160, yMin = 0, yMax, ticks, fmtY, xLabels, draw, tip, padL = 30, padR = 8, minLabelGap = 34, hl }) {
  const ref = useRef(null), w = useWidth(ref);
  const [sel, setSel] = useState(null);
  const hide = useRef(null);
  useEffect(() => () => clearTimeout(hide.current), []);
  const W = w || 0, pt = 10, pb = xLabels ? 22 : 8, pl = padL, pr = padR, iw = Math.max(10, W - pl - pr), ih = height - pt - pb;
  const slot = iw / Math.max(1, n), span = (yMax - yMin) || 1;
  const cx = i => pl + slot * (i + 0.5);
  const y = v => pt + ih - (Math.max(yMin, Math.min(yMax, v)) - yMin) / span * ih;
  const ctx = { W, H: height, pl, pr, pt, pb, iw, ih, slot, cx, y, sel };
  const at = ev => { const r = ref.current.getBoundingClientRect(); const i = Math.floor((ev.clientX - r.left - pl) / slot); return i >= 0 && i < n ? i : null; };
  const down = ev => {
    const i = at(ev); clearTimeout(hide.current);
    if (i === null || (sel === i && ev.pointerType !== 'mouse')) { setSel(null); return; }
    setSel(i);
    if (ev.pointerType !== 'mouse') hide.current = setTimeout(() => setSel(null), 4000);
  };
  const move = ev => { if (ev.pointerType === 'mouse' || ev.buttons) { const i = at(ev); if (i !== null) setSel(i); } };
  const every = Math.max(1, Math.ceil(minLabelGap / slot));
  const tt = sel !== null && tip ? tip(sel) : null;
  const tipX = sel !== null ? Math.max(70, Math.min(W - 70, cx(sel))) : 0;
  return (
    <div class="ch" ref={ref} style={'height:' + height + 'px'} onPointerDown={down} onPointerMove={move} onPointerLeave={ev => { if (ev.pointerType === 'mouse') setSel(null); }}>
      {W > 0 && <svg width={W} height={height} role="img">
        {(ticks || []).map(t => <g>
          <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="var(--rule)" stroke-width="1" />
          <text x={pl - 6} y={y(t) + 3.5} text-anchor="end" font-size="10" font-family="var(--f-mono)" fill="var(--muted)">{fmtY ? fmtY(t) : t}</text>
        </g>)}
        {hl !== undefined && hl !== null && hl >= 0 && hl < n && <rect x={cx(hl) - Math.min(slot, 26) / 2} y={pt - 4} width={Math.min(slot, 26)} height={ih + 4} fill="var(--accent-soft)" opacity=".6" rx="3" />}
        {sel !== null && <rect x={cx(sel) - Math.min(slot, 26) / 2} y={pt - 4} width={Math.min(slot, 26)} height={ih + 4} fill="var(--sunk)" rx="3" />}
        {draw(ctx)}
        {xLabels && xLabels.map((l, i) => l && (i === hl || (i % every === 0 && (hl == null || hl < 0 || Math.abs(i - hl) >= every))) ?
          <text x={cx(i)} y={height - 6} text-anchor="middle" font-size="10" font-family="var(--f-mono)" fill={i === hl ? 'var(--ink)' : 'var(--muted)'}>{l}</text> : null)}
      </svg>}
      {tt && <div class="tip" style={'left:' + tipX + 'px;top:' + pt + 'px'}>{tt}</div>}
    </div>
  );
}

export function niceMax(v, steps = 4) {
  if (!v || v <= 0) return { max: steps, ticks: Array.from({ length: steps + 1 }, (_, i) => i) };
  const raw = v / steps, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  const st = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  const max = st * Math.ceil(v / st);
  const ticks = []; for (let t = 0; t <= max + 1e-9; t += st) ticks.push(Math.round(t * 100) / 100);
  return { max, ticks };
}

export function linePath(pts) { return pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(''); }
