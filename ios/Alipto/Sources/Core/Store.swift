import Foundation
import Observation
import UIKit

/// Les données d'abord sur le téléphone, synchronisées avec Supabase : les mêmes « docs » que la version web.
/// Docs : plan, p:AAAA-MM-JJ (séance prévue), j:… (journal), c:… (échanges), t:… (tests), profile, settings…
/// Chaque doc est rangé par propriétaire : « self » (le compte connecté) ou l'identifiant d'un athlète suivi.
@Observable
final class Store {
    static let shared = Store()
    static let SELF = "self"

    struct Rec: Codable, Equatable {
        var data: JSON?
        var updatedAt: Double     // millisecondes
        var dirty: Bool
        var deleted: Bool
    }
    enum SyncPhase: String { case local, idle, syncing, error, offline, signedout }

    private(set) var docs: [String: Rec] = [:]
    private(set) var version = 0
    var subject = Store.SELF
    // liens et profils
    private(set) var me: String?
    private(set) var athletes: [String] = []
    private(set) var coaches: [String] = []
    private(set) var profiles: [String: JSON] = [:]
    private(set) var myLock = false
    /// Coach : plans verrouillés, par athlète
    private(set) var locks: [String: Bool] = [:]
    // état de la synchro
    private(set) var phase: SyncPhase = .idle
    private(set) var lastSync: Date?
    private(set) var lastError: String?
    var pending: Int { docs.values.filter { $0.dirty }.count }
    /// Mode démo (captures, aperçu) : rien n'est envoyé
    private(set) var demo = false

    /// Copie envoyée à la logique partagée (Core) : tout renvoyer, ou seulement les documents modifiés
    @ObservationIgnored var coreReset = true
    @ObservationIgnored var coreDirty: Set<String> = []
    @ObservationIgnored private var saveTask: Task<Void, Never>?
    @ObservationIgnored private var syncTask: Task<Void, Never>?
    @ObservationIgnored private var syncing = false
    @ObservationIgnored private var again = false
    @ObservationIgnored private let fileURL: URL = {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("alipto-docs.json")
    }()

    private static func K(_ o: String, _ id: String) -> String { o + "|" + id }
    private static func split(_ key: String) -> (String, String) {
        guard let i = key.firstIndex(of: "|") else { return (SELF, key) }
        return (String(key[..<i]), String(key[key.index(after: i)...]))
    }

    // MARK: chargement et sauvegarde sur le téléphone
    private struct Saved: Codable { var docs: [String: Rec]; var me: String?; var athletes: [String]; var coaches: [String]; var profiles: [String: JSON]; var myLock: Bool; var locks: [String: Bool]? }
    func load() {
        guard !demo, let data = try? Data(contentsOf: fileURL), let s = try? JSONDecoder().decode(Saved.self, from: data) else { return }
        docs = s.docs; me = s.me; athletes = s.athletes; coaches = s.coaches; profiles = s.profiles; myLock = s.myLock; locks = s.locks ?? [:]
        coreReset = true
        version += 1
    }
    private func saveSoon() {
        guard !demo else { return }
        saveTask?.cancel()
        let snapshot = Saved(docs: docs, me: me, athletes: athletes, coaches: coaches, profiles: profiles, myLock: myLock, locks: locks)
        let url = fileURL
        saveTask = Task.detached(priority: .utility) {
            try? await Task.sleep(nanoseconds: 400_000_000)
            if Task.isCancelled { return }
            if let data = try? JSONEncoder().encode(snapshot) { try? data.write(to: url, options: .atomic) }
        }
    }
    func wipe() {
        docs = [:]; me = nil; athletes = []; coaches = []; profiles = [:]; myLock = false; locks = [:]; subject = Store.SELF
        try? FileManager.default.removeItem(at: fileURL)
        coreReset = true
        UserDefaults.standard.dictionaryRepresentation().keys.filter { $0.hasPrefix("cursor:") }.forEach { UserDefaults.standard.removeObject(forKey: $0) }
        version += 1
    }
    func loadDemo(_ map: [String: JSON]) {
        demo = true
        docs = Dictionary(uniqueKeysWithValues: map.map { (Store.K(Store.SELF, $0.key), Rec(data: $0.value, updatedAt: Date().timeIntervalSince1970 * 1000, dirty: false, deleted: false)) })
        phase = .local; coreReset = true; version += 1
    }

    // MARK: lecture / écriture
    /// Coach : verrouille ou déverrouille le plan d'un athlète (lui ne peut plus le modifier)
    @MainActor
    func setLock(_ athlete: String, _ v: Bool) async throws {
        guard let me else { throw BackendError.signedOut }
        _ = try await Backend.shared.rest("coach_links", query: [URLQueryItem(name: "coach_id", value: "eq." + me), URLQueryItem(name: "athlete_id", value: "eq." + athlete)],
                                          method: "PATCH", body: ["plan_locked": .bool(v)], headers: ["Prefer": "return=minimal"])
        locks[athlete] = v
        version += 1; saveSoon()
    }
    /// Ligne « profiles » mise à jour après un enregistrement du profil
    func setProfileRow(_ uid: String, _ row: JSON) {
        profiles[uid] = row
        if me == nil { me = uid }
        version += 1; saveSoon()
    }
    var role: String { me.flatMap { profiles[$0]?["role"]?.string } ?? "athlete" }
    var isCoach: Bool { role == "coach" }
    var isAdmin: Bool { role == "admin" }
    /// Un coach n'a pas de carnet personnel
    var hasCarnet: Bool { role != "coach" }
    var myRow: JSON? { me.flatMap { profiles[$0] } }
    /// Date de dernière modification d'un document (millisecondes)
    func updatedAt(_ id: String, owner: String) -> Double? { docs[Store.K(owner, id)].flatMap { $0.deleted ? nil : $0.updatedAt } }
    var isSelf: Bool { subject == Store.SELF }
    func get(_ id: String, owner: String? = nil) -> JSON? {
        guard let r = docs[Store.K(owner ?? subject, id)], !r.deleted else { return nil }
        return r.data
    }
    func ids(_ prefix: String, owner: String? = nil) -> [String] {
        let pre = Store.K(owner ?? subject, prefix), o = owner ?? subject
        return docs.compactMap { k, r in k.hasPrefix(pre) && !r.deleted ? String(k.dropFirst(o.count + 1)) : nil }.sorted()
    }
    func put(_ id: String, _ data: JSON, owner: String? = nil) {
        let key = Store.K(owner ?? subject, id)
        docs[key] = Rec(data: data, updatedAt: (Date().timeIntervalSince1970 * 1000).rounded(), dirty: true, deleted: false)
        coreDirty.insert(key)
        version += 1; saveSoon(); schedule()
    }
    func remove(_ id: String, owner: String? = nil) {
        let key = Store.K(owner ?? subject, id)
        docs[key] = Rec(data: nil, updatedAt: (Date().timeIntervalSince1970 * 1000).rounded(), dirty: true, deleted: true)
        coreDirty.insert(key)
        version += 1; saveSoon(); schedule()
    }
    /// Écritures faites par la logique partagée (elle a déjà sa copie à jour)
    func putFromCore(_ owner: String, _ id: String, _ data: JSON) {
        docs[Store.K(owner, id)] = Rec(data: data, updatedAt: (Date().timeIntervalSince1970 * 1000).rounded(), dirty: true, deleted: false)
        version += 1; saveSoon(); schedule()
    }
    func removeFromCore(_ owner: String, _ id: String) {
        docs[Store.K(owner, id)] = Rec(data: nil, updatedAt: (Date().timeIntervalSince1970 * 1000).rounded(), dirty: true, deleted: true)
        version += 1; saveSoon(); schedule()
    }
    /// Journal du jour (toujours un objet)
    func journal(_ k: String) -> JSON { get("j:" + k) ?? .emptyObject }
    /// Modifie le journal en gardant tous les autres champs ; une valeur nulle retire le champ.
    /// Le journal ne s'écrit que dans son propre carnet (en vue coach, il est en lecture seule).
    func jset(_ k: String, _ patch: [String: JSON?]) {
        guard isSelf else { return }
        var cur = journal(k).object
        for (key, v) in patch { if let v, v != .null { cur[key] = v } else { cur.removeValue(forKey: key) } }
        put("j:" + k, .obj(cur))
    }
    var planLocked: Bool { isSelf && myLock }
    var canEditPlan: Bool { !planLocked }
    func profile(_ owner: String? = nil) -> JSON {
        let o = owner ?? subject
        var p = get("profile", owner: o)?.object ?? [:]
        let uid = o == Store.SELF ? me : o
        if let uid, let row = profiles[uid]?.object {
            for k in ["name", "role", "sex", "birth_year", "height_cm", "weight_kg", "onboarded"] { if let v = row[k], v != .null, v != .str("") { p[k] = v } }
        }
        if let by = p["birth_year"]?.int { p["under18"] = .bool(Calendar.current.component(.year, from: Date()) - by < 18) }
        return .obj(p)
    }
    func name(_ owner: String) -> String { profile(owner)["name"]?.string ?? (owner == Store.SELF ? "Moi" : "Athlète") }

    // MARK: synchronisation (même protocole que la version web)
    func schedule(_ delay: Double = 1.5) {
        guard !demo, Backend.shared.signedIn else { return }
        syncTask?.cancel()
        syncTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            if Task.isCancelled { return }
            await self?.syncNow()
        }
    }
    @MainActor
    func syncNow() async {
        guard !demo else { return }
        if syncing { again = true; return }
        guard let session = Backend.shared.session else { phase = .signedout; return }
        syncing = true; phase = .syncing
        defer { syncing = false; if again { again = false; schedule(0.4) } }
        do {
            let uid = session.userId
            if me != uid { me = uid }
            // 1. envoyer ce qui a changé ici
            let dirty = docs.filter { $0.value.dirty }
            let entries = Array(dirty)
            var i = 0
            while i < entries.count {
                let chunk = Array(entries[i..<min(i + 100, entries.count)])
                let rows = chunk.map { k, r -> JSON in
                    let (o, id) = Store.split(k)
                    return .obj(["user_id": .str(o == Store.SELF ? uid : o), "id": .str(id), "data": r.data ?? .emptyObject,
                                 "updated_at": .str(ISOTime.string(ms: r.updatedAt)), "deleted": .bool(r.deleted)])
                }
                do {
                    _ = try await Backend.shared.rest("docs", query: [URLQueryItem(name: "on_conflict", value: "user_id,id")], method: "POST", body: .arr(rows),
                                                      headers: ["Prefer": "resolution=merge-duplicates,return=minimal"])
                    for (k, r) in chunk where docs[k]?.updatedAt == r.updatedAt { docs[k]?.dirty = false }
                } catch BackendError.refused {
                    // un envoi refusé (plan verrouillé, droit du coach) : on reprend un par un et on remet la version du serveur
                    for (j, (k, r)) in chunk.enumerated() {
                        do {
                            _ = try await Backend.shared.rest("docs", query: [URLQueryItem(name: "on_conflict", value: "user_id,id")], method: "POST", body: .arr([rows[j]]),
                                                              headers: ["Prefer": "resolution=merge-duplicates,return=minimal"])
                            if docs[k]?.updatedAt == r.updatedAt { docs[k]?.dirty = false }
                        } catch BackendError.refused {
                            await revert(k, rows[j])
                        }
                    }
                }
                i += 100
            }
            // 2. profils, liens coach / athlètes, verrous
            let lr = try? await Backend.shared.rest("coach_links", query: [URLQueryItem(name: "select", value: "coach_id,athlete_id,plan_locked")])
            let pr = try? await Backend.shared.rest("profiles", query: [URLQueryItem(name: "select", value: "*")])
            if let pr { var m: [String: JSON] = [:]; for r in pr.array { if let id = r["id"]?.string { m[id] = r } }; profiles = m }
            var fresh = false
            if let lr {
                let before = Set(athletes)
                athletes = lr.array.filter { $0["coach_id"]?.string == uid }.compactMap { $0["athlete_id"]?.string }
                coaches = lr.array.filter { $0["athlete_id"]?.string == uid }.compactMap { $0["coach_id"]?.string }
                myLock = lr.array.contains { $0["athlete_id"]?.string == uid && $0["plan_locked"]?.truthy == true }
                var lk: [String: Bool] = [:]
                for r in lr.array where r["coach_id"]?.string == uid { if let a = r["athlete_id"]?.string { lk[a] = r["plan_locked"]?.truthy ?? false } }
                locks = lk
                fresh = athletes.contains { !before.contains($0) }
                // athlète retiré : ses données ne restent pas sur ce téléphone
                for a in before where !athletes.contains(a) {
                    for k in docs.keys where k.hasPrefix(a + "|") { docs.removeValue(forKey: k); coreDirty.insert(k) }
                    if subject == a { subject = Store.SELF }
                }
            }
            // 3. récupérer ce qui a changé ailleurs
            let ckey = "cursor:" + uid
            let cursor = (!fresh ? UserDefaults.standard.string(forKey: ckey) : nil) ?? "1970-01-01T00:00:00+00:00"
            var maxT = ISOTime.ms(cursor) ?? 0, maxS = cursor, offset = 0, changed = false
            while true {
                let rows = try await Backend.shared.rest("docs", query: [
                    URLQueryItem(name: "select", value: "user_id,id,data,updated_at,synced_at,deleted"),
                    URLQueryItem(name: "synced_at", value: "gt." + cursor),
                    URLQueryItem(name: "order", value: "synced_at.asc"),
                    URLQueryItem(name: "limit", value: "500"), URLQueryItem(name: "offset", value: String(offset))
                ]).array
                for row in rows {
                    guard let owner = row["user_id"]?.string, let id = row["id"]?.string else { continue }
                    let key = Store.K(owner == uid ? Store.SELF : owner, id)
                    let ru = ISOTime.ms(row["updated_at"]?.string ?? "") ?? 0
                    let del = row["deleted"]?.truthy ?? false
                    let data: JSON? = del ? nil : row["data"]
                    let loc = docs[key]
                    if loc == nil || ru > loc!.updatedAt || (!loc!.dirty && ru == loc!.updatedAt && loc!.data != data) {
                        docs[key] = Rec(data: data, updatedAt: ru, dirty: false, deleted: del); changed = true; coreDirty.insert(key)
                    }
                    if let st = row["synced_at"]?.string, let t = ISOTime.ms(st), t > maxT { maxT = t; maxS = st }
                }
                if rows.count < 500 { break }
                offset += 500
            }
            UserDefaults.standard.set(maxS, forKey: ckey)
            lastSync = Date(); lastError = nil; phase = .idle
            if changed { version += 1 }
            saveSoon()
        } catch BackendError.signedOut {
            phase = .signedout
        } catch {
            lastError = error.localizedDescription
            phase = (error as? URLError) != nil ? .offline : .error
        }
    }
    private func revert(_ key: String, _ row: JSON) async {
        guard let uid = row["user_id"]?.string, let id = row["id"]?.string else { return }
        let r = try? await Backend.shared.rest("docs", query: [URLQueryItem(name: "select", value: "data,updated_at,deleted"), URLQueryItem(name: "user_id", value: "eq." + uid), URLQueryItem(name: "id", value: "eq." + id)])
        if let first = r?[0] {
            let del = first["deleted"]?.truthy ?? false
            docs[key] = Rec(data: del ? nil : first["data"], updatedAt: ISOTime.ms(first["updated_at"]?.string ?? "") ?? 0, dirty: false, deleted: del)
        } else { docs.removeValue(forKey: key) }
        coreDirty.insert(key)
        version += 1
    }
    /// Synchro régulière quand l'appli est ouverte
    func startAutoSync() {
        guard !demo else { return }
        Task { @MainActor in
            while true {
                if UIApplication.shared.applicationState == .active { await syncNow() }
                try? await Task.sleep(nanoseconds: 45_000_000_000)
            }
        }
    }
}
