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
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ZStack {
            Palette.bg.ignoresSafeArea()
            if app.signedIn || Store.shared.demo {
                MainTabs()
                    .transition(.opacity)
            } else {
                LoginView()
                    .transition(.opacity.combined(with: .scale(scale: 0.98)))
            }
            ToastOverlay()
        }
        .animation(.easeInOut(duration: 0.35), value: app.signedIn)
        .tint(Palette.accent)
        .onChange(of: scenePhase) { _, p in
            if p == .active { Store.shared.schedule(0.2) }
        }
        .onChange(of: Store.shared.phase) { _, p in
            // session expirée (mot de passe changé, compte retiré) : retour à la connexion
            if p == .signedout && !Backend.shared.signedIn && !Store.shared.demo { app.signedIn = false }
        }
    }
}

struct MainTabs: View {
    @State private var app = AppState.shared
    var body: some View {
        TabView(selection: $app.tab) {
            TodayView()
                .tabItem { Label("Aujourd’hui", systemImage: "sun.max") }
                .tag("today")
            PlanListView()
                .tabItem { Label("Plan", systemImage: "calendar") }
                .tag("plan")
            MoreView()
                .tabItem { Label("Plus", systemImage: "ellipsis.circle") }
                .tag("more")
        }
        .fullScreenCover(item: $app.session) { ref in
            SessionModeView(ref: ref)
        }
    }
}
