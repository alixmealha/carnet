// Alimentation : repas du jour (Aujourd'hui), bilan de la semaine (Suivi), compléments et réglages.
import { useEffect, useState } from 'preact/hooks';
import { isSelf, profileOf, getSubject, links, saveProfileDoc, myProfile, nameOf } from '../lib/store.js';
import { loadFoods, foodsReady, foodByCode, searchFoods, saveCustomFood, MEALS, mealsOf, setMeal, addFood, recents, savedMeals, saveMealPreset, deleteMealPreset, totals, dayTotals, dayTargets, dayAdvice, nutriPrefs, nutriVisible, refs, MICROS, NO_ALERT, weekSummary, weekAdvice, SUPPS, SUPP_WARN, LIFE, GOALS_W, loggedDay, resendNutrition } from '../lib/nutrition.js';
import { addDays, fmtNum, fmtShort, todayKey } from '../lib/dates.js';
import { Sheet, Fold, Icon, Src, TextSeg, toast } from '../ui/kit.jsx';

const R = x => Math.round(x).toLocaleString('fr-FR');
function Switch({ label, sub, on, onChange }) {
  return <label class="set"><span>{label}{sub && <small>{sub}</small>}</span><input type="checkbox" class="sw" checked={on} onChange={e => onChange(e.target.checked)} /></label>;
}
const f1 = x => fmtNum(Math.round(x * 10) / 10);
function useFoods() {
  const [, set] = useState(0);
  useEffect(() => { if (!foodsReady()) loadFoods().then(() => set(x => x + 1)).catch(() => set(x => x + 1)); }, []);
  return foodsReady();
}

// Barre de progression vers une cible (fourchette)
function Bar({ label, v, lo, hi, unit, nb, ref }) {
  const max = Math.max(hi || lo || 1, v) * 1.15, pct = Math.min(100, v / max * 100);
  const st = lo == null ? '' : v < lo * 0.9 ? 'low' : hi && v > hi * 1.1 ? 'high' : v >= lo ? 'ok' : 'near';
  const word = { low: 'en dessous', near: 'presque', ok: 'dans le repère', high: 'au-dessus' }[st] || '';
  return <div class={'nbar ' + st}>
    <div class="nbar-h"><span>{label}</span><b>{nb ? R(v) + (unit ? ' ' + unit : '') : word}</b>{nb && lo != null && <small>{hi ? R(lo) + '–' + R(hi) : '≥ ' + R(lo)}{unit ? ' ' + unit : ''}</small>}</div>
    <div class="nbar-t"><i style={'width:' + pct + '%'} />{lo != null && <em style={'left:' + (lo / max * 100) + '%;width:' + (((hi || lo) - lo) / max * 100) + '%'} />}</div>
  </div>;
}

/* ---------- Ajouter un aliment ---------- */
// Aliment absent de la table (produit de marque, poudre de protéines…) : valeurs de l'étiquette pour 100 g
function CustomFood({ name, onDone, onCancel }) {
  const [f, setF] = useState({ n: name || '', kcal: '', p: '', g: '', l: '', fib: '' });
  const num = v => { const x = parseFloat(String(v).replace(',', '.')); return isNaN(x) ? null : x; };
  const ok = f.n.trim() && num(f.kcal) != null;
  const fld = (key, l) => <label class="fld">{l}<input class="in mono" inputmode="decimal" value={f[key]} onInput={e => setF(Object.assign({}, f, { [key]: e.target.value }))} /></label>;
  return <section class="card stack" style="gap:10px">
    <b>Nouvel aliment</b>
    <label class="fld">Nom<input class="in" value={f.n} onInput={e => setF(Object.assign({}, f, { n: e.target.value }))} /></label>
    <p class="small" style="margin:0">Valeurs pour 100 g, lues sur l’étiquette.</p>
    <div class="grid3">{fld('kcal', 'Énergie (kcal)')}{fld('p', 'Protéines (g)')}{fld('g', 'Glucides (g)')}</div>
    <div class="grid3">{fld('l', 'Lipides (g)')}{fld('fib', 'Fibres (g)')}<div /></div>
    <div class="row-btns"><button class="btn" style="flex:1" onClick={onCancel}>Annuler</button>
      <button class="btn primary" style="flex:2" disabled={!ok} onClick={() => onDone(saveCustomFood(f.n.trim(), { kcal: num(f.kcal), p: num(f.p) || 0, g: num(f.g) || 0, l: num(f.l) || 0, fib: num(f.fib) }))}>Enregistrer</button></div>
    <p class="small" style="margin:0">Les vitamines et minéraux de cet aliment ne seront pas comptés.</p>
  </section>;
}

function FoodSheet({ k, meal, onClose }) {
  const ready = useFoods();
  const [q, setQ] = useState(''), [sel, setSel] = useState(null), [g, setG] = useState('100'), [save, setSave] = useState(false), [pname, setPname] = useState(''), [mk, setMk] = useState(false);
  const rec = recents(), list = q.trim() ? searchFoods(q, rec.map(r => r.c)) : [];
  const cur = mealsOf(k, null)[meal] || [], nb = nutriPrefs().numbers, lbl = MEALS.find(m => m[0] === meal)[1];
  const pick = f => { const r = rec.find(x => x.c === f.c); setSel(f); setG(String(r ? r.g : 100)); };
  const grams = parseFloat(String(g).replace(',', '.')) || 0;
  const add = () => { if (!sel || grams <= 0) return; addFood(k, meal, sel, grams); toast(sel.n.split(',')[0] + ' · ' + R(grams) + ' g'); setSel(null); setQ(''); };
  const prev = sel ? totals([{ c: sel.c, g: grams }]) : null;
  return (
    <Sheet title={lbl} onClose={onClose}>
      <div class="stack food-sheet">
        {cur.length > 0 && <div class="fs-cur">{cur.map((it, i) => <span class="chip">{it.n.split(',')[0]} · {R(it.g)} g<button aria-label={'Retirer ' + it.n} onClick={() => setMeal(k, meal, cur.filter((_, j) => j !== i))}>×</button></span>)}</div>}
        {!sel && !mk && <input class="in" type="search" placeholder="Rechercher un aliment (riz, pomme, yaourt…)" value={q} onInput={e => setQ(e.target.value)} autofocus />}
        {!ready && <p class="small">Chargement de la base d’aliments…</p>}
        {mk ? <CustomFood name={q} onCancel={() => setMk(false)} onDone={f => { setMk(false); pick(f); }} /> : sel ? <section class="card">
          <b>{sel.n}</b>
          <div class="qty"><label class="fld">Quantité (g)<input class="in mono" inputmode="decimal" value={g} onInput={e => setG(e.target.value)} /></label>
            <div class="chips">{[30, 50, 100, 150, 200, 250].map(x => <button type="button" class="chip sel" aria-pressed={grams === x ? 'true' : 'false'} onClick={() => setG(String(x))}>{x} g</button>)}</div></div>
          {prev && <p class="small mono">{nb ? R(prev.kcal) + ' kcal · ' : ''}P {f1(prev.p)} g · G {f1(prev.g)} g · L {f1(prev.l)} g{prev.fib ? ' · fibres ' + f1(prev.fib) + ' g' : ''}</p>}
          <div class="row-btns" style="margin-top:10px"><button class="btn" style="flex:1" onClick={() => setSel(null)}>Retour</button><button class="btn primary" style="flex:2" disabled={grams <= 0} onClick={add}>Ajouter</button></div>
        </section> : q.trim() ? <div class="list">{list.length ? list.map(f => <button class="li" onClick={() => pick(f)}><span style="min-width:0">{f.n}<small>{nb && f.v.kcal != null ? R(f.v.kcal) + ' kcal · ' : ''}P {f1(f.v.p || 0)} · G {f1(f.v.g || 0)} · L {f1(f.v.l || 0)} pour 100 g</small></span><span class="r" /></button>) : ready && <div class="li noarrow"><span>Aucun aliment trouvé. Essaie un mot plus simple (« poulet », « pâtes »).</span></div>}
          {ready && <button class="li" onClick={() => setMk(true)}><span style="min-width:0;color:var(--accent)">Créer « {q.trim()} »<small>produit de marque, complément : avec les valeurs de l’étiquette</small></span><span class="r" /></button>}</div>
          : <>
            {savedMeals().length > 0 && <div><p class="sub-lbl" style="margin-top:0">Repas enregistrés</p>
              <div class="list">{savedMeals().map(s => <div class="li noarrow"><button class="li-in" onClick={() => { setMeal(k, meal, cur.concat(s.items)); toast(s.name + ' ajouté'); }}><span style="min-width:0">{s.name}<small>{s.items.map(x => x.n.split(',')[0]).join(', ')}</small></span></button><button class="btn ghost" style="color:var(--crit)" onClick={() => { if (confirm('Supprimer « ' + s.name + ' » ?')) deleteMealPreset(s.id); }}>Supprimer</button></div>)}</div></div>}
            {rec.length > 0 && <div><p class="sub-lbl" style="margin-top:0">Récents</p>
              <div class="list">{rec.slice(0, 15).map(r => { const f = foodByCode(r.c); return f ? <button class="li" onClick={() => pick(f)}><span style="min-width:0">{f.n}<small>dernière portion : {R(r.g)} g</small></span><span class="r" /></button> : null; })}</div></div>}
            {!rec.length && !savedMeals().length && <p class="small" style="margin:0">Tape le nom d’un aliment : la base Ciqual de l’ANSES contient 3 484 aliments courants. Les portions que tu utilises sont retenues pour la prochaine fois.</p>}
          </>}
        {cur.length > 0 && !sel && (save ? <div style="display:flex;gap:8px;align-items:flex-end"><label class="fld" style="flex:1">Nom du repas<input class="in" value={pname} placeholder="Mon petit-déj" onInput={e => setPname(e.target.value)} /></label><button class="btn" disabled={!pname.trim()} onClick={() => { saveMealPreset(pname.trim(), cur); setSave(false); toast('Repas enregistré'); }}>OK</button></div>
          : <button class="btn ghost" style="align-self:flex-start" onClick={() => { setSave(true); setPname(lbl); }}>Enregistrer ce repas pour le réutiliser</button>)}
        <p class="small" style="margin:0">Valeurs : <Src ids={['ciqual2025']} /></p>
      </div>
    </Sheet>
  );
}

/* ---------- Carte du jour ---------- */
export function NutriDay({ k }) {
  const ready = useFoods(), self = isSelf();
  const [sheet, setSheet] = useState(null);
  if (!nutriVisible()) return null;
  const nb = nutriPrefs().numbers, m = mealsOf(k), tg = dayTargets(k), t = dayTotals(k), any = loggedDay(k);
  const y = addDays(k, -1), ym = mealsOf(y);
  const summary = any ? (nb ? R(t.kcal) + ' kcal · protéines ' + R(t.p) + ' g' : MEALS.filter(([id]) => (m[id] || []).length).length + ' repas notés') : (tg ? tg.ld.lbl : 'Rien de noté');
  const adv = dayAdvice(k);
  return (
    <Fold id="nutri-day" title="Alimentation" summary={summary} cls="nutri">
      {!tg && <p class="small" style="margin:0 0 10px">Renseigne ton poids et ta taille dans Paramètres → Profil pour avoir les repères du jour.</p>}
      {tg && <div class="n-tg">
        <div class="n-ld"><b>{tg.ld.lbl}</b>{nb && tg.kcal && <span>Dépense estimée ≈ {R(tg.ex.lo)} à {R(tg.ex.hi)} kcal{tg.goal !== 'maintien' ? ' · objectif ' + (tg.goal === 'perte' ? 'perte : ' : 'prise : ') + R(tg.kcal[0]) + '–' + R(tg.kcal[1]) + ' kcal' : ''}</span>}</div>
        {nb && <div class="n-chips"><span>Protéines <b>{tg.p[0]}–{tg.p[1]} g</b></span><span>Glucides <b>{tg.g[0]}–{tg.g[1]} g</b></span>{tg.l && <span>Lipides <b>{tg.l[0]}–{tg.l[1]} g</b></span>}</div>}
        <Src ids={['thomas2016', 'morton2018', 'frankenfield2005', 'herrmann2024']} />
      </div>}
      <div class="meals">{MEALS.map(([id, l]) => {
        const items = m[id] || [], mt = totals(items);
        return <div class="meal">
          <div class="meal-h"><b>{l}</b>{items.length > 0 && nb && <span class="mono">{R(mt.kcal)} kcal</span>}
            {self && <button class="btn ghost" onClick={() => setSheet(id)}><Icon name="plus" size={16} />Ajouter</button>}</div>
          {items.length > 0 ? <ul class="meal-l">{items.map((it, i) => { const f = foodByCode(it.c); return <li><span>{it.n}</span><span class="mono">{R(it.g)} g{nb && f && f.v.kcal != null ? ' · ' + R(f.v.kcal * it.g / 100) + ' kcal' : ''}</span>{self && <button aria-label={'Retirer ' + it.n} onClick={() => setMeal(k, id, items.filter((_, j) => j !== i))}>×</button>}</li>; })}</ul>
            : self && (ym[id] || []).length > 0 && <button class="btn ghost meal-copy" onClick={() => { setMeal(k, id, ym[id]); toast('Repris d’hier'); }}>Comme hier ({(ym[id] || []).map(x => x.n.split(',')[0]).slice(0, 3).join(', ')})</button>}
        </div>;
      })}</div>
      {any && ready && tg && <div class="n-bars">
        {tg.kcal && <Bar label="Énergie" v={t.kcal} lo={tg.kcal[0]} hi={tg.kcal[1]} unit="kcal" nb={nb} />}
        <Bar label="Protéines" v={t.p} lo={tg.p[0]} hi={tg.p[1]} unit="g" nb={nb} />
        <Bar label="Glucides" v={t.g} lo={tg.g[0]} hi={tg.g[1]} unit="g" nb={nb} />
        {tg.l && <Bar label="Lipides" v={t.l} lo={tg.l[0]} hi={tg.l[1]} unit="g" nb={nb} />}
        <Bar label="Fibres" v={t.fib} lo={tg.fib} unit="g" nb={nb} />
        <details class="fold" style="margin-top:6px"><summary><span class="small" style="margin:0;font-weight:600;color:var(--accent)">Vitamines et minéraux du jour</span></summary>
          <MicroBars avg={Object.assign({}, t, { epadha: t.epa + t.dha })} unk={t.unk} grams={t.grams} />
          <p class="small">Sur une seule journée, c’est normal d’être loin de certaines références : le bilan de la semaine (Suivi → Alimentation) est plus parlant.</p>
        </details>
      </div>}
      {adv.length > 0 && <div class="ins n-adv">{adv.map(x => <div class="in-it" style="--c:var(--accent)"><b>{x.t}</b><span>{x.d}</span><Src ids={x.src} /></div>)}</div>}
      <p class="small" style="margin-bottom:0">Estimations à ±10 % environ, pas un avis médical ni diététique.</p>
      {sheet && <FoodSheet k={k} meal={sheet} onClose={() => setSheet(null)} />}
    </Fold>
  );
}

function MicroBars({ avg, unk, grams }) {
  const Rf = refs(), nb = nutriPrefs().numbers;
  return <div class="micro">{MICROS.map(([key, l, u]) => {
    const ref = Rf[key], v = avg[key] || 0, pct = ref ? v / ref : 0, uk = grams ? (unk[key] || 0) / grams : 0;
    const val = u === 'g' && key === 'epadha' ? R(v * 1000) + ' mg' : (v < 10 ? f1(v) : R(v)) + ' ' + u;
    return <div class={'mi' + (pct < 0.7 && !NO_ALERT[key] ? ' low' : '')}>
      <span class="mi-l">{l}{uk > 0.3 && <small> · estimation incomplète</small>}</span>
      <span class="mi-t"><i style={'width:' + Math.min(100, pct * 100) + '%'} /></span>
      <span class="mi-v mono">{Math.round(pct * 100)} %{nb ? <small>{val}</small> : null}</span>
    </div>;
  })}</div>;
}

/* ---------- Bilan de la semaine (Suivi) ---------- */
export function NutriWeek() {
  const ready = useFoods(), [supp, setSupp] = useState(false);
  if (!nutriVisible()) return <div class="empty">{nameOf(getSubject())} n’a pas partagé son alimentation.</div>;
  if (!ready) return <p class="small">Chargement de la base d’aliments…</p>;
  const ws = weekSummary(), adv = weekAdvice(ws), nb = nutriPrefs().numbers;
  const LVC = { warn: 'var(--warn)', info: 'var(--accent)', good: 'var(--good)' };
  return (
    <div class="stack">
      <div class="tiles">
        <div class="tile"><span class="k">Jours saisis</span><b class="num">{ws.n}<small>/7</small></b><span class="s">{ws.n < 3 ? 'au moins 3 pour un bilan' : 'sur les 7 derniers jours'}</span></div>
        <div class="tile"><span class="k">Énergie moyenne</span><b class="num">{ws.n && nb ? R(ws.avg.kcal) : '—'}{ws.n && nb ? <small> kcal</small> : null}</b><span class="s">{ws.exp && nb ? 'dépense ≈ ' + R(ws.exp) + ' kcal' : nb ? 'jours saisis seulement' : 'chiffres masqués'}</span></div>
        <div class="tile"><span class="k">Protéines</span><b class="num">{ws.protKg != null ? f1(ws.protKg) : '—'}<small> g/kg</small></b><span class="s">repère ≈ 1,6 g/kg</span></div>
        <div class="tile"><span class="k">Glucides</span><b class="num">{ws.choKg != null ? f1(ws.choKg) : '—'}<small> g/kg</small></b><span class="s">3 à 10 g/kg selon la charge</span></div>
      </div>
      {ws.n === 0 ? <div class="empty">Note tes repas dans Aujourd’hui → Alimentation : le bilan de la semaine apparaîtra ici.</div> : <>
        <Fold id="nutri-micro" title="Vitamines et minéraux" open summary={'Moyenne de ' + ws.n + ' jour' + (ws.n > 1 ? 's' : '') + ' · références ANSES'}>
          <MicroBars avg={ws.avg} unk={Object.fromEntries(ws.cov.map(c => [c.key, c.unk * 1]))} grams={1} />
          <p class="small">Pourcentage de la référence de l’ANSES (apport qui couvre les besoins de presque tout le monde) : en dessous de 70 % en moyenne, ça vaut le coup d’y regarder ; ce n’est pas un diagnostic. {NO_ALERT.vd} <Src ids={['anses2021', 'ciqual2025']} /></p>
        </Fold>
        <Fold id="nutri-adv" title="Conseils" open summary={adv.length ? adv.length + ' point' + (adv.length > 1 ? 's' : '') : ws.n < 3 ? 'Pas encore assez de jours' : 'Rien à signaler'}>
          {adv.length ? <div class="ins">{adv.map(x => <div class="in-it" style={'--c:' + LVC[x.lvl]}><b>{x.t}</b><span>{x.d}</span><Src ids={x.src} /></div>)}</div>
            : <p class="small" style="margin:0">{ws.n < 3 ? 'Saisis au moins 3 jours dans la semaine pour un bilan fiable.' : 'Pas de manque répété sur la semaine. Continue de varier : légumes, fruits, légumineuses, céréales complètes, protéines à chaque repas.'}</p>}
        </Fold>
      </>}
      <button class="card li-card" onClick={() => setSupp(true)}><Icon name="flask" /><span><b>Compléments alimentaires</b><small>Ce qui a des preuves, ce qui est médical, et les précautions anti-dopage</small></span><span class="chev r" aria-hidden="true" /></button>
      {supp && <SuppSheet onClose={() => setSupp(false)} />}
    </div>
  );
}

export function SuppSheet({ onClose }) {
  const u18 = profileOf(getSubject()).under18;
  const list = SUPPS.filter(s => !(u18 && s.perf));
  return <Sheet title="Compléments" onClose={onClose}>
    <div class="stack">
      <p class="lead" style="margin:0">D’abord l’assiette : un complément ne rattrape pas une alimentation insuffisante.</p>
      <div class="guard">{SUPP_WARN}</div>
      {u18 && <p class="small" style="margin:0">Avant 18 ans, les compléments de performance ne sont pas recommandés : on mise sur l’alimentation, le sommeil et l’entraînement.</p>}
      {list.map(s => <section class="card"><h3 class="h3">{s.l}<em>{s.lvl}</em></h3><p class="small" style="margin:0;color:var(--ink)">{s.d}</p></section>)}
      <p class="small">Source : <Src ids={['maughan2018']} /></p>
    </div>
  </Sheet>;
}

/* ---------- Réglages (Paramètres) ---------- */
export function NutriSettings() {
  const p = myProfile(), n = p.nutri || {}, pr = nutriPrefs(SELF_ID);
  const set = patch => saveProfileDoc({ nutri: Object.assign({}, n, patch) });
  return <section class="card flat">
    <div style="padding:14px 14px 0"><h3 class="h3" style="margin:0 0 4px">Alimentation</h3></div>
    <Switch label="Afficher les calories et les grammes" sub={p.under18 ? 'Masqués par défaut avant 18 ans : les repères restent visibles en mots' : 'Sinon, seulement des repères en mots et des barres'} on={pr.numbers} onChange={v => set({ numbers: v })} />
    {links.coaches.length > 0 && <Switch label="Partager avec mon coach" sub="Repas et bilan de la semaine visibles par ton coach" on={pr.share} onChange={v => { set({ share: v }); if (v) setTimeout(resendNutrition, 2500); }} />}
    <div style="padding:10px 14px 14px" class="stack">
      <div><p class="sub-lbl" style="margin-top:0">En dehors du sport, tu es…</p><TextSeg value={pr.life} onChange={v => v && set({ life: v })} options={LIFE.map(x => [x[0], x[1]])} label="Activité quotidienne" /></div>
      {!p.under18 && <div><p class="sub-lbl" style="margin-top:0">Objectif de poids</p><TextSeg value={pr.goal} onChange={v => v && set({ goal: v })} options={GOALS_W} label="Objectif de poids" />
        <p class="small">Perte : déficit modéré (300 à 500 kcal) et jamais sous le métabolisme de base ; prise : léger surplus. Le régime alimentaire se règle dans Profil.</p></div>}
    </div>
  </section>;
}
const SELF_ID = 'self';
