import SwiftUI

@main
struct AliptoApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}

/// Paramètres de lancement (captures automatiques) : -demo 1 -screen today
enum Launch {
    static var demo: Bool { UserDefaults.standard.bool(forKey: "demo") }
    static var screen: String { UserDefaults.standard.string(forKey: "screen") ?? "" }
}
