import SwiftUI

/// Plus (comme la version web) : profil en haut, les repères (échelles, lexique, sources), puis les paramètres.
struct MoreView: View {
    @State private var store = Store.shared
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 0) {
                        Eyebrow("Alipto")
                        DisplayTitle("Plus", size: 52)
                    }
                    .padding(.top, 8)
                    NavigationLink(value: "profile") { ProfileRow() }.buttonStyle(PressStyle())
                    if !store.athletes.isEmpty { SubjectCard() }
                    ReperesCard()
                    NavigationLink(value: "settings") {
                        MoreRow(icon: "slider.horizontal.3", title: "Paramètres", sub: "Apparence, séance, notifications, compte, données")
                    }
                    .buttonStyle(PressStyle())
                    if store.isAdmin {
                        NavigationLink(value: "admin") { MoreRow(icon: "shield.lefthalf.filled", title: "Administration", sub: "Comptes, rôles, accès") }.buttonStyle(PressStyle())
                    }
                    MoreFooter()
                }
                .padding(.horizontal, 16).padding(.bottom, 30)
            }
            .scrollIndicators(.hidden)
            .background(Palette.bg)
            .statusBarScrim()
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: String.self) { p in
                switch p {
                case "settings": SettingsPage()
                case "admin": AdminPage()
                default: ProfilePage()
                }
            }
        }
    }
}

let ROLE_LBL = ["athlete": "Athlète", "coach": "Coach", "admin": "Administrateur"]

struct MoreRow: View {
    let icon: String
    let title: String
    let sub: String
    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon).font(.system(size: 19, weight: .semibold)).foregroundStyle(Palette.accent)
                .frame(width: 44, height: 44).background(Palette.accentSoft, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(Typo.sans(16.5, .semibold)).foregroundStyle(Palette.ink)
                Text(sub).font(Typo.sans(13.5)).foregroundStyle(Palette.muted).multilineTextAlignment(.leading)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Palette.muted.opacity(0.6))
        }
        .card(padding: 14)
    }
}

private struct ProfileRow: View {
    @State private var store = Store.shared
    var body: some View {
        let p = store.profile(Store.SELF)
        let name = p["name"]?.string ?? ""
        let lbl = Core.shared.constant("sports.SPORT_LBL")
        let sp = (p["sports"]?.array.compactMap { $0.string } ?? []).compactMap { lbl[$0]?.string }
        let parts = [name.isEmpty ? nil : name, store.demo ? nil : ROLE_LBL[store.role], sp.isEmpty ? nil : sp.joined(separator: ", ")].compactMap { $0 }
        HStack(spacing: 14) {
            Text(String(name.prefix(1)).uppercased().isEmpty ? "?" : String(name.prefix(1)).uppercased())
                .font(Typo.display(24)).foregroundStyle(Palette.accentInk)
                .frame(width: 48, height: 48).background(Palette.accent, in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text("Profil").font(Typo.sans(16.5, .semibold)).foregroundStyle(Palette.ink)
                Text(parts.isEmpty ? "Toi, ton niveau, ton coach" : parts.joined(separator: " · ")).font(Typo.sans(13.5)).foregroundStyle(Palette.muted).multilineTextAlignment(.leading)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Palette.muted.opacity(0.6))
        }
        .card(padding: 14)
    }
}

/// Carnet affiché (coach) : le sien ou celui d'un athlète
struct SubjectCard: View {
    @State private var store = Store.shared
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            CardHeader("Carnet affiché")
            Flow(spacing: 6) {
                if store.hasCarnet { Chip(label: "Moi", on: store.isSelf) { switchTo(Store.SELF) } }
                ForEach(store.athletes, id: \.self) { a in
                    Chip(label: store.name(a), on: store.subject == a) { switchTo(a) }
                }
            }
        }
        .card()
    }
    private func switchTo(_ who: String) {
        withAnimation { store.subject = who }
        AppState.shared.tab = "today"
        toast(who == Store.SELF ? "Ton carnet" : "Carnet de " + store.name(who))
    }
}

private struct MoreFooter: View {
    @State private var store = Store.shared
    var body: some View {
        let title = store.get("plan")?["title"]?.string
        HStack(alignment: .top, spacing: 14) {
            LogoMark().frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 4) {
                Text("ALIPTO").font(Typo.display(24)).foregroundStyle(Palette.ink)
                (Text("Du grec ") + Text("aleiptès").italic() + Text(" : celui qui préparait les athlètes, à la fois entraîneur et soigneur. Ton plan, ta forme, tes tests et ton coach au même endroit."))
                    .font(Typo.sans(13.5)).foregroundStyle(Palette.muted)
                Text(version(title)).font(Typo.mono(12)).foregroundStyle(Palette.muted)
            }
        }
        .padding(.top, 10)
    }
    private func version(_ title: String?) -> String {
        let v: String = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        guard let title else { return "Version " + v }
        return "Version " + v + " · " + title
    }
}

/// Apple Santé : la nuit, la VFC et la FC de repos dans la carte Sommeil
struct HealthCard: View {
    @State private var health = Health.shared
    @State private var auto = Health.shared.auto
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            CardHeader("Apple Santé") { Image(systemName: "heart.fill").foregroundStyle(Color(hex: 0xff375f)) }
            Text("Ta nuit (durée et phases), ta VFC et ta fréquence cardiaque de repos remplissent la carte Sommeil et la lecture du jour ; tes séances (durée, distance, FC moyenne) préremplissent « Après la séance ». Rien n’est écrit dans Santé.")
                .font(Typo.sans(14)).foregroundStyle(Palette.muted)
            Toggle(isOn: $auto) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Remplir la nuit tout seul").font(Typo.sans(16, .medium)).foregroundStyle(Palette.ink)
                    Text("À chaque ouverture de l’appli, sans écraser ce que tu as noté à la main.").font(Typo.sans(13)).foregroundStyle(Palette.muted)
                }
            }
            .tint(Palette.accent)
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
            .buttonStyle(BigButton(kind: .plain))
        }
        .card()
    }
}
