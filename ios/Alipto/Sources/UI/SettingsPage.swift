import SwiftUI
import UniformTypeIdentifiers
import UserNotifications

// Plus → Paramètres (comme la version web) : apparence, séance, suivi, Apple Santé, rappels, compte, données.

struct SettingsPage: View {
    @State private var store = Store.shared
    var body: some View {
        let athleteSide = store.role != "coach"
        Form {
            AppearanceSection()
            if athleteSide { SessionPrefsSection(); TrackingSection() }
            if athleteSide && Health.shared.available { HealthSection() }
            if athleteSide { WhoopSection() }
            RemindersSection()
            AccountSection()
            DataSection()
            Section {
                Text("Alipto pour iPhone · version " + (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"))
                    .font(Typo.mono(12)).foregroundStyle(Palette.muted).frame(maxWidth: .infinity)
            }
            .listRowBackground(Color.clear)
        }
        .scrollContentBackground(.hidden).background(Palette.bg)
        .navigationTitle("Paramètres")
        .tint(Palette.accent)
    }
}

/// Réglage du carnet (document « settings », partagé avec la version web)
private func setting(_ k: String) -> JSON? { Store.shared.get("settings", owner: Store.SELF)?[k] }
private func setSettings(_ patch: [String: JSON]) {
    Core.shared.call("store.setSettings", .obj(patch))
    Haptics.select()
}

private struct AppearanceSection: View {
    @AppStorage("theme") private var theme = "system"
    var body: some View {
        Section {
            Picker("Thème", selection: $theme) {
                Text("Système").tag("system"); Text("Clair").tag("light"); Text("Sombre").tag("dark")
            }
            .pickerStyle(.segmented)
        } header: { Text("Apparence") } footer: {
            Text("« Système » suit le réglage de l’iPhone (clair le jour, sombre le soir s’il est en automatique).")
        }
    }
}

private struct SettingToggle: View {
    let key: String
    let title: String
    let sub: String
    var def = true
    var body: some View {
        Toggle(isOn: Binding(get: { setting(key)?.bool ?? def }, set: { setSettings([key: .bool($0)]) })) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                Text(sub).font(.footnote).foregroundStyle(Palette.muted)
            }
        }
    }
}

private struct SessionPrefsSection: View {
    @State private var store = Store.shared
    var body: some View {
        let _ = store.version
        Section("Pendant la séance") {
            SettingToggle(key: "sound", title: "Sons", sub: "Bips de départ, de fin de repos et décompte 3-2-1. Les vibrations restent.")
            SettingToggle(key: "voice", title: "Voix", sub: "Annonce « Main droite », « Repos »… pendant les minuteurs")
            SettingToggle(key: "wake", title: "Écran toujours allumé", sub: "En mode séance uniquement")
        }
    }
}

private struct TrackingSection: View {
    @State private var store = Store.shared
    var body: some View {
        let female = store.profile(Store.SELF)["sex"]?.string == "F"
        Section("Suivi") {
            SettingToggle(key: "cycle", title: "Cycle menstruel", sub: "Ajoute le jour du cycle à la forme du matin" + (female ? " · actif d’office avec un profil femme" : ""), def: female)
        }
    }
}

/// Apple Santé : la nuit, la VFC et la FC de repos dans la carte Sommeil
private struct HealthSection: View {
    @State private var health = Health.shared
    @State private var auto = Health.shared.auto
    var body: some View {
        Section {
            Toggle(isOn: $auto) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Remplir la nuit tout seul")
                    Text("À chaque ouverture de l’appli, sans écraser ce que tu as noté à la main.").font(.footnote).foregroundStyle(Palette.muted)
                }
            }
            .onChange(of: auto) { _, v in
                health.auto = v
                if v { Task { _ = await health.requestAccess(); _ = await health.importNight(D.today) } }
            }
            Button {
                Task {
                    let ok = await health.importNight(D.today, overwrite: true)
                    toast(ok ? "Nuit importée" : "Rien dans Apple Santé pour cette nuit")
                }
            } label: {
                HStack {
                    if health.busy { ProgressView() }
                    Text(health.asked ? "Importer la nuit dernière" : "Autoriser et importer la nuit dernière")
                }
            }
        } header: {
            Label("Apple Santé", systemImage: "heart.fill")
        } footer: {
            Text("Ta nuit (durée et phases), ta VFC et ta fréquence cardiaque de repos remplissent la carte Sommeil et la lecture du jour ; tes séances (durée, distance, FC moyenne) préremplissent « Après la séance ». Rien n’est écrit dans Santé.")
        }
    }
}

/// Whoop : récupération, VFC, FC de repos, sommeil et séances (lus par la fonction Supabase « whoop »)
private struct WhoopSection: View {
    @State private var whoop = Whoop.shared
    @State private var confirm = false
    var body: some View {
        Section {
            if whoop.connected {
                LabeledContent("Dernière synchro") { Text(whoop.lastSync.map { $0.formatted(date: .abbreviated, time: .shortened) } ?? "jamais").foregroundStyle(Palette.muted) }
                Button {
                    Task {
                        let n = await whoop.sync(days: 7, quiet: false)
                        if whoop.error == nil { toast(n > 0 ? "Whoop : \(n) jour" + (n > 1 ? "s" : "") + " mis à jour" : "Whoop : rien de nouveau") }
                    }
                } label: { HStack { if whoop.busy { ProgressView() }; Text("Synchroniser maintenant") } }
                Button("Déconnecter Whoop", role: .destructive) { confirm = true }
            } else {
                Button { Task { await whoop.connect() } } label: { HStack { if whoop.busy { ProgressView() }; Text("Connecter Whoop") } }
                    .disabled(whoop.busy || !whoop.configured)
                if !whoop.configured && whoop.error == nil { Text("Whoop n’est pas encore activé sur le serveur.").font(.footnote).foregroundStyle(Palette.muted) }
            }
            if let e = whoop.error { Text(e).font(.footnote).foregroundStyle(Palette.crit) }
        } header: {
            Label("Whoop", systemImage: "waveform.path.ecg")
        } footer: {
            Text("Ta récupération, ta VFC, ta FC de repos, ton sommeil et tes séances remplissent la forme du matin et « Après la séance ». Ce que tu as noté à la main n’est jamais écrasé, et tu peux couper l’accès à tout moment. Si Apple Santé et Whoop donnent la même nuit, Whoop passe devant.")
        }
        .task { await whoop.refresh() }
        .confirmationDialog("Déconnecter Whoop ?", isPresented: $confirm, titleVisibility: .visible) {
            Button("Déconnecter", role: .destructive) { Task { await whoop.disconnect() } }
        } message: { Text("Les données déjà importées restent dans ton carnet.") }
    }
}

/// Rappel du matin et bilan du dimanche (notifications de l'iPhone)
private struct RemindersSection: View {
    @State private var store = Store.shared
    @State private var status: UNAuthorizationStatus = .notDetermined
    var body: some View {
        let _ = store.version
        let athlete = store.hasCarnet
        let rm = setting("remind") ?? .emptyObject
        let on = rm["on"]?.truthy ?? false
        Section {
            if athlete {
                Toggle(isOn: Binding(get: { on }, set: { v in setRemind(["on": .bool(v), "at": rm["at"] ?? "08:00"]) })) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Rappel de la forme du matin")
                        Text("Seulement si elle n’est pas encore remplie").font(.footnote).foregroundStyle(Palette.muted)
                    }
                }
                if on {
                    DatePicker("Heure du rappel", selection: Binding(get: { timeDate(rm["at"]?.string ?? "08:00") }, set: { d in
                        setRemind(["on": true, "at": .str(timeKey(d))])
                    }), displayedComponents: .hourAndMinute)
                }
            }
            Toggle(isOn: Binding(get: { setting("weekly")?.bool ?? true }, set: { v in
                setSettings(["weekly": .bool(v), "tz": .str(TimeZone.current.identifier)])
                after(v)
            })) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Bilan de la semaine")
                    Text("Le dimanche à 19 h" + (store.athletes.isEmpty ? " : séances, charge, records et semaine suivante" : athlete ? " : le tien et celui de tes athlètes" : " : les séances de tes athlètes"))
                        .font(.footnote).foregroundStyle(Palette.muted)
                }
            }
            if status == .denied {
                Button("Autoriser dans les Réglages de l’iPhone") {
                    if let u = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(u) }
                }
            }
        } header: { Text("Notifications") } footer: {
            Text(status == .denied ? "Les notifications sont refusées pour Alipto : Réglages de l’iPhone → Notifications → Alipto." : "Les rappels partent de ton iPhone, même hors connexion. Les mêmes réglages servent à la version web.")
        }
        .task { status = await Reminders.status() }
    }
    private func setRemind(_ r: JSON) {
        setSettings(["remind": r, "tz": .str(TimeZone.current.identifier)])
        after(r["on"]?.truthy ?? false)
    }
    private func after(_ enabled: Bool) {
        Task { @MainActor in
            if enabled { _ = await Reminders.requestAuth() }
            status = await Reminders.status()
            Reminders.reschedule()
        }
    }
    private func timeDate(_ s: String) -> Date {
        let p = s.split(separator: ":").compactMap { Int($0) }
        return Calendar.current.date(bySettingHour: p.first ?? 8, minute: p.count > 1 ? p[1] : 0, second: 0, of: Date()) ?? Date()
    }
    private func timeKey(_ d: Date) -> String {
        let c = Calendar.current.dateComponents([.hour, .minute], from: d)
        return String(format: "%02d:%02d", c.hour ?? 8, c.minute ?? 0)
    }
}

private struct AccountSection: View {
    @State private var store = Store.shared
    @State private var pw = false
    @State private var out = false
    var body: some View {
        Section {
            if store.demo {
                Text("Mode démo : rien n’est envoyé.").foregroundStyle(Palette.muted)
            } else {
                LabeledContent("E-mail", value: Backend.shared.session?.email ?? "—")
                LabeledContent("Rôle", value: ROLE_LBL[store.role] ?? "—")
                HStack {
                    Circle().fill(syncColor).frame(width: 9, height: 9)
                    Text(syncText).font(.callout).foregroundStyle(Palette.muted)
                }
                if let e = store.lastError, store.phase == .error { Text(e).font(.footnote).foregroundStyle(Palette.crit) }
                Button {
                    Task { await store.syncNow(); toast(store.phase == .idle ? "À jour" : "Pas de connexion") }
                } label: {
                    HStack { if store.phase == .syncing { ProgressView() }; Text("Synchroniser maintenant") }
                }
                .disabled(store.phase == .syncing)
                Button("Changer de mot de passe") { pw = true }
                Button("Se déconnecter", role: .destructive) { out = true }
            }
        } header: { Text("Compte") } footer: {
            if !store.demo && store.role != "admin" { Text("Le rôle ne se change pas ici : seul l’administrateur peut le modifier.") }
        }
        .sheet(isPresented: $pw) { PasswordSheet() }
        .confirmationDialog("Se déconnecter ?", isPresented: $out, titleVisibility: .visible) {
            Button("Se déconnecter", role: .destructive) {
                Backend.shared.signOut(); Store.shared.wipe(); AppState.shared.signedIn = false
            }
        } message: {
            Text(store.pending > 0 ? "\(store.pending) modification(s) pas encore envoyée(s) seront perdues." : "Tes données restent sur ton compte.")
        }
    }
    private var syncColor: Color {
        switch store.phase { case .idle: return Palette.good; case .syncing: return Palette.accent; case .offline, .local: return Palette.warn; default: return Palette.crit }
    }
    private var syncText: String {
        switch store.phase {
        case .syncing: return "Synchronisation…"
        case .offline: return "Hors connexion : tout part dès le retour du réseau."
        case .signedout: return "Session expirée : reconnecte-toi."
        case .error: return "La dernière synchronisation a échoué."
        default:
            let when = store.lastSync.map { "À jour · " + $0.formatted(date: .omitted, time: .shortened) } ?? "Pas encore synchronisé"
            return store.pending > 0 ? when + " · \(store.pending) en attente" : when
        }
    }
}

private struct PasswordSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var pw = ""
    @State private var pw2 = ""
    @State private var msg: String?
    @State private var busy = false
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    SecureField("Nouveau mot de passe", text: $pw).textContentType(.newPassword)
                    SecureField("Confirmer", text: $pw2).textContentType(.newPassword)
                } footer: { Text("8 caractères minimum.") }
                if let msg { Section { Text(msg).foregroundStyle(Palette.crit) } }
            }
            .scrollContentBackground(.hidden).background(Palette.bg)
            .navigationTitle("Mot de passe").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Annuler") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) { Button("Changer") { Task { await change() } }.fontWeight(.semibold).disabled(busy) }
            }
        }
    }
    private func change() async {
        guard pw.count >= 8 else { msg = "8 caractères minimum."; return }
        guard pw == pw2 else { msg = "Les deux mots de passe ne correspondent pas."; return }
        busy = true; defer { busy = false }
        do { try await Account.changePassword(pw); Haptics.success(); toast("Mot de passe changé"); dismiss() }
        catch { msg = Account.fr(error) }
    }
}

/// Sauvegarde, import, suppression
private struct DataSection: View {
    @State private var store = Store.shared
    @State private var share: URL?
    @State private var picking = false
    @State private var pending: JSON?
    @State private var err: String?
    @State private var wipe = false
    var body: some View {
        let selfView = store.isSelf, who = store.name(store.subject)
        if store.hasCarnet || !selfView {
            Section {
                Button { export() } label: { Label("Exporter une sauvegarde (.json)", systemImage: "square.and.arrow.up") }
                Button { picking = true } label: { Label("Importer un fichier" + (selfView ? "" : " dans le carnet de " + who), systemImage: "square.and.arrow.down") }
                if let err { Text(err).foregroundStyle(Palette.crit) }
                if selfView && !store.demo {
                    Button("Supprimer toutes mes données", role: .destructive) { wipe = true }
                }
            } header: { Text("Données" + (selfView ? "" : " · carnet de " + who)) } footer: {
                Text("La sauvegarde contient le plan, le journal et les tests du carnet affiché. Les données sont stockées en ligne dans un espace privé : seuls toi et ton coach y avez accès." + (selfView ? "" : " En important pour ton athlète, son journal déjà rempli n’est jamais écrasé."))
            }
            .sheet(item: Binding(get: { share.map { ShareURL(url: $0) } }, set: { share = $0?.url })) { s in ActivitySheet(items: [s.url]).ignoresSafeArea() }
            .sheet(item: Binding(get: { pending.map { ImportRef(j: $0) } }, set: { pending = $0?.j })) { r in
                ImportConfirm(r: r.j) { pending = nil }.presentationDetents([.medium]).presentationDragIndicator(.visible)
            }
            .fileImporter(isPresented: $picking, allowedContentTypes: [.json]) { res in read(res) }
            .confirmationDialog("Supprimer définitivement ton plan, ton journal et tes tests, ici et en ligne ? Exporte une sauvegarde avant.", isPresented: $wipe, titleVisibility: .visible) {
                Button("Tout supprimer", role: .destructive) { Core.shared.call("store.removeAllMine"); toast("Données supprimées") }
            }
        }
    }
    private func export() {
        guard let data = Core.shared.call("store.exportAll", .str(store.subject)) else { toast("Export impossible"); return }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("alipto-" + D.today + ".json")
        do { try data.encoded().write(to: url, options: .atomic); share = url } catch { toast("Export impossible") }
    }
    private func read(_ res: Result<URL, Error>) {
        err = nil
        guard case .success(let url) = res else { return }
        let ok = url.startAccessingSecurityScopedResource()
        defer { if ok { url.stopAccessingSecurityScopedResource() } }
        guard let txt = try? String(contentsOf: url, encoding: .utf8) else { err = "Fichier illisible."; return }
        if let r = Core.shared.call("extra.readImportText", .str(txt)) { pending = r }
        else { err = (Core.shared.lastError ?? "Ce fichier ne vient pas d’Alipto.").replacingOccurrences(of: "Error: ", with: "") }
    }
}

private struct ShareURL: Identifiable { let url: URL; var id: String { url.absoluteString } }
private struct ImportRef: Identifiable { let j: JSON; var id: Int { j.hashValue } }

/// Feuille de partage de l'iPhone
struct ActivitySheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: items, applicationActivities: nil) }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}

private struct ImportConfirm: View {
    let r: JSON
    let onDone: () -> Void
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        let n = r["n"] ?? .emptyObject, sk = r["skipped"] ?? .emptyObject, patch = r["patch"]
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    if let patch {
                        Text(patch["title"]?.string ?? "Modification du programme").font(Typo.sans(17, .semibold))
                        Text(patchText(n, patch)).font(Typo.sans(14.5)).foregroundStyle(Palette.muted)
                        Text("Le reste du plan et ton journal ne changent pas. Les séances passées non plus.").font(Typo.sans(14)).foregroundStyle(Palette.muted)
                    } else {
                        Text(fullText(n)).font(Typo.sans(16, .medium))
                        Text("Les jours déjà présents ici sont remplacés par ceux du fichier.").font(Typo.sans(14)).foregroundStyle(Palette.muted)
                    }
                    if let j = sk["journal"]?.int, j > 0 {
                        Text("\(j) jour(s) de journal déjà rempli(s) par l’athlète : conservé(s) tel(s) quel(s).").font(Typo.sans(13.5)).foregroundStyle(Palette.muted)
                    }
                    if (sk["plan"]?.int ?? 0) > 0 {
                        Text("Ton plan est verrouillé par ton coach : le plan et les séances du fichier ne seront pas importés.").font(Typo.sans(13.5)).foregroundStyle(Palette.warn)
                    }
                }
                .padding(16).frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Palette.bg)
            .navigationTitle("Importer").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Annuler") { onDone(); dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(patch != nil ? "Appliquer" : "Importer") {
                        Core.shared.call("extra.applyImport", r["docs"] ?? .emptyObject)
                        Haptics.success(); toast(patch != nil ? "Programme modifié" : "Import terminé")
                        onDone(); dismiss()
                    }
                    .fontWeight(.semibold)
                    .disabled(patch != nil && (n["days"]?.int ?? 0) == 0)
                }
            }
        }
    }
    private func patchText(_ n: JSON, _ patch: JSON) -> String {
        let d = n["days"]?.int ?? 0
        guard d > 0 else { return "Aucune séance à venir n’est concernée (ou la modification est déjà en place)." }
        let a = n["first"]?.string ?? "", b = n["last"]?.string ?? ""
        let when = a == b ? "le " + D.day(a) : "du " + D.day(a) + " au " + D.day(b)
        let what = patch["what"]?.array.compactMap { $0.string }.joined(separator: ", ") ?? ""
        return Fmt.plural(d, "séance") + " à venir modifiée" + (d > 1 ? "s" : "") + " (" + when + "). Exercices concernés : " + what + "."
    }
    private func fullText(_ n: JSON) -> String {
        var s = (n["plan"]?.truthy ?? false) ? "Plan, " : ""
        s += "\(n["days"]?.int ?? 0) jours de séances, \(n["journal"]?.int ?? 0) jours de journal"
        if let t = n["tests"]?.int, t > 0 { s += ", \(t) passations de tests" }
        return s + "."
    }
}
