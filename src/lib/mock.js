// Faux Supabase pour les tests (build avec VITE_MOCK=1) : base en localStorage, règles d'accès imitées.
const LS = 'mock-db';
const USERS = [
  { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'alix@test.fr', password: 'test' },
  { id: 'aaaaaaaa-0000-4000-8000-000000000002', email: 'athlete@test.fr', password: 'test' },
  { id: 'aaaaaaaa-0000-4000-8000-000000000003', email: 'autre@test.fr', password: 'test' }
];
function load() {
  try { const d = JSON.parse(localStorage.getItem(LS)); if (d) return d; } catch (_) {}
  return { docs: [], coach_links: [{ coach_id: USERS[0].id, athlete_id: USERS[1].id }], push_subs: [], session: null, clock: 0 };
}
function save(d) { localStorage.setItem(LS, JSON.stringify(d)); }
const now = d => { d.clock = Math.max(Date.now(), (d.clock || 0) + 1); return new Date(d.clock).toISOString(); };

export function createMock() {
  const listeners = new Set();
  const sess = () => load().session;
  const me = () => { const s = sess(); return s && s.user.id; };
  const isCoachOf = (db, a) => db.coach_links.some(l => l.coach_id === me() && l.athlete_id === a);
  const canSee = (db, table, row) => table === 'docs' ? (row.user_id === me() || isCoachOf(db, row.user_id))
    : table === 'coach_links' ? (row.coach_id === me() || row.athlete_id === me()) : row.user_id === me();
  function query(table) {
    const st = { filters: [], order: null, range: null, op: 'select', rows: null, del: false };
    const api = {
      select() { return api; },
      gt(c, v) { st.filters.push(r => r[c] > v); return api; },
      eq(c, v) { st.filters.push(r => r[c] === v); return api; },
      in(c, vs) { st.filters.push(r => vs.includes(r[c])); return api; },
      order(c, o) { st.order = [c, o && o.ascending === false ? -1 : 1]; return api; },
      range(a, b) { st.range = [a, b]; return api; },
      upsert(rows) { st.op = 'upsert'; st.rows = Array.isArray(rows) ? rows : [rows]; return api; },
      delete() { st.op = 'delete'; return api; },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); }
    };
    function run() {
      const db = load();
      if (!me()) return { data: null, error: { message: 'JWT expired' } };
      if (st.op === 'upsert') {
        for (const r of st.rows) {
          if (table === 'docs' && !(r.user_id === me() || isCoachOf(db, r.user_id))) return { data: null, error: { message: 'new row violates row-level security policy for table "docs"' } };
          if (table === 'push_subs') r.user_id = me();
        }
        for (const r of st.rows) {
          const key = table === 'docs' ? x => x.user_id === r.user_id && x.id === r.id : x => x.endpoint === r.endpoint;
          const i = db[table].findIndex(key);
          const row = Object.assign({}, i >= 0 ? db[table][i] : {}, r, table === 'docs' ? { synced_at: now(db) } : {});
          if (i >= 0) db[table][i] = row; else db[table].push(row);
        }
        save(db); return { data: null, error: null };
      }
      let rows = db[table].filter(r => canSee(db, table, r)).filter(r => st.filters.every(f => f(r)));
      if (st.op === 'delete') { db[table] = db[table].filter(r => !rows.includes(r)); save(db); return { data: null, error: null }; }
      if (st.order) { const [c, s] = st.order; rows.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * s); }
      if (st.range) rows = rows.slice(st.range[0], st.range[1] + 1);
      return { data: JSON.parse(JSON.stringify(rows)), error: null };
    }
    return api;
  }
  const emit = (ev, s) => { for (const f of listeners) f(ev, s); };
  return {
    from: query,
    auth: {
      async getSession() { return { data: { session: sess() } }; },
      onAuthStateChange(f) { listeners.add(f); return { data: { subscription: { unsubscribe: () => listeners.delete(f) } } }; },
      async signInWithPassword({ email, password }) {
        const u = USERS.find(x => x.email === email && x.password === password);
        if (!u) return { data: null, error: { message: 'Invalid login credentials' } };
        const db = load(); db.session = { access_token: 'mock', user: { id: u.id, email: u.email } }; save(db);
        emit('SIGNED_IN', db.session); return { data: { session: db.session }, error: null };
      },
      async signOut() { const db = load(); db.session = null; save(db); emit('SIGNED_OUT', null); return { error: null }; },
      async updateUser({ password }) { const u = USERS.find(x => x.id === me()); if (u && password) u.password = password; return { data: {}, error: null }; }
    }
  };
}
