import SwiftUI
import UserNotifications

@main
struct AliptoApp: App {
    init() {
        UNUserNotificationCenter.current().delegate = NotificationDelegate.shared
        if Launch.demo {
            Store.shared.loadDemo(DemoData.make())
        } else {
            Store.shared.load()
            Store.shared.startAutoSync()
        }
        if !Launch.screen.isEmpty { AppState.shared.tab = ["plan", "more", "stats"].contains(Launch.screen) ? Launch.screen : Launch.screen == "tests" || Launch.screen == "nutri" ? "stats" : "today" }
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
}
