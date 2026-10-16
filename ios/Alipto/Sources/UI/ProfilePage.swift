import SwiftUI

// Plus → Profil (comme la version web) : qui tu es, tes sports, ton niveau, ton alimentation, ton coach ou tes athlètes.

let SEXES: [(String, String)] = [("F", "Femme"), ("M", "Homme"), ("X", "Autre")]

/// Brouillon du profil (prénom, corps, sports, régime) et vérification des champs
struct ProfileDraft: Equatable {
    var name = ""
    var sex = ""
    var birth = ""
    var height = ""
    var weight = ""
    var sports: [String] = []
    var diet = "omni"

    init() {}
    init(_ p: JSON) {
        name = p["name"]?.string ?? ""
        sex = p["sex"]?.string ?? ""
        birth = p["birth_year"]?.int.map { String($0) } ?? ""
        height = p["height_cm"]?.int.map { String($0) } ?? ""
        weight = p["weight_kg"]?.double.map { Fmt.num($0) } ?? ""
        sports = p["sports"]?.array.compactMap { $0.string } ?? []
        diet = p["diet"]?.string ?? "omni"
    }
    private static func num(_ s: String) -> Double? { Double(s.replacingOccurrences(of: ",", with: ".").trimmingCharacters(in: .whitespaces)) }
    /// Champs du corps prêts à enregistrer, ou le message d'erreur
    func body() -> Result<[String: JSON], ProfileError> {
        var out: [String: JSON] = ["sex": sex.isEmpty ? .null : .str(sex), "birth_year": .null, "height_cm": .null, "weight_kg": .null]
        let year = Calendar.current.component(.year, from: Date())
        if !birth.trimmingCharacters(in: .whitespaces).isEmpty {
            guard let y = Self.num(birth).map({ Int($0.rounded()) }), y >= 1930, y <= year - 5 else { return .failure(.msg("Année de naissance à vérifier.")) }
            out["birth_year"] = .num(Double(y))
        }
        if !height.trimmingCharacters(in: .whitespaces).isEmpty {
            guard let h = Self.num(height), h >= 100, h <= 230 else { return .failure(.msg("Taille en centimètres, entre 100 et 230.")) }
            out["height_cm"] = .num(h.rounded())
        }
        if !weight.trimmingCharacters(in: .whitespaces).isEmpty {
            guard let w = Self.num(weight), w >= 25, w <= 200 else { return .failure(.msg("Poids en kilos, entre 25 et 200.")) }
            out["weight_kg"] = .num((w * 10).rounded() / 10)
        }
        return .success(out)
    }
}
enum ProfileError: Error { case msg(String) }

/// Sexe, naissance, taille, poids
struct BodyFields: View {
    @Binding var f: ProfileDraft
    var body: some View {
        Picker("Sexe", selection: $f.sex) {
            Text("—").tag("")
            ForEach(SEXES.indices, id: \.self) { i in Text(SEXES[i].1).tag(SEXES[i].0) }
        }
        numRow("Naissance", "année", $f.birth, .numberPad)
        numRow("Taille (cm)", "—", $f.height, .numberPad)
        numRow("Poids (kg)", "—", $f.weight, .decimalPad)
    }
    private func numRow(_ l: String, _ ph: String, _ b: Binding<String>, _ kb: UIKeyboardType) -> some View {
        HStack {
            Text(l)
            Spacer()
            TextField(ph, text: b).keyboardType(kb).multilineTextAlignment(.trailing).font(Typo.mono(16)).frame(maxWidth: 120)
        }
    }
}

/// Sports pratiqués (plusieurs choix) et régime alimentaire
struct SportsFields: View {
    @Binding var f: ProfileDraft
    var body: some View {
        let sports = Core.shared.constant("sports.SPORTS").array
        let diets = Core.shared.constant("sports.DIETS").array
        VStack(alignment: .leading, spacing: 8) {
            Text("Sports pratiqués").font(Typo.sans(14, .semibold)).foregroundStyle(Palette.muted)
            Flow(spacing: 6) {
                ForEach(sports.indices, id: \.self) { i in
                    let id = sports[i][0]?.string ?? ""
                    Chip(label: sports[i][1]?.string ?? id, on: f.sports.contains(id)) {
                        if f.sports.contains(id) { f.sports.removeAll { $0 == id } } else { f.sports.append(id) }
                    }
                }
            }
        }
        .padding(.vertical, 4)
        Picker("Régime", selection: $f.diet) {
            ForEach(diets.indices, id: \.self) { i in Text(diets[i][1]?.string ?? "").tag(diets[i][0]?.string ?? "") }
        }
    }
}

struct ProfilePage: View {
    @State private var store = Store.shared
    var body: some View {
        let athleteSide = store.role != "coach", coachSide = store.role == "coach" || store.role == "admin"
        Form {
            ProfileFormSections()
            if athleteSide {
                Section {
                    LevelsForm().padding(.vertical, 6)
                } header: { Text("Mon niveau · facultatif") } footer: {
                    Text("Sert aux cotations, charges et allures des programmes. Sans valeur, l’appli estime d’après tes tests et tes séances.")
                }
                NutriSettingsSection()
            }
            if !store.demo && athleteSide { MyCoachSection() }
            if !store.demo && coachSide { MyAthletesSection() }
        }
        .scrollContentBackground(.hidden).background(Palette.bg)
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Profil")
    }
}

private struct ProfileFormSections: View {
    @State private var store = Store.shared
    @State private var f = ProfileDraft()
    @State private var orig = ProfileDraft()
    @State private var loaded = false
    @State private var busy = false
    @State private var err: String?
    var body: some View {
        let coach = store.role == "coach"
        Section {
            HStack { Text("Prénom"); Spacer(); TextField("Prénom", text: $f.name).multilineTextAlignment(.trailing).textContentType(.givenName) }
            if !coach { BodyFields(f: $f) }
        } header: { Text(meHeader) } footer: {
            if !coach {
                Text((f.sex == "F" ? "Le suivi du cycle menstruel s’active : il ajoute le jour du cycle à la forme du matin (désactivable dans Paramètres). " : "") + "L’année de naissance adapte les repères de sommeil (8 à 10 h avant 18 ans). Le poids sert aux tests rapportés au poids de corps ; l’historique est gardé dans Suivi → Tests.")
            }
        }
        if !coach {
            Section {
                SportsFields(f: $f)
            } header: { Text("Sports et alimentation") } footer: {
                Text("Tes sports règlent les activités proposées après la séance, les types de séance, les tests et l’assistant de programme. Le régime sert aux conseils d’alimentation.")
            }
        }
        Section {
            if let err { Text(err).foregroundStyle(Palette.crit) }
            Button { Task { await save() } } label: {
                HStack { if busy { ProgressView() }; Text(busy ? "Enregistrement…" : "Enregistrer le profil").fontWeight(.semibold) }
            }
            .disabled(f == orig || busy)
        }
        .onAppear {
            guard !loaded else { return }
            loaded = true
            f = ProfileDraft(store.profile(Store.SELF)); orig = f
        }
    }
    private var meHeader: String {
        if store.demo { return "Moi" }
        let r: String = ROLE_LBL[store.role] ?? ""
        return "Moi · " + r
    }
    private func save() async {
        err = nil
        let name = f.name.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { err = "Le prénom ne peut pas être vide."; return }
        let coach = store.role == "coach"
        var patch: [String: JSON] = ["name": .str(String(name.prefix(40)))]
        if !coach {
            switch f.body() {
            case .failure(.msg(let m)): err = m; return
            case .success(let b): for (k, v) in b { patch[k] = v }
            }
            patch["sports"] = .arr(f.sports.map { .str($0) }); patch["diet"] = .str(f.diet)
        }
        busy = true; defer { busy = false }
        do {
            let wasW = store.profile(Store.SELF)["weight_kg"]?.double
            try await Account.saveProfile(patch)
            if !coach, let w = patch["weight_kg"]?.double, w != wasW { Core.shared.call("tests.logWeight", .num(w)) }
            orig = f
            Haptics.success(); toast("Profil enregistré")
        } catch { err = Account.fr(error) }
    }
}

/// Alimentation : chiffres, partage avec le coach, activité quotidienne, objectif de poids
private struct NutriSettingsSection: View {
    @State private var store = Store.shared
    var body: some View {
        let pr = Core.shared.call("nutrition.nutriPrefs", .str(Store.SELF)) ?? .emptyObject
        let under18 = store.profile(Store.SELF)["under18"]?.truthy ?? false
        let life = Core.shared.constant("nutrition.LIFE").array, goals = Core.shared.constant("nutrition.GOALS_W").array
        Section {
            Toggle(isOn: Binding(get: { pr["numbers"]?.truthy ?? true }, set: { set("numbers", .bool($0)) })) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Afficher les calories et les grammes")
                    Text(under18 ? "Masqués par défaut avant 18 ans : les repères restent visibles en mots" : "Sinon, seulement des repères en mots et des barres").font(.footnote).foregroundStyle(Palette.muted)
                }
            }
            if !store.coaches.isEmpty {
                Toggle(isOn: Binding(get: { pr["share"]?.truthy ?? false }, set: { v in
                    set("share", .bool(v))
                    if v { DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { Core.shared.call("nutrition.resendNutrition") } }
                })) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Partager avec mon coach")
                        Text("Repas et bilan de la semaine visibles par ton coach").font(.footnote).foregroundStyle(Palette.muted)
                    }
                }
            }
            Picker("En dehors du sport", selection: Binding(get: { pr["life"]?.string ?? "assis" }, set: { set("life", .str($0)) })) {
                ForEach(life.indices, id: \.self) { i in Text(life[i][1]?.string ?? "").tag(life[i][0]?.string ?? "") }
            }
            if !under18 {
                Picker("Objectif de poids", selection: Binding(get: { pr["goal"]?.string ?? "maintien" }, set: { set("goal", .str($0)) })) {
                    ForEach(goals.indices, id: \.self) { i in Text(goals[i][1]?.string ?? "").tag(goals[i][0]?.string ?? "") }
                }
            }
        } header: { Text("Alimentation") } footer: {
            if !under18 { Text("Perte : déficit modéré (300 à 500 kcal) et jamais sous le métabolisme de base ; prise : léger surplus.") }
        }
        .tint(Palette.accent)
    }
    private func set(_ k: String, _ v: JSON) {
        var n = store.profile(Store.SELF)["nutri"] ?? .emptyObject
        n[k] = v
        Core.shared.call("store.saveProfileDoc", ["nutri": n])
        Haptics.select()
    }
}

/// Athlète : son coach, les codes de partage
private struct MyCoachSection: View {
    @State private var store = Store.shared
    @State private var codes: [JSON] = []
    @State private var fresh: JSON?
    @State private var busy = false
    @State private var err: String?
    @State private var remove: String?
    var body: some View {
        Section {
            if store.coaches.isEmpty {
                Text("Aucun coach n’a accès à ton carnet.").foregroundStyle(Palette.muted)
            }
            ForEach(store.coaches, id: \.self) { c in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(store.name(c)).fontWeight(.semibold)
                        Text("Lit ton carnet, commente et peut modifier tes séances").font(.footnote).foregroundStyle(Palette.muted)
                    }
                    Spacer()
                    Button("Retirer", role: .destructive) { remove = c }.buttonStyle(.borderless)
                }
            }
            if store.myLock {
                Label("Ton coach a verrouillé ton plan : tu le consultes et tu remplis ton journal, mais seules ses modifications passent.", systemImage: "lock.fill")
                    .font(.footnote).foregroundStyle(Palette.muted)
            }
            if let fresh { CodeBox(code: fresh["code"]?.string ?? "") }
            if let err { Text(err).foregroundStyle(Palette.crit) }
            Button { Task { await gen() } } label: {
                Label(fresh != nil ? "Générer un autre code" : "Donner accès à un coach", systemImage: "key.fill")
            }
            .disabled(busy)
            let others = codes.filter { $0["code"]?.string != fresh?["code"]?.string }
            if !others.isEmpty {
                DisclosureGroup("Codes encore valables") {
                    ForEach(others.indices, id: \.self) { i in
                        let c = others[i]["code"]?.string ?? ""
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(Account.fmtCode(c)).font(Typo.mono(16, .semibold))
                                Text("jusqu’au " + until(others[i]["expires_at"]?.string)).font(.footnote).foregroundStyle(Palette.muted)
                            }
                            Spacer()
                            ShareLink(item: shareText(c)) { Image(systemName: "square.and.arrow.up") }.buttonStyle(.borderless)
                            Button("Annuler", role: .destructive) { Task { try? await Account.deleteCode(c); await load() } }.buttonStyle(.borderless)
                        }
                    }
                }
            }
        } header: { Text("Mon coach") } footer: {
            Text("Ton coach saisit le code dans son appli : il pourra lire ton carnet (forme, séances, tests), te laisser des retours et modifier tes séances. Tu peux lui retirer l’accès à tout moment.")
        }
        .task { await load() }
        .confirmationDialog(removeTitle, isPresented: Binding(get: { remove != nil }, set: { if !$0 { remove = nil } }), titleVisibility: .visible) {
            Button("Retirer", role: .destructive) {
                guard let c = remove, let me = store.me else { return }
                Task { do { try await Account.unlink(coach: c, athlete: me); toast("Accès retiré") } catch { toast(Account.fr(error)) } }
            }
        }
    }
    private var removeTitle: String {
        let n: String = store.name(remove ?? "")
        return "Retirer " + n + " ? Il n’aura plus accès à ton carnet."
    }
    private func load() async { codes = (try? await Account.myCodes()) ?? [] }
    private func gen() async {
        busy = true; err = nil
        do { fresh = try await Account.newCode(); Haptics.success(); await load() } catch { err = Account.fr(error) }
        busy = false
    }
    private func until(_ iso: String?) -> String {
        guard let ms = ISOTime.ms(iso ?? "") else { return "" }
        return D.day(D.key(Date(timeIntervalSince1970: ms / 1000)))
    }
}

func shareText(_ code: String) -> String {
    "Mon code Alipto : " + Account.fmtCode(code) + "\nÀ saisir dans Plus → Profil → Mes athlètes (valable 7 jours, une seule fois)."
}

private struct CodeBox: View {
    let code: String
    var body: some View {
        VStack(spacing: 8) {
            Text("Code à donner à ton coach").font(.footnote).foregroundStyle(Palette.muted)
            Text(Account.fmtCode(code)).font(Typo.mono(30, .bold)).foregroundStyle(Palette.ink).textSelection(.enabled)
            Text("Valable 7 jours, une seule utilisation").font(.footnote).foregroundStyle(Palette.muted)
            ShareLink(item: shareText(code)) { Label("Partager le code", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity) }
                .buttonStyle(.borderedProminent).tint(Palette.accent)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 8)
    }
}

/// Coach : ses athlètes (verrou du plan, retrait) et l'ajout d'un athlète avec son code
private struct MyAthletesSection: View {
    @State private var store = Store.shared
    @State private var busy = ""
    @State private var remove: String?
    var body: some View {
        Section {
            ForEach(store.athletes, id: \.self) { a in
                let locked = store.locks[a] ?? false
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(store.name(a)).fontWeight(.semibold)
                            Text(locked ? "Plan verrouillé : seules tes modifications passent" : "Non verrouillé : peut aussi modifier son plan").font(.footnote).foregroundStyle(Palette.muted)
                        }
                        Spacer()
                        Button("Retirer", role: .destructive) { remove = a }.buttonStyle(.borderless).disabled(busy == a)
                    }
                    Toggle("Verrouiller son plan", isOn: Binding(get: { locked }, set: { v in setLock(a, v) })).tint(Palette.accent).disabled(busy == a)
                }
                .padding(.vertical, 4)
            }
            AddAthleteRow()
        } header: { Text("Mes athlètes" + (store.athletes.isEmpty ? "" : " · \(store.athletes.count)")) } footer: {
            Text("Demande à ton athlète son code : Plus → Profil → Mon coach → Donner accès à un coach. Verrouiller : l’athlète ne peut plus modifier ses séances ni son plan (son journal reste à lui).")
        }
        .confirmationDialog(removeTitle, isPresented: Binding(get: { remove != nil }, set: { if !$0 { remove = nil } }), titleVisibility: .visible) {
            Button("Retirer", role: .destructive) {
                guard let a = remove, let me = store.me else { return }
                busy = a
                Task {
                    do { try await Account.unlink(coach: me, athlete: a); if store.subject == a { store.subject = Store.SELF }; toast("Athlète retiré") } catch { toast(Account.fr(error)) }
                    busy = ""
                }
            }
        }
    }
    private var removeTitle: String {
        let n: String = store.name(remove ?? "")
        return "Retirer " + n + " de tes athlètes ? Tu n’auras plus accès à son carnet."
    }
    private func setLock(_ a: String, _ v: Bool) {
        busy = a
        Task {
            do { try await store.setLock(a, v); Haptics.success(); toast(v ? "Plan verrouillé" : "Plan déverrouillé") } catch { toast(Account.fr(error)) }
            busy = ""
        }
    }
}

/// Saisie du code d'un athlète
struct AddAthleteRow: View {
    @State private var code = ""
    @State private var busy = false
    @State private var err: String?
    @State private var store = Store.shared
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                TextField("Code de l’athlète (ABCD-EFGH)", text: $code)
                    .font(Typo.mono(17)).textInputAutocapitalization(.characters).autocorrectionDisabled()
                    .onChange(of: code) { _, v in let u = v.uppercased(); if u != v { code = u } }
                Button("Ajouter") { Task { await go() } }
                    .buttonStyle(.borderedProminent).tint(Palette.accent)
                    .disabled(busy || code.filter { $0.isLetter || $0.isNumber }.count < 8)
            }
            if let err { Text(err).font(.footnote).foregroundStyle(Palette.crit) }
        }
    }
    private func go() async {
        busy = true; err = nil
        do {
            let a = try await Account.redeem(code)
            code = ""
            Haptics.success(); toast((a.map { store.name($0) } ?? "Athlète") + " ajouté·e")
            if let a { store.subject = a }
        } catch { err = Account.fr(error) }
        busy = false
    }
}
