import SwiftUI

// Administration (compte administrateur, comme la version web) : créer des comptes, changer un rôle, gérer l'accès, supprimer.
// L'administrateur ne lit pas le carnet des autres : seulement celui des athlètes dont il est le coach.

private func whenTxt(_ iso: String?) -> String {
    guard let iso, let ms = ISOTime.ms(iso) else { return "jamais" }
    let k = D.key(Date(timeIntervalSince1970: ms / 1000))
    return D.day(k) + " " + String(k.prefix(4))
}
private func welcome(_ email: String, _ pw: String) -> String {
    "Ton compte Alipto est prêt.\nAdresse : " + Config.webURL.absoluteString + "\nEmail : " + email + "\nMot de passe provisoire : " + pw + "\nSur iPhone : installe l’appli Alipto ou ouvre l’adresse dans Safari. Change ton mot de passe dans Plus → Paramètres → Compte."
}

struct AdminPage: View {
    @State private var users: [JSON]?
    @State private var err: String?
    @State private var sel: JSON?
    @State private var store = Store.shared
    var body: some View {
        Form {
            Section {
                Text("Les inscriptions sont fermées : les comptes se créent ici. Tu gères les rôles et les accès, sans lire les carnets des autres (sauf ceux dont tu es le coach).")
                    .font(.footnote).foregroundStyle(Palette.muted)
            }
            .listRowBackground(Color.clear)
            CreateAccountSection { Task { await load() } }
            Section {
                if let err { Text(err).foregroundStyle(Palette.crit) }
                if users == nil && err == nil { ProgressView().frame(maxWidth: .infinity) }
                ForEach((users ?? []).indices, id: \.self) { i in
                    let u = (users ?? [])[i]
                    Button { sel = u } label: { UserLine(u: u) }
                }
            } header: { Text(header) }
        }
        .scrollContentBackground(.hidden).background(Palette.bg)
        .navigationTitle("Administration")
        .tint(Palette.accent)
        .task { await load() }
        .refreshable { await load() }
        .sheet(item: Binding(get: { sel.map { UserRef(u: $0) } }, set: { sel = $0?.u })) { r in
            UserSheet(u: r.u) { Task { await load() } }
        }
    }
    private var header: String {
        guard let users else { return "Comptes" }
        let a = users.filter { $0["role"]?.string == "athlete" }.count, c = users.filter { $0["role"]?.string == "coach" }.count
        return "Comptes · \(users.count) · " + Fmt.plural(a, "athlète") + ", " + Fmt.plural(c, "coach", "coachs")
    }
    private func load() async {
        do { users = try await Account.adminUsers(); err = nil } catch { err = Account.fr(error) }
        if let s = sel, let id = s["id"]?.string { sel = users?.first { $0["id"]?.string == id } }
    }
}

private struct UserRef: Identifiable { let u: JSON; var id: String { (u["id"]?.string ?? "") + (u["role"]?.string ?? "") } }

private struct UserLine: View {
    let u: JSON
    @State private var store = Store.shared
    var body: some View {
        let id = u["id"]?.string ?? "", role = u["role"]?.string ?? "athlete"
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text((u["name"]?.string.flatMap { $0.isEmpty ? nil : $0 } ?? "Profil à remplir") + (id == store.me ? " (toi)" : ""))
                    .fontWeight(.semibold).foregroundStyle(Palette.ink)
                Text(detail(id, role)).font(.footnote).foregroundStyle(Palette.muted)
            }
            Spacer()
            Text(ROLE_LBL[role] ?? role).font(Typo.sans(12, .semibold)).foregroundStyle(role == "admin" ? Palette.crit : role == "coach" ? Palette.accent : Palette.muted)
                .padding(.horizontal, 8).padding(.vertical, 3).background(Palette.sunk, in: Capsule())
        }
    }
    private func detail(_ id: String, _ role: String) -> String {
        var s = u["email"]?.string ?? ""
        if role == "coach" { s += " · " + Fmt.plural(u["athletes"]?.int ?? 0, "athlète") }
        else if let c = u["coaches"]?.int, c > 0 { s += " · " + Fmt.plural(c, "coach", "coachs") }
        else { s += " · sans coach" }
        if store.athletes.contains(id) { s += " · tu le suis" }
        return s
    }
}

private struct CreateAccountSection: View {
    let onDone: () -> Void
    @State private var email = ""
    @State private var name = ""
    @State private var pw = Account.tempPassword()
    @AppStorage("alipto-admin-mode") private var mode = "pw"
    @State private var role = "athlete"
    @State private var mine = true
    @State private var busy = false
    @State private var err: String?
    @State private var made: (String, String?)?
    var body: some View {
        Section {
            if let made {
                if let p = made.1 {
                    LabeledContent("Email", value: made.0)
                    LabeledContent("Mot de passe provisoire") { Text(p).font(Typo.mono(16, .semibold)).textSelection(.enabled) }
                    ShareLink(item: welcome(made.0, p)) { Label("Partager les accès", systemImage: "square.and.arrow.up") }
                } else {
                    Label("Invitation envoyée à " + made.0, systemImage: "envelope.badge")
                    Text("La personne reçoit un e-mail avec un lien pour choisir son mot de passe, puis remplit son profil. Pense à vérifier ses spams.").font(.footnote).foregroundStyle(Palette.muted)
                }
                Button("Nouveau compte") { self.made = nil }
            } else {
                TextField("Email", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                TextField("Prénom (facultatif)", text: $name)
                Picker("Accès", selection: $mode) { Text("Mot de passe provisoire").tag("pw"); Text("Invitation par e-mail").tag("invite") }
                if mode == "pw" {
                    HStack {
                        TextField("Mot de passe provisoire", text: $pw).font(Typo.mono(16)).autocorrectionDisabled().textInputAutocapitalization(.never)
                        Button("Autre") { pw = Account.tempPassword() }.buttonStyle(.borderless)
                    }
                }
                Picker("Rôle", selection: $role) { Text("Athlète").tag("athlete"); Text("Coach").tag("coach"); Text("Au choix").tag("free") }
                if role != "coach" { Toggle("Je suis son coach", isOn: $mine) }
                if let err { Text(err).foregroundStyle(Palette.crit) }
                Button { Task { await go() } } label: {
                    HStack { if busy { ProgressView() }; Text(busy ? "Création…" : mode == "invite" ? "Créer et envoyer l’invitation" : "Créer le compte").fontWeight(.semibold) }
                }
                .disabled(busy || email.range(of: #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#, options: .regularExpression) == nil || (mode == "pw" && pw.count < 8))
            }
        } header: { Text("Créer un compte") } footer: {
            if made == nil { Text(footer) }
        }
    }
    private var footer: String {
        let a: String = mode == "invite" ? "Un e-mail part tout de suite : la personne choisit elle-même son mot de passe. " : "Tu envoies toi-même l’email et le mot de passe provisoire (message privé). "
        let b: String
        switch role {
        case "free": b = "La personne choisira athlète ou coach à sa première connexion."
        case "coach": b = "Un coach n’a pas de carnet : il suit des athlètes avec leur code."
        default: b = "« Je suis son coach » : tu as accès à son carnet tout de suite, sans code."
        }
        return a + b
    }
    private func go() async {
        busy = true; err = nil
        let invite = mode == "invite"
        var body: [String: JSON] = ["action": "create", "email": .str(email.trimmingCharacters(in: .whitespaces)), "invite": .bool(invite),
                                    "role": role == "free" ? .null : .str(role), "name": .str(name.trimmingCharacters(in: .whitespaces)), "linkMe": .bool(mine && role != "coach")]
        if !invite { body["password"] = .str(pw) }
        do {
            let r = try await Account.adminFn(body)
            made = (r["email"]?.string ?? email.trimmingCharacters(in: .whitespaces), invite ? nil : pw)
            email = ""; name = ""; pw = Account.tempPassword()
            Haptics.success(); onDone()
            if mine && role != "coach" { await Store.shared.syncNow() }
        } catch { err = Account.fr(error) }
        busy = false
    }
}

private struct UserSheet: View {
    let u: JSON
    let onChange: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var store = Store.shared
    @State private var busy = false
    @State private var err: String?
    @State private var pw: String?
    @State private var askRole: String?
    @State private var askDelete = false
    var body: some View {
        let id = u["id"]?.string ?? "", me = id == store.me, linked = store.athletes.contains(id), role = u["role"]?.string ?? "athlete"
        let who = u["name"]?.string.flatMap { $0.isEmpty ? nil : $0 } ?? (u["email"]?.string ?? "")
        NavigationStack {
            Form {
                Section {
                    Text(info()).font(.footnote).foregroundStyle(Palette.muted)
                }
                Section {
                    Picker("Rôle", selection: Binding(get: { role }, set: { v in if v != role { askRole = v } })) {
                        Text("Athlète").tag("athlete"); Text("Coach").tag("coach"); Text("Admin").tag("admin")
                    }
                    .pickerStyle(.segmented)
                    .disabled(me)
                } header: { Text("Rôle") } footer: { if me { Text("C’est ton compte : il reste administrateur.") } }
                if !me && role != "coach" {
                    Section {
                        Button(linked ? "Ne plus être son coach" : "Devenir son coach") {
                            act({ try await Account.adminLink(coach: store.me ?? "", athlete: id, linked: !linked); await store.syncNow() }, linked ? "Lien retiré" : "Tu es maintenant son coach")
                        }
                    } header: { Text("Accès à son carnet") } footer: {
                        Text(linked ? "Tu es son coach : tu lis son carnet et tu peux modifier ses séances." : "Tu n’as pas accès à son carnet. En te liant comme coach, tu le verras dans Athlètes.")
                    }
                }
                if !me {
                    Section {
                        if let pw {
                            LabeledContent("Nouveau mot de passe provisoire") { Text(pw).font(Typo.mono(16, .semibold)).textSelection(.enabled) }
                            ShareLink(item: pwText(pw)) { Label("Partager", systemImage: "square.and.arrow.up") }
                        } else {
                            Button("Envoyer un e-mail de réinitialisation") { act({ _ = try await Account.adminFn(["action": "recover", "id": .str(id)]) }, "E-mail de réinitialisation envoyé") }
                            Button("Mot de passe provisoire") {
                                let p = Account.tempPassword()
                                act({ _ = try await Account.adminFn(["action": "password", "id": .str(id), "password": .str(p)]); pw = p }, "Mot de passe redéfini")
                            }
                        }
                    } header: { Text("Mot de passe") } footer: {
                        if pw == nil { Text("En cas d’oubli : un e-mail avec un lien pour choisir un nouveau mot de passe, ou un mot de passe provisoire que tu lui transmets.") }
                    }
                    Section {
                        Button("Supprimer le compte…", role: .destructive) { askDelete = true }
                    } footer: { Text("Efface le compte et toutes ses données (plan, journal, tests, messages). Irréversible.") }
                }
                if let err { Section { Text(err).foregroundStyle(Palette.crit) } }
            }
            .scrollContentBackground(.hidden).background(Palette.bg)
            .disabled(busy)
            .navigationTitle(who).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("OK") { dismiss() }.fontWeight(.semibold) } }
            .confirmationDialog(roleQuestion(who), isPresented: Binding(get: { askRole != nil }, set: { if !$0 { askRole = nil } }), titleVisibility: .visible) {
                Button("Changer le rôle") {
                    guard let r = askRole else { return }
                    act({ try await Account.adminSetRole(id, r); await store.syncNow() }, "Rôle changé")
                }
            }
            .confirmationDialog("Supprimer définitivement le compte de " + who + " ?", isPresented: $askDelete, titleVisibility: .visible) {
                Button("Supprimer", role: .destructive) {
                    act({ _ = try await Account.adminFn(["action": "delete", "id": .str(id)]); await store.syncNow(); dismiss() }, "Compte supprimé")
                }
            }
        }
    }
    private func pwText(_ pw: String) -> String {
        let e: String = u["email"]?.string ?? ""
        return "Nouveau mot de passe Alipto pour " + e + " : " + pw + "\nChange-le dans Plus → Paramètres → Compte."
    }
    private func info() -> String {
        var s: String = u["email"]?.string ?? ""
        s += " · créé le " + whenTxt(u["created_at"]?.string)
        s += " · dernière connexion : " + whenTxt(u["last_sign_in_at"]?.string)
        if !(u["onboarded"]?.truthy ?? false) { s += " · profil pas encore rempli" }
        return s
    }
    private func roleQuestion(_ who: String) -> String {
        guard let r = askRole else { return "" }
        let tail = r == "athlete" ? " Ses liens de coach seront retirés." : r == "coach" ? " Ses coachs perdront l’accès à son carnet." : " Il aura accès à l’administration."
        let rl: String = (ROLE_LBL[r] ?? r).lowercased()
        return "Passer " + who + " en " + rl + " ?" + tail
    }
    private func act(_ f: @escaping () async throws -> Void, _ ok: String) {
        busy = true; err = nil
        Task { @MainActor in
            do { try await f(); toast(ok); Haptics.success(); onChange() } catch { err = Account.fr(error) }
            busy = false
        }
    }
}
