// Vérifie la logique partagée hors de l'iPhone : node ios/core/test.mjs
// Charge le paquet comme le fera l'appli (même pont __native), crée un programme avec l'assistant,
// remplit quelques jours de journal, puis appelle les fonctions utilisées par les écrans.
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const res = path.resolve(here, '../Alipto/Resources/Core');
const docs = {}, writes = [];
const ctx = { console, Date, Math, JSON, Promise, Intl, setTimeout };
ctx.globalThis = ctx;
ctx.__native = {
  put(o, id, json) { docs[o + '|' + id] = JSON.parse(json); writes.push(o + '|' + id); },
  remove(o, id) { delete docs[o + '|' + id]; writes.push('-' + o + '|' + id); },
  readResource(name) { const p = path.join(res, name); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; },
  done(id, json, err) { ctx.__done = { id, json, err }; }
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(res, 'alipto-core.js'), 'utf8'), ctx);
const C = ctx.__core;
const call = (p, ...a) => { const r = C.call(p, JSON.stringify(a)); return JSON.parse(r); };
let fails = 0;
const ok = (name, cond, extra) => { if (!cond) fails++; console.log((cond ? 'ok   ' : 'ÉCHEC ') + name + (extra ? ' · ' + extra : '')); };

C.setLinksJSON(JSON.stringify({ me: 'u1', athletes: [], coaches: [], profiles: { u1: { id: 'u1', name: 'Test', role: 'admin', onboarded: true, birth_year: 1999, sex: 'M' } }, myLock: false }));
C.loadJSON(JSON.stringify({ 'self|profile': { sports: ['escalade'], levels: { bf: '6C', bm: '7A' } } }));
const t = call('dates.todayKey');
const cfg = { goal: 'force', goal2: null, days: [0, 2, 4], fixed: [], fixedLbl: '', dur: 75, lvl: 2, equip: ['salle', 'salle-esc'], weeks: 8, start: call('dates.mondayOf', t), event: null, eventLbl: '', sports: ['escalade'], u18: false, swap: {}, fmt: {} };
const goals = call('library.GOALS');
ok('objectifs de l’assistant', Array.isArray(goals) && goals.length > 3, goals.map(g => g.id).join(','));
const prog = call('builder.generate', cfg);
ok('programme généré', prog && prog.weeks && prog.weeks.length === 8, prog.weeks.length + ' semaines');
const n = call('builder.writeProgram', prog, 'replace');
ok('programme écrit dans le plan', n > 10 && docs['self|plan'], n + ' séances, ' + writes.length + ' écritures');
// le pont renvoie les écritures dans le miroir (comme le fera l'appli) : rien à faire, le shim les garde déjà
const days = Object.keys(docs).filter(k => k.startsWith('self|p:')).map(k => k.slice(7)).sort();
const k0 = days.find(k => k >= t) || days[0];
ok('séance du jour lue', call('plan.blocks', k0).length > 0, call('plan.sessionName', k0));
// journal de 10 jours
for (let i = 1; i <= 10; i++) {
  const k = call('dates.addDays', t, -i);
  C.setJSON('self|j:' + k, JSON.stringify({ well: { sommeil: 3 + i % 2, fatigue: 3, courbatures: 4, stress: 4, humeur: 4 }, rpe: 6, duree: 60, status: 'faite', nuit: { total: 420 + i * 5, vfc: 60 + i } }));
}
C.setJSON('self|j:' + t, JSON.stringify({ well: { sommeil: 2, fatigue: 2, courbatures: 3, stress: 3, humeur: 3 }, flags: { doigts: true }, gene: { doigts: 4 } }));
const ins = call('insights.dayInsights', t);
ok('lecture du jour', ins && ins.items && ins.items.length > 0, ins && ins.head);
const ws = call('stats.weeksStats');
ok('suivi : semaines', Array.isArray(ws) && ws.length > 0, ws.length + ' semaines');
ok('suivi : tuiles', call('stats.tiles', ws) != null);
ok('suivi : alertes', Array.isArray(call('stats.alerts', ws)));
ok('suivi : charge', call('stats.loadSeries') != null);
ok('records', call('records.allRecords') != null);
ok('bilan de semaine', call('week.weekReview', call('dates.mondayOf', call('dates.addDays', t, -7))) !== undefined);
const bl = call('plan.blocks', k0), b = bl.find(x => x.kind !== 'rest');
ok('échauffement', call('warmup.warmupFor', k0, b) !== undefined, (call('warmup.warmupFor', k0, b) || {}).min + ' min');
ok('adapter à 30 min', call('adapt.fitToTime', k0, 30).total > 0);
ok('tests : catalogue', call('tests.CATALOG').length > 10);
ok('niveaux : grimpe', call('levels.climbLevel') != null, JSON.stringify(call('levels.climbLevel')));
ok('lexique', call('extra.glossSplit', 'Travail en RIR 2 et charge en 1RM').length >= 1, JSON.stringify(call('extra.glossSplit', 'La réserve et le 1RM')));
ok('sources', Object.keys(call('sources.SOURCES')).length > 10);
ok('besoins', call('needs.missingFor', prog) != null);
ok('nutrition : repères', call('nutrition.NUT').length > 5);
// base d'aliments (promesse)
C.callAsync('a1', 'extra.loadFoods', '[]');
await new Promise(r => setTimeout(r, 300));
ok('nutrition : base d’aliments', ctx.__done && ctx.__done.id === 'a1' && ctx.__done.err === '' && +ctx.__done.json > 1000, ctx.__done && (ctx.__done.err || ctx.__done.json + ' aliments'));
ok('nutrition : recherche', call('nutrition.searchFoods', 'riz', [], 5).length > 0, call('nutrition.searchFoods', 'pomme', [], 3).map(f => f.n).join(' / '));

// assistant (étapes de l'appli iPhone)
const ini = call('extra.builderInitial', null);
ok('assistant : réglages de départ', ini && ini.days && ini.start, JSON.stringify(ini.equip));
const cfg2 = Object.assign({}, ini, { goal: 'doigts', goal2: 'force' });
const fm = call('extra.builderFormats', cfg2);
ok('assistant : formats', fm && fm.fams.length > 0 && fm.fams[0].opts.length > 0, fm.fams.map(f => f.f + ':' + f.cur).join(' '));
const pv = call('extra.builderGenerate', cfg2);
ok('assistant : aperçu', pv && pv.weeks.length === 8 && pv.nSes > 0, pv.nSes + ' séances · ' + pv.fmts);
const lib = pv.weeks[0].days.flatMap(d => d.blocks.flatMap(b => b.items)).find(it => it.alt > 0);
ok('assistant : remplacements', !lib || call('extra.builderAlternatives', lib.lib, cfg2).length > 0, lib && lib.label);
ok('assistant : conflits', call('extra.builderConflicts').length > 0, call('extra.builderConflicts').length + ' jours déjà prévus');
const nw = call('extra.builderWrite', 'merge');
ok('assistant : écriture', nw > 10, nw + ' séances');
call('extra.builderSaveModel', 'Doigts 3 j', cfg2);
ok('assistant : modèles', call('extra.builderModels').length === 1);
const lf = call('extra.levelsForm', null, null);
ok('repères : formulaire', lf && lf.climb.length === 4, lf.climb.map(x => x.k + '=' + (x.v || x.hint)).join(' '));
// éditeurs du plan
const pl = call('plan.meta');
call('plan.addWeeks', 2, 'deload', 'Récup');
ok('plan : semaines ajoutées', call('plan.meta').weeks.length === pl.weeks.length + 2);
call('plan.removeLastWeek');
ok('plan : dernière semaine retirée', call('plan.meta').weeks.length === pl.weeks.length + 1);
const kx = call('dates.addDays', t, 3);
call('plan.saveDay', kx, { blocks: [{ id: 'bx', kind: 'muscu', title: 'Muscu', items: [{ id: 'i1', label: 'Tractions lestées', n: 4, unit: 'Série' }] }] });
ok('plan : jour enregistré', call('plan.sessionName', kx) === 'Muscu', call('plan.sessionName', kx));
ok('plan : exercices', call('plan.exerciseNames').some(x => x.label === 'Tractions lestées'));
ok('plan : renommer', call('plan.renameExercise', 'Tractions lestées', 'Tractions', true) >= 1);
ok('règle des 48 h', Array.isArray(call('builder.check48', kx, call('plan.day', kx))));

// déplacer une séance vers un jour plus tôt, échanger deux séances
const ka = call('dates.addDays', t, 1), kb = call('dates.addDays', t, 2);
call('plan.saveDay', ka, { blocks: [{ id: 'ba', kind: 'grimpe', title: 'Bloc A', items: [{ id: 'i1', label: 'A', n: 1 }] }] });
call('plan.saveDay', kb, { blocks: [{ id: 'bb', kind: 'muscu', title: 'Muscu B', items: [{ id: 'i1', label: 'B', n: 1 }] }] });
const tg = call('plan.moveTargets', kb);
ok('déplacer : jours plus tôt proposés', tg.includes(t) && tg.includes(ka) && !tg.includes(kb), tg.slice(0, 4).join(' '));
call('plan.swapSessions', ka, kb);
const na = call('plan.blocks', ka).filter(b => !call('plan.blockState', call('store.jget', ka), b)).map(b => b.title);
const nb = call('plan.blocks', kb).filter(b => !call('plan.blockState', call('store.jget', kb), b)).map(b => b.title);
ok('échanger deux séances', na.join() === 'Muscu B' && nb.join() === 'Bloc A', na + ' / ' + nb);
// le cas d'Alix : séance du jour 1 décalée au jour 2, puis celle du jour 2 ramenée au jour 1
const kc = call('dates.addDays', t, 3), kd = call('dates.addDays', t, 4);
call('plan.saveDay', kc, { blocks: [{ id: 'bc', kind: 'grimpe', title: 'C', items: [{ id: 'i1', label: 'C', n: 1 }] }] });
call('plan.saveDay', kd, { blocks: [{ id: 'bd', kind: 'muscu', title: 'D', items: [{ id: 'i1', label: 'D', n: 1 }] }] });
call('plan.moveSession', kc, kd);
call('plan.moveSession', kd, kc);
const vc = call('plan.blocks', kc).filter(b => !call('plan.blockState', call('store.jget', kc), b)).map(b => b.title);
const vd = call('plan.blocks', kd).filter(b => !call('plan.blockState', call('store.jget', kd), b)).map(b => b.title);
ok('décaler puis ramener l’autre séance = échange', vc.join() === 'D' && vd.join() === 'C', vc + ' / ' + vd);
// Whoop : fusion dans le journal (cases vides seulement pour une saisie manuelle, Whoop avant Apple Santé)
const wd = call('dates.addDays', t, -20), we = call('dates.addDays', t, -21), wf = call('dates.addDays', t, -22);
call('store.jset', wd, { nuit: { total: 400, src: 'sante', vfc: 55, fcr: 50 } });
call('store.jset', we, { nuit: { total: 300, fcr: 60 } });
const wn = call('whoop.mergeDays', {
  [wd]: { nuit: { total: 450, profond: 80, leger: 250, rem: 100, eveil: 30, vfc: 70, fcr: 48, rec: 72 }, workouts: [{ min: 62, km: 8.4, hr: 150 }, { min: 30, km: 0, hr: 120 }] },
  [we]: { nuit: { total: 480, profond: 90, leger: 270, rem: 100, eveil: 20, vfc: 65, fcr: 52, rec: 80 } },
  [wf]: { nuit: { total: 420, profond: 70, leger: 250, rem: 100, eveil: 25, vfc: 60, fcr: 49, rec: 66 } }
});
const jd = call('store.jget', wd), je = call('store.jget', we), jf = call('store.jget', wf);
ok('Whoop remplace Apple Santé', jd.nuit.src === 'whoop' && jd.nuit.vfc === 70 && jd.nuit.profond === 80 && jd.nuit.total === undefined, JSON.stringify(jd.nuit));
ok('Whoop n’écrase pas la saisie manuelle', je.nuit.total === 300 && je.nuit.fcr === 60 && je.nuit.vfc === 65 && je.nuit.src === undefined && je.nuit.profond === undefined, JSON.stringify(je.nuit));
ok('Whoop : nuit vide remplie', jf.nuit.src === 'whoop' && jf.nuit.rec === 66, JSON.stringify(jf.nuit));
ok('Whoop : séances (durée, km, FC pondérée = 140)', jd.duree === 92 && jd.cardio && jd.cardio.km === 8.4 && jd.cardio.fc === 140, JSON.stringify([jd.duree, jd.cardio]));
ok('Whoop : 3 jours modifiés', wn === 3, String(wn));
call('whoop.mergeDays', { [wd]: { workouts: [{ min: 50, km: 5, hr: 140 }] } });
ok('Whoop : séances déjà remplies non écrasées', call('store.jget', wd).duree === 92);
console.log(fails ? fails + ' échec(s)' : 'Tout est bon');
process.exit(fails ? 1 : 0);
