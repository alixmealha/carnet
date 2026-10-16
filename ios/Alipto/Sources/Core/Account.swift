import Foundation

/// Comptes (comme account.js de la version web) : profil, codes de partage athlète → coach, liens, mot de passe, administration.
enum Account {
    private static let alpha = Array("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")   // sans 0/O ni 1/I
    static func fmtCode(_ c: String) -> String {
        var out = ""
        for (i, ch) in c.enumerated() { if i > 0 && i % 4 == 0 { out += "-" }; out.append(ch) }
        return out
    }
    static func tempPassword() -> String {
        let a = Array("abcdefghjkmnpqrstuvwxyz23456789")
        let s = String((0..<10).map { _ in a[Int.random(in: 0..<a.count)] })
        return String(s.prefix(5)) + "-" + String(s.suffix(5))
    }
    /// Message d'erreur lisible
    static func fr(_ e: Error) -> String {
        let m = e.localizedDescription
        if m.range(of: "offline|network|connexion|timed out|Internet", options: [.regularExpression, .caseInsensitive]) != nil { return "Impossible de joindre le serveur. Vérifie ta connexion." }
        if m.range(of: "schema cache|does not exist|Could not find the (table|function)", options: .regularExpression) != nil { return "La base n’est pas à jour : lance le script de l’étape 2 dans Supabase." }
        if case BackendError.refused = e { return "Action non autorisée pour ce compte." }
        return m
    }
    private static func eq(_ k: String, _ v: String) -> URLQueryItem { URLQueryItem(name: k, value: "eq." + v) }
    private static var me: String? { Backend.shared.session?.userId }

    // MARK: profil (ligne « profiles » : prénom, sexe, naissance, taille, poids, rôle) + document « profile » (sports, régime, repères…)
    static let profileCols = ["name", "sex", "birth_year", "height_cm", "weight_kg", "onboarded"]
    static let docKeys = ["sports", "diet", "nutri", "levels"]

    @MainActor
    static func saveProfile(_ patch: [String: JSON]) async throws {
        let s = Store.shared
        var doc = s.get("profile", owner: Store.SELF) ?? .emptyObject
        var docChanged = false
        for k in docKeys { if let v = patch[k] { doc[k] = v; docChanged = true } }
        if docChanged { s.put("profile", doc, owner: Store.SELF) }
        guard profileCols.contains(where: { patch[$0] != nil }) || patch["role"] != nil else { return }
        if s.demo { return }
        guard let me else { throw BackendError.signedOut }
        var clean: [String: JSON] = [:]
        for k in profileCols { if let v = patch[k] { clean[k] = v == .str("") ? .null : v } }
        let cur = try await Backend.shared.rest("profiles", query: [URLQueryItem(name: "select", value: "*"), eq("id", me)])
        let rows: JSON
        if cur.array.isEmpty {
            var ins = clean
            ins["id"] = .str(me)
            ins["role"] = .str(patch["role"]?.string == "coach" ? "coach" : "athlete")
            rows = try await Backend.shared.rest("profiles", method: "POST", body: .obj(ins), headers: ["Prefer": "return=representation"])
        } else {
            rows = try await Backend.shared.rest("profiles", query: [eq("id", me)], method: "PATCH", body: .obj(clean), headers: ["Prefer": "return=representation"])
        }
        if let row = rows.array.first { s.setProfileRow(me, row) }
    }

    // MARK: athlète : codes de partage
    static func newCode() async throws -> JSON {
        let code = String((0..<8).map { _ in alpha[Int.random(in: 0..<alpha.count)] })
        let r = try await Backend.shared.rest("invite_codes", method: "POST", body: ["code": .str(code)], headers: ["Prefer": "return=representation"])
        return r.array.first ?? ["code": .str(code), "expires_at": .str(ISOTime.string(ms: (Date().timeIntervalSince1970 + 7 * 86400) * 1000))]
    }
    static func myCodes() async throws -> [JSON] {
        let r = try await Backend.shared.rest("invite_codes", query: [URLQueryItem(name: "select", value: "code,expires_at"), URLQueryItem(name: "order", value: "created_at.desc")])
        let now = Date().timeIntervalSince1970 * 1000
        return r.array.filter { (ISOTime.ms($0["expires_at"]?.string ?? "") ?? 0) > now }
    }
    static func deleteCode(_ code: String) async throws {
        _ = try await Backend.shared.rest("invite_codes", query: [eq("code", code)], method: "DELETE", headers: ["Prefer": "return=minimal"])
    }

    // MARK: coach : ajouter un athlète, retirer un lien
    @MainActor
    static func redeem(_ code: String) async throws -> String? {
        let c = code.uppercased().filter { $0.isLetter || $0.isNumber }
        let r = try await Backend.shared.rest("rpc/redeem_code", method: "POST", body: ["c": .str(c)])
        await Store.shared.syncNow()
        return r["athlete_id"]?.string ?? r.array.first?["athlete_id"]?.string
    }
    @MainActor
    static func unlink(coach: String, athlete: String) async throws {
        _ = try await Backend.shared.rest("coach_links", query: [eq("coach_id", coach), eq("athlete_id", athlete)], method: "DELETE", headers: ["Prefer": "return=minimal"])
        await Store.shared.syncNow()
    }

    // MARK: mot de passe
    static func changePassword(_ pw: String) async throws {
        try await Backend.shared.auth("user", method: "PUT", body: ["password": .str(pw)])
    }
    /// Mot de passe oublié : e-mail avec un lien qui rouvre la version web sur « Nouveau mot de passe »
    static func forgotPassword(_ email: String) async throws {
        do {
            try await Backend.shared.auth("recover", method: "POST", body: ["email": .str(email.trimmingCharacters(in: .whitespaces).lowercased())],
                                          query: [URLQueryItem(name: "redirect_to", value: Config.webURL.absoluteString)], signedIn: false)
        } catch BackendError.http(let code, let m) {
            if code == 429 || m.range(of: "after \\d+ seconds|rate limit|too many", options: [.regularExpression, .caseInsensitive]) != nil { throw BackendError.http(0, "Un e-mail vient déjà de partir : attends une minute avant d’en redemander un.") }
            if m.range(of: "sending|smtp|not authorized", options: [.regularExpression, .caseInsensitive]) != nil { throw BackendError.http(0, "L’e-mail n’a pas pu partir. Demande à ton coach ou à l’administrateur de te redéfinir un mot de passe.") }
            throw BackendError.http(code, m)
        }
    }

    // MARK: administration
    static func adminUsers() async throws -> [JSON] { try await Backend.shared.rest("rpc/admin_users", method: "POST", body: .emptyObject).array }
    static func adminSetRole(_ uid: String, _ r: String) async throws { _ = try await Backend.shared.rest("rpc/admin_set_role", method: "POST", body: ["uid": .str(uid), "r": .str(r)]) }
    static func adminLink(coach: String, athlete: String, linked: Bool) async throws {
        _ = try await Backend.shared.rest("rpc/admin_link", method: "POST", body: ["coach": .str(coach), "athlete": .str(athlete), "linked": .bool(linked)])
    }
    /// Fonction « admin » (création de compte, mot de passe, suppression)
    static func adminFn(_ body: [String: JSON]) async throws -> JSON {
        var b = body
        b["redirectTo"] = .str(Config.webURL.absoluteString)
        do {
            let r = try await Backend.shared.function("admin", body: .obj(b))
            if let e = r["error"]?.string { throw BackendError.http(0, e) }
            return r
        } catch BackendError.http(let code, let m) {
            if code == 404 { throw BackendError.http(0, "La fonction « admin » n’est pas déployée dans Supabase (Edge Functions → nom exact : admin).") }
            if code == 401 && !m.contains("Session") { throw BackendError.http(0, "Supabase refuse l’appel : désactive « Verify JWT » sur la fonction admin (Edge Functions → admin → Details).") }
            throw BackendError.http(code, (JSON.decode(Data(m.utf8))?["error"]?.string) ?? m)
        }
    }
}

extension Backend {
    /// Appel à l'API d'authentification (mot de passe, récupération)
    func auth(_ path: String, method: String, body: JSON, query: [URLQueryItem] = [], signedIn: Bool = true) async throws {
        var comps = URLComponents(url: Config.supabaseURL.appendingPathComponent("auth/v1/" + path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { comps.queryItems = query }
        var r = URLRequest(url: comps.url!)
        r.httpMethod = method
        r.setValue(Config.anonKey, forHTTPHeaderField: "apikey")
        r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if signedIn { r.setValue("Bearer " + (try await token()), forHTTPHeaderField: "Authorization") }
        r.httpBody = body.encoded()
        let (data, resp) = try await URLSession.shared.data(for: r)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(code) else {
            let j = JSON.decode(data)
            let msg = j?["msg"]?.string ?? j?["error_description"]?.string ?? j?["message"]?.string ?? String(decoding: data, as: UTF8.self)
            if msg.range(of: "different|same", options: .caseInsensitive) != nil { throw BackendError.http(code, "Choisis un mot de passe différent de l’actuel.") }
            throw BackendError.http(code, msg)
        }
    }
    /// Appel d'une fonction Supabase (Edge Function), avec le jeton de l'utilisateur
    func function(_ name: String, body: JSON) async throws -> JSON {
        var r = URLRequest(url: Config.supabaseURL.appendingPathComponent("functions/v1/" + name))
        r.httpMethod = "POST"
        r.setValue(Config.anonKey, forHTTPHeaderField: "apikey")
        r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        r.setValue("Bearer " + (try await token()), forHTTPHeaderField: "Authorization")
        r.httpBody = body.encoded()
        let (data, resp) = try await URLSession.shared.data(for: r)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(code) else { throw BackendError.http(code, String(decoding: data, as: UTF8.self)) }
        return JSON.decode(data) ?? .null
    }
}
