import Foundation
import UserNotifications

/// Rappels (Plus → Paramètres → Notifications), en notifications locales sur l'iPhone :
/// la forme du matin à l'heure choisie (seulement si elle n'est pas remplie) et le bilan de la semaine le dimanche à 19 h.
/// Les réglages sont les mêmes que sur la version web (document « settings »).
enum Reminders {
    static var settings: JSON { Store.shared.get("settings", owner: Store.SELF) ?? .emptyObject }
    static var morningOn: Bool { settings["remind"]?["on"]?.truthy ?? false }
    static var morningAt: String { settings["remind"]?["at"]?.string ?? "08:00" }
    static var weeklyOn: Bool { settings["weekly"]?.bool ?? true }

    static func requestAuth() async -> Bool {
        (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }
    static func status() async -> UNAuthorizationStatus {
        await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }

    /// Replanifie les 7 prochains rappels du matin et le prochain bilan du dimanche
    @MainActor
    static func reschedule() {
        let s = Store.shared
        guard !Launch.demo, !s.demo else { return }
        let center = UNUserNotificationCenter.current()
        let morningOn = self.morningOn, at = morningAt, weeklyOn = self.weeklyOn
        let athlete = s.hasCarnet
        var filled: Set<String> = []
        for i in 0..<8 { let k = D.add(D.today, i); if s.get("j:" + k, owner: Store.SELF)?["well"] != nil { filled.insert(k) } }
        center.getPendingNotificationRequests { reqs in
            let old = reqs.map(\.identifier).filter { $0.hasPrefix("remind-") || $0 == "weekly" }
            center.removePendingNotificationRequests(withIdentifiers: old)
            let parts = at.split(separator: ":").compactMap { Int($0) }
            let h = parts.first ?? 8, m = parts.count > 1 ? parts[1] : 0
            let cal = Calendar.current
            if morningOn && athlete {
                for i in 0..<7 {
                    let k = D.add(D.today, i)
                    if filled.contains(k) { continue }
                    var c = cal.dateComponents([.year, .month, .day], from: D.date(k))
                    c.hour = h; c.minute = m
                    guard let when = cal.date(from: c), when > Date() else { continue }
                    let n = UNMutableNotificationContent()
                    n.title = "Forme du matin"
                    n.body = "30 secondes pour noter ton sommeil, ta fatigue et tes courbatures : la séance du jour s’y adapte."
                    n.sound = .default
                    center.add(UNNotificationRequest(identifier: "remind-" + k, content: n, trigger: UNCalendarNotificationTrigger(dateMatching: c, repeats: false)))
                }
            }
            if weeklyOn {
                var c = DateComponents(); c.weekday = 1; c.hour = 19; c.minute = 0   // dimanche
                let n = UNMutableNotificationContent()
                n.title = "Bilan de la semaine"
                n.body = athlete ? "Séances, charge, records et semaine suivante : ton bilan est prêt." : "Les séances de tes athlètes cette semaine : le bilan est prêt."
                n.sound = .default
                center.add(UNNotificationRequest(identifier: "weekly", content: n, trigger: UNCalendarNotificationTrigger(dateMatching: c, repeats: true)))
            }
        }
    }

    /// Forme du matin remplie : le rappel du jour ne part pas
    static func filledToday() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["remind-" + D.today])
    }
}
