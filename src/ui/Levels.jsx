// « Mes repères » : niveau en escalade, 1RM, VMA, FC max. Tout est facultatif ; à défaut, l'appli estime d'après tes tests et tes séances.
import { useState } from 'preact/hooks';
import { isSelf } from '../lib/store.js';
import { SCALE } from '../lib/grades.js';
import { CLIMB_KEYS, LIFTS, levelsDoc, setLevel, oneRM, climbLevel, vmaOf, fcmaxOf, srcTxt, csOf, vo2Of, ftpOf, runProfile } from '../lib/levels.js';
import { sportsOf } from '../lib/sports.js';
import { Gloss } from './Gloss.jsx';

const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
const fmt = v => v == null ? '' : String(v).replace('.', ',');

// Quels repères montrer : selon les sports du profil (ou ce que demande l'assistant)
export function levelGroups(sports, need) {
  const s = sports || [];
  const all = !s.length;
  return {
    climb: need ? need.climb : all || s.includes('escalade'),
    lifts: need ? need.lifts : (all || s.some(x => ['muscu', 'hyrox', 'combat', 'collectif', 'escalade'].includes(x))) ? (s.length && s.every(x => x === 'escalade') ? ['pull', 'dips'] : Object.keys(LIFTS)) : [],
    cardio: need ? need.cardio : all || s.some(x => ['course', 'trail', 'velo', 'natation', 'hyrox', 'collectif', 'combat'].includes(x))
  };
}

// lv / onSet : repères propres à un programme (coach qui prépare le programme d'un athlète) ; sinon le profil
export function LevelsForm({ need, lv: lvIn, onSet }) {
  const self = isSelf() && !onSet;
  const lv = lvIn || levelsDoc();
  const g = levelGroups(sportsOf(), need);
  const set = (key, val, sub) => { if (onSet) onSet(key, val, sub); else setLevel(key, val, sub); };
  const cl = climbLevel(null, lvIn), vma = vmaOf(null, lvIn), fc = fcmaxOf(null, lvIn), cs = csOf(), vo2 = vo2Of(null, lvIn), ftp = ftpOf(null, lvIn), rp = runProfile(null, lvIn);
  return <div class="stack" style="gap:14px">
    {g.climb && <div>
      <p class="sub-lbl" style="margin:0 0 6px">Escalade <small>bloc en Fontainebleau, voie en cotation française</small></p>
      <div class="grid2">{CLIMB_KEYS.map(([k, disc, , l]) => <label class="fld">{l}
        <select class="in" value={lv[k] || ''} onChange={e => set(k, e.target.value || null)}>
          <option value="">{cl[k] && cl[k].src !== 'déclaré' ? cl[k].g + ' (' + cl[k].src + ')' : '—'}</option>
          {SCALE[disc].filter((x, i) => i >= 3).map(x => <option value={x}>{x}</option>)}
        </select></label>)}</div>
      <p class="small" style="margin:6px 0 0"><Gloss text="Flash et à vue : ce que tu passes du premier coup. Les séances de volume s’y calent ; la force et la puissance se calent sur ton max." /></p>
    </div>}
    {g.lifts.length > 0 && <div>
      <p class="sub-lbl" style="margin:0 0 6px">Force · 1RM <small>charge max sur une répétition</small></p>
      <div class="grid2">{g.lifts.map(id => <RmField id={id} lv={lv} set={set} lvIn={lvIn} />)}</div>
      <p class="small" style="margin:6px 0 0">Les charges des exercices principaux sont calculées en % de ton 1RM. Sans valeur, l’appli prend ton dernier test ou l’estime d’après tes séries (charge, répétitions et réserve).</p>
    </div>}
    {g.cardio && <div>
      <p class="sub-lbl" style="margin:0 0 6px">Cardio</p>
      <div class="grid2">
        <NumField label="VMA (km/h)" value={lv.vma} hint={vma && vma.src !== 'déclarée' ? fmt(vma.v) + ' · ' + srcTxt(vma) : ''} onCommit={v => set('vma', v)} />
        <NumField label="VO2max (ml/kg/min)" value={lv.vo2} int hint={vo2 && vo2.src !== 'déclarée' ? vo2.v + ' · ' + vo2.src : 'montre, labo…'} onCommit={v => set('vo2', v)} />
        <NumField label="FC max (bpm)" value={lv.fcmax} int hint={fc && fc.src !== 'déclarée' ? fc.v + ' · ' + fc.src : ''} onCommit={v => set('fcmax', v)} />
        <NumField label="FTP vélo (W)" value={lv.ftp} int hint={ftp && ftp.src !== 'déclarée' ? ftp.v + ' W · ' + srcTxt(ftp) : ''} onCommit={v => set('ftp', v)} />
      </div>
      <p class="small" style="margin:6px 0 0">{cs ? 'Vitesse critique ' + fmt(cs.v) + ' km/h · D′ ≈ ' + cs.dp + ' m (test du ' + srcTxt(cs).replace('test le ', '') + '). ' : 'Vitesse critique : passe le test 3 min + 12 min dans Suivi → Tests. '}{rp ? rp.txt : ''}</p>
      <p class="small" style="margin:6px 0 0"><Gloss text="La VMA donne tes allures (endurance, 30/30, 3 min), la vitesse critique celles du seuil ; la FTP donne tes watts à vélo ; la FC max, tes zones de fréquence cardiaque." /></p>
    </div>}
    {!self && !onSet && <p class="small">Repères de l’athlète : lui seul peut les modifier.</p>}
  </div>;
}
function RmField({ id, lv, set, lvIn }) {
  const L = LIFTS[id], rm = oneRM(id, null, lvIn), dec = lv.rm && lv.rm[id];
  return <NumField label={L.l + (L.lest ? ' (lest)' : '') + ' · kg'} value={dec} hint={rm && rm.src !== 'déclaré' ? rm.txt + ' · ' + srcTxt(rm) : ''} onCommit={v => set('rm', v, id)} />;
}
function NumField({ label, value, hint, onCommit, int }) {
  const [v, setV] = useState(fmt(value));
  return <label class="fld">{label}<input class="in mono" inputmode={int ? 'numeric' : 'decimal'} value={v} placeholder={hint || '—'} onInput={e => setV(e.target.value)} onBlur={() => { const n = num(v); if ((n ?? null) !== (value ?? null)) onCommit(n == null ? null : int ? Math.round(n) : n); }} />{hint && !v && <small class="lv-hint">{hint}</small>}</label>;
}
