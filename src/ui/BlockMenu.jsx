// « Pas possible maintenant ? » : faire un bloc à un autre moment de la journée, un autre jour, ou pas du tout (avec la raison)
import { useState } from 'preact/hooks';
import { jget, planLocked, links, isSelf } from '../lib/store.js';
import { SKIP, skipLabel, blockState, setBlockState, moveBlock, unmoveBlock, day, sessionName, apartOf, moveTargets, blocks, placeBlock, resetOrder, setSwap, clearSwap, itemKey } from '../lib/plan.js';
import { LIB } from '../lib/library.js';
import { heavyOf, groupsTxt } from '../lib/builder.js';
import { addDays, todayKey, fmtShort } from '../lib/dates.js';
import { Sheet, toast } from './kit.jsx';

const plain = s => String(s || '').replace(/\[[a-z]+\]\s*/g, '').trim();
// Alerte 48 h : le bloc sollicite-t-il en lourd les mêmes groupes que ce jour-là, la veille ou le lendemain ?
export function moveWarn(k, b, to) {
  const mine = heavyOf({ blocks: [b] }); if (!mine.size) return null;
  const hv = d => { const dd = day(d); return heavyOf(dd && d === k ? { blocks: dd.blocks.filter(x => x.id !== b.id) } : dd); };
  const out = [];
  const same = [...mine].filter(g => hv(to).has(g)); if (same.length) out.push(groupsTxt(same) + ' déjà en lourd ce jour-là');
  for (const [o, w] of [[-1, 'la veille'], [1, 'le lendemain']]) { const g = [...mine].filter(x => hv(addDays(to, o)).has(x)); if (g.length) out.push(groupsTxt(g) + ' en lourd ' + w); }
  return out.length ? out.join(' · ') : null;
}

export function BlockMenu({ k, b, onClose, top }) {
  const e = jget(k), st = blockState(e, b), locked = planLocked(), today = todayKey(), name = plain(b.title);
  const [mode, setMode] = useState(null);
  const days = moveTargets(k);
  const done = msg => { toast(msg); onClose(); };
  const apart = apartOf(e, b.id);
  // place dans la séance et exercice remplacé : ce qui s'est vraiment passé, sans toucher au plan
  const real = blocks(k).filter(x => x.kind !== 'rest' && x.id !== b.id && !blockState(e, x));
  const first = blocks(k).find(x => x.kind !== 'rest' && !blockState(e, x));
  const swappable = (b.items || []).filter(x => x.id !== 'ech' && x.id !== 'rac' && !x.opt);
  const [pick, setPick] = useState(swappable.length === 1 ? swappable[0].id : null);
  const cur = swappable.find(x => x.id === pick) || null, was = cur && (e.swap || {})[itemKey(b, cur)];
  const [form, setForm] = useState(null);
  const open = x => { const sw = (e.swap || {})[itemKey(b, x)]; setPick(x.id); setForm(sw ? { label: sw.label || '', det: sw.det || '', pct: sw.pct || (b.finger && b.finger.unit === '%' ? b.finger.load : ''), lib: sw.lib || '' } : { label: '', det: '', pct: b.finger && b.finger.unit === '%' ? b.finger.load : '', lib: '' }); };
  const sugg = LIB.filter(x => x.k === b.kind && !(cur && x.id === cur.lib)).slice(0, 8);
  const saveSwap = () => {
    const label = String(form.label || '').trim(); if (!label || !cur) return;
    const pct = parseFloat(String(form.pct).replace(',', '.'));
    setSwap(k, b, cur, { label, det: String(form.det || '').trim(), pct: isNaN(pct) || pct <= 0 ? null : pct, lib: form.lib || null });
    done(label + ' : fait à la place');
  };
  return (
    <Sheet title={name} onClose={onClose} cls={top ? 'top' : ''}>
      <div class="stack" style="gap:10px">
        {st && <div class="bm-now">
          <p style="margin:0">{st === 'apart' ? (apart && apart.endedAt ? 'Fait à part.' : 'À faire à part, à un autre moment de la journée.') : st === 'moved' ? 'Déplacé au ' + fmtShort(e.moved[b.id].to).toLowerCase() + '.' : 'Pas fait · ' + (skipLabel(e.skip[b.id])).toLowerCase() + '.'}</p>
          {!(st === 'apart' && apart && apart.endedAt) && <button class="btn" onClick={() => { if (st === 'moved') unmoveBlock(k, b); else setBlockState(k, b, null); done('Remis dans la séance'); }}>Remettre dans la séance</button>}
        </div>}
        {st !== 'apart' && <button type="button" class="bm-opt" onClick={() => { setBlockState(k, b, 'apart'); done(name + ' : à faire à part'); }}>
          <b>{k === today ? 'À un autre moment de la journée' : 'À part ce jour-là'}</b>
          <span>Avant ou après la séance, par exemple le matin pour grimper l’après-midi. Il aura sa propre durée et son ressenti.</span>
        </button>}
        {st !== 'moved' && <>
          <button type="button" class={'bm-opt' + (mode === 'day' ? ' on' : '')} aria-expanded={mode === 'day' ? 'true' : 'false'} onClick={() => setMode(mode === 'day' ? null : 'day')}>
            <b>Un autre jour</b><span>{locked ? 'Ton plan est verrouillé par ton coach : demande-lui, ou fais-le à part aujourd’hui.' : 'Le bloc est ajouté au plan du jour choisi.'}</span>
          </button>
          {mode === 'day' && !locked && <div class="bm-days">{days.map(d => { const w = moveWarn(k, b, d); return (
            <button type="button" onClick={() => { moveBlock(k, b, d); done(name + ' déplacé au ' + fmtShort(d).toLowerCase()); }}>
              <b>{d === today ? 'Aujourd’hui' : fmtShort(d)}</b><span>{sessionName(d)}</span>{w && <em>{w}</em>}
            </button>); })}</div>}
        </>}
        {!st && real.length > 0 && <>
          <button type="button" class={'bm-opt' + (mode === 'order' ? ' on' : '')} aria-expanded={mode === 'order' ? 'true' : 'false'} onClick={() => setMode(mode === 'order' ? null : 'order')}>
            <b>Je l’ai fait à un autre moment de la séance</b><span>Par exemple après la grimpe au lieu d’avant. Le plan ne change pas, ton journal garde l’ordre réel.</span>
          </button>
          {mode === 'order' && <div class="bm-days">
            {first && first.id !== b.id && <button type="button" onClick={() => { placeBlock(k, b, null); done(name + ' : fait en premier'); }}><b>En premier</b></button>}
            {real.map(x => <button type="button" onClick={() => { placeBlock(k, b, x.id); done(name + ' : fait après ' + plain(x.title).toLowerCase()); }}><b>Juste après</b><span>{plain(x.title)}</span></button>)}
            {Array.isArray(e.order) && e.order.length > 0 && <button type="button" onClick={() => { resetOrder(k); done('Ordre prévu remis'); }}><b>Remettre l’ordre prévu</b></button>}
          </div>}
        </>}
        {!st && swappable.length > 0 && <>
          <button type="button" class={'bm-opt' + (mode === 'swap' ? ' on' : '')} aria-expanded={mode === 'swap' ? 'true' : 'false'} onClick={() => { const on = mode === 'swap'; setMode(on ? null : 'swap'); if (!on && swappable.length === 1) open(swappable[0]); }}>
            <b>J’ai fait un autre exercice</b><span>Matériel absent, autre choix : tu notes ce que tu as fait à la place. Le plan ne change pas.</span>
          </button>
          {mode === 'swap' && <div class="stack" style="gap:10px">
            {swappable.length > 1 && <div class="chips">{swappable.map(x => <button type="button" class={'chip' + (pick === x.id ? ' on' : '')} onClick={() => open(x)}>{plain(x.label)}</button>)}</div>}
            {cur && form && <>
              {was && <p class="small" style="margin:0">Fait à la place de : {plain(was && cur.swap ? cur.swap.from : cur.label)}</p>}
              {sugg.length > 0 && <div class="chips">{sugg.map(x => <button type="button" class="chip" onClick={() => setForm(f => ({ ...f, label: x.n, lib: x.id, det: f.det || x.c || '' }))}>{x.n}</button>)}</div>}
              <label class="fld"><span>Ce que tu as fait</span><input value={form.label} placeholder="ex. Suspension 20 mm, pieds en appui" onInput={ev => setForm(f => ({ ...f, label: ev.currentTarget.value }))} /></label>
              <label class="fld"><span>Détail (facultatif)</span><input value={form.det} placeholder="ex. pieds au sol pour alléger, 10 s" onInput={ev => setForm(f => ({ ...f, det: ev.currentTarget.value }))} /></label>
              <label class="fld"><span>% de ton max visé (facultatif)</span><input inputmode="decimal" value={form.pct} placeholder="ex. 85" onInput={ev => setForm(f => ({ ...f, pct: ev.currentTarget.value }))} /></label>
              <button class="btn primary" onClick={saveSwap} disabled={!String(form.label || '').trim()}>Enregistrer</button>
              {was && <button class="btn" onClick={() => { clearSwap(k, b, cur); done('Exercice prévu remis'); }}>Remettre l’exercice prévu</button>}
            </>}
          </div>}
        </>}
        {st !== 'skip' && <>
          <button type="button" class={'bm-opt' + (mode === 'skip' ? ' on' : '')} aria-expanded={mode === 'skip' ? 'true' : 'false'} onClick={() => setMode(mode === 'skip' ? null : 'skip')}>
            <b>Je ne le fais pas</b><span>La raison est gardée dans le journal{isSelf() && links.coaches && links.coaches.length ? ' et ton coach la voit' : ''}.</span>
          </button>
          {mode === 'skip' && <div class="chips">{SKIP.map(([v, l]) => <button type="button" class="chip" onClick={() => { setBlockState(k, b, 'skip', v); done(name + ' : pas fait'); }}>{l}</button>)}</div>}
        </>}
      </div>
    </Sheet>
  );
}
