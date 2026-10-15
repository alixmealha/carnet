import Foundation
import ActivityKit

/// Minuteur de repos affiché sur l'écran verrouillé et dans la Dynamic Island (partagé par l'appli et les widgets)
struct RestAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var until: Date          // fin du repos (ou de la phase du minuteur)
        var start: Date          // début, pour la barre de progression
        var label: String        // « Repos · série 3 ensuite »
        var next: String?        // ce qui vient après (« Tractions lestées »)
        var phase: String        // rest, work, done
        var paused: Bool
    }
    var title: String            // nom de la séance
}

/// Ce que les widgets affichent, écrit par l'appli dans le groupe partagé
struct WidgetSnapshot: Codable, Equatable {
    var day: String = ""                 // AAAA-MM-JJ
    var score: Int? = nil                // forme du matin sur 25
    var verdict: String? = nil           // En forme, Correct…
    var level: String? = nil             // good, ok, warn, crit
    var session: String = "Repos"
    var kinds: [String] = []
    var done = 0
    var total = 0
    var status: String? = nil
    var reading: String? = nil           // feu du jour
    var event: String? = nil
    var eventDays: Int? = nil
    var weekDone = 0
    var weekPlanned = 0
    var tomorrow: String? = nil
    var updated = Date()

    static let group = "group.app.alipto"
    static let key = "widget-snapshot"
    static func read() -> WidgetSnapshot {
        guard let d = UserDefaults(suiteName: group)?.data(forKey: key), let s = try? JSONDecoder().decode(WidgetSnapshot.self, from: d) else { return WidgetSnapshot() }
        return s
    }
    func write() {
        guard let d = try? JSONEncoder().encode(self) else { return }
        UserDefaults(suiteName: WidgetSnapshot.group)?.set(d, forKey: WidgetSnapshot.key)
    }
}
