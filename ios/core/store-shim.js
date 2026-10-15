// Remplace src/lib/store.js dans l'appli iPhone : la même interface, mais les données vivent dans l'appli (Swift).
// L'appli envoie ses documents ici (__core.load / __core.set) ; les écritures faites par la logique web repartent
// vers l'appli (__native.put / __native.remove), qui les enregistre et les synchronise avec Supabase.
export const SELF = 'self';
const docs = new Map();
let subject = SELF;
export const links = { athletes: [], coaches: [], me: null, email: null, profiles: {}, locks: {}, myLock: false };
export const syncState = { state: 'idle', last: null, error: null, pending: 0, rejected: 0, rejectedAt: 0 };
const K = (o, id) => o + '|' + id;
const native = () => globalThis.__native || { put() {}, remove() {} };

// ---- côté appli
export const core = {
  load(map) { docs.clear(); for (const k of Object.keys(map)) docs.set(k, map[k]); },
  set(key, data) { if (data == null) docs.delete(key); else docs.set(key, data); },
  setSubject(o) { subject = o || SELF; },
  setLinks(l) { Object.assign(links, l || {}); },
  size: () => docs.size
};

// ---- même interface que store.js
export function subscribe() { return () => {}; }
export function useStore() { return 0; }
export const getSubject = () => subject;
export const isSelf = () => subject === SELF;
export function setSubject(o) { if (o === links.me) o = SELF; subject = o || SELF; native().setSubject && native().setSubject(subject); }
export function getFor(o, id) { return docs.get(K(o, id)); }
export function metaFor(o, id) { const d = docs.get(K(o, id)); return d === undefined ? undefined : { data: d }; }
export function idsFor(o, prefix) {
  const out = [], pre = K(o, prefix);
  for (const k of docs.keys()) if (k.startsWith(pre)) out.push(k.slice(o.length + 1));
  return out.sort();
}
export const get = id => getFor(subject, id);
export const ids = prefix => idsFor(subject, prefix);
export function putFor(o, id, data) { docs.set(K(o, id), data); native().put(o, id, JSON.stringify(data)); }
export const put = (id, data) => putFor(subject, id, data);
export function putMany(map, owner) { const o = owner || subject; for (const [id, data] of Object.entries(map)) putFor(o, id, data); }
export function remove(id, owner) { const o = owner || subject; docs.delete(K(o, id)); native().remove(o, id); }
export function removeAllMine() { for (const k of [...docs.keys()]) if (k.startsWith(SELF + '|')) remove(k.slice(SELF.length + 1), SELF); }
export function exportAll(owner) {
  const o = owner || subject, out = {};
  for (const [k, d] of docs) { const i = k.indexOf('|'); if (k.slice(0, i) === o && d != null) out[k.slice(i + 1)] = d; }
  return { app: 'alipto', v: 1, exportedAt: new Date().toISOString(), docs: out };
}
export async function wipeLocal() {}
export function schedule() {}
export async function syncNow() { native().sync && native().sync(); }
export function startAutoSync() {}
export async function initStore() {}

export const settings = () => Object.assign({ sound: true, voice: true, wake: true }, getFor(SELF, 'settings') || {});
export const setSettings = patch => putFor(SELF, 'settings', Object.assign({}, getFor(SELF, 'settings') || {}, patch));
const uidOf = o => (o === SELF ? links.me : o);
export const myRow = () => (links.me ? links.profiles[links.me] || null : null);
export function role() { const r = myRow(); return r ? r.role : 'athlete'; }
export const isAdmin = () => role() === 'admin';
export const isCoach = () => role() === 'coach';
export const hasCarnet = () => role() !== 'coach';
export const planLocked = () => subject === SELF && !!links.myLock;
export const canEditPlan = () => !planLocked();
export function profileOf(o) {
  const doc = getFor(o, 'profile') || {}, row = links.profiles[uidOf(o)];
  const p = Object.assign({}, doc);
  if (row) for (const k of ['name', 'role', 'sex', 'birth_year', 'height_cm', 'weight_kg', 'onboarded']) if (row[k] != null && row[k] !== '') p[k] = row[k];
  if (p.birth_year) p.under18 = new Date().getFullYear() - p.birth_year < 18;
  return p;
}
export const myProfile = () => profileOf(SELF);
export const nameOf = o => profileOf(o).name || (o === SELF ? 'Moi' : 'Athlète');
export const subjectSettings = () => Object.assign({ cycle: profileOf(subject).sex === 'F' }, get('settings') || {});
const DOCKEYS = ['sports', 'diet', 'nutri', 'levels'];
export function saveProfileDoc(patch) {
  const p = {}; for (const k of DOCKEYS) if (k in patch) p[k] = patch[k];
  if (Object.keys(p).length) putFor(SELF, 'profile', Object.assign({}, getFor(SELF, 'profile') || {}, p));
}
export async function saveMyProfile(patch) { native().saveProfile && native().saveProfile(JSON.stringify(patch)); saveProfileDoc(patch); }
export const jget = k => get('j:' + k) || {};
export const jgetFor = (o, k) => getFor(o, 'j:' + k) || {};
export function jset(k, patch) {
  if (subject !== SELF) return;
  const cur = jget(k), next = Object.assign({}, cur, patch);
  for (const key of Object.keys(next)) if (next[key] === undefined || next[key] === null) delete next[key];
  put('j:' + k, next);
}
