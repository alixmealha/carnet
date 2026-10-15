// Alipto · fonction « rappels » (Supabase Edge Function), appelée toutes les 15 minutes par la base (pg_cron).
// - Rappel du matin : à l'heure choisie, si la forme du matin n'est pas encore remplie.
// - Le dimanche à 19 h : le bilan de la semaine (l'athlète : ses séances ; le coach : celles de ses athlètes).
// Chaque rappel n'est envoyé qu'une fois (table reminders_sent).
// À déployer avec « Verify JWT » DÉSACTIVÉ : l'appel est authentifié par l'en-tête x-notify-secret.
// Secrets déjà définis pour « notify » : VAPID_PUBLIC, VAPID_PRIVATE, NOTIFY_SECRET (et VAPID_SUBJECT facultatif).

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
  return r.status === 204 || r.status === 201 ? null : r.json();
}
const inList = (a: string[]) => '(' + a.map(x => '"' + x + '"').join(',') + ')';

/* ---------- Dates dans le fuseau de chacun ---------- */
function localNow(tz: string, d = new Date()) {
  let parts;
  try { parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(d); }
  catch (_) { return localNow('Europe/Paris', d); }
  const p: Record<string, string> = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return { day: p.year + '-' + p.month + '-' + p.day, min: (+p.hour % 24) * 60 + +p.minute, dow: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) };
}
const addDays = (k: string, n: number) => { const d = new Date(k + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const hm = (s: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null; };
// dans le créneau de 15 min qui suit l'heure visée
const due = (now: number, at: number | null) => at != null && now - at >= 0 && now - at < 15;

/* ---------- Contenu ---------- */
const sessionName = (d: any) => {
  if (!d || !Array.isArray(d.blocks)) return null;
  if (d.short) return d.short;
  const t = d.blocks.filter((b: any) => b.kind !== 'rest').map((b: any) => String(b.title || '').split(' · ')[0]);
  return t.length ? [...new Set(t)].join(', ') : null;
};
const hasSession = (d: any) => d && Array.isArray(d.blocks) && d.blocks.some((b: any) => b.kind !== 'rest');
const wellDone = (j: any) => j && j.well && Object.values(j.well).filter(v => typeof v === 'number').length >= 5;
const didIt = (j: any) => j && (j.status === 'faite' || j.status === 'adaptee' || (!j.status && j.done && Object.values(j.done).some((v: any) => v > 0)));

async function docs(uid: string, ids: string[]) {
  const rows = await rest('docs?select=id,data&deleted=is.false&user_id=eq.' + uid + '&id=in.' + encodeURIComponent(inList(ids)));
  return Object.fromEntries((rows || []).map((r: any) => [r.id, r.data]));
}
async function weekCount(uid: string, mon: string) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const d = await docs(uid, days.map(k => 'p:' + k).concat(days.map(k => 'j:' + k)));
  let planned = 0, done = 0;
  for (const k of days) if (hasSession(d['p:' + k])) { planned++; if (didIt(d['j:' + k])) done++; }
  return { planned, done };
}
// envoyé une seule fois : la ligne existe déjà → on n'envoie pas
async function once(uid: string, kind: string, day: string) {
  try { await rest('reminders_sent', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: uid, kind, day }) }); return true; }
  catch (e) { if (/409|23505|duplicate/.test(String(e))) return false; throw e; }
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('ok');
  if (!env('NOTIFY_SECRET') || req.headers.get('x-notify-secret') !== env('NOTIFY_SECRET')) return new Response('forbidden', { status: 403 });
  const keys = { subject: env('VAPID_SUBJECT', 'https://alixmealha.github.io/carnet/')!, publicKey: env('VAPID_PUBLIC')!, privateKey: env('VAPID_PRIVATE')! };
  const subs = await rest('push_subs?select=user_id,endpoint,sub') as any[];
  const byUser = new Map<string, any[]>();
  for (const s of subs || []) { if (!byUser.has(s.user_id)) byUser.set(s.user_id, []); byUser.get(s.user_id)!.push(s); }
  if (!byUser.size) return new Response('no subs');
  const users = [...byUser.keys()];
  const sets = await rest('docs?select=user_id,data&id=eq.settings&deleted=is.false&user_id=in.' + encodeURIComponent('(' + users.join(',') + ')')) as any[];
  const setOf = new Map((sets || []).map(r => [r.user_id, r.data || {}]));
  const profs = await rest('profiles?select=id,name,role&id=in.' + encodeURIComponent('(' + users.join(',') + ')')) as any[];
  const profOf = new Map((profs || []).map(r => [r.id, r]));
  const out: any[] = [];
  const push = async (uid: string, msg: any) => {
    for (const s of byUser.get(uid) || []) {
      try { const r = await sendPush(s.sub, msg, keys); out.push(r.status); if (r.status === 404 || r.status === 410) await rest('push_subs?endpoint=eq.' + encodeURIComponent(s.endpoint), { method: 'DELETE' }); }
      catch (e) { out.push(String(e)); }
    }
  };
  for (const uid of users) {
    const st = setOf.get(uid) || {}, prof = profOf.get(uid) || {}, now = localNow(st.tz || 'Europe/Paris');
    const athlete = prof.role !== 'coach';
    // 1. rappel du matin
    if (athlete && st.remind && st.remind.on && due(now.min, hm(st.remind.at || '08:00'))) {
      const d = await docs(uid, ['j:' + now.day, 'p:' + now.day]);
      if (!wellDone(d['j:' + now.day]) && await once(uid, 'matin', now.day)) {
        const ses = hasSession(d['p:' + now.day]) ? sessionName(d['p:' + now.day]) : null;
        await push(uid, { title: 'Forme du matin', body: '30 secondes pour noter ta nuit et ta forme' + (ses ? ' : ta séance du jour (' + ses + ') s’ajuste.' : '.'), url: './', tag: 'matin:' + now.day });
      }
    }
    // 2. dimanche 19 h : bilan de la semaine
    if (now.dow === 6 && st.weekly !== false && due(now.min, 19 * 60)) {
      const mon = addDays(now.day, -6);
      if (athlete) {
        const c = await weekCount(uid, mon);
        if (c.planned && await once(uid, 'semaine', mon)) await push(uid, { title: 'Ta semaine', body: c.done + ' séance' + (c.done > 1 ? 's' : '') + ' sur ' + c.planned + ' · ton bilan est prêt.', url: './', tag: 'semaine:' + mon });
      }
      const ath = (await rest('coach_links?select=athlete_id&coach_id=eq.' + uid) as any[] || []).map(r => r.athlete_id);
      if (ath.length && await once(uid, 'semaine-coach', mon)) {
        const names = await rest('profiles?select=id,name&id=in.' + encodeURIComponent('(' + ath.join(',') + ')')) as any[];
        const nm = new Map((names || []).map(r => [r.id, r.name || 'Athlète']));
        const parts: string[] = [];
        for (const a of ath) { const c = await weekCount(a, mon); if (c.planned) parts.push(nm.get(a) + ' ' + c.done + '/' + c.planned); }
        if (parts.length) await push(uid, { title: 'Bilan de la semaine', body: parts.join(' · '), url: './', tag: 'semaine-coach:' + mon });
      }
    }
  }
  return new Response(JSON.stringify({ sent: out }), { headers: { 'Content-Type': 'application/json' } });
});
