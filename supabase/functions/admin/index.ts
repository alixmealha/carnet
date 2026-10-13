// Carnet · fonction « admin » (Supabase Edge Function).
// Réservée au compte administrateur : créer un compte (invitation par e-mail ou mot de passe provisoire),
// envoyer un e-mail de réinitialisation, redéfinir un mot de passe, supprimer un compte.
// Les e-mails partent par l'envoi d'e-mails de Supabase (SMTP à configurer dans Authentication → Emails).
// La clé service (SUPABASE_SERVICE_ROLE_KEY) est fournie automatiquement par Supabase et ne quitte jamais le serveur.

const env = k => Deno.env.get(k) || '';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const VERSION = 4;
const json = (o, status = 200) => new Response(JSON.stringify(Object.assign({ v: VERSION }, o)), { status, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

// Clé service : l'ancienne (JWT « eyJ… ») ou la nouvelle (« sb_secret_… »), selon le projet.
// La nouvelle ne se met que dans l'en-tête apikey : la passer en « Authorization: Bearer » fait échouer l'appel.
function serviceKey() {
  const k = env('SUPABASE_SERVICE_ROLE_KEY');
  if (k) return k;
  try { const j = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}'); return j.default || Object.values(j)[0] || ''; } catch (_) { return ''; }
}
async function api(path, init, token) {
  const key = serviceKey(), auth = token || (key.startsWith('eyJ') ? key : '');
  const r = await fetch(env('SUPABASE_URL') + path, Object.assign({}, init, {
    headers: Object.assign({ apikey: key, 'Content-Type': 'application/json' }, auth ? { Authorization: 'Bearer ' + auth } : {}, init && init.headers)
  }));
  const t = await r.text();
  let b = null; try { b = t ? JSON.parse(t) : null; } catch (_) { b = t; }
  if (!r.ok) { const e = new Error((b && (b.msg || b.message || b.error_description || b.error)) || 'Erreur ' + r.status); e.status = r.status; throw e; }
  return b;
}
function frMessage(m) {
  if (/sending|smtp|not authorized|rate limit/i.test(m)) return 'L’e-mail n’a pas pu partir : l’envoi d’e-mails (SMTP) n’est pas encore configuré dans Supabase, ou la limite d’envoi est atteinte. Utilise un mot de passe provisoire en attendant.';
  if (/already.*(registered|exists)/i.test(m)) return 'Un compte existe déjà avec cet email.';
  if (/password/i.test(m) && /(weak|short|least|characters)/i.test(m)) return 'Mot de passe trop faible (8 caractères minimum).';
  if (/email/i.test(m) && /invalid/i.test(m)) return 'Adresse email invalide.';
  if (/not.?found/i.test(m)) return 'Compte introuvable.';
  return m;
}

// Toute erreur imprévue revient en clair (avec les en-têtes CORS), sinon le navigateur n'affiche que « injoignable »
export async function handle(req) {
  try { return await run(req); }
  catch (e) { return json({ error: 'Erreur de la fonction admin : ' + String(e && e.message || e) }, 500); }
}

async function run(req) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!env('SUPABASE_URL') || !serviceKey()) return json({ error: 'La fonction ne trouve pas la clé service de Supabase (SUPABASE_SERVICE_ROLE_KEY).' }, 500);
  if (req.method !== 'POST') return json({ error: 'Méthode non permise' }, 405);
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  // Qui appelle ? (jeton de session de l'utilisateur connecté)
  let me;
  try { me = await api('/auth/v1/user', { method: 'GET' }, token); } catch (_) { return json({ error: 'Session expirée : reconnecte-toi.' }, 401); }
  let prof;
  try { prof = await api('/rest/v1/profiles?select=role&id=eq.' + me.id, { method: 'GET' }); }
  catch (e) { return json({ error: 'Lecture du profil impossible (' + String(e.message || e) + '). As-tu lancé le script SQL de l’étape 2 ?' }, 500); }
  if (!prof || !prof[0] || prof[0].role !== 'admin') return json({ error: 'Réservé à l’administrateur : ton compte n’a pas le rôle admin dans la table profiles.' }, 403);

  let body = {};
  try { body = await req.json(); } catch (_) {}
  try {
    if (body.action === 'create') {
      const email = String(body.email || '').trim().toLowerCase(), password = String(body.password || '');
      const redirect = /^https:\/\//.test(body.redirectTo || '') ? body.redirectTo : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Adresse email invalide.' }, 400);
      let u;
      if (body.invite) {
        // invitation : la personne reçoit un e-mail et choisit elle-même son mot de passe
        u = await api('/auth/v1/invite' + (redirect ? '?redirect_to=' + encodeURIComponent(redirect) : ''), { method: 'POST', body: JSON.stringify({ email }) });
      } else {
        if (password.length < 8) return json({ error: 'Mot de passe trop court (8 caractères minimum).' }, 400);
        u = await api('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) });
      }
      const id = u.id || (u.user && u.user.id);
      if (body.role === 'athlete' || body.role === 'coach') {
        await api('/rest/v1/profiles', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ id, role: body.role, name: String(body.name || '').trim().slice(0, 40) }) });
      }
      if (body.linkMe && body.role !== 'coach') {
        await api('/rest/v1/coach_links', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify({ coach_id: me.id, athlete_id: id }) });
      }
      return json({ id, email, invited: !!body.invite });
    }
    if (body.action === 'recover') {
      // e-mail de réinitialisation du mot de passe
      if (!UUID.test(body.id || '')) return json({ error: 'Compte inconnu.' }, 400);
      const redirect = /^https:\/\//.test(body.redirectTo || '') ? body.redirectTo : '';
      const u = await api('/auth/v1/admin/users/' + body.id, { method: 'GET' });
      if (!u || !u.email) return json({ error: 'Compte introuvable.' }, 400);
      await api('/auth/v1/recover' + (redirect ? '?redirect_to=' + encodeURIComponent(redirect) : ''), { method: 'POST', body: JSON.stringify({ email: u.email }) });
      return json({ ok: true, email: u.email });
    }
    if (body.action === 'password') {
      if (!UUID.test(body.id || '')) return json({ error: 'Compte inconnu.' }, 400);
      if (body.id === me.id) return json({ error: 'Change ton propre mot de passe depuis Paramètres → Compte.' }, 400);
      if (String(body.password || '').length < 8) return json({ error: 'Mot de passe trop court (8 caractères minimum).' }, 400);
      await api('/auth/v1/admin/users/' + body.id, { method: 'PUT', body: JSON.stringify({ password: String(body.password) }) });
      return json({ ok: true });
    }
    if (body.action === 'delete') {
      if (!UUID.test(body.id || '')) return json({ error: 'Compte inconnu.' }, 400);
      if (body.id === me.id) return json({ error: 'Tu ne peux pas supprimer ton propre compte administrateur.' }, 400);
      await api('/auth/v1/admin/users/' + body.id, { method: 'DELETE' });
      return json({ ok: true });
    }
    return json({ error: 'Action inconnue.' }, 400);
  } catch (e) {
    return json({ error: frMessage(String(e && e.message || e)) }, 400);
  }
}

Deno.serve(handle);
