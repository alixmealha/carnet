import SwiftUI

// Premier lancement (comme la version web) : prénom, rôle (si le compte n'en a pas), corps, sports.
// Puis, pour un profil créé avant l'ajout des sports, une seule question sur les sports.

struct ProfileSetupView: View {
    @State private var store = Store.shared
    @State private var step = 0
    @State private var f = ProfileDraft()
    @State private var role: String?
    @State private var err: String?
    @State private var busy = false
    @State private var loaded = false

    private var preset: String? { store.myRow?["role"]?.string }
    private var steps: [String] {
        var s = ["name"]
        if preset == nil { s.append("role") }
        if (role ?? preset) != "coach" { s += ["body", "sports"] }
        return s
    }
    private var cur: String { steps[min(step, steps.count - 1)] }
    private var last: Bool { step >= steps.count - 1 }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if step == 0 { LogoMark().frame(width: 52, height: 52).padding(.top, 30) }
                Eyebrow("Premier lancement · \(step + 1)/\(steps.count)")
                Group { content }
                    .id(cur)
                    .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity), removal: .opacity))
                if let err { Text(err).font(Typo.sans(14.5, .medium)).foregroundStyle(Palette.crit) }
                HStack(spacing: 10) {
                    if step > 0 { Button("Retour") { err = nil; withAnimation(.spring(response: 0.4, dampingFraction: 0.88)) { step -= 1 } }.buttonStyle(BigButton(kind: .plain)).frame(maxWidth: 130) }
                    Button { Task { await next() } } label: {
                        HStack { if busy { ProgressView().tint(Palette.accentInk) }; Text(busy ? "Enregistrement…" : last ? "C’est parti" : "Continuer") }
                    }
                    .buttonStyle(BigButton()).disabled(busy)
                }
                .padding(.top, 6)
            }
            .padding(.horizontal, 24).padding(.bottom, 40)
            .frame(maxWidth: 560).frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Palette.bg)
        .onAppear {
            guard !loaded else { return }
            loaded = true
            f = ProfileDraft(store.profile(Store.SELF)); role = preset
        }
    }

    @ViewBuilder private var content: some View {
        switch cur {
        case "role":
            DisplayTitle("Tu es…", size: 44)
            VStack(spacing: 10) {
                OptionRow(title: "Athlète", text: "Tu suis ton plan, tu notes ta forme, tes séances et tes tests. Tu peux ouvrir ton carnet à un coach avec un code.", on: role == "athlete") { role = "athlete" }
                OptionRow(title: "Coach", text: "Tu suis le carnet de tes athlètes grâce au code qu’ils te donnent : lecture, commentaires et modification de leurs séances. Pas de carnet personnel.", on: role == "coach") { role = "coach" }
            }
            Text("Ce choix est définitif : seul l’administrateur peut le changer ensuite.").font(Typo.sans(13.5)).foregroundStyle(Palette.muted)
        case "body":
            DisplayTitle("Ton profil", size: 44)
            SetupForm { BodyFields(f: $f) }
            if f.sex == "F" { Text("Le suivi du cycle menstruel s’active : il ajoute le jour du cycle à la forme du matin (désactivable dans Paramètres).").font(Typo.sans(13.5)).foregroundStyle(Palette.muted) }
            Text("L’année de naissance adapte les repères de sommeil (8 à 10 h avant 18 ans). Le poids sert aux tests rapportés au poids de corps.").font(Typo.sans(13.5)).foregroundStyle(Palette.muted)
        case "sports":
            DisplayTitle("Tes sports", size: 44)
            SetupForm { SportsFields(f: $f) }
            Text("Tes sports règlent les activités proposées après la séance, les types de séance, les tests et l’assistant de programme.").font(Typo.sans(13.5)).foregroundStyle(Palette.muted)
        default:
            DisplayTitle("Bienvenue", size: 52)
            Text("Quelques infos pour régler ton carnet. Elles restent privées : seuls toi" + (preset == "coach" ? ", tes athlètes" : " et ton coach") + " les voyez.")
                .font(Typo.sans(17)).foregroundStyle(Palette.muted)
            FieldBox(label: "Prénom") { TextField("", text: $f.name).textContentType(.givenName) }
            if let preset { Text(roleLine(preset)).font(Typo.sans(14)).foregroundStyle(Palette.muted) }
        }
    }

    private func roleLine(_ p: String) -> String {
        let r: String = ROLE_LBL[p] ?? p
        return "Ton compte : " + r + "."
    }
    private func next() async {
        err = nil
        if cur == "name" && f.name.trimmingCharacters(in: .whitespaces).isEmpty { err = "Ton prénom, pour que ton coach ou tes athlètes te reconnaissent."; return }
        if cur == "role" && role == nil { err = "Choisis athlète ou coach."; return }
        if cur == "sports" && f.sports.isEmpty { err = "Choisis au moins un sport, ou « Autre sport »."; return }
        if !last { Haptics.select(); withAnimation(.spring(response: 0.4, dampingFraction: 0.88)) { step += 1 }; return }
        let coach = (role ?? preset) == "coach"
        var patch: [String: JSON] = ["name": .str(String(f.name.trimmingCharacters(in: .whitespaces).prefix(40))), "onboarded": .bool(true)]
        if let role { patch["role"] = .str(role) }
        if !coach {
            switch f.body() {
            case .failure(.msg(let m)): err = m; return
            case .success(let b): for (k, v) in b { patch[k] = v }
            }
            patch["sports"] = .arr(f.sports.map { .str($0) }); patch["diet"] = .str(f.diet)
        }
        busy = true; defer { busy = false }
        do {
            try await Account.saveProfile(patch)
            if !coach, let w = patch["weight_kg"]?.double { Core.shared.call("tests.logWeight", .num(w)) }
            Haptics.success(); toast("Profil enregistré")
        } catch { err = Account.fr(error) }
    }
}

/// Champs d'un formulaire natif, sur une carte
private struct SetupForm<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        Form { Section { content } }
            .scrollContentBackground(.hidden)
            .scrollDisabled(true)
            .frame(minHeight: 260)
            .tint(Palette.accent)
    }
}

/// Profil créé avant l'ajout des sports : on les demande une fois
struct SportsSetupView: View {
    @State private var store = Store.shared
    @State private var f = ProfileDraft()
    @State private var err: String?
    @State private var busy = false
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                LogoMark().frame(width: 52, height: 52).padding(.top, 30)
                Eyebrow("Nouveau dans Alipto")
                DisplayTitle("Tes sports", size: 44)
                Text("L’appli s’adapte à ce que tu pratiques : séances, tests, assistant de programme et conseils d’alimentation.").font(Typo.sans(17)).foregroundStyle(Palette.muted)
                SetupForm { SportsFields(f: $f) }
                if let err { Text(err).font(Typo.sans(14.5, .medium)).foregroundStyle(Palette.crit) }
                Button { Task { await save(skip: false) } } label: { Text(busy ? "Enregistrement…" : "Enregistrer") }.buttonStyle(BigButton()).disabled(busy)
                Button("Plus tard") { Task { await save(skip: true) } }.buttonStyle(BigButton(kind: .plain)).disabled(busy)
            }
            .padding(.horizontal, 24).padding(.bottom, 40)
            .frame(maxWidth: 560).frame(maxWidth: .infinity)
        }
        .background(Palette.bg)
        .onAppear { f = ProfileDraft(store.profile(Store.SELF)) }
    }
    private func save(skip: Bool) async {
        if !skip && f.sports.isEmpty { err = "Choisis au moins un sport, ou « Autre sport »."; return }
        busy = true; defer { busy = false }
        do {
            try await Account.saveProfile(["sports": .arr(skip ? [] : f.sports.map { .str($0) }), "diet": .str(f.diet)])
            Haptics.success(); toast("Profil enregistré")
        } catch { err = Account.fr(error) }
    }
}

/// Premier lancement, dernière étape : proposer Apple Santé (on ne pense pas à le chercher dans les réglages)
struct HealthSetupView: View {
    @State private var busy = false
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                LogoMark().frame(width: 52, height: 52).padding(.top, 30)
                Eyebrow("Apple Santé")
                DisplayTitle("Ton iPhone remplit le carnet", size: 44)
                Text("Si tu portes une montre ou un bracelet (Apple Watch, Whoop, Garmin, Polar…), ses données arrivent dans Apple Santé. Alipto peut les lire pour t’éviter de tout saisir.")
                    .font(Typo.sans(17)).foregroundStyle(Palette.muted)
                VStack(spacing: 12) {
                    HealthPoint(icon: "moon.zzz.fill", title: "Ta nuit", text: "Durée, phases, VFC et fréquence cardiaque de repos : la forme du matin se remplit, la séance du jour s’y adapte.")
                    HealthPoint(icon: "figure.run", title: "Tes séances", text: "Durée, distance et fréquence cardiaque moyenne préremplissent « Après la séance ».")
                    HealthPoint(icon: "lock.fill", title: "Tu gardes la main", text: "Alipto ne fait que lire, n’écrit rien dans Santé et n’écrase jamais ce que tu as noté toi-même.")
                }
                Text("iOS va te demander quelles données partager : tu peux tout accepter ou choisir. Tu pourras changer d’avis dans Plus → Réglages, et dans Réglages iOS → Santé → Accès aux données.")
                    .font(Typo.sans(13.5)).foregroundStyle(Palette.muted)
                Button { Task { await allow() } } label: {
                    HStack { if busy { ProgressView().tint(Palette.accentInk) }; Text("Autoriser Apple Santé") }
                }
                .buttonStyle(BigButton()).disabled(busy).padding(.top, 6)
                Button("Plus tard") { Health.shared.offered = true }
                    .buttonStyle(BigButton(kind: .plain)).disabled(busy)
            }
            .padding(.horizontal, 24).padding(.bottom, 40)
            .frame(maxWidth: 560).frame(maxWidth: .infinity)
        }
        .background(Palette.bg)
    }
    private func allow() async {
        busy = true
        let h = Health.shared
        _ = await h.requestAccess()
        h.auto = true
        _ = await h.importNight(D.today)
        busy = false
        Haptics.success()
        h.offered = true
    }
}

private struct HealthPoint: View {
    let icon: String, title: String, text: String
    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon).font(.system(size: 20)).foregroundStyle(Color(hex: 0xff375f)).frame(width: 28)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(Typo.sans(16, .semibold)).foregroundStyle(Palette.ink)
                Text(text).font(Typo.sans(14.5)).foregroundStyle(Palette.muted)
            }
            Spacer(minLength: 0)
        }
        .card()
    }
}

/// Mot de passe oublié : un e-mail avec un lien pour en choisir un nouveau
struct ForgotSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State var email: String
    @State private var busy = false
    @State private var sent = false
    @State private var err: String?
    var body: some View {
        NavigationStack {
            Form {
                if sent {
                    Section {
                        Label("E-mail envoyé à " + email, systemImage: "envelope.badge")
                        Text("Ouvre le lien de l’e-mail pour choisir un nouveau mot de passe, puis reviens te connecter ici. Pense à regarder dans les spams.").foregroundStyle(Palette.muted)
                    }
                } else {
                    Section {
                        TextField("E-mail", text: $email).keyboardType(.emailAddress).textContentType(.username).textInputAutocapitalization(.never).autocorrectionDisabled()
                    } footer: { Text("Tu reçois un e-mail avec un lien pour choisir un nouveau mot de passe.") }
                    if let err { Section { Text(err).foregroundStyle(Palette.crit) } }
                }
            }
            .scrollContentBackground(.hidden).background(Palette.bg)
            .navigationTitle("Mot de passe oublié").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button(sent ? "OK" : "Annuler") { dismiss() } }
                if !sent {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Envoyer") { Task { await send() } }.fontWeight(.semibold)
                            .disabled(busy || email.range(of: #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#, options: .regularExpression) == nil)
                    }
                }
            }
        }
    }
    private func send() async {
        busy = true; err = nil
        do { try await Account.forgotPassword(email); withAnimation { sent = true } } catch { err = Account.fr(error) }
        busy = false
    }
}
