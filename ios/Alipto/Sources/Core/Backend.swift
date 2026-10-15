import Foundation
import Security

/// Accès à Supabase par son API REST : connexion (e-mail + mot de passe), jeton rafraîchi tout seul, requêtes sur les tables.
struct AuthSession: Codable, Equatable {
    var access: String
    var refresh: String
    var expiresAt: Double   // secondes depuis 1970
    var userId: String
    var email: String
}

enum BackendError: LocalizedError {
    case signedOut
    case http(Int, String)
    case refused(String)    // règle de la base (plan verrouillé, droit du coach…)
    var errorDescription: String? {
        switch self {
        case .signedOut: return "Déconnecté : reconnecte-toi."
        case .http(let c, let m): return "Erreur \(c) : \(m)"
        case .refused(let m): return "Refusé par la base : \(m)"
        }
    }
}

final class Backend {
    static let shared = Backend()
    private(set) var session: AuthSession? { didSet { Keychain.save(session) } }
    private let urlSession: URLSession = {
        let c = URLSessionConfiguration.default
        c.timeoutIntervalForRequest = 20
        c.waitsForConnectivity = false
        return URLSession(configuration: c)
    }()

    init() { session = Keychain.load() }
    var signedIn: Bool { session != nil }

    // MARK: connexion
    func signIn(email: String, password: String) async throws {
        let body = JSON.obj(["email": .str(email), "password": .str(password)])
        let (data, resp) = try await raw("auth/v1/token", query: [URLQueryItem(name: "grant_type", value: "password")], method: "POST", body: body.encoded(), token: nil)
        guard resp.statusCode == 200 else {
            let j = JSON.decode(data)
            let msg = j?["error_description"]?.string ?? j?["msg"]?.string ?? j?["message"]?.string ?? ""
            if resp.statusCode == 400 && msg.lowercased().contains("invalid") { throw BackendError.http(400, "e-mail ou mot de passe incorrect.") }
            throw BackendError.http(resp.statusCode, msg)
        }
        session = try Self.parseSession(data, email: email)
    }
    func signOut() {
        if let t = session?.access {
            var r = URLRequest(url: Config.supabaseURL.appendingPathComponent("auth/v1/logout"))
            r.httpMethod = "POST"; r.setValue(Config.anonKey, forHTTPHeaderField: "apikey"); r.setValue("Bearer " + t, forHTTPHeaderField: "Authorization")
            urlSession.dataTask(with: r).resume()
        }
        session = nil
    }
    private static func parseSession(_ data: Data, email: String) throws -> AuthSession {
        guard let j = JSON.decode(data), let a = j["access_token"]?.string, let r = j["refresh_token"]?.string, let uid = j["user"]?["id"]?.string else {
            throw BackendError.http(0, "réponse de connexion illisible")
        }
        let exp = j["expires_at"]?.double ?? (Date().timeIntervalSince1970 + (j["expires_in"]?.double ?? 3600))
        return AuthSession(access: a, refresh: r, expiresAt: exp, userId: uid, email: j["user"]?["email"]?.string ?? email)
    }
    private var refreshing: Task<String, Error>?
    /// Jeton valide (rafraîchi s'il expire dans moins d'une minute)
    func token() async throws -> String {
        guard let s = session else { throw BackendError.signedOut }
        if s.expiresAt - Date().timeIntervalSince1970 > 60 { return s.access }
        if let t = refreshing { return try await t.value }
        let t = Task<String, Error> {
            defer { refreshing = nil }
            let body = JSON.obj(["refresh_token": .str(s.refresh)])
            let (data, resp) = try await raw("auth/v1/token", query: [URLQueryItem(name: "grant_type", value: "refresh_token")], method: "POST", body: body.encoded(), token: nil)
            if resp.statusCode == 400 || resp.statusCode == 401 { session = nil; throw BackendError.signedOut }
            guard resp.statusCode == 200 else { throw BackendError.http(resp.statusCode, String(data: data, encoding: .utf8) ?? "") }
            let ns = try Self.parseSession(data, email: s.email)
            session = ns
            return ns.access
        }
        refreshing = t
        return try await t.value
    }

    // MARK: requêtes
    private func raw(_ path: String, query: [URLQueryItem] = [], method: String = "GET", body: Data? = nil, token: String?, headers: [String: String] = [:]) async throws -> (Data, HTTPURLResponse) {
        var comps = URLComponents(url: Config.supabaseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty {
            comps.queryItems = query
            // « + » des dates ISO : à encoder, sinon il devient une espace
            comps.percentEncodedQuery = comps.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B")
        }
        var r = URLRequest(url: comps.url!)
        r.httpMethod = method
        r.setValue(Config.anonKey, forHTTPHeaderField: "apikey")
        r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let t = token { r.setValue("Bearer " + t, forHTTPHeaderField: "Authorization") }
        for (k, v) in headers { r.setValue(v, forHTTPHeaderField: k) }
        r.httpBody = body
        let (data, resp) = try await urlSession.data(for: r)
        return (data, resp as! HTTPURLResponse)
    }
    /// Requête sur une table (PostgREST), avec le jeton de l'utilisateur
    func rest(_ table: String, query: [URLQueryItem] = [], method: String = "GET", body: JSON? = nil, headers: [String: String] = [:]) async throws -> JSON {
        let t = try await token()
        var (data, resp) = try await raw("rest/v1/" + table, query: query, method: method, body: body?.encoded(), token: t, headers: headers)
        if resp.statusCode == 401 {
            // jeton refusé : on le rafraîchit une fois
            if var s = session { s.expiresAt = 0; session = s }
            let t2 = try await token()
            (data, resp) = try await raw("rest/v1/" + table, query: query, method: method, body: body?.encoded(), token: t2, headers: headers)
        }
        guard (200..<300).contains(resp.statusCode) else {
            let j = JSON.decode(data)
            let code = j?["code"]?.string ?? "", msg = j?["message"]?.string ?? String(data: data, encoding: .utf8) ?? ""
            if code == "42501" || msg.lowercased().contains("row-level security") || msg.lowercased().contains("permission denied") { throw BackendError.refused(msg) }
            throw BackendError.http(resp.statusCode, msg)
        }
        return data.isEmpty ? .null : (JSON.decode(data) ?? .null)
    }
}

/// Session gardée dans le trousseau de l'iPhone
enum Keychain {
    private static let service = "app.alipto.session"
    static func save(_ s: AuthSession?) {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "supabase"]
        SecItemDelete(q as CFDictionary)
        guard let s, let data = try? JSONEncoder().encode(s) else { return }
        var add = q; add[kSecValueData as String] = data; add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }
    static func load() -> AuthSession? {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "supabase", kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        return try? JSONDecoder().decode(AuthSession.self, from: d)
    }
}

/// Dates ISO de la base (avec 0 à 6 décimales et un fuseau) ↔ millisecondes
enum ISOTime {
    private static let fmt: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()
    private static let plain: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime]; return f }()
    static func ms(_ s: String) -> Double? {
        // ramène les décimales à 3 chiffres (millisecondes)
        var t = s
        if let r = t.range(of: #"\.(\d+)"#, options: .regularExpression) {
            let digits = String(t[r].dropFirst())
            let three = String((digits + "000").prefix(3))
            t.replaceSubrange(r, with: "." + three)
            if let d = fmt.date(from: t) { return (d.timeIntervalSince1970 * 1000).rounded() }
        }
        if let d = plain.date(from: t) { return (d.timeIntervalSince1970 * 1000).rounded() }
        return nil
    }
    static func string(ms: Double) -> String { fmt.string(from: Date(timeIntervalSince1970: ms / 1000)) }
}
