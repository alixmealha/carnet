(() => {
  var __defProp = Object.defineProperty;
  var __export = (target2, all) => {
    for (var name in all)
      __defProp(target2, name, { get: all[name], enumerable: true });
  };

  // <define:import.meta.env>
  var define_import_meta_env_default = { BASE_URL: "/" };

  // ios/core/store-shim.js
  var store_shim_exports = {};
  __export(store_shim_exports, {
    SELF: () => SELF,
    canEditPlan: () => canEditPlan,
    core: () => core,
    exportAll: () => exportAll,
    get: () => get,
    getFor: () => getFor,
    getSubject: () => getSubject,
    hasCarnet: () => hasCarnet,
    ids: () => ids,
    idsFor: () => idsFor,
    initStore: () => initStore,
    isAdmin: () => isAdmin,
    isCoach: () => isCoach,
    isSelf: () => isSelf,
    jget: () => jget,
    jgetFor: () => jgetFor,
    jset: () => jset,
    links: () => links,
    metaFor: () => metaFor,
    myProfile: () => myProfile,
    myRow: () => myRow,
    nameOf: () => nameOf,
    planLocked: () => planLocked,
    profileOf: () => profileOf,
    put: () => put,
    putFor: () => putFor,
    putMany: () => putMany,
    remove: () => remove,
    removeAllMine: () => removeAllMine,
    role: () => role,
    saveMyProfile: () => saveMyProfile,
    saveProfileDoc: () => saveProfileDoc,
    schedule: () => schedule,
    setSettings: () => setSettings,
    setSubject: () => setSubject,
    settings: () => settings,
    startAutoSync: () => startAutoSync,
    subjectSettings: () => subjectSettings,
    subscribe: () => subscribe,
    syncNow: () => syncNow,
    syncState: () => syncState,
    useStore: () => useStore,
    wipeLocal: () => wipeLocal
  });
  var SELF = "self";
  var docs = /* @__PURE__ */ new Map();
  var subject = SELF;
  var links = { athletes: [], coaches: [], me: null, email: null, profiles: {}, locks: {}, myLock: false };
  var syncState = { state: "idle", last: null, error: null, pending: 0, rejected: 0, rejectedAt: 0 };
  var K = (o, id) => o + "|" + id;
  var native = () => globalThis.__native || { put() {
  }, remove() {
  } };
  var core = {
    load(map) {
      docs.clear();
      for (const k of Object.keys(map)) docs.set(k, map[k]);
    },
    set(key, data) {
      if (data == null) docs.delete(key);
      else docs.set(key, data);
    },
    setSubject(o) {
      subject = o || SELF;
    },
    setLinks(l) {
      Object.assign(links, l || {});
    },
    size: () => docs.size
  };
  function subscribe() {
    return () => {
    };
  }
  function useStore() {
    return 0;
  }
  var getSubject = () => subject;
  var isSelf = () => subject === SELF;
  function setSubject(o) {
    if (o === links.me) o = SELF;
    subject = o || SELF;
    native().setSubject && native().setSubject(subject);
  }
  function getFor(o, id) {
    return docs.get(K(o, id));
  }
  function metaFor(o, id) {
    const d = docs.get(K(o, id));
    return d === void 0 ? void 0 : { data: d };
  }
  function idsFor(o, prefix) {
    const out = [], pre = K(o, prefix);
    for (const k of docs.keys()) if (k.startsWith(pre)) out.push(k.slice(o.length + 1));
    return out.sort();
  }
  var get = (id) => getFor(subject, id);
  var ids = (prefix) => idsFor(subject, prefix);
  function putFor(o, id, data) {
    docs.set(K(o, id), data);
    native().put(o, id, JSON.stringify(data));
  }
  var put = (id, data) => putFor(subject, id, data);
  function putMany(map, owner) {
    const o = owner || subject;
    for (const [id, data] of Object.entries(map)) putFor(o, id, data);
  }
  function remove(id, owner) {
    const o = owner || subject;
    docs.delete(K(o, id));
    native().remove(o, id);
  }
  function removeAllMine() {
    for (const k of [...docs.keys()]) if (k.startsWith(SELF + "|")) remove(k.slice(SELF.length + 1), SELF);
  }
  function exportAll(owner) {
    const o = owner || subject, out = {};
    for (const [k, d] of docs) {
      const i = k.indexOf("|");
      if (k.slice(0, i) === o && d != null) out[k.slice(i + 1)] = d;
    }
    return { app: "alipto", v: 1, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), docs: out };
  }
  async function wipeLocal() {
  }
  function schedule() {
  }
  async function syncNow() {
    native().sync && native().sync();
  }
  function startAutoSync() {
  }
  async function initStore() {
  }
  var settings = () => Object.assign({ sound: true, voice: true, wake: true }, getFor(SELF, "settings") || {});
  var setSettings = (patch) => putFor(SELF, "settings", Object.assign({}, getFor(SELF, "settings") || {}, patch));
  var uidOf = (o) => o === SELF ? links.me : o;
  var myRow = () => links.me ? links.profiles[links.me] || null : null;
  function role() {
    const r = myRow();
    return r ? r.role : "athlete";
  }
  var isAdmin = () => role() === "admin";
  var isCoach = () => role() === "coach";
  var hasCarnet = () => role() !== "coach";
  var planLocked = () => subject === SELF && !!links.myLock;
  var canEditPlan = () => !planLocked();
  function profileOf(o) {
    const doc = getFor(o, "profile") || {}, row = links.profiles[uidOf(o)];
    const p = Object.assign({}, doc);
    if (row) {
      for (const k of ["name", "role", "sex", "birth_year", "height_cm", "weight_kg", "onboarded"]) if (row[k] != null && row[k] !== "") p[k] = row[k];
    }
    if (p.birth_year) p.under18 = (/* @__PURE__ */ new Date()).getFullYear() - p.birth_year < 18;
    return p;
  }
  var myProfile = () => profileOf(SELF);
  var nameOf = (o) => profileOf(o).name || (o === SELF ? "Moi" : "Athl\xE8te");
  var subjectSettings = () => Object.assign({ cycle: profileOf(subject).sex === "F" }, get("settings") || {});
  var DOCKEYS = ["sports", "diet", "nutri", "levels"];
  function saveProfileDoc(patch) {
    const p = {};
    for (const k of DOCKEYS) if (k in patch) p[k] = patch[k];
    if (Object.keys(p).length) putFor(SELF, "profile", Object.assign({}, getFor(SELF, "profile") || {}, p));
  }
  async function saveMyProfile(patch) {
    native().saveProfile && native().saveProfile(JSON.stringify(patch));
    saveProfileDoc(patch);
  }
  var jget = (k) => get("j:" + k) || {};
  var jgetFor = (o, k) => getFor(o, "j:" + k) || {};
  function jset(k, patch) {
    if (subject !== SELF) return;
    const cur = jget(k), next = Object.assign({}, cur, patch);
    for (const key of Object.keys(next)) if (next[key] === void 0 || next[key] === null) delete next[key];
    put("j:" + k, next);
  }

  // src/lib/dates.js
  var dates_exports = {};
  __export(dates_exports, {
    DOW_1: () => DOW_1,
    DOW_3: () => DOW_3,
    DOW_L: () => DOW_L,
    MON_L: () => MON_L,
    MON_S: () => MON_S,
    addDays: () => addDays,
    diffDays: () => diffDays,
    dom: () => dom,
    dow: () => dow,
    fmtDay: () => fmtDay,
    fmtLong: () => fmtLong,
    fmtNum: () => fmtNum,
    fmtRange: () => fmtRange,
    fmtShort: () => fmtShort,
    fromUtc: () => fromUtc,
    keyOf: () => keyOf,
    mmss: () => mmss,
    mon: () => mon,
    mondayOf: () => mondayOf,
    pad: () => pad,
    r05: () => r05,
    rangeKeys: () => rangeKeys,
    todayKey: () => todayKey,
    utc: () => utc
  });
  var pad = (n) => String(n).padStart(2, "0");
  var MON_S = ["janv.", "f\xE9vr.", "mars", "avr.", "mai", "juin", "juil.", "ao\xFBt", "sept.", "oct.", "nov.", "d\xE9c."];
  var MON_L = ["janvier", "f\xE9vrier", "mars", "avril", "mai", "juin", "juillet", "ao\xFBt", "septembre", "octobre", "novembre", "d\xE9cembre"];
  var DOW_L = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  var DOW_3 = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  var DOW_1 = ["L", "M", "M", "J", "V", "S", "D"];
  var keyOf = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  var todayKey = () => keyOf(/* @__PURE__ */ new Date());
  var utc = (k) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
  var fromUtc = (t) => new Date(t).toISOString().slice(0, 10);
  var addDays = (k, n) => fromUtc(utc(k) + n * 864e5);
  var diffDays = (a, b) => Math.round((utc(b) - utc(a)) / 864e5);
  var dow = (k) => (new Date(utc(k)).getUTCDay() + 6) % 7;
  var dom = (k) => +k.slice(8, 10);
  var mon = (k) => +k.slice(5, 7) - 1;
  var fmtDay = (k) => (dom(k) === 1 ? "1er" : dom(k)) + " " + MON_S[mon(k)];
  var fmtLong = (k) => DOW_L[dow(k)] + " " + (dom(k) === 1 ? "1er" : dom(k)) + " " + MON_L[mon(k)];
  var fmtShort = (k) => DOW_3[dow(k)] + " " + fmtDay(k);
  var fmtRange = (a, b) => a === b ? fmtDay(a) : mon(a) === mon(b) ? (dom(a) === 1 ? "1er" : dom(a)) + "\u2013" + fmtDay(b) : fmtDay(a) + " \u2013 " + fmtDay(b);
  var mondayOf = (k) => addDays(k, -dow(k));
  var rangeKeys = (a, b) => {
    const out = [];
    for (let k = a; k <= b; k = addDays(k, 1)) out.push(k);
    return out;
  };
  var fmtNum = (n) => String(n).replace(".", ",");
  var r05 = (x) => Math.round(x * 2) / 2;
  var mmss = (s) => {
    s = Math.max(0, Math.round(s));
    const m = Math.floor(s / 60);
    return m + ":" + pad(s % 60);
  };

  // src/lib/plan.js
  var plan_exports = {};
  __export(plan_exports, {
    KIND: () => KIND,
    KIND_LIST: () => KIND_LIST,
    KIND_ORDER: () => KIND_ORDER,
    PHASE_LABEL: () => PHASE_LABEL,
    PHASE_Z: () => PHASE_Z,
    SKIP: () => SKIP,
    addWeeks: () => addWeeks,
    allItems: () => allItems,
    allKeys: () => allKeys,
    apartNote: () => apartNote,
    apartOf: () => apartOf,
    blockState: () => blockState,
    blocks: () => blocks,
    cancelSession: () => cancelSession,
    clone: () => clone,
    copyDay: () => copyDay,
    copyWeek: () => copyWeek,
    day: () => day,
    demoOf: () => demoOf,
    doneN: () => doneN,
    eventOn: () => eventOn,
    exerciseNames: () => exerciseNames,
    fingerCalc: () => fingerCalc,
    isRestDay: () => isRestDay,
    isTestDay: () => isTestDay,
    itemKey: () => itemKey,
    itemLoad: () => itemLoad,
    kinds: () => kinds,
    latestTest: () => latestTest,
    meta: () => meta,
    moveBlock: () => moveBlock,
    newPlan: () => newPlan,
    nextEvent: () => nextEvent,
    okUrl: () => okUrl,
    phaseOf: () => phaseOf,
    progress: () => progress,
    rawBlocks: () => rawBlocks,
    removeLastWeek: () => removeLastWeek,
    renameExercise: () => renameExercise,
    restoreSession: () => restoreSession,
    saveDay: () => saveDay,
    savePlan: () => savePlan,
    sessionName: () => sessionName,
    sessionsOf: () => sessionsOf,
    setApart: () => setApart,
    setBlockState: () => setBlockState,
    setDemo: () => setDemo,
    setDoneCount: () => setDoneCount,
    setLoadsOf: () => setLoadsOf,
    setWeek: () => setWeek,
    setsText: () => setsText,
    skipLabel: () => skipLabel,
    stamp: () => stamp,
    target: () => target,
    testIdsOf: () => testIdsOf,
    uid: () => uid,
    unmoveBlock: () => unmoveBlock,
    weekKeys: () => weekKeys,
    weekLabel: () => weekLabel,
    weekOf: () => weekOf,
    workLoad: () => workLoad
  });

  // ios/core/supa-shim.js
  var cloud = true;

  // src/lib/tests.js
  var tests_exports = {};
  __export(tests_exports, {
    CATALOG: () => CATALOG,
    CATS: () => CATS,
    allTests: () => allTests,
    bodyWeightAt: () => bodyWeightAt,
    customTests: () => customTests,
    deleteCustomTest: () => deleteCustomTest,
    history: () => history,
    lastResult: () => lastResult,
    logWeight: () => logWeight,
    pct: () => pct,
    relValue: () => relValue,
    resultsOn: () => resultsOn,
    saveCustomTest: () => saveCustomTest,
    saveResults: () => saveResults,
    testById: () => testById,
    testDays: () => testDays,
    valueKeys: () => valueKeys
  });
  var CATS = [
    ["doigts", "Doigts"],
    ["tirage", "Tirage"],
    ["poussee", "Pouss\xE9e"],
    ["force", "Force (muscu)"],
    ["gainage", "Gainage"],
    ["puissance", "Puissance"],
    ["epaule", "\xC9paule"],
    ["mobilite", "Mobilit\xE9"],
    ["aerobie", "A\xE9robie"],
    ["corps", "Mesures"],
    ["perso", "Mes tests"]
  ];
  var M = (k, l, unit, better) => ({ k, l, unit, better: better || "up" });
  var V = (unit) => [M("v", "R\xE9sultat", unit)];
  var CATALOG = [
    {
      id: "fmax-semi",
      cat: "doigts",
      name: "Force max semi-arqu\xE9e 20 mm",
      sides: true,
      measures: V("kg"),
      rel: true,
      equip: "R\xE9glette de 20 mm, dynamom\xE8tre (ou baudrier et charges pour la version suspension).",
      proto: ["\xC9chauffement doigts progressif : 3 tractions de 10 s \xE0 50, 70 et 85 % de l\u2019effort.", "Une main, prise semi-arqu\xE9e, bras tendu, \xE9paule engag\xE9e.", "Tirer au maximum pendant 10 s, garder le pic (ou la charge tenue 10 s).", "2 essais par main, 3 min entre essais, 5 min entre les mains. Garder le meilleur."],
      tips: "M\xEAme r\xE9glette, m\xEAme position et m\xEAme heure \xE0 chaque passation. La valeur rapport\xE9e au poids de corps est la plus parlante.",
      src: ["michailov2018", "balas2012"]
    },
    {
      id: "fmax-tendu",
      cat: "doigts",
      name: "Force max tendu 3 doigts 20 mm",
      sides: true,
      measures: V("kg"),
      rel: true,
      equip: "R\xE9glette de 20 mm, dynamom\xE8tre ou charges.",
      proto: ["M\xEAme protocole que la semi-arqu\xE9e, prise tendue \xE0 3 doigts (index, majeur, annulaire).", "2 essais par main, 3 min entre essais, 5 min entre les mains."],
      tips: "\xC0 faire apr\xE8s la semi-arqu\xE9e, dans le m\xEAme ordre \xE0 chaque passation.",
      src: ["michailov2018"]
    },
    {
      id: "fl-semi",
      cat: "doigts",
      name: "Finger lift max \xB7 semi-arqu\xE9",
      sides: false,
      measures: V("kg"),
      equip: "Bloc de finger lift (ou r\xE9glette de 20 mm), chargeur et disques.",
      proto: ["\xC9chauffement progressif sur le bloc : 3 lev\xE9es de 7 s en montant la charge.", "Prise semi-arqu\xE9e, une main, soulever 7 s sans \xE0-coup.", "Monter par paliers de 2,5 \xE0 5 kg, 3 min entre les essais, jusqu\u2019\xE0 l\u2019\xE9chec.", "Noter la charge la plus lourde tenue 7 s."],
      tips: "Le finger lift sert de r\xE9f\xE9rence pour calculer les charges en % des blocs suivants.",
      src: ["michailov2018"]
    },
    {
      id: "fl-tendu",
      cat: "doigts",
      name: "Finger lift max \xB7 tendu",
      sides: false,
      measures: V("kg"),
      equip: "Bloc de finger lift, chargeur et disques.",
      proto: ["M\xEAme protocole que le semi-arqu\xE9, prise tendue.", "Noter la charge la plus lourde tenue 7 s."],
      src: ["michailov2018"]
    },
    {
      id: "cf",
      cat: "doigts",
      name: "Force critique (7 s / 3 s)",
      sides: true,
      measures: [M("cf", "Force critique", "kg"), M("pic", "Pic", "kg")],
      rel: true,
      equip: "R\xE9glette de 20 mm et dynamom\xE8tre avec enregistrement.",
      proto: ["\xC9chauffement complet des doigts.", "24 tractions de 7 s \xE0 effort maximal, 3 s de repos entre chaque (4 min au total), une main.", "Force critique = moyenne des 6 derni\xE8res tractions ; pic = meilleure traction."],
      tips: "Test le plus fatigant : toujours en dernier.",
      src: ["giles2019"]
    },
    {
      id: "repeaters",
      cat: "doigts",
      name: "R\xE9p\xE9titeurs 7 s / 3 s \xE0 l\u2019\xE9chec",
      sides: false,
      measures: V("r\xE9p."),
      equip: "Poutre ou r\xE9glette de 20 mm.",
      proto: ["Deux mains, semi-arqu\xE9e, poids de corps.", "Suspensions de 7 s, 3 s de repos, jusqu\u2019\xE0 l\u2019\xE9chec.", "Noter le nombre de suspensions compl\xE8tes."],
      src: ["balas2012"]
    },
    {
      id: "pinch",
      cat: "doigts",
      name: "Pince (pinch)",
      sides: true,
      measures: V("kg"),
      rel: true,
      equip: "Bloc de pince et charges, ou dynamom\xE8tre de pince.",
      proto: ["Pince de largeur fixe, bras tendu.", "Tenir 7 s \xE0 la charge maximale (ou pic sur 5 s au dynamom\xE8tre).", "2 essais par main, 3 min de repos."]
    },
    {
      id: "pull-1rm",
      cat: "tirage",
      name: "Traction 1RM (lest)",
      sides: false,
      measures: V("kg"),
      rel: "lest",
      equip: "Barre, baudrier ou ceinture de lest (ou sac \xE0 dos pes\xE9).",
      proto: ["\xC9chauffement : 2 s\xE9ries au poids de corps puis 2 \xE0 3 mont\xE9es en charge.", "Prise pronation, d\xE9part bras tendus, menton au-dessus de la barre, sans \xE9lan.", "Paliers de 2,5 kg, 3 \xE0 4 min de repos, 4 \xE0 5 tentatives au maximum.", "Noter le lest de la meilleure r\xE9p\xE9tition (0 = poids de corps)."],
      tips: "En % du poids de corps : (poids + lest) \xF7 poids."
    },
    {
      id: "pull-5rm",
      cat: "tirage",
      name: "Traction 5RM (lest)",
      sides: false,
      measures: V("kg"),
      rel: "lest",
      equip: "Barre et lest pes\xE9.",
      proto: ["M\xEAme \xE9chauffement que le 1RM.", "Charge la plus lourde pour 5 r\xE9p\xE9titions strictes.", "1RM estim\xE9 \u2248 (poids + lest) \xD7 1,167."]
    },
    {
      id: "pull-max",
      cat: "tirage",
      name: "Max tractions strictes",
      sides: false,
      measures: V("r\xE9p."),
      equip: "Barre de traction.",
      proto: ["Prise pronation, amplitude compl\xE8te.", "La s\xE9rie s\u2019arr\xEAte \xE0 la derni\xE8re r\xE9p\xE9tition stricte (sans kipping ni demi-amplitude)."]
    },
    {
      id: "lock-90",
      cat: "tirage",
      name: "Blocage 1 bras \xE0 90\xB0",
      sides: true,
      measures: V("s"),
      equip: "Barre, sangle pour l\u2019autre main si besoin, chrono.",
      proto: ["Se hisser, coude \xE0 90\xB0, l\xE2cher l\u2019autre main.", "Tenir le plus longtemps possible.", "2 essais par bras, 3 min de repos."]
    },
    {
      id: "power-slap",
      cat: "tirage",
      name: "Power slap",
      sides: false,
      measures: V("cm"),
      equip: "Pan inclin\xE9 ou barre, ruban gradu\xE9 vertical.",
      proto: ["D\xE9part suspendu bras tendus sur deux prises.", "Tirage explosif et lancer d\u2019une main le plus haut possible le long du ruban.", "3 essais, 2 min de repos, garder le meilleur."],
      src: ["laffaye2014"]
    },
    {
      id: "dips-1rm",
      cat: "poussee",
      name: "Dips 1RM (lest)",
      sides: false,
      measures: V("kg"),
      rel: "lest",
      equip: "Barres parall\xE8les, lest.",
      proto: ["\xC9chauffement progressif.", "Descente jusqu\u2019\xE0 \xE9paule sous le coude, remont\xE9e compl\xE8te.", "Paliers de 2,5 kg, 3 \xE0 4 min de repos."]
    },
    {
      id: "dips-max",
      cat: "poussee",
      name: "Max dips",
      sides: false,
      measures: V("r\xE9p."),
      equip: "Barres parall\xE8les (\xE9lastique d\u2019assistance not\xE9 si utilis\xE9).",
      proto: ["Amplitude compl\xE8te, rythme r\xE9gulier.", "Arr\xEAt \xE0 la derni\xE8re r\xE9p\xE9tition compl\xE8te.", "Noter l\u2019\xE9lastique \xE9ventuel dans la note."]
    },
    {
      id: "pushups",
      cat: "poussee",
      name: "Max pompes",
      sides: false,
      measures: V("r\xE9p."),
      proto: ["Corps gain\xE9, poitrine \xE0 un poing du sol.", "Arr\xEAt quand le gainage ou l\u2019amplitude se d\xE9grade."]
    },
    {
      id: "squat-1rm",
      cat: "force",
      name: "Squat 1RM",
      sides: false,
      measures: V("kg"),
      rel: true,
      equip: "Barre, rack avec s\xE9curit\xE9s, disques.",
      proto: ["\xC9chauffement : 2 s\xE9ries l\xE9g\xE8res puis mont\xE9es en charge (5, 3, 2, 1 r\xE9p\xE9titions).", "Descente au moins cuisses parall\xE8les, remont\xE9e compl\xE8te, sans rebond.", "Paliers de 2,5 \xE0 5 kg, 3 \xE0 5 min de repos, 3 \xE0 5 tentatives au maximum.", "Ou plus prudent : 3 \xE0 5 r\xE9p\xE9titions maximales, 1RM estim\xE9 = charge \xD7 (1 + r\xE9p. \xF7 30)."],
      tips: "Toujours avec s\xE9curit\xE9s ou pareur. L\u2019estimation sur 3 \xE0 5 r\xE9p\xE9titions suffit pour r\xE9gler les charges du programme."
    },
    {
      id: "bench-1rm",
      cat: "force",
      name: "D\xE9velopp\xE9 couch\xE9 1RM",
      sides: false,
      measures: V("kg"),
      rel: true,
      equip: "Banc, barre, s\xE9curit\xE9s ou pareur.",
      proto: ["M\xEAme \xE9chauffement progressif que le squat.", "Barre touch\xE9e \xE0 la poitrine sans rebond, fesses sur le banc.", "Paliers de 1 \xE0 2,5 kg, 3 \xE0 5 min de repos.", "Ou 3 \xE0 5 r\xE9p\xE9titions maximales : 1RM estim\xE9 = charge \xD7 (1 + r\xE9p. \xF7 30)."]
    },
    {
      id: "deadlift-1rm",
      cat: "force",
      name: "Soulev\xE9 de terre 1RM",
      sides: false,
      measures: V("kg"),
      rel: true,
      equip: "Barre et disques.",
      proto: ["\xC9chauffement progressif.", "Dos neutre du d\xE9but \xE0 la fin, barre pr\xE8s du corps, verrouillage hanches et genoux en haut.", "Paliers de 5 kg puis 2,5 kg, 3 \xE0 5 min de repos.", "Ou 3 \xE0 5 r\xE9p\xE9titions maximales : 1RM estim\xE9 = charge \xD7 (1 + r\xE9p. \xF7 30)."]
    },
    {
      id: "plank-side",
      cat: "gainage",
      name: "Gainage lat\xE9ral",
      sides: true,
      measures: V("s"),
      proto: ["Sur l\u2019avant-bras, jambes tendues, corps align\xE9.", "Arr\xEAt d\xE8s que le bassin s\u2019affaisse.", "1 essai par c\xF4t\xE9, 2 min de repos."]
    },
    {
      id: "plank-arms",
      cat: "gainage",
      name: "Gainage bras tendus",
      sides: false,
      measures: V("s"),
      proto: ["Planche sur les mains, bras tendus.", "Arr\xEAt d\xE8s que le bassin bouge ou que le dos se creuse."]
    },
    {
      id: "lever",
      cat: "gainage",
      name: "Lev\xE9e de jambes suspendu",
      sides: false,
      measures: V("r\xE9p."),
      proto: ["Suspendu \xE0 la barre, jambes tendues jusqu\u2019\xE0 la barre ou \xE0 l\u2019horizontale (\xE0 pr\xE9ciser).", "Sans balancement."]
    },
    {
      id: "cmj",
      cat: "puissance",
      name: "CMJ (saut contre-mouvement)",
      sides: false,
      measures: V("cm"),
      equip: "Tapis de saut, appli vid\xE9o (type My Jump) ou cellules.",
      proto: ["Mains aux hanches, descente rapide puis saut vertical maximal.", "R\xE9ception sur les deux pieds, genoux dans l\u2019axe.", "3 essais, 30 s de repos, garder le meilleur (ou la moyenne)."],
      tips: "Filmer de face pour v\xE9rifier l\u2019axe des genoux \xE0 la r\xE9ception.",
      src: ["claudino2017"]
    },
    {
      id: "dyno-h",
      cat: "puissance",
      name: "Dyno horizontal max",
      sides: false,
      measures: V("cm"),
      equip: "Pan, prises de d\xE9part et d\u2019arriv\xE9e standardis\xE9es, m\xE8tre.",
      proto: ["D\xE9part et prises toujours identiques.", "Jet\xE9 lat\xE9ral, distance entre prise de d\xE9part et prise attrap\xE9e.", "3 essais, 2 min de repos."]
    },
    {
      id: "ir-90",
      cat: "epaule",
      name: "Rotation interne \xE0 90\xB0",
      sides: true,
      measures: V("kg"),
      equip: "Dynamom\xE8tre (ou peson) et sangle.",
      proto: ["Bras \xE0 90\xB0 d\u2019abduction, coude \xE0 90\xB0.", "Pouss\xE9e maximale de 5 s vers la rotation interne.", "3 essais par c\xF4t\xE9, 30 s de repos, garder le meilleur."],
      src: ["byram2010"]
    },
    {
      id: "er-90",
      cat: "epaule",
      name: "Rotation externe \xE0 90\xB0",
      sides: true,
      measures: V("kg"),
      equip: "Dynamom\xE8tre (ou peson) et sangle.",
      proto: ["M\xEAme position que la rotation interne.", "Pouss\xE9e maximale de 5 s vers la rotation externe.", "3 essais par c\xF4t\xE9, garder le meilleur."],
      tips: "Le rapport RE/RI se calcule tout seul quand les deux tests sont faits le m\xEAme jour.",
      src: ["byram2010"]
    },
    {
      id: "wall-test",
      cat: "mobilite",
      name: "Wall test cheville (genou-mur)",
      sides: true,
      measures: V("cm"),
      equip: "Mur, m\xE8tre ruban au sol.",
      proto: ["Pied face au mur, talon au sol, genou qui vient toucher le mur.", "Reculer le pied jusqu\u2019\xE0 la distance maximale o\xF9 le genou touche sans d\xE9coller le talon.", "Mesurer la distance orteil-mur."],
      src: ["bennell1998"]
    },
    {
      id: "shoulder-flex",
      cat: "mobilite",
      name: "Flexion d\u2019\xE9paule dos au mur",
      sides: true,
      measures: V("\xB0"),
      proto: ["Dos et lombaires plaqu\xE9s au mur, bras tendus.", "Monter les bras le plus haut possible sans d\xE9coller les lombaires.", "Mesurer l\u2019angle (appli inclinom\xE8tre) ou noter 180\xB0 si le pouce touche le mur."]
    },
    {
      id: "hip-ri",
      cat: "mobilite",
      name: "Rotation interne de hanche \xE0 90\xB0",
      sides: true,
      measures: V("\xB0"),
      proto: ["Assis ou sur le dos, hanche et genou \xE0 90\xB0.", "Rotation interne passive maximale, mesurer l\u2019angle.", "Noter toute g\xEAne \xE0 l\u2019aine."]
    },
    {
      id: "hip-re",
      cat: "mobilite",
      name: "Rotation externe de hanche \xE0 90\xB0",
      sides: true,
      measures: V("\xB0"),
      proto: ["M\xEAme position, rotation externe passive maximale."]
    },
    {
      id: "sit-reach",
      cat: "mobilite",
      name: "Sit and reach (souplesse post\xE9rieure)",
      sides: false,
      measures: V("cm"),
      equip: "Une marche ou une bo\xEEte, un m\xE8tre ruban.",
      proto: ["\xC9chauffement l\xE9ger, assis jambes tendues, plante des pieds contre la marche.", "Mains l\u2019une sur l\u2019autre, aller le plus loin possible en 2 s, sans \xE0-coup, genoux tendus.", "Mesurer le bout des doigts par rapport aux orteils : positif au-del\xE0, n\xE9gatif avant.", "3 essais, garder le meilleur."],
      src: ["acsm2021"]
    },
    {
      id: "slr",
      cat: "mobilite",
      name: "\xC9l\xE9vation jambe tendue (ischio-jambiers)",
      sides: true,
      measures: V("\xB0"),
      equip: "Un partenaire, le t\xE9l\xE9phone en inclinom\xE8tre.",
      proto: ["Sur le dos, l\u2019autre jambe \xE0 plat au sol, bassin qui ne bouge pas.", "Le partenaire l\xE8ve la jambe tendue, cheville rel\xE2ch\xE9e, jusqu\u2019\xE0 la tension franche.", "T\xE9l\xE9phone pos\xE9 sur le tibia : angle de la jambe avec le sol."]
    },
    {
      id: "thomas",
      cat: "mobilite",
      name: "Test de Thomas modifi\xE9 (fl\xE9chisseurs de hanche)",
      sides: true,
      measures: [M("v", "Angle de la cuisse", "\xB0", "down")],
      equip: "Une table ou un banc haut, le t\xE9l\xE9phone en inclinom\xE8tre.",
      proto: ["Assis au bord de la table, s\u2019allonger en ramenant un genou contre la poitrine (bas du dos plaqu\xE9).", "L\u2019autre jambe pend librement.", "T\xE9l\xE9phone sur la cuisse qui pend : angle avec l\u2019horizontale. Positif = cuisse au-dessus de l\u2019horizontale (fl\xE9chisseurs raides)."],
      tips: "Plus l\u2019angle est bas, mieux c\u2019est ; une cuisse sous l\u2019horizontale est normale.",
      src: ["harvey1998"]
    },
    {
      id: "shoulder-er",
      cat: "mobilite",
      name: "Rotation externe d\u2019\xE9paule \xE0 90\xB0",
      sides: true,
      measures: V("\xB0"),
      equip: "Le t\xE9l\xE9phone en inclinom\xE8tre.",
      proto: ["Sur le dos, bras \xE9cart\xE9 \xE0 90\xB0, coude pli\xE9 \xE0 90\xB0.", "Laisser la main partir vers l\u2019arri\xE8re en rotation externe, sans cambrer.", "T\xE9l\xE9phone sur l\u2019avant-bras : \xAB Remettre \xE0 z\xE9ro \xBB avant-bras vertical, puis mesurer en fin de rotation."]
    },
    {
      id: "frog",
      cat: "mobilite",
      name: "Grenouille au mur (ouverture de hanche)",
      sides: false,
      measures: [M("v", "Distance bassin-mur", "cm", "down")],
      equip: "Un mur, un m\xE8tre ruban.",
      proto: ["Face au mur, pieds au mur, talons joints, genoux ouverts sur les c\xF4t\xE9s, comme en escalade.", "Rapprocher le bassin du mur le plus possible, buste droit.", "Mesurer la distance entre le pubis et le mur."],
      tips: "Le test de l\u2019ouverture de hanche utile pour rester pr\xE8s du mur en grimpe."
    },
    {
      id: "foot-raise",
      cat: "mobilite",
      name: "Mont\xE9e de pied (high step)",
      sides: true,
      measures: [M("v", "Hauteur du pied", "cm")],
      equip: "Un mur, un m\xE8tre ruban (ou des marques au mur).",
      proto: ["Face au mur, pieds au sol, mains au mur \xE0 hauteur d\u2019\xE9paules.", "Monter un pied le plus haut possible le long du mur, sans d\xE9coller l\u2019autre talon.", "Mesurer la hauteur de la pointe du pied."],
      tips: "Rapport\xE9 \xE0 ta taille, c\u2019est le meilleur indicateur de souplesse utile en grimpe.",
      src: ["draper2009"]
    },
    {
      id: "leg-span",
      cat: "mobilite",
      name: "\xC9cart lat\xE9ral (leg span)",
      sides: false,
      measures: [M("v", "\xC9cart entre les pieds", "cm")],
      equip: "Un mur, un m\xE8tre ruban au sol.",
      proto: ["Dos au mur, jambes tendues \xE9cart\xE9es sur les c\xF4t\xE9s.", "\xC9carter le plus possible sans douleur, talons au sol.", "Mesurer la distance entre les deux talons."],
      src: ["draper2009"]
    },
    {
      id: "vma",
      cat: "aerobie",
      name: "VMA palier 1 min (tapis)",
      sides: false,
      measures: V("km/h"),
      equip: "Tapis de course.",
      proto: ["\xC9chauffement 10 min.", "D\xE9part \xE0 8 km/h, +1 km/h chaque minute.", "VMA = vitesse du dernier palier complet (+ fraction du palier entam\xE9)."]
    },
    {
      id: "run-5k",
      cat: "aerobie",
      name: "5 km chrono",
      sides: false,
      measures: [M("v", "Temps", "min", "down")],
      equip: "Piste, parcours plat mesur\xE9 ou montre GPS.",
      proto: ["\xC9chauffement 10 \xE0 15 min avec quelques acc\xE9l\xE9rations.", "5 km le plus vite possible, allure r\xE9guli\xE8re.", "Temps en minutes d\xE9cimales : 22 min 30 s = 22,5."]
    },
    {
      id: "cooper",
      cat: "aerobie",
      name: "Test de Cooper (12 min)",
      sides: false,
      measures: V("m"),
      equip: "Piste de 400 m ou montre GPS.",
      proto: ["\xC9chauffement 10 min.", "Courir la plus grande distance possible en 12 min.", "VO2max estim\xE9e \u2248 (distance \u2212 504,9) \xF7 44,73 (Cooper, 1968)."]
    },
    {
      id: "cs",
      cat: "aerobie",
      name: "Vitesse critique (3 min + 12 min)",
      sides: false,
      measures: [M("d3", "Distance en 3 min", "m"), M("d12", "Distance en 12 min", "m")],
      equip: "Piste de 400 m ou montre GPS.",
      proto: ["\xC9chauffement 15 min avec quelques acc\xE9l\xE9rations.", "3 min \xE0 fond : la plus grande distance possible.", "Au moins 30 min de r\xE9cup\xE9ration (ou un autre jour).", "12 min \xE0 fond, allure r\xE9guli\xE8re.", "Vitesse critique = (distance 12 min \u2212 distance 3 min) \xF7 9 min ; D\u2032 = ce que tu peux courir au-dessus."],
      tips: "La vitesse critique s\xE9pare les efforts tenables longtemps de ceux qui \xE9puisent vite : c\u2019est la meilleure r\xE9f\xE9rence pour les s\xE9ances au seuil.",
      src: ["poole2016", "jones2017"],
      derive: (v) => {
        if (!(v.d3 > 0 && v.d12 > v.d3)) return null;
        const cs = (v.d12 - v.d3) / 540, dp = v.d3 - cs * 180;
        return "Vitesse critique " + (Math.round(cs * 36) / 10).toString().replace(".", ",") + " km/h \xB7 D\u2032 \u2248 " + Math.max(0, Math.round(dp / 5) * 5) + " m";
      }
    },
    {
      id: "vo2max",
      cat: "aerobie",
      name: "VO2max (montre ou laboratoire)",
      sides: false,
      measures: V("ml/kg/min"),
      proto: ["Valeur donn\xE9e par ta montre (Garmin, Polar, Coros\u2026) apr\xE8s plusieurs sorties, ou mesur\xE9e en laboratoire.", "\xC0 d\xE9faut, l\u2019appli l\u2019estime d\u2019apr\xE8s ta VMA (environ 3,5 \xD7 VMA)."],
      tips: "Les estimations des montres varient de quelques points : compare-la \xE0 elle-m\xEAme dans le temps."
    },
    {
      id: "ftp",
      cat: "aerobie",
      name: "FTP v\xE9lo (20 min)",
      sides: false,
      measures: [M("p20", "Puissance moyenne sur 20 min", "W")],
      equip: "V\xE9lo avec capteur de puissance ou home-trainer connect\xE9.",
      proto: ["\xC9chauffement 20 min avec 3 acc\xE9l\xE9rations d\u20191 min.", "5 min \xE0 fond puis 10 min faciles (version compl\xE8te), ou directement :", "20 min le plus fort possible, puissance r\xE9guli\xE8re.", "FTP \u2248 95 % de la puissance moyenne des 20 min."],
      src: ["allen2010"],
      derive: (v) => v.p20 > 0 ? "FTP \u2248 " + Math.round(v.p20 * 0.95) + " W" : null
    },
    {
      id: "poids",
      cat: "corps",
      name: "Poids de corps",
      sides: false,
      measures: [M("v", "Poids", "kg", "none")],
      proto: ["Le matin, \xE0 jeun, apr\xE8s \xEAtre pass\xE9 aux toilettes.", "Sert \xE0 calculer les valeurs en % du poids de corps."]
    }
  ];
  var customTests = () => (get("tests") || {}).list || [];
  function allTests() {
    return CATALOG.concat(customTests().map((t) => Object.assign({ cat: "perso", measures: V(t.unit || "") }, t, { custom: true })));
  }
  var testById = (id) => allTests().find((t) => t.id === id);
  function saveCustomTest(t) {
    const list = customTests().filter((x) => x.id !== t.id);
    list.push(t);
    put("tests", { list });
  }
  function deleteCustomTest(id) {
    put("tests", { list: customTests().filter((x) => x.id !== id) });
  }
  function valueKeys(t) {
    const out = [];
    for (const m of t.measures) {
      if (t.sides) for (const [s, l] of [["D", "droite"], ["G", "gauche"]]) out.push({ key: m.k + "." + s, label: (t.measures.length > 1 ? m.l + " " : "") + l, unit: m.unit, better: m.better, side: s, m: m.k });
      else out.push({ key: m.k, label: t.measures.length > 1 || m.l !== "R\xE9sultat" ? m.l : "", unit: m.unit, better: m.better, m: m.k });
    }
    return out;
  }
  var testDays = () => ids("t:").map((id) => id.slice(2));
  var resultsOn = (k) => get("t:" + k) || {};
  function saveResults(k, patch) {
    const cur = resultsOn(k), res = Object.assign({}, cur.res);
    for (const [tid, vals] of Object.entries(patch.res || {})) {
      const clean = {};
      for (const [kk, v] of Object.entries(vals)) if (typeof v === "number" && !isNaN(v)) clean[kk] = v;
      if (Object.keys(clean).length) res[tid] = clean;
      else delete res[tid];
    }
    const next = Object.assign({}, cur, patch, { res });
    if (patch.bw === null) delete next.bw;
    if (next.note === void 0) delete next.note;
    if (!Object.keys(res).length && !next.note && typeof next.bw !== "number") {
      if (get("t:" + k)) remove("t:" + k);
      return;
    }
    if (JSON.stringify(next) === JSON.stringify(cur)) return;
    put("t:" + k, next);
  }
  function bodyWeightAt(k) {
    let best = null;
    for (const d of testDays()) {
      if (d > k) break;
      const r = resultsOn(d);
      if (typeof r.bw === "number") best = r.bw;
      else if (r.res && r.res.poids && typeof r.res.poids.v === "number") best = r.res.poids.v;
    }
    if (best === null) {
      const w = Number(profileOf(getSubject()).weight_kg);
      if (w > 0) best = w;
    }
    return best;
  }
  function history(tid) {
    const out = [];
    for (const d of testDays()) {
      const r = resultsOn(d);
      if (r.res && r.res[tid]) out.push({ k: d, vals: r.res[tid], bw: typeof r.bw === "number" ? r.bw : bodyWeightAt(d), note: r.note });
    }
    return out;
  }
  function lastResult(tid) {
    const h = history(tid);
    return h.length ? h[h.length - 1] : null;
  }
  var pct = (a, b) => typeof a === "number" && typeof b === "number" && b !== 0 ? (a - b) / Math.abs(b) * 100 : null;
  function relValue(t, v, bw) {
    if (!t.rel || typeof v !== "number" || !bw) return null;
    return t.rel === "lest" ? (bw + v) / bw * 100 : v / bw * 100;
  }
  function logWeight(w) {
    if (!(w > 0)) return;
    const k = todayKey(), cur = getFor(SELF, "t:" + k) || {}, res = Object.assign({}, cur.res);
    if (res.poids && res.poids.v === w) return;
    res.poids = { v: w };
    putFor(SELF, "t:" + k, Object.assign({}, cur, { res }));
  }

  // src/lib/plan.js
  var KIND = { grimpe: "Escalade", doigts: "Doigts", muscu: "Muscu", renfo: "Renfo", epaule: "\xC9paule", kine: "Kin\xE9", velo: "Cardio", course: "Course", sport: "Sport", test: "Test", compet: "Comp\xE9tition", affut: "Aff\xFBtage", recup: "R\xE9cup\xE9ration", autre: "Autre", rest: "Repos" };
  var KIND_ORDER = ["grimpe", "doigts", "muscu", "renfo", "epaule", "kine", "velo", "course", "sport", "test", "compet", "affut", "recup", "autre", "rest"];
  var meta = () => get("plan");
  var day = (k) => get("p:" + k) || null;
  var rawBlocks = (k) => {
    const d = day(k);
    return d && d.blocks ? d.blocks : [];
  };
  var _adjCache = /* @__PURE__ */ new Map();
  var blocks = (k) => {
    const bl = rawBlocks(k), a = jget(k).adj;
    if (!a || !a.items) return bl;
    const c = _adjCache.get(k);
    if (c && c.bl === bl && c.a === a) return c.out;
    const out = applyAdj(bl, a);
    _adjCache.set(k, { bl, a, out });
    return out;
  };
  function adjItem(it, n, note) {
    const c = Object.assign({}, it, { adj: { n0: it.n, note: note || null } });
    if (n == null || n === it.n) return c;
    c.n = n;
    const lead = String(it.n) + " ";
    if (typeof it.label === "string" && it.label.startsWith(lead)) c.label = n + " " + it.label.slice(lead.length);
    if (it.timer) c.timer = Object.assign({}, it.timer, it.timer.markEach === "rep" ? { reps: n } : it.timer.sets ? { sets: n } : {});
    if (Array.isArray(it.repsBySet)) c.repsBySet = it.repsBySet.slice(0, n);
    return c;
  }
  function applyAdj(bl, a) {
    const out = [];
    for (const b of bl) {
      const g = a.items["b:" + b.id];
      if (g && g.drop) continue;
      const items = [];
      for (const it of b.items || []) {
        const x = a.items[b.id + "." + it.id];
        if (x && x.drop) continue;
        if (g && b.timer && it.id !== "ech") {
          items.push(adjItem(it, g.n, null));
          continue;
        }
        items.push(x ? adjItem(it, x.n, x.note) : it);
      }
      if ((b.items || []).length && !items.length) continue;
      const nb = Object.assign({}, b, { items });
      if (g && b.timer && g.n != null) nb.timer = Object.assign({}, b.timer, { sets: g.n });
      out.push(nb);
    }
    return out;
  }
  var target = (k) => {
    const d = day(k);
    return d && d.target ? d.target : null;
  };
  var kinds = (k) => new Set(blocks(k).map((b) => b.kind));
  var isRestDay = (k) => blocks(k).every((b) => b.kind === "rest");
  function weekOf(k) {
    const m = meta();
    return m ? m.weeks.find((w) => k >= w.start && k <= w.end) || null : null;
  }
  function allKeys() {
    const m = meta();
    return m ? rangeKeys(m.start, m.end) : [];
  }
  function weekKeys(w) {
    return rangeKeys(w.start, w.end);
  }
  var itemKey = (b, it) => b.id + "." + it.id;
  function allItems(k) {
    const out = [];
    for (const b of blocks(k)) if (b.kind !== "rest") for (const it of b.items || []) out.push({ b, it, key: itemKey(b, it) });
    return out;
  }
  function doneN(e, key, n) {
    const v = e && e.done && e.done[key];
    return typeof v === "number" ? Math.min(n, Math.max(0, v)) : 0;
  }
  function progress(k, part) {
    const e = jget(k);
    let total = 0, done = 0, skipped = 0;
    for (const { b, it, key } of allItems(k)) {
      const st = blockState(e, b);
      if (part) {
        if (b.id !== part) continue;
      } else if (st === "apart" || st === "moved") continue;
      else if (st === "skip") {
        skipped++;
        continue;
      }
      const v = doneN(e, key, it.n);
      if (it.opt && !v) continue;
      total++;
      if (v >= it.n) done++;
    }
    return { total, done, skipped };
  }
  var SKIP = [["fatigue", "Fatigue"], ["malade", "Malade"], ["gene", "G\xEAne ou douleur"], ["temps", "Pas le temps"], ["materiel", "Pas le mat\xE9riel"], ["autre", "Autre raison"]];
  var skipLabel = (v) => (SKIP.find((x) => x[0] === v) || SKIP[SKIP.length - 1])[1];
  function cancelSession(k, r, note) {
    const e = jget(k), skip = Object.assign({}, e.skip), ids2 = [];
    for (const b of rawBlocks(k)) {
      if (b.kind === "rest" || blockState(e, b)) continue;
      skip[b.id] = r;
      ids2.push(b.id);
    }
    const started = progress(k).done > 0 || Object.values(e.done || {}).some((v) => v > 0);
    const patch = { skip, status: started ? "adaptee" : "sautee", cancel: { r, note: note || null, at: Date.now(), ids: ids2, started } };
    if (note && !e.note) patch.note = note;
    jset(k, patch);
  }
  function restoreSession(k) {
    const e = jget(k), c = e.cancel;
    if (!c) return;
    const skip = Object.assign({}, e.skip);
    for (const id of c.ids || []) if (skip[id] === c.r) delete skip[id];
    const patch = { skip: Object.keys(skip).length ? skip : null, cancel: null };
    if (e.status === (c.started ? "adaptee" : "sautee")) patch.status = null;
    if (c.note && e.note === c.note) patch.note = null;
    jset(k, patch);
  }
  function blockState(e, b) {
    if (!e || !b) return null;
    if (e.apart && e.apart[b.id]) return "apart";
    if (e.moved && e.moved[b.id]) return "moved";
    if (e.skip && e.skip[b.id]) return "skip";
    return null;
  }
  var without = (o, id) => {
    const x = Object.assign({}, o);
    delete x[id];
    return Object.keys(x).length ? x : null;
  };
  function setBlockState(k, b, state, val) {
    const e = jget(k), patch = { apart: without(e.apart, b.id), skip: without(e.skip, b.id) };
    if (state === "apart") patch.apart = Object.assign({}, e.apart, { [b.id]: Object.assign({ at: Date.now() }, e.apart && e.apart[b.id]) });
    if (state === "skip") patch.skip = Object.assign({}, e.skip, { [b.id]: val || "autre" });
    jset(k, patch);
  }
  var apartOf = (e, bid) => e && e.apart && e.apart[bid] || null;
  function setApart(k, bid, patch) {
    const e = jget(k), cur = apartOf(e, bid);
    if (!cur) return;
    jset(k, { apart: Object.assign({}, e.apart, { [bid]: Object.assign({}, cur, patch) }) });
  }
  function sessionsOf(e) {
    const out = [];
    if (e && typeof e.rpe === "number" && typeof e.duree === "number" && e.duree > 0) out.push({ rpe: e.rpe, duree: e.duree });
    for (const p of Object.values(e && e.apart || {})) if (p && typeof p.rpe === "number" && typeof p.duree === "number" && p.duree > 0) out.push({ rpe: p.rpe, duree: p.duree, apart: true });
    return out;
  }
  function apartNote(k, b) {
    const e = jget(k), p = apartOf(e, b.id);
    if (!p || !p.startedAt) return null;
    const real = blocks(k).filter((x) => x.kind !== "rest"), i = real.findIndex((x) => x.id === b.id);
    const others = real.map((x, j) => ({ x, j })).filter((o) => o.x.id !== b.id && !blockState(e, o.x));
    if (!others.length) return null;
    const plannedBefore = others.every((o) => o.j > i), plannedAfter = others.every((o) => o.j < i);
    const hm = (t) => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const gap = (ms) => {
      const m = Math.round(ms / 6e4);
      return m < 60 ? m + " min" : Math.floor(m / 60) + " h" + (m % 60 >= 10 ? " " + String(m % 60).padStart(2, "0") : "");
    };
    const pEnd = p.endedAt || p.startedAt;
    if (!e.startedAt) return { text: "Fait \xE0 " + hm(p.startedAt) + ", avant la s\xE9ance", changed: plannedAfter };
    if (pEnd <= e.startedAt) return { text: "Fait " + gap(e.startedAt - pEnd) + " avant la s\xE9ance", changed: plannedAfter };
    const mEnd = e.endedAt || e.startedAt;
    if (p.startedAt >= mEnd) return { text: "Fait " + gap(p.startedAt - mEnd) + " apr\xE8s la s\xE9ance", changed: plannedBefore };
    return { text: "Fait \xE0 " + hm(p.startedAt), changed: false };
  }
  function moveBlock(k, b, to) {
    const src2 = day(k) || { blocks: [] }, dst = day(to) || { blocks: [] };
    const srcReal = src2.blocks.filter((x) => x.kind !== "rest"), i = srcReal.findIndex((x) => x.id === b.id);
    const taken = new Set((dst.blocks || []).map((x) => x.id)), base = "mv" + k.slice(5, 7) + k.slice(8, 10);
    let id = base, n = 2;
    while (taken.has(id)) id = base + "-" + n++;
    const copy = JSON.parse(JSON.stringify(b));
    copy.id = id;
    copy.movedFrom = k;
    delete copy.heavy;
    const rest = (dst.blocks || []).filter((x) => x.kind === "rest"), real = (dst.blocks || []).filter((x) => x.kind !== "rest");
    const before = i === 0 && srcReal.length > 1;
    const nd = Object.assign({}, dst, { blocks: before ? [copy].concat(real) : real.concat([copy]) });
    if (rest.length && !real.length) nd.restBak = rest;
    put("p:" + to, nd);
    const e = jget(k);
    jset(k, { moved: Object.assign({}, e.moved, { [b.id]: { to, id } }), apart: without(e.apart, b.id), skip: without(e.skip, b.id) });
  }
  function unmoveBlock(k, b) {
    const e = jget(k), m = e.moved && e.moved[b.id];
    if (!m) return;
    const dst = day(m.to);
    if (dst) {
      const de = jget(m.to), started = Object.keys(de.done || {}).some((x) => x.startsWith(m.id + "."));
      if (!started) {
        const bl = dst.blocks.filter((x) => x.id !== m.id), nd = Object.assign({}, dst, { blocks: bl.length || !dst.restBak ? bl : dst.restBak });
        if (!bl.length) delete nd.restBak;
        put("p:" + m.to, nd);
      }
    }
    jset(k, { moved: without(e.moved, b.id) });
  }
  function phaseOf(w) {
    return w.phase || "volume";
  }
  var PHASE_LABEL = { volume: "Volume", reprise: "Reprise", force: "Force", puissance: "Puissance", specifique: "Sp\xE9cifique", affutage: "Aff\xFBtage", recup: "R\xE9cup\xE9ration", deload: "D\xE9charge", transition: "Transition", coupure: "Coupure", autre: "Cycle" };
  var PHASE_Z = { volume: "z1", reprise: "z1", force: "z2", puissance: "z3", specifique: "z3", affutage: "za", recup: "zr", deload: "zr", transition: "zr", coupure: "zr", autre: "z2" };
  var weekLabel = (w) => w ? w.label || "S" + w.n : "";
  function nextEvent(from) {
    const m = meta();
    if (!m) return null;
    const t = from || todayKey();
    const ev = (m.events || []).filter((e) => (e.end || e.date) >= t).sort((a, b) => a.date < b.date ? -1 : 1)[0];
    if (ev) return { date: ev.date, end: ev.end || ev.date, label: ev.label, lvl: ev.lvl };
    return m.goal && m.goal.date >= t ? { date: m.goal.date, end: m.goal.date, label: m.goal.label } : null;
  }
  var eventOn = (k) => {
    const m = meta();
    return m && (m.events || []).find((e) => k >= e.date && k <= (e.end || e.date)) || null;
  };
  function latestTest(k) {
    let best = null;
    for (const [tid, key] of [["fl-semi", "semi"], ["fl-tendu", "tendu"]]) {
      const h = history(tid).filter((x) => x.k < k && typeof x.vals.v === "number");
      if (h.length) {
        const x = h[h.length - 1];
        if (!best || x.k > best.key) best = { te: {}, key: x.k };
      }
    }
    if (best) {
      for (const [tid, key] of [["fl-semi", "semi"], ["fl-tendu", "tendu"]]) {
        const x = history(tid).find((y) => y.k === best.key);
        if (x) best.te[key] = x.vals.v;
      }
      return best;
    }
    const m = meta();
    if (!m) return null;
    const ts = (m.tests || []).filter((t) => t < k).sort();
    for (let i = ts.length - 1; i >= 0; i--) {
      const te = jget(ts[i]).tests;
      if (te && (te.semi || te.tendu)) return { te, key: ts[i] };
    }
    return null;
  }
  function testIdsOf(k) {
    const out = [];
    for (const b of blocks(k)) for (const t of b.tests || []) if (!out.includes(t)) out.push(t);
    const m = meta();
    if (!out.length && m && (m.tests || []).includes(k)) out.push("fl-semi", "fl-tendu");
    return out;
  }
  var isTestDay = (k) => testIdsOf(k).length > 0;
  function itemLoad(b, it, e) {
    const key = itemKey(b, it), own = e && e.loads && typeof e.loads[key] === "number" ? e.loads[key] : null;
    if (it.load == null && own == null) return null;
    const v = own != null ? own : it.load, u = it.unit_load || "kg";
    return { v, u, changed: it.load != null && own != null && own !== it.load, chosen: it.load == null && own != null, text: (u === "+kg" && v >= 0 ? "+" : "") + fmtNum(v) + " kg" };
  }
  function setLoadsOf(e, key) {
    const a = e && e.setLoads && e.setLoads[key];
    return Array.isArray(a) && a.length ? a : null;
  }
  function setDoneCount(k, b, it, val) {
    const e = jget(k), key = itemKey(b, it), cur = doneN(e, key, it.n);
    val = Math.max(0, Math.min(it.n, val));
    const done = Object.assign({}, e.done);
    if (val > 0) done[key] = val;
    else delete done[key];
    const patch = { done }, ld = itemLoad(b, it, e);
    if (ld || setLoadsOf(e, key)) {
      const sl = Object.assign({}, e.setLoads), arr = (sl[key] || []).slice(0, Math.min(cur, val));
      for (let i = arr.length; i < val; i++) arr[i] = ld ? ld.v : arr[arr.length - 1];
      if (arr.length && arr.every((x) => typeof x === "number")) sl[key] = arr;
      else delete sl[key];
      patch.setLoads = Object.keys(sl).length ? sl : null;
    }
    jset(k, patch);
  }
  function setsText(arr, u) {
    const g = [];
    for (const v of arr) {
      const l = g[g.length - 1];
      if (l && l.v === v) l.n++;
      else g.push({ v, n: 1 });
    }
    const f = (v) => (u === "+kg" && v >= 0 ? "+" : "") + fmtNum(v) + " kg";
    return g.length === 1 ? f(g[0].v) : g.map((x) => f(x.v) + (x.n > 1 ? " \xD7 " + x.n : "")).join(" \xB7 ");
  }
  function workLoad(arr) {
    const c = /* @__PURE__ */ new Map();
    for (const v of arr) c.set(v, (c.get(v) || 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  }
  function fingerCalc(b, k) {
    const f = b.finger;
    if (!f) return null;
    if (f.unit === "kg") return { text: fmtNum(f.load) + " kg" };
    const lt = latestTest(k);
    if (!lt) return { text: f.load + " % de ton max", hint: "Note ton test dans la fiche du jour du test pour voir les kilos ici." };
    const parts = [];
    if (lt.te.semi) parts.push("semi-arqu\xE9 " + fmtNum(r05(lt.te.semi * f.load / 100)) + " kg");
    if (lt.te.tendu) parts.push("tendu " + fmtNum(r05(lt.te.tendu * f.load / 100)) + " kg");
    let guard = null;
    if (f.guardRef) {
      const g = [];
      for (const [kk, l] of [["semi", "semi-arqu\xE9"], ["tendu", "tendu"]]) {
        const mx = lt.te[kk];
        if (mx && mx * 0.6 > f.guardRef * 1.3) g.push(l + " " + fmtNum(r05((f.guardRef + mx * 0.6) / 2)) + " kg");
      }
      if (g.length) guard = "Garde-fou : 60 % d\xE9passe ta charge de S6 de plus de 30 %. Cette semaine, mi-chemin : " + g.join(" \xB7 ") + ".";
    }
    return { text: f.load + " % \xB7 " + parts.join(" \xB7 "), hint: "D\u2019apr\xE8s ton test du " + fmtDay(lt.key), guard };
  }
  function sessionName(k) {
    const d = day(k);
    if (d && d.short) return d.short;
    const n = [];
    for (const b of blocks(k)) {
      if (b.kind === "rest") continue;
      const s = b.kind === "grimpe" ? b.title.replace("Escalade \xB7 ", "Grimpe ") : b.kind === "muscu" ? b.title.split(" \xB7 ")[0] : KIND[b.kind] || b.title;
      if (!n.includes(s)) n.push(s);
    }
    return n.length ? n.join(", ") : "Repos";
  }
  var KIND_LIST = KIND_ORDER;
  var clone = (x) => JSON.parse(JSON.stringify(x));
  var uid = (p) => (p || "x") + Math.random().toString(36).slice(2, 7);
  function newPlan() {
    const start = mondayOf(todayKey());
    const weeks = [];
    for (let i = 0; i < 12; i++) weeks.push({ id: uid("w"), n: i + 1, start: addDays(start, i * 7), end: addDays(start, i * 7 + 6), bloc: "Cycle 1", phase: "autre" });
    put("plan", { v: 1, title: "Mon plan", goal: null, start, end: weeks[weeks.length - 1].end, tests: [], weeks, blocs: [], sections: [] });
  }
  var stamp = () => cloud && links.me ? { uid: links.me, name: myProfile().name || "", at: Date.now() } : void 0;
  var dkey = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\[[a-z]+\]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  var okUrl = (u) => /^https:\/\/[^\s]+\.[^\s]+$/i.test(String(u || "").trim());
  function demoOf(it) {
    const m = meta(), d = m && m.demos;
    if (!d || !it) return null;
    return d[dkey(it.label)] || it.lib && d["lib:" + it.lib] || null;
  }
  function setDemo(label, url, lib) {
    const m = meta();
    if (!m) return;
    const demos = Object.assign({}, m.demos), k = dkey(label), u = String(url || "").trim();
    if (okUrl(u)) {
      demos[k] = u;
      if (lib) demos["lib:" + lib] = u;
    } else {
      delete demos[k];
      if (lib) delete demos["lib:" + lib];
    }
    savePlan(Object.assign({}, m, { demos }));
  }
  function savePlan(m) {
    const ws = m.weeks.slice().sort((a, b) => a.start < b.start ? -1 : 1);
    put("plan", Object.assign({}, m, { weeks: ws, start: ws.length ? ws[0].start : m.start, end: ws.length ? ws[ws.length - 1].end : m.end, edited: stamp() }));
  }
  function addWeeks(n, phase, bloc) {
    const m = clone(meta());
    const last = m.weeks[m.weeks.length - 1];
    let s = last ? addDays(last.end, 1) : mondayOf(todayKey()), num2 = last ? last.n + 1 : 1;
    for (let i = 0; i < n; i++) {
      const st = s;
      const en = addDays(mondayOf(st), 6);
      m.weeks.push({ id: uid("w"), n: num2++, start: st, end: en, bloc, phase });
      s = addDays(en, 1);
    }
    savePlan(m);
  }
  function removeLastWeek() {
    const m = clone(meta());
    const w = m.weeks.pop();
    if (!w) return;
    for (const k of weekKeys(w)) {
      if (day(k)) remove("p:" + k);
    }
    savePlan(m);
  }
  function setWeek(id, patch) {
    const m = clone(meta());
    const w = m.weeks.find((x) => x.id === id);
    Object.assign(w, patch);
    savePlan(m);
  }
  function saveDay(k, d) {
    if (!d || (!d.blocks || !d.blocks.length) && !d.target) remove("p:" + k);
    else put("p:" + k, Object.assign({}, d, { edited: stamp() }));
  }
  function copyDay(from, to) {
    const d = day(from);
    saveDay(to, d ? clone(d) : null);
  }
  function copyWeek(wFrom, wTo) {
    const a = weekKeys(wFrom), b = weekKeys(wTo);
    for (const k of b) {
      const src2 = a.find((x) => dowOf(x) === dowOf(k));
      copyDay(src2 || null, k);
    }
  }
  var dowOf = (k) => ((/* @__PURE__ */ new Date(k + "T12:00:00Z")).getUTCDay() + 6) % 7;
  function exerciseNames() {
    const map = /* @__PURE__ */ new Map();
    for (const id of ids("p:")) {
      const d = day(id.slice(2));
      if (!d) continue;
      for (const b of d.blocks || []) for (const it of b.items || []) {
        if (it.id === "ech" || b.kind === "kine" || b.kind === "rest") continue;
        const x = map.get(it.label) || { label: it.label, n: 0, kinds: /* @__PURE__ */ new Set(), first: id.slice(2), last: id.slice(2) };
        x.n++;
        x.kinds.add(b.kind);
        x.last = id.slice(2);
        map.set(it.label, x);
      }
    }
    return [...map.values()].sort((a, b) => b.n - a.n);
  }
  function renameExercise(from, to, onlyFuture) {
    const t = todayKey(), out = {};
    let n = 0;
    for (const id of ids("p:")) {
      const k = id.slice(2);
      if (onlyFuture && k < t) continue;
      const d = day(k);
      if (!d) continue;
      let ch = false;
      const c = clone(d);
      for (const b of c.blocks || []) for (const it of b.items || []) if (it.label === from) {
        it.label = to;
        ch = true;
        n++;
      }
      if (ch) out[id] = c;
    }
    if (n) putMany(out);
    return n;
  }

  // src/lib/rules.js
  var rules_exports = {};
  __export(rules_exports, {
    ADJ: () => ADJ,
    DEFAULT_BANDS: () => DEFAULT_BANDS,
    FLAGS: () => FLAGS,
    NMET: () => NMET,
    NSTAGE: () => NSTAGE,
    REPAS: () => REPAS,
    RPE: () => RPE,
    SIV: () => SIV,
    STATUS: () => STATUS,
    WELL: () => WELL,
    ZONES: () => ZONES,
    bands: () => bands,
    durLong: () => durLong,
    durShort: () => durShort,
    nightCompare: () => nightCompare,
    nightShort: () => nightShort,
    nightTotal: () => nightTotal,
    parseDur: () => parseDur,
    rng: () => rng,
    rpeCmp: () => rpeCmp,
    score: () => score,
    verdict: () => verdict,
    verdictColor: () => verdictColor,
    vfcAvg: () => vfcAvg,
    zoneOf: () => zoneOf
  });
  var WELL = [
    ["sommeil", "Sommeil", "tr\xE8s mauvais", "excellent"],
    ["fatigue", "Fatigue", "\xE9puis\xE9", "frais"],
    ["courbatures", "Courbatures", "tr\xE8s courbatur\xE9", "aucune"],
    ["stress", "Stress", "tr\xE8s stress\xE9", "d\xE9tendu"],
    ["humeur", "Humeur", "tr\xE8s basse", "excellente"]
  ];
  var FLAGS = [["doigts", "Doigts"], ["poignet", "Poignet"], ["coude", "Coude"], ["epaule", "\xC9paule"], ["dos", "Dos"], ["hanche", "Hanche / aine"], ["genou", "Genou"], ["cheville", "Cheville"], ["autre", "Autre"]];
  var REPAS = [["oui", "Oui"], ["partiel", "En partie"], ["non", "Non"]];
  var RPE = ["Repos", "Tr\xE8s tr\xE8s facile", "Facile", "Mod\xE9r\xE9", "Un peu dur", "Dur", "Dur", "Tr\xE8s dur", "Tr\xE8s dur", "Presque maximal", "Maximal"];
  var STATUS = [["faite", "Faite"], ["adaptee", "Adapt\xE9e"], ["sautee", "Saut\xE9e"]];
  var SIV = [["s", "Sp\xE9cificit\xE9", "proche de grimper en bloc \xE0 ton niveau ?"], ["i", "Intensit\xE9", "proche de ton max ?"], ["v", "Volume", "proche de ta plus grosse s\xE9ance ?"]];
  function score(e) {
    if (!e || !e.well) return null;
    let t = 0;
    for (const [k] of WELL) {
      const v = e.well[k];
      if (typeof v !== "number") return null;
      t += v;
    }
    return t;
  }
  var DEFAULT_BANDS = [
    [20, "En forme", "good", "S\xE9ance telle que pr\xE9vue. Bon jour pour un effort intense ou un test."],
    [15, "Correct", "ok", "S\xE9ance telle que pr\xE9vue."],
    [11, "Fatigu\xE9", "warn", "Garde la s\xE9ance mais all\xE8ge : environ un tiers de volume en moins, pas de nouveau record ni de palier de charge."],
    [0, "Tr\xE8s fatigu\xE9", "crit", "Version d\xE9charge : moiti\xE9 du volume, rien au maximum, ou repos actif. Si \xE7a dure plus de 2 jours, parles-en."]
  ];
  var bands = () => {
    const m = get("plan");
    return m && Array.isArray(m.wellBands) && m.wellBands.length ? m.wellBands : DEFAULT_BANDS;
  };
  function verdict(t) {
    const b = bands().find((x) => t >= x[0]) || bands()[bands().length - 1];
    return { lbl: b[1], cls: b[2], txt: b[3], min: b[0] };
  }
  var verdictColor = (cls) => cls === "good" ? "var(--good)" : cls === "warn" ? "var(--warn)" : cls === "crit" ? "var(--crit)" : "var(--muted)";
  var NSTAGE = [["profond", "Profond"], ["leger", "L\xE9ger"], ["rem", "Paradoxal"], ["eveil", "\xC9veill\xE9"]];
  var NMET = [["vfc", "VFC", "ms"], ["fcr", "FC repos", "bpm"], ["recup", "R\xE9cup", "%"]];
  function parseDur(raw) {
    const s = String(raw).trim().toLowerCase().replace(/\s+/g, "");
    if (!s) return null;
    let m = s.match(/^(\d{1,2})[h:.,](\d{0,2})(?:min|mn|m)?$/);
    if (m) return +m[1] * 60 + (m[2] ? +m[2] : 0);
    m = s.match(/^(\d{1,3})(?:min|mn|m)?$/);
    if (m) return +m[1];
    return NaN;
  }
  var durShort = (min) => {
    const h = Math.floor(min / 60), m = min % 60;
    return h ? h + "h" + pad(m) : m + "min";
  };
  var durLong = (min) => {
    const h = Math.floor(min / 60), m = min % 60;
    return h ? h + " h " + pad(m) : m + " min";
  };
  function nightTotal(e) {
    const n = e && e.nuit;
    if (!n) return null;
    const v = ["profond", "leger", "rem"].map((k) => n[k]).filter((x) => typeof x === "number");
    if (v.length >= 2) return v.reduce((a, b) => a + b, 0);
    return typeof n.total === "number" ? n.total : v.length ? v[0] : null;
  }
  function nightShort(k) {
    const e = jget(k), tot = nightTotal(e);
    if (tot !== null) return tot < 420;
    const s = e.well && e.well.sommeil;
    return typeof s === "number" ? s <= 2 : null;
  }
  function vfcAvg(k) {
    const vals = [];
    for (let j = 1; j <= 7; j++) {
      const e = jget(addDays(k, -j));
      if (e.nuit && typeof e.nuit.vfc === "number") vals.push(e.nuit.vfc);
    }
    return vals.length >= 3 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }
  function nightCompare(e) {
    const tot = nightTotal(e), s = e.well && e.well.sommeil;
    if (tot === null || typeof s !== "number") return null;
    if (s <= 2 && tot >= 450) return "Ressenti " + s + "/5 mais nuit longue : la fatigue vient peut-\xEAtre d\u2019ailleurs (stress, charge, qualit\xE9 du sommeil).";
    if (s >= 4 && tot < 360) return "Ressenti " + s + "/5 malgr\xE9 une nuit courte : la dette peut se faire sentir dans un ou deux jours.";
    return "Ressenti " + s + "/5 et mesure vont dans le m\xEAme sens.";
  }
  var ADJ = {
    vol: ["Plus facile que pr\xE9vu. Si \xE7a se r\xE9p\xE8te \xE0 la prochaine s\xE9ance volume, passe un tiers des blocs une cotation au-dessus.", "Plus dur que pr\xE9vu. Regarde ta nuit et ta forme du matin ; si \xE7a se r\xE9p\xE8te, n\u2019ajoute pas de blocs la semaine suivante."],
    easy: ["Plus facile que pr\xE9vu, sans gravit\xE9 pour ce type de s\xE9ance.", "Plus dur que pr\xE9vu pour une s\xE9ance qui doit rester facile : baisse les cotations ou la charge la prochaine fois."],
    hard: ["Plus facile que pr\xE9vu : prends des blocs plus durs la prochaine fois.", "Au-dessus de la cible : moins de blocs ou d\u2019essais la prochaine fois, surtout si les doigts tirent."],
    light: ["Sous la cible : aucun souci sur une s\xE9ance l\xE9g\xE8re.", "Trop dur pour une s\xE9ance l\xE9g\xE8re : l\xE8ve le pied, c\u2019est elle qui te fait r\xE9cup\xE9rer."],
    muscu: ["Plus facile que pr\xE9vu : v\xE9rifie le RIR des derni\xE8res s\xE9ries. S\u2019il te restait plus de 2 r\xE9p\xE9titions, la charge est trop l\xE9g\xE8re.", "Plus dur que pr\xE9vu : si le RIR vis\xE9 n\u2019est pas tenu, garde la m\xEAme charge la prochaine fois."],
    test: ["", ""]
  };
  var rng = (tg) => !tg || !tg.rpe ? "" : tg.rpe[0] === tg.rpe[1] ? String(tg.rpe[0]) : tg.rpe[0] + "\u2013" + tg.rpe[1];
  function rpeCmp(tg, rpe) {
    if (!tg || !tg.rpe || tg.fam === "test" || typeof rpe !== "number") return null;
    const adj = ADJ[tg.fam] || ADJ.easy;
    if (rpe < tg.rpe[0]) return { cls: "warn", text: "Sous la cible (" + rng(tg) + "). " + adj[0] };
    if (rpe > tg.rpe[1]) return { cls: "warn", text: "Au-dessus de la cible (" + rng(tg) + "). " + adj[1] };
    return { cls: "good", text: "Dans la cible (" + rng(tg) + ")." };
  }
  var zoneOf = (r) => r <= 4 ? 0 : r <= 6 ? 1 : 2;
  var ZONES = [["Facile", "z1", "0\u20134"], ["Mod\xE9r\xE9", "z2", "5\u20136"], ["Dur", "z3", "7\u201310"]];

  // src/lib/insights.js
  var insights_exports = {};
  __export(insights_exports, {
    dayInsights: () => dayInsights,
    dayLoad: () => dayLoad,
    hrvStatus: () => hrvStatus,
    loadRatio: () => loadRatio,
    monotony: () => monotony,
    sleepTarget: () => sleepTarget,
    weekInsights: () => weekInsights
  });
  var LV = { crit: 0, warn: 1, info: 2, good: 3 };
  var mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  var sd = (a) => {
    if (a.length < 2) return 0;
    const m = mean(a);
    return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));
  };
  var f1 = (x) => fmtNum(Math.round(x * 10) / 10);
  var range = (k, from, to) => {
    const out = [];
    for (let i = from; i <= to; i++) out.push(addDays(k, i));
    return out;
  };
  var sleepTarget = () => profileOf(getSubject()).under18 ? 480 : 420;
  var FL = Object.fromEntries(FLAGS);
  function dayLoad(k) {
    return sessionsOf(jget(k)).reduce((s, x) => s + x.rpe * x.duree, 0);
  }
  function loadRatio(k) {
    const d28 = range(k, -27, 0), loads = d28.map(dayLoad);
    const firstIdx = loads.findIndex((x) => x > 0);
    if (firstIdx < 0 || firstIdx > 7) return null;
    const acute = loads.slice(21).reduce((a, b) => a + b, 0), chronic = loads.reduce((a, b) => a + b, 0) / 4;
    return chronic > 0 ? { ratio: acute / chronic, acute, chronic } : null;
  }
  function monotony(k) {
    const l = range(k, -6, 0).map(dayLoad), tot = l.reduce((a, b) => a + b, 0);
    if (tot <= 0 || l.filter((x) => x > 0).length < 3) return null;
    const s = sd(l);
    return s > 0 ? { mono: mean(l) / s, strain: tot * mean(l) / s, total: tot } : null;
  }
  function vfcSeries(k, from, to) {
    return range(k, from, to).map((d) => jget(d).nuit).filter((n) => n && typeof n.vfc === "number" && n.vfc > 0).map((n) => Math.log(n.vfc));
  }
  function hrvStatus(k) {
    const base = vfcSeries(k, -60, -1), last7 = vfcSeries(k, -6, 0);
    if (base.length < 14 || last7.length < 3) return null;
    const m = mean(base), s = sd(base), a = mean(last7), swc = 0.5 * s;
    return { avg7: Math.exp(a), base: Math.exp(m), lo: Math.exp(m - swc), hi: Math.exp(m + swc), state: a < m - swc ? "low" : a > m + swc ? "high" : "normal" };
  }
  function painAdvice(zone, ks) {
    const climb = ks.has("grimpe") || ks.has("doigts") || ks.has("test") || ks.has("compet");
    const pull = ks.has("muscu") || ks.has("renfo") || climb;
    switch (zone) {
      case "doigts":
        return climb ? " Pas de charge maximale sur les doigts aujourd\u2019hui : ni suspensions max ni r\xE9glettes en arqu\xE9, grimpe sur grosses prises ou en technique. Une douleur sur le dos d\u2019une articulation de doigt, m\xEAme br\xE8ve : arr\xEAt du travail de doigts et avis m\xE9dical." : " Rien pour les doigts aujourd\u2019hui : rev\xE9rifie demain matin avant de grimper.";
      case "coude":
        return pull ? " R\xE9duis les tirages (tractions, rowing, blocages) et \xE9vite les pinces serr\xE9es." : "";
      case "epaule":
        return pull ? " \xC9vite les pouss\xE9es au-dessus de la t\xEAte, le d\xE9velopp\xE9 couch\xE9 lourd et les jet\xE9s ; garde un travail des rotateurs l\xE9ger." : "";
      case "poignet":
        return " \xC9vite les appuis paume \xE0 plat charg\xE9s (pompes, dips) et les prises invers\xE9es.";
      case "dos":
        return " \xC9vite les charges lourdes et les exercices qui la r\xE9veillent ; mobilit\xE9 douce.";
      case "hanche":
        return " Pas de drop-knee forc\xE9 ni d\u2019\xE9cart en force ; adapte le renfo des jambes.";
      case "genou":
        return " \xC9vite les r\xE9ceptions de haut et les crochets talon appuy\xE9s ; cardio seulement sans douleur.";
      case "cheville":
        return " D\xE9sescalade plut\xF4t que sauts, r\xE9ceptions contr\xF4l\xE9es.";
      default:
        return "";
    }
  }
  var WELL_TIPS = {
    fatigue: "Fatigue g\xE9n\xE9rale : priorise la qualit\xE9 et coupe le volume.",
    courbatures: "Courbatures marqu\xE9es : \xE9vite l\u2019excentrique lourd et les gros volumes sur les m\xEAmes muscles.",
    stress: "Stress \xE9lev\xE9 : la charge mentale s\u2019ajoute \xE0 l\u2019entra\xEEnement ; garde l\u2019intensit\xE9 mais raccourcis la s\xE9ance.",
    humeur: "Humeur basse : une s\xE9ance plaisir ou technique passe mieux qu\u2019une s\xE9ance tr\xE8s dure.",
    sommeil: "Sommeil ressenti mauvais : regarde la lecture du sommeil ci-dessous."
  };
  function dayInsights(k) {
    const e = jget(k), items = [], add = (lvl, t2, d2, src2) => items.push({ lvl, t: t2, d: d2, src: src2 || [] });
    const t = score(e), ks = kinds(k), st = subjectSettings();
    if (t !== null) {
      const vd = verdict(t), lv = vd.cls === "ok" ? "good" : vd.cls;
      add(lv, "Forme du matin \xB7 " + t + "/25 \xB7 " + vd.lbl, vd.txt, lv === "good" ? ["mclean2010", "saw2016"] : ["saw2016", "hooper1995"]);
      const past = range(k, -28, -1).map((d2) => score(jget(d2))).filter((x) => x !== null);
      if (past.length >= 7 && (vd.cls === "good" || vd.cls === "ok")) {
        const m = mean(past), s = Math.max(2, sd(past));
        if (t <= m - s) add("warn", "Nettement sous ta moyenne", "Ta moyenne sur 4 semaines est de " + f1(m) + "/25. C\u2019est l\u2019\xE9cart \xE0 ta propre habitude qui compte le plus : all\xE8ge un peu m\xEAme si le total reste correct.", ["saw2016"]);
      }
      const low = WELL.map(([key, l]) => [key, l, e.well && e.well[key]]).filter((x) => typeof x[2] === "number" && x[2] <= 2).sort((a, b) => a[2] - b[2])[0];
      if (low && low[0] !== "sommeil") add("info", low[1] + " \xB7 " + low[2] + "/5", WELL_TIPS[low[0]], ["mclean2010"]);
      const seq = range(k, -3, 0).map((d2) => score(jget(d2)));
      if (seq.every((x) => x !== null) && seq[1] < seq[0] && seq[2] < seq[1] && seq[3] < seq[2]) add("warn", "Forme en baisse 3 jours de suite", "G\xE8le la progression : reprends le niveau de la semaine pr\xE9c\xE9dente jusqu\u2019\xE0 ce que \xE7a remonte.", ["hooper1995", "saw2016"]);
    }
    const tot = nightTotal(e), tgt = sleepTarget(), u18 = tgt === 480;
    if (tot !== null) {
      const prev = nightTotal(jget(addDays(k, -1)));
      if (tot < tgt && prev !== null && prev < tgt) add("warn", "Deux nuits courtes de suite", durLong(prev) + " puis " + durLong(tot) + ". Le manque de sommeil r\xE9p\xE9t\xE9 baisse la performance et augmente le risque de blessure : garde la s\xE9ance mais retire les efforts maximaux. Une sieste de 20 \xE0 30 min avant 16 h aide.", u18 ? ["walsh2021", "milewski2014"] : ["walsh2021"]);
      else if (tot < tgt) add("info", "Nuit courte \xB7 " + durLong(tot), "Une nuit isol\xE9e change peu la performance. Vise " + (u18 ? "8 \xE0 10 h" : "7 \xE0 9 h") + " ; une sieste de moins de 30 min est possible.", u18 ? ["walsh2021", "hirsh2015", "milewski2014"] : ["walsh2021", "hirsh2015"]);
      const cmp = nightCompare(e);
      if (cmp && !/même sens/.test(cmp)) add("info", "Ressenti et mesure diff\xE8rent", cmp, ["saw2016"]);
    }
    const n = e.nuit || {};
    if (typeof n.vfc === "number") {
      const h = hrvStatus(k);
      if (!h) add("info", "VFC not\xE9e \xB7 " + n.vfc + " ms", "La lecture devient fiable apr\xE8s 2 semaines de mesures (au moins 3 par semaine) : on compare alors ta moyenne sur 7 jours \xE0 ta zone habituelle.", ["plews2014", "ais2023"]);
      else if (h.state === "low") add("warn", "VFC sous ta zone habituelle", "Moyenne 7 j " + Math.round(h.avg7) + " ms pour une zone de " + Math.round(h.lo) + " \xE0 " + Math.round(h.hi) + " ms. Signe possible de fatigue accumul\xE9e, de stress ou d\u2019un d\xE9but de maladie : si la forme ou la FC de repos vont dans le m\xEAme sens, all\xE8ge l\u2019intensit\xE9 1 \xE0 2 jours.", ["plews2013", "ais2023", "buchheit2014"]);
      else if (h.state === "high") add("info", "VFC au-dessus de ta zone", "Moyenne 7 j " + Math.round(h.avg7) + " ms (zone " + Math.round(h.lo) + "-" + Math.round(h.hi) + "). Souvent un bon signe de r\xE9cup\xE9ration ; si tu te sens tr\xE8s fatigu\xE9 malgr\xE9 tout, reste prudent.", ["ais2023", "buchheit2014"]);
      else add("good", "VFC dans ta zone habituelle", "Moyenne 7 j " + Math.round(h.avg7) + " ms (zone " + Math.round(h.lo) + "-" + Math.round(h.hi) + ").", ["plews2013", "ais2023"]);
    }
    if (typeof n.fcr === "number") {
      const base = range(k, -7, -1).map((d2) => jget(d2).nuit).filter((x) => x && typeof x.fcr === "number").map((x) => x.fcr);
      if (base.length >= 4) {
        const m = mean(base), up = n.fcr - m, y2 = jget(addDays(k, -1)).nuit;
        if (up >= 5) add("warn", "FC de repos haute \xB7 +" + Math.round(up) + " bpm", "Au-dessus de ta moyenne de la semaine (" + Math.round(m) + " bpm). Fatigue, stress, d\xE9but de maladie, chaleur ou alcool peuvent la faire monter. " + (y2 && typeof y2.fcr === "number" && y2.fcr - m >= 5 ? "Deuxi\xE8me jour de suite : all\xE8ge la s\xE9ance." : "Un seul jour : surveille demain.") + " (+5 bpm est un rep\xE8re pratique.)", ["buchheit2014"]);
      }
    }
    if (typeof n.recup === "number" && n.recup <= 33) add("warn", "R\xE9cup\xE9ration basse selon ta montre \xB7 " + n.recup + " %", "\xC0 croiser avec ta forme du matin : les scores des montres sont peu valid\xE9s scientifiquement, ta tendance compte plus que le chiffre du jour.", ["ais2023"]);
    for (const [f, lbl] of FLAGS) {
      if (!(e.flags && e.flags[f])) continue;
      const g = e.gene && typeof e.gene[f] === "number" ? e.gene[f] : null, spec = painAdvice(f, ks), srcs = f === "doigts" ? ["silbernagel2007", "schoffl2015"] : ["silbernagel2007"];
      const g7 = jget(addDays(k, -7)).gene, rising = g !== null && g7 && typeof g7[f] === "number" && g > g7[f];
      const trend = rising ? " Elle est plus haute qu\u2019il y a une semaine : ne l\u2019ignore pas." : "";
      if (g === null) add("info", lbl + " sensible", "Note la g\xEAne de 0 \xE0 10 pour suivre son \xE9volution." + spec, srcs);
      else if (g <= 2) add("info", lbl + " \xB7 g\xEAne " + g + "/10", "Zone s\xFBre : entra\xEEnement normal, en surveillant." + trend, srcs);
      else if (g <= 5) add("warn", lbl + " \xB7 g\xEAne " + g + "/10", "Acceptable si elle ne d\xE9passe pas 5/10 pendant l\u2019effort, redescend d\u2019ici demain matin et n\u2019augmente pas d\u2019une semaine \xE0 l\u2019autre." + spec + trend, srcs);
      else add("crit", lbl + " \xB7 g\xEAne " + g + "/10", "Au-dessus de 5/10 : supprime ou modifie ce qui la provoque aujourd\u2019hui. Si \xE7a dure plus de quelques jours, consulte (kin\xE9, m\xE9decin)." + spec, srcs);
    }
    const lr = loadRatio(k);
    if (lr && lr.ratio > 1.5) add("warn", "Charge en forte hausse \xB7 ratio " + f1(lr.ratio), "Les 7 derniers jours p\xE8sent " + f1(lr.ratio) + " fois ta moyenne des 4 semaines. Zone 0,8-1,3 d\xE9crite comme favorable (rep\xE8re discut\xE9) : garde les prochains jours \xE0 ce niveau plut\xF4t que d\u2019ajouter.", ["gabbett2016", "impellizzeri2020"]);
    else if (lr && lr.ratio > 1.3) add("info", "Charge en hausse \xB7 ratio " + f1(lr.ratio), "Progression rapide : \xE7a passe si la forme suit.", ["gabbett2016", "impellizzeri2020"]);
    const mo = monotony(k);
    if (mo && mo.mono > 2) add("info", "Semaine monotone \xB7 " + f1(mo.mono), "Les jours se ressemblent trop en charge : alterne jours durs et jours faciles.", ["foster1998"]);
    const y = addDays(k, -1), ye = jget(y), yt = target(y);
    if (typeof ye.pain === "number" && ye.pain > 5) add("warn", "Douleur \xE9lev\xE9e pendant la kin\xE9 d\u2019hier \xB7 " + ye.pain + "/10", "Au-dessus de 5/10, on all\xE8ge ou on modifie les exercices qui la provoquent. V\xE9rifie ce matin qu\u2019elle est redescendue ; sinon, parles-en \xE0 ton kin\xE9.", ["silbernagel2007"]);
    if (yt && yt.rpe && typeof ye.rpe === "number" && ye.rpe >= yt.rpe[1] + 2) add("info", "S\xE9ance d\u2019hier plus dure que pr\xE9vu", "Ressenti " + ye.rpe + "/10 pour une cible de " + rng(yt) + ". Si tu te sens entam\xE9 ce matin, commence prudemment.", ["foster2001"]);
    if (st.cycle && typeof e.cycle === "number") {
      const c = e.cycle;
      if (c > 35) add("warn", "Cycle \xB7 J" + c, "Cycle de plus de 35 jours : des cycles longs, irr\xE9guliers ou absents peuvent signaler un d\xE9ficit \xE9nerg\xE9tique (REDs). \xC0 \xE9voquer avec un m\xE9decin.", ["mountjoy2023"]);
      else {
        const ph = c <= 5 ? "r\xE8gles, d\xE9but de phase folliculaire" : c <= 13 ? "phase folliculaire" : c <= 15 ? "ovulation (estim\xE9e)" : "phase lut\xE9ale";
        add("info", "Cycle \xB7 J" + c + " \xB7 " + ph, c <= 5 ? "En moyenne l\u2019effet du cycle sur la performance est trivial (l\xE9ger creux possible en ce moment) et tr\xE8s variable d\u2019une personne \xE0 l\u2019autre. On ne change rien par principe ; si les sympt\xF4mes g\xEAnent, traite la journ\xE9e comme une forme basse." : "On ne change rien par principe. Apr\xE8s 3 ou 4 cycles not\xE9s, ta propre tendance appara\xEEtra dans le suivi.", ["mcnulty2020"]);
      }
    }
    if (e.repas === "non" || e.repas === "partiel") {
      const miss = range(k, -6, 0).filter((d2) => jget(d2).repas === "non").length;
      if (miss >= 3) add("warn", "Repas manqu\xE9s " + miss + " fois en 7 jours", "Un apport insuffisant et r\xE9p\xE9t\xE9 fatigue et fragilise (d\xE9ficit \xE9nerg\xE9tique, REDs). \xC0 surveiller, et \xE0 en parler si \xE7a continue.", ["mountjoy2023"]);
      else add("info", "Peu mang\xE9 autour de la s\xE9ance d\u2019hier", "Glucides et prot\xE9ines dans les heures qui suivent l\u2019effort aident \xE0 r\xE9cup\xE9rer.", ["kerksick2017"]);
    }
    if (!items.length) return null;
    items.sort((a, b) => LV[a.lvl] - LV[b.lvl]);
    const worst = items[0].lvl;
    const level = worst === "crit" ? "crit" : worst === "warn" ? "warn" : "good";
    const head = level === "crit" ? "Feu rouge : version d\xE9charge ou repos actif" : level === "warn" ? "Feu orange : s\xE9ance all\xE9g\xE9e ou adapt\xE9e" : "Feu vert : s\xE9ance telle que pr\xE9vue";
    const d = day(k), adapt = d && d.adapt && level !== "good" ? d.adapt : null;
    return { level, head, items, adapt, event: eventOn(k) };
  }
  function weekInsights(k) {
    k = k || todayKey();
    const items = [], add = (lvl, t, d, src2) => items.push({ lvl, t, d, src: src2 || [] });
    const cur = range(k, -6, 0), prev = range(k, -13, -7);
    const lc = cur.reduce((a, d) => a + dayLoad(d), 0), lp = prev.reduce((a, d) => a + dayLoad(d), 0);
    if (lc > 0) {
      const ch = lp > 0 ? (lc / lp - 1) * 100 : null, lr = loadRatio(k);
      const txt = Math.round(lc).toLocaleString("fr-FR") + " UA sur 7 jours" + (ch !== null ? " (" + (ch >= 0 ? "+" : "") + Math.round(ch) + " % vs les 7 jours d\u2019avant)" : "") + (lr ? ", ratio aigu/chronique " + f1(lr.ratio) : "") + ".";
      if (lr && lr.ratio > 1.5) add("warn", "Charge en forte hausse", txt + " Au-del\xE0 de 1,5, garde le m\xEAme niveau la semaine prochaine.", ["gabbett2016", "impellizzeri2020"]);
      else if (lr && lr.ratio < 0.8) add("info", "Charge en baisse", txt + " Normal en d\xE9charge ou en aff\xFBtage ; sinon reprends progressivement.", ["gabbett2016"]);
      else add("good", "Charge", txt, ["foster2001", "gabbett2016"]);
      const mo = monotony(k);
      if (mo) add(mo.mono > 2 ? "info" : "good", "Monotonie \xB7 " + f1(mo.mono), mo.mono > 2 ? "Au-dessus de 2 : alterne davantage jours durs et faciles." : "Bonne alternance entre jours durs et faciles.", ["foster1998"]);
    }
    const w7 = cur.map((d) => score(jget(d))).filter((x) => x !== null), w28 = range(k, -34, -7).map((d) => score(jget(d))).filter((x) => x !== null);
    if (w7.length >= 3) {
      const m7 = mean(w7), m28 = w28.length >= 7 ? mean(w28) : null;
      const diff = m28 !== null ? m7 - m28 : 0;
      const vm = verdict(Math.round(m7)).cls;
      add(vm === "warn" || vm === "crit" || diff <= -2 ? "warn" : "good", "Forme moyenne \xB7 " + f1(m7) + "/25", m28 !== null ? diff <= -2 ? "En baisse par rapport aux semaines d\u2019avant (" + f1(m28) + ") : la charge est peut-\xEAtre trop haute." : "Stable par rapport aux semaines d\u2019avant (" + f1(m28) + ")." : "La comparaison \xE0 ta moyenne viendra apr\xE8s quelques semaines.", ["saw2016", "mclean2010"]);
    }
    const nights = cur.map((d) => nightTotal(jget(d))).filter((x) => x !== null), tgt = sleepTarget();
    if (nights.length >= 3) {
      const short = nights.filter((x) => x < tgt).length, m = mean(nights);
      add(short >= 3 ? "warn" : "good", "Sommeil moyen \xB7 " + durLong(Math.round(m)), short ? short + " nuit" + (short > 1 ? "s" : "") + " sous " + tgt / 60 + " h cette semaine." + (short >= 3 ? " Avance le coucher ou allonge la nuit avant les grosses s\xE9ances." : "") : "Pas de nuit courte cette semaine.", tgt === 480 ? ["walsh2021", "milewski2014"] : ["walsh2021"]);
    }
    const h = hrvStatus(k);
    if (h) add(h.state === "low" ? "warn" : "good", "VFC \xB7 " + Math.round(h.avg7) + " ms sur 7 j", h.state === "low" ? "Sous ta zone habituelle (" + Math.round(h.lo) + "-" + Math.round(h.hi) + " ms)." : h.state === "high" ? "Au-dessus de ta zone habituelle (" + Math.round(h.lo) + "-" + Math.round(h.hi) + " ms)." : "Dans ta zone habituelle (" + Math.round(h.lo) + "-" + Math.round(h.hi) + " ms).", ["plews2013", "ais2023"]);
    const pains = {};
    for (const d of cur) {
      const e = jget(d);
      for (const [f] of FLAGS) if (e.flags && e.flags[f]) {
        const g = e.gene && typeof e.gene[f] === "number" ? e.gene[f] : 0;
        pains[f] = Math.max(pains[f] || 0, g);
      }
    }
    const pk = Object.keys(pains);
    if (pk.length) {
      const mx = Math.max(...pk.map((f) => pains[f]));
      add(mx > 5 ? "crit" : mx >= 3 ? "warn" : "info", "G\xEAnes cette semaine", pk.map((f) => FL[f] + (pains[f] ? " " + pains[f] + "/10" : "")).join(" \xB7 ") + (mx > 5 ? ". Au-dessus de 5/10 : \xE0 adapter, et \xE0 faire voir si \xE7a dure." : "."), ["silbernagel2007"]);
    }
    items.sort((a, b) => LV[a.lvl] - LV[b.lvl]);
    return items;
  }

  // src/lib/adapt.js
  var adapt_exports = {};
  __export(adapt_exports, {
    adjSummary: () => adjSummary,
    applyAdjust: () => applyAdjust,
    clearAdjust: () => clearAdjust,
    fitToTime: () => fitToTime,
    lighten: () => lighten,
    minsOf: () => minsOf,
    plannedMin: () => plannedMin,
    unitsOf: () => unitsOf
  });

  // src/lib/warmup.js
  var warmup_exports = {};
  __export(warmup_exports, {
    PH_LBL: () => PH_LBL,
    warmupFor: () => warmupFor,
    warmupOfDay: () => warmupOfDay
  });

  // src/lib/levels.js
  var levels_exports = {};
  __export(levels_exports, {
    CLIMB_KEYS: () => CLIMB_KEYS,
    LIFTS: () => LIFTS,
    LIFT_OF_LIB: () => LIFT_OF_LIB,
    climbLevel: () => climbLevel,
    csOf: () => csOf,
    fcmaxOf: () => fcmaxOf,
    ftpOf: () => ftpOf,
    levelsDoc: () => levelsDoc,
    loadForPct: () => loadForPct,
    oneRM: () => oneRM,
    paceAt: () => paceAt,
    paceCs: () => paceCs,
    runProfile: () => runProfile,
    setLevel: () => setLevel,
    srcTxt: () => srcTxt,
    vmaOf: () => vmaOf,
    vo2Of: () => vo2Of
  });

  // src/lib/grades.js
  var grades_exports = {};
  __export(grades_exports, {
    DISC_LBL: () => DISC_LBL,
    FONT: () => FONT,
    FR: () => FR,
    SCALE: () => SCALE,
    gapText: () => gapText,
    gradeAt: () => gradeAt,
    gradeIdx: () => gradeIdx,
    gradeIn: () => gradeIn,
    maxGrade: () => maxGrade,
    meanGrade: () => meanGrade,
    shiftGrade: () => shiftGrade
  });
  var FONT = ["3", "4", "4+", "5", "5+", "6A", "6A+", "6B", "6B+", "6C", "6C+", "7A", "7A+", "7B", "7B+", "7C", "7C+", "8A", "8A+", "8B", "8B+", "8C", "8C+", "9A"];
  var FR = ["3", "4a", "4b", "4c", "5a", "5b", "5c", "6a", "6a+", "6b", "6b+", "6c", "6c+", "7a", "7a+", "7b", "7b+", "7c", "7c+", "8a", "8a+", "8b", "8b+", "8c", "8c+", "9a", "9a+", "9b", "9b+", "9c"];
  var SCALE = { bloc: FONT, voie: FR };
  var DISC_LBL = { bloc: "bloc", voie: "voie" };
  function gradeIdx(s, disc) {
    if (s == null) return null;
    const t = String(s).trim().replace(/\s+/g, "").toLowerCase();
    const sc = SCALE[disc] || FONT, i = sc.findIndex((g) => g.toLowerCase() === t);
    return i >= 0 ? i : null;
  }
  var gradeAt = (i, disc) => {
    const sc = SCALE[disc] || FONT;
    return i == null ? null : sc[Math.max(0, Math.min(sc.length - 1, i))];
  };
  var shiftGrade = (g, n, disc) => {
    const i = gradeIdx(g, disc);
    return i == null ? null : gradeAt(i + n, disc);
  };
  function gradeIn(text, disc) {
    const m = String(text || "").match(/\b([3-9](?:[abcABC]\+?|\+)?)(?=\b|\s|$|\+)/g);
    if (!m) return null;
    for (const x of m) {
      const i = gradeIdx(x, disc);
      if (i != null && /[abc+]/i.test(x)) return gradeAt(i, disc);
    }
    return null;
  }
  function gapText(g, ref, disc, refLbl) {
    const a = gradeIdx(g, disc), b = gradeIdx(ref, disc);
    if (a == null || b == null) return null;
    const d = b - a;
    if (d === 0) return "\xE0 ton " + refLbl;
    return Math.abs(d) + " niveau" + (Math.abs(d) > 1 ? "x" : "") + (d > 0 ? " sous " : " au-dessus de ") + "ton " + refLbl;
  }
  function meanGrade(list, disc) {
    const ix = (list || []).map((g) => gradeIdx(g, disc)).filter((i) => i != null);
    if (!ix.length) return null;
    return gradeAt(Math.round(ix.reduce((a, b) => a + b, 0) / ix.length), disc);
  }
  function maxGrade(list, disc) {
    const ix = (list || []).map((g) => gradeIdx(g, disc)).filter((i) => i != null);
    return ix.length ? gradeAt(Math.max(...ix), disc) : null;
  }

  // src/lib/library.js
  var library_exports = {};
  __export(library_exports, {
    EQUIP: () => EQUIP,
    GOALS: () => GOALS,
    GOAL_BY_ID: () => GOAL_BY_ID,
    LIB: () => LIB,
    LIB_BY_ID: () => LIB_BY_ID,
    SYSTEMS: () => SYSTEMS,
    equipSet: () => equipSet,
    libMatch: () => libMatch,
    norm: () => norm,
    quiz: () => quiz,
    quizResult: () => quizResult
  });
  var EQUIP = [
    ["salle", "Salle de muscu"],
    ["halteres", "Halt\xE8res / kettlebell"],
    ["traction", "Barre de traction"],
    ["poutre", "Poutre (pan, fingerboard)"],
    ["salle-esc", "Salle d\u2019escalade"],
    ["elastique", "\xC9lastiques"],
    ["exterieur", "Ext\xE9rieur (piste, route)"],
    ["velo", "V\xE9lo / home-trainer"],
    ["piscine", "Piscine"],
    ["bfr", "Brassards BFR"]
  ];
  function equipSet(list) {
    const s = /* @__PURE__ */ new Set(["rien"]);
    for (const e of list || []) {
      s.add(e);
      if (e === "salle") ["barre", "halteres", "machines", "traction", "elastique"].forEach((x) => s.add(x));
      if (e === "salle-esc") ["poutre", "traction", "pan"].forEach((x) => s.add(x));
    }
    return s;
  }
  var E = (id, n, k, o) => Object.assign({ id, n, k, sp: ["all"], q: [], g: [], eq: ["rien"], lvl: 1, t: "reps", ld: "kg", heavy: false, pat: "" }, o);
  var LIB = [
    // ---- Jambes : squat
    E("squat", "Squat barre", "muscu", { q: ["force", "hyper", "endu_f"], g: ["jambes"], eq: ["barre"], heavy: true, pat: "squat", c: "Cuisses au moins parall\xE8les, dos neutre, genoux dans l\u2019axe des pieds." }),
    E("front-squat", "Squat avant", "muscu", { q: ["force", "hyper"], g: ["jambes"], eq: ["barre"], lvl: 2, heavy: true, pat: "squat", c: "Coudes hauts, buste droit." }),
    E("presse", "Presse \xE0 cuisses", "muscu", { q: ["force", "hyper", "endu_f"], g: ["jambes"], eq: ["machines"], heavy: true, pat: "squat", c: "Bas du dos plaqu\xE9 au dossier, amplitude sans d\xE9coller le bassin." }),
    E("goblet", "Goblet squat", "muscu", { q: ["hyper", "endu_f", "force"], g: ["jambes"], eq: ["halteres"], pat: "squat", c: "Halt\xE8re ou kettlebell contre la poitrine, descente contr\xF4l\xE9e." }),
    E("squat-pdc", "Squat au poids du corps", "muscu", { q: ["endu_f"], g: ["jambes"], ld: "bw", pat: "squat", c: "Tempo contr\xF4l\xE9, amplitude compl\xE8te." }),
    // ---- Jambes : unilatéral
    E("bulgare", "Squat bulgare", "muscu", { q: ["hyper", "force", "endu_f", "prev"], g: ["jambes"], eq: ["halteres", "rien"], pat: "unilat", c: "Pied arri\xE8re sur un banc, genou avant dans l\u2019axe. Charges en main si possible." }),
    E("fentes", "Fentes march\xE9es", "muscu", { q: ["hyper", "endu_f"], g: ["jambes"], eq: ["halteres", "rien"], pat: "unilat", c: "Grand pas, genou arri\xE8re qui fr\xF4le le sol." }),
    E("step-up", "Mont\xE9es sur banc", "muscu", { q: ["endu_f", "prev", "hyper"], g: ["jambes"], eq: ["halteres", "rien"], pat: "unilat", c: "Pousser avec la jambe du haut, sans \xE9lan de la jambe d\u2019appui." }),
    // ---- Chaîne postérieure
    E("sdt", "Soulev\xE9 de terre", "muscu", { q: ["force", "hyper"], g: ["jambes", "dos"], eq: ["barre"], heavy: true, pat: "hinge", c: "Dos neutre, barre au contact des jambes, pouss\xE9e dans le sol." }),
    E("rdl", "Soulev\xE9 de terre jambes tendues", "muscu", { q: ["hyper", "force", "endu_f"], g: ["jambes", "dos"], eq: ["barre", "halteres"], heavy: true, pat: "hinge", c: "Genoux l\xE9g\xE8rement fl\xE9chis, on recule les hanches, dos neutre." }),
    E("hip-thrust", "Hip thrust", "muscu", { q: ["hyper", "force", "endu_f"], g: ["jambes"], eq: ["barre", "halteres"], pat: "hinge", c: "Haut du dos sur un banc, extension compl\xE8te des hanches en serrant les fessiers." }),
    E("swing", "Kettlebell swing", "muscu", { q: ["puiss", "endu_f"], g: ["jambes", "dos"], eq: ["halteres"], pat: "hinge", c: "Mouvement de hanches explosif, bras rel\xE2ch\xE9s." }),
    E("nordic", "Nordic hamstring", "renfo", { q: ["prev", "hyper"], g: ["jambes"], ld: "bw", heavy: true, rr: [4, 6], pat: "ischio", c: "Chevilles bloqu\xE9es, descente la plus lente possible, on se rattrape avec les mains.", src: ["vandyk2019"] }),
    E("pont", "Pont fessier unipodal", "renfo", { q: ["prev", "endu_f"], g: ["jambes"], ld: "bw", pat: "ischio", c: "Bassin align\xE9, 2 s en haut." }),
    E("iso-mollets", "Isom\xE9trie lourde des mollets", "renfo", { q: ["prev"], g: [], eq: ["halteres", "machines", "rien"], t: "iso", hold: "3 s", ld: "kg", pat: "tendon", c: "Pointe de pied sur une marche, genou tendu (et genou pli\xE9 pour le sol\xE9aire) : pousser 3 s presque au maximum contre une charge ou un point fixe.", src: ["bohm2015"] }),
    E("iso-quad", "Isom\xE9trie lourde des quadriceps", "renfo", { q: ["prev"], g: ["jambes"], eq: ["machines", "halteres", "rien"], t: "iso", hold: "3 s", ld: "kg", pat: "tendon", c: "Leg extension bloqu\xE9 ou chaise lest\xE9e, genou vers 60\xB0 : pousser 3 s presque au maximum.", src: ["bohm2015"] }),
    E("leg-ext", "Leg extension", "muscu", { q: ["hyper"], g: ["jambes"], eq: ["machines", "elastique"], pat: "quad-iso", c: "Assis, tendre les genoux puis redescendre en 2 s. Se fait aussi avec un \xE9lastique accroch\xE9 \xE0 la cheville." }),
    E("curl", "Curl biceps", "muscu", { q: ["hyper"], g: [], eq: ["halteres", "elastique", "machines"], pat: "bras", c: "Coudes pr\xE8s du corps, monter puis redescendre en 2 s, sans balancer le buste." }),
    E("mollets", "Extensions de mollets", "renfo", { q: ["prev", "endu_f"], g: [], eq: ["halteres", "rien"], pat: "mollet", c: "Sur une marche, mont\xE9e sur la pointe, descente lente talon sous la marche." }),
    // ---- Poussée
    E("dc", "D\xE9velopp\xE9 couch\xE9", "muscu", { q: ["force", "hyper"], g: ["poussee"], eq: ["barre"], heavy: true, pat: "push-h", c: "Omoplates serr\xE9es, barre au bas des pectoraux, pieds ancr\xE9s." }),
    E("dc-halt", "D\xE9velopp\xE9 couch\xE9 halt\xE8res", "muscu", { q: ["hyper", "force", "endu_f"], g: ["poussee"], eq: ["halteres"], pat: "push-h", c: "Descente contr\xF4l\xE9e, coudes \xE0 45\xB0." }),
    E("pompes", "Pompes", "muscu", { q: ["endu_f", "hyper", "prev"], g: ["poussee"], ld: "bw", pat: "push-h", c: "Corps gain\xE9, poitrine \xE0 un poing du sol. Pieds sur\xE9lev\xE9s ou lest pour durcir." }),
    E("dips", "Dips", "muscu", { q: ["force", "hyper"], g: ["poussee"], eq: ["machines"], ld: "+kg", lvl: 2, heavy: true, pat: "push-h", c: "\xC9paule qui descend sous le coude sans douleur, remont\xE9e compl\xE8te." }),
    E("dm", "D\xE9velopp\xE9 militaire", "muscu", { q: ["force", "hyper"], g: ["poussee", "epaule"], eq: ["barre"], heavy: true, pat: "push-v", c: "Debout, fessiers serr\xE9s, barre qui passe pr\xE8s du visage." }),
    E("dm-halt", "D\xE9velopp\xE9 \xE9paules halt\xE8res", "muscu", { q: ["hyper", "endu_f", "force"], g: ["poussee", "epaule"], eq: ["halteres"], pat: "push-v", c: "Assis ou debout, sans cambrer." }),
    E("pike", "Pompes piqu\xE9es", "muscu", { q: ["endu_f", "hyper"], g: ["poussee", "epaule"], ld: "bw", pat: "push-v", c: "Bassin haut, t\xEAte qui descend entre les mains." }),
    // ---- Tirage
    E("tractions", "Tractions", "muscu", { q: ["force", "hyper", "endu_f"], g: ["tirage"], eq: ["traction"], ld: "bw", heavy: true, pat: "pull-v", c: "D\xE9part bras tendus \xE9paules engag\xE9es, menton au-dessus de la barre." }),
    E("tractions-lest", "Tractions lest\xE9es", "muscu", { q: ["force"], g: ["tirage"], eq: ["traction"], ld: "+kg", lvl: 2, heavy: true, pat: "pull-v", c: "Lest \xE0 la ceinture, r\xE9p\xE9titions strictes sans \xE9lan." }),
    E("tirage-poulie", "Tirage vertical \xE0 la poulie", "muscu", { q: ["hyper", "endu_f", "force"], g: ["tirage"], eq: ["machines"], pat: "pull-v", c: "Barre vers le haut de la poitrine, buste l\xE9g\xE8rement inclin\xE9." }),
    E("rowing", "Rowing barre", "muscu", { q: ["force", "hyper"], g: ["tirage", "dos"], eq: ["barre"], heavy: true, pat: "pull-h", c: "Buste pench\xE9 \xE0 45\xB0, dos neutre, barre vers le nombril." }),
    E("rowing-halt", "Rowing halt\xE8re un bras", "muscu", { q: ["hyper", "endu_f", "force"], g: ["tirage"], eq: ["halteres"], pat: "pull-h", c: "Main et genou sur un banc, coude le long du corps." }),
    E("rowing-inv", "Rowing invers\xE9", "muscu", { q: ["endu_f", "hyper", "prev"], g: ["tirage"], eq: ["traction", "barre"], ld: "bw", pat: "pull-h", c: "Barre basse ou anneaux, corps gain\xE9, poitrine \xE0 la barre." }),
    E("tirage-elast", "Tirage horizontal \xE0 l\u2019\xE9lastique", "muscu", { q: ["endu_f", "prev"], g: ["tirage"], eq: ["elastique"], pat: "pull-h", c: "Omoplates qui se rapprochent en fin de mouvement." }),
    // ---- Tronc
    E("gainage", "Gainage ventral", "renfo", { q: ["prev", "endu_f"], t: "iso", ld: "bw", pat: "core", c: "Bassin align\xE9, on respire. Arr\xEAt d\xE8s que le dos se creuse." }),
    E("gainage-lat", "Gainage lat\xE9ral", "renfo", { q: ["prev", "endu_f"], t: "iso", ld: "bw", pat: "core", c: "Sur l\u2019avant-bras, corps align\xE9, chaque c\xF4t\xE9." }),
    E("releve-jambes", "Relev\xE9s de jambes suspendu", "renfo", { q: ["force", "endu_f"], eq: ["traction"], ld: "bw", pat: "core", c: "Sans balancer, bassin qui s\u2019enroule." }),
    E("pallof", "Pallof press", "renfo", { q: ["prev", "endu_f"], eq: ["elastique", "machines"], pat: "core", c: "\xC9lastique sur le c\xF4t\xE9, bras tendus devant sans laisser tourner le buste." }),
    E("dead-bug", "Dead bug", "renfo", { q: ["prev"], ld: "bw", pat: "core", c: "Bas du dos plaqu\xE9 au sol, bras et jambe oppos\xE9s qui s\u2019allongent lentement." }),
    // ---- Épaules, avant-bras : prévention et antagonistes
    E("rot-ext", "Rotation externe \xE0 l\u2019\xE9lastique", "epaule", { q: ["prev"], eq: ["elastique", "halteres"], pat: "epaule", c: "Coude au corps, rotation lente, 2 s de retour." }),
    E("face-pull", "Face pull", "epaule", { q: ["prev", "hyper"], eq: ["elastique", "machines"], pat: "epaule", c: "Corde vers le front, coudes hauts, rotation externe en fin de mouvement." }),
    E("ytw", "Y-T-W allong\xE9", "epaule", { q: ["prev"], eq: ["halteres", "rien"], pat: "epaule", c: "\xC0 plat ventre sur un banc inclin\xE9, charges tr\xE8s l\xE9g\xE8res." }),
    E("scap-pull", "Tractions scapulaires", "epaule", { q: ["prev"], sp: ["escalade"], eq: ["traction"], ld: "bw", pat: "epaule", c: "Bras tendus, on monte et descend seulement avec les omoplates." }),
    E("ext-poignet", "Extenseurs du poignet", "renfo", { q: ["prev"], sp: ["escalade"], eq: ["halteres", "elastique"], pat: "avantbras", c: "Avant-bras pos\xE9, halt\xE8re l\xE9ger, descente lente (3 s). Antagoniste des fl\xE9chisseurs des doigts." }),
    // ---- Puissance, pliométrie, vitesse
    E("cmj", "Sauts verticaux", "muscu", { q: ["puiss", "vit"], g: ["jambes"], ld: "bw", pat: "plyo", c: "Contre-mouvement rapide, saut maximal, r\xE9ception amortie genoux dans l\u2019axe." }),
    E("box-jump", "Sauts sur box", "muscu", { q: ["puiss", "vit"], g: ["jambes"], ld: "bw", pat: "plyo", c: "Saut maximal, on descend du box en marchant." }),
    E("saut-longueur", "Sauts en longueur sans \xE9lan", "muscu", { q: ["puiss", "vit"], g: ["jambes"], ld: "bw", pat: "plyo", c: "Bras qui lancent, r\xE9ception stable." }),
    E("squat-saute", "Squat saut\xE9 charg\xE9 l\xE9ger", "muscu", { q: ["puiss"], g: ["jambes"], eq: ["barre", "halteres"], lvl: 2, pat: "squat-puiss", c: "20 \xE0 30 % de la charge max, intention maximale de vitesse." }),
    E("pompes-expl", "Pompes explosives", "muscu", { q: ["puiss"], g: ["poussee"], ld: "bw", lvl: 2, pat: "push-puiss", c: "Mains qui d\xE9collent du sol \xE0 chaque r\xE9p\xE9tition." }),
    E("tractions-expl", "Tractions explosives", "muscu", { q: ["puiss"], g: ["tirage"], eq: ["traction"], ld: "bw", lvl: 2, pat: "pull-puiss", c: "Tirage le plus rapide possible, poitrine vers la barre." }),
    E("sprint", "Sprints 20 m d\xE9part arr\xEAt\xE9", "course", { q: ["vit", "puiss"], g: ["jambes"], eq: ["exterieur"], t: "essai", ld: "bw", heavy: true, pat: "sprint", c: "Effort maximal (environ 3 \xE0 4 s), r\xE9cup\xE9ration compl\xE8te." }),
    E("sprint-lance", "Sprints lanc\xE9s 20 m", "course", { q: ["vit"], g: ["jambes"], eq: ["exterieur"], t: "essai", ld: "bw", lvl: 2, heavy: true, pat: "sprint", c: "20 m d\u2019\xE9lan progressif puis 20 m \xE0 vitesse maximale." }),
    E("cote", "Sprints en c\xF4te 8 s", "course", { q: ["vit", "puiss"], g: ["jambes"], eq: ["exterieur"], t: "essai", ld: "bw", heavy: true, pat: "sprint", c: "C\xF4te \xE0 5-10 %, 8 s \xE0 fond, retour en marchant." }),
    // ---- Course
    E("ef", "Footing en endurance fondamentale", "course", { q: ["aero"], sp: ["course", "trail", "hyrox", "collectif", "combat", "autre", "muscu"], g: [], eq: ["exterieur"], t: "cont", ld: "bw", pat: "run-easy", c: "Zone 1-2 : tu peux parler en phrases compl\xE8tes." }),
    E("sortie-longue", "Sortie longue", "course", { q: ["aero"], sp: ["course", "trail", "hyrox"], eq: ["exterieur"], t: "cont", ld: "bw", pat: "run-long", c: "Allure facile du d\xE9but \xE0 la fin. En trail, du d\xE9nivel\xE9." }),
    E("30-30", "Intervalles 30/30", "course", { q: ["aero"], g: ["cardio"], eq: ["exterieur"], t: "int", ld: "bw", pat: "run-int", c: "30 s vite (proche de ta VMA), 30 s en trottinant.", src: ["buchheit2013"] }),
    E("3min", "Intervalles longs 3 min", "course", { q: ["aero"], g: ["cardio"], eq: ["exterieur"], t: "int", ld: "bw", lvl: 2, pat: "run-int", c: "3 min \xE0 allure 3 000-5 000 m, 2 min de trot.", src: ["buchheit2013"] }),
    E("300m", "R\xE9p\xE9titions de 300 m", "course", { q: ["endu_f", "vit"], g: ["cardio", "jambes"], eq: ["exterieur"], t: "int", ld: "bw", lvl: 2, pat: "run-lact", c: "Environ 60 s tr\xE8s vite, 3 \xE0 4 min de r\xE9cup\xE9ration (1:3 \xE0 1:4).", src: ["nsca2016"] }),
    E("lignes", "Lignes droites", "course", { q: ["vit", "aero"], eq: ["exterieur"], t: "essai", ld: "bw", pat: "run-strides", c: "20 s en acc\xE9l\xE9rant progressivement jusqu\u2019\xE0 90 %, retour en marchant." }),
    // ---- Vélo, rameur, natation, circuit
    E("velo-z2", "V\xE9lo en endurance", "velo", { q: ["aero"], eq: ["velo"], t: "cont", ld: "bw", pat: "bike-easy", c: "Zone 1-2, cadence souple." }),
    E("velo-4x4", "V\xE9lo 4 \xD7 4 min", "velo", { q: ["aero"], g: ["cardio"], eq: ["velo"], t: "int", ld: "bw", pat: "bike-int", c: "4 min \xE0 90-95 % de ta FC max, 3 min faciles.", src: ["helgerud2007"] }),
    E("velo-sprint", "Sprints v\xE9lo 10 s", "velo", { q: ["vit", "puiss"], g: ["jambes"], eq: ["velo"], t: "int", ld: "bw", pat: "bike-sprint", c: "10 s \xE0 fond, 2 min tr\xE8s faciles (1:12)." }),
    E("rameur", "Rameur 500 m", "velo", { q: ["endu_f", "aero"], g: ["cardio"], eq: ["machines"], t: "int", ld: "bw", pat: "row-int", c: "500 m vite, 2 min de r\xE9cup\xE9ration." }),
    E("nage-ef", "Natation en endurance", "velo", { q: ["aero"], sp: ["natation"], eq: ["piscine"], t: "cont", ld: "bw", pat: "swim-easy", c: "Nage continue \xE0 allure confortable." }),
    E("nage-100", "Natation 100 m", "velo", { q: ["aero", "endu_f"], sp: ["natation"], g: ["cardio"], eq: ["piscine"], t: "int", ld: "bw", pat: "swim-int", c: "100 m soutenu, 20 \xE0 30 s de repos." }),
    E("circuit", "Circuit fonctionnel", "velo", { q: ["endu_f", "aero"], sp: ["hyrox", "collectif", "combat", "autre", "muscu"], g: ["cardio"], eq: ["rien", "halteres"], t: "int", ld: "bw", pat: "circuit", c: "Burpees, fentes, squats, pompes, gainage : 40 s par atelier, 20 s de transition." }),
    // ---- Escalade
    E("max-hangs", "Suspensions max", "doigts", { q: ["force", "doigts"], sp: ["escalade"], g: ["doigts"], eq: ["poutre"], t: "hang", ld: "+kg", lvl: 2, heavy: true, u18: false, pat: "finger-max", c: "20 mm, semi-arqu\xE9. Charge (lest ou d\xE9charge) que tu tiendrais environ 13 s : marge de 3 s.", src: ["lopezrivera2012"] }),
    E("repeaters", "Suspensions 7/3", "doigts", { q: ["endu_f", "resist"], sp: ["escalade"], g: ["doigts"], eq: ["poutre"], t: "hang", ld: "+kg", lvl: 2, u18: false, pat: "finger-endu", c: "7 s suspendu, 3 s de pause, 6 fois. Prise moyenne, sans aller \xE0 l\u2019\xE9chec." }),
    E("limite", "Blocs \xE0 ta limite", "grimpe", { q: ["puiss", "force", "bloc", "doigts"], sp: ["escalade"], g: ["doigts", "tirage"], eq: ["pan", "salle-esc"], t: "essai", ld: "bw", heavy: true, pat: "climb-limit", c: "3 \xE0 6 mouvements tr\xE8s durs, frais \xE0 chaque essai.", src: ["nsca2016"] }),
    E("pan-dur", "Pan : blocs durs", "grimpe", { q: ["puiss", "bloc", "force"], sp: ["escalade"], g: ["doigts", "tirage"], eq: ["pan"], t: "essai", ld: "bw", lvl: 2, heavy: true, pat: "climb-limit", c: "Moonboard, Kilter ou pan maison : mouvements de puissance sur petites prises." }),
    E("campus", "Campus sur prises larges", "grimpe", { q: ["puiss", "bloc"], sp: ["escalade"], g: ["doigts", "tirage"], eq: ["pan"], t: "essai", ld: "bw", lvl: 3, heavy: true, u18: false, pat: "climb-power", c: "\xC9chelons larges, mont\xE9es 1-3-5, arr\xEAt d\xE8s que la qualit\xE9 baisse." }),
    E("4x4", "4 blocs encha\xEEn\xE9s (4 \xD7 4)", "grimpe", { q: ["resist", "endu_f"], sp: ["escalade"], g: ["doigts"], eq: ["salle-esc", "pan"], t: "serie", ld: "bw", pat: "climb-lact", c: "4 blocs encha\xEEn\xE9s sans pause, 2 \xE0 3 niveaux sous ta limite." }),
    E("int-pan", "Intervalles 1 min sur pan", "grimpe", { q: ["resist", "endu_f"], sp: ["escalade"], g: ["doigts"], eq: ["pan", "salle-esc"], t: "int", ld: "bw", pat: "climb-lact", c: "1 min de grimpe soutenue, 3 min de repos (1:3).", src: ["nsca2016"] }),
    E("enchainement", "Encha\xEEnement de deux voies", "grimpe", { q: ["resist"], sp: ["escalade"], g: ["doigts"], eq: ["salle-esc"], t: "serie", ld: "bw", pat: "climb-lact", c: "Deux voies d\u2019affil\xE9e sans redescendre au sol si possible, niveau \xE0 vue moins 2." }),
    E("volume-blocs", "Volume de blocs faciles", "grimpe", { q: ["aero", "conti", "tech"], sp: ["escalade"], eq: ["salle-esc", "pan"], t: "bloc", ld: "bw", pat: "climb-aero", c: "Beaucoup de blocs nettement sous ton flash, 1 min de repos : encha\xEEner sans \xAB bouteiller \xBB." }),
    E("compet-sim", "Simulation de comp\xE9tition", "grimpe", { q: ["puiss", "bloc", "compet"], sp: ["escalade"], g: ["doigts", "tirage"], eq: ["salle-esc"], t: "essai", ld: "bw", heavy: true, pat: "climb-comp", c: "Blocs nouveaux, temps limit\xE9 par bloc, autant de repos : lecture, engagement, gestion des essais." }),
    E("flash", "Flash de blocs nouveaux", "grimpe", { q: ["compet", "tech"], sp: ["escalade"], eq: ["salle-esc"], t: "essai", ld: "bw", pat: "climb-comp", c: "Un seul essai apr\xE8s une lecture d\u20191 min : comme en qualification." }),
    E("finger-lift", "Finger lift", "doigts", { q: ["force", "doigts"], sp: ["escalade"], g: ["doigts"], eq: ["halteres", "salle"], t: "hang", ld: "kg", lvl: 2, heavy: true, u18: false, pat: "finger-max", c: "Bloc ou r\xE9glette charg\xE9, une main, semi-arqu\xE9 : lev\xE9e de 7 s sans \xE0-coup." }),
    E("conti", "Continuit\xE9", "grimpe", { q: ["aero", "conti"], sp: ["escalade"], eq: ["salle-esc", "pan"], t: "bloc", ld: "bw", pat: "climb-aero", c: "Grimpe facile sans t\u2019arr\xEAter, avant-bras chauds mais jamais \xAB bouteill\xE9s \xBB." }),
    E("volume", "Volume de voies faciles", "grimpe", { q: ["aero", "conti", "tech"], sp: ["escalade"], eq: ["salle-esc"], t: "essai", ld: "bw", pat: "climb-aero", c: "Beaucoup de voies 2 \xE0 3 niveaux sous ton max, en soignant les placements." }),
    E("technique", "Technique", "grimpe", { q: ["tech"], sp: ["escalade"], eq: ["salle-esc", "pan"], t: "essai", ld: "bw", pat: "climb-tech", c: "Un th\xE8me par s\xE9ance : pieds pr\xE9cis, lecture, chutes, dynamique." }),
    E("blocage", "Blocages bras \xE0 90\xB0", "muscu", { q: ["force"], sp: ["escalade"], g: ["tirage"], eq: ["traction"], t: "iso", hold: "5-10 s", ld: "bw", lvl: 2, pat: "pull-iso", c: "Coude \xE0 90\xB0, 5 \xE0 10 s, une ou deux mains selon le niveau." }),
    // ---- Mobilité
    E("mob-hanches", "Mobilit\xE9 des hanches", "recup", { q: ["mobi"], t: "mob", ld: "bw", pat: "mobi", c: "90/90, fente basse, papillon : 1 min par position." }),
    E("mob-epaules", "Mobilit\xE9 des \xE9paules", "recup", { q: ["mobi"], t: "mob", ld: "bw", pat: "mobi", c: "Passages de b\xE2ton, ouvertures thoraciques au sol." }),
    E("mob-chevilles", "Mobilit\xE9 des chevilles", "recup", { q: ["mobi"], t: "mob", ld: "bw", pat: "mobi", c: "Genou au mur, 10 r\xE9p\xE9titions par c\xF4t\xE9." }),
    E("mob-doigts", "\xC9tirements des fl\xE9chisseurs", "recup", { q: ["mobi"], sp: ["escalade"], t: "mob", ld: "bw", pat: "mobi", c: "Doigts en extension, poignet en arri\xE8re, 30 s, sans douleur." }),
    E("mob-dos", "Mobilit\xE9 du dos", "recup", { q: ["mobi"], t: "mob", ld: "bw", pat: "mobi", c: "Chat-vache, rotations thoraciques allong\xE9." })
  ];
  var LIB_BY_ID = Object.fromEntries(LIB.map((x) => [x.id, x]));
  var norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\[[a-z]+\]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  var BY_NAME = new Map(LIB.map((x) => [norm(x.n), x]));
  function libMatch(label) {
    const n = norm(label);
    if (!n) return null;
    if (BY_NAME.has(n)) return BY_NAME.get(n);
    let best = null;
    for (const [k, x] of BY_NAME) if (n.startsWith(k) && (!best || k.length > norm(best.n).length)) best = x;
    return best;
  }
  var GOALS = [
    { id: "force", l: "Force maximale", d: "Soulever, tirer ou pousser plus lourd", sys: "neuro" },
    { id: "hyper", l: "Masse musculaire", d: "Prendre du muscle", sys: "hyper" },
    { id: "puiss", l: "Puissance", d: "Sauter, lancer, \xEAtre explosif", sys: "alac" },
    { id: "vit", l: "Vitesse", d: "D\xE9marrer et sprinter plus vite", sys: "alac" },
    { id: "endu_f", l: "Endurance de force", d: "R\xE9p\xE9ter des efforts intenses sans s\u2019effondrer", sys: "lact" },
    { id: "aero", l: "Endurance", d: "Tenir longtemps, courir ou p\xE9daler plus loin", sys: "aero" },
    { id: "doigts", l: "Force des doigts", d: "Tenir des prises plus petites", sys: "neuro", sp: "escalade" },
    { id: "bloc", l: "Puissance en bloc", d: "Passer les mouvements durs", sys: "alac", sp: "escalade" },
    { id: "resist", l: "R\xE9sistance", d: "Ne plus \xAB bouteiller \xBB dans les voies", sys: "lact", sp: "escalade" },
    { id: "conti", l: "Continuit\xE9", d: "Grimper longtemps sans fatigue", sys: "aero", sp: "escalade" },
    { id: "compet", l: "Comp\xE9tition de bloc", d: "Passer des blocs nouveaux, vite et sous pression", sys: "alac", sp: "escalade" },
    { id: "prev", l: "Pr\xE9vention", d: "Se blesser moins : \xE9paules, doigts, dos, genoux", sys: "prev" }
  ];
  var GOAL_BY_ID = Object.fromEntries(GOALS.map((g) => [g.id, g]));
  var SYSTEMS = {
    neuro: { l: "Force neuromusculaire", d: "Charges lourdes (environ 80 % du max et plus), 1 \xE0 6 r\xE9p\xE9titions, 2 \xE0 5 min de r\xE9cup\xE9ration : le syst\xE8me nerveux apprend \xE0 recruter plus de fibres.", src: ["acsm2009", "nsca2016"] },
    hyper: { l: "Hypertrophie", d: "6 \xE0 12 r\xE9p\xE9titions proches de l\u2019\xE9chec, au moins 10 s\xE9ries par muscle et par semaine, 1 min 30 \xE0 3 min de repos.", src: ["schoenfeld2017", "schoenfeld2016"] },
    alac: { l: "Fili\xE8re ana\xE9robie alactique", d: "Efforts quasi maximaux de moins de 10 s, aliment\xE9s par la phosphocr\xE9atine. R\xE9cup\xE9ration longue : 1:12 \xE0 1:20 (2 \xE0 3 min pour 10 s).", src: ["nsca2016"] },
    lact: { l: "Fili\xE8re ana\xE9robie lactique", d: "Efforts intenses de 20 s \xE0 2 min, ceux qui \xAB br\xFBlent \xBB. R\xE9cup\xE9ration de 1:3 \xE0 1:5.", src: ["nsca2016", "buchheit2013"] },
    aero: { l: "Fili\xE8re a\xE9robie", d: "Efforts de plus de 2 \xE0 3 min. Environ 80 % du temps en facile et 20 % en intervalles intenses (entra\xEEnement polaris\xE9).", src: ["stoggl2014", "buchheit2013"] },
    prev: { l: "Pr\xE9vention", d: "Renforcer les zones fragiles de ton sport et les antagonistes, entretenir la mobilit\xE9.", src: ["vandyk2019"] }
  };
  function quiz(cl) {
    return [
      { id: "lim", q: cl ? "En voie ou en bloc, tu \xE9choues plut\xF4t parce que\u2026" : "Dans ton sport, ce qui te limite le plus, c\u2019est\u2026", opts: [
        { id: "force", l: cl ? "Les prises sont trop petites ou les mouvements trop durs, m\xEAme frais" : "La force : charges lourdes, duels, contacts", w: cl ? { doigts: 3, bloc: 1 } : { force: 3, puiss: 1 } },
        { id: "expl", l: cl ? "Il manque de l\u2019explosivit\xE9 : jet\xE9s, mouvements dynamiques" : "L\u2019explosivit\xE9 : sauts, d\xE9marrages, lancers", w: cl ? { bloc: 3, puiss: 1 } : { puiss: 3, vit: 1 } },
        { id: "lact", l: cl ? "Les avant-bras \xAB bouteillent \xBB au bout de 20 \xE0 40 mouvements" : "\xC7a br\xFBle et je l\xE2che apr\xE8s 30 s \xE0 2 min d\u2019effort intense", w: cl ? { resist: 3 } : { endu_f: 3 } },
        { id: "aero", l: cl ? "Je fatigue sur les longues voies ou les longues s\xE9ances" : "Je m\u2019essouffle ou je ralentis quand \xE7a dure", w: cl ? { conti: 3, aero: 1 } : { aero: 3 } },
        { id: "vit", l: "La vitesse : les premiers m\xE8tres, les sprints r\xE9p\xE9t\xE9s", w: { vit: 3, puiss: 1 }, hide: cl },
        { id: "hyper", l: "Je veux surtout prendre du muscle", w: { hyper: 3 } },
        { id: "blesse", l: "Je me blesse souvent ou j\u2019ai des douleurs qui reviennent", w: { prev: 3 } }
      ].filter((o) => !o.hide) },
      { id: "duree", q: "L\u2019effort le plus important de ton sport dure\u2026", opts: [
        { id: "court", l: "Moins de 10 s (un mouvement, un sprint, un saut)", w: { force: 1, puiss: 1, vit: 1, doigts: 1, bloc: 1 } },
        { id: "moyen", l: "De 20 s \xE0 2 min", w: { endu_f: 1, resist: 1 } },
        { id: "long", l: "Plusieurs minutes ou plus", w: { aero: 1, conti: 1 } },
        { id: "mixte", l: "Un peu de tout", w: {} }
      ] },
      { id: "pref", q: "Ce qui te motive le plus en ce moment\u2026", opts: [
        { id: "perf", l: "Un objectif de performance (comp\xE9tition, projet, chrono)", w: cl ? { compet: 1 } : {} },
        { id: "phys", l: "Mon physique", w: { hyper: 1 } },
        { id: "sante", l: "\xCAtre en forme et sans douleur", w: { prev: 1, aero: 1 } }
      ] }
    ];
  }
  function quizResult(answers, cl) {
    const sc = {};
    for (const q of quiz(cl)) {
      const o = q.opts.find((x) => x.id === answers[q.id]);
      if (o) for (const [g, v] of Object.entries(o.w)) sc[g] = (sc[g] || 0) + v;
    }
    const ok = GOALS.filter((g) => cl || g.sp !== "escalade").map((g) => g.id);
    return Object.entries(sc).filter(([g]) => ok.includes(g)).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  }

  // src/lib/levels.js
  var LIFTS = {
    squat: { l: "Squat", test: "squat-1rm", libs: ["squat"] },
    bench: { l: "D\xE9velopp\xE9 couch\xE9", test: "bench-1rm", libs: ["dc"] },
    deadlift: { l: "Soulev\xE9 de terre", test: "deadlift-1rm", libs: ["sdt"] },
    pull: { l: "Traction lest\xE9e", test: "pull-1rm", test5: "pull-5rm", libs: ["tractions-lest", "tractions"], lest: true },
    dips: { l: "Dips lest\xE9s", test: "dips-1rm", libs: ["dips"], lest: true }
  };
  var LIFT_OF_LIB = Object.fromEntries(Object.entries(LIFTS).flatMap(([k, v]) => v.libs.map((l) => [l, k])));
  var CLIMB_KEYS = [["bf", "bloc", "flash", "Bloc \xB7 flash"], ["bm", "bloc", "max", "Bloc \xB7 max encha\xEEn\xE9"], ["vf", "voie", "\xE0 vue", "Voie \xB7 \xE0 vue"], ["vm", "voie", "max", "Voie \xB7 max encha\xEEn\xE9"]];
  var levelsDoc = (o) => profileOf(o == null ? getSubject() : o).levels || {};
  function setLevel(key, val, sub) {
    const p = getFor(SELF, "profile") || {}, lv = Object.assign({}, p.levels), at = Object.assign({}, lv.at);
    if (sub) {
      const o = Object.assign({}, lv[key]);
      if (val == null || val === "") delete o[sub];
      else o[sub] = val;
      lv[key] = o;
      at[key + "." + sub] = todayKey();
    } else {
      if (val == null || val === "") delete lv[key];
      else lv[key] = val;
      at[key] = todayKey();
    }
    lv.at = at;
    putFor(SELF, "profile", Object.assign({}, p, { levels: lv }));
  }
  var newest = (list) => list.filter((x) => x && x.v > 0).sort((a, b) => a.k < b.k ? 1 : -1)[0] || null;
  var epley = (w, n) => w * (1 + n / 30);
  function oneRM(lift, o, cfgLv) {
    const L = LIFTS[lift];
    if (!L) return null;
    const lv = cfgLv || levelsDoc(o), at = lv.at || {}, cand = [];
    const bwAt = (k) => bodyWeightAt(k) || 0;
    for (const h of history(L.test)) {
      const v = h.vals && h.vals.v;
      if (typeof v === "number") cand.push({ k: h.k, v: L.lest ? (h.bw || bwAt(h.k)) + v : v, src: "test" });
    }
    if (L.test5) for (const h of history(L.test5)) {
      const v = h.vals && h.vals.v;
      if (typeof v === "number") cand.push({ k: h.k, v: ((h.bw || bwAt(h.k)) + v) * 1.167, src: "test 5RM" });
    }
    const dec = lv.rm && typeof lv.rm[lift] === "number" ? lv.rm[lift] : null;
    if (dec != null) {
      const k = at["rm." + lift] || "2000-01-01";
      cand.push({ k, v: L.lest ? bwAt(todayKey()) + dec : dec, src: "d\xE9clar\xE9" });
    }
    const from = addDays(todayKey(), -120);
    let est = null;
    for (const id of ids("j:")) {
      const k = id.slice(2);
      if (k < from || k > todayKey()) continue;
      const e = jget(k);
      for (const b of blocks(k)) for (const it of b.items || []) {
        const lid = it.lib || (libMatch(it.label) || {}).id;
        if (!L.libs.includes(lid)) continue;
        const key = itemKey(b, it), n = doneN(e, key, it.n);
        if (!n) continue;
        const reps = it.reps || (it.rx && it.rx.r ? it.rx.r[0] : null);
        if (!reps) continue;
        const rir = e.rir && typeof e.rir[key] === "number" ? e.rir[key] : 2;
        const sl = setLoadsOf(e, key), ld = itemLoad(b, it, e), w = sl ? Math.max(...sl) : ld ? ld.v : null;
        if (w == null) continue;
        const tot = (it.unit_load === "+kg" || L.lest ? bwAt(k) : 0) + w, v = epley(tot, reps + Math.min(4, rir));
        if (!est || v > est.v) est = { k, v, src: "estim\xE9" };
      }
    }
    if (est) cand.push(est);
    const best = newest(cand);
    if (!best) return null;
    const bw = bwAt(todayKey());
    const r = Math.round(best.v * 2) / 2;
    const lest = L.lest ? Math.round((r - bw) * 2) / 2 : null;
    return { v: r, lest, lift, src: best.src, k: best.k, txt: L.lest ? (lest >= 0 ? "+" : "") + String(lest).replace(".", ",") + " kg" : String(r).replace(".", ",") + " kg" };
  }
  function loadForPct(rm, pct2) {
    if (!rm) return null;
    const bw = LIFTS[rm.lift].lest ? bodyWeightAt(todayKey()) || 0 : 0;
    const tot = rm.v * pct2 / 100, raw = tot - bw, s = Math.abs(raw) < 20 ? 1.25 : 2.5;
    return Math.round(raw / s) * s;
  }
  function climbLevel(o, cfgLv) {
    const lv = cfgLv || levelsDoc(o), out = {};
    for (const [k, disc] of CLIMB_KEYS) if (lv[k] && gradeIdx(lv[k], disc) != null) out[k] = { g: lv[k], src: "d\xE9clar\xE9" };
    if (!out.bf || !out.bm) {
      let top = null;
      const from = addDays(todayKey(), -90);
      for (const id of ids("j:")) {
        const k = id.slice(2);
        if (k < from) continue;
        const e = jget(k);
        for (const arr of Object.values(e.cl || {})) for (const x of arr || []) {
          const ix = gradeIdx(x.g, "bloc");
          if (!x.f && ix != null && (top == null || ix > top)) top = ix;
        }
      }
      if (top != null) {
        if (!out.bm) out.bm = { g: gradeAt(top, "bloc"), src: "estim\xE9" };
        if (!out.bf) out.bf = { g: gradeAt(top - 1, "bloc"), src: "estim\xE9" };
      }
    }
    return out;
  }
  function vmaOf(o, cfgLv) {
    const lv = cfgLv || levelsDoc(o), cand = [];
    for (const h of history("vma")) if (h.vals && typeof h.vals.v === "number") cand.push({ k: h.k, v: h.vals.v, src: "test" });
    if (typeof lv.vma === "number") cand.push({ k: (lv.at || {}).vma || "2000-01-01", v: lv.vma, src: "d\xE9clar\xE9e" });
    return newest(cand);
  }
  function fcmaxOf(o, cfgLv) {
    const lv = cfgLv || levelsDoc(o);
    if (typeof lv.fcmax === "number") return { v: lv.fcmax, src: "d\xE9clar\xE9e" };
    const p = profileOf(o == null ? getSubject() : o);
    if (p.birth_year) {
      const age = (/* @__PURE__ */ new Date()).getFullYear() - p.birth_year;
      return { v: Math.round(208 - 0.7 * age), src: "estim\xE9e (Tanaka)" };
    }
    return null;
  }
  function paceAt(vma, pct2) {
    const kmh = vma * pct2 / 100;
    if (!(kmh > 0)) return null;
    const s = Math.round(3600 / kmh);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  var srcTxt = (r) => r ? r.src === "d\xE9clar\xE9" || r.src === "d\xE9clar\xE9e" ? r.src : r.src + (r.k && r.k > "2000" ? " le " + fmtDay(r.k) : "") : "";
  function csOf() {
    const h = history("cs");
    for (let i = h.length - 1; i >= 0; i--) {
      const v = h[i].vals || {};
      if (v.d3 > 0 && v.d12 > v.d3) {
        const ms = (v.d12 - v.d3) / 540;
        return { v: Math.round(ms * 36) / 10, ms, dp: Math.max(0, Math.round((v.d3 - ms * 180) / 5) * 5), k: h[i].k, src: "test" };
      }
    }
    return null;
  }
  var paceCs = (cs, pct2) => paceAt(cs.v, pct2);
  function vo2Of(o, cfgLv) {
    const lv = cfgLv || levelsDoc(o), cand = [];
    for (const h of history("vo2max")) if (h.vals && typeof h.vals.v === "number") cand.push({ k: h.k, v: h.vals.v, src: "test" });
    if (typeof lv.vo2 === "number") cand.push({ k: (lv.at || {}).vo2 || "2000-01-01", v: lv.vo2, src: "d\xE9clar\xE9e" });
    const best = newest(cand);
    if (best) return best;
    const vma = vmaOf(o, cfgLv);
    return vma ? { v: Math.round(vma.v * 3.5), src: "estim\xE9e d\u2019apr\xE8s ta VMA", k: vma.k } : null;
  }
  function ftpOf(o, cfgLv) {
    const lv = cfgLv || levelsDoc(o), cand = [];
    for (const h of history("ftp")) if (h.vals && h.vals.p20 > 0) cand.push({ k: h.k, v: Math.round(h.vals.p20 * 0.95), src: "test" });
    if (typeof lv.ftp === "number") cand.push({ k: (lv.at || {}).ftp || "2000-01-01", v: lv.ftp, src: "d\xE9clar\xE9e" });
    return newest(cand);
  }
  function runProfile(o, cfgLv) {
    const cs = csOf(), vma = vmaOf(o, cfgLv);
    if (!cs || !vma) return null;
    const r = Math.round(cs.v / vma.v * 100);
    const txt = r >= 88 ? "profil endurant : ta marge de progr\xE8s est surtout la VMA (intervalles courts)." : r <= 80 ? "profil plut\xF4t rapide : ta marge est surtout l\u2019endurance (seuil, sorties longues)." : "profil \xE9quilibr\xE9 : garde les deux.";
    return { r, txt: "Vitesse critique \xE0 " + r + " % de ta VMA : " + txt };
  }

  // src/lib/warmup.js
  var R = (t, d) => ({ ph: "R", t, d });
  var A = (t, d) => ({ ph: "A", t, d });
  var P = (t, d) => ({ ph: "P", t, d });
  var PH_LBL = { R: "Monter en temp\xE9rature", A: "Activer et mobiliser", P: "Potentialiser" };
  var r25 = (v) => Math.round(v / 2.5) * 2.5;
  function focusOf(b) {
    const its = (b.items || []).filter((it) => it.id !== "ech" && it.id !== "rac");
    const has = (re) => its.some((it) => re.test((it.label || "") + " " + (it.det || "") + " " + (it.lib || "")));
    if (b.kind === "doigts") return "doigts";
    if (b.kind === "compet" || has(/qualif|contest|flash|compet/i)) return "compet";
    if (b.kind === "grimpe") {
      if (its.some((it) => it.unit === "Essai") || has(/limite|campus|pan/i)) return "limite";
      if (has(/4 ?[×x] ?4|résistance|intervalles|enchaîn/i)) return "resist";
      return "volume";
    }
    if (["muscu", "renfo"].includes(b.kind)) return its.some((it) => it.timer && it.timer.kind === "contrast") || has(/explosi|saut|puissance/i) ? "puiss" : "force";
    if (b.kind === "epaule") return "epaule";
    if (b.kind === "course") return has(/sprint|vitesse/i) ? "sprint" : has(/intervalle|30\/30|seuil|300 m|vite/i) ? "int" : "easy";
    if (b.kind === "velo") return has(/4 ?× ?4|sweet|lactique|vite|circuit/i) ? "velo-int" : "velo-easy";
    if (b.kind === "sport") return "sport";
    return null;
  }
  function rampSets(k, b) {
    const e = jget(k);
    for (const it of b.items || []) {
      if (it.id === "ech") continue;
      const ld = itemLoad(b, it, e);
      if (!ld || ld.v == null) continue;
      const w = ld.v;
      if (ld.u === "+kg") return { it, txt: "poids de corps \xD7 5, puis " + (w > 5 ? "+" + fmtNum(r25(w * 0.5)) + " kg \xD7 3, +" + fmtNum(r25(w * 0.8)) + " kg \xD7 1" : "une s\xE9rie \xE0 la charge du jour \xD7 2") };
      if (w < 30) return { it, txt: fmtNum(r25(w * 0.5)) + " kg \xD7 8, puis " + fmtNum(r25(w * 0.75)) + " kg \xD7 4" };
      const bar = 20, steps = [[Math.max(bar, r25(w * 0.4)), 8], [r25(w * 0.6), 5], [r25(w * 0.75), 3], [r25(w * 0.88), 1]].filter((x, i, a) => i === 0 || x[0] > a[i - 1][0]);
      return { it, txt: steps.map(([v, n]) => fmtNum(v) + " kg \xD7 " + n).join(", ") };
    }
    return null;
  }
  function warmupFor(k, b) {
    const f = focusOf(b);
    if (!f) return null;
    const lv = climbLevel(), bf = lv.bf && lv.bf.g, bm = lv.bm && lv.bm.g;
    const climbUp = (top) => bf ? "de " + shiftGrade(bf, -4, "bloc") + " \xE0 " + (top || shiftGrade(bf, -1, "bloc")) : "de tr\xE8s facile jusqu\u2019\xE0 1 ou 2 niveaux sous " + (top ? "ta limite" : "ton niveau du jour");
    const mobUp = A("Mobilit\xE9 du haut du corps", "Cercles d\u2019\xE9paules, rotations externes \xE0 l\u2019\xE9lastique 2 \xD7 10, flexions-extensions des poignets, ouverture des doigts");
    switch (f) {
      case "doigts":
      case "limite":
      case "compet":
        return { min: f === "compet" ? 25 : 20, steps: [
          R("Grimpe tr\xE8s facile ou cardio l\xE9ger", "5 \xE0 8 min, jusqu\u2019\xE0 transpirer un peu"),
          mobUp,
          A("Hanches et gainage", "Grenouille au mur, fentes, 2 \xD7 20 s de gainage"),
          Object.assign(P("Doigts en rampe \xB7 7 \xD7 7/3", "7 suspensions de 7 s, 3 s de pause, en montant progressivement la charge d\u2019une suspension \xE0 l\u2019autre et en changeant de pr\xE9hension (tendu, semi-arqu\xE9, arqu\xE9, pince)"), { timer: { kind: "interval", name: "Doigts 7/3", work: 7, rest: 3, reps: 7, sets: 1, setRest: 0, prep: 10, workLabel: "Suspends", restLabel: "Pause" }, src: ["remilieux"] }),
          P("Blocs de plus en plus durs", "4 \xE0 6 blocs " + climbUp(f === "doigts" ? null : bm) + ", repos complet entre les derniers"),
          P(f === "compet" ? "Mise en situation" : "1 ou 2 essais proches du max", f === "compet" ? "1 bloc lu puis tent\xE9 comme en comp\xE9tition, 3 min de repos avant de commencer" : "Mouvements durs mais propres : tu dois finir l\u2019\xE9chauffement frais")
        ], why: "Les doigts et les \xE9paules montent en charge progressivement avant les efforts maximaux : force et pr\xE9cision sont meilleures, le risque de blessure plus bas. Doigts : 7 \xD7 7/3 de Julien Remilieux." };
      case "resist":
        return { min: 15, steps: [
          R("Grimpe tr\xE8s facile", "5 min"),
          mobUp,
          P("Blocs progressifs", "3 ou 4 blocs " + climbUp(null)),
          P("Un avant-go\xFBt", "1 encha\xEEnement court (2 blocs) au niveau de la s\xE9ance, puis 3 min de repos")
        ], why: "La fili\xE8re lactique se pr\xE9pare avec un effort court au niveau de la s\xE9ance." };
      case "volume":
        return { min: 10, steps: [
          R("Travers\xE9es faciles", "5 min de grimpe tr\xE8s facile"),
          mobUp,
          P("Monter jusqu\u2019\xE0 la cotation du jour", "2 ou 3 blocs de plus en plus proches de celle de la s\xE9ance")
        ], why: "S\xE9ance \xE0 intensit\xE9 mod\xE9r\xE9e : un \xE9chauffement court suffit, le d\xE9but de s\xE9ance finit le travail." };
      case "force":
      case "puiss": {
        const rs = rampSets(k, b);
        const steps = [
          R("Cardio l\xE9ger", "5 min de v\xE9lo, rameur ou corde \xE0 sauter"),
          A("Mobiliser et activer", "Hanches et chevilles (squats lents, fentes), \xE9paules (\xE9lastique), 2 \xD7 20 s de gainage"),
          P("S\xE9ries de mont\xE9e en charge", rs ? rs.it.label + " : " + rs.txt + " \xB7 repos court entre les s\xE9ries" : "3 ou 4 s\xE9ries de plus en plus lourdes sur le premier exercice, de moins en moins de r\xE9p\xE9titions")
        ];
        if (f === "puiss") steps.push(P("R\xE9veil nerveux", "3 sauts verticaux ou 2 lancers, intention maximale"));
        return { min: 12, steps, why: "Les s\xE9ries de mont\xE9e pr\xE9parent le mouvement et le syst\xE8me nerveux sans fatiguer : environ 40, 60, 75 puis 85-90 % de la charge du jour." };
      }
      case "epaule":
        return { min: 5, steps: [
          R("Cercles de bras", "2 \xE0 3 min de mouvements d\u2019\xE9paules"),
          A("Activer la coiffe", "Rotations externes \xE0 l\u2019\xE9lastique l\xE9ger, 2 \xD7 12"),
          P("Une s\xE9rie l\xE9g\xE8re", "Le premier exercice \xE0 environ 50 % de la charge, 8 r\xE9p\xE9titions")
        ], why: "Petits muscles stabilisateurs : une activation l\xE9g\xE8re suffit." };
      case "int":
      case "sprint":
        return { min: 20, steps: [
          R("Footing", "10 \xE0 15 min faciles"),
          A("Gammes", "Mont\xE9es de genoux, talons-fesses, pas chass\xE9s, foul\xE9es bondissantes : 2 \xD7 20 m chacun"),
          P("Acc\xE9l\xE9rations", (f === "sprint" ? "4 acc\xE9l\xE9rations de 30 m jusqu\u2019\xE0 la vitesse maximale" : "3 acc\xE9l\xE9rations progressives de 80 m, la derni\xE8re \xE0 l\u2019allure de la s\xE9ance") + ", retour en marchant")
        ], why: "Les acc\xE9l\xE9rations am\xE8nent progressivement \xE0 l\u2019intensit\xE9 de la s\xE9ance (potentialisation)." };
      case "easy":
        return { min: 5, steps: [R("D\xE9marrer tr\xE8s lentement", "Les 5 \xE0 10 premi\xE8res minutes plus lentes que l\u2019allure pr\xE9vue : c\u2019est l\u2019\xE9chauffement")], why: "En endurance facile, le d\xE9but de la sortie sert d\u2019\xE9chauffement." };
      case "velo-int":
        return { min: 15, steps: [
          R("P\xE9dalage progressif", "10 min en endurance, en montant doucement"),
          P("Rappels d\u2019intensit\xE9", "3 \xD7 1 min \xE0 l\u2019intensit\xE9 de la s\xE9ance, 1 min facile entre")
        ], why: "Les rappels courts pr\xE9parent le c\u0153ur et les jambes \xE0 l\u2019intensit\xE9 des intervalles." };
      case "velo-easy":
        return { min: 5, steps: [R("D\xE9marrer souple", "5 \xE0 10 min tr\xE8s faciles, cadence haute")], why: "En endurance, le d\xE9but de la sortie sert d\u2019\xE9chauffement." };
      case "sport":
        return { min: 15, steps: [
          R("Course l\xE9g\xE8re", "5 min"),
          A("Mobiliser", "Hanches, chevilles, \xE9paules : mouvements dynamiques du sport"),
          P("Gestes du sport", "D\xE9marrages, changements de direction, gestes techniques \xE0 vitesse croissante")
        ], why: "\xC9chauffement RAMP : du g\xE9n\xE9ral au sp\xE9cifique." };
    }
    return null;
  }
  function warmupOfDay(k) {
    for (const b of blocks(k)) {
      const w = warmupFor(k, b);
      if (w) return { b, w };
    }
    return null;
  }

  // src/lib/adapt.js
  var MAIN_KINDS = ["grimpe", "doigts", "muscu", "velo", "course", "compet", "test", "sport"];
  var STRENGTH = ["muscu", "renfo", "epaule"];
  function minsOf(s) {
    const str = String(s || ""), h = str.match(/(\d+)\s*h\s*(\d{2})?(?![a-zà-ÿ])/i);
    const m = str.match(/(\d+(?:[.,]\d+)?)\s*(?:(?:à|-|–)\s*(\d+(?:[.,]\d+)?)\s*)?min/);
    if (!m) return h ? +h[1] * 60 + (h[2] ? +h[2] : 0) : null;
    const a = parseFloat(m[1].replace(",", ".")), b = m[2] ? parseFloat(m[2].replace(",", ".")) : null;
    return b ? (a + b) / 2 : a;
  }
  var DEFAULT_MIN = { kine: 30, recup: 20, velo: 40, course: 40, sport: 60, compet: 60 };
  function costFn(b, it) {
    const T = it.timer, u = it.unit;
    const perMin = it.n > 1 ? minsOf(it.label) : null;
    if (T && T.kind === "interval") {
      const prep = T.prep || 10, sides = T.sides && T.sides.length || 1;
      if (T.markEach === "rep") return (n) => prep + n * (T.work + T.rest) - T.rest;
      return (n) => prep + n * ((T.reps || 1) * (T.work + T.rest) - T.rest) * sides + Math.max(0, n - 1) * (T.setRest || 0);
    }
    if (T && T.kind === "cluster") return (n) => n * (T.reps * 5 + (T.reps - 1) * (T.intra || 20)) + Math.max(0, n - 1) * (T.setRest || 180);
    if (T && T.kind === "contrast") return (n) => n * (30 + (T.heavyRest || 240) + 15) + Math.max(0, n - 1) * (T.lightRest || 180);
    if (T && T.kind === "tempo") {
      const sides = T.sides && T.sides.length > 1 ? 2 : 1;
      return (n) => n * ((T.prep != null ? T.prep : 5) + (T.reps || it.reps || 8) * ((T.ecc || 6) + (T.ret != null ? T.ret : 4)) * sides) + Math.max(0, n - 1) * (T.setRest || it.rest || 60);
    }
    const work = perMin ? perMin * 60 : u === "Bloc" ? 60 : u === "Voie" ? 240 : u === "Essai" ? 30 : it.reps ? it.reps * 3 + 10 : 40;
    const rest = it.rest != null ? it.rest : u === "Bloc" ? 90 : u === "Voie" ? 300 : u === "Essai" ? 180 : STRENGTH.includes(b.kind) ? 120 : 60;
    return (n) => n * work + Math.max(0, n - 1) * rest;
  }
  function groupCost(b) {
    const T = b.timer, sides = T.sides && T.sides.length || 1;
    return (n) => (T.prep || 10) + n * ((T.reps || 1) * (T.work + T.rest) - T.rest) * sides + Math.max(0, n - 1) * (T.setRest || 0);
  }
  function prioOf(b, it, idx) {
    if (it.id === "ech") return 0;
    if (it.id === "rac" || it.opt) return 4;
    if (it.extra) return 3;
    if (b.kind === "kine" || b.kind === "test") return 1;
    const r = it.rx && it.rx.role;
    if (r === "main" || r === "puiss") return 1;
    if (r === "acc") return 2;
    if (r === "prev") return 3;
    if (["epaule", "renfo", "recup"].includes(b.kind)) return 3;
    if (!MAIN_KINDS.includes(b.kind)) return 2;
    if (["Bloc", "Voie", "Essai"].includes(it.unit) || b.kind === "doigts") return 1;
    if (b.kind === "muscu") return it.reps && it.reps <= 6 || it.n >= 5 || idx === 0 ? 1 : 2;
    return idx === 0 ? 1 : 2;
  }
  function minOf(it, prio, done) {
    const n = it.n;
    let m = ["Bloc", "Voie"].includes(it.unit) ? Math.ceil(n * 0.3) : it.timer && it.timer.markEach === "rep" ? Math.ceil(n * 0.5) : prio === 1 ? Math.min(n, 2) : n >= 3 ? 2 : 1;
    return Math.max(m, done || 0, 1);
  }
  function unitsOf(k) {
    const e = jget(k), out = [];
    let warmed = false;
    for (const b of rawBlocks(k)) {
      if (b.kind === "rest" || b.kind === "kine" || blockState(e, b)) continue;
      const its = b.items || [];
      if (b.timer && its.some((it) => it.id !== "ech")) {
        const ech2 = its.find((it) => it.id === "ech");
        if (ech2) {
          out.push(warmUnit(k, b, ech2, warmed));
          warmed = true;
        }
        const g = its.filter((it) => it.id !== "ech"), n0 = b.timer.sets || 1, done = Math.min(...g.map((it) => doneN(e, itemKey(b, it), it.n)));
        out.push({ key: "b:" + b.id, b, label: b.timer && b.timer.name || b.title, prio: b.kind === "doigts" ? 1 : prioOf(b, g[0], 0), n0, min: Math.max(1, done), done0: done, started: done > 0, cost: groupCost(b), order: out.length });
        continue;
      }
      its.forEach((it, i) => {
        if (it.id === "ech") {
          out.push(warmUnit(k, b, it, warmed));
          warmed = true;
          return;
        }
        const prio = prioOf(b, it, its.filter((x) => x.id !== "ech").indexOf(it)), done = doneN(e, itemKey(b, it), it.n);
        if (it.n === 1 && !it.timer) {
          const m0 = minsOf(it.label) || minsOf(it.det) || DEFAULT_MIN[b.kind] || 10;
          const elastic = ["velo", "course", "recup"].includes(b.kind) || b.kind === "grimpe" && (minsOf(it.label) || /continuit|travers|volume/i.test(it.label + " " + (it.det || "")));
          out.push({ key: itemKey(b, it), b, it, label: it.label, prio, mins: m0, minMins: elastic ? Math.min(m0, Math.max(15, Math.round(m0 / 3))) : m0, done: done > 0, order: out.length });
          return;
        }
        out.push({ key: itemKey(b, it), b, it, label: it.label, prio, n0: it.n, min: minOf(it, prio, done), done0: done, started: done > 0, cost: costFn(b, it), order: out.length });
      });
    }
    return out;
  }
  function warmUnit(k, b, it, again) {
    const w = warmupFor(k, b), m0 = w && w.min || minsOf(it.det) || 10;
    return { key: itemKey(b, it), b, it, label: again ? "Remise en route" : "\xC9chauffement", prio: 0, mins: m0, minMins: Math.min(m0, again ? 4 : 6), again, warm: true, order: 0 };
  }
  var secOf = (u, n, m) => u.mins != null ? (m != null ? m : u.mins) * 60 : u.cost(n != null ? n : u.n0);
  var plannedMin = (units) => Math.round(units.reduce((a, u) => a + secOf(u), 0) / 60);
  function fitToTime(k, minutes) {
    const units = unitsOf(k), budget = minutes * 60, res = /* @__PURE__ */ new Map();
    let left = budget;
    for (const u of units.filter((x) => x.warm)) {
      const m = u.again ? u.minMins : Math.max(u.minMins, Math.min(u.mins, Math.round(minutes * 0.18)));
      res.set(u.key, { m });
      left -= m * 60;
    }
    const rest = units.filter((x) => !x.warm).sort((a, b) => a.prio - b.prio || a.order - b.order);
    const p1 = rest.filter((x) => x.prio <= 1);
    const full1 = p1.reduce((a, u) => a + secOf(u), 0);
    if (full1 <= left) {
      p1.forEach((u) => res.set(u.key, u.mins != null ? { m: u.mins } : { n: u.n0 }));
      left -= full1;
    } else {
      let pick2 = null;
      for (let f = 0.95; f >= 0; f -= 0.05) {
        const t2 = p1.map((u) => u.mins != null ? { u, m: Math.max(u.minMins, Math.round(u.mins * f)) } : { u, n: Math.max(u.min, Math.round(u.n0 * f)) });
        const s2 = t2.reduce((a, x) => a + secOf(x.u, x.n, x.m), 0);
        pick2 = { t: t2, s: s2 };
        if (s2 <= left) break;
      }
      const t = pick2.t.slice();
      let s = pick2.s;
      while (s > left && t.length > 1) {
        const x = t.pop();
        s -= secOf(x.u, x.n, x.m);
        res.set(x.u.key, { drop: true });
      }
      left -= s;
      for (let grew = true; grew; ) {
        grew = false;
        for (const x of t) {
          if (x.m != null) {
            const m2 = Math.min(x.u.mins, x.m + 5);
            if (m2 > x.m && (m2 - x.m) * 60 <= left) {
              left -= (m2 - x.m) * 60;
              x.m = m2;
              grew = true;
            }
            continue;
          }
          if (x.n < x.u.n0) {
            const d = x.u.cost(x.n + 1) - x.u.cost(x.n);
            if (d <= left) {
              left -= d;
              x.n++;
              grew = true;
            }
          }
        }
      }
      t.forEach((x) => res.set(x.u.key, x.m != null ? { m: x.m } : { n: x.n }));
    }
    for (const u of rest.filter((x) => x.prio > 1)) {
      if (u.mins != null) {
        if (u.mins * 60 <= left) {
          res.set(u.key, { m: u.mins });
          left -= u.mins * 60;
        } else if (u.minMins < u.mins && Math.floor(left / 60) >= u.minMins) {
          const m = Math.floor(left / 60 / 5) * 5 || Math.floor(left / 60);
          res.set(u.key, { m });
          left -= m * 60;
        } else res.set(u.key, u.done ? { m: u.mins } : { drop: true });
        continue;
      }
      let n = u.n0;
      while (n > u.min && u.cost(n) > left) n--;
      if (u.cost(n) <= left) {
        res.set(u.key, { n });
        left -= u.cost(n);
      } else if (u.started) {
        res.set(u.key, { n: u.min });
        left -= u.cost(u.min);
      } else res.set(u.key, { drop: true });
    }
    return result(k, units, res, "time", { min: minutes });
  }
  function lighten(k, frac) {
    const units = unitsOf(k), res = /* @__PURE__ */ new Map();
    for (const u of units) {
      if (u.warm) {
        res.set(u.key, { m: u.mins });
        continue;
      }
      if (u.mins != null) {
        res.set(u.key, { m: u.minMins < u.mins ? Math.max(u.minMins, Math.round(u.mins * (1 - frac) / 5) * 5) : u.mins });
        continue;
      }
      res.set(u.key, { n: Math.max(1, u.done0 || 0, Math.round(u.n0 * (1 - frac))) });
    }
    return result(k, units, res, "light", { frac });
  }
  function result(k, units, res, mode, extra) {
    const rows = units.map((u) => {
      const r = res.get(u.key) || {};
      if (r.drop) return { u, act: "drop", sec: 0 };
      if (u.mins != null) {
        const m = r.m != null ? r.m : u.mins;
        return { u, act: m < u.mins ? "short" : "full", m, sec: m * 60 };
      }
      const n = r.n != null ? r.n : u.n0;
      return { u, act: n < u.n0 ? "reduce" : "full", n, sec: u.cost(n) };
    });
    const base = plannedMin(units), total = Math.round(rows.reduce((a, x) => a + x.sec, 0) / 60);
    return Object.assign({ k, mode, base, total, rows }, extra);
  }
  var fmtM = (m) => Math.round(m) + " min";
  function applyAdjust(r) {
    const items = {};
    for (const x of r.rows) {
      if (x.act === "full") continue;
      if (x.act === "drop") {
        items[x.u.key] = { drop: true };
        continue;
      }
      if (x.act === "reduce") {
        items[x.u.key] = { n: x.n };
        continue;
      }
      if (x.act === "short") items[x.u.key] = { note: (x.u.warm ? "Raccourci \xE0 " : "") + fmtM(x.m) + (x.u.warm ? "" : " au lieu de " + fmtM(x.u.mins)) };
    }
    jset(r.k, { adj: { mode: r.mode, min: r.min || null, frac: r.frac || null, base: r.base, total: r.total, at: Date.now(), items } });
  }
  function clearAdjust(k) {
    jset(k, { adj: null });
  }
  function adjSummary(k) {
    const a = jget(k).adj;
    if (!a || !a.items) return null;
    const raw = rawBlocks(k), name = (key) => {
      if (key.startsWith("b:")) {
        const b2 = raw.find((x) => x.id === key.slice(2));
        return b2 ? b2.timer && b2.timer.name || b2.title : null;
      }
      const [bid, iid] = key.split("."), b = raw.find((x) => x.id === bid), it = b && (b.items || []).find((x) => x.id === iid);
      return it ? it.label : null;
    };
    const dropped = Object.entries(a.items).filter(([, v]) => v.drop).map(([key]) => name(key)).filter(Boolean);
    const reduced = Object.entries(a.items).filter(([, v]) => v.n != null).length;
    const head = a.mode === "time" ? "S\xE9ance adapt\xE9e \xE0 " + a.min + " min" + (a.base ? " (pr\xE9vue \u2248 " + a.base + " min)" : "") : a.frac >= 0.5 ? "Version d\xE9charge : moiti\xE9 des s\xE9ries" : "S\xE9ance all\xE9g\xE9e : un tiers de s\xE9ries en moins";
    const tip = a.mode === "light" ? a.frac >= 0.5 ? "Rien au maximum : garde 2 \xE0 3 r\xE9p\xE9titions en r\xE9serve, cotations un cran en dessous." : "Pas de nouveau palier de charge aujourd\u2019hui." : null;
    return { head, dropped, reduced, tip, mode: a.mode };
  }

  // src/lib/stats.js
  var stats_exports = {};
  __export(stats_exports, {
    alerts: () => alerts,
    currentWeekIndex: () => currentWeekIndex,
    dayPlanned: () => dayPlanned,
    dayReal: () => dayReal,
    daySeries: () => daySeries,
    loadSeries: () => loadSeries,
    tiles: () => tiles,
    weeksStats: () => weeksStats
  });

  // src/lib/sports.js
  var sports_exports = {};
  __export(sports_exports, {
    CARDIO_SPORTS: () => CARDIO_SPORTS,
    DIETS: () => DIETS,
    DIET_LBL: () => DIET_LBL,
    SPORTS: () => SPORTS,
    SPORT_LBL: () => SPORT_LBL,
    climber: () => climber,
    dietOf: () => dietOf,
    hasCardio: () => hasCardio,
    hasOtherSport: () => hasOtherSport,
    mySportsAsked: () => mySportsAsked,
    relevantActs: () => relevantActs,
    relevantKinds: () => relevantKinds,
    relevantTestCats: () => relevantTestCats,
    sportsOf: () => sportsOf
  });
  var SPORTS = [
    ["escalade", "Escalade"],
    ["muscu", "Musculation"],
    ["course", "Course \xE0 pied"],
    ["trail", "Trail / montagne"],
    ["velo", "V\xE9lo"],
    ["natation", "Natation"],
    ["hyrox", "Hyrox / cross-training"],
    ["collectif", "Sport collectif"],
    ["combat", "Sport de combat"],
    ["autre", "Autre sport"]
  ];
  var SPORT_LBL = Object.fromEntries(SPORTS);
  var DIETS = [["omni", "Omnivore"], ["vege", "V\xE9g\xE9tarien"], ["vegan", "V\xE9gan"]];
  var DIET_LBL = Object.fromEntries(DIETS);
  var CARDIO_SPORTS = ["course", "trail", "velo", "natation"];
  var SPORTISH = ["collectif", "combat", "autre"];
  function sportsOf(o) {
    const s = profileOf(o == null ? getSubject() : o).sports;
    return Array.isArray(s) && s.length ? s : null;
  }
  var mySportsAsked = () => Array.isArray((getFor(SELF, "profile") || {}).sports);
  var climber = (o) => {
    const s = sportsOf(o);
    return !s || s.includes("escalade");
  };
  var hasCardio = (o) => {
    const s = sportsOf(o);
    return !s || s.some((x) => CARDIO_SPORTS.includes(x) || x === "hyrox");
  };
  var hasOtherSport = (o) => {
    const s = sportsOf(o);
    return !!s && s.some((x) => SPORTISH.includes(x));
  };
  var dietOf = (o) => profileOf(o == null ? getSubject() : o).diet || "omni";
  function relevantActs(o) {
    const s = sportsOf(o);
    if (!s) return null;
    const out = /* @__PURE__ */ new Set(["force", "kine", "mobi"]);
    if (s.includes("escalade")) out.add("grimpe");
    if (s.some((x) => CARDIO_SPORTS.includes(x) || x === "hyrox")) out.add("cardio");
    if (s.some((x) => SPORTISH.includes(x))) out.add("sport");
    return out;
  }
  function relevantKinds(o) {
    const s = sportsOf(o);
    if (!s) return null;
    const out = /* @__PURE__ */ new Set(["muscu", "renfo", "kine", "recup", "test", "autre"]);
    if (s.includes("escalade")) ["grimpe", "doigts", "epaule", "compet", "affut"].forEach((k) => out.add(k));
    if (s.some((x) => ["course", "trail", "hyrox"].includes(x))) out.add("course");
    if (s.some((x) => ["velo", "natation", "hyrox", "trail"].includes(x))) out.add("velo");
    if (s.some((x) => SPORTISH.includes(x))) {
      out.add("sport");
      out.add("compet");
    }
    return out;
  }
  function relevantTestCats(o) {
    const s = sportsOf(o);
    if (!s) return null;
    const out = /* @__PURE__ */ new Set(["gainage", "mobilite", "corps", "perso", "force", "puissance"]);
    if (s.includes("escalade")) ["doigts", "tirage", "poussee", "epaule"].forEach((c) => out.add(c));
    if (s.some((x) => ["muscu", "hyrox", "combat"].includes(x))) ["tirage", "poussee"].forEach((c) => out.add(c));
    if (s.some((x) => CARDIO_SPORTS.includes(x) || ["hyrox", "collectif", "combat"].includes(x))) out.add("aerobie");
    return out;
  }

  // src/lib/stats.js
  function dayPlanned(k) {
    const t = target(k);
    return t ? (t.i || 0) + (t.v || 0) : 0;
  }
  function dayReal(k) {
    const e = jget(k);
    if (e.siv && typeof e.siv.i === "number" && typeof e.siv.v === "number") return e.siv.i + e.siv.v;
    if (e.status === "faite") return dayPlanned(k);
    if (e.status === "sautee") return 0;
    return null;
  }
  var climbing = (k) => blocks(k).some((b) => ["grimpe", "doigts", "test", "compet", "affut"].includes(b.kind));
  function weeksStats() {
    const m = meta();
    if (!m) return [];
    const cl = climber();
    return m.weeks.map((w, wi) => {
      const ks = weekKeys(w);
      let plan = 0, real = 0, rh = false, ua = 0, uh = false, wsum = 0, wn = 0, ssum = 0, sn = 0, items = 0, itemsDone = 0;
      const tz = [0, 0, 0];
      for (const k of ks) {
        plan += dayPlanned(k);
        const r = dayReal(k);
        if (r !== null) {
          real += r;
          rh = true;
        }
        const e = jget(k);
        for (const x of sessionsOf(e)) {
          ua += x.rpe * x.duree;
          uh = true;
          if (!cl || climbing(k)) tz[zoneOf(x.rpe)] += x.duree;
        }
        const t = score(e);
        if (t !== null) {
          wsum += t;
          wn++;
        }
        const nt = nightTotal(e);
        if (nt !== null) {
          ssum += nt;
          sn++;
        }
        if (k <= todayKey()) for (const { b, it, key } of allItems(k)) {
          if (e.moved && e.moved[b.id]) continue;
          const v = doneN(e, key, it.n);
          if (it.opt && !v) continue;
          items++;
          if (v >= it.n) itemsDone++;
        }
      }
      return {
        wi,
        w,
        ks,
        label: weekLabel(w),
        range: fmtRange(w.start, w.end),
        phase: PHASE_LABEL[w.phase] || w.bloc,
        plan,
        real: rh ? real : null,
        ua: uh ? ua : null,
        tz,
        well: wn ? wsum / wn : null,
        sleep: sn ? Math.round(ssum / sn) : null,
        adherence: items ? itemsDone / items : null
      };
    });
  }
  function currentWeekIndex(ws) {
    const t = todayKey();
    const i = ws.findIndex((x) => t >= x.w.start && t <= x.w.end);
    if (i >= 0) return i;
    return ws.length && t < ws[0].w.start ? -1 : ws.length;
  }
  function daySeries(fn) {
    const m = meta();
    if (!m) return [];
    const out = [];
    for (const id of ids("j:")) {
      const k = id.slice(2);
      const v = fn(jget(k), k);
      if (v !== null && v !== void 0) out.push({ k, v });
    }
    return out;
  }
  function loadSeries() {
    const map = /* @__PURE__ */ new Map();
    for (const id of ids("j:")) {
      const k = id.slice(2), e = jget(k);
      for (const { b, it, key } of allItems(k)) {
        if (!["muscu", "doigts", "epaule", "renfo"].includes(b.kind)) continue;
        if (doneN(e, key, it.n) <= 0) continue;
        const ld = itemLoad(b, it, e);
        if (!ld) continue;
        const name = b.kind === "doigts" ? "Finger lift \xB7 " + it.label.toLowerCase() : it.label;
        if (!map.has(name)) map.set(name, { name, unit: ld.u, pts: [] });
        const sl = setLoadsOf(e, key);
        map.get(name).pts.push({ k, v: sl ? workLoad(sl) : ld.v, sets: doneN(e, key, it.n), n: it.n, sl });
      }
    }
    return [...map.values()].filter((s) => s.pts.length).sort((a, b) => b.pts.length - a.pts.length);
  }
  function alerts(ws) {
    const a = [];
    const keys = ids("j:").map((id) => id.slice(2));
    for (const k of keys) {
      const e = jget(k), t = score(e);
      if (t !== null && t <= 10) a.push({ k, c: "var(--crit)", t: "Forme " + t + "/25", d: "Tr\xE8s fatigu\xE9 : version d\xE9charge ce jour-l\xE0." });
      const n1 = nightTotal(e), n0 = nightTotal(jget(addDays(k, -1))), nm = nightTotal(jget(addDays(k, -2)));
      if (n1 !== null && n0 !== null && n1 < 420 && n0 < 420 && !(nm !== null && nm < 420)) a.push({ k, c: "var(--warn)", t: "Deux nuits sous 7 h", d: "La s\xE9ance la plus lourde de la semaine passe en version d\xE9charge." });
      for (const [f, lbl] of FLAGS) {
        if (!(e.flags && e.flags[f])) continue;
        const g = e.gene && typeof e.gene[f] === "number" ? e.gene[f] : null;
        a.push({ k, c: g !== null && g >= 4 ? "var(--crit)" : "var(--warn)", t: lbl + (g !== null ? " " + g + "/10" : " sensible"), d: g !== null && g >= 4 ? "G\xEAne marqu\xE9e : suis la r\xE8gle du jour et parles-en au kin\xE9 si \xE7a dure." : "Sensible au r\xE9veil : la s\xE9ance s\u2019adapte ce jour-l\xE0." });
      }
      const p = target(k);
      if (p && p.rpe && p.fam !== "test" && typeof e.rpe === "number" && e.rpe > p.rpe[1]) a.push({ k, c: "var(--warn)", t: "Ressenti " + e.rpe + "/10", d: sessionName(k) + " : au-dessus de la cible (" + rng(p) + ")." });
    }
    const wl = keys.map((k) => ({ k, t: score(jget(k)) })).filter((x) => x.t !== null);
    for (let i = 3; i < wl.length; i++) {
      const s = wl.slice(i - 3, i + 1);
      const span = (Date.parse(s[3].k) - Date.parse(s[0].k)) / 864e5;
      if (span <= 4 && s[1].t < s[0].t && s[2].t < s[1].t && s[3].t < s[2].t) a.push({ k: s[3].k, c: "var(--warn)", t: "Forme en baisse 3 jours de suite", d: "Si \xE7a continue, garde le m\xEAme palier la semaine suivante." });
    }
    ws.forEach((x, i) => {
      const p = ws[i - 1];
      if (p && p.ua && x.ua && x.ua > p.ua * 1.3) {
        const lastLogged = x.ks.filter((k) => Object.keys(jget(k)).length).pop() || x.w.end;
        a.push({ k: lastLogged, c: "var(--warn)", t: "Charge +" + Math.round((x.ua / p.ua - 1) * 100) + " % en " + x.label, d: "Grosse hausse sur une semaine : garde la suivante au m\xEAme niveau." });
      }
    });
    return a.sort((u, v) => u.k < v.k ? 1 : u.k > v.k ? -1 : 0);
  }
  function tiles(ws) {
    const today = todayKey(), m = meta();
    const past = m ? [] : [];
    if (m) {
      for (const w of m.weeks) for (const k of weekKeys(w)) if (k <= today && (target(k) || blocks(k).some((b) => b.kind === "kine"))) past.push(k);
    }
    const done = past.filter((k) => {
      const s = jget(k).status;
      return s === "faite" || s === "adaptee";
    }).length;
    const last7 = [];
    for (let i = 0; i < 7; i++) last7.push(addDays(today, -i));
    const sc = last7.map((k) => score(jget(k))).filter((x) => x !== null), sl = last7.map((k) => nightTotal(jget(k))).filter((x) => x !== null);
    const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
    const ci = currentWeekIndex(ws), cur = ws[ci], prv = ws[ci - 1];
    return {
      done,
      planned: past.length,
      well: sc.length ? avg(sc) : null,
      wellLbl: sc.length ? verdict(Math.round(avg(sc))).lbl : null,
      sleep: sl.length ? Math.round(avg(sl)) : null,
      sleepN: sl.length,
      ua: cur && cur.ua,
      uaDelta: cur && cur.ua && prv && prv.ua ? Math.round((cur.ua / prv.ua - 1) * 100) : null
    };
  }

  // src/lib/history.js
  var history_exports = {};
  __export(history_exports, {
    applySuggested: () => applySuggested,
    lastPerf: () => lastPerf,
    perfText: () => perfText,
    suggestLoad: () => suggestLoad
  });

  // src/lib/activity.js
  var activity_exports = {};
  __export(activity_exports, {
    ACTS: () => ACTS,
    ACT_LBL: () => ACT_LBL,
    KIND_ACT: () => KIND_ACT,
    actOfKind: () => actOfKind,
    acts: () => acts,
    hasLog: () => hasLog,
    knownExercises: () => knownExercises,
    logSummary: () => logSummary,
    plannedActs: () => plannedActs,
    plannedLog: () => plannedLog,
    repsOf: () => repsOf
  });
  var ACTS = [["grimpe", "Escalade"], ["force", "Muscu / renfo"], ["kine", "Kin\xE9"], ["cardio", "Cardio"], ["sport", "Autre sport"], ["mobi", "R\xE9cup / mobilit\xE9"]];
  var ACT_LBL = Object.fromEntries(ACTS);
  var KIND_ACT = { grimpe: "grimpe", compet: "grimpe", affut: "grimpe", doigts: "force", muscu: "force", renfo: "force", epaule: "force", kine: "kine", velo: "cardio", course: "cardio", sport: "sport", recup: "mobi", autre: "mobi" };
  var actOfKind = (kind) => ["compet", "affut"].includes(kind) && !climber() ? "sport" : KIND_ACT[kind];
  function plannedActs(k) {
    const out = [];
    for (const b of blocks(k)) {
      const a = actOfKind(b.kind);
      if (a && !out.includes(a)) out.push(a);
    }
    return ACTS.map((x) => x[0]).filter((a) => out.includes(a));
  }
  function acts(k) {
    const e = jget(k);
    return Array.isArray(e.act) ? e.act : plannedActs(k);
  }
  var hasLog = (list) => list.includes("force") || list.includes("kine");
  function repsOf(det) {
    const s = String(det || "");
    let m = s.match(/\d+\s*[×x]\s*(\d+(?:[.,]\d+)?\s*(?:s\b|sec|min|rép\.?|reps?)?(?:\s*\/\s*côté)?)/i);
    if (m) return m[1].trim();
    m = s.match(/(\d+(?:[.,]\d+)?\s*(?:rép\.?|reps?|s\b|sec|min)(?:\s*\/\s*côté)?)/i);
    return m ? m[1].trim() : "";
  }
  function plannedLog(k) {
    const e = jget(k), out = [];
    for (const b of blocks(k)) {
      const a = KIND_ACT[b.kind];
      if (a !== "force" && a !== "kine") continue;
      for (const it of b.items || []) {
        if (it.id === "ech" || !it.label) continue;
        const key = itemKey(b, it), ld = itemLoad(b, it, e), dn = doneN(e, key, it.n);
        const rir = e.rir && typeof e.rir[key] === "number" ? e.rir[key] : null;
        const sl = setLoadsOf(e, key);
        out.push(Object.assign({ id: uid("l"), label: it.label.replace(/\[[a-z]+\]\s*/gi, ""), sets: dn || it.n || null, reps: repsOf(it.det), load: sl ? setsText(sl, ld ? ld.u : it.unit_load) : ld ? ld.text : "", src: key }, rir != null ? { rir } : {}));
      }
    }
    return out;
  }
  function knownExercises() {
    const set = /* @__PURE__ */ new Set(), clean = (l) => l.replace(/\[[a-z]+\]\s*/gi, "").trim();
    for (const id of ids("p:")) for (const b of blocks(id.slice(2))) {
      if (b.kind === "rest") continue;
      for (const it of b.items || []) if (it.label && it.id !== "ech") set.add(clean(it.label));
    }
    for (const id of ids("j:")) for (const x of jget(id.slice(2)).log || []) if (x.label) set.add(clean(x.label));
    return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b, "fr"));
  }
  function logSummary(e) {
    const p = [];
    if (Array.isArray(e.log) && e.log.length) p.push(e.log.length + " exercice" + (e.log.length > 1 ? "s" : ""));
    if (typeof e.pain === "number") p.push("douleur " + e.pain + "/10");
    if (e.cardio && typeof e.cardio.km === "number") p.push(String(e.cardio.km).replace(".", ",") + " km");
    return p.join(" \xB7 ");
  }

  // src/lib/history.js
  var num = (v) => {
    const m = String(v == null ? "" : v).replace(",", ".").match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  };
  var STRENGTH2 = ["muscu", "renfo", "doigts", "epaule"];
  function lastPerf(label, k, lib) {
    const target2 = norm(label);
    if (!target2) return null;
    const days = ids("j:").map((id) => id.slice(2)).filter((d) => d < k).reverse().slice(0, 150);
    for (const d of days) {
      const e = jget(d);
      for (const x of e.log || []) {
        if (norm(x.label) !== target2 || !(x.sets || x.reps || x.load)) continue;
        return { k: d, sets: num(x.sets), reps: x.reps || "", repsKnown: !!x.reps, load: x.load || "", loadV: num(x.load), rir: typeof x.rir === "number" ? x.rir : null, full: true };
      }
      for (const b of blocks(d)) for (const it of b.items || []) {
        if (it.id === "ech" || it.id === "rac") continue;
        if (!(lib && it.lib === lib) && norm(it.label) !== target2) continue;
        const key = itemKey(b, it), n = doneN(e, key, it.n);
        if (n <= 0) continue;
        const ld = itemLoad(b, it, e), sl = setLoadsOf(e, key), u = ld ? ld.u : it.unit_load || "kg";
        const wl = sl ? workLoad(sl) : ld ? ld.v : null;
        return {
          k: d,
          sets: n,
          n: it.n,
          reps: repsOf(it.det),
          load: sl ? setsText(sl, u) : ld ? ld.text : "",
          loadV: wl,
          setLoads: sl,
          unit: u,
          unitN: it.unit,
          rir: e.rir && typeof e.rir[key] === "number" ? e.rir[key] : null,
          full: n >= it.n,
          falls: e.falls && typeof e.falls[key] === "number" ? e.falls[key] : null,
          wall: e.wall && e.wall[key] ? e.wall[key] : null
        };
      }
    }
    return null;
  }
  function perfText(p) {
    const parts = [];
    const u = p.unitN === "Bloc" ? " bloc" : p.unitN === "Essai" ? " essai" : " s\xE9rie";
    if (p.sets) parts.push(p.sets + (p.reps && p.repsKnown ? " \xD7 " + p.reps : u + (p.sets > 1 ? "s" : "")));
    else if (p.reps) parts.push(p.reps);
    if (p.load) parts.push(p.load);
    if (typeof p.rir === "number") parts.push("r\xE9serve " + p.rir + (p.rir >= 4 ? "+" : ""));
    if (typeof p.falls === "number") parts.push(p.falls + " chute" + (p.falls > 1 ? "s" : ""));
    return fmtShort(p.k) + " : " + parts.join(" \xB7 ");
  }
  function step(it, v) {
    const x = it.lib && LIB_BY_ID[it.lib];
    if (it.unit_load === "+kg") return x && x.pat === "finger-max" ? 1 : 2.5;
    const lower = x && ["squat", "hinge"].includes(x.pat);
    if (lower && v >= 80) return 5;
    if (v < 20) return 1;
    return 2.5;
  }
  var roundTo = (v, s) => Math.round(v / s) * s;
  function suggestLoad(b, it, k) {
    if (!STRENGTH2.includes(b.kind) || it.id === "ech") return null;
    const lp = lastPerf(it.label, k, it.lib);
    if (!lp || lp.loadV == null) return null;
    const v0 = lp.loadV, rx = it.rx || {}, s = step(it, Math.abs(v0)), u = it.unit_load === "+kg" || lp.unit === "+kg" ? "+kg" : "kg";
    const fmt = (v2) => (u === "+kg" && v2 > 0 ? "+" : "") + fmtNum(Math.round(v2 * 100) / 100) + " kg";
    let v = v0, why;
    const lighter = lp.setLoads ? lp.setLoads.filter((x) => x < v0) : [];
    if (rx.light) {
      why = "Semaine de d\xE9charge : m\xEAme charge que la derni\xE8re fois (ou un peu moins), loin de l\u2019\xE9chec.";
    } else if (!lp.full) {
      why = "S\xE9ries incompl\xE8tes la derni\xE8re fois : on garde la m\xEAme charge.";
    } else if (lighter.length) {
      why = (lighter.length > 1 ? lighter.length + " s\xE9ries all\xE9g\xE9es" : "Une s\xE9rie all\xE9g\xE9e") + " la derni\xE8re fois (" + fmt(Math.min(...lighter)) + ") : on garde " + fmt(v0) + " et on vise toutes les s\xE9ries \xE0 cette charge.";
    } else {
      const target2 = typeof rx.rir === "number" ? rx.rir : 2, hi = rx.r ? rx.r[1] : null, reps = lp.repsKnown ? num(lp.reps) : null;
      const rr = lp.rir === 4 ? "4 ou plus" : lp.rir;
      if (typeof lp.rir === "number") {
        if (lp.rir > target2) {
          v = v0 + s * (lp.rir >= target2 + 2 && lp.rir < 4 ? 2 : 1);
          why = "Il te restait " + rr + " r\xE9p\xE9titions pour une r\xE9serve vis\xE9e de " + target2 + " : la charge monte.";
        } else if (lp.rir <= target2 - 2) {
          v = v0 - s;
          why = "R\xE9serve de " + rr + " pour " + target2 + " vis\xE9e : on redescend d\u2019un cran.";
        } else if (hi && reps && reps >= hi) {
          v = v0 + s;
          why = "Haut de la fourchette atteint avec la r\xE9serve vis\xE9e : +" + fmtNum(s) + " kg (double progression).";
        } else why = "R\xE9serve dans la cible : m\xEAme charge, vise une r\xE9p\xE9tition de plus.";
      } else if (hi && reps && reps >= hi) {
        v = v0 + s;
        why = "Toutes les s\xE9ries faites en haut de la fourchette : +" + fmtNum(s) + " kg (double progression).";
      } else why = "M\xEAme charge que la derni\xE8re fois. Note ta r\xE9serve en fin de s\xE9rie : la charge suivante se r\xE9glera toute seule.";
    }
    v = roundTo(v, s >= 2.5 ? 1.25 : 0.5);
    if (u === "kg") v = Math.max(0, v);
    return { v, u, text: fmt(v), from: fmt(v0), why, last: lp };
  }
  function applySuggested(k, b, it, sug) {
    const key = itemKey(b, it), loads = Object.assign({}, jget(k).loads);
    loads[key] = sug.v;
    jset(k, { loads });
  }

  // src/lib/quantify.js
  var quantify_exports = {};
  __export(quantify_exports, {
    climbBilan: () => climbBilan,
    climbSuggest: () => climbSuggest,
    discOf: () => discOf2,
    sessionBilan: () => sessionBilan,
    strengthBilan: () => strengthBilan
  });

  // src/lib/records.js
  var records_exports = {};
  __export(records_exports, {
    allRecords: () => allRecords,
    recentRecords: () => recentRecords,
    recordsOn: () => recordsOn
  });
  var STRONG = ["muscu", "doigts", "epaule", "renfo"];
  var discOf = (it) => it.disc || (it.unit === "Voie" ? "voie" : "bloc");
  var exName = (b, it) => b.kind === "doigts" && /main (droite|gauche)/i.test(it.label) ? "Finger lift \xB7 " + it.label.toLowerCase() : it.label;
  var kgTxt = (v, u) => (u === "+kg" && v >= 0 ? "+" : "") + fmtNum(v) + " kg";
  function daily() {
    const out = [];
    for (const k of ids("j:").map((id) => id.slice(2)).sort()) {
      if (k > todayKey()) continue;
      const e = jget(k), loads = /* @__PURE__ */ new Map(), grades = [];
      for (const b of blocks(k)) {
        if (b.kind === "rest") continue;
        for (const it of b.items || []) {
          const key = itemKey(b, it), n = doneN(e, key, it.n);
          if (!n || it.id === "ech") continue;
          if (STRONG.includes(b.kind)) {
            const sl = setLoadsOf(e, key), ld = itemLoad(b, it, e);
            if (!sl && !ld) continue;
            const v = sl ? Math.max(...sl) : ld.v, name = exName(b, it), cur = loads.get(name);
            if (!cur || v > cur.v) loads.set(name, { name, v, u: ld && ld.u || it.unit_load || "kg", reps: it.reps || null });
          }
          for (const x of (e.cl || {})[key] || []) if (x && x.g && !x.f) {
            const disc = discOf(it), i = gradeIdx(x.g, disc);
            if (i != null) grades.push({ disc, i });
          }
        }
      }
      if (loads.size || grades.length) out.push({ k, loads: [...loads.values()], grades });
    }
    return out;
  }
  function allRecords() {
    const best = /* @__PURE__ */ new Map(), bestG = {}, out = [];
    for (const d of daily()) {
      for (const l of d.loads) {
        const b = best.get(l.name);
        if (b && l.v > b.v) out.push({ k: d.k, kind: "load", name: l.name, txt: l.name + " " + kgTxt(l.v, l.u) + (l.reps ? " \xD7 " + l.reps : ""), prev: kgTxt(b.v, b.u), prevK: b.k });
        if (!b || l.v > b.v) best.set(l.name, { v: l.v, u: l.u, k: d.k, reps: l.reps });
      }
      for (const disc of ["bloc", "voie"]) {
        const gs = d.grades.filter((x) => x.disc === disc);
        if (!gs.length) continue;
        const top = Math.max(...gs.map((x) => x.i)), b = bestG[disc];
        if (b && top > b.i) out.push({ k: d.k, kind: "grade", name: disc === "bloc" ? "Bloc" : "Voie", txt: (disc === "bloc" ? "Premier bloc en " : "Premi\xE8re voie en ") + gradeAt(top, disc), prev: gradeAt(b.i, disc), prevK: b.k });
        if (!b || top > b.i) bestG[disc] = { i: top, k: d.k };
      }
    }
    return { list: out, best: [...best.entries()].map(([name, b]) => Object.assign({ name }, b)), grades: Object.entries(bestG).map(([disc, b]) => ({ disc, g: gradeAt(b.i, disc), k: b.k })) };
  }
  var recordsOn = (k) => allRecords().list.filter((x) => x.k === k);
  function recentRecords(days) {
    const from = addDays(todayKey(), -(days || 30));
    return allRecords().list.filter((x) => x.k >= from).reverse();
  }

  // src/lib/quantify.js
  var discOf2 = (it) => it.disc || (it.unit === "Voie" ? "voie" : "bloc");
  var UNIT = { Bloc: "bloc", Voie: "voie", Essai: "essai" };
  var pl = (n, w) => n + " " + w + (n > 1 ? "s" : "");
  var isClimb = (it) => ["Bloc", "Voie", "Essai"].includes(it.unit);
  function climbBilan(k, b, it) {
    const e = jget(k), key = itemKey(b, it), n = doneN(e, key, it.n), disc = discOf2(it);
    const log = (e.cl || {})[key] || [], falls = (e.falls || {})[key] || 0, wall = (e.wall || {})[key] || 0;
    const out = [pl(n, UNIT[it.unit] || "bloc")];
    if (falls || log.length) out.push(pl(falls, "chute"));
    if (wall) out.push(mmss(wall) + " sur " + (disc === "voie" ? "les voies" : "le mur"));
    const gs = log.map((x) => x.g).filter(Boolean);
    if (gs.length) {
      const m = meanGrade(gs, disc), lv = climbLevel(), ref = disc === "voie" ? lv.vf : lv.bf, gap = ref ? gapText(m, ref.g, disc, disc === "voie" ? "\xE0 vue" : "flash") : null;
      out.push((gs.every((g) => g === gs[0]) ? m : m + " en moyenne, " + maxGrade(gs, disc) + " au plus") + (gap ? " (" + gap + ")" : ""));
    }
    return out;
  }
  function repsPerSet(it) {
    if (it.reps) return it.reps;
    if (it.repsBySet) return it.repsBySet[0];
    if (it.rx && Array.isArray(it.rx.r)) return Math.round((it.rx.r[0] + it.rx.r[1]) / 2);
    const m = String(it.det || "").match(/(\d+)\s*(?:-\s*\d+\s*)?(?:rép|répétitions)/i);
    return m ? +m[1] : null;
  }
  function strengthBilan(k, part) {
    const e = jget(k);
    let ton = 0;
    const pcts = [];
    for (const b of blocks(k)) {
      if (part ? b.id !== part : ["apart", "moved", "skip"].includes(blockState(e, b))) continue;
      if (!["muscu", "renfo", "epaule", "doigts"].includes(b.kind)) continue;
      for (const it of b.items || []) {
        const key = itemKey(b, it), n = doneN(e, key, it.n);
        if (!n || it.id === "ech") continue;
        const r = repsPerSet(it);
        if (!r) continue;
        const sl = setLoadsOf(e, key), ld = itemLoad(b, it, e);
        if (!sl && !ld) continue;
        const bw = it.unit_load === "+kg" ? bodyWeightAt(k) || 0 : 0;
        const loads = sl || Array.from({ length: n }, () => ld.v);
        ton += loads.reduce((a, w, i) => a + (bw + w) * (it.repsBySet ? it.repsBySet[Math.min(i, it.repsBySet.length - 1)] : r), 0);
        const lift = LIFT_OF_LIB[it.lib || (libMatch(it.label) || {}).id];
        const rm = lift ? oneRM(lift) : null;
        if (rm && rm.v > 0) {
          const avg = loads.reduce((a, w) => a + bw + w, 0) / loads.length;
          pcts.push(it.label + " \u2248 " + Math.round(avg / rm.v * 100) + " % de ton 1RM");
        }
      }
    }
    const out = [];
    if (ton > 0) out.push("Tonnage " + Math.round(ton).toLocaleString("fr-FR") + " kg");
    return out.concat(pcts);
  }
  function sessionBilan(k, part) {
    const e = jget(k), out = [];
    for (const b of blocks(k)) {
      if (part ? b.id !== part : ["apart", "moved", "skip"].includes(blockState(e, b))) continue;
      for (const it of b.items || []) {
        if (!isClimb(it)) continue;
        const key = itemKey(b, it);
        if (!((e.cl || {})[key] || (e.falls || {})[key] != null || (e.wall || {})[key])) continue;
        out.push({ label: it.label + " \xB7 " + doneN(e, key, it.n) + "/" + it.n, lines: climbBilan(k, b, it).slice(1) });
      }
    }
    const sb = strengthBilan(k, part);
    if (sb.length) out.push({ label: "Muscu", lines: sb });
    if (!part) {
      const rec = recordsOn(k);
      if (rec.length) out.unshift({ label: rec.length > 1 ? "Records" : "Record", lines: rec.map((r) => r.txt + " (avant : " + r.prev + ")"), rec: true });
    }
    return out;
  }
  var shape = (it) => it.lib || norm(String(it.label || "").replace(/\b\d+[abcABC]?\+?\b/g, ""));
  function lastClimb(k, it) {
    const s = shape(it);
    for (const id of ids("j:").filter((x) => x.slice(2) < k).sort().reverse().slice(0, 90)) {
      const d = id.slice(2), e = get(id) || {};
      for (const b of blocks(d)) for (const x of b.items || []) {
        if (x.unit !== it.unit || shape(x) !== s) continue;
        const key = itemKey(b, x), n = doneN(e, key, x.n);
        if (!n) continue;
        return { k: d, n, planned: x.n, falls: (e.falls || {})[key] || 0, log: (e.cl || {})[key] || [], rpe: typeof e.rpe === "number" ? e.rpe : null, tg: target(d) && target(d).rpe };
      }
    }
    return null;
  }
  function setItem(k, b, it, patch) {
    const d = day(k);
    if (!d) return;
    put("p:" + k, Object.assign({}, d, { blocks: d.blocks.map((x) => x.id !== b.id ? x : Object.assign({}, x, { items: x.items.map((y) => y.id !== it.id ? y : Object.assign({}, y, patch)) })) }));
  }
  function climbSuggest(k, b, it) {
    if (it.unit === "Essai" || doneN(jget(k), itemKey(b, it), it.n) > 0) return null;
    const lp = lastClimb(k, it);
    if (!lp) return null;
    const u = UNIT[it.unit] || "bloc", disc = discOf2(it), ratio = lp.falls / lp.n;
    const g = lp.log.length ? meanGrade(lp.log.map((x) => x.g).filter(Boolean), disc) : null;
    const when = fmtShort(lp.k).toLowerCase(), rp = lp.rpe != null ? ", ressenti " + lp.rpe + (lp.tg ? " (cible " + lp.tg[0] + "-" + lp.tg[1] + ")" : "") : "";
    const can = !planLocked();
    if (lp.n < lp.planned) return { text: "M\xEAme volume que pr\xE9vu", why: "Le " + when + " : " + lp.n + "/" + lp.planned + " " + u + "s" + rp + ". On consolide avant d\u2019ajouter." };
    if (ratio >= 0.25 || lp.rpe != null && lp.tg && lp.rpe > lp.tg[1]) {
      if (g) {
        const g2 = shiftGrade(g, -1, disc);
        return { text: "Une cotation en dessous : " + g2, why: "Le " + when + " : " + pl(lp.falls, "chute") + " sur " + lp.n + rp + ". M\xEAme volume, un peu plus facile, pour garder la qualit\xE9.", apply: can ? () => setItem(k, b, it, { grade: g2 }) : null };
      }
      const n2 = Math.max(1, lp.n - 2);
      if (n2 >= it.n) return null;
      return { text: n2 + " " + u + "s", why: "Le " + when + " : " + pl(lp.falls, "chute") + " sur " + lp.n + rp + ". Un peu moins de volume pour garder la qualit\xE9.", apply: can ? () => setItem(k, b, it, { n: n2 }) : null };
    }
    if (ratio <= 0.1 && lp.rpe != null && (!lp.tg || lp.rpe <= lp.tg[1])) {
      const n2 = lp.n + 2;
      if (it.n >= n2) return null;
      return { text: n2 + " " + u + "s" + (g ? " en " + g : ""), why: "Le " + when + " : " + pl(lp.falls, "chute") + " sur " + lp.n + rp + ". Une seule chose change \xE0 la fois : 2 " + u + "s de plus.", apply: can ? () => setItem(k, b, it, Object.assign({ n: n2 }, g ? { grade: g } : {})) : null };
    }
    return null;
  }

  // src/lib/week.js
  var week_exports = {};
  __export(week_exports, {
    reviewWeek: () => reviewWeek,
    weekReview: () => weekReview
  });
  var mean2 = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  function reviewWeek(now) {
    const d = now || /* @__PURE__ */ new Date(), t = todayKey(), dw = (d.getDay() + 6) % 7;
    if (dw === 6 && d.getHours() >= 17) return mondayOf(t);
    if (dw === 0) return mondayOf(addDays(t, -1));
    return null;
  }
  function weekReview(mon2) {
    const days = rangeKeys(mon2, addDays(mon2, 6));
    let planned = 0, done = 0;
    const missed = [];
    for (const k of days) {
      const e = jget(k), real = rawBlocks(k).filter((b) => b.kind !== "rest" && blockState(e, b) !== "moved");
      if (!real.length) continue;
      planned++;
      if (e.status === "faite" || e.status === "adaptee" || !e.status && progress(k).done > 0) done++;
      else if (e.cancel || e.status === "sautee") missed.push({ k, why: e.cancel ? skipLabel(e.cancel.r) : "saut\xE9e", note: e.cancel && e.cancel.note });
      else if (k < todayKey()) missed.push({ k, why: "rien de not\xE9" });
    }
    const load = days.reduce((a, k) => a + dayLoad(k), 0), prev = rangeKeys(addDays(mon2, -7), addDays(mon2, -1)).reduce((a, k) => a + dayLoad(k), 0);
    const sc = days.map((k) => score(jget(k))).filter((x) => x !== null), nights = days.map((k) => nightTotal(jget(k))).filter((x) => x !== null);
    const recs = allRecords().list.filter((x) => x.k >= mon2 && x.k <= addDays(mon2, 6));
    const nmon = addDays(mon2, 7), nw = weekOf(nmon);
    const next = rangeKeys(nmon, addDays(nmon, 6)).map((k) => ({ k, name: rawBlocks(k).some((b) => b.kind !== "rest") ? sessionName(k) : null, ev: eventOn(k) })).filter((x) => x.name || x.ev);
    const f = mean2(sc);
    return {
      mon: mon2,
      planned,
      done,
      missed,
      load: Math.round(load),
      loadCh: prev > 0 && load > 0 ? Math.round((load / prev - 1) * 100) : null,
      form: f !== null ? Math.round(f * 10) / 10 : null,
      formCls: f !== null ? verdict(Math.round(f)).cls : null,
      formN: sc.length,
      sleep: nights.length ? Math.round(mean2(nights)) : null,
      recs,
      next,
      nextPhase: nw ? PHASE_LABEL[nw.phase] || nw.bloc : null,
      nextLight: nw ? nw.phase === "deload" : false
    };
  }

  // src/lib/needs.js
  var needs_exports = {};
  __export(needs_exports, {
    BFR_DET: () => BFR_DET,
    BFR_WARN: () => BFR_WARN,
    EXTRAS: () => EXTRAS,
    LVL_LBL: () => LVL_LBL,
    applyExtras: () => applyExtras,
    missingFor: () => missingFor
  });
  var LVL_LBL = { solide: "Preuves solides", "mod\xE9r\xE9": "Preuves mod\xE9r\xE9es", "hypoth\xE8se": "Hypoth\xE8se de travail" };
  var ISO = (name) => ({ kind: "interval", name, work: 3, rest: 3, reps: 4, sets: 5, setRest: 60, prep: 5, workLabel: "Pousse", restLabel: "Rel\xE2che", markEach: "set" });
  var BFR_WARN = "Pas de BFR sans avis m\xE9dical en cas d\u2019ant\xE9c\xE9dent de phl\xE9bite ou d\u2019embolie, de trouble de la coagulation, d\u2019hypertension, de maladie du c\u0153ur ou des vaisseaux, de varices importantes, de dr\xE9panocytose ou de grossesse. Arr\xEAte si fourmillements, engourdissement, douleur vive ou peau qui blanchit.";
  var BFR_DET = "30, 15, 15, 15 r\xE9p. \xE0 20-30 % de ton max \xB7 30 s de repos, brassards gard\xE9s \xB7 BFR : serrage \xE0 40-80 % de la pression d\u2019occlusion (bas de la fourchette pour les bras), ou environ 7/10 ressenti sans manom\xE8tre";
  var EXTRAS = {
    impacts: {
      t: "Impacts pour l\u2019os",
      lvl: "solide",
      src: ["turner2003"],
      per: 2,
      first: true,
      libs: ["cmj"],
      why: "L\u2019os se renforce avec des impacts courts et vari\xE9s : 20 \xE0 40 par s\xE9ance suffisent, au-del\xE0 l\u2019effet plafonne. Ton sport en apporte peu.",
      item: { det: "4 \xD7 8 sauts, r\xE9ception amortie, jambes fra\xEEches de pr\xE9f\xE9rence", n: 4, unit: "S\xE9rie", rest: 60 }
    },
    achille: {
      t: "Tendon d\u2019Achille",
      lvl: "mod\xE9r\xE9",
      src: ["bohm2015"],
      per: 2,
      libs: ["iso-mollets"],
      why: "Le tendon se renforce avec des mises en tension longues et fortes (environ 90 % de ton max), plusieurs semaines de suite : utile quand on court beaucoup.",
      item: { det: "5 s\xE9ries de 4 pouss\xE9es de 3 s presque au maximum, 3 s de rel\xE2chement", n: 5, unit: "S\xE9rie", timer: ISO("Isom\xE9trie mollets") }
    },
    rotulien: {
      t: "Tendon rotulien",
      lvl: "mod\xE9r\xE9",
      src: ["bohm2015"],
      per: 2,
      libs: ["iso-quad"],
      why: "Sauts et changements de direction chargent le tendon rotulien : des mises en tension longues et fortes le pr\xE9parent.",
      item: { det: "5 s\xE9ries de 4 pouss\xE9es de 3 s presque au maximum, 3 s de rel\xE2chement", n: 5, unit: "S\xE9rie", timer: ISO("Isom\xE9trie quadriceps") }
    },
    nordic: {
      t: "Ischio-jambiers",
      lvl: "solide",
      src: ["vandyk2019"],
      per: 2,
      libs: ["nordic"],
      why: "Dans les sports de sprint, le Nordic divise environ par deux les blessures des ischio-jambiers, avec tr\xE8s peu de volume.",
      item: { det: "2 \xD7 5 descentes les plus lentes possible", n: 2, unit: "S\xE9rie", rest: 90 }
    },
    coiffe: {
      t: "Coiffe des rotateurs",
      lvl: "mod\xE9r\xE9",
      src: ["byram2010"],
      per: 2,
      libs: ["rot-ext", "face-pull", "ytw"],
      why: "Grimpe, combat, nage : la coiffe stabilise l\u2019\xE9paule sous charge. Chez les lanceurs, des rotateurs externes faibles vont avec plus de blessures d\u2019\xE9paule.",
      item: { det: "2 \xD7 15, lent et contr\xF4l\xE9", n: 2, unit: "S\xE9rie", rest: 45 }
    },
    pousse: {
      t: "Antagonistes : pouss\xE9e",
      lvl: "hypoth\xE8se",
      src: [],
      per: 2,
      libs: ["pompes"],
      why: "La grimpe tire beaucoup : un peu de pouss\xE9e \xE9quilibre l\u2019\xE9paule. Peu d\u2019\xE9tudes le testent directement.",
      item: { det: "2 \xD7 10 \xE0 15, r\xE9serve 2", n: 2, unit: "S\xE9rie", rest: 60 }
    },
    poignet: {
      t: "Extenseurs du poignet",
      lvl: "hypoth\xE8se",
      src: [],
      per: 2,
      libs: ["ext-poignet"],
      why: "Antagonistes des fl\xE9chisseurs des doigts, souvent propos\xE9s contre les douleurs du coude du grimpeur. Peu d\u2019\xE9tudes le testent directement.",
      item: { det: "2 \xD7 15, descente lente (3 s)", n: 2, unit: "S\xE9rie", rest: 45 }
    },
    bfr: {
      t: "Finisher BFR",
      lvl: "solide",
      src: ["lixandrao2018", "patterson2019", "wilson2013"],
      per: 2,
      bfr: true,
      why: "Avec des brassards, une charge tr\xE8s l\xE9g\xE8re (20 \xE0 30 % du max) donne presque le m\xEAme gain de masse qu\u2019une charge lourde, avec moins de contrainte sur les articulations. La force progresse moins : \xE7a compl\xE8te le lourd, \xE7a ne le remplace pas.",
      item: { det: BFR_DET, n: 4, unit: "S\xE9rie", rest: 30, repsBySet: [30, 15, 15, 15], warn: BFR_WARN }
    }
  };
  var TIPS = {
    cartilage: { t: "Mouvement l\xE9ger tous les jours", lvl: "mod\xE9r\xE9", why: "Le cartilage se nourrit de charges mod\xE9r\xE9es r\xE9p\xE9t\xE9es : 10 \xE0 20 min de marche ou de mobilit\xE9 les jours sans s\xE9ance." },
    variete: { t: "Varier les gestes", lvl: "hypoth\xE8se", why: "Changer de directions, d\u2019amplitudes et de vitesses d\u2019une s\xE9ance \xE0 l\u2019autre sollicite les tissus dans tous les sens." },
    bfrEq: { t: "BFR", lvl: "solide", src: ["lixandrao2018"], why: "Si tu as des brassards BFR, coche-les dans le mat\xE9riel : l\u2019assistant te proposera des finishers \xE0 charge tr\xE8s l\xE9g\xE8re pour la masse musculaire." }
  };
  var BY_SPORT = {
    escalade: ["coiffe", "pousse", "poignet", "impacts"],
    course: ["achille", "force"],
    trail: ["achille", "rotulien", "force"],
    velo: ["impacts", "force"],
    natation: ["impacts", "force", "coiffe"],
    collectif: ["nordic", "rotulien", "force"],
    combat: ["coiffe", "force"],
    hyrox: ["achille", "force"],
    muscu: ["impacts"],
    autre: ["force", "impacts"]
  };
  var IMPACT_SPORTS = ["course", "trail", "collectif", "hyrox"];
  var STRENGTH_TYPES = ["fbA", "fbB", "haut", "bas", "renfo", "prevS", "puiss"];
  var MASS_GOALS = ["hyper", "force", "prev", "endu_f"];
  var libOk = (id, eq) => {
    const x = LIB_BY_ID[id];
    return !!x && x.eq.some((e) => eq.has(e));
  };
  var libOf = (E2, eq) => (E2.libs || []).find((id) => libOk(id, eq)) || null;
  function coverage(prog) {
    const w = prog.weeks.find((x) => !x.light && !x.taper) || prog.weeks[0];
    const out = { libs: /* @__PURE__ */ new Set(), pats: /* @__PURE__ */ new Set(), strength: 0, impacts: 0 };
    for (const s of Object.values(w.days)) {
      let heavy = false, impact = false;
      for (const b of s.blocks || []) for (const it of b.items || []) {
        if (it.extra) continue;
        if (it.lib) out.libs.add(it.lib);
        const x = it.lib && LIB_BY_ID[it.lib];
        if (x) out.pats.add(x.pat);
        if (it.rx && it.rx.role === "main" && ["force", "hyper"].includes(it.rx.goal)) heavy = true;
        if (x && (x.pat === "plyo" || x.pat === "squat-puiss" || x.pat === "sprint")) impact = true;
      }
      if (heavy) out.strength++;
      if (impact) out.impacts++;
    }
    return out;
  }
  function missingFor(prog) {
    const c = prog.cfg, sports = c.sports && c.sports.length ? c.sports : ["autre"], cov = coverage(prog), eq = equipSet(c.equip);
    const added = new Set(c.extras || []), out = [];
    const goals = [c.goal, c.goal2].filter(Boolean);
    const want = [...new Set(sports.flatMap((sp) => BY_SPORT[sp] || []).concat(goals.includes("prev") ? ["impacts", "force"] : []))];
    for (const id of want) {
      if (id === "force") {
        const need = c.days.length >= 4 ? 2 : 1;
        if (cov.strength >= need || goals.some((g) => ["force", "hyper"].includes(g)) || c.goal2 || c.days.length < 3) continue;
        out.push({ id, kind: "goal2", t: "Force : " + need + " s\xE9ance" + (need > 1 ? "s" : "") + " par semaine", lvl: "solide", src: ["acsm2009"], why: "Des charges lourdes une \xE0 deux fois par semaine d\xE9veloppent la force utile \xE0 tous les sports et renforcent muscles et tendons. Ajoute la force en second objectif." });
        continue;
      }
      const E2 = EXTRAS[id];
      if (!E2) continue;
      const lib = libOf(E2, eq);
      if (!lib) continue;
      const has = cov.libs.has(lib) || id === "impacts" && (sports.some((sp) => IMPACT_SPORTS.includes(sp)) || cov.impacts >= 2) || id === "coiffe" && cov.pats.has("epaule") || id === "pousse" && [...cov.pats].some((p) => String(p).startsWith("push")) || id === "poignet" && cov.pats.has("avantbras");
      if (has && !added.has(id)) continue;
      out.push({ id, kind: "extra", t: E2.t, why: E2.why, lvl: E2.lvl, src: E2.src, added: added.has(id) });
    }
    const massy = goals.some((g) => MASS_GOALS.includes(g)) || cov.strength > 0;
    const tips = [TIPS.cartilage];
    if (massy && eq.has("bfr")) {
      const E2 = EXTRAS.bfr;
      out.push({ id: "bfr", kind: "extra", t: E2.t, why: E2.why, lvl: E2.lvl, src: E2.src, added: added.has("bfr"), warn: BFR_WARN });
    } else if (goals.some((g) => ["hyper", "prev"].includes(g))) tips.push(TIPS.bfrEq);
    if (sports.length === 1) tips.push(TIPS.variete);
    for (const id of added) if (EXTRAS[id] && !out.some((x) => x.id === id)) {
      const E2 = EXTRAS[id];
      out.push({ id, kind: "extra", t: E2.t, why: E2.why, lvl: E2.lvl, src: E2.src, added: true, warn: E2.bfr ? BFR_WARN : void 0 });
    }
    return { list: out, tips };
  }
  function bfrLib(type, j, eq) {
    const legs = ["bas", "prevS"].includes(type) || !["haut", "renfo"].includes(type) && j % 2 === 0;
    const opts = legs ? ["leg-ext", "goblet", "squat-pdc"] : ["curl", "pompes"];
    return opts.find((id) => libOk(id, eq));
  }
  function applyExtras(days, cfg, wk) {
    const extras = (cfg.extras || []).filter((id) => EXTRAS[id]);
    if (!extras.length) return;
    const eq = equipSet(cfg.equip);
    const keys = Object.keys(days).filter((d) => days[d] && days[d].type && days[d].type !== "mobi");
    const str = keys.filter((d) => STRENGTH_TYPES.includes(days[d].type)), other = keys.filter((d) => !str.includes(d));
    extras.forEach((id, ei) => {
      const E2 = EXTRAS[id];
      if (E2.bfr && (!eq.has("bfr") || !str.length)) return;
      const pool = E2.bfr ? str : str.concat(other);
      const picks = (pool.length > E2.per ? rotate(pool.slice(0, Math.max(E2.per, str.length)), ei) : pool).slice(0, E2.per);
      picks.forEach((d, j) => {
        const s = days[d], lib = E2.bfr ? bfrLib(s.type, j, eq) : libOf(E2, eq);
        if (!lib) return;
        const x = LIB_BY_ID[lib];
        const it = Object.assign(JSON.parse(JSON.stringify(E2.item)), { id: uid("i"), label: x.n + (E2.bfr ? " en BFR" : ""), lib, extra: id, rx: { role: "prev", light: true } });
        if (wk.light || wk.taper) {
          it.n = Math.max(1, Math.round(it.n * (wk.taper ? 0.5 : 0.6)));
          if (it.timer && it.timer.sets) it.timer.sets = it.n;
          if (it.repsBySet) it.repsBySet = it.repsBySet.slice(0, it.n);
        }
        let b = (s.blocks || []).find((y) => ["muscu", "renfo"].includes(y.kind));
        if (!b) {
          b = { id: uid("b"), kind: "renfo", title: "Compl\xE9ment", desc: "Ajout\xE9 pour ton sport", items: [] };
          s.blocks = (s.blocks || []).concat([b]);
        }
        const its = b.items || (b.items = []);
        if (E2.first) {
          const i0 = its.findIndex((y) => y.id === "ech");
          its.splice(i0 + 1, 0, it);
        } else {
          const i1 = its.findIndex((y) => y.id === "rac");
          if (i1 >= 0) its.splice(i1, 0, it);
          else its.push(it);
        }
      });
    });
  }
  var rotate = (a, n) => a.slice(n % a.length).concat(a.slice(0, n % a.length));

  // src/lib/builder.js
  var builder_exports = {};
  __export(builder_exports, {
    DURS: () => DURS,
    FORMATS: () => FORMATS,
    GROUP_LBL: () => GROUP_LBL,
    KIND: () => KIND,
    KIND_OF_TYPE: () => KIND_OF_TYPE,
    LEVELS: () => LEVELS,
    SESSION_LBL: () => SESSION_LBL,
    alternatives: () => alternatives,
    buildSession: () => buildSession,
    check48: () => check48,
    conflicts: () => conflicts,
    fmtFamily: () => fmtFamily,
    fmtOf: () => fmtOf,
    fmtReco: () => fmtReco,
    generate: () => generate,
    groupsTxt: () => groupsTxt,
    heavyOf: () => heavyOf,
    nextMonday: () => nextMonday,
    placeSessions: () => placeSessions,
    programNotes: () => programNotes,
    sessionSummary: () => sessionSummary,
    weekInfo: () => weekInfo,
    weekPlanTypes: () => weekPlanTypes,
    writeProgram: () => writeProgram
  });
  var LEVELS = [[1, "D\xE9butant", "moins d\u2019un an d\u2019entra\xEEnement r\xE9gulier"], [2, "Interm\xE9diaire", "1 \xE0 3 ans"], [3, "Avanc\xE9", "plus de 3 ans"]];
  var DURS = [45, 60, 75, 90];
  var GROUP_LBL = { jambes: "jambes", dos: "bas du dos", poussee: "pouss\xE9e (pectoraux, triceps)", tirage: "tirage (dos, biceps)", epaule: "\xE9paules", doigts: "doigts", cardio: "cardio intense" };
  var RX = {
    force: [{ r: [8, 10], s: 3, rir: 3, pct: "\u2248 65-75 % du max", rest: 120 }, { r: [4, 6], s: 4, rir: 2, pct: "\u2248 80-85 % du max", rest: 180 }, { r: [3, 5], s: 5, rir: 2, pct: "\u2248 85-90 % du max", rest: 210 }],
    hyper: [{ r: [10, 12], s: 3, rir: 3, pct: "\u2248 65-75 % du max", rest: 90 }, { r: [8, 12], s: 3, rir: 2, pct: "\u2248 67-80 % du max", rest: 120 }, { r: [6, 12], s: 4, rir: 1, pct: "\u2248 67-85 % du max", rest: 150 }],
    endu_f: [{ r: [15, 20], s: 2, rir: 3, pct: "charge l\xE9g\xE8re", rest: 60 }, { r: [15, 20], s: 3, rir: 2, pct: "< 67 % du max", rest: 60 }, { r: [12, 20], s: 3, rir: 2, pct: "< 67 % du max", rest: 45 }],
    puiss: [{ r: [3, 5], s: 3, rir: 4, pct: "charge l\xE9g\xE8re", rest: 150 }, { r: [3, 5], s: 4, rir: 4, pct: "30-60 % du max", rest: 180 }, { r: [2, 4], s: 5, rir: 4, pct: "30-60 % du max", rest: 180 }],
    acc: [{ r: [10, 12], s: 2, rir: 3, rest: 75 }, { r: [8, 12], s: 3, rir: 2, rest: 90 }, { r: [8, 12], s: 3, rir: 2, rest: 90 }],
    prev: [{ r: [12, 15], s: 2, rir: 3, rest: 60 }, { r: [12, 15], s: 2, rir: 3, rest: 60 }, { r: [12, 15], s: 3, rir: 3, rest: 60 }]
  };
  var STRENGTH_GOALS = ["force", "hyper", "endu_f", "puiss"];
  var ST = {
    fbA: { kind: "muscu", t: "Corps entier A", slots: [["squat", "main"], ["push-h", "main"], ["pull-v", "main"], ["unilat", "acc"], ["core", "acc"], ["epaule", "prev"]] },
    fbB: { kind: "muscu", t: "Corps entier B", slots: [["hinge", "main"], ["push-v", "main"], ["pull-h", "main"], ["unilat", "acc"], ["core", "acc"], ["mollet", "prev"]] },
    haut: { kind: "muscu", t: "Haut du corps", slots: [["push-h", "main"], ["pull-v", "main"], ["push-v", "main"], ["pull-h", "main"], ["epaule", "prev"], ["core", "acc"]] },
    bas: { kind: "muscu", t: "Bas du corps", slots: [["squat", "main"], ["hinge", "main"], ["unilat", "acc"], ["ischio", "prev"], ["mollet", "prev"], ["core", "acc"]] },
    puiss: { kind: "muscu", t: "Puissance", goal: "puiss", slots: [["plyo", "puiss"], ["squat-puiss|hinge", "puiss"], ["push-puiss|push-h", "puiss"], ["pull-puiss|pull-v", "puiss"], ["core", "acc"]] },
    renfo: { kind: "muscu", t: "Renfo grimpeur", goal: "force", slots: [["pull-v", "main"], ["push-h", "acc"], ["pull-iso|pull-h", "acc"], ["epaule", "prev"], ["avantbras", "prev"], ["core", "acc"]] },
    prevS: { kind: "renfo", t: "Pr\xE9vention", goal: "prev", slots: [["epaule", "prev"], ["ischio", "prev"], ["mollet", "prev"], ["avantbras", "prev"], ["core", "prev"], ["unilat", "prev"]] },
    mobi: { kind: "recup", t: "Mobilit\xE9" },
    doigts: { kind: "doigts", t: "Doigts" },
    bloc: { kind: "grimpe", t: "Bloc \xE0 la limite" },
    resist: { kind: "grimpe", t: "R\xE9sistance" },
    conti: { kind: "grimpe", t: "Volume" },
    compet: { kind: "grimpe", t: "Comp\xE9tition" },
    ef: { kind: "cardio", t: "Endurance fondamentale" },
    int: { kind: "cardio", t: "Intervalles" },
    long: { kind: "cardio", t: "Sortie longue" },
    lact: { kind: "cardio", t: "Intervalles lactiques" },
    sprint: { kind: "course", t: "Vitesse" },
    circuit: { kind: "velo", t: "Circuit" }
  };
  var SESSION_LBL = Object.fromEntries(Object.entries(ST).map(([k, v]) => [k, v.t]));
  function pattern(goal, n) {
    const P2 = {
      force: ["fbA", "fbB", "fbA", "haut|bas", "mobi"],
      hyper: ["fbA", "fbB", "fbA", "haut|bas", "mobi"],
      endu_f: ["fbA", "circuit", "fbB", "lact", "ef"],
      puiss: ["puiss", "fbA", "puiss", "fbB", "mobi"],
      vit: ["sprint", "fbA", "sprint", "fbB", "mobi"],
      aero: ["int", "long", "ef", "ef", "int", "ef"],
      doigts: ["doigts", "conti", "doigts", "renfo", "mobi"],
      bloc: ["bloc", "renfo", "bloc", "conti", "mobi"],
      resist: ["resist", "bloc", "resist", "conti", "renfo"],
      conti: ["conti", "renfo", "conti", "resist", "mobi"],
      prev: ["prevS", "mobi", "prevS", "ef", "mobi"],
      compet: ["compet", "renfo", "bloc", "conti", "mobi"]
    }[goal] || ["fbA", "fbB"];
    if (["force", "hyper"].includes(goal) && n >= 4) return ["haut", "bas", "haut", "bas", "mobi", "ef"].slice(0, n);
    if (goal === "aero") return { 1: ["int"], 2: ["int", "long"], 3: ["ef", "int", "long"], 4: ["ef", "int", "ef", "long"], 5: ["ef", "int", "ef", "lact", "long"], 6: ["ef", "int", "ef", "ef", "int", "long"] }[Math.min(6, n)];
    const out = [];
    for (let i = 0; i < n; i++) out.push(P2[i % P2.length].split("|")[0]);
    return out;
  }
  function weekPlanTypes(cfg) {
    const n = cfg.days.length, g2 = cfg.goal2 && cfg.goal2 !== cfg.goal ? cfg.goal2 : null;
    if (!g2 || n < 2) return pattern(cfg.goal, n);
    const n2 = n <= 3 ? 1 : n <= 5 ? 2 : 2, n1 = n - n2;
    const a = pattern(cfg.goal, n1), b = pattern(g2, n2).filter((x) => x !== "mobi");
    while (b.length < n2) b.push(pattern(g2, 3)[b.length % 3]);
    const out = a.slice();
    b.forEach((x, i) => out.splice(Math.min(out.length, (i + 1) * 2 - 1 + i), 0, x));
    return out.slice(0, n);
  }
  var FORMATS = {
    conti: [["blocs", "Beaucoup de blocs", "Volume de mouvements, fili\xE8re a\xE9robie"], ["traversee", "Continuit\xE9", "A\xE9robie long : grimper sans s\u2019arr\xEAter"], ["voies", "Volume en voie", "Beaucoup de voies faciles"]],
    resist: [["4x4", "4 \xD7 4", "R\xE9sistance, fili\xE8re lactique"], ["int", "Intervalles 1 min", "Lactique, sur pan ou travers\xE9e"], ["voies", "Voies encha\xEEn\xE9es", "R\xE9sistance en voie"]],
    bloc: [["limite", "Blocs \xE0 la limite", "Puissance, fili\xE8re alactique"], ["pan", "Pan ou Moonboard", "Mouvements de puissance sur petites prises"]],
    doigts: [["hangs", "Suspensions max", "Force des doigts sur poutre"], ["lift", "Finger lift", "Force des doigts, charge r\xE9gl\xE9e au kilo"], ["blocs", "Petites prises en bloc", "Force des doigts en grimpant"]],
    compet: [["qualif", "Format qualif", "Blocs nouveaux, temps limit\xE9 par bloc"], ["contest", "Contest", "Un maximum de blocs en temps limit\xE9"], ["flash", "Flash", "Un seul essai apr\xE8s lecture"]],
    force: [["classique", "S\xE9ries classiques", "Repos complet entre les s\xE9ries"], ["clusters", "Clusters", "R\xE9p\xE9titions isol\xE9es : plus lourd, m\xEAme qualit\xE9"]],
    hyper: [["classique", "S\xE9ries classiques", "Un exercice \xE0 la fois"], ["supersets", "Supersets antagonistes", "Pouss\xE9e et tirage en alternance : s\xE9ance plus courte"]],
    puiss: [["balistique", "Balistique", "Charges l\xE9g\xE8res lanc\xE9es vite"], ["contraste", "Contraste", "Une s\xE9rie lourde, puis la m\xEAme chose en explosif"]],
    int: [["alterne", "30/30 et 3 min en alternance", "VO2max, deux formats d\u2019une semaine \xE0 l\u2019autre"], ["3030", "30/30", "VO2max en efforts courts"], ["seuil", "Seuil", "Autour de ta vitesse critique"]],
    intV: [["4x4", "4 \xD7 4 min", "VO2max"], ["sst", "Sweet spot", "2 longs blocs juste sous la FTP"]]
  };
  function fmtFamily(type, cfg) {
    if (["conti", "resist", "bloc", "doigts", "compet"].includes(type)) return type;
    if (type === "puiss") return "puiss";
    if (type === "int") {
      const sp = cardioSport(cfg, equipSet(cfg.equip));
      return sp === "course" ? "int" : sp === "velo" ? "intV" : null;
    }
    if (["fbA", "fbB", "haut", "bas", "renfo"].includes(type)) {
      const g = ST[type].goal || [cfg.goal, cfg.goal2].find((x) => ["force", "hyper", "endu_f"].includes(x)) || "force";
      return FORMATS[g] ? g : null;
    }
    return null;
  }
  function fmtReco(fam, cfg) {
    const lv = climbLevel(null, cfg.lv), voieOnly = (lv.vf || lv.vm) && !(lv.bf || lv.bm), eq = equipSet(cfg.equip);
    if (fam === "conti") return voieOnly || cfg.goal === "conti" && voieOnly ? "voies" : "blocs";
    if (fam === "resist") return voieOnly && cfg.goal === "resist" ? "voies" : "4x4";
    if (fam === "bloc") return "limite";
    if (fam === "doigts") return available(LIB_BY_ID["max-hangs"], cfg, eq) ? "hangs" : "blocs";
    if (fam === "compet") return "qualif";
    if (fam === "hyper") return cfg.dur <= 45 ? "supersets" : "classique";
    if (fam === "puiss") return cfg.lvl >= 2 && eq.has("barre") ? "contraste" : "balistique";
    if (fam === "int") return "alterne";
    if (fam === "intV") return "4x4";
    return "classique";
  }
  var fmtOf = (fam, cfg) => cfg.fmt && cfg.fmt[fam] && FORMATS[fam].some((f) => f[0] === cfg.fmt[fam]) ? cfg.fmt[fam] : fmtReco(fam, cfg);
  function available(x, cfg, eq) {
    if (x.lvl > cfg.lvl) return false;
    if (x.u18 === false && cfg.u18) return false;
    if (!x.eq.some((e) => eq.has(e))) return false;
    if (!x.sp.includes("all") && !x.sp.some((s) => (cfg.sports || []).includes(s))) return false;
    return true;
  }
  function pick(pats, quality, cfg, eq, used) {
    const ps = pats.split("|");
    for (const p of ps) {
      let c = LIB.filter((x) => x.pat === p && available(x, cfg, eq));
      if (!c.length) continue;
      const pref = c.filter((x) => x.q.includes(quality));
      if (pref.length) c = pref.concat(c.filter((x) => !pref.includes(x)));
      const fresh = c.filter((x) => !used.has(x.id));
      return fresh[0] || c[0];
    }
    return null;
  }
  function cardioSport(cfg, eq) {
    const s = cfg.sports || [];
    if (eq.has("exterieur") && (!s.length || s.some((x) => ["course", "trail", "hyrox", "collectif", "combat", "autre", "muscu", "escalade"].includes(x)))) return "course";
    if (eq.has("velo")) return "velo";
    if (eq.has("piscine")) return "nage";
    if (eq.has("exterieur")) return "course";
    return "circuit";
  }
  var range2 = (r) => r[0] === r[1] ? String(r[0]) : r[0] + "-" + r[1];
  var rirTxt = (n) => "r\xE9serve " + n + (n >= 4 ? "+" : "");
  var PCT = [0, 100, 95, 93, 90, 87, 85, 83, 80, 77, 75, 70, 67, 66, 65, 65];
  function pctTxt(r, rir) {
    if (r[0] + rir > 15) return "< 65 % du max";
    const a = PCT[Math.min(15, r[1] + rir)], b = PCT[Math.min(15, r[0] + rir)];
    return "\u2248 " + (a === b ? a : a + "-" + b) + " % du max";
  }
  function detReps(x, rx, week) {
    if (x.t === "iso") return (x.hold || (week.light ? "20-30 s" : rx.goal === "endu_f" || rx.role === "prev" ? "30-45 s" : "20-40 s")) + " de maintien";
    const parts = [range2(rx.r) + " r\xE9p." + (x.pat === "unilat" || x.pat === "mollet" || x.id === "rot-ext" || x.id === "rowing-halt" ? " par c\xF4t\xE9" : "")];
    parts.push(rirTxt(rx.rir));
    if (rx.role === "main" && x.ld !== "bw" && ["force", "hyper", "endu_f"].includes(rx.goal)) parts.push(pctTxt(rx.r, rx.rir));
    else if (rx.pct && rx.role === "puiss" && x.ld !== "bw") parts.push(rx.pct);
    if (x.ld === "bw" && rx.role === "main") parts.push("lest ou variante plus facile pour rester dans la fourchette");
    if (rx.role === "puiss") parts.push("vitesse maximale, arr\xEAt si \xE7a ralentit");
    return parts.join(" \xB7 ");
  }
  function weekInfo(cfg, i, W) {
    const tw = cfg.event ? W >= 6 ? 2 : 1 : 0;
    if (tw && i >= W - tw) return { phase: "affutage", taper: true, step: 1, meso: Math.floor(i / 4) };
    const pos = i % 4, meso = Math.floor(i / 4);
    if (pos === 3 && W >= 4) return { phase: "deload", light: true, step: 0, meso };
    const sys = (GOAL_BY_ID[cfg.goal] || {}).sys;
    const seq = sys === "alac" ? ["force", "puissance", "specifique"] : sys === "lact" || sys === "aero" ? ["volume", "specifique", "specifique"] : sys === "prev" ? ["volume", "volume", "volume"] : ["volume", "force", "specifique"];
    return { phase: seq[Math.min(2, meso)], step: pos, meso };
  }
  function rxFor(goal, role2, cfg, wk) {
    const lv = cfg.lvl - 1;
    const base = clone((role2 === "main" || role2 === "puiss" ? RX[role2 === "puiss" ? "puiss" : goal] || RX.acc : RX[role2] || RX.acc)[lv]);
    base.role = role2;
    base.goal = goal;
    if (role2 === "main" && goal === "force") {
      const sh = [2, 0, -1][Math.min(2, wk.meso)];
      base.r = [Math.max(1, base.r[0] + sh), Math.max(2, base.r[1] + sh)];
    }
    if (wk.light) {
      base.s = Math.max(1, Math.round(base.s * 0.6));
      base.rir = 4;
      base.light = true;
    } else if (wk.taper) {
      base.s = Math.max(1, Math.round(base.s * 0.5));
    } else {
      if (role2 !== "puiss") base.rir = Math.min(role2 === "prev" ? 4 : 3, Math.max(cfg.lvl === 1 ? 2 : 1, base.rir + [1, 0, -1][wk.step]));
      if (wk.step === 2 && role2 === "main") base.s += 1;
    }
    return base;
  }
  var ech = (det, label) => ({ id: "ech", label: label || "\xC9chauffement", det, n: 1 });
  function strengthSession(type, cfg, eq, wk, used, memo, goalOverride) {
    const T = ST[type], goal = goalOverride || T.goal || [cfg.goal, cfg.goal2].find((g) => ["force", "hyper", "endu_f"].includes(g)) || "force";
    const fam = fmtFamily(type, cfg), fmt = fam ? fmtOf(fam, cfg) : "classique";
    const nEx = (cfg.dur <= 45 ? 4 : cfg.dur <= 60 ? 5 : 6) - (fmt === "clusters" ? 1 : 0);
    const items = [], heavy = /* @__PURE__ */ new Set();
    const mem = memo ? memo[type] = memo[type] || [] : [];
    for (const [si, [pats, role2]] of T.slots.entries()) {
      if (items.length >= nEx) break;
      const q = role2 === "main" ? goal : role2 === "puiss" ? "puiss" : role2 === "prev" ? "prev" : goal === "force" ? "hyper" : goal;
      let x = mem[si] !== void 0 ? mem[si] && LIB_BY_ID[mem[si]] : pick(pats, q, cfg, eq, used);
      if (mem[si] === void 0) mem[si] = x ? x.id : null;
      if (x && cfg.swap && cfg.swap[x.id] && LIB_BY_ID[cfg.swap[x.id]]) x = LIB_BY_ID[cfg.swap[x.id]];
      if (!x || items.some((it2) => it2.lib === x.id)) continue;
      used.add(x.id);
      const rx = rxFor(goal === "prev" ? "prev" : goal, goal === "prev" ? "prev" : role2, cfg, wk);
      if (x.rr) rx.r = x.rr.slice();
      const it = { id: uid("i"), label: x.n, det: detReps(x, rx, wk), n: rx.s, unit: "S\xE9rie", rest: rx.rest, lib: x.id, rx: { goal: rx.goal, role: role2, r: rx.r, rir: rx.rir, light: !!rx.light } };
      if (x.ld === "+kg") it.unit_load = "+kg";
      const lift = role2 === "main" && ["force", "hyper", "endu_f"].includes(rx.goal) ? LIFT_OF_LIB[x.id] : null, rm = lift ? oneRM(lift, null, cfg.lv) : null;
      if (rm) {
        const mid = Math.round((rx.r[0] + rx.r[1]) / 2), pc = PCT[Math.min(15, mid + rx.rir)] || 65, ld = loadForPct(rm, pc);
        if (ld != null) {
          it.load = ld;
          it.unit_load = rm.lest ? "+kg" : "kg";
          it.reps = mid;
          it.det = it.det.split(" \xB7 ").filter((x2) => !/% du max|lest ou variante/.test(x2)).concat([(rm.lest && ld >= 0 ? "+" : "") + fmtNum(ld) + " kg (\u2248 " + pc + " % de ton 1RM, " + rm.txt + ")"]).join(" \xB7 ");
        }
      }
      if (role2 === "main" && fmt === "clusters" && x.t !== "iso" && items.filter((y) => y.timer && y.timer.kind === "cluster").length < 2) {
        const reps = rx.r[0];
        it.timer = { kind: "cluster", reps, intra: 20, setRest: rx.rest };
        it.det = reps + " r\xE9p. isol\xE9es, 20 s entre chaque \xB7 " + it.det.split(" \xB7 ").slice(1).join(" \xB7 ");
        delete it.rest;
      }
      items.push(it);
      if (x.heavy && !wk.light && role2 !== "prev") x.g.forEach((g) => heavy.add(g));
    }
    if (fmt === "supersets") for (let i = 1; i < items.length; i++) {
      const a = LIB_BY_ID[items[i - 1].lib] || {}, b = LIB_BY_ID[items[i].lib] || {};
      if (items[i - 1].superset || items[i].superset || items[i - 1].pairWith) continue;
      const pa = String(a.pat || ""), pb = String(b.pat || "");
      if (pa.startsWith("push") && pb.startsWith("pull") || pa.startsWith("pull") && pb.startsWith("push")) {
        items[i].superset = items[i - 1].id;
        items[i - 1].pairWith = true;
        items[i - 1].pairRest = 60;
        items[i].rest = items[i - 1].rest;
        delete items[i - 1].pairWith;
        i++;
      }
    }
    if (fmt === "contraste" && !wk.light) {
      const pairs = [["squat", "plyo", "Squat lourd + sauts"], ["push-h", "push-puiss", "D\xE9velopp\xE9 couch\xE9 lourd + pompes explosives"], ["pull-v", "pull-puiss", "Tractions lest\xE9es lourdes + tractions explosives"]];
      const out = [];
      for (const [hp, lp, lbl] of pairs) {
        let h = pick(hp, "force", cfg, eq, /* @__PURE__ */ new Set()), l = pick(lp, "puiss", cfg, eq, /* @__PURE__ */ new Set());
        if (!h || !l) continue;
        if (cfg.swap && cfg.swap[h.id] && LIB_BY_ID[cfg.swap[h.id]]) h = LIB_BY_ID[cfg.swap[h.id]];
        if (cfg.swap && cfg.swap[l.id] && LIB_BY_ID[cfg.swap[l.id]]) l = LIB_BY_ID[cfg.swap[l.id]];
        const lift = LIFT_OF_LIB[h.id], rm = lift ? oneRM(lift, null, cfg.lv) : null, ld = rm ? loadForPct(rm, 87) : null;
        out.push({ id: uid("i"), label: "Contraste : " + h.n.toLowerCase() + " + " + l.n.toLowerCase(), det: "3 r\xE9p. lourdes" + (ld != null ? " \xE0 " + (rm.lest && ld >= 0 ? "+" : "") + fmtNum(ld) + " kg (\u2248 87 % de ton 1RM)" : " (\u2248 85-90 % du max)") + ", 4 min, puis 5 " + (lp === "plyo" ? "sauts" : "r\xE9p\xE9titions explosives") + " \xE0 vitesse maximale", n: wk.taper ? 2 : cfg.lvl >= 3 ? 4 : 3, unit: "S\xE9rie", lib: h.id, timer: { kind: "contrast", heavyRest: 240, lightRest: 180 }, rx: { goal: "puiss", role: "puiss", light: false } });
        if (ld != null) {
          out[out.length - 1].load = ld;
          out[out.length - 1].unit_load = rm.lest ? "+kg" : "kg";
        }
        h.g.forEach((g) => heavy.add(g));
      }
      if (out.length) {
        items.splice(0, items.length, ...out.concat(items.filter((it) => it.rx && it.rx.role === "acc")));
      }
    }
    const g0 = GOAL_BY_ID[goal] || GOAL_BY_ID.force;
    const mainRx = rxFor(goal, "main", cfg, wk);
    const prog = goal === "puiss" ? "Vitesse avant tout : on garde des charges l\xE9g\xE8res et on arr\xEAte la s\xE9rie d\xE8s que le mouvement ralentit." : cfg.lvl === 3 ? "Charge r\xE9gl\xE9e sur la r\xE9serve : si tu termines avec plus de r\xE9serve que pr\xE9vu, ajoute 2,5 \xE0 5 % la s\xE9ance suivante ; avec moins, garde la charge." : "Double progression : quand toutes les s\xE9ries atteignent le haut de la fourchette avec la r\xE9serve vis\xE9e, ajoute la plus petite charge possible (2,5 kg) la s\xE9ance suivante.";
    const blk = { id: uid("b"), kind: T.kind, title: (T.kind === "renfo" ? "Renfo" : "Muscu") + " \xB7 " + T.t, desc: items.length + " exercices \xB7 " + (wk.light ? "semaine de d\xE9charge" : wk.taper ? "aff\xFBtage : moins de s\xE9ries, m\xEAme intensit\xE9" : g0.l.toLowerCase()), sub: wk.light ? "D\xE9charge : environ 40 % de s\xE9ries en moins, m\xEAme charge ou un peu moins, loin de l\u2019\xE9chec." : prog, items: [ech("5 \xE0 10 min de cardio l\xE9ger, mobilit\xE9, puis 2 \xE0 3 s\xE9ries de mont\xE9e en charge sur le premier exercice.")].concat(items) };
    const rpe = wk.light ? [4, 6] : goal === "puiss" ? [5, 7] : goal === "endu_f" ? [6, 8] : goal === "prev" ? [4, 6] : goal === "hyper" ? [7, 9] : [7, 8];
    const sys = SYSTEMS[g0.sys] || SYSTEMS.neuro;
    let sec = 600, tut = 0;
    for (const it of items) {
      const r = it.reps || (it.rx && it.rx.r ? Math.round((it.rx.r[0] + it.rx.r[1]) / 2) : 8);
      sec += it.n * (40 + (it.superset ? 0 : it.rest || (it.timer ? it.timer.setRest || it.timer.heavyRest + it.timer.lightRest || 180 : 90)));
      tut += it.n * (it.timer && it.timer.kind === "contrast" ? 2 * 5 * 2 : r * 3);
    }
    if (fmt === "clusters") sec += items.filter((it) => it.timer && it.timer.kind === "cluster").reduce((a, it) => a + it.n * it.timer.reps * it.timer.intra, 0);
    return { short: T.t, blocks: [blk], target: { rpe, fam: wk.light || goal === "prev" ? "light" : "muscu", why: sys.l + " \xB7 " + sys.d + (mainRx.rest ? " Repos : " + mmss(mainRx.rest) + " entre les s\xE9ries des exercices principaux." : "") }, heavy, est: { min: Math.round(sec / 60 / 5) * 5, tut, fmt } };
  }
  function gradeRx(lv, key, shift, disc) {
    const r = lv[key];
    if (!r) return null;
    const g = shiftGrade(r.g, shift, disc), ref = key === "bf" ? "flash" : key === "vf" ? "\xE0 vue" : "max";
    return { g, txt: g + " (" + (gapText(g, r.g, disc, ref) || "") + ")" };
  }
  function climbSession(type, cfg, eq, wk) {
    const m = wk.light ? 0.6 : wk.taper ? 0.5 : 1, n = (base, add) => Math.max(1, Math.round((base + (wk.light || wk.taper ? 0 : add[wk.step])) * m));
    const heavy = /* @__PURE__ */ new Set(), blocks2 = [], lv = climbLevel(null, cfg.lv), L = cfg.lvl - 1;
    const durF = cfg.dur <= 45 ? 0.75 : cfg.dur <= 60 ? 1 : cfg.dur <= 75 ? 1.25 : 1.5;
    const avail = Math.max(20, cfg.dur - 15) * 60;
    const fmt = fmtOf(type, cfg);
    let short = ST[type].t, tg, est = { fmt };
    const blk = (title, desc, sub, items, kind) => blocks2.push({ id: uid("b"), kind: kind || "grimpe", title, desc, sub, items });
    if (type === "doigts") {
      if (fmt === "hangs" && available(LIB_BY_ID["max-hangs"], cfg, eq)) {
        const reps = n(5, [0, 1, 1]);
        blk("Doigts \xB7 suspensions max", reps + " \xD7 10 s \xB7 3 min de repos", "Charge : celle que tu tiendrais environ 13 s (marge de 3 s). Quand les 10 s deviennent faciles sur toutes les suspensions, ajoute 1 \xE0 2 kg (ou retire de la d\xE9charge).", [
          ech("10 min de grimpe facile, puis 3 suspensions de 10 s \xE0 environ 50, 70 et 85 % de l\u2019effort, 1 min entre chaque.", "\xC9chauffement des doigts"),
          { id: uid("i"), label: "Suspensions max \xB7 20 mm semi-arqu\xE9", det: "10 s par suspension, 3 min de repos (fili\xE8re alactique, 1:18)", n: reps, unit: "S\xE9rie", unit_load: "+kg", lib: "max-hangs", rx: { goal: "doigts", role: "main", light: !!wk.light }, timer: { kind: "interval", name: "Suspensions max", work: 10, rest: 180, reps, sets: 1, setRest: 0, prep: 10, workLabel: "Suspends", restLabel: "Repos", markEach: "rep" } }
        ], "doigts");
        est = { fmt, min: 15 + Math.round(reps * 190 / 60), tut: reps * 10 };
      } else if (fmt === "lift" && available(LIB_BY_ID["finger-lift"], cfg, eq)) {
        const reps = n(5, [0, 1, 1]), lifts = reps * 2, t = lastResult("fl-semi"), mx = t && t.vals && typeof t.vals.v === "number" ? t.vals.v : null, ld = mx ? Math.round(mx * 0.85 / 1.25) * 1.25 : null;
        const it = { id: uid("i"), label: "Finger lift \xB7 semi-arqu\xE9", det: lifts + " lev\xE9es de 7 s en alternant les mains (" + reps + " par main), 1 min 30 entre deux" + (ld ? " \xB7 " + fmtNum(ld) + " kg (\u2248 85 % de ton test du " + fmtDay(t.k) + ")" : " \xB7 charge que tu tiendrais 9 \xE0 10 s"), n: lifts, unit: "S\xE9rie", lib: "finger-lift", rx: { goal: "doigts", role: "main", light: !!wk.light }, timer: { kind: "interval", name: "Finger lift", work: 7, rest: 90, reps: lifts, sets: 1, setRest: 0, prep: 10, workLabel: "L\xE8ve", restLabel: "Change de main", markEach: "rep" } };
        if (ld) {
          it.load = ld;
          it.unit_load = "kg";
        }
        blk("Doigts \xB7 finger lift", reps + " \xD7 7 s par main, en alternant", "Progression : quand les 7 s passent avec de la marge sur toutes les lev\xE9es, ajoute 1 \xE0 2 kg.", [ech("10 min de grimpe facile, puis 3 lev\xE9es de 7 s en montant la charge.", "\xC9chauffement des doigts"), it], "doigts");
        est = { fmt, min: 15 + Math.round(lifts * 97 / 60), tut: lifts * 7 };
      } else {
        const tries = n(Math.round(7 * durF), [0, 1, 2]), g = gradeRx(lv, "bm", -1, "bloc");
        blk("Escalade \xB7 force des doigts", tries + " essais tr\xE8s durs sur petites prises", cfg.u18 ? "Avant 18 ans, pas de suspensions max : la grimpe sur petites prises fait progresser les doigts sans risque pour les cartilages de croissance." : "Qualit\xE9 avant quantit\xE9 : on arr\xEAte d\xE8s que les essais deviennent moins bons.", [
          ech("15 min de grimpe facile, puis 3 \xE0 4 blocs de plus en plus durs."),
          Object.assign({ id: uid("i"), label: "Blocs \xE0 ta limite sur petites prises", det: "3 \xE0 6 mouvements quasi maximaux, 3 min entre les essais" + (g ? " \xB7 " + g.txt : ""), n: tries, unit: "Essai", rest: 180, lib: "limite", rx: { goal: "doigts", role: "main", light: !!wk.light } }, g ? { grade: g.g } : {})
        ]);
        est = { fmt, min: 15 + Math.round(tries * 195 / 60), tut: tries * 15 };
      }
      if (!wk.light) heavy.add("doigts");
      short = "Doigts";
      tg = { rpe: wk.light ? [4, 6] : [7, 8], fam: wk.light ? "light" : "hard", s: 6, i: wk.light ? 5 : 9, v: 3 };
    } else if (type === "bloc") {
      const pan = fmt === "pan" && available(LIB_BY_ID["pan-dur"], cfg, eq), x = pan ? LIB_BY_ID["pan-dur"] : LIB_BY_ID.limite;
      const tries = n(Math.round(7 * durF), [0, 1, 2]), g = pan ? null : gradeRx(lv, "bm", 0, "bloc");
      const items = [ech("15 min de grimpe facile, puis 3 \xE0 4 blocs de plus en plus durs."), Object.assign({ id: uid("i"), label: x.n, det: "3 \xE0 6 mouvements quasi maximaux, 3 min entre les essais (fili\xE8re alactique)" + (g ? " \xB7 autour de " + g.g + " (ton max)" : ""), n: tries, unit: "Essai", rest: 180, lib: x.id, rx: { goal: "bloc", role: "main", light: !!wk.light } }, g ? { grade: g.g } : {})];
      if (available(LIB_BY_ID.campus, cfg, eq) && !wk.light) items.push({ id: uid("i"), label: "Campus sur prises larges", det: "Mont\xE9es 1-3-5, arr\xEAt d\xE8s que la qualit\xE9 baisse", n: wk.taper ? 2 : 4, unit: "Essai", rest: 180, lib: "campus" });
      if (available(LIB_BY_ID["tractions-expl"], cfg, eq) && cfg.dur >= 60) items.push({ id: uid("i"), label: "Tractions explosives", det: "3 r\xE9p. \xB7 vitesse maximale", n: wk.light ? 2 : 4, unit: "S\xE9rie", rest: 150, lib: "tractions-expl" });
      blk("Escalade \xB7 " + (pan ? "pan" : "bloc \xE0 la limite"), tries + " essais tr\xE8s durs, frais \xE0 chaque fois", "Qualit\xE9 avant quantit\xE9 : on arr\xEAte d\xE8s que les essais deviennent moins bons.", items);
      if (!wk.light) {
        heavy.add("doigts");
        heavy.add("tirage");
      }
      short = "Bloc limite";
      tg = { rpe: wk.light ? [4, 6] : [8, 9], fam: wk.light ? "light" : "hard", s: 9, i: wk.light ? 5 : 9, v: 4 };
      est = { fmt, min: 15 + Math.round((tries + (items.length - 2) * 4) * 195 / 60), tut: tries * 15 };
    } else if (type === "compet") {
      const ech0 = ech("20 min : grimpe facile, puis 4 \xE0 5 blocs de plus en plus durs, comme avant une comp\xE9tition.");
      let it, desc, sub;
      if (fmt === "contest") {
        const nb = n([10, 14, 18][L], [0, 1, 2]), g = gradeRx(lv, "bf", -3, "bloc"), top = lv.bm ? lv.bm.g : null;
        it = Object.assign({ id: uid("i"), label: "Contest", det: "Du plus facile au plus dur" + (g ? ", de " + g.g + " \xE0 " + (top || "ton max") : "") + " \xB7 2 min entre les blocs, note chaque bloc (Tomb\xE9 si rat\xE9)", n: nb, unit: "Bloc", rest: 120, lib: "compet-sim", disc: "bloc" }, g ? { grade: g.g } : {});
        desc = "Un maximum de blocs en temps limit\xE9, comme en open";
        sub = "Choisis tes blocs comme en contest : assure les points faciles, puis monte. La cotation se r\xE8gle bloc par bloc.";
        est = { fmt, min: 20 + Math.round(nb * 160 / 60), tut: nb * 45 };
      } else if (fmt === "flash") {
        const nb = n([5, 6, 8][L], [0, 0, 1]), g = gradeRx(lv, "bf", 0, "bloc");
        it = Object.assign({ id: uid("i"), label: "Flash de blocs nouveaux", det: "1 min de lecture depuis le sol, un seul essai, 3 min de repos" + (g ? " \xB7 autour de " + g.g + " (ton flash)" : ""), n: nb, unit: "Essai", rest: 180, lib: "flash" }, g ? { grade: g.g } : {});
        desc = "Lecture et engagement : un seul essai par bloc";
        sub = "Lis la s\xE9quence enti\xE8re avant de partir : mains, pieds, repos. Note les flashs r\xE9ussis : c\u2019est ton indicateur.";
        est = { fmt, min: 20 + Math.round(nb * 240 / 60), tut: nb * 40 };
      } else {
        const nb = wk.light || wk.taper ? 3 : cfg.lvl >= 2 ? 5 : 4, g = gradeRx(lv, "bf", -1, "bloc"), top = lv.bm ? lv.bm.g : null;
        it = Object.assign({ id: uid("i"), label: "Simulation de qualif", det: "Blocs nouveaux de difficult\xE9 croissante" + (g ? " (" + g.g + " \xE0 " + (top || "ton max") + ")" : "") + " \xB7 4 min d\u2019essais par bloc, 4 min de repos", n: nb, unit: "Bloc", lib: "compet-sim", timer: { kind: "interval", name: "Qualif", work: 240, rest: 240, reps: nb, sets: 1, setRest: 0, prep: 10, workLabel: "Essais", restLabel: "Repos", markEach: "rep" } }, g ? { grade: g.g } : {});
        desc = nb + " blocs \xB7 4 min d\u2019essais, 4 min de repos";
        sub = "Au plus pr\xE8s du format des comp\xE9titions (4 \xE0 5 min par bloc) : g\xE8re tes essais, repose-toi vraiment entre deux. Note tops et zones.";
        est = { fmt, min: 20 + Math.round(nb * 8), tut: nb * 120 };
      }
      blk("Escalade \xB7 comp\xE9tition", desc, sub, [ech0, it]);
      if (!wk.light) {
        heavy.add("doigts");
        heavy.add("tirage");
      }
      short = "Comp\xE9tition";
      tg = { rpe: wk.light ? [4, 6] : [7, 9], fam: wk.light ? "light" : "hard", s: 10, i: wk.light ? 5 : 8, v: 5 };
    } else if (type === "resist") {
      const items = [ech("15 min de grimpe facile qui monte progressivement.")];
      if (fmt === "int" && available(LIB_BY_ID["int-pan"], cfg, eq)) {
        const reps = n(Math.round(5 * durF), [0, 1, 2]);
        items.push({ id: uid("i"), label: "Intervalles 1 min sur pan", det: "1 min de grimpe soutenue, 3 min de repos (1:3)", n: reps, unit: "S\xE9rie", lib: "int-pan", timer: { kind: "interval", name: "Intervalles 1 min", work: 60, rest: 180, reps, sets: 1, setRest: 0, prep: 10, workLabel: "Grimpe", restLabel: "Repos", markEach: "rep" } });
        est = { fmt, min: 15 + Math.round(reps * 4), tut: reps * 60 };
      } else if (fmt === "voies") {
        const sets = n([3, 4, 5][L], [0, 0, 1]), g = gradeRx(lv, "vf", -2, "voie");
        items.push(Object.assign({ id: uid("i"), label: "Encha\xEEnement de deux voies", det: "Deux voies d\u2019affil\xE9e sans redescendre au sol si possible, 5 min de repos" + (g ? " \xB7 " + g.txt : " \xB7 ton \xE0 vue moins 2"), n: sets, unit: "S\xE9rie", rest: 300, lib: "enchainement", disc: "voie" }, g ? { grade: g.g } : {}));
        est = { fmt, min: 15 + Math.round(sets * 11), tut: sets * 360 };
      } else {
        const sets = n(cfg.dur >= 75 ? 5 : 4, [0, 0, 1]), g = gradeRx(lv, "bm", -3, "bloc");
        items.push(Object.assign({ id: uid("i"), label: "4 blocs encha\xEEn\xE9s (4 \xD7 4)", det: "Une s\xE9rie = 4 blocs sans pause, 3 \xE0 4 min de repos entre les s\xE9ries" + (g ? " \xB7 " + g.txt : " \xB7 2 \xE0 3 niveaux sous ta limite"), n: sets, unit: "S\xE9rie", rest: 210, lib: "4x4" }, g ? { grade: g.g } : {}));
        est = { fmt, min: 15 + Math.round(sets * (160 + 210) / 60), tut: sets * 160 };
      }
      blk("Escalade \xB7 r\xE9sistance", "Fili\xE8re lactique : efforts de 1 \xE0 3 min qui \xAB br\xFBlent \xBB", "Progression : un bloc ou une s\xE9rie de plus, ou des blocs un peu plus durs, quand tout passe proprement.", items);
      tg = { rpe: wk.light ? [4, 6] : [7, 9], fam: wk.light ? "light" : "hard", s: 8, i: wk.light ? 5 : 7, v: 7 };
    } else {
      if (fmt === "blocs") {
        const nb = Math.max(6, Math.round((Math.min([14, 20, 26][L], Math.floor(avail / 100)) + (wk.light || wk.taper ? 0 : [0, 2, 4][wk.step])) * m));
        const g = gradeRx(lv, "bf", -3, "bloc");
        blk("Escalade \xB7 volume", nb + " blocs \xB7 1 min de repos", "Assez facile pour encha\xEEner sans \xAB bouteiller \xBB : si les chutes s\u2019accumulent, descends d\u2019une cotation. Le mode blocs note les chutes et le temps sur le mur.", [
          ech("10 min de grimpe tr\xE8s facile."),
          Object.assign({ id: uid("i"), label: "Blocs" + (g ? " " + g.g : " faciles"), det: "1 min de repos entre les blocs" + (g ? " \xB7 " + g.txt : " \xB7 nettement sous ton flash"), n: nb, unit: "Bloc", rest: 60, lib: "volume-blocs", disc: "bloc" }, g ? { grade: g.g } : {})
        ]);
        est = { fmt, min: 10 + Math.round(nb * 100 / 60), tut: nb * 40 };
      } else if (fmt === "voies") {
        const nv = Math.max(4, Math.round((Math.min([6, 9, 12][L], Math.floor(avail / 420)) + (wk.light || wk.taper ? 0 : [0, 1, 2][wk.step])) * m)), g = gradeRx(lv, "vf", -3, "voie");
        blk("Escalade \xB7 volume en voie", nv + " voies faciles", "Beaucoup de voies faciles en soignant les placements ; repos le temps d\u2019assurer.", [
          ech("10 min de grimpe tr\xE8s facile."),
          Object.assign({ id: uid("i"), label: "Voies" + (g ? " " + g.g : " faciles"), det: "Environ 4 min de repos (le temps d\u2019assurer)" + (g ? " \xB7 " + g.txt : " \xB7 2 \xE0 3 niveaux sous ton \xE0 vue"), n: nv, unit: "Voie", rest: 240, lib: "volume", disc: "voie" }, g ? { grade: g.g } : {})
        ]);
        est = { fmt, min: 10 + Math.round(nv * 7), tut: nv * 180 };
      } else {
        const k = cfg.dur <= 45 ? [2, 10] : cfg.dur <= 60 ? [2, 15] : cfg.dur <= 75 ? [3, 12] : [3, 15];
        const sets = n(k[0], [0, 0, 1]), g = gradeRx(lv, "bf", -4, "bloc");
        blk("Escalade \xB7 continuit\xE9", "Fili\xE8re a\xE9robie : long et facile", "Avant-bras chauds mais jamais \xAB bouteill\xE9s \xBB : si \xE7a br\xFBle, descends d\u2019un niveau.", [ech("10 min de grimpe tr\xE8s facile."), { id: uid("i"), label: "Continuit\xE9 " + sets + " \xD7 " + k[1] + " min", det: "Grimpe facile sans t\u2019arr\xEAter (travers\xE9es, voies faciles encha\xEEn\xE9es), 5 min de repos" + (g ? " \xB7 " + g.txt : ""), n: sets, unit: "Bloc", rest: 300, lib: "conti" }]);
        est = { fmt, min: 10 + sets * (k[1] + 5), tut: sets * k[1] * 60 };
      }
      short = "Volume";
      tg = { rpe: [3, 5], fam: "vol", s: 6, i: 3, v: wk.light ? 5 : 8 };
    }
    const sys = SYSTEMS[(GOAL_BY_ID[type === "compet" ? "compet" : type] || GOAL_BY_ID.conti).sys];
    tg.why = sys.l + " \xB7 " + sys.d;
    return { short, blocks: blocks2, target: tg, heavy, est };
  }
  function vmaTxt(vma, lo, hi) {
    return vma ? "allure " + paceAt(vma.v, hi) + " \xE0 " + paceAt(vma.v, lo) + " /km (" + lo + "-" + hi + " % de ta VMA)" : null;
  }
  function distTxt(vma, pct2, sec) {
    if (!vma) return null;
    const m = Math.round(vma.v * pct2 / 100 / 3.6 * sec / 5) * 5;
    return "\u2248 " + m + " m en " + (sec >= 60 ? sec / 60 + " min" : sec + " s") + " (" + pct2 + " % de ta VMA)";
  }
  function fcTxt(fc, lo, hi) {
    return fc ? lo + "-" + hi + " % de ta FC max, soit " + Math.round(fc.v * lo / 100) + " \xE0 " + Math.round(fc.v * hi / 100) + " bpm" : null;
  }
  function wTxt(ftp, lo, hi) {
    return ftp ? hi ? Math.round(ftp.v * lo / 100) + " \xE0 " + Math.round(ftp.v * hi / 100) + " W (" + lo + "-" + hi + " % de ta FTP)" : "au moins " + Math.round(ftp.v * lo / 100) + " W (" + lo + " % de ta FTP et plus)" : null;
  }
  function csTxt(cs, lo, hi) {
    return cs ? "allure " + paceAt(cs.v, hi) + " \xE0 " + paceAt(cs.v, lo) + " /km (" + lo + "-" + hi + " % de ta vitesse critique)" : null;
  }
  function cardioSession(type, cfg, eq, wk) {
    const sport = cardioSport(cfg, eq), kind = sport === "course" ? "course" : "velo";
    const vma = sport === "course" ? vmaOf(null, cfg.lv) : null, fc = fcmaxOf(null, cfg.lv), cs = sport === "course" ? csOf() : null, ftp = sport === "velo" ? ftpOf(null, cfg.lv) : null;
    const fam = type === "int" ? fmtFamily("int", cfg) : null, fmt = fam ? fmtOf(fam, cfg) : null;
    let est = fmt ? { fmt } : void 0;
    const m = wk.light ? 0.6 : wk.taper ? 0.5 : 1, lv = cfg.lvl - 1, heavy = /* @__PURE__ */ new Set();
    const nm = { course: ["Footing", "Course"], velo: ["V\xE9lo", "V\xE9lo"], nage: ["Natation", "Natation"], circuit: ["Circuit", "Circuit"] }[sport];
    let blocks2, short = ST[type] ? ST[type].t : "Cardio", tg;
    if (sport === "circuit" && type !== "ef" && type !== "long") type = "circuit";
    if (type === "ef" || type === "long") {
      const base = type === "long" ? [50, 75, 95][lv] : Math.max(30, cfg.dur - 10), mins = Math.round(base * (wk.light ? 0.7 : wk.taper ? 0.6 : [1, 1.1, 1.15][wk.step]) / 5) * 5;
      const x = sport === "velo" ? "velo-z2" : sport === "nage" ? "nage-ef" : sport === "circuit" ? null : type === "long" ? "sortie-longue" : "ef";
      const lbl = x ? type === "long" ? "Sortie longue" : LIB_BY_ID[x].n : "Cardio facile (marche rapide, v\xE9lo, corde \xE0 sauter\u2026)";
      const zone = vmaTxt(vma, 60, 70) || (sport === "velo" ? wTxt(ftp, 56, 75) : null) || fcTxt(fc, 60, 70);
      blocks2 = [{ id: uid("b"), kind, title: nm[1] + " \xB7 " + (type === "long" ? "sortie longue" : "endurance fondamentale"), desc: mins + " min faciles", sub: "Zone 1-2 : tu peux parler en phrases compl\xE8tes. C\u2019est l\u2019essentiel du volume en endurance (environ 80 %).", items: [Object.assign({ id: uid("i"), label: lbl + " \xB7 " + mins + " min", det: (x ? LIB_BY_ID[x].c : "Zone 1-2, aisance respiratoire.") + (zone ? " \xB7 " + zone : ""), n: 1, unit: "Bloc" }, x ? { lib: x } : {})] }];
      tg = { rpe: [2, 4], fam: type === "long" ? "vol" : "easy" };
    } else if (type === "circuit") {
      const rounds = Math.max(2, Math.round(([3, 4, 5][lv] + (wk.light || wk.taper ? 0 : [0, 0, 1][wk.step])) * m));
      blocks2 = [{ id: uid("b"), kind: "velo", title: "Circuit fonctionnel", desc: rounds + " tours \xB7 5 ateliers", sub: "Fili\xE8re lactique et a\xE9robie : 40 s par atelier, 20 s de transition, 2 min entre les tours.", items: [ech("5 min de cardio l\xE9ger et de mobilit\xE9."), { id: uid("i"), label: "Circuit : burpees, fentes, squats, pompes, gainage", det: "40 s d\u2019effort, 20 s de transition", n: rounds, unit: "S\xE9rie", lib: "circuit", timer: { kind: "interval", name: "Circuit", work: 40, rest: 20, reps: 5, sets: rounds, setRest: 120, prep: 10, workLabel: "Effort", restLabel: "Change" } }] }];
      tg = { rpe: wk.light ? [4, 6] : [7, 8], fam: wk.light ? "light" : "hard" };
      if (!wk.light) heavy.add("cardio");
    } else {
      let it;
      if (type === "int" && fmt === "seuil") {
        const reps = Math.max(2, Math.round(([3, 4, 5][lv] + (wk.light || wk.taper ? 0 : [0, 0, 1][wk.step])) * m));
        it = { label: "Seuil " + reps + " \xD7 8 min", det: "8 min \xE0 allure seuil, 2 min de trot" + (cs ? " \xB7 " + csTxt(cs, 93, 97) : vma ? " \xB7 " + vmaTxt(vma, 82, 86) + " (sans test de vitesse critique)" : " \xB7 allure semi-marathon"), lib: "3min", timer: { kind: "interval", name: "Seuil", work: 480, rest: 120, reps, sets: 1, setRest: 0, prep: 10, workLabel: "Seuil", restLabel: "Trot", markEach: "rep" }, n: reps };
        est = { fmt, min: 25 + reps * 10 };
      } else if (type === "int" && fmt === "sst") {
        const mins = [12, 15, 20][lv], reps = wk.light || wk.taper ? 1 : 2;
        it = { label: "Sweet spot " + reps + " \xD7 " + mins + " min", det: mins + " min juste sous la FTP, 5 min faciles" + (ftp ? " \xB7 " + wTxt(ftp, 88, 94) : fc ? " \xB7 " + fcTxt(fc, 82, 87) : ""), timer: { kind: "interval", name: "Sweet spot", work: mins * 60, rest: 300, reps, sets: 1, setRest: 0, prep: 10, workLabel: "Sweet spot", restLabel: "Facile", markEach: "rep" }, n: reps };
        est = { fmt, min: 25 + reps * (mins + 5) };
      } else if (type === "lact") {
        const reps = Math.max(3, Math.round(([5, 6, 7][lv] + [0, 1, 2][wk.step]) * m));
        it = { label: sport === "velo" ? "V\xE9lo 6 \xD7 1 min tr\xE8s vite" : sport === "nage" ? "Natation 6 \xD7 50 m vite" : "R\xE9p\xE9titions de 300 m", det: "Environ 1 min tr\xE8s vite, 3 min 30 de r\xE9cup\xE9ration (1:3 \xE0 1:4)" + (sport === "velo" && ftp ? " \xB7 " + wTxt(ftp, 121) : ""), lib: sport === "course" ? "300m" : null, timer: { kind: "interval", name: "Lactique", work: 60, rest: 210, reps, sets: 1, setRest: 0, prep: 10, workLabel: "Vite", restLabel: "R\xE9cup", markEach: "rep" }, n: reps };
      } else if (sport === "velo") {
        const reps = Math.max(2, Math.round((4 + (wk.light || wk.taper ? 0 : [0, 0, 1][wk.step])) * m));
        it = { label: "V\xE9lo 4 \xD7 4 min", det: "4 min fort (90-95 % de ta FC max), 3 min faciles" + (ftp ? " \xB7 " + wTxt(ftp, 106, 120) : fc ? " \xB7 " + fcTxt(fc, 90, 95) : ""), lib: "velo-4x4", timer: { kind: "interval", name: "V\xE9lo 4 \xD7 4", work: 240, rest: 180, reps, sets: 1, setRest: 0, prep: 10, workLabel: "Fort", restLabel: "Facile", markEach: "rep" }, n: reps };
      } else if (sport === "nage") {
        const reps = Math.max(4, Math.round(([6, 8, 10][lv] + [0, 1, 2][wk.step]) * m));
        it = { label: "Natation " + reps + " \xD7 100 m", det: "100 m soutenu, 20 \xE0 30 s de repos", lib: "nage-100", n: reps, unit: "S\xE9rie", rest: 25 };
      } else if (cfg.lvl >= 2 && wk.step === 1 && fmt !== "3030") {
        const reps = Math.max(3, Math.round(([4, 4, 5][lv] + 1) * m));
        it = { label: "Intervalles 3 min", det: "3 min \xE0 allure 3 000-5 000 m, 2 min de trot" + (vma ? " \xB7 " + distTxt(vma, 92, 180) : ""), lib: "3min", timer: { kind: "interval", name: "Intervalles 3 min", work: 180, rest: 120, reps, sets: 1, setRest: 0, prep: 10, workLabel: "Vite", restLabel: "Trot", markEach: "rep" }, n: reps };
      } else {
        const sets = lv === 0 ? 1 : 2, reps = Math.max(4, Math.round(([8, 10, 12][lv] + [0, 1, 2][wk.step]) * m));
        it = { label: "Intervalles 30/30", det: "30 s vite (proche de ta VMA), 30 s de trot" + (vma ? " \xB7 " + distTxt(vma, 100, 30) : "") + " \xB7 " + sets + " s\xE9rie" + (sets > 1 ? "s" : "") + " de " + reps, lib: "30-30", timer: { kind: "interval", name: "30/30", work: 30, rest: 30, reps, sets, setRest: 180, prep: 10, workLabel: "Vite", restLabel: "Trot" }, n: sets };
      }
      blocks2 = [{ id: uid("b"), kind, title: nm[1] + " \xB7 " + (type === "lact" ? "intervalles lactiques" : "intervalles"), desc: it.det, sub: type === "lact" ? "Fili\xE8re lactique : efforts de 20 s \xE0 2 min, r\xE9cup\xE9ration 1:3 \xE0 1:5." : "Les 20 % d\u2019intensit\xE9 de l\u2019entra\xEEnement polaris\xE9 : efforts durs, le reste de la semaine reste facile.", items: [ech("15 min faciles, puis 3 acc\xE9l\xE9rations progressives de 20 s."), Object.assign({ id: uid("i"), unit: "S\xE9rie" }, it), { id: "rac", label: "Retour au calme", det: "10 min tr\xE8s faciles", n: 1 }] }];
      tg = { rpe: wk.light ? [4, 6] : [7, 9], fam: wk.light ? "light" : "hard" };
      if (!wk.light) heavy.add("cardio");
    }
    const sys = SYSTEMS[type === "lact" || type === "circuit" ? "lact" : "aero"];
    tg.why = sys.l + " \xB7 " + sys.d;
    return { short, blocks: blocks2, target: tg, heavy, est };
  }
  function sprintSession(cfg, eq, wk, used) {
    const m = wk.light ? 0.6 : wk.taper ? 0.5 : 1, heavy = /* @__PURE__ */ new Set();
    const sp = available(LIB_BY_ID.sprint, cfg, eq) ? LIB_BY_ID.sprint : null;
    const items = [ech("10 min de footing, gammes (mont\xE9es de genoux, talons-fesses), 3 acc\xE9l\xE9rations progressives.")];
    if (sp) {
      items.push({ id: uid("i"), label: sp.n, det: "Effort maximal (3-4 s), 2 min de r\xE9cup\xE9ration compl\xE8te (1:12 \xE0 1:20)", n: Math.max(3, Math.round(([5, 6, 8][cfg.lvl - 1] + [0, 1, 1][wk.step]) * m)), unit: "Essai", rest: 120, lib: "sprint" });
      if (!wk.light) heavy.add("jambes");
    }
    if (cfg.lvl >= 2 && available(LIB_BY_ID["sprint-lance"], cfg, eq)) items.push({ id: uid("i"), label: "Sprints lanc\xE9s 20 m", det: "20 m d\u2019\xE9lan, 20 m \xE0 fond, 3 min de r\xE9cup\xE9ration", n: Math.max(2, Math.round(4 * m)), unit: "Essai", rest: 180, lib: "sprint-lance" });
    const pl2 = pick("plyo", "puiss", cfg, eq, used);
    if (pl2) items.push({ id: uid("i"), label: pl2.n, det: "5 sauts de qualit\xE9 maximale", n: wk.light ? 2 : 3, unit: "S\xE9rie", rest: 120, lib: pl2.id });
    if (!sp) items.push({ id: uid("i"), label: "Sprints sur place ou en c\xF4te 8 s", det: "8 s \xE0 fond, 2 min de r\xE9cup\xE9ration", n: 6, unit: "Essai", rest: 120 });
    return { short: "Vitesse", blocks: [{ id: uid("b"), kind: "course", title: "Course \xB7 vitesse", desc: "Fili\xE8re alactique : moins de 10 s \xE0 fond", sub: "La qualit\xE9 prime : chaque sprint doit \xEAtre aussi rapide que le premier. Si tu ralentis nettement, arr\xEAte la s\xE9rie.", items }], target: { rpe: wk.light ? [3, 5] : [6, 8], fam: wk.light ? "light" : "hard", why: SYSTEMS.alac.l + " \xB7 " + SYSTEMS.alac.d }, heavy };
  }
  function mobiSession(cfg) {
    const ids2 = ["mob-hanches", "mob-epaules", "mob-chevilles", "mob-dos"].concat((cfg.sports || []).includes("escalade") ? ["mob-doigts"] : []);
    return { short: "Mobilit\xE9", blocks: [{ id: uid("b"), kind: "recup", title: "R\xE9cup\xE9ration \xB7 mobilit\xE9", desc: "20 \xE0 30 min tranquilles", items: ids2.map((id) => ({ id: uid("i"), label: LIB_BY_ID[id].n, det: LIB_BY_ID[id].c, n: 1, lib: id })) }], target: { rpe: [1, 3], fam: "light", why: "S\xE9ance facile qui entretient la mobilit\xE9 et aide \xE0 r\xE9cup\xE9rer." }, heavy: /* @__PURE__ */ new Set() };
  }
  function buildSession(type, cfg, wk, used, memo) {
    const eq = equipSet(cfg.equip);
    used = used || /* @__PURE__ */ new Set();
    if (["fbA", "fbB", "haut", "bas", "puiss", "renfo", "prevS"].includes(type)) return strengthSession(type, cfg, eq, wk, used, memo);
    if (["doigts", "bloc", "resist", "conti", "compet"].includes(type)) return climbSession(type, cfg, eq, wk);
    if (["ef", "int", "long", "lact", "circuit"].includes(type)) return cardioSession(type, cfg, eq, wk);
    if (type === "sprint") return sprintSession(cfg, eq, wk, used);
    return mobiSession(cfg);
  }
  function alternatives(libId, cfg) {
    const x = LIB_BY_ID[libId];
    if (!x) return [];
    const eq = equipSet(cfg.equip);
    return LIB.filter((y) => y.pat === x.pat && y.id !== x.id && available(y, cfg, eq));
  }
  var H48 = ["jambes", "dos", "poussee", "tirage", "doigts", "cardio"];
  function heavyOf(d) {
    const out = /* @__PURE__ */ new Set();
    if (!d) return out;
    for (const b of d.blocks || []) {
      if (b.kind === "rest") continue;
      if (Array.isArray(b.heavy)) {
        b.heavy.forEach((g) => out.add(g));
        continue;
      }
      if (b.kind === "doigts" && b.finger && b.finger.load) out.add("doigts");
      for (const it of b.items || []) {
        if (it.id === "ech" || it.id === "rac") continue;
        const x = it.lib ? LIB_BY_ID[it.lib] : libMatch(it.label);
        if (it.rx && it.rx.light) continue;
        if (x && x.heavy) x.g.forEach((g) => out.add(g));
        if (x && x.g.includes("cardio") && x.t === "int") out.add("cardio");
      }
    }
    return new Set([...out].filter((g) => H48.includes(g)));
  }
  var inter = (a, b) => [...a].filter((x) => b.has(x));
  function check48(k, d) {
    const mine = heavyOf(d), out = [];
    if (!mine.size) return out;
    for (const o of [-1, 1]) {
      const k2 = addDays(k, o), g = inter(mine, heavyOf(day(k2)));
      if (g.length) out.push({ k: k2, when: o < 0 ? "la veille" : "le lendemain", groups: g });
    }
    return out;
  }
  var groupsTxt = (g) => g.map((x) => GROUP_LBL[x] || x).join(", ");
  function permutations(a) {
    if (a.length <= 1) return [a];
    const out = [];
    a.forEach((x, i) => {
      for (const p of permutations(a.slice(0, i).concat(a.slice(i + 1)))) out.push([x].concat(p));
    });
    return out;
  }
  function weekCost(byDow) {
    let c = 0;
    for (let d = 0; d < 7; d++) {
      const a = byDow[d], b = byDow[(d + 1) % 7];
      if (a && b) c += inter(a, b).length;
    }
    return c;
  }
  function placeSessions(cfg, types, sample) {
    const days = cfg.days.slice().sort((a, b) => a - b), fixed = new Set(cfg.fixed || []);
    const fixedHeavy = /* @__PURE__ */ new Set(["jambes", "cardio"]);
    let best = null;
    const perms = types.length <= 6 ? permutations(types.map((t, i) => i)) : [types.map((t, i) => i)];
    for (const p of perms) {
      const by = {};
      for (const f of fixed) by[f] = fixedHeavy;
      p.forEach((ti, j) => {
        by[days[j]] = sample[ti].heavy;
      });
      const c = weekCost(by);
      if (!best || c < best.c) best = { c, p };
      if (c === 0) break;
    }
    const out = {};
    best.p.forEach((ti, j) => {
      out[days[j]] = types[ti];
    });
    return { map: out, cost: best.c };
  }
  function nextMonday(k) {
    const t = k || todayKey();
    return dow(t) === 0 ? t : addDays(mondayOf(t), 7);
  }
  function generate(cfg) {
    const start = cfg.start || nextMonday();
    let W = cfg.weeks || 4;
    if (cfg.event) W = Math.max(2, Math.min(16, Math.floor(diffDays(start, cfg.event) / 7) + 1));
    const types = weekPlanTypes(cfg), memo = {}, used0 = /* @__PURE__ */ new Set();
    const sample = types.map((t) => buildSession(t, cfg, { step: 1, meso: 0, phase: "volume" }, used0, memo));
    const { map, cost } = placeSessions(cfg, types, sample);
    const weeks = [], warnings = [];
    for (let i = 0; i < W; i++) {
      const wk = weekInfo(cfg, i, W), ws = addDays(start, i * 7), used = /* @__PURE__ */ new Set(), days = {};
      for (let d = 0; d < 7; d++) {
        const k = addDays(ws, d);
        if (cfg.event && k > cfg.event) continue;
        if (cfg.event && k === cfg.event) {
          days[d] = { short: cfg.eventLbl || "Objectif", blocks: [{ id: uid("b"), kind: "compet", title: cfg.eventLbl || "Objectif", desc: "Jour J", items: [] }] };
          continue;
        }
        if ((cfg.fixed || []).includes(d)) {
          days[d] = { short: cfg.fixedLbl || "Sport", blocks: [{ id: uid("b"), kind: "sport", title: cfg.fixedLbl || "Entra\xEEnement du club ou match", desc: "S\xE9ance fixe de la semaine", heavy: ["jambes", "cardio"], items: [{ id: uid("i"), label: cfg.fixedLbl || "Entra\xEEnement ou match", n: 1 }] }] };
          continue;
        }
        let t = map[d];
        if (!t) continue;
        if (cfg.event && addDays(k, 1) === cfg.event && !["mobi", "ef", "conti"].includes(t)) t = "mobi";
        if (i % 2 === 1 && (t === "fbA" || t === "fbB") && types.filter((x) => x === "fbA").length !== types.filter((x) => x === "fbB").length) t = t === "fbA" ? "fbB" : "fbA";
        days[d] = Object.assign(buildSession(t, cfg, wk, used, memo), { type: t });
      }
      applyExtras(days, cfg, wk);
      weeks.push({ i, start: ws, end: addDays(ws, 6), phase: wk.phase, light: !!wk.light, taper: !!wk.taper, days });
    }
    if (cost > 0) {
      const w0 = weeks[0].days;
      for (let d = 0; d < 7; d++) {
        const a = w0[d], b = w0[(d + 1) % 7];
        if (!a || !b) continue;
        const g = inter(heavyOf(a), heavyOf(b));
        if (g.length) warnings.push({ d, d2: (d + 1) % 7, groups: g });
      }
    }
    return { cfg, start, end: addDays(start, W * 7 - 1), weeks, warnings, types };
  }
  var PH_BLOC = { volume: "Accumulation", force: "Intensification", puissance: "Puissance", specifique: "Sp\xE9cifique", deload: "D\xE9charge", affutage: "Aff\xFBtage" };
  function conflicts(prog) {
    const t = todayKey(), out = [];
    for (const w of prog.weeks) for (const d of Object.keys(w.days)) {
      const k = addDays(w.start, +d);
      if (k >= t && day(k) && (day(k).blocks || []).some((b) => b.kind !== "rest")) out.push(k);
    }
    return out;
  }
  function programNotes(prog) {
    const c = prog.cfg, g = GOAL_BY_ID[c.goal], g2 = c.goal2 && GOAL_BY_ID[c.goal2], sys = SYSTEMS[g.sys];
    const lines = ["**Objectif** : " + g.l.toLowerCase() + (g2 ? ", puis " + g2.l.toLowerCase() : "") + ".", "", "**" + sys.l + ".** " + sys.d];
    if (g2) lines.push("", "**" + SYSTEMS[g2.sys].l + ".** " + SYSTEMS[g2.sys].d);
    lines.push(
      "",
      "### Organisation",
      "- M\xE9socycles de 4 semaines : 3 semaines qui montent, puis 1 semaine de d\xE9charge (environ 40 % de s\xE9ries en moins, m\xEAme charge, loin de l\u2019\xE9chec).",
      "- La r\xE9serve (\xAB il m\u2019en restait 2 \xBB) r\xE8gle l\u2019intensit\xE9 : 2 = tu aurais pu faire 2 r\xE9p\xE9titions de plus.",
      "- R\xE8gle des 48 h : pas deux s\xE9ances lourdes de suite sur les m\xEAmes muscles."
    );
    if (c.event) lines.push("- Aff\xFBtage avant l\u2019objectif : volume r\xE9duit de 40 \xE0 60 %, intensit\xE9 et fr\xE9quence gard\xE9es.");
    if (STRENGTH_GOALS.includes(c.goal)) lines.push("- Progression des charges : quand toutes les s\xE9ries atteignent le haut de la fourchette avec la r\xE9serve vis\xE9e, la charge monte de 2,5 kg (ou 2 \xE0 5 %).");
    const fams = [...new Set((prog.types || []).map((t) => fmtFamily(t, c)).filter(Boolean))];
    if (fams.length) lines.push("- Formats : " + fams.map((f) => FORMATS[f].find((x) => x[0] === fmtOf(f, c))[1].toLowerCase()).join(", ") + ".");
    const cl = climbLevel(null, c.lv), rep = [];
    for (const [k, l] of [["bf", "bloc flash"], ["bm", "bloc max"], ["vf", "voie \xE0 vue"], ["vm", "voie max"]]) if (cl[k]) rep.push(l + " " + cl[k].g + (cl[k].src !== "d\xE9clar\xE9" ? " (estim\xE9)" : ""));
    for (const l of ["squat", "bench", "deadlift", "pull", "dips"]) {
      const r = oneRM(l, null, c.lv);
      if (r) rep.push("1RM " + { squat: "squat", bench: "d\xE9velopp\xE9 couch\xE9", deadlift: "soulev\xE9 de terre", pull: "traction", dips: "dips" }[l] + " " + r.txt + " (" + srcTxt(r) + ")");
    }
    const v = vmaOf(null, c.lv);
    if (v) rep.push("VMA " + fmtNum(v.v) + " km/h");
    if (rep.length) lines.push("- Rep\xE8res utilis\xE9s : " + rep.join(" ; ") + ".");
    const ex = (c.extras || []).filter((id) => EXTRAS[id]);
    if (ex.length) lines.push("- Compl\xE9ments pour ton sport : " + ex.map((id) => EXTRAS[id].t.toLowerCase()).join(", ") + ".");
    lines.push("", "Sources : ACSM 2009 ; NSCA 2016 ; Schoenfeld 2016 et 2017 ; Helms 2016 ; Williams 2017 ; Bell 2023" + (c.event ? " ; Bosquet 2007" : "") + ([c.goal, c.goal2].includes("aero") ? " ; St\xF6ggl 2014" : "") + (fams.some((f) => fmtOf(f, c) === "clusters") ? " ; Tufano 2017" : "") + (fams.some((f) => fmtOf(f, c) === "supersets") ? " ; Robbins 2010" : "") + (fams.some((f) => fmtOf(f, c) === "contraste") ? " ; Seitz 2016" : "") + (v ? " ; Billat 2001" : "") + exSrc(ex) + ".");
    return lines.join("\n");
  }
  var SRC_TXT = { turner2003: "Turner 2003", bohm2015: "Bohm 2015", vandyk2019: "van Dyk 2019", byram2010: "Byram 2010", lixandrao2018: "Lixandr\xE3o 2018", patterson2019: "Patterson 2019", wilson2013: "Wilson 2013" };
  var exSrc = (ex) => {
    const s = [...new Set(ex.flatMap((id) => EXTRAS[id].src || []))].map((x) => SRC_TXT[x]).filter(Boolean);
    return s.length ? " ; " + s.join(" ; ") : "";
  };
  function writeProgram(prog, mode) {
    const t = todayKey(), c = prog.cfg;
    const m = clone(meta() || { v: 1, title: "Mon plan", goal: null, tests: [], weeks: [], blocs: [], sections: [] });
    const byStart = new Map(m.weeks.map((w) => [w.start, w]));
    const g = GOAL_BY_ID[c.goal], blocName = "Programme \xB7 " + g.l;
    for (const w of prog.weeks) {
      const cur = byStart.get(w.start) || m.weeks.find((x) => x.start <= w.end && x.end >= w.start);
      const patch = { phase: w.phase, bloc: blocName + " \xB7 " + PH_BLOC[w.phase] };
      if (cur) Object.assign(cur, patch);
      else {
        const nw = Object.assign({ id: uid("w"), n: 0, start: w.start, end: w.end }, patch);
        m.weeks.push(nw);
        byStart.set(w.start, nw);
      }
    }
    m.weeks.sort((a, b) => a.start < b.start ? -1 : 1);
    m.weeks.forEach((w, i) => {
      if (!w.label) w.n = i + 1;
    });
    m.start = m.weeks[0].start;
    m.end = m.weeks[m.weeks.length - 1].end;
    if (c.event) {
      m.events = (m.events || []).filter((e) => e.date !== c.event).concat([{ date: c.event, label: c.eventLbl || "Objectif" }]).sort((a, b) => a.date < b.date ? -1 : 1);
      if (!m.goal || !m.goal.date || m.goal.date < t) m.goal = { label: c.eventLbl || "Objectif", date: c.event };
    }
    m.blocs = (m.blocs || []).concat([{ name: blocName, from: prog.start < t ? t : prog.start, to: prog.end, obj: GOAL_BY_ID[c.goal].d + (c.goal2 ? " \xB7 en second : " + GOAL_BY_ID[c.goal2].l.toLowerCase() : ""), notes: programNotes(prog) }]).sort((a, b) => a.from < b.from ? -1 : 1);
    m.programs = (m.programs || []).concat([{ id: uid("g"), cfg: c, from: prog.start, to: prog.end, at: Date.now() }]);
    const st = cloud && links.me ? { uid: links.me, name: myProfile().name || "", at: Date.now() } : void 0;
    m.edited = st;
    const docs2 = { plan: m };
    for (const w of prog.weeks) for (const [d, s] of Object.entries(w.days)) {
      const k = addDays(w.start, +d);
      if (k < t) continue;
      const dd = { short: s.short, blocks: s.blocks, edited: st, prog: true };
      if (s.target) dd.target = s.target;
      const ex = day(k);
      if (mode === "merge" && ex && (ex.blocks || []).some((b) => b.kind !== "rest")) {
        dd.blocks = ex.blocks.filter((b) => b.kind !== "rest").concat(s.blocks);
        dd.short = ex.short || "" ? ex.short + " + " + s.short : s.short;
        if (ex.target) dd.target = ex.target;
      }
      docs2["p:" + k] = dd;
    }
    if (mode === "replace") for (const w of prog.weeks) for (let d = 0; d < 7; d++) {
      const k = addDays(w.start, d);
      if (k >= t && !docs2["p:" + k] && day(k)) remove("p:" + k);
    }
    putMany(docs2);
    return Object.keys(docs2).length - 1;
  }
  function sessionSummary(s) {
    const its = [];
    for (const b of s.blocks) for (const it of b.items || []) if (it.id !== "ech" && it.id !== "rac") its.push(it);
    return its;
  }
  var KIND_OF_TYPE = (t) => ST[t] ? ST[t].kind === "cardio" ? "course" : ST[t].kind : "autre";

  // src/lib/nutrition.js
  var nutrition_exports = {};
  __export(nutrition_exports, {
    GOALS_W: () => GOALS_W,
    LIFE: () => LIFE,
    MEALS: () => MEALS,
    MICROS: () => MICROS,
    NO_ALERT: () => NO_ALERT,
    NUT: () => NUT,
    NUT_LBL: () => NUT_LBL,
    SOURCES_FOOD: () => SOURCES_FOOD,
    SUPPS: () => SUPPS,
    SUPP_WARN: () => SUPP_WARN,
    addFood: () => addFood,
    bmr: () => bmr,
    customFoods: () => customFoods,
    dayActivity: () => dayActivity,
    dayAdvice: () => dayAdvice,
    dayExpenditure: () => dayExpenditure,
    dayItems: () => dayItems,
    dayLoad: () => dayLoad2,
    dayTargets: () => dayTargets,
    dayTotals: () => dayTotals,
    deleteMealPreset: () => deleteMealPreset,
    foodByCode: () => foodByCode,
    foodsMeta: () => foodsMeta,
    foodsReady: () => foodsReady,
    loadFoods: () => loadFoods,
    loggedDay: () => loggedDay,
    mealsOf: () => mealsOf,
    nutriPrefs: () => nutriPrefs,
    nutriVisible: () => nutriVisible,
    recents: () => recents,
    refs: () => refs,
    resendNutrition: () => resendNutrition,
    saveCustomFood: () => saveCustomFood,
    saveMealPreset: () => saveMealPreset,
    savedMeals: () => savedMeals,
    searchFoods: () => searchFoods,
    setMeal: () => setMeal,
    totals: () => totals,
    weekAdvice: () => weekAdvice,
    weekSummary: () => weekSummary,
    weightOf: () => weightOf
  });
  var NUT = [
    ["kcal", "\xC9nergie", "kcal"],
    ["p", "Prot\xE9ines", "g"],
    ["g", "Glucides", "g"],
    ["su", "dont sucres", "g"],
    ["l", "Lipides", "g"],
    ["ags", "dont satur\xE9s", "g"],
    ["fib", "Fibres", "g"],
    ["sel", "Sel", "g"],
    ["ca", "Calcium", "mg"],
    ["fe", "Fer", "mg"],
    ["mg", "Magn\xE9sium", "mg"],
    ["zn", "Zinc", "mg"],
    ["k", "Potassium", "mg"],
    ["io", "Iode", "\xB5g"],
    ["se", "S\xE9l\xE9nium", "\xB5g"],
    ["va", "Vitamine A", "\xB5g"],
    ["vd", "Vitamine D", "\xB5g"],
    ["vc", "Vitamine C", "mg"],
    ["b9", "Folates (B9)", "\xB5g"],
    ["b12", "Vitamine B12", "\xB5g"],
    ["ala", "Om\xE9ga-3 ALA", "g"],
    ["epa", "EPA", "g"],
    ["dha", "DHA", "g"]
  ];
  var NUT_LBL = Object.fromEntries(NUT.map((x) => [x[0], x]));
  var FOODS = null;
  var LOADING = null;
  var BY_CODE = /* @__PURE__ */ new Map();
  var META = null;
  var foodsReady = () => !!FOODS;
  function loadFoods() {
    if (FOODS) return Promise.resolve(FOODS);
    if (LOADING) return LOADING;
    const base = define_import_meta_env_default && define_import_meta_env_default.BASE_URL || "/";
    LOADING = fetch(base + "aliments.json").then((r) => {
      if (!r.ok) throw new Error("Base d\u2019aliments indisponible");
      return r.json();
    }).then((d) => {
      META = { v: d.v, grp: d.grp };
      FOODS = d.f.map((a) => {
        const o = { c: a[0], n: a[1], grp: a[2], v: {} };
        d.k.forEach((k, i) => {
          o.v[k] = a[3 + i];
        });
        o.s = norm(a[1]);
        o.w = o.s.split(" ");
        return o;
      });
      BY_CODE = new Map(FOODS.map((f) => [f.c, f]));
      return FOODS;
    }).catch((e) => {
      LOADING = null;
      throw e;
    });
    return LOADING;
  }
  var foodByCode = (c) => BY_CODE.get(c) || customFoods().find((f) => f.c === c) || null;
  function customFoods() {
    return ((get("nutri") || {}).custom || []).map((x) => Object.assign({ custom: true, grp: 0, s: norm(x.n), w: norm(x.n).split(" ") }, x));
  }
  function saveCustomFood(name, v) {
    const id = "u" + Date.now().toString(36), list = (nutriDoc().custom || []).concat([{ c: id, n: name, v }]);
    putFor(SELF, "nutri", Object.assign({}, nutriDoc(), { custom: list }));
    return Object.assign({ custom: true, grp: 0, s: norm(name), w: norm(name).split(" ") }, { c: id, n: name, v });
  }
  var foodsMeta = () => META;
  var COOK = /^(riz|pates|semoule|quinoa|boulgour|ble|lentille|pois|haricot|feve|polenta|millet|sarrasin|epeautre|orge|pomme de terre|patate)/;
  function searchFoods(q, recentCodes, limit) {
    if (!FOODS) return [];
    const toks = norm(q).split(" ").filter(Boolean).map((t) => t.length > 3 ? t.replace(/(s|x)$/, "") : t);
    if (!toks.length) return [];
    const rec = new Set(recentCodes || []), out = [], qa = String(q).toLowerCase().trim().replace(/\s+/g, " ");
    for (const f of FOODS.concat(customFoods())) {
      let ok = true, sc = 0;
      for (const [i, t] of toks.entries()) {
        const wi = f.w.findIndex((w) => w.startsWith(t));
        if (wi < 0) {
          ok = false;
          break;
        }
        sc += wi === 0 ? i === 0 ? 30 : 6 : Math.max(0, 6 - wi);
        if (f.w[wi] === t || f.w[wi] === t + "s" || f.w[wi] === t + "x") sc += 4;
      }
      if (!ok) continue;
      const head = f.n.split(",")[0].toLowerCase().trim();
      if (head === qa || head + "s" === qa || head + "x" === qa) sc += 12;
      if (f.custom) sc += 10;
      sc -= f.n.length / 12;
      const cookable = f.grp === 4 || COOK.test(f.s);
      const cooked = /\b(cuit|cuite|cuits|cuites|roti|rotie|grille|grillee|poele|poelee|dur|poche)\b/.test(f.s);
      if (cookable && cooked) sc += 6;
      else if (cookable && /\b(sec|seche|secs|seches|deshydrate|deshydratee|cru|crue|crus|crues)\b/.test(f.s)) sc -= 8;
      if (/\((blanc|jaune) d/i.test(f.n)) sc -= 14;
      const proc = f.s.match(/\b(en poudre|appertise|appertisee|concentre|deshydrate|deshydratee|lyophilise|puree)\b/);
      if (proc && !norm(qa).includes(proc[1].split(" ").pop())) sc -= 10;
      if (!cookable && /\b(sec|seche|seches|sechee|sechees)\b/.test(f.s) && !/\bs[eè]c/.test(qa)) sc -= 4;
      if (/aliment moyen|sans precision/.test(f.s)) sc += 1;
      if (rec.has(f.c)) sc += 25;
      out.push([sc, f]);
    }
    return out.sort((a, b) => b[0] - a[0]).slice(0, limit || 40).map((x) => x[1]);
  }
  var MEALS = [["pdj", "Petit-d\xE9jeuner"], ["dej", "D\xE9jeuner"], ["col", "Collation"], ["din", "D\xEEner"]];
  var mealsOf = (k, o) => ((o != null ? getFor(o, "n:" + k) : get("n:" + k)) || {}).m || {};
  function setMeal(k, meal, items) {
    const cur = Object.assign({}, mealsOf(k, SELF));
    if (items && items.length) cur[meal] = items;
    else delete cur[meal];
    putFor(SELF, "n:" + k, { m: cur });
  }
  function addFood(k, meal, f, grams) {
    const cur = (mealsOf(k, SELF)[meal] || []).concat([{ c: f.c, n: f.n, g: Math.round(grams) }]);
    setMeal(k, meal, cur);
    rememberFood(f, grams);
  }
  var nutriDoc = () => getFor(SELF, "nutri") || {};
  var recents = () => nutriDoc().recent || [];
  function rememberFood(f, grams) {
    const r = recents().filter((x) => x.c !== f.c);
    r.unshift({ c: f.c, n: f.n, g: Math.round(grams) });
    putFor(SELF, "nutri", Object.assign({}, nutriDoc(), { recent: r.slice(0, 40) }), { silent: true });
  }
  var savedMeals = () => nutriDoc().saved || [];
  function saveMealPreset(name, items) {
    putFor(SELF, "nutri", Object.assign({}, nutriDoc(), { saved: savedMeals().filter((s) => s.name !== name).concat([{ id: "s" + Date.now().toString(36), name, items }]) }));
  }
  function deleteMealPreset(id) {
    putFor(SELF, "nutri", Object.assign({}, nutriDoc(), { saved: savedMeals().filter((s) => s.id !== id) }));
  }
  function totals(items) {
    const t = { grams: 0, unk: {} };
    for (const [k] of NUT) t[k] = 0;
    for (const it of items) {
      const f = foodByCode(it.c), g = it.g || 0;
      t.grams += g;
      for (const [k] of NUT) {
        const v = f ? f.v[k] : null;
        if (v == null) t.unk[k] = (t.unk[k] || 0) + g;
        else t[k] += v * g / 100;
      }
    }
    t.epadha = t.epa + t.dha;
    t.unk.epadha = Math.max(t.unk.epa || 0, t.unk.dha || 0);
    return t;
  }
  var dayItems = (k, o) => {
    const m = mealsOf(k, o);
    return MEALS.flatMap(([id]) => m[id] || []);
  };
  var dayTotals = (k, o) => totals(dayItems(k, o));
  var loggedDay = (k, o) => dayItems(k, o).length > 0;
  function nutriPrefs(o) {
    const p = profileOf(o == null ? getSubject() : o), n = p.nutri || {};
    return { numbers: typeof n.numbers === "boolean" ? n.numbers : !p.under18, share: !!n.share, life: n.life || "assis", goal: p.under18 ? "maintien" : n.goal || "maintien" };
  }
  var nutriVisible = () => isSelf() || nutriPrefs().share;
  function resendNutrition() {
    const map = {};
    for (const id of idsFor(SELF, "n:").concat(["nutri"])) {
      const d = getFor(SELF, id);
      if (d) map[id] = d;
    }
    if (Object.keys(map).length) putMany(map, SELF);
  }
  var LIFE = [["assis", "Plut\xF4t assis", 1.4], ["debout", "Debout, en mouvement", 1.6], ["physique", "Travail physique", 1.8]];
  var GOALS_W = [["maintien", "Garder mon poids"], ["perte", "Perdre un peu"], ["prise", "Prendre du muscle"]];
  function ageOf(p) {
    return p.birth_year ? (/* @__PURE__ */ new Date()).getFullYear() - p.birth_year : 30;
  }
  function weightOf(o, k) {
    const w = bodyWeightAt(k || todayKey());
    return w || Number(profileOf(o == null ? getSubject() : o).weight_kg) || null;
  }
  function bmr(o, k) {
    const p = profileOf(o == null ? getSubject() : o), w = weightOf(o, k), h = Number(p.height_cm);
    if (!w || !h) return null;
    const s = p.sex === "M" ? 5 : p.sex === "F" ? -161 : -78;
    return 10 * w + 6.25 * h - 5 * ageOf(p) + s;
  }
  var RUN = [[4.1, 6.5], [4.55, 7.8], [5.1, 8.5], [5.65, 9], [6.15, 9.3], [6.7, 10.5], [7, 11], [7.5, 11.8], [8, 12], [8.6, 12.5], [9, 13], [9.45, 14.8], [10, 14.8], [11, 16.8], [12, 18.5], [13, 19.8], [14, 23]];
  function runMet(kmh) {
    const mph = kmh / 1.609;
    if (mph <= RUN[0][0]) return RUN[0][1];
    for (let i = 1; i < RUN.length; i++) if (mph <= RUN[i][0]) {
      const [a, ma] = RUN[i - 1], [b, mb] = RUN[i];
      return ma + (mb - ma) * (mph - a) / (b - a);
    }
    return RUN[RUN.length - 1][1];
  }
  function met(act, r, ctx) {
    r = typeof r === "number" ? r : 6;
    if (act === "grimpe") return r <= 4 ? 5.8 : r <= 6 ? 7.3 : 8;
    if (act === "force") return r <= 5 ? 3.5 : r <= 7 ? 5 : 6;
    if (act === "kine") return 3;
    if (act === "mobi") return 2.3;
    if (act === "cardio") {
      if (ctx.kmh && ctx.run) return runMet(ctx.kmh);
      if (ctx.bike) return r <= 4 ? 6.8 : r <= 6 ? 8 : 10;
      return r <= 4 ? 7.8 : r <= 6 ? 9.3 : 11;
    }
    if (act === "sport") {
      const s = sportsOf() || [];
      if (s.includes("combat")) return r <= 4 ? 5.3 : 10.3;
      if (s.includes("collectif")) return r >= 7 ? 8 : r <= 4 ? 5.5 : 7.5;
      return r <= 4 ? 5 : 7;
    }
    return 3;
  }
  var parseMin = (s) => {
    const m = String(s || "").match(/(\d+)\s*h\s*(\d+)?|(\d+)\s*min/);
    if (!m) return null;
    return m[3] ? +m[3] : +m[1] * 60 + (+m[2] || 0);
  };
  function dayActivity(k, o) {
    const e = jget(k), list = acts(k), real = typeof e.duree === "number" && e.duree > 0;
    const bl = blocks(k).filter((b) => b.kind !== "rest" && b.kind !== "test");
    if (!real && (!bl.length || e.status === "sautee")) return { min: 0, items: [], real: false };
    const tg = target(k), d = day(k) || {};
    const extra = sessionsOf(e).filter((x) => x.apart).reduce((t, x) => t + x.duree, 0);
    const min = (real ? e.duree : parseMin(d.duree) || (bl.some((b) => ["grimpe", "compet"].includes(b.kind)) ? 90 : 60)) + extra;
    const r = typeof e.rpe === "number" ? e.rpe : tg && tg.rpe ? (tg.rpe[0] + tg.rpe[1]) / 2 : 6;
    const as = (list.length ? list : plannedActs(k)).filter((a) => a);
    const run = bl.some((b) => b.kind === "course"), bike = bl.some((b) => b.kind === "velo") && !run;
    const kmh = e.cardio && e.cardio.km && real ? e.cardio.km / (e.duree / 60) : null;
    const per = as.length ? min / as.length : min;
    return { min, r, real, items: (as.length ? as : ["force"]).map((a) => ({ act: a, min: per, met: met(a, r, { run, bike, kmh }) })) };
  }
  function dayExpenditure(k, o) {
    const b = bmr(o, k);
    if (!b) return null;
    const pr = nutriPrefs(o), pal = (LIFE.find((x) => x[0] === pr.life) || LIFE[0])[2], w = weightOf(o, k);
    const a = dayActivity(k, o), ex = a.items.reduce((s, x) => s + (x.met - 1) * w * x.min / 60, 0);
    const tot = b * pal + ex;
    return { bmr: b, base: b * pal, ex, tot, lo: tot * 0.9, hi: tot * 1.1, act: a };
  }
  function dayLoad2(k, o) {
    const a = dayActivity(k, o), min = a.min, hard = a.r >= 7;
    const strengthOnly = a.items.length > 0 && a.items.every((x) => x.act === "force" || x.act === "kine" || x.act === "mobi");
    if (!min || a.items.every((x) => x.act === "mobi" || x.act === "kine")) return { lvl: "leger", cho: [3, 5], lbl: "Journ\xE9e l\xE9g\xE8re ou de repos" };
    if (min > 240) return { lvl: "tres", cho: [8, 12], lbl: "Tr\xE8s grosse journ\xE9e (plus de 4 h)" };
    if (min > 75 || min >= 60 && hard && !strengthOnly) return { lvl: "eleve", cho: [6, 10], lbl: "Grosse journ\xE9e (1 \xE0 3 h, intensit\xE9 mod\xE9r\xE9e \xE0 \xE9lev\xE9e)" };
    return { lvl: "modere", cho: strengthOnly ? [4, 7] : [5, 7], lbl: strengthOnly ? "S\xE9ance de force (environ 1 h)" : "Journ\xE9e mod\xE9r\xE9e (environ 1 h)" };
  }
  function dayTargets(k, o) {
    const w = weightOf(o, k), ex = dayExpenditure(k, o), ld = dayLoad2(k, o), pr = nutriPrefs(o), p = profileOf(o == null ? getSubject() : o);
    if (!w) return null;
    const goal = pr.goal;
    const prot = goal === "perte" ? [1.8, 2.2] : goal === "prise" ? [1.6, 2.2] : [1.4, 2];
    let kcal = ex ? [ex.lo, ex.hi] : null;
    if (kcal && goal === "perte") kcal = [Math.max(ex.bmr, ex.tot - 500), Math.max(ex.bmr, ex.tot - 300)];
    if (kcal && goal === "prise") kcal = [ex.tot + 200, ex.tot + 400];
    const mid = kcal ? (kcal[0] + kcal[1]) / 2 : null;
    return {
      w,
      ld,
      ex,
      kcal,
      goal,
      p: [Math.round(prot[0] * w), Math.round(prot[1] * w)],
      pk: 1.6,
      g: [Math.round(ld.cho[0] * w), Math.round(ld.cho[1] * w)],
      l: mid ? [Math.round(mid * 0.2 / 9), Math.round(mid * 0.35 / 9)] : null,
      fib: p.under18 ? 21 : 30
    };
  }
  function refs(o) {
    const p = profileOf(o == null ? getSubject() : o), f = p.sex === "F", u18 = p.under18, age = ageOf(p), diet = dietOf(o);
    const phy = diet === "omni" ? 1 : 2;
    if (u18) return { ca: 1150, fe: f ? 11 : 11, mg: f ? 225 : 295, zn: f ? 11.9 : 14.2, k: 3500, io: 130, se: 70, va: f ? 650 : 750, vd: 15, vc: 100, b9: 330, b12: 2.5, epadha: 0.25, fib: 21, src: "ANSES 2021, 15-17 ans" };
    return { ca: age < 25 ? 1e3 : 950, fe: 11, mg: f ? 300 : 380, zn: f ? [7.5, 9.3, 11][phy] : [9.4, 11.7, 14][phy], k: 3500, io: 150, se: 70, va: f ? 650 : 750, vd: 15, vc: 110, b9: 330, b12: 4, epadha: 0.5, fib: 30, src: "ANSES 2021, adultes" };
  }
  var MICROS = [["fe", "Fer", "mg"], ["ca", "Calcium", "mg"], ["mg", "Magn\xE9sium", "mg"], ["zn", "Zinc", "mg"], ["k", "Potassium", "mg"], ["b12", "Vitamine B12", "\xB5g"], ["b9", "Folates (B9)", "\xB5g"], ["vc", "Vitamine C", "mg"], ["va", "Vitamine A", "\xB5g"], ["se", "S\xE9l\xE9nium", "\xB5g"], ["epadha", "Om\xE9ga-3 EPA + DHA", "g"], ["io", "Iode", "\xB5g"], ["vd", "Vitamine D", "\xB5g"]];
  var NO_ALERT = { vd: "La vitamine D vient surtout du soleil : l\u2019alimentation n\u2019en couvre presque jamais la r\xE9f\xE9rence. D\u2019octobre \xE0 mars, parles-en \xE0 ton m\xE9decin (un dosage sanguin dit s\u2019il en faut).", io: "Le sel iod\xE9 n\u2019est pas compt\xE9 dans les aliments : la valeur affich\xE9e sous-estime ton apport r\xE9el." };
  var SOURCES_FOOD = {
    fe: "Boudin noir, viande rouge, foie, moules ; lentilles, pois chiches, haricots, tofu. Avec de la vitamine C au m\xEAme repas (agrumes, poivron, kiwi), et le th\xE9 ou le caf\xE9 \xE0 distance : le fer v\xE9g\xE9tal passe alors bien mieux.",
    ca: "Laitages (yaourt, fromage), eaux min\xE9rales riches en calcium, tofu au calcium, sardines avec ar\xEAtes, amandes, choux.",
    mg: "Ol\xE9agineux (amandes, noix de cajou), chocolat noir, l\xE9gumineuses, c\xE9r\xE9ales compl\xE8tes, eaux riches en magn\xE9sium.",
    zn: "Viande, fruits de mer (hu\xEEtres), \u0153ufs, fromage ; l\xE9gumineuses tremp\xE9es ou germ\xE9es, graines de courge.",
    k: "Fruits et l\xE9gumes, l\xE9gumineuses, pommes de terre, bananes.",
    b12: "Uniquement dans les produits animaux (viande, poisson, \u0153ufs, laitages). En v\xE9gan, un compl\xE9ment de B12 (ou des aliments enrichis) est indispensable.",
    b9: "L\xE9gumes \xE0 feuilles vertes, l\xE9gumineuses, asperges, agrumes.",
    vc: "Kiwi, agrumes, poivron, choux, fruits rouges, persil (cru de pr\xE9f\xE9rence).",
    va: "Carotte, patate douce, courge, \xE9pinards, mangue ; foie et \u0153ufs.",
    se: "Poissons, fruits de mer, \u0153ufs, noix du Br\xE9sil (1 \xE0 2 suffisent).",
    epadha: "Poissons gras (sardine, maquereau, hareng, saumon) une \xE0 deux fois par semaine. En v\xE9g\xE9tarien ou v\xE9gan, l\u2019huile d\u2019algue en apporte.",
    fib: "L\xE9gumineuses, c\xE9r\xE9ales compl\xE8tes, fruits et l\xE9gumes avec la peau, ol\xE9agineux."
  };
  function weekSummary(endK, o) {
    endK = endK || todayKey();
    const days = [];
    for (let i = 6; i >= 0; i--) days.push(addDays(endK, -i));
    const logged = days.filter((k) => loggedDay(k, o));
    const R2 = refs(o), sum = {}, unk = {}, grams = { t: 0 };
    let exp = 0, expN = 0, ua = 0, prot = 0, cho = 0;
    for (const k of logged) {
      const t = dayTotals(k, o);
      grams.t += t.grams;
      for (const key of Object.keys(t)) if (typeof t[key] === "number") sum[key] = (sum[key] || 0) + t[key];
      for (const [key, g] of Object.entries(t.unk)) unk[key] = (unk[key] || 0) + g;
      const ex = dayExpenditure(k, o);
      if (ex) {
        exp += ex.tot;
        expN++;
      }
    }
    const n = logged.length, avg = {};
    for (const key of Object.keys(sum)) avg[key] = n ? sum[key] / n : 0;
    const cov = MICROS.map(([key, l, u]) => ({ key, l, u, v: avg[key] || 0, ref: R2[key], pct: R2[key] ? (avg[key] || 0) / R2[key] : null, unk: grams.t ? (unk[key] || 0) / grams.t : 0 }));
    if (R2.fib) cov.push({ key: "fib", l: "Fibres", u: "g", v: avg.fib || 0, ref: R2.fib, pct: (avg.fib || 0) / R2.fib, unk: grams.t ? (unk.fib || 0) / grams.t : 0 });
    const w = weightOf(o, endK);
    return { days, logged, n, avg, cov, R: R2, exp: expN ? exp / expN : null, w, protKg: w && n ? avg.p / w : null, choKg: w && n ? avg.g / w : null, fatPct: avg.kcal ? avg.l * 9 / avg.kcal * 100 : null };
  }
  function weekAdvice(ws, o) {
    const out = [], add = (lvl, t, d, src2, key) => out.push({ lvl, t, d, src: src2 || [], key });
    if (ws.n < 3) return out;
    const p = profileOf(o == null ? getSubject() : o), diet = dietOf(o), pr = nutriPrefs(o);
    const lowE = ws.exp && ws.avg.kcal && ws.avg.kcal < ws.exp * 0.7 && !(pr.goal === "perte" && ws.avg.kcal >= ws.exp * 0.75);
    if (lowE) add("warn", "Apport nettement sous ta d\xE9pense", "Sur " + ws.n + " jours saisis, " + (pr.numbers ? "tu manges en moyenne " + Math.round(ws.avg.kcal) + " kcal pour une d\xE9pense estim\xE9e autour de " + Math.round(ws.exp) + " kcal" : "tes apports sont nettement sous ta d\xE9pense estim\xE9e") + ". Si tous tes repas ne sont pas not\xE9s, compl\xE8te-les : le bilan (et les manques ci-dessous) n\u2019est fiable qu\u2019avec une saisie compl\xE8te. Si elle l\u2019est, c\u2019est un d\xE9ficit important pour un sportif : fatigue, blessures, cycle irr\xE9gulier et baisse de performance en sont les signaux. Augmente les portions les jours d\u2019entra\xEEnement, et parles-en \xE0 un m\xE9decin ou un di\xE9t\xE9ticien du sport si \xE7a dure.", ["mountjoy2023"], "reds");
    const lows = ws.cov.filter((c) => !NO_ALERT[c.key] && c.pct != null && c.unk <= 0.3 && c.pct < 0.7).sort((a, b) => a.pct - b.pct);
    for (const c of lows.slice(0, 4)) add(c.pct < 0.5 ? "warn" : "info", c.l + " : " + Math.round(c.pct * 100) + " % de la r\xE9f\xE9rence", SOURCES_FOOD[c.key] + (c.key === "fe" ? " Si tu es souvent fatigu\xE9(e), parles-en \xE0 ton m\xE9decin : seul un dosage (ferritine) dit s\u2019il faut un compl\xE9ment, et le fer en trop n\u2019est pas anodin." : ""), ["anses2021"], c.key);
    if (lows.length > 4) add("info", "Aussi un peu bas", lows.slice(4).map((c) => c.l.toLowerCase() + " (" + Math.round(c.pct * 100) + " %)").join(", ") + ". Plus de fruits, de l\xE9gumes et de l\xE9gumineuses rel\xE8ve la plupart de ces apports d\u2019un coup.", ["anses2021"], "more");
    if (diet === "vegan") add("info", "V\xE9gan : vitamine B12", "La B12 n\u2019existe pas dans les v\xE9g\xE9taux : un compl\xE9ment r\xE9gulier (ou des aliments enrichis) est indispensable, quel que soit le bilan ci-dessus.", ["anses2021"], "b12v");
    if (diet !== "omni" && !out.some((x) => x.key === "fe")) add("info", (diet === "vegan" ? "V\xE9gan" : "V\xE9g\xE9tarien") + " : fer et zinc", "Le fer et le zinc des v\xE9g\xE9taux s\u2019absorbent moins bien : l\xE9gumineuses, c\xE9r\xE9ales compl\xE8tes et ol\xE9agineux \xE0 chaque repas, avec de la vitamine C, et le th\xE9 ou le caf\xE9 \xE0 distance.", ["anses2021"], "fezn");
    if (ws.w && ws.protKg != null && ws.protKg < 1.2) add("info", "Prot\xE9ines : " + fmtNum(Math.round(ws.protKg * 10) / 10) + " g/kg par jour", "Le rep\xE8re pour un sportif est d\u2019environ 1,6 g/kg (1,2 \xE0 2,0), r\xE9parti sur 3 \xE0 4 prises de 0,3 g/kg : \u0153ufs, laitages, viande, poisson, l\xE9gumineuses, tofu.", ["morton2018", "thomas2016"], "prot");
    return out;
  }
  var SUPPS = [
    { id: "cafeine", l: "Caf\xE9ine", lvl: "Bon niveau de preuve", d: "Am\xE9liore l\u2019endurance et les efforts r\xE9p\xE9t\xE9s. 3 \xE0 6 mg/kg environ 60 min avant ; des doses plus faibles (moins de 3 mg/kg) marchent aussi chez certains. Attention au sommeil si la s\xE9ance est tard.", perf: true },
    { id: "creatine", l: "Cr\xE9atine monohydrate", lvl: "Bon niveau de preuve", d: "Pour les efforts courts et r\xE9p\xE9t\xE9s et la prise de force en musculation. Charge de 20 g par jour en 4 prises pendant 5 \xE0 7 jours puis 3 \xE0 5 g par jour, ou directement 3 \xE0 5 g par jour. Prise de poids de 1 \xE0 2 kg (eau) possible : \xE0 peser pour l\u2019escalade.", perf: true },
    { id: "nitrate", l: "Nitrates (jus de betterave)", lvl: "Bon niveau de preuve", d: "Effet surtout chez les sportifs peu ou moyennement entra\xEEn\xE9s, sur les efforts de 12 \xE0 40 min. Environ 310 \xE0 560 mg de nitrate 2 \xE0 3 h avant.", perf: true },
    { id: "beta", l: "B\xEAta-alanine", lvl: "Bon niveau de preuve", d: "Efforts intenses de 30 s \xE0 10 min (fili\xE8re lactique). Environ 65 mg/kg par jour en plusieurs petites prises pendant 10 \xE0 12 semaines ; picotements fr\xE9quents.", perf: true },
    { id: "bicar", l: "Bicarbonate de sodium", lvl: "Bon niveau de preuve", d: "Efforts intenses de 30 s \xE0 10 min. 0,2 \xE0 0,4 g/kg 60 \xE0 150 min avant ; troubles digestifs fr\xE9quents : \xE0 tester \xE0 l\u2019entra\xEEnement, jamais le jour J.", perf: true },
    { id: "vitd", l: "Vitamine D", lvl: "M\xE9dical", d: "Utile en cas de carence, fr\xE9quente l\u2019hiver en France. Un dosage sanguin et l\u2019avis d\u2019un m\xE9decin d\xE9cident de la dose." },
    { id: "fer", l: "Fer", lvl: "M\xE9dical", d: "Seulement en cas de carence prouv\xE9e par une prise de sang (ferritine), sur avis m\xE9dical : un exc\xE8s de fer est toxique." },
    { id: "b12", l: "Vitamine B12", lvl: "M\xE9dical / r\xE9gime", d: "Indispensable en alimentation v\xE9gane, conseill\xE9e si les produits animaux sont rares." },
    { id: "prot", l: "Poudre de prot\xE9ines", lvl: "Aliment de sport", d: "Pratique pour atteindre ses besoins ou apr\xE8s la s\xE9ance, mais pas plus efficace que des aliments \xE9quivalents (laitages, \u0153ufs, viande, l\xE9gumineuses)." }
  ];
  var SUPP_WARN = "Un compl\xE9ment peut contenir des substances interdites non d\xE9clar\xE9es. Choisis uniquement des produits certifi\xE9s anti-dopage (norme AFNOR NF V94-001 en France), et parles-en \xE0 un professionnel de sant\xE9.";
  function dayAdvice(k, o) {
    const tg = dayTargets(k, o);
    if (!tg) return [];
    const a = tg.ld, out = [], act = dayActivity(k, o), w = tg.w, nb = nutriPrefs(o).numbers, diet = dietOf(o);
    const g = (x, u) => nb ? " (" + x + (u || " g") + ")" : "";
    if (act.min) {
      out.push({ t: "Avant la s\xE9ance", d: "Un repas riche en glucides 1 \xE0 4 h avant" + g(Math.round(w) + " \xE0 " + Math.round(4 * w)) + ", pauvre en graisses et en fibres si l\u2019effort est intense. Bois 5 \xE0 7 ml/kg environ 4 h avant" + g(Math.round(5 * w) + " \xE0 " + Math.round(7 * w), " ml") + ".", src: ["thomas2016"] });
      if (act.min > 75) out.push({ t: "Pendant", d: "S\xE9ance de plus de 75 min : 30 \xE0 60 g de glucides par heure (boisson, compote, fruit sec), et de l\u2019eau selon la soif.", src: ["thomas2016"] });
      out.push({ t: "Apr\xE8s", d: "Des prot\xE9ines dans les 2 h" + g(Math.round(0.3 * w)) + " avec des glucides" + (a.lvl === "eleve" || a.lvl === "tres" ? ", surtout si tu t\u2019entra\xEEnes de nouveau dans moins de 8 h (1 \xE0 1,2 g/kg par heure pendant 4 h)" : "") + ".", src: ["thomas2016", "kerksick2017"] });
    } else out.push({ t: "Jour de repos", d: "Moins de glucides que les jours charg\xE9s, mais toujours des prot\xE9ines \xE0 chaque repas : c\u2019est l\xE0 que la r\xE9cup\xE9ration se fait.", src: ["thomas2016"] });
    out.push({ t: "Prot\xE9ines sur la journ\xE9e", d: (nb ? "Environ " + tg.p[0] + " \xE0 " + tg.p[1] + " g, " : "") + "en 3 \xE0 4 prises (\u0153ufs, laitages, viande, poisson, l\xE9gumineuses, tofu).", src: ["morton2018", "thomas2016"] });
    if (diet === "vegan") out.push({ t: "V\xE9gan", d: "Associe l\xE9gumineuses et c\xE9r\xE9ales sur la journ\xE9e, pense \xE0 la B12 (compl\xE9ment) et aux sources d\u2019om\xE9ga-3 (noix, colza, lin, huile d\u2019algue).", src: ["anses2021"] });
    return out;
  }

  // src/lib/glossary.js
  var glossary_exports = {};
  __export(glossary_exports, {
    GLOSS: () => GLOSS,
    GLOSS_BY_ID: () => GLOSS_BY_ID,
    GLOSS_RE: () => GLOSS_RE,
    glossIdOf: () => glossIdOf
  });
  var GLOSS = [
    { id: "potentialisation", t: "Potentialisation", a: ["potentialiser", "potentialise", "potentialis\xE9e"], d: "Une s\xE9rie lourde ou explosive rend les efforts qui suivent un peu plus forts et rapides pendant quelques minutes. On s\u2019en sert \xE0 la fin de l\u2019\xE9chauffement et dans le contraste.", src: ["seitz2016"] },
    { id: "reserve", t: "R\xE9serve", a: ["RIR"], d: "Le nombre de r\xE9p\xE9titions que tu aurais encore pu faire \xE0 la fin de la s\xE9rie. R\xE9serve 2 : il t\u2019en restait 2. Elle r\xE8gle l\u2019intensit\xE9 sans conna\xEEtre ton max.", src: ["helms2016"] },
    { id: "ressenti", t: "Ressenti", a: ["RPE"], d: "Note de 0 \xE0 10 de la difficult\xE9 de toute la s\xE9ance, id\xE9alement 30 min apr\xE8s. Multipli\xE9e par la dur\xE9e, elle donne la charge de la s\xE9ance.", src: ["foster2001"] },
    { id: "charge", t: "Charge (ressenti \xD7 dur\xE9e)", a: ["UA"], d: "Ressenti \xD7 dur\xE9e en minutes, en unit\xE9s arbitraires (UA) : une s\xE9ance de 60 min \xE0 6/10 vaut 360. On suit son \xE9volution d\u2019une semaine \xE0 l\u2019autre.", src: ["foster2001"] },
    { id: "1rm", t: "1RM", a: [], d: "La charge la plus lourde soulev\xE9e une seule fois avec une bonne technique. Les charges se donnent en % de ce max.", src: ["acsm2009"] },
    { id: "vma", t: "VMA", a: [], d: "Vitesse maximale a\xE9robie : la vitesse de course \xE0 partir de laquelle tu utilises le maximum d\u2019oxyg\xE8ne. Tenable environ 4 \xE0 8 min.", src: ["billat2001"] },
    { id: "vo2max", t: "VO2max", a: [], d: "La quantit\xE9 maximale d\u2019oxyg\xE8ne que ton corps peut utiliser par minute et par kilo : le plafond de ton moteur a\xE9robie." },
    { id: "vc", t: "Vitesse critique", a: ["VC"], d: "La vitesse la plus haute que tu peux tenir longtemps : en dessous, l\u2019effort se stabilise ; au-dessus, tu t\u2019\xE9puises en quelques minutes. La meilleure r\xE9f\xE9rence pour le seuil.", src: ["poole2016"] },
    { id: "dprime", t: "D\u2032", a: ["D'"], d: "La distance que tu peux courir au-dessus de ta vitesse critique avant d\u2019\xEAtre \xE0 bout : une r\xE9serve qui se vide pendant l\u2019effort et se recharge au repos.", src: ["jones2017"] },
    { id: "ftp", t: "FTP", a: [], d: "Puissance au seuil fonctionnel : la puissance (en watts) tenable environ une heure \xE0 v\xE9lo. Les zones d\u2019entra\xEEnement se donnent en % de la FTP.", src: ["allen2010"] },
    { id: "sweetspot", t: "Sweet spot", a: [], d: "Juste sous la FTP (88 \xE0 94 %) : beaucoup de travail utile pour une fatigue mod\xE9r\xE9e.", src: ["allen2010"] },
    { id: "alac", t: "Fili\xE8re alactique", a: ["alactique"], d: "L\u2019\xE9nergie des efforts maximaux de moins de 10 s (phosphocr\xE9atine). Elle se recharge en 2 \xE0 3 min : d\u2019o\xF9 les longs repos.", src: ["nsca2016"] },
    { id: "lact", t: "Fili\xE8re lactique", a: ["lactique"], d: "L\u2019\xE9nergie des efforts intenses de 20 s \xE0 2 min, ceux qui \xAB br\xFBlent \xBB. R\xE9cup\xE9ration de 1:3 \xE0 1:5.", src: ["nsca2016"] },
    { id: "aero", t: "Fili\xE8re a\xE9robie", a: ["a\xE9robie"], d: "L\u2019\xE9nergie des efforts de plus de 2 \xE0 3 min, avec l\u2019oxyg\xE8ne. La base de l\u2019endurance et de la r\xE9cup\xE9ration entre les efforts.", src: ["nsca2016"] },
    { id: "decharge", t: "D\xE9charge", a: ["semaine de d\xE9charge"], d: "Semaine all\xE9g\xE9e (environ 40 % de s\xE9ries en moins, loin de l\u2019\xE9chec) pour dig\xE9rer le travail des semaines pr\xE9c\xE9dentes et repartir plus fort." },
    { id: "affutage", t: "Aff\xFBtage", a: [], d: "Les 1 \xE0 2 semaines avant l\u2019objectif : volume r\xE9duit de 40 \xE0 60 %, intensit\xE9 et fr\xE9quence gard\xE9es, pour arriver frais.", src: ["bosquet2007"] },
    { id: "meso", t: "M\xE9socycle", a: ["m\xE9socycles"], d: "Bloc de quelques semaines avec le m\xEAme objectif. Ici : 3 semaines qui montent, puis 1 semaine de d\xE9charge." },
    { id: "cluster", t: "Clusters", a: ["cluster"], d: "Une s\xE9rie coup\xE9e en r\xE9p\xE9titions isol\xE9es par 15 \xE0 30 s de pause : chaque r\xE9p\xE9tition reste rapide, et on peut charger un peu plus.", src: ["tufano2017"] },
    { id: "superset", t: "Supersets", a: ["superset"], d: "Deux exercices en alternance, souvent une pouss\xE9e et un tirage : le volume reste le m\xEAme, la s\xE9ance raccourcit.", src: ["robbins2010"] },
    { id: "contraste", t: "Contraste", a: [], d: "Une s\xE9rie lourde, quelques minutes de repos, puis le m\xEAme geste en explosif : on profite de la potentialisation.", src: ["seitz2016"] },
    { id: "excentrique", t: "Excentrique", a: [], d: "La phase o\xF9 le muscle s\u2019allonge en freinant la charge (la descente). Lente, elle renforce particuli\xE8rement les tendons." },
    { id: "tempo", t: "Tempo", a: [], d: "Dur\xE9e impos\xE9e \xE0 chaque phase du mouvement, par exemple 6 s de descente : on contr\xF4le mieux le geste et le temps sous tension." },
    { id: "tut", t: "Temps sous tension", a: [], d: "Le temps pass\xE9 \xE0 produire l\u2019effort (sur le mur, sous la charge), sans compter les repos." },
    { id: "tonnage", t: "Tonnage", a: [], d: "La somme charge \xD7 r\xE9p\xE9titions de toutes les s\xE9ries : le volume de travail d\u2019une s\xE9ance de muscu." },
    { id: "flash", t: "Flash", a: [], d: "Bloc r\xE9ussi du premier coup. Ton flash : la cotation que tu passes en g\xE9n\xE9ral du premier coup. Les s\xE9ances de volume s\u2019y calent." },
    { id: "avue", t: "\xC0 vue", a: [], d: "Voie r\xE9ussie du premier coup, sans aucune information avant. Ton \xE0 vue : la cotation que tu passes ainsi en g\xE9n\xE9ral." },
    { id: "max", t: "Max encha\xEEn\xE9", a: ["ton max", "ta limite"], d: "La cotation la plus dure que tu as r\xE9ussie, m\xEAme apr\xE8s l\u2019avoir travaill\xE9e. Les s\xE9ances de force et de puissance s\u2019y calent." },
    { id: "bouteiller", t: "Bouteiller", a: ["bouteill\xE9s", "bouteill\xE9", "bouteillent"], d: "Avant-bras gonfl\xE9s et durs qui ne serrent plus : la fatigue de la fili\xE8re lactique." },
    { id: "4x4", t: "4 \xD7 4", a: [], d: "4 blocs encha\xEEn\xE9s sans pause, 4 fois, avec 3 \xE0 4 min de repos : le classique de la r\xE9sistance en bloc." },
    { id: "polarise", t: "Entra\xEEnement polaris\xE9", a: ["polaris\xE9"], d: "Environ 80 % du temps en facile et 20 % en intense, tr\xE8s peu entre les deux.", src: ["stoggl2014"] },
    { id: "zone2", t: "Zone 1-2", a: ["zone 2"], d: "Intensit\xE9 facile : tu peux parler en phrases compl\xE8tes. Le gros du volume en endurance." },
    { id: "r48", t: "R\xE8gle des 48 h", a: [], d: "Pas deux s\xE9ances lourdes de suite sur les m\xEAmes muscles : il faut environ 48 h pour r\xE9cup\xE9rer.", src: ["acsm2009"] },
    { id: "dp", t: "Double progression", a: [], d: "On monte d\u2019abord les r\xE9p\xE9titions jusqu\u2019au haut de la fourchette, puis la charge, et on recommence.", src: ["acsm2009"] },
    { id: "ramp", t: "RAMP", a: [], d: "M\xE9thode d\u2019\xE9chauffement en trois temps : monter en temp\xE9rature, activer et mobiliser, puis potentialiser en montant vers l\u2019intensit\xE9 de la s\xE9ance.", src: ["jeffreys2007"] },
    { id: "hyper", t: "Hypertrophie", a: [], d: "La prise de muscle : s\xE9ries de 6 \xE0 12 r\xE9p\xE9titions proches de l\u2019\xE9chec, au moins 10 s\xE9ries par muscle et par semaine.", src: ["schoenfeld2017"] },
    { id: "bfr", t: "BFR", a: ["occlusion vasculaire"], d: "Blood flow restriction : un brassard en haut du bras ou de la cuisse freine le retour du sang. Une charge tr\xE8s l\xE9g\xE8re (20 \xE0 30 % du max) fait alors progresser la masse musculaire presque comme une charge lourde. \xC0 \xE9viter sans avis m\xE9dical en cas de probl\xE8me de circulation ou de coagulation, d\u2019hypertension, de maladie cardiaque ou de grossesse.", src: ["patterson2019", "lixandrao2018", "hughes2017"] },
    { id: "aop", t: "Pression d\u2019occlusion", a: ["pression d'occlusion"], d: "La pression de brassard qui coupe compl\xE8tement le sang d\u2019un membre, mesur\xE9e avec un manom\xE8tre. En BFR, on serre \xE0 40-80 % de cette pression ; sans manom\xE8tre, un serrage ressenti d\u2019environ 7 sur 10, jamais douloureux ni engourdissant.", src: ["patterson2019", "wilson2013"] }
  ];
  var GLOSS_BY_ID = Object.fromEntries(GLOSS.map((g) => [g.id, g]));
  var esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var FORMS = GLOSS.flatMap((g) => [g.t].concat(g.a).map((f) => [f, g.id])).sort((a, b) => b[0].length - a[0].length);
  var BY_FORM = new Map(FORMS.map(([f, id]) => [f.toLowerCase(), id]));
  var GLOSS_RE = new RegExp("(^|[^\\p{L}\\d])(" + FORMS.map(([f]) => esc(f)).join("|") + ")(?=$|[^\\p{L}\\d])", "giu");
  var glossIdOf = (form) => BY_FORM.get(String(form).toLowerCase()) || null;

  // src/lib/sources.js
  var sources_exports = {};
  __export(sources_exports, {
    SOURCES: () => SOURCES,
    src: () => src
  });
  var SOURCES = {
    saw2016: { s: "Saw et al., 2016", r: "Saw AE, Main LC, Gastin PB. Monitoring the athlete training response: subjective self-reported measures trump commonly used objective measures: a systematic review. Br J Sports Med. 2016;50(5):281\u2013291.", n: "Sur 56 \xE9tudes, les questionnaires de ressenti r\xE9agissent mieux et plus vite \xE0 la charge que les mesures objectives : le bien-\xEAtre baisse quand la charge monte et remonte quand elle baisse." },
    mclean2010: { s: "McLean et al., 2010", r: "McLean BD, Coutts AJ, Kelly V, McGuigan MR, Cormack SJ. Neuromuscular, endocrine, and perceptual fatigue responses during different length between-match microcycles in professional rugby league players. Int J Sports Physiol Perform. 2010;5(3):367\u2013383.", n: "Questionnaire de bien-\xEAtre en 5 items (fatigue, sommeil, courbatures, stress, humeur) not\xE9s de 1 \xE0 5, sensible \xE0 la r\xE9cup\xE9ration entre deux matchs." },
    hooper1995: { s: "Hooper & Mackinnon, 1995", r: "Hooper SL, Mackinnon LT. Monitoring overtraining in athletes: recommendations. Sports Med. 1995;20(5):321\u2013327.", n: "Suivi quotidien du sommeil, de la fatigue, du stress et des courbatures pour rep\xE9rer le surentra\xEEnement." },
    walsh2021: { s: "Walsh et al., 2021", r: "Walsh NP, Halson SL, Sargent C, et al. Sleep and the athlete: narrative review and 2021 expert consensus recommendations. Br J Sports Med. 2021;55(7):356\u2013368.", n: "Moins de 7 h par nuit de fa\xE7on habituelle est un marqueur de sommeil insuffisant chez l\u2019athl\xE8te ; siestes de moins de 30 min, entre 13 h et 16 h ; allonger la nuit (fen\xEAtre de 9 \xE0 10 h) avant une p\xE9riode charg\xE9e." },
    hirsh2015: { s: "Hirshkowitz et al., 2015", r: "Hirshkowitz M, Whiton K, Albert SM, et al. National Sleep Foundation\u2019s sleep time duration recommendations: methodology and results summary. Sleep Health. 2015;1(1):40\u201343.", n: "7 \xE0 9 h pour les adultes, 8 \xE0 10 h pour les 14-17 ans." },
    milewski2014: { s: "Milewski et al., 2014", r: "Milewski MD, Skaggs DL, Bishop GA, et al. Chronic lack of sleep is associated with increased sports injuries in adolescent athletes. J Pediatr Orthop. 2014;34(2):129\u2013133.", n: "Chez 112 sportifs de 12 \xE0 18 ans, dormir moins de 8 h par nuit est associ\xE9 \xE0 1,7 fois plus de risque de blessure (association, pas preuve de cause)." },
    plews2013: { s: "Plews et al., 2013", r: "Plews DJ, Laursen PB, Stanley J, Kilding AE, Buchheit M. Training adaptation and heart rate variability in elite endurance athletes: opening the door to effective monitoring. Sports Med. 2013;43(9):773\u2013781.", n: "La moyenne glissante sur 7 jours du ln rMSSD suit mieux l\u2019adaptation \xE0 l\u2019entra\xEEnement que la valeur d\u2019un seul jour." },
    plews2014: { s: "Plews et al., 2014", r: "Plews DJ, Laursen PB, Le Meur Y, et al. Monitoring training with heart-rate variability: how much compliance is needed for valid assessment? Int J Sports Physiol Perform. 2014;9(5):783\u2013790.", n: "Au moins 3 mesures sur 7 jours pour une moyenne glissante valable." },
    ais2023: { s: "AIS, 2023", r: "Bellenger C, Siegel R, Stanley J, McGibbon K. Best practice guidelines for the measurement, analysis and interpretation of resting heart rate and heart rate variability in athletes. Australian Institute of Sport; 2023.", n: "Comparer la moyenne sur 7 jours du ln rMSSD \xE0 sa propre base sur 60 jours ; changement significatif au-del\xE0 de 0,5 \xD7 le coefficient de variation individuel. Les \xAB diagnostics \xBB des applis ont peu d\u2019appui scientifique : regarder la tendance." },
    buchheit2014: { s: "Buchheit, 2014", r: "Buchheit M. Monitoring training status with HR measures: do all roads lead to Rome? Front Physiol. 2014;5:73.", n: "FC de repos et VFC s\u2019interpr\xE8tent ensemble, par rapport aux valeurs habituelles de l\u2019athl\xE8te et au contexte d\u2019entra\xEEnement." },
    foster1998: { s: "Foster, 1998", r: "Foster C. Monitoring training in athletes with reference to overtraining syndrome. Med Sci Sports Exerc. 1998;30(7):1164\u20131168.", n: "Monotonie = charge quotidienne moyenne \xF7 \xE9cart type sur la semaine ; contrainte = charge hebdo \xD7 monotonie. Les maladies suivent souvent les pics de charge et de contrainte ; une monotonie au-dessus de 2 est le rep\xE8re couramment utilis\xE9." },
    foster2001: { s: "Foster et al., 2001", r: "Foster C, Florhaug JA, Franklin J, et al. A new approach to monitoring exercise training. J Strength Cond Res. 2001;15(1):109\u2013115.", n: "Charge de s\xE9ance = ressenti (0-10) not\xE9 environ 30 min apr\xE8s \xD7 dur\xE9e en minutes." },
    gabbett2016: { s: "Gabbett, 2016", r: "Gabbett TJ. The training\u2014injury prevention paradox: should athletes be training smarter and harder? Br J Sports Med. 2016;50(5):273\u2013280.", n: "Ratio charge aigu\xEB (7 j) / chronique (28 j) : zone 0,8-1,3 d\xE9crite comme favorable, au-del\xE0 de 1,5 risque de blessure accru ; une charge chronique \xE9lev\xE9e bien construite prot\xE8ge." },
    impellizzeri2020: { s: "Impellizzeri et al., 2020", r: "Impellizzeri FM, Tenan MS, Kempton T, Novak A, Coutts AJ. Acute:chronic workload ratio: conceptual issues and fundamental pitfalls. Int J Sports Physiol Perform. 2020;15(6):907\u2013913.", n: "Le ratio aigu/chronique a des limites m\xE9thodologiques importantes : \xE0 utiliser comme rep\xE8re de progressivit\xE9, pas comme pr\xE9dicteur de blessure." },
    silbernagel2007: { s: "Silbernagel et al., 2007", r: "Silbernagel KG, Thome\xE9 R, Eriksson BI, Karlsson J. Continued sports activity, using a pain-monitoring model, during rehabilitation in patients with Achilles tendinopathy. Am J Sports Med. 2007;35(6):897\u2013906.", n: "Mod\xE8le de surveillance de la douleur : jusqu\u2019\xE0 5/10 pendant l\u2019effort, retour au niveau habituel le lendemain matin, pas d\u2019augmentation d\u2019une semaine \xE0 l\u2019autre." },
    schoffl2015: { s: "Sch\xF6ffl et al., 2015", r: "Sch\xF6ffl V, Popp D, K\xFCpper T, Sch\xF6ffl I. Injury trends in rock climbers: evaluation of a case series of 911 injuries between 2009 and 2012. Wilderness Environ Med. 2015;26(1):62\u201367.", n: "Les doigts (poulies en t\xEAte) sont la premi\xE8re localisation des blessures en escalade, devant l\u2019\xE9paule." },
    mcnulty2020: { s: "McNulty et al., 2020", r: "McNulty KL, Elliott-Sale KJ, Dolan E, et al. The effects of menstrual cycle phase on exercise performance in eumenorrheic women: a systematic review and meta-analysis. Sports Med. 2020;50(10):1813\u20131827.", n: "Performance peut-\xEAtre tr\xE8s l\xE9g\xE8rement r\xE9duite en d\xE9but de phase folliculaire (effet trivial, ES \u22120,06), avec une grande variabilit\xE9 : approche individuelle plut\xF4t que r\xE8gles g\xE9n\xE9rales." },
    mountjoy2023: { s: "Mountjoy et al., 2023", r: "Mountjoy M, Ackerman KE, Bailey DM, et al. 2023 International Olympic Committee\u2019s (IOC) consensus statement on Relative Energy Deficiency in Sport (REDs). Br J Sports Med. 2023;57(17):1073\u20131097.", n: "Un apport \xE9nerg\xE9tique insuffisant par rapport \xE0 l\u2019entra\xEEnement d\xE9grade sant\xE9 et performance ; cycles irr\xE9guliers ou absents, blessures et fatigue r\xE9p\xE9t\xE9es sont des signaux d\u2019alerte." },
    kerksick2017: { s: "Kerksick et al., 2017", r: "Kerksick CM, Arent S, Schoenfeld BJ, et al. International Society of Sports Nutrition position stand: nutrient timing. J Int Soc Sports Nutr. 2017;14:33.", n: "Glucides et prot\xE9ines (environ 0,25-0,4 g/kg) dans les heures qui suivent l\u2019effort favorisent la r\xE9cup\xE9ration." },
    balas2012: { s: "Bal\xE1\u0161 et al., 2012", r: "Bal\xE1\u0161 J, Pecha O, Martin AJ, Cochrane D. Hand\u2013arm strength and endurance as predictors of climbing performance. Eur J Sport Sci. 2012;12(1):16\u201325.", n: "La force et l\u2019endurance des fl\xE9chisseurs des doigts, rapport\xE9es au poids, font partie des meilleurs pr\xE9dicteurs du niveau en escalade." },
    michailov2018: { s: "Michailov et al., 2018", r: "Michailov ML, Bal\xE1\u0161 J, Tanev SK, et al. Reliability and validity of finger strength and endurance measurements in rock climbing. Res Q Exerc Sport. 2018;89(2):246\u2013254.", n: "Les tests de force des doigts sur r\xE9glette sont fiables \xE0 condition de standardiser la prise, la r\xE9glette et la position." },
    giles2019: { s: "Giles et al., 2019", r: "Giles D, Chidley JB, Taylor N, et al. The determination of finger-flexor critical force in rock climbers. Int J Sports Physiol Perform. 2019;14(7):972\u2013979.", n: "Test de 4 min en 7 s / 3 s \xE0 effort maximal : la force moyenne des derni\xE8res contractions donne la force critique, li\xE9e au niveau en escalade." },
    laffaye2014: { s: "Laffaye et al., 2014", r: "Laffaye G, Collin JM, Levernier G, Padulo J. Upper-limb power test in rock-climbing. Int J Sports Med. 2014;35(8):670\u2013675.", n: "Le \xAB power slap \xBB (hauteur atteinte d\u2019un bras depuis une suspension) mesure la puissance du haut du corps de fa\xE7on fiable." },
    claudino2017: { s: "Claudino et al., 2017", r: "Claudino JG, Cronin J, Mez\xEAncio B, et al. The countermovement jump to monitor neuromuscular status: a meta-analysis. J Sci Med Sport. 2017;20(4):397\u2013402.", n: "Le CMJ (moyenne de plusieurs sauts) est un bon indicateur de l\u2019\xE9tat neuromusculaire." },
    bennell1998: { s: "Bennell et al., 1998", r: "Bennell K, Talbot R, Wajswelner H, et al. Intra-rater and inter-rater reliability of a weight-bearing lunge measure of ankle dorsiflexion. Aust J Physiother. 1998;44(3):175\u2013180.", n: "Le test genou-mur (wall test) en charge est tr\xE8s fiable pour suivre la flexion dorsale de cheville." },
    byram2010: { s: "Byram et al., 2010", r: "Byram IR, Bushnell BD, Dugger K, et al. Preseason shoulder strength measurements in professional baseball pitchers: identifying players at risk for injury. Am J Sports Med. 2010;38(7):1375\u20131382.", n: "Une faiblesse des rotateurs externes par rapport aux internes est associ\xE9e \xE0 plus de blessures d\u2019\xE9paule." },
    acsm2009: { s: "ACSM, 2009", r: "American College of Sports Medicine. American College of Sports Medicine position stand. Progression models in resistance training for healthy adults. Med Sci Sports Exerc. 2009;41(3):687\u2013708.", n: "D\xE9butant : 60-70 % du max pour 8 \xE0 12 r\xE9p\xE9titions ; avanc\xE9 : 80-100 % pour la force. Augmenter la charge de 2 \xE0 10 % quand on d\xE9passe de 1 \xE0 2 r\xE9p\xE9titions l\u2019objectif. Au moins 2 \xE0 3 min de repos sur les exercices lourds, 48 h entre deux s\xE9ances lourdes des m\xEAmes muscles." },
    nsca2016: { s: "NSCA, 2016", r: "Haff GG, Triplett NT, eds. Essentials of Strength Training and Conditioning. 4th ed. National Strength and Conditioning Association. Champaign, IL: Human Kinetics; 2016.", n: "Force : 6 r\xE9p\xE9titions ou moins \xE0 85 % et plus, 2 \xE0 5 min de repos. Rapports effort:r\xE9cup\xE9ration selon la fili\xE8re : 1:12 \xE0 1:20 (alactique, moins de 10 s), 1:3 \xE0 1:5 (lactique, 15 s \xE0 2 min), 1:1 \xE0 1:3 (a\xE9robie)." },
    schoenfeld2016: { s: "Schoenfeld et al., 2016", r: "Schoenfeld BJ, Pope ZK, Benik FM, et al. Longer interset rest periods enhance muscle strength and hypertrophy in resistance-trained men. J Strength Cond Res. 2016;30(7):1805\u20131812.", n: "Chez des pratiquants entra\xEEn\xE9s, 3 min de repos entre les s\xE9ries donnent plus de force et de masse que 1 min." },
    schoenfeld2017: { s: "Schoenfeld et al., 2017", r: "Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis. J Sports Sci. 2017;35(11):1073\u20131082.", n: "Chaque s\xE9rie hebdomadaire en plus s\u2019accompagne de plus d\u2019hypertrophie ; au moins 10 s\xE9ries par muscle et par semaine font mieux que moins de 5." },
    helms2016: { s: "Helms et al., 2016", r: "Helms ER, Cronin J, Storey A, Zourdos MC. Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training. Strength Cond J. 2016;38(4):42\u201349.", n: "La r\xE9serve (r\xE9p\xE9titions qu\u2019on aurait encore pu faire) permet de r\xE9gler la charge au jour le jour selon la forme." },
    williams2017: { s: "Williams et al., 2017", r: "Williams TD, Tolusso DV, Fedewa MV, Esco MR. Comparison of periodized and non-periodized resistance training on maximal strength: a meta-analysis. Sports Med. 2017;47(10):2083\u20132100.", n: "Un entra\xEEnement p\xE9riodis\xE9 (blocs qui varient) am\xE9liore davantage la force maximale qu\u2019un entra\xEEnement non p\xE9riodis\xE9." },
    stoggl2014: { s: "St\xF6ggl & Sperlich, 2014", r: "St\xF6ggl T, Sperlich B. Polarized training has greater impact on key endurance variables than threshold, high intensity, or high volume training. Front Physiol. 2014;5:33.", n: "Chez des athl\xE8tes d\u2019endurance, environ 80 % de facile et 20 % d\u2019intense font mieux sur 9 semaines que le travail au seuil, le tout intense ou le gros volume." },
    bosquet2007: { s: "Bosquet et al., 2007", r: "Bosquet L, Montpetit J, Arvisais D, Mujika I. Effects of tapering on performance: a meta-analysis. Med Sci Sports Exerc. 2007;39(8):1358\u20131365.", n: "Aff\xFBtage le plus efficace : environ 2 semaines, volume r\xE9duit de 41 \xE0 60 %, intensit\xE9 et fr\xE9quence maintenues." },
    bell2023: { s: "Bell et al., 2023", r: "Bell L, Strafford BW, Coleman M, Androulakis Korakakis P, Nolan D. Integrating deloading into strength and physique sports training programmes: an international Delphi consensus approach. Sports Med Open. 2023;9.", n: "Consensus d\u2019experts : la d\xE9charge est une p\xE9riode de baisse volontaire de la charge (surtout du volume), souvent toutes les 4 \xE0 6 semaines ; les preuves directes restent limit\xE9es." },
    lopezrivera2012: { s: "L\xF3pez-Rivera & Gonz\xE1lez-Badillo, 2012", r: "L\xF3pez-Rivera E, Gonz\xE1lez-Badillo JJ. The effects of two maximum grip strength training methods using the same effort duration and different edge depth on grip endurance in elite climbers. Sports Technol. 2012;5(3-4):100\u2013110.", n: "Suspensions de 10 s avec une marge d\u2019environ 3 s, 3 min de repos : protocole de force maximale des doigts chez des grimpeurs confirm\xE9s." },
    tufano2017: { s: "Tufano et al., 2017", r: "Tufano JJ, Brown LE, Haff GG. Theoretical and practical aspects of different cluster set structures: a systematic review. J Strength Cond Res. 2017;31(3):848\u2013867.", n: "Des pauses courtes \xE0 l\u2019int\xE9rieur de la s\xE9rie maintiennent la vitesse et la puissance des r\xE9p\xE9titions, et permettent des charges un peu plus lourdes pour le m\xEAme nombre de r\xE9p\xE9titions." },
    robbins2010: { s: "Robbins et al., 2010", r: "Robbins DW, Young WB, Behm DG, Payne WR. Agonist-antagonist paired set resistance training: a brief review. J Strength Cond Res. 2010;24(10):2873\u20132882.", n: "Alterner agonistes et antagonistes (pouss\xE9e / tirage) garde le volume et la charge en r\xE9duisant nettement la dur\xE9e de la s\xE9ance." },
    seitz2016: { s: "Seitz & Haff, 2016", r: "Seitz LB, Haff GG. Factors modulating post-activation potentiation of jump, sprint, throw, and upper-body ballistic performances: a systematic review with meta-analysis. Sports Med. 2016;46(2):231\u2013240.", n: "Une s\xE9rie lourde am\xE9liore un peu les sauts et lancers qui suivent, surtout chez les plus forts et apr\xE8s plusieurs minutes de r\xE9cup\xE9ration." },
    billat2001: { s: "Billat, 2001", r: "Billat LV. Interval training for performance: a scientific and empirical practice. Special recommendations for middle- and long-distance running. Part I: aerobic interval training. Sports Med. 2001;31(1):13\u201331.", n: "Intervalles courts (30 s / 30 s) autour de la vitesse maximale a\xE9robie pour accumuler du temps pr\xE8s de la VO2max." },
    tanaka2001: { s: "Tanaka et al., 2001", r: "Tanaka H, Monahan KD, Seals DR. Age-predicted maximal heart rate revisited. J Am Coll Cardiol. 2001;37(1):153\u2013156.", n: "FC max estim\xE9e \u2248 208 \u2212 0,7 \xD7 \xE2ge, plus juste que 220 \u2212 \xE2ge ; une mesure r\xE9elle reste pr\xE9f\xE9rable." },
    poole2016: { s: "Poole et al., 2016", r: "Poole DC, Burnley M, Vanhatalo A, Rossiter HB, Jones AM. Critical power: an important fatigue threshold in exercise physiology. Med Sci Sports Exerc. 2016;48(11):2320\u20132334.", n: "La puissance (ou vitesse) critique s\xE9pare le domaine \xAB lourd \xBB, tenable longtemps, du domaine \xAB s\xE9v\xE8re \xBB, o\xF9 l\u2019\xE9puisement arrive vite ; D\u2032 est la r\xE9serve de travail au-dessus." },
    jones2017: { s: "Jones & Vanhatalo, 2017", r: "Jones AM, Vanhatalo A. The \u201Ccritical power\u201D concept: applications to sports performance with a focus on intermittent high-intensity exercise. Sports Med. 2017;47(Suppl 1):65\u201378.", n: "Vitesse critique et D\u2032 se calculent \xE0 partir de 2 \xE0 4 efforts maximaux de 2 \xE0 15 min, et servent \xE0 r\xE9gler l\u2019intensit\xE9 des s\xE9ances." },
    allen2010: { s: "Allen & Coggan, 2010", r: "Allen H, Coggan A. Training and racing with a power meter. 2nd ed. Boulder (CO): VeloPress; 2010.", n: "FTP estim\xE9e \xE0 95 % de la puissance moyenne d\u2019un effort de 20 min ; zones d\u2019entra\xEEnement en % de la FTP." },
    harvey1998: { s: "Harvey, 1998", r: "Harvey D. Assessment of the flexibility of elite athletes using the modified Thomas test. Br J Sports Med. 1998;32(1):68\u201370.", n: "Le test de Thomas modifi\xE9 \xE9value la longueur des fl\xE9chisseurs de hanche et du droit f\xE9moral." },
    draper2009: { s: "Draper et al., 2009", r: "Draper N, Brent S, Hodgson C, Blackwell G. Flexibility assessment and the role of flexibility as a determinant of performance in rock climbing. Int J Perform Anal Sport. 2009;9(1):67\u201389.", n: "Tests de souplesse propres \xE0 l\u2019escalade (mont\xE9e de pied, \xE9cart) ; la souplesse de hanche rapport\xE9e \xE0 la taille est li\xE9e au niveau." },
    acsm2021: { s: "ACSM, 2021", r: "American College of Sports Medicine. ACSM\u2019s guidelines for exercise testing and prescription. 11th ed. Philadelphia: Wolters Kluwer; 2021.", n: "Protocole du sit and reach : meilleur de plusieurs essais, apr\xE8s un \xE9chauffement l\xE9ger." },
    remilieux: { s: "Julien Remilieux", r: "Julien Remilieux, entra\xEEneur d\u2019escalade : \xE9chauffement des doigts 7 \xD7 7/3 (pratique d\u2019entra\xEEnement, document d\u2019origine \xE0 retrouver).", n: "7 suspensions de 7 s avec 3 s de pause, charge qui monte progressivement et pr\xE9hensions vari\xE9es, avant les s\xE9ances intenses de doigts." },
    jeffreys2007: { s: "Jeffreys, 2007", r: "Jeffreys I. Warm-up revisited: the ramp method of optimizing warm-ups. Prof Strength Cond. 2007;(6):12\u201318.", n: "\xC9chauffement RAMP : monter en temp\xE9rature (Raise), activer et mobiliser (Activate, Mobilise), puis potentialiser (Potentiate) en montant vers l\u2019intensit\xE9 de la s\xE9ance." },
    mcgowan2015: { s: "McGowan et al., 2015", r: "McGowan CJ, Pyne DB, Thompson KG, Rattray B. Warm-up strategies for sport and exercise: mechanisms and applications. Sports Med. 2015;45(11):1523\u20131546.", n: "L\u2019\xE9chauffement am\xE9liore la performance par la temp\xE9rature musculaire et la potentialisation ; il doit rester assez court pour ne pas fatiguer." },
    buchheit2013: { s: "Buchheit & Laursen, 2013", r: "Buchheit M, Laursen PB. High-intensity interval training, solutions to the programming puzzle. Part II: anaerobic energy, neuromuscular load and practical applications. Sports Med. 2013;43(10):927\u2013954.", n: "Le format des intervalles (dur\xE9e, intensit\xE9, r\xE9cup\xE9ration) r\xE8gle la part a\xE9robie, ana\xE9robie et neuromusculaire de la s\xE9ance." },
    helgerud2007: { s: "Helgerud et al., 2007", r: "Helgerud J, H\xF8ydal K, Wang E, et al. Aerobic high-intensity intervals improve VO2max more than moderate training. Med Sci Sports Exerc. 2007;39(4):665\u2013671.", n: "4 \xD7 4 min \xE0 90-95 % de la FC max, 3 min de r\xE9cup\xE9ration active : plus de gain de VO2max qu\u2019un entra\xEEnement mod\xE9r\xE9." },
    vandyk2019: { s: "van Dyk et al., 2019", r: "van Dyk N, Behan FP, Whiteley R. Including the Nordic hamstring exercise in injury prevention programmes halves the rate of hamstring injuries: a systematic review and meta-analysis of 8459 athletes. Br J Sports Med. 2019;53(21):1362\u20131370.", n: "Ajouter le Nordic hamstring aux programmes de pr\xE9vention divise environ par deux les blessures des ischio-jambiers." },
    thomas2016: { s: "Thomas, Erdman & Burke, 2016", r: "Thomas DT, Erdman KA, Burke LM. American College of Sports Medicine Joint Position Statement. Nutrition and Athletic Performance. Med Sci Sports Exerc. 2016;48(3):543\u2013568.", n: "Glucides selon la charge : 3-5 g/kg (l\xE9ger), 5-7 (environ 1 h par jour), 6-10 (1 \xE0 3 h), 8-12 (plus de 4 h). Prot\xE9ines 1,2 \xE0 2,0 g/kg, lipides 20 \xE0 35 % de l\u2019\xE9nergie. Avant l\u2019effort : 1 \xE0 4 g/kg de glucides 1 \xE0 4 h avant ; pendant plus de 75 min : 30 \xE0 60 g/h ; apr\xE8s : environ 0,3 g/kg de prot\xE9ines." },
    morton2018: { s: "Morton et al., 2018", r: "Morton RW, Murphy KT, McKellar SR, et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. Br J Sports Med. 2018;52(6):376\u2013384.", n: "Au-del\xE0 d\u2019environ 1,6 g/kg par jour de prot\xE9ines, plus de gain de masse mesurable en moyenne ; la borne haute (2,2 g/kg) couvre presque tout le monde." },
    anses2021: { s: "ANSES, 2021", r: "Anses. Avis relatif \xE0 l\u2019actualisation des r\xE9f\xE9rences nutritionnelles en vitamines et min\xE9raux pour la population g\xE9n\xE9rale. Maisons-Alfort : Anses ; 2021.", n: "RNP : apport qui couvre le besoin de presque toute la population ; AS : apport moyen jug\xE9 satisfaisant quand le besoin n\u2019est pas connu. Adultes : fer 11 mg (16 si r\xE8gles abondantes), calcium 950 mg (1 000 avant 25 ans), magn\xE9sium 380 / 300 mg, vitamine D 15 \xB5g, B12 4 \xB5g, vitamine C 110 mg, folates 330 \xB5g." },
    ciqual2025: { s: "Ciqual, 2025", r: "Anses. 2025. Table de composition nutritionnelle des aliments Ciqual (valeurs manquantes compl\xE9t\xE9es par : Anses. 2020. Table Ciqual pour le calcul des apports nutritionnels CALNUT).", n: "3 484 aliments g\xE9n\xE9riques et 74 constituants. Les produits de marque peuvent s\u2019en \xE9carter." },
    frankenfield2005: { s: "Frankenfield et al., 2005", r: "Frankenfield D, Roth-Yousey L, Compher C. Comparison of predictive equations for resting metabolic rate in healthy nonobese and obese adults: a systematic review. J Am Diet Assoc. 2005;105(5):775\u2013789.", n: "L\u2019\xE9quation de Mifflin-St Jeor est la plus fiable des \xE9quations test\xE9es : \xE0 \xB110 % du m\xE9tabolisme mesur\xE9 chez la majorit\xE9 des adultes." },
    herrmann2024: { s: "Herrmann et al., 2024", r: "Herrmann SD, Willis EA, Ainsworth BE, et al. 2024 Adult Compendium of Physical Activities: a third update of the energy costs of human activities. J Sport Health Sci. 2024;13(1):6\u201312.", n: "Co\xFBt \xE9nerg\xE9tique des activit\xE9s en METs (escalade 5,8 \xE0 8,0 ; musculation 3,5 \xE0 6,0 ; course selon la vitesse ; basket 7,5 \xE0 8,0\u2026)." },
    maughan2018: { s: "CIO, 2018", r: "Maughan RJ, Burke LM, Dvorak J, et al. IOC consensus statement: dietary supplements and the high-performance athlete. Br J Sports Med. 2018;52(7):439\u2013455.", n: "Peu de compl\xE9ments ont un bon niveau de preuve (caf\xE9ine, cr\xE9atine, nitrates, b\xEAta-alanine, bicarbonate) ; les compl\xE9ments \xAB m\xE9dicaux \xBB (fer, vitamine D) se d\xE9cident sur bilan ; risque de contamination par des produits dopants." },
    turner2003: { s: "Turner & Robling, 2003", r: "Turner CH, Robling AG. Designing exercise regimens to increase bone strength. Exerc Sport Sci Rev. 2003;31(1):45\u201350.", n: "L\u2019os r\xE9pond aux charges dynamiques, rapides et vari\xE9es ; sa sensibilit\xE9 baisse vite au fil des r\xE9p\xE9titions, si bien que quelques dizaines d\u2019impacts par s\xE9ance suffisent, et que des s\xE9ances courtes r\xE9parties dans la journ\xE9e font mieux qu\u2019une longue." },
    bohm2015: { s: "Bohm et al., 2015", r: "Bohm S, Mersmann F, Arampatzis A. Human tendon adaptation in response to mechanical loading: a systematic review and meta-analysis of exercise intervention studies on healthy adults. Sports Med Open. 2015;1(1):7.", n: "Le tendon s\u2019adapte surtout \xE0 des charges \xE9lev\xE9es (environ 85-90 % de la contraction maximale), tenues assez longtemps (environ 3 s par contraction), sur au moins 12 semaines ; l\u2019isom\xE9trie et le travail lent marchent aussi bien que l\u2019excentrique." },
    patterson2019: { s: "Patterson et al., 2019", r: "Patterson SD, Hughes L, Warmington S, et al. Blood flow restriction exercise: considerations of methodology, application, and safety. Front Physiol. 2019;10:533.", n: "Position d\u2019experts sur le BFR : 20 \xE0 40 % du max, souvent 75 r\xE9p\xE9titions en 4 s\xE9ries (30, 15, 15, 15), 30 \xE0 60 s de repos, brassard \xE0 40-80 % de la pression d\u2019occlusion, 2 \xE0 3 fois par semaine. Liste les contre-indications et demande un d\xE9pistage avant de commencer." },
    lixandrao2018: { s: "Lixandr\xE3o et al., 2018", r: "Lixandr\xE3o ME, Ugrinowitsch C, Berton R, et al. Magnitude of muscle strength and mass adaptations between high-load resistance training versus low-load resistance training associated with blood-flow restriction: a systematic review and meta-analysis. Sports Med. 2018;48(2):361\u2013378.", n: "Le BFR \xE0 charge l\xE9g\xE8re donne une hypertrophie comparable \xE0 celle des charges lourdes, mais des gains de force plus faibles." },
    hughes2017: { s: "Hughes et al., 2017", r: "Hughes L, Paton B, Rosenblatt B, Gissane C, Patterson SD. Blood flow restriction training in clinical musculoskeletal rehabilitation: a systematic review and meta-analysis. Br J Sports Med. 2017;51(13):1003\u20131011.", n: "En r\xE9\xE9ducation, le BFR \xE0 charge l\xE9g\xE8re fait gagner plus de force que la charge l\xE9g\xE8re seule, avec une contrainte articulaire plus faible que les charges lourdes." },
    wilson2013: { s: "Wilson et al., 2013", r: "Wilson JM, Lowery RP, Joy JM, Loenneke JP, Naimo MA. Practical blood flow restriction training increases acute determinants of hypertrophy without increasing indices of muscle damage. J Strength Cond Res. 2013;27(11):3068\u20133075.", n: "BFR \xAB pratique \xBB avec des bandes \xE9lastiques serr\xE9es \xE0 un ressenti d\u2019environ 7 sur 10 sur la cuisse : r\xE9ponse aigu\xEB favorable \xE0 l\u2019hypertrophie, sans plus de dommages musculaires." }
  };
  var src = (id) => SOURCES[id];

  // src/lib/io.js
  var io_exports = {};
  __export(io_exports, {
    applyImport: () => applyImport,
    downloadExport: () => downloadExport,
    filterImport: () => filterImport,
    planPatch: () => planPatch,
    readImport: () => readImport
  });
  var MAX_OPS = 50;
  function fill(v, ctx) {
    if (typeof v === "string") {
      const m = /^\{(n|reps|id|load)\}$/.exec(v);
      if (m) return ctx[m[1]];
      return v.replace(/\{(n|reps|id|load)\}/g, (_, x) => ctx[x] == null ? "" : String(ctx[x]).replace(".", ","));
    }
    if (Array.isArray(v)) return v.map((x) => fill(x, ctx));
    if (v && typeof v === "object") {
      const o = {};
      for (const [k, x] of Object.entries(v)) {
        const y = fill(x, ctx);
        if (y !== void 0 && y !== null && y !== "") o[k] = y;
      }
      return o;
    }
    return v;
  }
  var ITEM_KEYS = ["id", "label", "det", "n", "unit", "rest", "load", "unit_load", "reps", "timer", "lib", "rx", "superset", "pairRest", "hold", "opt"];
  function cleanItem(x) {
    const o = {};
    for (const k of ITEM_KEYS) if (x[k] !== void 0) o[k] = x[k];
    o.n = Math.max(1, Math.min(50, parseInt(o.n, 10) || 1));
    o.label = String(o.label || "Exercice").slice(0, 120);
    o.id = String(o.id || "x").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "x";
    if (!o.unit) o.unit = "S\xE9rie";
    return o;
  }
  function patchDay(day2, ops, k) {
    const d = JSON.parse(JSON.stringify(day2)), bl = d.blocks || [];
    ops = ops.filter((o) => (!o.from || k >= o.from) && (!o.to || k <= o.to));
    const has = (lbl) => {
      const t = norm(lbl);
      for (const b of bl) for (const it of b.items || []) if (norm(it.label) === t) return it;
      return null;
    };
    for (const o of ops) {
      if (o.op === "update") {
        const t = norm(o.match);
        for (const b of bl) for (const it of b.items || []) if (norm(it.label) === t) {
          const set = fill(o.set || {}, it);
          for (const [k2, v] of Object.entries(set)) if (ITEM_KEYS.includes(k2) && k2 !== "id") it[k2] = v;
          for (const k2 of o.unset || []) if (k2 !== "id" && k2 !== "label" && k2 !== "n") delete it[k2];
        }
      } else if (o.op === "insertAfter") {
        const t = norm(o.match);
        for (const b of bl) {
          const its = b.items || [];
          const j = its.findIndex((it) => norm(it.label) === t);
          if (j < 0) continue;
          const item = cleanItem(fill(o.item || {}, its[j]));
          if (its.some((x) => x.id === item.id)) continue;
          its.splice(j + 1, 0, item);
          b.items = its;
        }
      } else if (o.op === "append") {
        if (o.onlyIfDay && !has(o.onlyIfDay)) continue;
        const ctx = o.onlyIfDay && has(o.onlyIfDay) || {};
        const q = o.block || {};
        const b = bl.find((b2) => b2.kind !== "rest" && (q.kind ? b2.kind === q.kind : true) && (q.has ? (b2.items || []).some((it) => norm(it.label) === norm(q.has)) : true));
        if (!b) continue;
        const its = b.items || [], item = cleanItem(fill(o.item || {}, ctx));
        if (its.some((x) => x.id === item.id)) continue;
        if (o.at === "start") {
          const j = its[0] && its[0].id === "ech" ? 1 : 0;
          its.splice(j, 0, item);
        } else its.push(item);
        b.items = its;
      }
    }
    return d;
  }
  function planPatch(data) {
    const ops = (data.ops || []).filter((o2) => o2 && ["update", "insertAfter", "append"].includes(o2.op)).slice(0, MAX_OPS);
    if (!ops.length) throw new Error("Ce fichier de modification ne contient aucun changement.");
    const today = todayKey(), from = data.from && data.from > today ? data.from : today, to = data.to || "9999-12-31";
    const o = getSubject(), docs2 = {}, labels = /* @__PURE__ */ new Set();
    for (const id of idsFor(o, "p:").sort()) {
      const k = id.slice(2);
      if (k < from || k > to) continue;
      const day2 = getFor(o, id);
      if (!day2 || !day2.blocks) continue;
      const nd = patchDay(day2, ops, k);
      if (JSON.stringify(nd) !== JSON.stringify(day2)) {
        docs2[id] = nd;
      }
    }
    const keys = Object.keys(docs2).map((x) => x.slice(2));
    for (const op of ops) labels.add(op.item ? op.item.label : op.match);
    return { docs: docs2, n: { days: keys.length, first: keys[0] || null, last: keys[keys.length - 1] || null, from }, patch: { title: String(data.title || "Modification du programme").slice(0, 140), what: [...labels].filter(Boolean).slice(0, 12) } };
  }
  async function readImport(file) {
    const txt = await file.text();
    let data;
    try {
      data = JSON.parse(txt);
    } catch (_) {
      throw new Error("Ce fichier n\u2019est pas un fichier JSON lisible.");
    }
    if (data && ["carnet", "alipto"].includes(data.app) && data.kind === "patch") return planPatch(data);
    if (!data || !["carnet", "alipto"].includes(data.app) || !data.docs || typeof data.docs !== "object") throw new Error("Ce fichier ne vient pas d\u2019Alipto.");
    const docs2 = {};
    for (const [id, v] of Object.entries(data.docs)) if (["plan", "settings", "profile", "tests", "nutri", "models"].includes(id) || /^[pjctn]:\d{4}-\d{2}-\d{2}$/.test(id)) docs2[id] = v;
    const n = { plan: !!docs2.plan, days: Object.keys(docs2).filter((x) => x.startsWith("p:")).length, journal: Object.keys(docs2).filter((x) => x.startsWith("j:")).length, tests: Object.keys(docs2).filter((x) => x.startsWith("t:")).length };
    return { docs: docs2, n };
  }
  function filterImport(docs2) {
    const self = isSelf(), o = getSubject(), keep = {}, skipped = { journal: 0, plan: 0, other: 0 };
    for (const [id, v] of Object.entries(docs2)) {
      if (id === "profile" && cloud) {
        skipped.other++;
        continue;
      }
      if (!self && (id === "profile" || id === "settings" || id === "nutri" || id === "models" || id.startsWith("n:"))) {
        skipped.other++;
        continue;
      }
      if (!self && id.startsWith("j:") && getFor(o, id)) {
        skipped.journal++;
        continue;
      }
      if (self && planLocked() && (id === "plan" || id.startsWith("p:"))) {
        skipped.plan++;
        continue;
      }
      keep[id] = v;
    }
    return { keep, skipped };
  }
  function applyImport(docs2) {
    const { keep } = filterImport(docs2);
    putMany(keep);
  }
  async function downloadExport() {
    const data = exportAll();
    const name = "alipto-" + (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) + ".json";
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
    try {
      const file = new File([blob], name, { type: "application/json" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Sauvegarde Alipto" });
        return;
      }
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1e3);
  }

  // src/lib/md.js
  var md_exports = {};
  __export(md_exports, {
    md: () => md
  });
  var esc2 = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function inline(s) {
    let h = esc2(s);
    h = h.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    h = h.replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    h = h.replace(/\[(jaune|vert|bleu|violet|rouge|blanc|noir|rose|orange|gris|marron)\]/g, '<span class="hold h-$1">$1</span>');
    return h;
  }
  function md(src2) {
    const lines = String(src2 || "").replace(/\r/g, "").split("\n");
    let out = "", i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) {
        i++;
        continue;
      }
      if (/^###\s/.test(l)) {
        out += "<h4>" + inline(l.replace(/^###\s/, "")) + "</h4>";
        i++;
        continue;
      }
      if (/^\s*-\s/.test(l)) {
        out += "<ul>";
        while (i < lines.length && /^\s*-\s/.test(lines[i])) {
          out += "<li>" + inline(lines[i].replace(/^\s*-\s/, "")) + "</li>";
          i++;
        }
        out += "</ul>";
        continue;
      }
      if (/^\s*\|/.test(l)) {
        const rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) {
          rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
          i++;
        }
        const body = rows.filter((r, j) => !(j === 1 && r.every((c) => /^:?-+:?$/.test(c))));
        const [head, ...rest] = body;
        out += '<div class="tw"><table class="t"><thead><tr>' + head.map((c) => "<th>" + inline(c) + "</th>").join("") + "</tr></thead><tbody>" + rest.map((r) => "<tr>" + r.map((c) => "<td>" + inline(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
        continue;
      }
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^\s*[-|]/.test(lines[i]) && !/^###\s/.test(lines[i])) {
        para.push(lines[i]);
        i++;
      }
      out += "<p>" + inline(para.join(" ")) + "</p>";
    }
    return out;
  }

  // ios/core/extra.js
  var extra_exports = {};
  __export(extra_exports, {
    builderAlternatives: () => builderAlternatives,
    builderConflicts: () => builderConflicts,
    builderDeleteModel: () => builderDeleteModel,
    builderFormats: () => builderFormats,
    builderGenerate: () => builderGenerate,
    builderInitial: () => builderInitial,
    builderModels: () => builderModels,
    builderSaveModel: () => builderSaveModel,
    builderWrite: () => builderWrite,
    climbSuggestApply: () => climbSuggestApply,
    climbSuggestOf: () => climbSuggestOf,
    glossSplit: () => glossSplit,
    levelGroups: () => levelGroups,
    levelsForm: () => levelsForm,
    libName: () => libName,
    loadFoods: () => loadFoods2,
    moveWarn: () => moveWarn,
    testDerive: () => testDerive
  });
  function glossSplit(s) {
    s = String(s || "");
    const out = [], seen = /* @__PURE__ */ new Set();
    let last = 0, m;
    GLOSS_RE.lastIndex = 0;
    while (m = GLOSS_RE.exec(s)) {
      const id = glossIdOf(m[2]), start = m.index + m[1].length;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      if (start > last) out.push([s.slice(last, start), null]);
      out.push([m[2], id]);
      last = start + m[2].length;
    }
    if (last < s.length) out.push([s.slice(last), null]);
    return out;
  }
  function testDerive(tid, vals) {
    const t = testById(tid);
    return t && t.derive ? t.derive(vals || {}) : null;
  }
  var find = (k, bid, iid) => {
    const b = blocks(k).find((x) => x.id === bid);
    const it = b && (b.items || []).find((x) => x.id === iid);
    return { b, it };
  };
  function climbSuggestOf(k, bid, iid) {
    const { b, it } = find(k, bid, iid);
    if (!b || !it) return null;
    const s = climbSuggest(k, b, it);
    if (!s) return null;
    return { text: s.text, why: s.why, canApply: !!s.apply };
  }
  function climbSuggestApply(k, bid, iid) {
    const { b, it } = find(k, bid, iid);
    if (!b || !it) return false;
    const s = climbSuggest(k, b, it);
    if (s && s.apply) {
      s.apply();
      return true;
    }
    return false;
  }
  function moveWarn(k, bid, to) {
    const d0 = day(k), b = d0 && (d0.blocks || []).find((x) => x.id === bid);
    if (!b) return null;
    const mine = heavyOf({ blocks: [b] });
    if (!mine.size) return null;
    const hv = (d) => {
      const dd = day(d);
      return heavyOf(dd && d === k ? { blocks: dd.blocks.filter((x) => x.id !== b.id) } : dd);
    };
    const out = [];
    const same = [...mine].filter((g) => hv(to).has(g));
    if (same.length) out.push(groupsTxt(same) + " d\xE9j\xE0 en lourd ce jour-l\xE0");
    for (const [o, w] of [[-1, "la veille"], [1, "le lendemain"]]) {
      const g = [...mine].filter((x) => hv(addDays(to, o)).has(x));
      if (g.length) out.push(groupsTxt(g) + " en lourd " + w);
    }
    return out.length ? out.join(" \xB7 ") : null;
  }
  async function loadFoods2() {
    const f = await loadFoods();
    return f.length;
  }
  var DEFAULT_EQ = { escalade: ["salle-esc"], muscu: ["salle"], course: ["exterieur"], trail: ["exterieur"], velo: ["velo"], natation: ["piscine"], hyrox: ["salle", "exterieur"], collectif: ["exterieur"], combat: [], autre: [] };
  var cloneJ = (x) => JSON.parse(JSON.stringify(x));
  function builderInitial(saved) {
    const o = getSubject(), p = profileOf(o), sp = sportsOf(o) || [];
    const eq = [...new Set(sp.flatMap((s) => DEFAULT_EQ[s] || []))];
    return Object.assign(
      { goal: null, goal2: null, days: [0, 2, 4], fixed: [], fixedLbl: "", dur: 60, lvl: 2, equip: eq, weeks: 8, start: nextMonday(), event: null, eventLbl: "" },
      saved ? { days: saved.days, fixed: saved.fixed || [], fixedLbl: saved.fixedLbl || "", dur: saved.dur, lvl: saved.lvl, equip: saved.equip, weeks: saved.weeks } : {},
      { sports: sp, u18: !!p.under18, swap: {}, fmt: saved && saved.fmt || {} },
      isSelf() ? {} : { lv: cloneJ(levelsDoc(o)) }
    );
  }
  var builderModels = () => (getFor(SELF, "models") || {}).list || [];
  function builderSaveModel(name, cfg) {
    const keep = ["goal", "goal2", "days", "fixed", "fixedLbl", "dur", "lvl", "equip", "weeks", "swap", "fmt"], c = {};
    for (const k of keep) c[k] = cfg[k];
    putFor(SELF, "models", { list: builderModels().filter((m) => m.name !== name).concat([{ id: uid("m"), name, cfg: c, at: Date.now() }]) });
  }
  function builderDeleteModel(id) {
    putFor(SELF, "models", { list: builderModels().filter((m) => m.id !== id) });
  }
  var FAM_LBL = { int: "S\xE9ance d\u2019intervalles (course)", intV: "S\xE9ance d\u2019intervalles (v\xE9lo)", conti: "S\xE9ance de volume", resist: "S\xE9ance de r\xE9sistance", bloc: "S\xE9ance de puissance", doigts: "S\xE9ance de doigts", compet: "S\xE9ance de comp\xE9tition", force: "Muscu \xB7 force", hyper: "Muscu \xB7 masse", puiss: "Muscu \xB7 puissance" };
  var RECO_WHY = {
    conti: (r) => r === "voies" ? "Tu as renseign\xE9 un niveau en voie : le volume se fait en voie." : "Beaucoup de mouvements \xE0 intensit\xE9 basse : la base a\xE9robie des avant-bras et de la technique.",
    resist: (r) => r === "voies" ? "Ton objectif est la r\xE9sistance en voie : on la travaille dans des voies." : "Le 4 \xD7 4 fait durer l\u2019effort 2 \xE0 3 min, la dur\xE9e de la fili\xE8re lactique.",
    bloc: () => "Les blocs \xE0 ta limite recrutent au maximum, frais \xE0 chaque essai.",
    doigts: (r) => r === "hangs" ? "Avec une poutre, la charge des suspensions se r\xE8gle au kilo pr\xE8s." : "Sans poutre (ou avant 18 ans), les petites prises en bloc font progresser sans risque.",
    compet: () => "Le format des qualifications : blocs nouveaux, temps limit\xE9, repos impos\xE9.",
    force: () => "Repos complets entre les s\xE9ries : la base la plus simple pour progresser en force.",
    hyper: (r, c) => r === "supersets" ? "S\xE9ance de " + c.dur + " min : les supersets gardent le volume en moins de temps." : "Un exercice \xE0 la fois, repos complets : le plus simple pour bien charger.",
    puiss: (r) => r === "contraste" ? "Avec une barre et de l\u2019exp\xE9rience : la s\xE9rie lourde potentialise la s\xE9rie explosive." : "Charges l\xE9g\xE8res lanc\xE9es vite : la base, sans mat\xE9riel lourd.",
    int: () => "Alterner 30/30 et 3 min varie le stimulus pr\xE8s de la VO2max ; le seuil se cale sur ta vitesse critique quand tu l\u2019as test\xE9e.",
    intV: () => "Le 4 \xD7 4 min est le format le plus \xE9tudi\xE9 pour la VO2max ; le sweet spot construit l\u2019endurance juste sous la FTP."
  };
  var WK0 = { step: 1, meso: 0, phase: "volume" };
  var tutTxt = (s) => s >= 120 ? Math.round(s / 60) + " min" : s + " s";
  function builderFormats(cfg) {
    const types = [...new Set(weekPlanTypes(cfg))];
    const fams = [...new Set(types.map((t) => fmtFamily(t, cfg)).filter(Boolean))];
    const lifts = /* @__PURE__ */ new Set();
    for (const t of types) {
      const ss = buildSession(t, cfg, WK0, /* @__PURE__ */ new Set(), {});
      for (const b of ss.blocks) for (const it of b.items || []) {
        const l = LIFT_OF_LIB[it.lib];
        if (l && it.rx && it.rx.role === "main") lifts.add(l);
      }
    }
    if (fams.includes("puiss")) ["squat", "bench", "pull"].forEach((l) => lifts.add(l));
    const need = { climb: types.some((t) => ["conti", "resist", "bloc", "doigts", "compet"].includes(t)), lifts: [...lifts], cardio: types.some((t) => ["ef", "int", "long", "lact", "sprint", "circuit"].includes(t)) };
    const out = fams.map((f) => {
      const t = types.find((x) => fmtFamily(x, cfg) === f), cur = fmtOf(f, cfg), reco = fmtReco(f, cfg);
      return { f, label: FAM_LBL[f] || f, cur, reco, why: RECO_WHY[f] ? RECO_WHY[f](reco, cfg) : "", opts: FORMATS[f].map(([id, l, d]) => {
        const ss = buildSession(t, Object.assign({}, cfg, { fmt: Object.assign({}, cfg.fmt, { [f]: id }) }), WK0, /* @__PURE__ */ new Set(), {}), ex = ss.est || {};
        const main = sessionSummary(ss).filter((it) => it.id !== "ech")[0];
        return {
          id,
          l,
          d,
          main: main ? (main.n > 1 ? main.n + " \xD7 " : "") + main.label + (main.det ? " \xB7 " + main.det.split(" \xB7 ").slice(0, 2).join(" \xB7 ") : "") : "",
          est: [ex.min ? "\u2248 " + ex.min + " min" : "", ex.tut ? "\u2248 " + tutTxt(ex.tut) + " sous tension" : ""].filter(Boolean).join(" \xB7 ")
        };
      }) };
    });
    return { need, fams: out };
  }
  var lastProg = null;
  function builderGenerate(cfg) {
    const prog = generate(cfg), t = todayKey();
    lastProg = prog;
    const fams = [...new Set(prog.types.map((x) => fmtFamily(x, cfg)).filter(Boolean))];
    const fmts = fams.map((f) => FAM_LBL[f].replace("S\xE9ance de ", "").replace("Muscu \xB7 ", "").toLowerCase() + " en " + FORMATS[f].find((x) => x[0] === fmtOf(f, cfg))[1].toLowerCase()).join(" \xB7 ");
    const nSes = prog.weeks.reduce((a, x) => a + Object.keys(x.days).filter((d) => addDays(x.start, +d) >= t).length, 0);
    const weeks = prog.weeks.map((w) => ({
      start: w.start,
      phase: w.phase,
      light: !!w.light,
      taper: !!w.taper,
      days: Object.keys(w.days).map((d) => {
        const s = w.days[d];
        return { k: addDays(w.start, +d), short: s.short || "", blocks: (s.blocks || []).map((b) => ({
          kind: b.kind,
          items: (b.items || []).filter((it) => it.id !== "ech" && it.id !== "rac").map((it) => ({ label: it.label, det: it.det || "", n: it.n || 1, unit: it.unit || "", rest: it.rest || 0, lib: it.lib || null, alt: it.lib ? alternatives(it.lib, cfg).length : 0 }))
        })) };
      })
    }));
    const warn = prog.warnings.map((x) => DOW_L[x.d].toLowerCase() + " et " + DOW_L[x.d2].toLowerCase() + " (" + groupsTxt(x.groups) + ")").join(" ; ");
    return { start: prog.start, end: prog.end, nSes, fmts, weeks, warn, phases: [...new Set(prog.weeks.map((x) => x.phase))], needs: missingFor(prog) };
  }
  var builderAlternatives = (lib, cfg) => alternatives(lib, cfg).map((x) => ({ id: x.id, n: x.n, c: x.c || "" }));
  var libName = (id) => (LIB_BY_ID[id] || {}).n || id;
  var builderConflicts = () => lastProg ? conflicts(lastProg) : [];
  var builderWrite = (mode) => lastProg ? writeProgram(lastProg, mode) : 0;
  function levelGroups(sports, need) {
    const s = sports || [], all = !s.length;
    return {
      climb: need ? need.climb : all || s.includes("escalade"),
      lifts: need ? need.lifts : all || s.some((x) => ["muscu", "hyrox", "combat", "collectif", "escalade"].includes(x)) ? s.length && s.every((x) => x === "escalade") ? ["pull", "dips"] : Object.keys(LIFTS) : [],
      cardio: need ? need.cardio : all || s.some((x) => ["course", "trail", "velo", "natation", "hyrox", "collectif", "combat"].includes(x))
    };
  }
  var fmtN = (v) => v == null ? "" : String(v).replace(".", ",");
  function levelsForm(need, lvIn) {
    const lv = lvIn || levelsDoc();
    const g = levelGroups(sportsOf(), need);
    const cl = climbLevel(null, lvIn), vma = vmaOf(null, lvIn), fc = fcmaxOf(null, lvIn), cs = csOf(), vo2 = vo2Of(null, lvIn), ftp = ftpOf(null, lvIn), rp = runProfile(null, lvIn);
    return {
      climb: g.climb ? CLIMB_KEYS.map(([k, disc, , l]) => ({ k, l, v: lv[k] || "", hint: cl[k] && cl[k].src !== "d\xE9clar\xE9" ? cl[k].g + " (" + cl[k].src + ")" : "", opts: SCALE[disc].filter((x, i) => i >= 3) })) : [],
      lifts: g.lifts.map((id) => {
        const L = LIFTS[id], rm = oneRM(id, null, lvIn);
        return { id, l: L.l + (L.lest ? " (lest)" : "") + " \xB7 kg", v: lv.rm && lv.rm[id] != null ? lv.rm[id] : null, hint: rm && rm.src !== "d\xE9clar\xE9" ? rm.txt + " \xB7 " + srcTxt(rm) : "" };
      }),
      cardio: g.cardio ? [
        { k: "vma", l: "VMA (km/h)", v: lv.vma ?? null, int: false, hint: vma && vma.src !== "d\xE9clar\xE9e" ? fmtN(vma.v) + " \xB7 " + srcTxt(vma) : "" },
        { k: "vo2", l: "VO2max (ml/kg/min)", v: lv.vo2 ?? null, int: true, hint: vo2 && vo2.src !== "d\xE9clar\xE9e" ? vo2.v + " \xB7 " + vo2.src : "montre, labo\u2026" },
        { k: "fcmax", l: "FC max (bpm)", v: lv.fcmax ?? null, int: true, hint: fc && fc.src !== "d\xE9clar\xE9e" ? fc.v + " \xB7 " + fc.src : "" },
        { k: "ftp", l: "FTP v\xE9lo (W)", v: lv.ftp ?? null, int: true, hint: ftp && ftp.src !== "d\xE9clar\xE9e" ? ftp.v + " W \xB7 " + srcTxt(ftp) : "" }
      ] : [],
      cardioNote: g.cardio ? (cs ? "Vitesse critique " + fmtN(cs.v) + " km/h \xB7 D\u2032 \u2248 " + cs.dp + " m (test du " + srcTxt(cs).replace("test le ", "") + "). " : "Vitesse critique : passe le test 3 min + 12 min dans Suivi \u2192 Tests. ") + (rp ? rp.txt : "") : ""
    };
  }

  // ios/core/entry.js
  if (typeof globalThis.fetch !== "function") {
    globalThis.fetch = (url) => new Promise((res, rej) => {
      try {
        const txt = globalThis.__native.readResource(String(url).split("/").pop());
        if (txt == null) return res({ ok: false, status: 404 });
        res({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(txt)), text: () => Promise.resolve(txt) });
      } catch (e) {
        rej(e);
      }
    });
  }
  var mods = { store: store_shim_exports, dates: dates_exports, plan: plan_exports, rules: rules_exports, insights: insights_exports, adapt: adapt_exports, stats: stats_exports, tests: tests_exports, levels: levels_exports, history: history_exports, quantify: quantify_exports, records: records_exports, week: week_exports, warmup: warmup_exports, activity: activity_exports, grades: grades_exports, library: library_exports, sports: sports_exports, needs: needs_exports, builder: builder_exports, nutrition: nutrition_exports, glossary: glossary_exports, sources: sources_exports, io: io_exports, md: md_exports, extra: extra_exports };
  function replacer(_k, v) {
    if (v instanceof Set) return [...v];
    if (v instanceof Map) return Object.fromEntries(v);
    if (typeof v === "function") return void 0;
    if (typeof v === "number" && !isFinite(v)) return null;
    return v;
  }
  function resolve(path) {
    const [m, ...rest] = path.split(".");
    let o = mods[m], parent = null;
    for (const p of rest) {
      parent = o;
      o = o == null ? void 0 : o[p];
    }
    return { o, parent };
  }
  globalThis.__core = Object.assign({}, core, {
    call(path, argsJson) {
      const { o, parent } = resolve(path);
      const args = argsJson ? JSON.parse(argsJson) : [];
      const r = typeof o === "function" ? o.apply(parent, args) : o;
      return JSON.stringify(r === void 0 ? null : r, replacer);
    },
    // promesse (chargement de la base d'aliments…) : résultat déposé dans __core.done[id]
    callAsync(id, path, argsJson) {
      const { o, parent } = resolve(path);
      const args = argsJson ? JSON.parse(argsJson) : [];
      Promise.resolve(typeof o === "function" ? o.apply(parent, args) : o).then((r) => globalThis.__native.done(id, JSON.stringify(r === void 0 ? null : r, replacer), null)).catch((e) => globalThis.__native.done(id, null, String(e && e.message || e)));
    },
    loadJSON(json) {
      core.load(JSON.parse(json));
    },
    setJSON(key, json) {
      core.set(key, json == null ? null : JSON.parse(json));
    },
    setLinksJSON(json) {
      core.setLinks(JSON.parse(json));
    },
    version: "1"
  });
})();
