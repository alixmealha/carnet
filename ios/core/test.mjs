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

// Exercice fait à la place (finger lift → suspensions 20 mm) et ordre réel des blocs
{
  const sd = '2031-03-03';
  docs['self|p:' + sd] = { blocks: [
    { id: 'g1', kind: 'grimpe', title: 'Grimpe', items: [{ id: 'a', label: '10 blocs', n: 10, unit: 'Bloc', rest: 90 }] },
    { id: 'd1', kind: 'doigts', title: 'Doigts', finger: { load: 9, unit: 'kg' }, items: [
      { id: 'ech', label: 'Échauffement', n: 1 },
      { id: 'f', label: 'Finger lift · semi-arqué', det: '9 kg', n: 6, unit: 'Série', lib: 'finger-lift', load: 9, timer: { kind: 'interval', name: 'Finger lift', work: 10, rest: 6, reps: 6, sets: 1, markEach: 'rep', workLabel: 'Lève' } }] }] };
  C.loadJSON(JSON.stringify(Object.fromEntries(Object.entries(docs))));
  const d1 = call('plan.blocks', sd).find(b => b.id === 'd1');
  ok('swap : plan inchangé au départ', d1.items[1].label.startsWith('Finger lift'));
  const pi = call('plan.plannedIntensity', sd, d1, d1.items[1]);
  ok('swap : charge prévue lue (9 kg)', pi && pi.v === 9 && pi.u === 'kg', JSON.stringify(pi));
  const ch = call('plan.swapChoices', sd, d1, d1.items[1]);
  ok('swap : propositions = exercices de doigts, sans celui du plan', ch.some(x => x.id === 'max-hangs' && x.name === 'Suspensions 20 mm') && !ch.some(x => x.id === 'finger-lift'), ch.map(x => x.name).join(', '));
  call('plan.setSwap', sd, d1, d1.items[1], { lib: 'max-hangs', label: 'Suspensions 20 mm', v: 9, u: 'kg', how: ['pieds'] });
  const it = call('plan.blocks', sd).find(b => b.id === 'd1').items[1];
  ok('swap : libellé et détail', it.label === 'Suspensions 20 mm' && it.det.includes('pieds en appui') && it.det.includes('9 kg'), it.det);
  ok('swap : minuteur du plan gardé (10/6)', it.timer && it.timer.work === 10 && it.timer.rest === 6 && it.timer.workLabel === 'Suspends');
  ok('swap : charge en kilos du plan retirée, origine gardée', it.load === undefined && it.swap && it.swap.from.startsWith('Finger lift'));
  call('plan.placeBlock', sd, d1, 'g1');
  ok('ordre : doigts après grimpe', call('plan.blocks', sd).map(b => b.id).join() === 'g1,d1');
  call('plan.placeBlock', sd, d1, null);
  ok('ordre : doigts en premier', call('plan.blocks', sd).map(b => b.id).join() === 'd1,g1');
  call('plan.resetOrder', sd);
  ok('ordre : retour au plan', call('plan.blocks', sd).map(b => b.id).join() === 'g1,d1');
}

// ---- Catalogue de modalités : tests de référence, protocoles doigts, intervalles, natation, Hyrox
{
  const td = call('dates.addDays', t, -3);
  const base = { goal: 'doigts', goal2: null, days: [0, 2, 4], fixed: [], fixedLbl: '', dur: 75, lvl: 2, equip: ['salle-esc', 'bfr'], weeks: 4, start: call('dates.mondayOf', t), sports: ['escalade'], sex: 'M', u18: false, swap: {}, fmt: {} };
  const sess = (type, over, wk) => call('builder.buildSession', type, Object.assign({}, base, over), Object.assign({ step: 1, meso: 0, phase: 'volume' }, wk || {}), null, {});
  const items = x => x.blocks.flatMap(b => b.items).filter(i => i.id !== 'ech' && i.id !== 'rac');
  // doigts
  C.loadJSON(JSON.stringify(Object.assign({}, docs, { ['self|t:' + td]: { res: { 'fmax-semi': { 'v.D': 40, 'v.G': 36 } } } })));
  const f80 = items(sess('doigts', { fmt: { doigts: 'f80' } }))[0];
  ok('doigts 10/6 à 80 % : minuteur et charge par main', f80.timer.work === 10 && f80.timer.rest === 6 && f80.timer.reps === 12 && f80.timer.sets === 3 && f80.det.includes('droite 32 kg, gauche 29 kg'), f80.det);
  const f100 = items(sess('doigts', { fmt: { doigts: 'f100' } }))[0];
  ok('doigts une main à 100 %', f100.timer.work === 6 && f100.timer.reps === 12 && f100.timer.sets === 2 && f100.det.includes('droite 40 kg'), f100.det);
  ok('doigts 10/6 à 60 %', items(sess('doigts', { fmt: { doigts: 'f60' } }))[0].timer.reps === 24);
  const e73 = items(sess('doigts', { fmt: { doigts: 'endu73' } }));
  ok('doigts 7/3 en deux blocs', e73.length === 2 && e73[0].timer.work === 7 && e73[0].timer.rest === 3 && e73[0].timer.sets === 6, e73.length + ' blocs');
  const bfr = items(sess('doigts', { fmt: { doigts: 'bfr' } }));
  ok('doigts avec brassards : une série par main, 30 %', bfr.length === 2 && bfr[0].det.includes('droite 12 kg'), bfr[0].det);
  ok('doigts avec brassards : sans brassards, repli sur la grimpe', items(sess('doigts', { fmt: { doigts: 'bfr' }, equip: ['salle-esc'] }))[0].label.startsWith('Blocs'));
  ok('doigts : 10/6 à 80 % conseillé avec un test de force', call('builder.fmtReco', 'doigts', Object.assign({}, base)) === 'f80');
  // tests VAMEVAL, CSS
  C.loadJSON(JSON.stringify(Object.assign({}, docs, { ['self|t:' + td]: { res: { vameval: { v: 17.5 }, css: { t400: 390, t200: 180 }, ftp: { p20: 263 } } } })));
  const vm = call('levels.vmaOf', null, null);
  ok('VAMEVAL lu comme VMA', vm && vm.v === 17.5, JSON.stringify(vm));
  const cs = call('levels.cssOf');
  ok('CSS 400/200 : allure au 100 m', cs && Math.round(cs.p100) === 105 && call('levels.swimPace', cs, 100) === '1:45', JSON.stringify(cs));
  // course
  const run = { goal: 'aero', sports: ['course'], equip: ['exterieur'] };
  const r1515 = items(sess('int', Object.assign({ fmt: { int: '1515' } }, run)))[0], r44 = items(sess('int', Object.assign({ fmt: { int: '4x4' } }, run)))[0];
  ok('course 15/15', r1515.timer.work === 15 && r1515.timer.rest === 15 && r1515.det.includes('m en 15 s'), r1515.det);
  ok('course 4 × 4 min', r44.timer.work === 240 && r44.timer.rest === 180, r44.det);
  ok('course : sprints de 30 s', items(sess('int', Object.assign({ fmt: { int: 'sp30' } }, run)))[0].timer.work === 30);
  // vélo
  const bike = { goal: 'aero', sports: ['velo'], equip: ['velo'] };
  const b3015 = items(sess('int', Object.assign({ fmt: { intV: '3015' } }, bike)))[0], bz4 = items(sess('int', Object.assign({ fmt: { intV: 'z4' } }, bike)))[0];
  ok('vélo 30/15', b3015.timer.work === 30 && b3015.timer.rest === 15 && b3015.timer.reps === 13 && b3015.timer.sets === 3, b3015.det);
  ok('vélo seuil : watts d’après la FTP', bz4.det.includes('W') && bz4.timer.work === 900, bz4.det);
  // natation
  const swim = { goal: 'aero', sports: ['natation'], equip: ['piscine'] };
  ok('natation : famille d’intervalles et format conseillé', call('builder.fmtFamily', 'int', Object.assign({}, base, swim)) === 'intN' && call('builder.fmtReco', 'intN', Object.assign({}, base, swim)) === 'css');
  const sc = items(sess('int', swim))[0];
  ok('natation CSS : départ toutes les 2:00 (1:45 + 15 s)', sc.timer && sc.timer.work === 105 && sc.det.includes('1:45') && sc.det.includes('2:00'), sc.det);
  ok('natation : ultra-court et volume réduit', items(sess('int', Object.assign({ fmt: { intN: 'usrpt' } }, swim)))[0].rest === 35 && items(sess('int', Object.assign({ fmt: { intN: 'sup' } }, swim)))[0].rest === 90);
  // Hyrox
  const hx = { goal: 'hyrox', sports: ['hyrox'], equip: ['exterieur', 'salle'] };
  const hs = items(sess('hxs', hx)), hsF = items(sess('hxs', Object.assign({ sex: 'F' }, hx)));
  ok('Hyrox stations : charges Open hommes', hs.find(i => i.lib === 'hx-push').load === 152 && hs.find(i => i.lib === 'hx-wall').load === 6);
  ok('Hyrox stations : charges Open femmes', hsF.find(i => i.lib === 'hx-push').load === 102 && hsF.find(i => i.lib === 'hx-wall').load === 4 && hsF.find(i => i.lib === 'hx-wall').det.includes('4 kg'));
  ok('Hyrox course compromise', items(sess('hxc', hx)).every(i => i.label.startsWith('1 km + ')) && items(sess('hxc', hx)).length >= 3);
  ok('Hyrox simulation : demi-course par défaut', items(sess('hxsim', hx)).length === 4 && items(sess('hxsim', Object.assign({ lvl: 3, dur: 90 }, hx))).length === 8);
  ok('objectif Hyrox dans la liste, continuité masquée', call('library.goalsFor', false, true).some(g => g.id === 'hyrox') && !call('library.goalsFor', true, true).some(g => g.id === 'conti') && !call('library.goalsFor', true, false).some(g => g.id === 'hyrox'));
  const hp = call('builder.generate', Object.assign({}, base, hx, { goal: 'hyrox', days: [0, 1, 3, 4, 5], dur: 60 }));
  ok('programme Hyrox généré', hp.weeks.length === 4 && hp.types.includes('hxs') && hp.types.includes('hxc'), hp.types.join(','));
  // musculation : séries dégressives, ondulation
  const dg = call('builder.generate', Object.assign({}, base, { goal: 'hyper', sports: ['muscu'], equip: ['salle'], fmt: { hyper: 'degressif' }, days: [0, 2, 4] }));
  ok('séries dégressives sur les exercices d’appoint', JSON.stringify(dg.weeks[0]).includes('dégressif'));
  const fu = call('builder.generate', Object.assign({}, base, { goal: 'force', sports: ['muscu'], equip: ['salle'], days: [0, 2, 4] }));
  const d0 = fu.weeks[0].days, ks = Object.keys(d0).map(Number).sort((a, b) => a - b).map(k => d0[k]);
  const reps = ks.map(sx => sx.blocks[0].items.find(i => i.rx && i.rx.role === 'main').rx.r[0]);
  ok('charges ondulantes : lourd, moyen, léger', reps[0] < reps[1] && reps[1] < reps[2], reps.join(','));
  const notes = call('builder.programNotes', fu);
  ok('notes : charges ondulantes expliquées', notes.includes('Charges ondulantes'));
  const hn = call('builder.programNotes', call('builder.generate', Object.assign({}, base, swim, { goal: 'aero', days: [0, 2, 4] })));
  ok('notes : formats et source natation', hn.includes('Wakayoshi'), hn.slice(-160));
}
console.log(fails ? fails + ' échec(s)' : 'Tout est bon');
process.exit(fails ? 1 : 0);
