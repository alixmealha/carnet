import AVFoundation
import AudioToolbox
import UIKit
import UserNotifications

/// Signaux pendant la séance : vibrations, bips, voix, et notification quand le repos se termine en arrière-plan.
enum Signals {
    private static let voice = AVSpeechSynthesizer()
    static var soundOn: Bool { UserDefaults.standard.object(forKey: "sound") as? Bool ?? true }

    /// À l'ouverture du mode séance : le son passe par-dessus la musique (sans la couper), l'écran reste allumé
    static func begin() {
        try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.mixWithOthers, .duckOthers])
        UIApplication.shared.isIdleTimerDisabled = true
        if !Launch.demo { UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in } }
    }
    static func end() {
        UIApplication.shared.isIdleTimerDisabled = false
        cancel("rest")
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    static func tick() { Haptics.tap(); if soundOn { AudioServicesPlaySystemSound(1104) } }
    static func go() { Haptics.heavy(); if soundOn { AudioServicesPlaySystemSound(1113) } }
    static func rest() { Haptics.firm(); if soundOn { AudioServicesPlaySystemSound(1114) } }
    static func done() { Haptics.success(); if soundOn { AudioServicesPlaySystemSound(1025) } }
    static func say(_ text: String) {
        guard soundOn, !text.isEmpty else { return }
        try? AVAudioSession.sharedInstance().setActive(true)
        let u = AVSpeechUtterance(string: text)
        u.voice = AVSpeechSynthesisVoice(language: "fr-FR")
        u.rate = 0.52
        voice.stopSpeaking(at: .immediate)
        voice.speak(u)
    }

    /// Notification locale à l'heure dite (si l'appli est en arrière-plan à ce moment-là)
    static func schedule(_ id: String, at date: Date, title: String, body: String) {
        let s = date.timeIntervalSinceNow
        guard s > 1 else { return }
        let c = UNMutableNotificationContent()
        c.title = title; c.body = body; c.sound = .default
        let r = UNNotificationRequest(identifier: id, content: c, trigger: UNTimeIntervalNotificationTrigger(timeInterval: s, repeats: false))
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [id])
        UNUserNotificationCenter.current().add(r)
    }
    static func cancel(_ id: String) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [id])
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [id])
    }
}

/// Les notifications s'affichent aussi quand l'appli est ouverte (sauf celles du repos, déjà signalées à l'écran)
final class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationDelegate()
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler(notification.request.identifier == "rest" ? [] : [.banner, .sound])
    }
}
