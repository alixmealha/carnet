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
C.callAsync('a1', 'nutrition.loadFoods', '[]');
await new Promise(r => setTimeout(r, 300));
ok('nutrition : base d’aliments', ctx.__done && ctx.__done.id === 'a1' && !ctx.__done.err, ctx.__done && ctx.__done.err);
ok('nutrition : recherche', call('nutrition.searchFoods', 'riz', [], 5).length > 0, call('nutrition.searchFoods', 'pomme', [], 3).map(f => f.n).join(' / '));
console.log(fails ? fails + ' échec(s)' : 'Tout est bon');
process.exit(fails ? 1 : 0);
