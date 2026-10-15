// Carnet · fonction « notify » (Supabase Edge Function).
// Appelée par la base quand un athlète valide une séance ou quand un message est posté sur une séance.
// Envoie une notification Web Push (iPhone, appli installée sur l'écran d'accueil) sans dépendance externe :
// chiffrement aes128gcm (RFC 8291) et signature VAPID (RFC 8292) avec WebCrypto.
//
// Secrets à définir (Edge Functions → Secrets) : VAPID_PUBLIC, VAPID_PRIVATE, NOTIFY_SECRET.
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par Supabase.

const te = new TextEncoder();
export const b64u = {
  enc(buf) { let s = ''; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec(str) { const s = str.replace(/-/g, '+').replace(/_/g, '/'); const p = s + '='.repeat((4 - (s.length % 4)) % 4); return Uint8Array.from(atob(p), c => c.charCodeAt(0)); }
};
function concat(...parts) { const n = parts.reduce((a, p) => a + p.length, 0); const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; }
async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}

// Chiffre le message pour un abonnement (aes128gcm, un seul enregistrement).
export async function encryptPayload(sub, payload) {
  const uaPub = b64u.dec(sub.keys.p256dh), auth = b64u.dec(sub.keys.auth);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(te.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, new Uint8Array([2]))));
  const head = new Uint8Array(21 + asPub.length);
  head.set(salt, 0); new DataView(head.buffer).setUint32(16, 4096); head[20] = asPub.length; head.set(asPub, 21);
  return concat(head, ct);
}

// En-tête Authorization VAPID (JWT ES256).
export async function vapidHeader(endpoint, subject, publicB64, privateB64) {
  const pub = b64u.dec(publicB64);
  const jwk = { kty: 'EC', crv: 'P-256', d: privateB64, x: b64u.enc(pub.slice(1, 33)), y: b64u.enc(pub.slice(33, 65)), ext: true };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const h = b64u.enc(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const c = b64u.enc(te.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(h + '.' + c));
  return 'vapid t=' + h + '.' + c + '.' + b64u.enc(sig) + ', k=' + publicB64;
}

export async function sendPush(sub, message, env) {
  const body = await encryptPayload(sub, te.encode(JSON.stringify(message)));
  return fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(sub.endpoint, env.subject, env.publicKey, env.privateKey),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'high'
    },
    body
  });
}

/* ---------- Contenu des notifications ---------- */
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export function dayLabel(k) {
  const d = new Date(k + 'T12:00:00Z'), n = d.getUTCDate();
  return JOURS[d.getUTCDay()] + ' ' + (n === 1 ? '1er' : n) + ' ' + MOIS[d.getUTCMonth()];
}
const STATUS = { faite: 'séance faite', adaptee: 'séance adaptée', sautee: 'séance sautée' };
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

const REASON = { fatigue: 'fatigue', malade: 'malade', gene: 'gêne ou douleur', temps: 'pas le temps', materiel: 'pas le matériel', autre: 'autre raison' };
export function sessionMessage(name, uid, day, e) {
  const parts = [dayLabel(day)];
  // séance annulée (ou arrêtée) depuis le menu « ••• » : la raison en premier
  if (e.cancel && e.cancel.r) parts.push(REASON[e.cancel.r] || 'autre raison');
  const well = e.well ? Object.values(e.well).filter(v => typeof v === 'number') : [];
  if (well.length >= 3) parts.push('forme ' + well.reduce((a, b) => a + b, 0) + '/' + well.length * 5);
  if (typeof e.rpe === 'number') parts.push('ressenti ' + e.rpe + '/10');
  if (e.siv && typeof e.siv.i === 'number' && typeof e.siv.v === 'number') parts.push('I ' + e.siv.i + ' · V ' + e.siv.v);
  if (typeof e.duree === 'number' && e.duree > 0) parts.push(e.duree + ' min');
  let body = parts.join(' · ');
  const note = e.cancel && e.cancel.note ? e.cancel.note : e.note;
  if (note) body += '\n« ' + cut(note, 110) + ' »';
  const title = e.cancel ? (e.cancel.started ? 'séance arrêtée' : 'séance annulée') : STATUS[e.status] || 'séance validée';
  return { title: name + ' · ' + title, body, url: './?a=' + uid + '&d=' + day, tag: uid + ':j:' + day };
}

/* ---------- Accès à la base (clé service, côté serveur uniquement) ---------- */
function env(k, d) { const v = Deno.env.get(k); return v == null || v === '' ? d : v; }
async function rest(path, init) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const r = await fetch(env('SUPABASE_URL') + '/rest/v1/' + path, Object.assign({}, init, {
    headers: Object.assign({ apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, init && init.headers)
  }));
  if (!r.ok) throw new Error('REST ' + r.status + ' ' + (await r.text()));
  return r.status === 204 ? null : r.json();
}
const one = async (uid, id) => { const rows = await rest('docs?select=data&user_id=eq.' + uid + '&id=eq.' + encodeURIComponent(id)); return rows && rows[0] ? rows[0].data : null; };
const nameOf = async uid => { if (!/^[0-9a-f-]{36}$/.test(uid || '')) return null; const rows = await rest('profiles?select=name&id=eq.' + uid); return rows && rows[0] && rows[0].name ? rows[0].name : null; };
const coachesOf = async uid => (await rest('coach_links?select=coach_id&athlete_id=eq.' + uid)).map(r => r.coach_id);

export async function handle(req) {
  if (req.method !== 'POST') return new Response('ok');
  if (!env('NOTIFY_SECRET') || req.headers.get('x-notify-secret') !== env('NOTIFY_SECRET')) return new Response('forbidden', { status: 403 });
  const { kind, user_id: uid, id } = await req.json();
  if (!/^[0-9a-f-]{36}$/.test(uid || '') || !/^[jc]:\d{4}-\d{2}-\d{2}$/.test(id || '')) return new Response('bad request', { status: 400 });
  const day = id.slice(2);
  const data = await one(uid, id);
  if (!data) return new Response('no doc');
  const name = (await nameOf(uid)) || 'Ton athlète';
  let targets = [], msg = null;
  if (kind === 'session') {
    targets = await coachesOf(uid);
    msg = sessionMessage(name, uid, day, data);
  } else if (kind === 'comment') {
    const msgs = Array.isArray(data.msgs) ? data.msgs : [];
    const last = msgs[msgs.length - 1];
    if (!last) return new Response('no message');
    if (last.uid === uid) {
      targets = await coachesOf(uid);
      msg = { title: name + ' a répondu', body: dayLabel(day) + '\n« ' + cut(last.text, 140) + ' »', url: './?a=' + uid + '&d=' + day, tag: uid + ':c:' + day };
    } else {
      targets = [uid];
      msg = { title: ((await nameOf(last.uid)) || last.name || 'Ton coach') + ' a commenté ta séance', body: dayLabel(day) + '\n« ' + cut(last.text, 140) + ' »', url: './?d=' + day, tag: 'c:' + day };
    }
  } else return new Response('bad kind', { status: 400 });
  if (!targets.length) return new Response('no target');
  const subs = await rest('push_subs?select=endpoint,sub&user_id=in.(' + targets.join(',') + ')');
  const keys = { subject: env('VAPID_SUBJECT', 'https://alixmealha.github.io/carnet/'), publicKey: env('VAPID_PUBLIC'), privateKey: env('VAPID_PRIVATE') };
  const out = [];
  for (const s of subs) {
    try {
      const r = await sendPush(s.sub, msg, keys);
      out.push(r.status);
      if (r.status === 404 || r.status === 410) await rest('push_subs?endpoint=eq.' + encodeURIComponent(s.endpoint), { method: 'DELETE' });
    } catch (e) { out.push(String(e)); }
  }
  return new Response(JSON.stringify({ sent: out }), { headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(handle);
