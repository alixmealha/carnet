import SwiftUI

/// Séance ouverte en plein écran (jour, et bloc fait à part s'il y en a un)
struct SessionRef: Identifiable, Equatable {
    let k: String
    var part: String? = nil
    var id: String { k + (part ?? "") }
}

@Observable
final class AppState {
    static let shared = AppState()
    var signedIn = Backend.shared.signedIn
    var session: SessionRef?
    var tab = "today"
}

struct RootView: View {
    @State private var app = AppState.shared
    @State private var store = Store.shared
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("theme") private var theme = "system"

    var body: some View {
        ZStack {
            Palette.bg.ignoresSafeArea()
            if app.signedIn || store.demo {
                gate.transition(.opacity)
            } else {
                LoginView()
                    .transition(.opacity.combined(with: .scale(scale: 0.98)))
            }
            ToastOverlay()
        }
        .animation(.easeInOut(duration: 0.35), value: app.signedIn)
        .animation(.easeInOut(duration: 0.35), value: setup)
        .tint(Palette.accent)
        .preferredColorScheme(theme == "light" ? .light : theme == "dark" ? .dark : nil)
        .onChange(of: scenePhase) { _, p in
            if p == .active {
                Store.shared.schedule(0.2)
                Reminders.reschedule()
                if Health.shared.auto { Task { _ = await Health.shared.importNight(D.today) } }
                if Whoop.shared.wanted { Task { await Whoop.shared.sync(days: 3) } }
            }
            if p == .background { WidgetSync.write(); Reminders.reschedule() }
        }
        .onChange(of: Store.shared.version) { _, _ in
            WidgetSync.schedule()
            if Store.shared.get("j:" + D.today, owner: Store.SELF)?["well"] != nil { Reminders.filledToday() }
        }
        .onChange(of: Store.shared.phase) { _, p in
            // session expirée (mot de passe changé, compte retiré) : retour à la connexion
            if p == .signedout && !Backend.shared.signedIn && !Store.shared.demo { app.signedIn = false }
        }
    }
}

extension RootView {
    /// Premier lancement : profil à remplir, puis les sports (comme la version web)
    var setup: String {
        let s = store
        guard !s.demo, s.lastSync != nil, !s.profiles.isEmpty else { return "" }
        if s.myRow == nil || s.myRow?["onboarded"]?.truthy != true { return "profile" }
        if s.hasCarnet, s.get("profile", owner: Store.SELF)?["sports"] == nil { return "sports" }
        if s.hasCarnet, Health.shared.available, !Health.shared.offered { return "health" }
        return ""
    }
    @ViewBuilder var gate: some View {
        switch setup {
        case "profile": ProfileSetupView()
        case "sports": SportsSetupView()
        case "health": HealthSetupView()
        default: MainTabs()
        }
    }
}

struct MainTabs: View {
    @State private var app = AppState.shared
    @State private var store = Store.shared
    var body: some View {
        let coachTab = store.isCoach || !store.athletes.isEmpty
        TabView(selection: $app.tab) {
            if store.hasCarnet || !store.athletes.isEmpty {
                TodayView()
                    .tabItem { Label("Aujourd’hui", systemImage: "sun.max") }
                    .tag("today")
            }
            if coachTab {
                AthletesView()
                    .tabItem { Label("Athlètes", systemImage: "person.2") }
                    .tag("athletes")
                    .badge(Coach.unread())
            }
            if store.hasCarnet || !store.athletes.isEmpty {
                PlanTabView()
                    .tabItem { Label("Plan", systemImage: "calendar") }
                    .tag("plan")
                StatsView()
                    .tabItem { Label("Suivi", systemImage: "chart.bar.xaxis") }
                    .tag("stats")
            }
            MoreView()
                .tabItem { Label("Plus", systemImage: "ellipsis.circle") }
                .tag("more")
        }
        .fullScreenCover(item: $app.session) { ref in
            SessionModeView(ref: ref)
        }
        .onAppear(perform: coachStart)
        .onChange(of: store.athletes) { _, _ in coachStart() }
    }
    /// Un coach n'a pas de carnet : il ouvre sur ses athlètes, avec le carnet du premier
    private func coachStart() {
        guard store.isCoach else { return }
        if store.isSelf, let a = store.athletes.first { store.subject = a }
        if app.tab == "today" && Launch.screen.isEmpty { app.tab = "athletes" }
    }
}
