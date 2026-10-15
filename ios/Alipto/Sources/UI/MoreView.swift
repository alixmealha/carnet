import SwiftUI

/// Plus : compte, synchronisation, son en séance, version web (pour tout ce qui n'est pas encore dans l'appli iPhone)
struct MoreView: View {
    @State private var store = Store.shared
    @AppStorage("sound") private var sound = true
    @State private var confirmOut = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 2) {
                        Eyebrow("Compte et réglages")
                        DisplayTitle("Plus", size: 52)
                    }
                    .padding(.top, 8)

                    VStack(alignment: .leading, spacing: 12) {
                        CardHeader("Compte")
                        row("Nom", store.name(Store.SELF))
                        row("E-mail", Backend.shared.session?.email ?? (store.demo ? "démo" : "—"))
                        if !store.coaches.isEmpty { row("Coach", store.coaches.map { store.name($0) }.joined(separator: ", ")) }
                        if !store.athletes.isEmpty { row("Athlètes suivis", String(store.athletes.count)) }
                    }
                    .card()

                    VStack(alignment: .leading, spacing: 12) {
                        CardHeader("Synchronisation") {
                            Circle().fill(syncColor).frame(width: 9, height: 9)
                        }
                        Text(syncText).font(Typo.sans(15)).foregroundStyle(Palette.muted)
                        if let e = store.lastError, store.phase == .error { Text(e).font(Typo.sans(13.5)).foregroundStyle(Palette.crit) }
                        Button { Task { await store.syncNow(); toast(store.phase == .idle ? "À jour" : "Pas de connexion") } } label: {
                            HStack {
                                if store.phase == .syncing { ProgressView() }
                                Text("Synchroniser maintenant")
                            }
                        }
                        .buttonStyle(BigButton(kind: .plain))
                        .disabled(store.phase == .syncing || store.demo)
                    }
                    .card()

                    VStack(alignment: .leading, spacing: 12) {
                        CardHeader("Séance")
                        Toggle(isOn: $sound) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Bips et voix").font(Typo.sans(16, .medium)).foregroundStyle(Palette.ink)
                                Text("Fin du repos, décompte 3-2-1, côté à travailler. Les vibrations restent.").font(Typo.sans(13.5)).foregroundStyle(Palette.muted)
                            }
                        }
                        .tint(Palette.accent)
                    }
                    .card()

                    VStack(alignment: .leading, spacing: 12) {
                        CardHeader("Version web")
                        Text("Le plan complet, l’assistant, le suivi, les tests et la nutrition restent sur la version web le temps que l’appli iPhone les reprenne. Mêmes données, tout se synchronise.")
                            .font(Typo.sans(15)).foregroundStyle(Palette.muted)
                        Link(destination: Config.webURL) {
                            HStack { Text("Ouvrir la version web"); Image(systemName: "arrow.up.right") }
                        }
                        .buttonStyle(BigButton(kind: .soft))
                    }
                    .card()

                    if !store.demo {
                        Button("Se déconnecter", role: .destructive) { confirmOut = true }
                            .buttonStyle(BigButton(kind: .plain))
                            .confirmationDialog("Se déconnecter ?", isPresented: $confirmOut, titleVisibility: .visible) {
                                Button("Se déconnecter", role: .destructive) {
                                    Backend.shared.signOut(); Store.shared.wipe(); AppState.shared.signedIn = false
                                }
                            } message: {
                                Text(store.pending > 0 ? "\(store.pending) modification(s) pas encore envoyée(s) seront perdues." : "Tes données restent sur ton compte.")
                            }
                    }
                    Text("Alipto pour iPhone · version " + (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"))
                        .font(Typo.mono(12)).foregroundStyle(Palette.muted).frame(maxWidth: .infinity).padding(.vertical, 8)
                }
                .padding(.horizontal, 16).padding(.bottom, 30)
            }
            .background(Palette.bg)
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    private func row(_ k: String, _ v: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(k).font(Typo.sans(15)).foregroundStyle(Palette.muted)
            Spacer()
            Text(v).font(Typo.sans(15, .medium)).foregroundStyle(Palette.ink).multilineTextAlignment(.trailing)
        }
    }
    private var syncColor: Color {
        switch store.phase { case .idle: return Palette.good; case .syncing: return Palette.accent; case .offline, .local: return Palette.warn; default: return Palette.crit }
    }
    private var syncText: String {
        if store.demo { return "Mode démo : rien n’est envoyé." }
        switch store.phase {
        case .syncing: return "Synchronisation…"
        case .offline: return "Hors connexion : tout est gardé sur le téléphone et partira dès le retour du réseau."
        case .signedout: return "Session expirée : reconnecte-toi."
        case .error: return "La dernière synchronisation a échoué."
        default:
            let p = store.pending
            let when = store.lastSync.map { "À jour · " + $0.formatted(date: .omitted, time: .shortened) } ?? "Pas encore synchronisé"
            return p > 0 ? when + " · \(p) en attente" : when
        }
    }
}
