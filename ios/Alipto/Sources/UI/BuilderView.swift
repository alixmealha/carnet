import SwiftUI

// Assistant de programme (comme la version web) : objectif (ou quiz), disponibilités, matériel et dates, niveau et formats, aperçu,
// puis écriture dans le plan. La génération elle-même tourne dans la logique partagée.

private let STEPS = ["goal", "days", "equip", "level", "preview"]
private let TITLES = ["goal": "Objectif", "quiz": "Trouver ton objectif", "days": "Disponibilités", "equip": "Matériel et dates", "level": "Niveau et formats", "preview": "Aperçu"]

struct BuilderView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = Store.shared
    @State private var cfg: JSON = .emptyObject
    @State private var step = "goal"
    @State private var loaded = false
    @State private var prog: JSON?
    @State private var conflicts: [String] = []
    @State private var askConflicts = false
    @State private var dir: Edge = .trailing
    @State private var askClose = false

    private var idx: Int { STEPS.firstIndex(of: step == "quiz" ? "goal" : step) ?? 0 }

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        StepDots(idx: idx, n: STEPS.count).id("top")
                        stepView
                            .id(step)
                            .transition(.asymmetric(insertion: .move(edge: dir).combined(with: .opacity), removal: .opacity))
                    }
                    .padding(16).padding(.bottom, 24)
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: step) { _, _ in withAnimation { proxy.scrollTo("top", anchor: .top) } }
            }
            .background(Palette.bg)
            .safeAreaInset(edge: .bottom) { navBar }
            .navigationTitle(TITLES[step] ?? "Assistant").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Fermer") { if cfg["goal"] != nil { askClose = true } else { dismiss() } } }
                ToolbarItem(placement: .topBarTrailing) { Text("\(idx + 1)/\(STEPS.count)").font(Typo.mono(13)).foregroundStyle(Palette.muted) }
            }
            .confirmationDialog("Quitter l’assistant ? Les réglages de ce programme seront perdus.", isPresented: $askClose, titleVisibility: .visible) {
                Button("Quitter", role: .destructive) { dismiss() }
            }
            .confirmationDialog(conflictTitle, isPresented: $askConflicts, titleVisibility: .visible) {
                Button("Remplacer par le programme") { write("replace") }
                Button("Garder et ajouter le programme à côté") { write("merge") }
                Button("Annuler", role: .cancel) {}
            }
        }
        .interactiveDismissDisabled(cfg["goal"] != nil)
        .onAppear(perform: load)
        .onChange(of: cfg) { _, _ in if step == "preview" { regenerate() } }
    }

    @ViewBuilder private var stepView: some View {
        switch step {
        case "quiz": QuizStep(cfg: $cfg) { go("days") }
        case "days": DaysStep(cfg: $cfg)
        case "equip": EquipStep(cfg: $cfg)
        case "level": LevelStep(cfg: $cfg)
        case "preview":
            if let prog { PreviewStep(cfg: $cfg, prog: prog) } else { ProgressView().frame(maxWidth: .infinity).padding(40) }
        default:
            GoalStep(cfg: $cfg, onQuiz: { go("quiz") }, onModel: applyModel)
        }
    }

    private var navBar: some View {
        HStack(spacing: 10) {
            Button(idx == 0 && step != "quiz" ? "Annuler" : "Retour", action: back).buttonStyle(BigButton(kind: .plain)).frame(maxWidth: 140)
            if step == "preview" {
                Button { add() } label: { Label("Ajouter au plan", systemImage: "checkmark") }.buttonStyle(BigButton())
            } else if step != "quiz" {
                Button("Continuer", action: next).buttonStyle(BigButton())
            }
        }
        .padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 6)
        .background(.bar)
    }

    // MARK: navigation

    private func go(_ s: String) {
        let a = STEPS.firstIndex(of: s == "quiz" ? "goal" : s) ?? 0
        dir = a >= idx && s != "goal" ? .trailing : .leading
        if s == "preview" { regenerate() }
        withAnimation(.spring(response: 0.42, dampingFraction: 0.88)) { step = s }
        Haptics.select()
    }
    private var err: String? {
        if step == "goal" && cfg["goal"] == nil { return "Choisis un objectif (ou réponds au quiz)." }
        if step == "days" && (cfg["days"]?.array ?? []).isEmpty { return "Choisis au moins un jour." }
        if step == "equip", let ev = cfg["event"]?.string, D.diff(cfg["start"]?.string ?? D.today, ev) < 13 { return "La date de l’objectif doit être au moins deux semaines après le début." }
        return nil
    }
    private func next() {
        if let e = err { Haptics.warning(); toast(e); return }
        if step == "level" { savePrefs() }
        go(STEPS[min(idx + 1, STEPS.count - 1)])
    }
    private func back() {
        if step == "quiz" { go("goal") }
        else if idx > 0 { go(STEPS[idx - 1]) }
        else if cfg["goal"] != nil { askClose = true }
        else { dismiss() }
    }

    // MARK: réglages

    private var prefKey: String { "alipto-builder:" + (store.me ?? "local") + ":" + store.subject }
    private func load() {
        guard !loaded else { return }
        loaded = true
        let saved = UserDefaults.standard.data(forKey: prefKey).flatMap { JSON.decode($0) }
        cfg = Core.shared.call("extra.builderInitial", saved ?? .null) ?? .emptyObject
    }
    private func savePrefs() {
        var p = JSON.emptyObject
        for k in ["days", "fixed", "fixedLbl", "dur", "lvl", "equip", "weeks", "fmt"] { p[k] = cfg[k] }
        UserDefaults.standard.set(p.encoded(), forKey: prefKey)
    }
    private func applyModel(_ m: JSON) {
        var c = cfg
        for (k, v) in (m["cfg"]?.object ?? [:]) { c[k] = v }
        c["swap"] = m["cfg"]?["swap"] ?? .emptyObject
        c["fixed"] = m["cfg"]?["fixed"] ?? .arr([])
        c["start"] = Core.shared.call("builder.nextMonday") ?? .str(D.today)
        c["event"] = nil
        cfg = c
        go("preview")
    }
    private func regenerate() {
        guard cfg["goal"] != nil else { return }
        prog = Core.shared.call("extra.builderGenerate", cfg)
    }

    // MARK: écriture

    private var conflictTitle: String {
        guard let f = conflicts.first else { return "" }
        let n = conflicts.count
        return Fmt.plural(n, "jour") + (n > 1 ? " ont" : " a") + " déjà une séance sur cette période (à partir du " + D.day(f) + ")."
    }
    private func add() {
        conflicts = Core.shared.call("extra.builderConflicts")?.array.compactMap { $0.string } ?? []
        if conflicts.isEmpty { write("replace") } else { askConflicts = true }
    }
    private func write(_ mode: String) {
        let n = Core.shared.call("extra.builderWrite", .str(mode))?.int ?? 0
        Haptics.success()
        toast("Programme ajouté : " + Fmt.plural(n, "séance"))
        dismiss()
    }
}

/// Avancement de l'assistant
private struct StepDots: View {
    let idx: Int
    let n: Int
    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<n, id: \.self) { i in
                Capsule().fill(i <= idx ? Palette.accent : Palette.sunk).frame(height: 4)
            }
        }
        .animation(.spring(response: 0.4, dampingFraction: 0.85), value: idx)
    }
}

private func goalsList(_ cfg: JSON, climbOnlyIfEmpty: Bool = true) -> [JSON] {
    let sp = cfg["sports"]?.array.compactMap { $0.string } ?? []
    let cl = sp.contains("escalade") || (climbOnlyIfEmpty && sp.isEmpty)
    return Core.shared.constant("library.GOALS").array.filter { cl || $0["sp"]?.string != "escalade" }
}
private func goalById(_ id: String?) -> JSON? {
    guard let id else { return nil }
    return Core.shared.constant("library.GOALS").array.first { $0["id"]?.string == id }
}

private struct SubLabel: View {
    let text: String
    var small: String? = nil
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(text).font(Typo.sans(15, .semibold)).foregroundStyle(Palette.ink)
            if let small { Text(small).font(Typo.sans(12.5)).foregroundStyle(Palette.muted) }
        }
    }
}

/// Carte à choisir (objectif, niveau, format)
private struct ChoiceCard: View {
    let on: Bool
    let title: String
    var sub: String? = nil
    var badge: String? = nil
    var extra: [String] = []
    let action: () -> Void
    var body: some View {
        Button { Haptics.select(); action() } label: {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(title).font(Typo.sans(15.5, .semibold)).foregroundStyle(Palette.ink).multilineTextAlignment(.leading)
                    if let badge { Text(badge).font(Typo.sans(11, .semibold)).foregroundStyle(Palette.accent).padding(.horizontal, 6).padding(.vertical, 2).background(Palette.accentSoft, in: Capsule()) }
                }
                if let sub { Text(sub).font(Typo.sans(13)).foregroundStyle(Palette.muted).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true) }
                ForEach(extra.indices, id: \.self) { i in
                    Text(extra[i]).font(Typo.mono(12)).foregroundStyle(Palette.ink.opacity(0.8)).multilineTextAlignment(.leading)
                }
            }
            .padding(14).frame(maxWidth: .infinity, minHeight: 64, alignment: .topLeading)
            .background(on ? Palette.accentSoft : Palette.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(on ? Palette.accent : Palette.rule.opacity(0.6), lineWidth: on ? 1.6 : 0.5))
        }
        .buttonStyle(PressStyle())
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

/// Filière travaillée par un objectif
private struct SysCard: View {
    let id: String?
    var body: some View {
        if let id, let s = Core.shared.constant("library.SYSTEMS")[id] {
            VStack(alignment: .leading, spacing: 6) {
                Text(s["l"]?.string ?? "").font(Typo.sans(15, .semibold)).foregroundStyle(Palette.ink)
                GlossText(s["d"]?.string).font(Typo.sans(14)).foregroundStyle(Palette.ink.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
                SourcesLine(ids: s["src"]?.array.compactMap { $0.string } ?? [])
            }
            .padding(14).frame(maxWidth: .infinity, alignment: .leading)
            .background(Palette.sunk.opacity(0.7), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }
}

// MARK: objectif

private struct GoalStep: View {
    @Binding var cfg: JSON
    let onQuiz: () -> Void
    let onModel: (JSON) -> Void
    @State private var models: [JSON] = []
    var body: some View {
        let goals = goalsList(cfg), goal = cfg["goal"]?.string
        VStack(alignment: .leading, spacing: 14) {
            if !models.isEmpty { modelsCard }
            Button { Haptics.tap(); onQuiz() } label: {
                HStack(spacing: 12) {
                    Image(systemName: "questionmark.bubble").font(.system(size: 20, weight: .semibold)).foregroundStyle(Palette.accent)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Je ne sais pas").font(Typo.sans(16, .semibold)).foregroundStyle(Palette.ink)
                        Text("Trois questions pour trouver ce qui te fera le plus progresser").font(Typo.sans(13)).foregroundStyle(Palette.muted).multilineTextAlignment(.leading)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Palette.muted.opacity(0.6))
                }
                .card(padding: 14)
            }
            .buttonStyle(PressStyle())
            SubLabel(text: "Ce que tu veux améliorer en priorité")
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible())], spacing: 10) {
                ForEach(goals.indices, id: \.self) { i in
                    let g = goals[i], id = g["id"]?.string ?? ""
                    ChoiceCard(on: goal == id, title: g["l"]?.string ?? "", sub: g["d"]?.string) { pick(id) }
                }
            }
            if let goal {
                SubLabel(text: "En second", small: "facultatif : une séance par semaine environ").padding(.top, 4)
                Flow(spacing: 8) {
                    Chip(label: "Rien", on: cfg["goal2"] == nil) { cfg["goal2"] = nil }
                    ForEach(goals.filter { $0["id"]?.string != goal }.indices, id: \.self) { i in
                        let g = goals.filter { $0["id"]?.string != goal }[i], id = g["id"]?.string ?? ""
                        Chip(label: g["l"]?.string ?? "", on: cfg["goal2"]?.string == id) { cfg["goal2"] = .str(id) }
                    }
                }
                SysCard(id: goalById(goal)?["sys"]?.string)
            }
        }
        .onAppear { models = Core.shared.call("extra.builderModels")?.array ?? [] }
    }
    private func pick(_ id: String) {
        withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
            cfg["goal"] = .str(id)
            if cfg["goal2"]?.string == id { cfg["goal2"] = nil }
        }
    }
    private var modelsCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            SubLabel(text: "Mes modèles")
            ForEach(models.indices, id: \.self) { i in
                let m = models[i]
                Button { Haptics.tap(); onModel(m) } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(m["name"]?.string ?? "Modèle").font(Typo.sans(15, .semibold)).foregroundStyle(Palette.ink)
                            Text(modelLine(m)).font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Palette.muted.opacity(0.6))
                    }
                    .padding(.vertical, 8).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .contextMenu {
                    Button(role: .destructive) {
                        Core.shared.call("extra.builderDeleteModel", m["id"] ?? .null)
                        models = Core.shared.call("extra.builderModels")?.array ?? []
                    } label: { Label("Supprimer le modèle", systemImage: "trash") }
                }
            }
            Text("Appui long sur un modèle pour le supprimer.").font(Typo.sans(12)).foregroundStyle(Palette.muted)
        }
        .card(padding: 14)
    }
    private func modelLine(_ m: JSON) -> String {
        let c = m["cfg"] ?? .emptyObject
        var s = goalById(c["goal"]?.string)?["l"]?.string ?? ""
        if let g2 = goalById(c["goal2"]?.string)?["l"]?.string { s += " + " + g2.lowercased() }
        s += " · \(c["days"]?.array.count ?? 0) j/sem. · \(c["dur"]?.int ?? 60) min"
        return s
    }
}

// MARK: quiz

private struct QuizStep: View {
    @Binding var cfg: JSON
    let onDone: () -> Void
    @State private var ans: [String: String] = [:]
    var body: some View {
        let cl = (cfg["sports"]?.array.compactMap { $0.string } ?? []).contains("escalade")
        let qs = Core.shared.call("library.quiz", .bool(cl))?.array ?? []
        let done = !qs.isEmpty && qs.allSatisfy { ans[$0["id"]?.string ?? ""] != nil }
        let res = done ? (Core.shared.call("library.quizResult", .obj(ans.mapValues { .str($0) }), .bool(cl))?.array.compactMap { $0.string } ?? []) : []
        VStack(alignment: .leading, spacing: 18) {
            ForEach(qs.indices, id: \.self) { i in
                let q = qs[i], qid = q["id"]?.string ?? ""
                VStack(alignment: .leading, spacing: 8) {
                    Text("\(i + 1). " + (q["q"]?.string ?? "")).font(Typo.sans(16, .semibold)).foregroundStyle(Palette.ink)
                    ForEach((q["opts"]?.array ?? []).indices, id: \.self) { j in
                        let o = (q["opts"]?.array ?? [])[j], oid = o["id"]?.string ?? ""
                        ChoiceCard(on: ans[qid] == oid, title: o["l"]?.string ?? "") {
                            withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) { ans[qid] = oid }
                        }
                    }
                }
            }
            if done { result(res) }
        }
    }
    private func then(_ g2: JSON?) -> String {
        guard let l = g2?["l"]?.string else { return "" }
        return " puis " + l.lowercased()
    }
    @ViewBuilder private func result(_ res: [String]) -> some View {
        if let first = res.first {
            let g1 = goalById(first), g2 = goalById(res.at(1))
            VStack(alignment: .leading, spacing: 10) {
                CardHeader("Ce qui te fera le plus progresser")
                (Text(g1?["l"]?.string ?? "").bold() + Text(then(g2)))
                    .font(Typo.sans(17)).foregroundStyle(Palette.ink)
                SysCard(id: g1?["sys"]?.string)
                if let g2, g2["sys"] != g1?["sys"] { SysCard(id: g2["sys"]?.string) }
                Button("Partir là-dessus") {
                    cfg["goal"] = .str(first)
                    if let s2 = res.at(1) { cfg["goal2"] = .str(s2) } else { cfg["goal2"] = nil }
                    onDone()
                }
                .buttonStyle(BigButton())
            }
            .card()
            .transition(.move(edge: .bottom).combined(with: .opacity))
        } else {
            Text("Pas de priorité nette : choisis un objectif dans la liste, ou « Prévention » pour une base solide.").font(Typo.sans(14)).foregroundStyle(Palette.muted)
        }
    }
}

// MARK: disponibilités

private struct DayChips: View {
    let value: [Int]
    let disabled: [Int]
    let onChange: ([Int]) -> Void
    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<7, id: \.self) { i in
                let on = value.contains(i), off = disabled.contains(i)
                Button {
                    Haptics.select()
                    onChange(on ? value.filter { $0 != i } : (value + [i]).sorted())
                } label: {
                    Text(D.dow3[i]).font(Typo.sans(13.5, .semibold))
                        .foregroundStyle(on ? Palette.accentInk : off ? Palette.muted.opacity(0.4) : Palette.ink)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(on ? Palette.accent : Palette.sunk, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                }
                .buttonStyle(PressStyle())
                .disabled(off)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
    }
}

private struct DaysStep: View {
    @Binding var cfg: JSON
    var body: some View {
        let days = ints("days"), fixed = ints("fixed")
        let levels = Core.shared.constant("builder.LEVELS").array
        let durs = Core.shared.constant("builder.DURS").array.compactMap { $0.int }
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 8) {
                SubLabel(text: "Jours d’entraînement", small: "\(days.count) par semaine")
                DayChips(value: days, disabled: fixed) { cfg["days"] = .arr($0.map { .num(Double($0)) }) }
            }
            VStack(alignment: .leading, spacing: 8) {
                SubLabel(text: "Jours déjà pris par ton sport", small: "club, match : facultatif")
                DayChips(value: fixed, disabled: days) { cfg["fixed"] = .arr($0.map { .num(Double($0)) }) }
                if !fixed.isEmpty {
                    FieldBox(label: "Nom") { TextField("Basket, match, entraînement du club…", text: $cfg.text("fixedLbl", keep: true)) }
                }
                Text("L’assistant place les séances lourdes loin de ces jours (règle des 48 h).").font(Typo.sans(13)).foregroundStyle(Palette.muted)
            }
            VStack(alignment: .leading, spacing: 8) {
                SubLabel(text: "Durée d’une séance")
                Segmented(options: durs.map { (String($0), "\($0) min") }, value: String(cfg["dur"]?.int ?? 60)) { v in
                    if let v, let n = Double(v) { cfg["dur"] = .num(n) }
                }
            }
            VStack(alignment: .leading, spacing: 8) {
                SubLabel(text: "Ton niveau dans ce type d’entraînement")
                ForEach(levels.indices, id: \.self) { i in
                    let l = levels[i], n = l[0]?.int ?? 1
                    ChoiceCard(on: cfg["lvl"]?.int == n, title: l[1]?.string ?? "", sub: l[2]?.string) { cfg["lvl"] = .num(Double(n)) }
                }
            }
        }
    }
    private func ints(_ k: String) -> [Int] { cfg[k]?.array.compactMap { $0.int } ?? [] }
}

// MARK: matériel et dates

private struct EquipStep: View {
    @Binding var cfg: JSON
    var body: some View {
        let equip = Core.shared.constant("library.EQUIP").array
        let on = cfg["equip"]?.array.compactMap { $0.string } ?? []
        let nm = Core.shared.call("builder.nextMonday")?.string ?? D.today, thisMon = D.monday(D.today)
        let start = cfg["start"]?.string ?? nm
        let ev = cfg["event"]?.string
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 8) {
                SubLabel(text: "Matériel disponible", small: "plusieurs choix possibles")
                Flow(spacing: 8) {
                    ForEach(equip.indices, id: \.self) { i in
                        let id = equip[i][0]?.string ?? ""
                        Chip(label: equip[i][1]?.string ?? id, on: on.contains(id)) {
                            let a = on.contains(id) ? on.filter { $0 != id } : on + [id]
                            cfg["equip"] = .arr(a.map { .str($0) })
                        }
                    }
                }
                Text("Sans rien coché : poids du corps uniquement.").font(Typo.sans(13)).foregroundStyle(Palette.muted)
            }
            VStack(alignment: .leading, spacing: 8) {
                SubLabel(text: "Début")
                ChoiceCard(on: start == nm, title: "Lundi " + D.day(nm)) { cfg["start"] = .str(nm) }
                if thisMon != nm {
                    ChoiceCard(on: start == thisMon, title: "Cette semaine", sub: "à partir d’aujourd’hui") { cfg["start"] = .str(thisMon) }
                }
            }
            VStack(alignment: .leading, spacing: 8) {
                SubLabel(text: "Durée du programme")
                Segmented(options: [("4", "4 sem."), ("8", "8 sem."), ("12", "12 sem."), ("event", "Une date")], value: ev != nil ? "event" : String(cfg["weeks"]?.int ?? 8)) { v in
                    guard let v else { return }
                    withAnimation {
                        if v == "event" { cfg["event"] = .str(D.add(start, 8 * 7 - 1)) }
                        else if let n = Double(v) { cfg["weeks"] = .num(n); cfg["event"] = nil }
                    }
                }
                if let ev {
                    VStack(spacing: 0) {
                        DatePicker("Date de l’objectif", selection: dateBinding({ ev }, { cfg["event"] = .str($0) }), in: D.date(D.add(start, 13))..., displayedComponents: .date)
                            .padding(.horizontal, 14).frame(minHeight: 50)
                        Divider().overlay(Palette.rule.opacity(0.6))
                        TextField("Nom : compétition, course, voyage…", text: $cfg.text("eventLbl", keep: true))
                            .padding(.horizontal, 14).frame(minHeight: 50)
                    }
                    .background(Palette.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }
                Text(ev != nil ? "Les deux dernières semaines deviennent un affûtage : moins de volume, même intensité (Bosquet 2007)." : "Toutes les 4 semaines, une semaine de décharge pour digérer le travail (Bell 2023).")
                    .font(Typo.sans(13)).foregroundStyle(Palette.muted)
            }
        }
    }
}

// MARK: niveau et formats

private struct LevelStep: View {
    @Binding var cfg: JSON
    @State private var store = Store.shared
    var body: some View {
        let f = Core.shared.call("extra.builderFormats", cfg) ?? .emptyObject
        let need = f["need"] ?? .emptyObject
        let hasNeed = (need["climb"]?.truthy ?? false) || !(need["lifts"]?.array ?? []).isEmpty || (need["cardio"]?.truthy ?? false)
        let fams = f["fams"]?.array ?? []
        VStack(alignment: .leading, spacing: 18) {
            if hasNeed {
                VStack(alignment: .leading, spacing: 10) {
                    CardHeader("Ton niveau") { Text("facultatif").font(Typo.sans(13)).foregroundStyle(Palette.muted) }
                    Text("Avec ces repères, les séances donnent des cotations, des charges et des allures précises. Sans eux, les consignes restent relatives (« 3 niveaux sous ton flash »)." + (store.isSelf ? " Ils sont gardés dans ton profil." : " Ce que tu complètes ici sert à ce programme seulement."))
                        .font(Typo.sans(13.5)).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
                    if store.isSelf { LevelsForm(need: need) } else { LevelsForm(need: need, lv: $cfg.at("lv")) }
                }
                .card()
            }
            ForEach(fams.indices, id: \.self) { i in FamilyFormats(fam: fams[i], cfg: $cfg) }
        }
    }
}

private struct FamilyFormats: View {
    let fam: JSON
    @Binding var cfg: JSON
    var body: some View {
        let f = fam["f"]?.string ?? "", opts = fam["opts"]?.array ?? [], cur = fam["cur"]?.string, reco = fam["reco"]?.string
        VStack(alignment: .leading, spacing: 8) {
            SubLabel(text: fam["label"]?.string ?? f, small: Fmt.plural(opts.count, "format"))
            ForEach(opts.indices, id: \.self) { j in
                let o = opts[j], id = o["id"]?.string ?? ""
                ChoiceCard(on: cur == id, title: o["l"]?.string ?? "", sub: o["d"]?.string, badge: id == reco ? "Conseillé" : nil,
                           extra: [o["main"]?.string ?? "", o["est"]?.string ?? ""].filter { !$0.isEmpty }) {
                    var fm = cfg["fmt"] ?? .emptyObject
                    fm[f] = .str(id)
                    cfg["fmt"] = fm
                }
            }
            (Text("Conseillé : ").bold() + Text(fam["why"]?.string ?? "")).font(Typo.sans(13)).foregroundStyle(Palette.muted)
        }
    }
}

// MARK: aperçu

private struct PreviewStep: View {
    @Binding var cfg: JSON
    let prog: JSON
    @State private var wi = 0
    @State private var swap: String?
    @State private var store = Store.shared
    var body: some View {
        let weeks = prog["weeks"]?.array ?? []
        let w = weeks.at(min(wi, max(0, weeks.count - 1))) ?? .emptyObject
        VStack(alignment: .leading, spacing: 14) {
            SummaryCard(cfg: cfg, prog: prog, wi: $wi)
            NeedsCard(cfg: $cfg, needs: prog["needs"] ?? .emptyObject)
            if let warn = prog["warn"]?.string, !warn.isEmpty {
                Label { Text("Règle des 48 h : " + warn + ". Avec ces jours imposés, deux séances dures se suivent : allège l’une des deux ou décale un jour si tu peux.").font(Typo.sans(13.5)) }
                    icon: { Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Palette.warn) }
                    .padding(12).background(Palette.warn.opacity(0.1), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            weekNav(weeks, w)
            ForEach((w["days"]?.array ?? []).indices, id: \.self) { i in
                PreviewDay(d: (w["days"]?.array ?? [])[i]) { lib in swap = lib }
            }
            Text(footer()).font(Typo.sans(13.5)).foregroundStyle(Palette.muted)
        }
        .sheet(item: Binding(get: { swap.map { TermRef(id: $0) } }, set: { swap = $0?.id })) { r in
            SwapSheet(lib: r.id, cfg: $cfg).presentationDetents([.medium, .large]).presentationDragIndicator(.visible)
        }
    }
    private func footer() -> String {
        let n = prog["nSes"]?.int ?? 0
        let whose = store.isSelf ? "ton plan" : "le plan de " + store.name(store.subject)
        return Fmt.plural(n, "séance") + " seront écrites dans " + whose + ". Tout reste modifiable ensuite, jour par jour."
    }
    private func weekNav(_ weeks: [JSON], _ w: JSON) -> some View {
        let light = w["light"]?.truthy ?? false, taper = w["taper"]?.truthy ?? false
        let ph = PHASE_LABEL[w["phase"]?.string ?? ""] ?? ""
        return HStack {
            Button { Haptics.select(); withAnimation { wi = max(0, wi - 1) } } label: { Image(systemName: "chevron.left").frame(width: 40, height: 40).background(Palette.surface, in: Circle()) }
                .disabled(wi == 0)
            Spacer()
            Text("Semaine \(wi + 1)").font(Typo.sans(15, .semibold)) + Text(" · " + ph + (light ? " (décharge)" : (taper ? " (affûtage)" : ""))).font(Typo.sans(15))
            Spacer()
            Button { Haptics.select(); withAnimation { wi = min(weeks.count - 1, wi + 1) } } label: { Image(systemName: "chevron.right").frame(width: 40, height: 40).background(Palette.surface, in: Circle()) }
                .disabled(wi >= weeks.count - 1)
        }
        .foregroundStyle(Palette.ink)
    }
}

private struct SummaryCard: View {
    let cfg: JSON
    let prog: JSON
    @Binding var wi: Int
    @State private var askName = false
    @State private var name = ""
    var body: some View {
        let weeks = prog["weeks"]?.array ?? []
        let g = goalById(cfg["goal"]?.string), g2 = goalById(cfg["goal2"]?.string)
        let nd = cfg["days"]?.array.count ?? 0
        VStack(alignment: .leading, spacing: 10) {
            CardHeader("Ton programme")
            Text(rangeLine(weeks.count)).font(Typo.mono(12.5)).foregroundStyle(Palette.muted)
            (Text(g?["l"]?.string ?? "").bold() + Text(goalLine(g2, nd)))
                .font(Typo.sans(16)).foregroundStyle(Palette.ink)
            if let f = prog["fmts"]?.string, !f.isEmpty { Text("Formats : " + f).font(Typo.sans(13)).foregroundStyle(Palette.muted) }
            HStack(spacing: 3) {
                ForEach(weeks.indices, id: \.self) { i in
                    Button { Haptics.select(); withAnimation { wi = i } } label: {
                        VStack(spacing: 3) {
                            RoundedRectangle(cornerRadius: 3).fill(phaseColor(weeks[i]["phase"]?.string ?? "")).frame(height: 26)
                                .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(Palette.ink, lineWidth: i == wi ? 1.6 : 0).padding(-2))
                            Text("\(i + 1)").font(Typo.mono(9.5, i == wi ? .bold : .regular)).foregroundStyle(i == wi ? Palette.ink : Palette.muted)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.plain)
                }
            }
            Flow(spacing: 10) {
                ForEach((prog["phases"]?.array.compactMap { $0.string } ?? []), id: \.self) { p in
                    HStack(spacing: 5) {
                        RoundedRectangle(cornerRadius: 2).fill(phaseColor(p)).frame(width: 10, height: 10)
                        Text(PHASE_LABEL[p] ?? p).font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                    }
                }
            }
            SysCard(id: g?["sys"]?.string)
            Button("Enregistrer ces réglages comme modèle") {
                name = (g?["l"]?.string ?? "Modèle") + " · \(nd) j"
                askName = true
            }
            .buttonStyle(SmallButton())
        }
        .card()
        .alert("Nom du modèle", isPresented: $askName) {
            TextField("Nom", text: $name)
            Button("Enregistrer") {
                let n = name.trimmingCharacters(in: .whitespaces)
                guard !n.isEmpty else { return }
                Core.shared.call("extra.builderSaveModel", .str(n), cfg)
                Haptics.success(); toast("Modèle enregistré")
            }
            Button("Annuler", role: .cancel) {}
        } message: { Text("Tu pourras repartir de ces réglages, ou les appliquer à un autre athlète.") }
    }
    private func rangeLine(_ n: Int) -> String {
        let a = D.day(prog["start"]?.string ?? ""), b = D.day(prog["end"]?.string ?? "")
        return "\(n) semaines · " + a + " → " + b
    }
    private func goalLine(_ g2: JSON?, _ nd: Int) -> String {
        var s = ""
        if let l = g2?["l"]?.string { s += " + " + l.lowercased() }
        s += " · " + Fmt.plural(nd, "séance")
        s += " par semaine de \(cfg["dur"]?.int ?? 60) min"
        return s
    }
}

/// Ce qui manque pour le sport et l'objectif : un appui l'ajoute au programme
private struct NeedsCard: View {
    @Binding var cfg: JSON
    let needs: JSON
    var body: some View {
        let list = needs["list"]?.array ?? [], tips = needs["tips"]?.array ?? []
        let sp = (cfg["sports"]?.array.compactMap { $0.string } ?? []).filter { $0 != "autre" }
        let lbl = Core.shared.constant("sports.SPORT_LBL")
        let spTxt = sp.compactMap { lbl[$0]?.string?.lowercased() }.joined(separator: " et ")
        VStack(alignment: .leading, spacing: 10) {
            CardHeader("Ce qui manque" + (spTxt.isEmpty ? "" : " pour " + spTxt))
            Text(list.isEmpty ? "Ton programme couvre déjà l’essentiel pour ton sport et ton objectif." : "D’après les doses minimales qui font progresser muscles, tendons et os, et les besoins de ton sport. Un appui l’ajoute au programme, 2 fois par semaine.")
                .font(Typo.sans(13.5)).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
            ForEach(list.indices, id: \.self) { i in NeedRow(x: list[i]) { toggle(list[i]) } }
            ForEach(tips.indices, id: \.self) { i in
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Circle().fill(Palette.muted).frame(width: 4, height: 4).offset(y: -3)
                    tipText(tips[i]).font(Typo.sans(13)).foregroundStyle(Palette.ink.opacity(0.85))
                }
            }
        }
        .card()
    }
    private func tipText(_ t: JSON) -> Text {
        let a: String = t["t"]?.string ?? "", b: String = t["why"]?.string ?? ""
        return Text(a).bold() + Text(" · " + b)
    }
    private func toggle(_ x: JSON) {
        Haptics.select()
        if x["kind"]?.string == "goal2" { cfg["goal2"] = "force"; toast("Force ajoutée en second objectif"); return }
        let id = x["id"]?.string ?? ""
        var ex = cfg["extras"]?.array.compactMap { $0.string } ?? []
        if x["added"]?.truthy == true { ex.removeAll { $0 == id } } else { ex.append(id) }
        cfg["extras"] = .arr(ex.map { .str($0) })
    }
}

private struct NeedRow: View {
    let x: JSON
    let action: () -> Void
    var body: some View {
        let added = x["added"]?.truthy ?? false, lvl = x["lvl"]?.string ?? ""
        let lvlLbl = Core.shared.constant("needs.LVL_LBL")[lvl]?.string ?? lvl
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(x["t"]?.string ?? "").font(Typo.sans(15, .semibold)).foregroundStyle(Palette.ink)
                Spacer(minLength: 6)
                Text(lvlLbl).font(Typo.sans(11, .semibold)).foregroundStyle(lvlColor(lvl)).padding(.horizontal, 7).padding(.vertical, 2).background(lvlColor(lvl).opacity(0.12), in: Capsule())
            }
            GlossText(x["why"]?.string).font(Typo.sans(13.5)).foregroundStyle(Palette.ink.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
            if let w = x["warn"]?.string { Text(w + " À valider avec un professionnel de santé.").font(Typo.sans(12.5, .medium)).foregroundStyle(Palette.warn) }
            HStack {
                SourcesLine(ids: x["src"]?.array.compactMap { $0.string } ?? [])
                Spacer(minLength: 6)
                Button(added ? "Retirer" : x["kind"]?.string == "goal2" ? "Ajouter en second objectif" : "Ajouter", action: action)
                    .buttonStyle(SmallButton(color: added ? Palette.muted : Palette.accent))
            }
        }
        .padding(12)
        .background(added ? Palette.accentSoft : Palette.sunk.opacity(0.6), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .animation(.spring(response: 0.3, dampingFraction: 0.85), value: added)
    }
    private func lvlColor(_ l: String) -> Color { l == "solide" ? Palette.good : l == "modéré" ? Palette.warn : Palette.muted }
}

private struct PreviewDay: View {
    let d: JSON
    let onSwap: (String) -> Void
    var body: some View {
        let k = d["k"]?.string ?? "", past = k < D.today
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(D.short(k)).font(Typo.mono(12.5)).foregroundStyle(Palette.muted)
                Text(d["short"]?.string ?? "").font(Typo.sans(15.5, .semibold)).foregroundStyle(Palette.ink)
                if past { Text("passé").font(Typo.sans(12)).foregroundStyle(Palette.muted) }
            }
            ForEach((d["blocks"]?.array ?? []).indices, id: \.self) { i in
                let b = (d["blocks"]?.array ?? [])[i]
                HStack(alignment: .top, spacing: 10) {
                    RoundedRectangle(cornerRadius: 2).fill(Palette.kind(b["kind"]?.string ?? "")).frame(width: 3)
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach((b["items"]?.array ?? []).indices, id: \.self) { j in
                            PreviewItem(it: (b["items"]?.array ?? [])[j], past: past, onSwap: onSwap)
                        }
                    }
                }
            }
        }
        .card(padding: 14)
        .opacity(past ? 0.55 : 1)
    }
}

private struct PreviewItem: View {
    let it: JSON
    let past: Bool
    let onSwap: (String) -> Void
    var body: some View {
        let n = it["n"]?.int ?? 1, unit = it["unit"]?.string ?? ""
        HStack(alignment: .top, spacing: 8) {
            Text(n > 1 || !unit.isEmpty ? "\(n) ×" : "").font(Typo.mono(12.5)).foregroundStyle(Palette.muted).frame(width: 30, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                rich(it["label"]?.string ?? "").font(Typo.sans(14.5, .medium)).foregroundStyle(Palette.ink)
                let det = detail()
                if !det.isEmpty { Text(det).font(Typo.sans(12.5)).foregroundStyle(Palette.muted) }
            }
            Spacer(minLength: 4)
            if let lib = it["lib"]?.string, (it["alt"]?.int ?? 0) > 0, !past {
                Button("Changer") { Haptics.tap(); onSwap(lib) }.buttonStyle(SmallButton())
            }
        }
    }
    private func detail() -> String {
        let det = it["det"]?.string ?? ""
        guard !det.isEmpty else { return "" }
        let r = it["rest"]?.int ?? 0
        guard r > 0 else { return det }
        let rest = r >= 60 ? "\(r / 60) min" + (r % 60 > 0 ? " \(r % 60)" : "") : "\(r) s"
        return det + " · repos " + rest
    }
}

/// Remplacer un exercice dans tout le programme
private struct SwapSheet: View {
    let lib: String
    @Binding var cfg: JSON
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        let alts = Core.shared.call("extra.builderAlternatives", .str(lib), cfg)?.array ?? []
        let name = Core.shared.call("extra.libName", .str(lib))?.string ?? lib
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    (Text("À la place de ") + Text(name).bold() + Text(", dans tout le programme :")).font(Typo.sans(14.5)).foregroundStyle(Palette.muted)
                    ForEach(alts.indices, id: \.self) { i in
                        let x = alts[i]
                        OptionRow(title: x["n"]?.string ?? "", text: (x["c"]?.string).flatMap { $0.isEmpty ? nil : $0 }) {
                            var s = cfg["swap"] ?? .emptyObject
                            s[lib] = x["id"] ?? .null
                            cfg["swap"] = s
                            dismiss()
                        }
                    }
                }
                .padding(16)
            }
            .background(Palette.bg)
            .navigationTitle("Remplacer").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Annuler") { dismiss() } } }
        }
    }
}
