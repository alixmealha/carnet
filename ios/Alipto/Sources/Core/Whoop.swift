import Foundation
import AuthenticationServices
import UIKit

/// Whoop : l'autorisation se fait dans une fenêtre Safari (OAuth 2), le secret et les jetons restent sur Supabase (fonction « whoop »).
/// L'appli demande les jours récents à la fonction, puis la logique partagée avec le web (whoop.mergeDays) les range dans le carnet,
/// sans jamais écraser ce qui a été noté à la main.
@MainActor
@Observable
final class Whoop {
    static let shared = Whoop()
    /// La personne a connecté son bracelet (mémorisé pour synchroniser à l'ouverture)
    var wanted: Bool = UserDefaults.standard.bool(forKey: "whoop-on") {
        didSet { UserDefaults.standard.set(wanted, forKey: "whoop-on") }
    }
    var configured = false
    var connected = false
    var lastSync: Date?
    var busy = false
    var error: String?
    private var web: ASWebAuthenticationSession?
    private let anchor = WhoopAnchor()

    private func fn(_ body: [String: JSON]) async throws -> JSON {
        do { return try await Backend.shared.function("whoop", body: .obj(body)) }
        catch let e as BackendError {
            if case .http(let code, let m) = e {
                if let j = JSON.decode(Data(m.utf8)), let msg = j["error"]?.string { throw WhoopError(text: msg) }
                if code == 404 { throw WhoopError(text: "La fonction « whoop » n’est pas déployée dans Supabase (Edge Functions → nom exact : whoop).") }
                if code == 401 { throw WhoopError(text: "Supabase refuse l’appel : désactive « Verify JWT » sur la fonction whoop.") }
            }
            throw e
        }
    }
    private func text(_ e: Error) -> String { (e as? WhoopError)?.text ?? Account.fr(e) }

    func refresh() async {
        guard !Launch.demo, !Store.shared.demo else { return }
        do {
            let r = try await fn(["action": .str("status")])
            configured = r["configured"]?.truthy ?? false
            connected = r["connected"]?.truthy ?? false
            if let s = r["lastSync"]?.string { lastSync = ISO8601DateFormatter().date(from: s) ?? ISO8601DateFormatter.fractional.date(from: s) }
            wanted = connected
            error = nil
        } catch let e { error = text(e) }
    }

    func connect() async {
        busy = true; error = nil; defer { busy = false }
        do {
            let r = try await fn(["action": .str("connect"), "ret": .str("ios")])
            guard let s = r["url"]?.string, let url = URL(string: s) else { throw WhoopError(text: "Adresse Whoop introuvable.") }
            let back: URL? = await withCheckedContinuation { cont in
                let ws = ASWebAuthenticationSession(url: url, callbackURLScheme: "alipto") { u, _ in cont.resume(returning: u) }
                ws.presentationContextProvider = anchor
                ws.prefersEphemeralWebBrowserSession = false
                web = ws
                if !ws.start() { cont.resume(returning: nil) }
            }
            web = nil
            guard let back else { return }                                  // fenêtre fermée : rien à signaler
            if back.absoluteString.contains("ok=1") {
                await refresh()
                let n = await sync(days: 14, quiet: false)
                toast(n > 0 ? "Whoop connecté · \(n) jour" + (n > 1 ? "s" : "") + " importé" + (n > 1 ? "s" : "") : "Whoop connecté")
            } else {
                error = "La connexion Whoop n’a pas abouti : réessaie."
            }
        } catch let e { error = text(e) }
    }

    @discardableResult
    func sync(days: Int, quiet: Bool = true) async -> Int {
        guard wanted, !Launch.demo, !Store.shared.demo, Store.shared.isSelf else { return 0 }
        busy = true; defer { busy = false }
        do {
            let to = D.today, from = D.add(D.today, -days)
            let r = try await fn(["action": .str("sync"), "from": .str(from), "to": .str(to), "tz": .str(TimeZone.current.identifier)])
            if r["connected"]?.truthy == false {
                wanted = false; connected = false
                if !quiet { error = "La connexion Whoop a expiré : reconnecte-toi." }
                return 0
            }
            let n = Core.shared.call("whoop.mergeDays", r["days"] ?? .emptyObject)?.int ?? 0
            lastSync = Date(); error = nil
            return n
        } catch let e {
            if !quiet { error = text(e) }
            return 0
        }
    }

    func disconnect() async {
        busy = true; defer { busy = false }
        do {
            _ = try await fn(["action": .str("disconnect")])
            wanted = false; connected = false; lastSync = nil; error = nil
            toast("Whoop déconnecté")
        } catch let e { error = text(e) }
    }
}

private struct WhoopError: LocalizedError { let text: String; var errorDescription: String? { text } }

private final class WhoopAnchor: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        return scene?.keyWindow ?? scene?.windows.first ?? ASPresentationAnchor()
    }
}

private extension ISO8601DateFormatter {
    static let fractional: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()
}
