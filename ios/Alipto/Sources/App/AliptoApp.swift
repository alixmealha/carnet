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
        if !Launch.screen.isEmpty { AppState.shared.tab = Launch.screen == "plan" ? "plan" : Launch.screen == "more" ? "more" : "today" }
    }
    var body: some Scene {
        WindowGroup {
            RootView()
                .onAppear {
                    if Launch.screen == "session" { AppState.shared.session = SessionRef(k: D.today) }
                }
        }
    }
}

/// Paramètres de lancement (captures automatiques) : -demo 1 -screen today
enum Launch {
    static var demo: Bool { UserDefaults.standard.bool(forKey: "demo") }
    static var screen: String { UserDefaults.standard.string(forKey: "screen") ?? "" }
}
