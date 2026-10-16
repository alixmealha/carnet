// Logique partagée avec la version web, exécutée dans l'appli iPhone (JavaScriptCore).
// L'appli appelle __core.call('module.fonction', '[arguments en JSON]') et reçoit le résultat en JSON.
import { core } from './store-shim.js';
import * as store from './store-shim.js';
import * as dates from '../../src/lib/dates.js';
import * as plan from '../../src/lib/plan.js';
import * as rules from '../../src/lib/rules.js';
import * as insights from '../../src/lib/insights.js';
import * as adapt from '../../src/lib/adapt.js';
import * as stats from '../../src/lib/stats.js';
import * as tests from '../../src/lib/tests.js';
import * as levels from '../../src/lib/levels.js';
import * as force from '../../src/lib/force.js';
import * as history from '../../src/lib/history.js';
import * as quantify from '../../src/lib/quantify.js';
import * as records from '../../src/lib/records.js';
import * as week from '../../src/lib/week.js';
import * as warmup from '../../src/lib/warmup.js';
import * as activity from '../../src/lib/activity.js';
import * as grades from '../../src/lib/grades.js';
import * as library from '../../src/lib/library.js';
import * as sports from '../../src/lib/sports.js';
import * as needs from '../../src/lib/needs.js';
import * as builder from '../../src/lib/builder.js';
import * as nutrition from '../../src/lib/nutrition.js';
import * as glossary from '../../src/lib/glossary.js';
import * as sources from '../../src/lib/sources.js';
import * as io from '../../src/lib/io.js';
import * as md from '../../src/lib/md.js';
import * as whoop from '../../src/lib/whoop.js';
import * as extra from './extra.js';

// La base d'aliments (et tout fichier demandé par fetch) est lue dans les ressources de l'appli
if (typeof globalThis.fetch !== 'function') {
  globalThis.fetch = url => new Promise((res, rej) => {
    try {
      const txt = globalThis.__native.readResource(String(url).split('/').pop());
      if (txt == null) return res({ ok: false, status: 404 });
      res({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(txt)), text: () => Promise.resolve(txt) });
    } catch (e) { rej(e); }
  });
}

const mods = { store, dates, plan, rules, insights, adapt, stats, tests, levels, force, history, quantify, records, week, warmup, activity, grades, library, sports, needs, builder, nutrition, glossary, sources, io, md, whoop, extra };

// Sets et Maps deviennent des listes / objets ; les fonctions disparaissent (comme dans un export JSON)
function replacer(_k, v) {
  if (v instanceof Set) return [...v];
  if (v instanceof Map) return Object.fromEntries(v);
  if (typeof v === 'function') return undefined;
  if (typeof v === 'number' && !isFinite(v)) return null;
  return v;
}
function resolve(path) {
  const [m, ...rest] = path.split('.');
  let o = mods[m], parent = null;
  for (const p of rest) { parent = o; o = o == null ? undefined : o[p]; }
  return { o, parent };
}
globalThis.__core = Object.assign({}, core, {
  call(path, argsJson) {
    const { o, parent } = resolve(path);
    const args = argsJson ? JSON.parse(argsJson) : [];
    const r = typeof o === 'function' ? o.apply(parent, args) : o;
    return JSON.stringify(r === undefined ? null : r, replacer);
  },
  // promesse (chargement de la base d'aliments…) : résultat déposé dans __core.done[id]
  callAsync(id, path, argsJson) {
    const { o, parent } = resolve(path);
    const args = argsJson ? JSON.parse(argsJson) : [];
    // le pont ne reçoit que des textes : '' = pas d'erreur (un null deviendrait « null »)
    let p;
    try { p = Promise.resolve(typeof o === 'function' ? o.apply(parent, args) : o); } catch (e) { p = Promise.reject(e); }
    p.then(r => globalThis.__native.done(id, JSON.stringify(r === undefined ? null : r, replacer), ''))
      .catch(e => globalThis.__native.done(id, '', String((e && e.message) || e || 'Erreur')));
  },
  loadJSON(json) { core.load(JSON.parse(json)); },
  setJSON(key, json) { core.set(key, json == null ? null : JSON.parse(json)); },
  setLinksJSON(json) { core.setLinks(JSON.parse(json)); },
  version: '1'
});
