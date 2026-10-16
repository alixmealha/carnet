import SwiftUI
import UserNotifications

@main
struct AliptoApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    init() {
        UNUserNotificationCenter.current().delegate = NotificationDelegate.shared
        if Launch.demo {
            Store.shared.loadDemo(DemoData.make())
        } else {
            Store.shared.load()
            Store.shared.startAutoSync()
        }
        if !Launch.screen.isEmpty { AppState.shared.tab = Launch.tab }
        if ["plan", "prog", "builder", "dayedit"].contains(Launch.screen) { UserDefaults.standard.set(Launch.screen == "plan" ? "cal" : "prog", forKey: "plan-view") }
        if Launch.screen == "tests" { UserDefaults.standard.set("tests", forKey: "carnet-stats-view") }
        if Launch.screen == "nutri" { UserDefaults.standard.set("nutri", forKey: "carnet-stats-view") }
        if Launch.screen == "stats" { UserDefaults.standard.set("dash", forKey: "carnet-stats-view") }
    }
    var body: some Scene {
        WindowGroup {
            RootView()
                .onAppear {
                    if ["session", "rest", "timer", "climb", "finish"].contains(Launch.screen) { AppState.shared.session = SessionRef(k: D.today) }
                }
        }
    }
}

/// Paramètres de lancement (captures automatiques) : -demo 1 -screen today
enum Launch {
    static var demo: Bool { UserDefaults.standard.bool(forKey: "demo") }
    static var screen: String { UserDefaults.standard.string(forKey: "screen") ?? "" }
    /// Onglet ouvert pour la capture
    static var tab: String {
        switch screen {
        case "plan", "prog", "builder", "dayedit": return "plan"
        case "stats", "tests", "nutri": return "stats"
        case "more": return "more"
        default: return "today"
        }
    }
}
