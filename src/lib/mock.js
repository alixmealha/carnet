// Faux Supabase pour les tests (build avec VITE_MOCK=1) : base en localStorage, règles d'accès imitées
// sur celles du script SQL (profils et rôles, liens par code, verrou du plan, droits du coach, administration).
const LS = 'mock-db';
const U = n => 'aaaaaaaa-0000-4000-8000-00000000000' + n;
function seed() {
  return {
    users: [
      { id: U(1), email: 'alix@test.fr', password: 'test', created_at: '2026-09-01T10:00:00Z' },
      { id: U(2), email: 'athlete@test.fr', password: 'test', created_at: '2026-09-02T10:00:00Z' },
      { id: U(3), email: 'autre@test.fr', password: 'test', created_at: '2026-09-03T10:00:00Z' },
      { id: U(4), email: 'coach@test.fr', password: 'test', created_at: '2026-09-04T10:00:00Z' }
    ],
    profiles: [{ id: U(1), name: '', role: 'admin', onboarded: false }],
    docs: [], coach_links: [{ coach_id: U(1), athlete_id: U(2), plan_locked: false }], push_subs: [], invite_codes: [],
    session: null, clock: 0
  };
}
function load() {
  try { const d = JSON.parse(localStorage.getItem(LS)); if (d && d.users) return d; } catch (_) {}
  return seed();
}
function save(d) { localStorage.setItem(LS, JSON.stringify(d)); }
const now = d => { d.clock = Math.max(Date.now(), (d.clock || 0) + 1); return new Date(d.clock).toISOString(); };
const RLS = t => ({ data: null, error: { code: '42501', message: 'new row violates row-level security policy for table "' + t + '"' } });
const ERR = m => ({ data: null, error: { code: 'P0001', message: m } });
const PLANID = id => id === 'plan' || id.startsWith('p:');
const COACHW = id => id === 'plan' || id === 'tests' || /^[pct]:/.test(id);

export function createMock() {
  const listeners = new Set();
  const sess = () => load().session;
  const me = () => { const s = sess(); return s && s.user.id; };
  const roleOf = (db, id) => { const p = db.profiles.find(x => x.id === id); return p ? p.role : null; };
  const isAdmin = db => roleOf(db, me()) === 'admin';
  const isCoachOf = (db, a) => db.coach_links.some(l => l.coach_id === me() && l.athlete_id === a);
  const isMyCoach = (db, c) => db.coach_links.some(l => l.coach_id === c && l.athlete_id === me());
  const locked = (db, a) => db.coach_links.some(l => l.athlete_id === a && l.plan_locked);
  const canSee = (db, table, r) => {
    const m = me();
    if (table === 'docs') return r.user_id === m || isCoachOf(db, r.user_id);
    if (table === 'coach_links') return r.coach_id === m || r.athlete_id === m;
    if (table === 'profiles') return r.id === m || isAdmin(db) || isCoachOf(db, r.id) || isMyCoach(db, r.id);
    if (table === 'invite_codes') return r.athlete_id === m;
    return r.user_id === m;
  };
  // Droit d'écrire une ligne de docs (insert = nouvelle ligne, sinon modification)
  const canWriteDoc = (db, r, exists) => {
    const m = me();
    if (r.user_id === m) return !(PLANID(r.id) && locked(db, m));
    if (!isCoachOf(db, r.user_id)) return false;
    return COACHW(r.id) || (!exists && r.id.startsWith('j:'));
  };
  const KEY = { docs: r => x => x.user_id === r.user_id && x.id === r.id, push_subs: r => x => x.endpoint === r.endpoint, profiles: r => x => x.id === r.id, invite_codes: r => x => x.code === r.code };

  function query(table) {
    const st = { filters: [], order: null, range: null, op: 'select', rows: null, patch: null, ret: false };
    const api = {
      select() { if (st.op !== 'select') st.ret = true; return api; },
      gt(c, v) { st.filters.push(r => r[c] > v); return api; },
      eq(c, v) { st.filters.push(r => r[c] === v); return api; },
      in(c, vs) { st.filters.push(r => vs.includes(r[c])); return api; },
      order(c, o) { st.order = [c, o && o.ascending === false ? -1 : 1]; return api; },
      range(a, b) { st.range = [a, b]; return api; },
      upsert(rows) { st.op = 'upsert'; st.rows = [].concat(rows); return api; },
      insert(rows) { st.op = 'insert'; st.rows = [].concat(rows); return api; },
      update(patch) { st.op = 'update'; st.patch = patch; return api; },
      delete() { st.op = 'delete'; return api; },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); }
    };
    function run() {
      const db = load(), m = me();
      if (!m) return { data: null, error: { message: 'JWT expired' } };
      if (!db[table]) return { data: null, error: { message: "Could not find the table 'public." + table + "' in the schema cache" } };
      if (st.op === 'upsert' || st.op === 'insert') {
        const out = [];
        for (const r0 of st.rows) {
          const r = Object.assign({}, r0);
          if (table === 'push_subs') r.user_id = m;
          if (table === 'invite_codes') { r.athlete_id = m; if (!['athlete', 'admin'].includes(roleOf(db, m)) || String(r.code).length < 8) return RLS(table); r.created_at = now(db); r.expires_at = new Date(Date.now() + 7 * 864e5).toISOString(); }
          if (table === 'coach_links') return RLS(table);
          if (table === 'profiles') { if (r.id !== m || !['athlete', 'coach'].includes(r.role)) return RLS(table); }
          const i = db[table].findIndex(KEY[table](r));
          if (i >= 0 && st.op === 'insert') return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
          if (table === 'docs' && !canWriteDoc(db, r, i >= 0)) return RLS(table);
          const row = Object.assign({}, i >= 0 ? db[table][i] : {}, r, table === 'docs' ? { synced_at: now(db) } : {});
          if (i >= 0) db[table][i] = row; else db[table].push(row);
          out.push(row);
        }
        save(db); return { data: st.ret ? JSON.parse(JSON.stringify(out)) : null, error: null };
      }
      let rows = db[table].filter(r => canSee(db, table, r)).filter(r => st.filters.every(f => f(r)));
      if (st.op === 'update') {
        const p = st.patch;
        if (table === 'profiles') { if ('role' in p || 'id' in p) return { data: null, error: { code: '42501', message: 'permission denied for table profiles' } }; rows = rows.filter(r => r.id === m); }
        if (table === 'coach_links') { if (Object.keys(p).some(k => k !== 'plan_locked')) return { data: null, error: { code: '42501', message: 'permission denied for table coach_links' } }; rows = rows.filter(r => r.coach_id === m); }
        if (table === 'docs') { for (const r of rows) if (!canWriteDoc(db, Object.assign({}, r, p), true)) return RLS(table); }
        for (const r of rows) Object.assign(r, p, table === 'profiles' ? { updated_at: now(db) } : {}, table === 'docs' ? { synced_at: now(db) } : {});
        save(db); return { data: st.ret ? JSON.parse(JSON.stringify(rows)) : null, error: null };
      }
      if (st.op === 'delete') {
        if (table === 'profiles') return { data: null, error: { code: '42501', message: 'permission denied for table profiles' } };
        if (table === 'docs') rows = rows.filter(r => r.user_id === m && !(PLANID(r.id) && locked(db, m)));
        db[table] = db[table].filter(r => !rows.includes(r)); save(db); return { data: null, error: null };
      }
      if (st.order) { const [c, s] = st.order; rows.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * s); }
      if (st.range) rows = rows.slice(st.range[0], st.range[1] + 1);
      return { data: JSON.parse(JSON.stringify(rows)), error: null };
    }
    return api;
  }

  async function rpc(name, args) {
    const db = load(), m = me();
    if (!m) return { data: null, error: { message: 'JWT expired' } };
    if (name === 'redeem_code') {
      if (!['coach', 'admin'].includes(roleOf(db, m))) return ERR('Seul un compte coach peut ajouter un athlète.');
      const c = String(args.c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const r = db.invite_codes.find(x => x.code === c && Date.parse(x.expires_at) > Date.now());
      if (!r) return ERR('Code invalide ou expiré.');
      if (r.athlete_id === m) return ERR('C’est ton propre code.');
      if (!db.coach_links.some(l => l.coach_id === m && l.athlete_id === r.athlete_id)) db.coach_links.push({ coach_id: m, athlete_id: r.athlete_id, plan_locked: false });
      db.invite_codes = db.invite_codes.filter(x => x !== r); save(db);
      return { data: { athlete_id: r.athlete_id }, error: null };
    }
    if (!isAdmin(db)) return ERR('Réservé à l’administrateur.');
    if (name === 'admin_users') return { data: db.users.map(u => { const p = db.profiles.find(x => x.id === u.id) || {}; return { id: u.id, email: u.email, name: p.name || '', role: p.role || 'athlete', onboarded: !!p.onboarded, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at || null, athletes: db.coach_links.filter(l => l.coach_id === u.id).length, coaches: db.coach_links.filter(l => l.athlete_id === u.id).length }; }), error: null };
    if (name === 'admin_set_role') {
      if (args.uid === m && args.r !== 'admin') return ERR('Tu ne peux pas retirer ton propre rôle d’administrateur.');
      const p = db.profiles.find(x => x.id === args.uid); if (p) p.role = args.r; else db.profiles.push({ id: args.uid, name: '', role: args.r, onboarded: false });
      if (args.r === 'athlete') db.coach_links = db.coach_links.filter(l => l.coach_id !== args.uid);
      if (args.r === 'coach') db.coach_links = db.coach_links.filter(l => l.athlete_id !== args.uid);
      save(db); return { data: null, error: null };
    }
    if (name === 'admin_link') {
      db.coach_links = db.coach_links.filter(l => !(l.coach_id === args.coach && l.athlete_id === args.athlete));
      if (args.linked) db.coach_links.push({ coach_id: args.coach, athlete_id: args.athlete, plan_locked: false });
      save(db); return { data: null, error: null };
    }
    return ERR('fonction inconnue');
  }

  async function invoke(fn, { body }) {
    const db = load(), m = me();
    const fail = (status, error) => ({ data: null, error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({ error }) } } });
    if (fn !== 'admin') return fail(404, 'Function not found');
    if (!isAdmin(db)) return fail(403, 'Réservé à l’administrateur.');
    if (body.action === 'create') {
      const email = String(body.email || '').trim().toLowerCase();
      if (db.users.some(u => u.email === email)) return fail(400, 'Un compte existe déjà avec cet email.');
      if (String(body.password || '').length < 8) return fail(400, 'Mot de passe trop court (8 caractères minimum).');
      const id = 'bbbbbbbb-0000-4000-8000-' + String(Date.now()).slice(-12).padStart(12, '0');
      db.users.push({ id, email, password: body.password, created_at: new Date().toISOString() });
      if (body.role === 'athlete' || body.role === 'coach') db.profiles.push({ id, name: body.name || '', role: body.role, onboarded: false });
      if (body.linkMe && body.role !== 'coach') db.coach_links.push({ coach_id: m, athlete_id: id, plan_locked: false });
      save(db); return { data: { id, email }, error: null };
    }
    const u = db.users.find(x => x.id === body.id);
    if (!u) return fail(400, 'Compte introuvable.');
    if (body.action === 'password') { if (u.id === m) return fail(400, 'Change ton propre mot de passe depuis Paramètres → Compte.'); u.password = body.password; save(db); return { data: { ok: true }, error: null }; }
    if (body.action === 'delete') {
      if (u.id === m) return fail(400, 'Tu ne peux pas supprimer ton propre compte administrateur.');
      db.users = db.users.filter(x => x !== u); db.profiles = db.profiles.filter(x => x.id !== u.id); db.docs = db.docs.filter(x => x.user_id !== u.id);
      db.coach_links = db.coach_links.filter(l => l.coach_id !== u.id && l.athlete_id !== u.id); save(db); return { data: { ok: true }, error: null };
    }
    return fail(400, 'Action inconnue.');
  }

  const emit = (ev, s) => { for (const f of listeners) f(ev, s); };
  return {
    from: query,
    rpc,
    functions: { invoke },
    auth: {
      async getSession() { return { data: { session: sess() } }; },
      onAuthStateChange(f) { listeners.add(f); return { data: { subscription: { unsubscribe: () => listeners.delete(f) } } }; },
      async signInWithPassword({ email, password }) {
        const db = load(), u = db.users.find(x => x.email === email && x.password === password);
        if (!u) return { data: null, error: { message: 'Invalid login credentials' } };
        u.last_sign_in_at = new Date().toISOString();
        db.session = { access_token: 'mock', user: { id: u.id, email: u.email } }; save(db);
        emit('SIGNED_IN', db.session); return { data: { session: db.session }, error: null };
      },
      async signOut() { const db = load(); db.session = null; save(db); emit('SIGNED_OUT', null); return { error: null }; },
      async updateUser({ password }) { const db = load(), u = db.users.find(x => x.id === me()); if (u && password) u.password = password; save(db); return { data: {}, error: null }; }
    }
  };
}
