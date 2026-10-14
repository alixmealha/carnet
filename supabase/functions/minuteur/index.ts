// Alipto · fonction « minuteur » (Supabase Edge Function).
// Quand l'appli passe en arrière-plan pendant un repos, elle demande une notification pour la fin du repos.
// La demande arrive en texte simple (navigator.sendBeacon, sans pré-vol CORS), avec le jeton de session :
// la fonction le vérifie elle-même. À déployer avec « Verify JWT » DÉSACTIVÉ.
// Une exécution attend au plus 110 s puis se relance pour la suite (limite de durée des fonctions).
//
// Secrets déjà définis pour « notify » : VAPID_PUBLIC, VAPID_PRIVATE (et VAPID_SUBJECT facultatif).
// SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont fournis par Supabase.

const te = new TextEncoder();
const b64u = {
  enc(buf) { let s = ''; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec(str) { const s = str.replace(/-/g, '+').replace(/_/g, '/'); const p = s + '='.repeat((4 - (s.length % 4)) % 4); return Uint8Array.from(atob(p), c => c.charCodeAt(0)); }
};
function concat(...parts) { const n = parts.reduce((a, p) => a + p.length, 0); const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; }
async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}

// Chiffre le message pour un abonnement (aes128gcm, un seul enregistrement).
async function encryptPayload(sub, payload) {
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
async function vapidHeader(endpoint, subject, publicB64, privateB64) {
  const pub = b64u.dec(publicB64);
  const jwk = { kty: 'EC', crv: 'P-256', d: privateB64, x: b64u.enc(pub.slice(1, 33)), y: b64u.enc(pub.slice(33, 65)), ext: true };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const h = b64u.enc(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const c = b64u.enc(te.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(h + '.' + c));
  return 'vapid t=' + h + '.' + c + '.' + b64u.enc(sig) + ', k=' + publicB64;
}

async function sendPush(sub, message, env) {
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


/* ---------- Base (clé service, côté serveur uniquement) ---------- */
function env(k: string, d?: string) { const v = Deno.env.get(k); return v == null || v === '' ? d : v; }
async function rest(path: string, init?: RequestInit) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY')!;
  const r = await fetch(env('SUPABASE_URL') + '/rest/v1/' + path, Object.assign({}, init, {
    headers: Object.assign({ apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, init && init.headers)
  }));
  if (!r.ok) throw new Error('REST ' + r.status + ' ' + (await r.text()));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
async function userOf(token: string) {
  if (!token || token.length > 4000) return null;
  const r = await fetch(env('SUPABASE_URL') + '/auth/v1/user', { headers: { apikey: env('SUPABASE_ANON_KEY')!, Authorization: 'Bearer ' + token } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && /^[0-9a-f-]{36}$/.test(u.id || '') ? u : null;
}
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
const MAX_WAIT = 110000, MAX_AHEAD = 30 * 60 * 1000;
const cut = (s: unknown, n: number) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const rowOf = async (id: string, uid: string) => { const r = await rest('rest_timers?select=id,fire_at,msg&id=eq.' + id + '&user_id=eq.' + uid); return r && r[0] ? r[0] : null; };

async function wait(id: string, uid: string, token: string) {
  const row = await rowOf(id, uid); if (!row) return;
  const left = new Date(row.fire_at).getTime() - Date.now();
  if (left > MAX_WAIT) {
    await sleep(MAX_WAIT);
    // relance pour la suite de l'attente
    await fetch(env('SUPABASE_URL') + '/functions/v1/minuteur', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ token, id }) });
    return;
  }
  await sleep(Math.max(0, left));
  const now = await rowOf(id, uid);
  if (!now || now.fire_at !== row.fire_at) return; // annulé (retour dans l'appli) ou remplacé
  await rest('rest_timers?id=eq.' + id, { method: 'DELETE' });
  const subs = await rest('push_subs?select=endpoint,sub&user_id=eq.' + uid) || [];
  const keys = { subject: env('VAPID_SUBJECT', 'https://alixmealha.github.io/carnet/'), publicKey: env('VAPID_PUBLIC'), privateKey: env('VAPID_PRIVATE') };
  for (const s of subs) {
    try {
      const r = await sendPush(s.sub, Object.assign({ url: './', tag: 'minuteur' }, now.msg), keys);
      if (r.status === 404 || r.status === 410) await rest('push_subs?endpoint=eq.' + encodeURIComponent(s.endpoint), { method: 'DELETE' });
    } catch (_) { /* abonnement invalide : on continue */ }
  }
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('ok', { headers: CORS });
  let b: Record<string, unknown> = {};
  try { b = JSON.parse(await req.text()); } catch (_) { return new Response('bad request', { status: 400, headers: CORS }); }
  const token = String(b.token || ''), id = String(b.id || '');
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(id)) return new Response('bad id', { status: 400, headers: CORS });
  const u = await userOf(token);
  if (!u) return new Response('unauthorized', { status: 401, headers: CORS });
  if (b.cancel) {
    await rest('rest_timers?user_id=eq.' + u.id, { method: 'DELETE' });
    return new Response('cancelled', { headers: CORS });
  }
  if (b.at) {
    const at = Number(b.at);
    if (!(at > Date.now() && at < Date.now() + MAX_AHEAD)) return new Response('bad time', { status: 400, headers: CORS });
    const m = (b.msg || {}) as Record<string, unknown>;
    const msg = { title: cut(m.title, 80) || 'Repos terminé', body: cut(m.body, 160) };
    // un seul minuteur à la fois par personne
    await rest('rest_timers?user_id=eq.' + u.id, { method: 'DELETE' });
    await rest('rest_timers', { method: 'POST', body: JSON.stringify({ id, user_id: u.id, fire_at: new Date(at).toISOString(), msg }) });
  }
  // @ts-ignore EdgeRuntime est fourni par Supabase
  EdgeRuntime.waitUntil(wait(id, u.id, token));
  return new Response('armed', { status: 202, headers: CORS });
});
