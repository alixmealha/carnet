import UIKit
import UserNotifications

/// Notifications distantes (APNs) : séance validée par un athlète, commentaire du coach… même appli fermée.
/// L'iPhone donne son « jeton d'appareil » ; il est rangé côté serveur (fonction register_apns) et la fonction « notify » s'en sert.
enum Push {
    private static let key = "apns-token"
    /// Les builds lancés depuis Xcode parlent au serveur Apple de test, ceux de TestFlight / App Store au vrai
    static var environment: String {
        #if DEBUG
        return "sandbox"
        #else
        return "production"
        #endif
    }
    static var token: String? { UserDefaults.standard.string(forKey: key) }

    /// Demande un jeton à iOS (sans effet si les notifications sont refusées) et le transmet au serveur
    @MainActor
    static func register() {
        guard Backend.shared.signedIn, !Store.shared.demo, !Launch.demo else { return }
        UIApplication.shared.registerForRemoteNotifications()
        if let t = token { Task { await upload(t) } }
    }
    /// Au lancement et au retour au premier plan : seulement si l'utilisateur a accepté les notifications
    @MainActor
    static func refreshIfAllowed() {
        Task { @MainActor in
            let s = await Reminders.status()
            if s == .authorized || s == .provisional || s == .ephemeral { register() }
        }
    }
    /// Une seule fois par installation : on propose les notifications à l'arrivée sur l'écran principal
    @MainActor
    static func offerOnce() {
        guard Backend.shared.signedIn, !Store.shared.demo, !Launch.demo else { return }
        guard !UserDefaults.standard.bool(forKey: "push-offered") else { return }
        UserDefaults.standard.set(true, forKey: "push-offered")
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            if await Reminders.status() == .notDetermined { _ = await Reminders.requestAuth() }
            refreshIfAllowed()
        }
    }

    static func received(_ data: Data) {
        let hex = data.map { String(format: "%02x", $0) }.joined()
        UserDefaults.standard.set(hex, forKey: key)
        Task { await upload(hex) }
    }
    private static func upload(_ hex: String) async {
        _ = try? await Backend.shared.rest("rpc/register_apns", method: "POST", body: .obj(["tok": .str(hex), "environment": .str(environment)]))
    }

    /// Un toucher sur une notification : athlète concerné « a », jour « d »
    @MainActor
    static func open(_ info: [AnyHashable: Any]) {
        let a = info["a"] as? String
        guard a != nil || info["d"] != nil else { return }
        if let a, Store.shared.athletes.contains(a) { AppState.shared.tab = "athletes" }
        else if Store.shared.hasCarnet { AppState.shared.tab = "today" }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Push.received(deviceToken)
    }
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {}
}
