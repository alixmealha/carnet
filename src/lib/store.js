// Stockage local d'abord (IndexedDB), synchronisé avec Supabase quand il est configuré.
// Chaque donnée est un « doc » : plan (méta), p:AAAA-MM-JJ (séance prévue), j:AAAA-MM-JJ (journal), settings.
import { createStore, get as idbGet, set as idbSet, entries as idbEntries, clear as idbClear } from 'idb-keyval';
import { useEffect, useState } from 'preact/hooks';
import { sb, cloud } from './supa.js';

const DS = createStore('carnet-docs', 'docs');
const MS = createStore('carnet-meta', 'meta');
const docs = new Map();
const subs = new Set();
let ver = 0;

export const syncState = { state: cloud ? 'idle' : 'local', last: null, error: null, pending: 0 };

function emit() { ver++; for (const f of subs) { try { f(); } catch (e) { console.error(e); } } }
export function subscribe(f) { subs.add(f); return () => subs.delete(f); }
export function useStore() {
  const [, set] = useState(ver);
  useEffect(() => subscribe(() => set(ver)), []);
  return ver;
}

export async function initStore() {
  try { for (const [k, v] of await idbEntries(DS)) docs.set(k, v); } catch (e) { console.warn('IndexedDB', e); }
  countPending(); emit();
}

export function get(id) { const r = docs.get(id); return r && !r.deleted ? r.data : undefined; }
export function ids(prefix) { const out = []; for (const [k, r] of docs) if (k.startsWith(prefix) && !r.deleted) out.push(k); return out.sort(); }
function countPending() { let n = 0; for (const r of docs.values()) if (r.dirty) n++; syncState.pending = n; }

export function put(id, data, opts) {
  const rec = { data, updatedAt: Date.now(), dirty: true };
  docs.set(id, rec);
  idbSet(id, rec, DS).catch(e => console.warn(e));
  countPending();
  if (!(opts && opts.silent)) emit();
  schedule();
}
export function putMany(map) {
  const now = Date.now();
  for (const [id, data] of Object.entries(map)) { const rec = { data, updatedAt: now, dirty: true }; docs.set(id, rec); idbSet(id, rec, DS).catch(() => {}); }
  countPending(); emit(); schedule(300);
}
export function remove(id) {
  const rec = { data: null, updatedAt: Date.now(), dirty: true, deleted: true };
  docs.set(id, rec); idbSet(id, rec, DS).catch(() => {}); countPending(); emit(); schedule();
}
export function exportAll() {
  const out = {};
  for (const [k, r] of docs) if (!r.deleted && r.data != null) out[k] = r.data;
  return { app: 'carnet', v: 1, exportedAt: new Date().toISOString(), docs: out };
}
export async function wipeLocal() {
  docs.clear(); await idbClear(DS).catch(() => {}); await idbClear(MS).catch(() => {}); countPending(); emit();
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
    setState('syncing');
    // 1. Envoyer ce qui a changé ici
    const dirty = [...docs.entries()].filter(([, r]) => r.dirty);
    for (let i = 0; i < dirty.length; i += 100) {
      const chunk = dirty.slice(i, i + 100);
      const rows = chunk.map(([id, r]) => ({ user_id: session.user.id, id, data: r.data == null ? {} : r.data, updated_at: new Date(r.updatedAt).toISOString(), deleted: !!r.deleted }));
      const { error } = await sb.from('docs').upsert(rows, { onConflict: 'user_id,id' });
      if (error) throw error;
      for (const [id, r] of chunk) { const cur = docs.get(id); if (cur && cur.updatedAt === r.updatedAt) { cur.dirty = false; await idbSet(id, cur, DS); } }
    }
    // 2. Récupérer ce qui a changé ailleurs
    const cursor = (await idbGet('cursor:' + session.user.id, MS)) || '1970-01-01T00:00:00+00:00';
    let maxT = Date.parse(cursor), maxS = cursor, from = 0, changed = false;
    for (;;) {
      const { data, error } = await sb.from('docs').select('id,data,updated_at,synced_at,deleted').gt('synced_at', cursor).order('synced_at', { ascending: true }).range(from, from + 499);
      if (error) throw error;
      for (const row of data) {
        const loc = docs.get(row.id), ru = Date.parse(row.updated_at);
        if (!loc || ru > loc.updatedAt || (!loc.dirty && ru === loc.updatedAt && JSON.stringify(loc.data) !== JSON.stringify(row.data))) {
          const rec = { data: row.deleted ? null : row.data, updatedAt: ru, dirty: false, deleted: !!row.deleted };
          docs.set(row.id, rec); await idbSet(row.id, rec, DS); changed = true;
        }
        const st = Date.parse(row.synced_at); if (st > maxT) { maxT = st; maxS = row.synced_at; }
      }
      if (data.length < 500) break;
      from += 500;
    }
    await idbSet('cursor:' + session.user.id, maxS, MS);
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
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 60000);
  syncNow();
}

/* ---------- Raccourcis ---------- */
export const jget = k => get('j:' + k) || {};
export function jset(k, patch) {
  const cur = jget(k), next = Object.assign({}, cur, patch);
  for (const key of Object.keys(next)) if (next[key] === undefined || next[key] === null) delete next[key];
  put('j:' + k, next);
}
export const settings = () => Object.assign({ sound: true, voice: true, wake: true }, get('settings') || {});
export const setSettings = patch => put('settings', Object.assign({}, get('settings') || {}, patch));
