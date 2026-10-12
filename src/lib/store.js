// Stockage local d'abord (IndexedDB), synchronisé avec Supabase quand il est configuré.
// Chaque donnée est un « doc » rangé par propriétaire : « self » (le compte connecté) ou l'identifiant d'un athlète suivi.
// Docs : plan, p:AAAA-MM-JJ (séance prévue), j:… (journal), c:… (échanges), t:… (résultats de tests),
// tests (tests perso), profile, settings, seen.
import { createStore, get as idbGet, set as idbSet, del as idbDel, entries as idbEntries, clear as idbClear } from 'idb-keyval';
import { useEffect, useState } from 'preact/hooks';
import { sb, cloud } from './supa.js';

export const SELF = 'self';
const DS = createStore('carnet-docs', 'docs');
const MS = createStore('carnet-meta', 'meta');
const docs = new Map();
const subs = new Set();
let ver = 0;
let subject = SELF;

export const syncState = { state: cloud ? 'idle' : 'local', last: null, error: null, pending: 0 };
export const links = { athletes: [], coaches: [], me: null, email: null };

function emit() { ver++; for (const f of subs) { try { f(); } catch (e) { console.error(e); } } }
export function subscribe(f) { subs.add(f); return () => subs.delete(f); }
export function useStore() {
  const [, set] = useState(ver);
  useEffect(() => subscribe(() => set(ver)), []);
  return ver;
}
const K = (o, id) => o + '|' + id;
const split = key => { const i = key.indexOf('|'); return [key.slice(0, i), key.slice(i + 1)]; };

export async function initStore() {
  try {
    for (const [k, v] of await idbEntries(DS)) {
      if (k.indexOf('|') < 0) { // ancien format (un seul carnet) : rangé dans « self »
        docs.set(K(SELF, k), v); idbSet(K(SELF, k), v, DS).catch(() => {}); idbDel(k, DS).catch(() => {});
      } else docs.set(k, v);
    }
    const l = await idbGet('links', MS); if (l) Object.assign(links, l);
  } catch (e) { console.warn('IndexedDB', e); }
  countPending(); emit();
}

/* ---------- Carnet affiché ---------- */
export const getSubject = () => subject;
export const isSelf = () => subject === SELF;
export function setSubject(o) { if (o === links.me) o = SELF; if (o !== subject) { subject = o || SELF; emit(); } }

/* ---------- Lecture / écriture ---------- */
export function getFor(o, id) { const r = docs.get(K(o, id)); return r && !r.deleted ? r.data : undefined; }
export function metaFor(o, id) { const r = docs.get(K(o, id)); return r && !r.deleted ? r : undefined; }
export function idsFor(o, prefix) {
  const out = [], pre = K(o, prefix);
  for (const [k, r] of docs) if (k.startsWith(pre) && !r.deleted) out.push(k.slice(o.length + 1));
  return out.sort();
}
export const get = id => getFor(subject, id);
export const ids = prefix => idsFor(subject, prefix);
function countPending() { let n = 0; for (const r of docs.values()) if (r.dirty) n++; syncState.pending = n; }

export function putFor(o, id, data, opts) {
  const rec = { data, updatedAt: Date.now(), dirty: true };
  docs.set(K(o, id), rec);
  idbSet(K(o, id), rec, DS).catch(e => console.warn(e));
  countPending();
  if (!(opts && opts.silent)) emit();
  schedule();
}
export const put = (id, data, opts) => putFor(subject, id, data, opts);
export function putMany(map, owner) {
  const o = owner || subject, now = Date.now();
  for (const [id, data] of Object.entries(map)) { const rec = { data, updatedAt: now, dirty: true }; docs.set(K(o, id), rec); idbSet(K(o, id), rec, DS).catch(() => {}); }
  countPending(); emit(); schedule(300);
}
export function remove(id, owner) {
  const o = owner || subject, rec = { data: null, updatedAt: Date.now(), dirty: true, deleted: true };
  docs.set(K(o, id), rec); idbSet(K(o, id), rec, DS).catch(() => {}); countPending(); emit(); schedule();
}
export function removeAllMine() {
  const now = Date.now();
  for (const [k, r] of docs) if (k.startsWith(SELF + '|') && !r.deleted) { const rec = { data: null, updatedAt: now, dirty: true, deleted: true }; docs.set(k, rec); idbSet(k, rec, DS).catch(() => {}); }
  countPending(); emit(); schedule(200);
}
export function exportAll(owner) {
  const o = owner || subject, out = {};
  for (const [k, r] of docs) { const [ko, id] = split(k); if (ko === o && !r.deleted && r.data != null) out[id] = r.data; }
  return { app: 'carnet', v: 1, exportedAt: new Date().toISOString(), docs: out };
}
export async function wipeLocal() {
  docs.clear(); subject = SELF;
  Object.assign(links, { athletes: [], coaches: [], me: null, email: null });
  await idbClear(DS).catch(() => {}); await idbClear(MS).catch(() => {}); countPending(); emit();
}

/* ---------- Synchronisation ---------- */
let timer = null, running = false, again = false;
function setState(s, err) { syncState.state = s; syncState.error = err || null; emit(); }
export function schedule(ms) { if (!cloud) return; clearTimeout(timer); timer = setTimeout(syncNow, ms == null ? 1500 : ms); }

export async function syncNow() {
  if (!cloud) return;
  if (running) { again = true; return; }
  running = true;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { setState('signedout'); return; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setState('offline'); return; }
    const me = session.user.id;
    if (links.me !== me) { links.me = me; links.email = session.user.email; }
    setState('syncing');
    // 1. Envoyer ce qui a changé ici
    const dirty = [...docs.entries()].filter(([, r]) => r.dirty);
    for (let i = 0; i < dirty.length; i += 100) {
      const chunk = dirty.slice(i, i + 100);
      const rows = chunk.map(([k, r]) => { const [o, id] = split(k); return { user_id: o === SELF ? me : o, id, data: r.data == null ? {} : r.data, updated_at: new Date(r.updatedAt).toISOString(), deleted: !!r.deleted }; });
      const { error } = await sb.from('docs').upsert(rows, { onConflict: 'user_id,id' });
      if (error) throw error;
      for (const [k, r] of chunk) { const cur = docs.get(k); if (cur && cur.updatedAt === r.updatedAt) { cur.dirty = false; await idbSet(k, cur, DS); } }
    }
    // 2. Liens coach / athlètes
    let fresh = false;
    const lr = await sb.from('coach_links').select('coach_id,athlete_id');
    if (!lr.error && lr.data) {
      const before = new Set(links.athletes);
      links.athletes = lr.data.filter(r => r.coach_id === me).map(r => r.athlete_id);
      links.coaches = lr.data.filter(r => r.athlete_id === me).map(r => r.coach_id);
      fresh = links.athletes.some(a => !before.has(a)); // nouvel athlète : on relit tout depuis le début
      await idbSet('links', { ...links }, MS);
    }
    // 3. Récupérer ce qui a changé ailleurs (mon carnet et ceux de mes athlètes)
    const cursor = (!fresh && (await idbGet('cursor:' + me, MS))) || '1970-01-01T00:00:00+00:00';
    let maxT = Date.parse(cursor), maxS = cursor, from = 0, changed = false;
    for (;;) {
      const { data, error } = await sb.from('docs').select('user_id,id,data,updated_at,synced_at,deleted').gt('synced_at', cursor).order('synced_at', { ascending: true }).range(from, from + 499);
      if (error) throw error;
      for (const row of data) {
        const key = K(row.user_id === me ? SELF : row.user_id, row.id);
        const loc = docs.get(key), ru = Date.parse(row.updated_at);
        if (!loc || ru > loc.updatedAt || (!loc.dirty && ru === loc.updatedAt && JSON.stringify(loc.data) !== JSON.stringify(row.data))) {
          const rec = { data: row.deleted ? null : row.data, updatedAt: ru, dirty: false, deleted: !!row.deleted };
          docs.set(key, rec); await idbSet(key, rec, DS); changed = true;
        }
        const st = Date.parse(row.synced_at); if (st > maxT) { maxT = st; maxS = row.synced_at; }
      }
      if (data.length < 500) break;
      from += 500;
    }
    await idbSet('cursor:' + me, maxS, MS);
    syncState.last = Date.now(); countPending();
    setState('idle');
    if (changed) emit();
  } catch (e) {
    console.warn('sync', e);
    setState(navigator.onLine === false ? 'offline' : 'error', e && (e.message || String(e)));
  } finally {
    running = false;
    if (again) { again = false; schedule(400); }
  }
}

export function startAutoSync() {
  if (!cloud) return;
  window.addEventListener('online', () => syncNow());
  window.addEventListener('offline', () => setState('offline'));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 45000);
  syncNow();
}

/* ---------- Raccourcis ---------- */
export const jget = k => get('j:' + k) || {};
export const jgetFor = (o, k) => getFor(o, 'j:' + k) || {};
// Le journal ne s'écrit que dans son propre carnet : en vue coach, il est en lecture seule.
export function jset(k, patch) {
  if (subject !== SELF) return;
  const cur = jget(k), next = Object.assign({}, cur, patch);
  for (const key of Object.keys(next)) if (next[key] === undefined || next[key] === null) delete next[key];
  put('j:' + k, next);
}
export const settings = () => Object.assign({ sound: true, voice: true, wake: true, cycle: false }, getFor(SELF, 'settings') || {});
export const setSettings = patch => putFor(SELF, 'settings', Object.assign({}, getFor(SELF, 'settings') || {}, patch));
// Réglages qui décrivent l'athlète (lus dans le carnet affiché : ceux de l'athlète quand le coach consulte son carnet)
export const subjectSettings = () => Object.assign({ cycle: false }, get('settings') || {});
export const profileOf = o => getFor(o, 'profile') || {};
export const myProfile = () => profileOf(SELF);
export const nameOf = o => (o === SELF ? myProfile().name : profileOf(o).name) || (o === SELF ? 'Moi' : 'Athlète');
