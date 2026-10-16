// Alipto · fonction « whoop » (Supabase Edge Function).
// Relie le carnet à Whoop (API officielle, OAuth 2) : récupération (VFC, FC de repos), sommeil et séances.
// Le secret Whoop et les jetons restent ici, côté serveur : l'appli ne les voit jamais.
//   POST { action: 'status' }                       → configuré ? connecté ? dernière synchro
//   POST { action: 'connect', ret: 'web' | 'ios' }  → adresse Whoop où la personne autorise l'accès
//   GET  ?code=…&state=…                            → retour de Whoop (enregistre les jetons, renvoie vers l'appli)
//   POST { action: 'sync', from, to, tz }           → nuits, récupération et séances par jour (l'appli les fusionne)
//   POST { action: 'disconnect' }                   → révoque l'accès chez Whoop et efface les jetons
// À déployer avec « Verify JWT » DÉSACTIVÉ (le retour de Whoop n'a pas de session) : la fonction vérifie elle-même le jeton.
// Secrets à définir : WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET (et WHOOP_APP_URL si l'adresse de l'appli change).
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par Supabase.

const env = k => Deno.env.get(k) || '';
const AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const API = 'https://api.prod.whoop.com/developer/v2';
const SCOPES = 'offline read:recovery read:sleep read:workout';
const APP_URL = () => env('WHOOP_APP_URL') || 'https://alixmealha.github.io/carnet/';
const REDIRECT = () => env('SUPABASE_URL') + '/functions/v1/whoop';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

function serviceKey() {
  const k = env('SUPABASE_SERVICE_ROLE_KEY');
  if (k) return k;
  try { const j = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}'); return j.default || Object.values(j)[0] || ''; } catch (_) { return ''; }
}
async function sb(path, init, token) {
  const key = serviceKey(), auth = token || (key.startsWith('eyJ') ? key : '');
  const r = await fetch(env('SUPABASE_URL') + path, Object.assign({}, init, {
    headers: Object.assign({ apikey: key, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, auth ? { Authorization: 'Bearer ' + auth } : {}, init && init.headers)
  }));
  const t = await r.text();
  let b = null; try { b = t ? JSON.parse(t) : null; } catch (_) { b = t; }
  if (!r.ok) throw new Error((b && (b.message || b.msg || b.error)) || 'Base : erreur ' + r.status);
  return b;
}
const rows = path => sb('/rest/v1/' + path, { method: 'GET', headers: { Prefer: '' } });

function randomState() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', b = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(b, x => a[x % a.length]).join('');   // Whoop impose 8 caractères
}

/* ---------- Whoop ---------- */
async function tokenCall(params) {
  const body = new URLSearchParams(Object.assign({ client_id: env('WHOOP_CLIENT_ID'), client_secret: env('WHOOP_CLIENT_SECRET') }, params));
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (_) {}
  if (!r.ok || !j || !j.access_token) { const e = new Error((j && (j.error_description || j.error)) || 'Whoop : erreur ' + r.status); e.code = (j && j.error) || String(r.status); throw e; }
  return j;
}
const saveTokens = (uid, j, extra) => sb('/rest/v1/whoop_tokens?on_conflict=user_id', {
  method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify(Object.assign({ user_id: uid, access_token: j.access_token, refresh_token: j.refresh_token, expires_at: new Date(Date.now() + (j.expires_in || 3600) * 1000).toISOString(), scope: j.scope || SCOPES }, extra))
});

// Jeton valide pour cette personne (rafraîchi si besoin). Whoop invalide l'ancien jeton de rafraîchissement à chaque fois :
// si deux appels se croisent, le second relit ce que le premier a enregistré.
async function accessFor(uid) {
  const r = await rows('whoop_tokens?select=*&user_id=eq.' + uid);
  const t = r && r[0];
  if (!t) return null;
  if (new Date(t.expires_at).getTime() - Date.now() > 60000) return t.access_token;
  try {
    const j = await tokenCall({ grant_type: 'refresh_token', refresh_token: t.refresh_token, scope: 'offline' });
    await saveTokens(uid, j);
    return j.access_token;
  } catch (e) {
    const again = await rows('whoop_tokens?select=*&user_id=eq.' + uid);
    const n = again && again[0];
    if (n && n.refresh_token !== t.refresh_token && new Date(n.expires_at).getTime() > Date.now()) return n.access_token;
    if (/invalid_grant|invalid_request|400|401/.test(e.code || '')) { await sb('/rest/v1/whoop_tokens?user_id=eq.' + uid, { method: 'DELETE' }); return null; }
    throw e;
  }
}

async function whoopGet(path, access, query) {
  const out = []; let next = '';
  for (let i = 0; i < 8; i++) {
    const q = new URLSearchParams(Object.assign({ limit: '25' }, query, next ? { nextToken: next } : {}));
    const r = await fetch(API + path + '?' + q, { headers: { Authorization: 'Bearer ' + access } });
    if (r.status === 401) { const e = new Error('Whoop : accès refusé'); e.code = '401'; throw e; }
    if (!r.ok) throw new Error('Whoop : erreur ' + r.status);
    const j = await r.json();
    for (const x of (j.records || [])) out.push(x);
    next = j.next_token || '';
    if (!next) break;
  }
  return out;
}

// Jour calendaire (AAAA-MM-JJ) d'un instant, dans le fuseau de la personne
function localDay(iso, tz) {
  const d = new Date(iso);
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
  catch (_) { return d.toISOString().slice(0, 10); }
}
const mins = ms => Math.round((ms || 0) / 60000);

async function syncDays(uid, from, to, tz) {
  const access = await accessFor(uid);
  if (!access) return { connected: false };
  const start = new Date(new Date(from + 'T00:00:00Z').getTime() - 36 * 3600e3).toISOString();
  const end = new Date(new Date(to + 'T00:00:00Z').getTime() + 60 * 3600e3).toISOString();
  const q = { start, end };
  const [sleeps, recs, works] = await Promise.all([whoopGet('/activity/sleep', access, q), whoopGet('/recovery', access, q), whoopGet('/activity/workout', access, q)]);
  const days = {};
  const day = d => days[d] || (days[d] = {});
  const inRange = d => d >= from && d <= to;
  const sleepDay = {};
  // nuit principale = la plus longue (les siestes sont ignorées)
  for (const s of sleeps) {
    if (s.nap) continue;
    const d = localDay(s.end, tz);
    sleepDay[s.id] = d;
    const st = s.score && s.score.stage_summary;
    if (!inRange(d) || s.score_state !== 'SCORED' || !st) continue;
    const total = mins((st.total_light_sleep_time_milli || 0) + (st.total_slow_wave_sleep_time_milli || 0) + (st.total_rem_sleep_time_milli || 0));
    const cur = day(d).nuit;
    if (cur && cur.total >= total) continue;
    day(d).nuit = Object.assign(cur || {}, { total, profond: mins(st.total_slow_wave_sleep_time_milli), leger: mins(st.total_light_sleep_time_milli), rem: mins(st.total_rem_sleep_time_milli), eveil: mins(st.total_awake_time_milli) });
  }
  for (const r of recs) {
    if (r.score_state !== 'SCORED' || !r.score) continue;
    const d = sleepDay[r.sleep_id] || localDay(r.created_at, tz);
    if (!inRange(d)) continue;
    const n = day(d).nuit || (day(d).nuit = {});
    if (typeof r.score.hrv_rmssd_milli === 'number') n.vfc = Math.round(r.score.hrv_rmssd_milli);
    if (typeof r.score.resting_heart_rate === 'number') n.fcr = Math.round(r.score.resting_heart_rate);
    if (typeof r.score.recovery_score === 'number') n.rec = Math.round(r.score.recovery_score);
  }
  for (const w of works) {
    if (w.score_state !== 'SCORED' || !w.score) continue;
    const d = localDay(w.start, tz);
    if (!inRange(d)) continue;
    const min = mins(new Date(w.end).getTime() - new Date(w.start).getTime());
    (day(d).workouts || (day(d).workouts = [])).push({
      min, sport: w.sport_name || '', strain: w.score.strain != null ? Math.round(w.score.strain * 10) / 10 : null,
      hr: w.score.average_heart_rate || null, hrmax: w.score.max_heart_rate || null,
      km: w.score.distance_meter ? Math.round(w.score.distance_meter / 100) / 10 : null
    });
  }
  await sb('/rest/v1/whoop_tokens?user_id=eq.' + uid, { method: 'PATCH', body: JSON.stringify({ last_sync: new Date().toISOString() }) });
  return { connected: true, days };
}

/* ---------- Requêtes ---------- */
const back = (ret, ok) => ret === 'ios'
  ? 'alipto://whoop?' + (ok ? 'ok=1' : 'error=1')
  : APP_URL() + '?whoop=' + (ok ? 'ok' : 'error');
const redirect = url => new Response(null, { status: 302, headers: { Location: url } });

async function callback(url) {
  const state = url.searchParams.get('state') || '', code = url.searchParams.get('code') || '';
  let ret = 'web';
  try {
    if (!/^[A-Za-z0-9]{8}$/.test(state)) throw new Error('état invalide');
    const r = await rows('whoop_states?select=*&state=eq.' + state);
    const row = r && r[0];
    await sb('/rest/v1/whoop_states?state=eq.' + state, { method: 'DELETE' });   // usage unique
    if (!row || Date.now() - new Date(row.created_at).getTime() > 15 * 60000) throw new Error('état expiré');
    ret = row.ret === 'ios' ? 'ios' : 'web';
    if (url.searchParams.get('error') || !code) return redirect(back(ret, false));
    const j = await tokenCall({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT() });
    if (!j.refresh_token) throw new Error('pas de jeton de rafraîchissement');
    await saveTokens(row.user_id, j, { connected_at: new Date().toISOString(), last_sync: null });
    return redirect(back(ret, true));
  } catch (_) { return redirect(back(ret, false)); }
}

export async function handle(req) {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (!env('SUPABASE_URL') || !serviceKey()) return json({ error: 'La fonction ne trouve pas la clé service de Supabase.' }, 500);
    const url = new URL(req.url);
    if (req.method === 'GET') return await callback(url);
    if (req.method !== 'POST') return json({ error: 'Méthode non permise' }, 405);
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    let me;
    try { me = await sb('/auth/v1/user', { method: 'GET', headers: { Prefer: '' } }, token); } catch (_) { return json({ error: 'Session expirée : reconnecte-toi.' }, 401); }
    if (!me || !me.id) return json({ error: 'Session expirée : reconnecte-toi.' }, 401);
    const b = await req.json().catch(() => ({}));
    const configured = !!(env('WHOOP_CLIENT_ID') && env('WHOOP_CLIENT_SECRET'));
    if (b.action === 'status') {
      const r = await rows('whoop_tokens?select=connected_at,last_sync&user_id=eq.' + me.id);
      return json({ configured, connected: !!(r && r[0]), lastSync: r && r[0] ? r[0].last_sync : null });
    }
    if (!configured) return json({ error: 'Whoop n’est pas encore configuré (secrets WHOOP_CLIENT_ID et WHOOP_CLIENT_SECRET manquants dans Supabase).' }, 400);
    if (b.action === 'connect') {
      const state = randomState();
      await sb('/rest/v1/whoop_states?created_at=lt.' + encodeURIComponent(new Date(Date.now() - 3600e3).toISOString()), { method: 'DELETE' });
      await sb('/rest/v1/whoop_states', { method: 'POST', body: JSON.stringify({ state, user_id: me.id, ret: b.ret === 'ios' ? 'ios' : 'web' }) });
      const q = new URLSearchParams({ client_id: env('WHOOP_CLIENT_ID'), response_type: 'code', redirect_uri: REDIRECT(), scope: SCOPES, state });
      return json({ url: AUTH_URL + '?' + q });
    }
    if (b.action === 'sync') {
      if (!DAY.test(b.from || '') || !DAY.test(b.to || '')) return json({ error: 'Dates invalides.' }, 400);
      if (new Date(b.to).getTime() - new Date(b.from).getTime() > 40 * 86400e3) return json({ error: 'Période trop longue (40 jours au plus).' }, 400);
      return json(await syncDays(me.id, b.from, b.to, String(b.tz || 'Europe/Paris')));
    }
    if (b.action === 'disconnect') {
      const access = await accessFor(me.id).catch(() => null);
      if (access) await fetch(API + '/user/access', { method: 'DELETE', headers: { Authorization: 'Bearer ' + access } }).catch(() => {});
      await sb('/rest/v1/whoop_tokens?user_id=eq.' + me.id, { method: 'DELETE' });
      return json({ connected: false });
    }
    return json({ error: 'Action inconnue.' }, 400);
  } catch (e) {
    return json({ error: String(e && e.message || e) }, 500);
  }
}

Deno.serve(handle);
