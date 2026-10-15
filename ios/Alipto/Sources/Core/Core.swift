import Foundation
import JavaScriptCore

/// La logique de la version web (règles, lecture du jour, suivi, tests, assistant, nutrition…) tourne ici telle quelle,
/// dans JavaScriptCore : l'appli iPhone et la version web calculent exactement la même chose.
/// Les données restent dans le Store (Swift) : il en envoie une copie à la logique avant chaque appel, et ce que la
/// logique écrit (plan créé par l'assistant, journal…) revient dans le Store, qui l'enregistre et le synchronise.
final class Core {
    static let shared = Core()
    private let ctx: JSContext
    private let api: JSValue
    private var linksSig = ""
    private var subject = ""
    private var waiting: [String: (JSON?, String?) -> Void] = [:]
    private(set) var lastError: String?

    private init() {
        ctx = JSContext()!
        ctx.name = "Alipto"
        ctx.exceptionHandler = { _, ex in
            let msg = ex?.toString() ?? "?"
            Core.reportError(msg)
        }
        let native = JSValue(newObjectIn: ctx)!
        let put: @convention(block) (String, String, String) -> Void = { o, id, json in
            Store.shared.putFromCore(o, id, JSON.decode(Data(json.utf8)) ?? .null)
        }
        let remove: @convention(block) (String, String) -> Void = { o, id in Store.shared.removeFromCore(o, id) }
        let read: @convention(block) (String) -> String? = { name in
            let base = (name as NSString).deletingPathExtension, ext = (name as NSString).pathExtension
            guard let url = Bundle.main.url(forResource: base, withExtension: ext, subdirectory: "Core") ?? Bundle.main.url(forResource: base, withExtension: ext) else { return nil }
            return try? String(contentsOf: url, encoding: .utf8)
        }
        let done: @convention(block) (String, String?, String?) -> Void = { id, json, err in
            DispatchQueue.main.async { Core.shared.finish(id, json, err) }
        }
        let setSubject: @convention(block) (String) -> Void = { o in DispatchQueue.main.async { Store.shared.subject = o } }
        let sync: @convention(block) () -> Void = { DispatchQueue.main.async { Store.shared.schedule(0.2) } }
        let log: @convention(block) (String) -> Void = { print("Alipto core:", $0) }
        native.setObject(put, forKeyedSubscript: "put" as NSString)
        native.setObject(remove, forKeyedSubscript: "remove" as NSString)
        native.setObject(read, forKeyedSubscript: "readResource" as NSString)
        native.setObject(done, forKeyedSubscript: "done" as NSString)
        native.setObject(setSubject, forKeyedSubscript: "setSubject" as NSString)
        native.setObject(sync, forKeyedSubscript: "sync" as NSString)
        native.setObject(log, forKeyedSubscript: "log" as NSString)
        ctx.setObject(native, forKeyedSubscript: "__native" as NSString)
        // console.log → journal de l'appli
        ctx.evaluateScript("var console = { log: function(){ __native.log(Array.prototype.join.call(arguments, ' ')) }, warn: function(){ __native.log(Array.prototype.join.call(arguments, ' ')) }, error: function(){ __native.log(Array.prototype.join.call(arguments, ' ')) } };")
        if let url = Bundle.main.url(forResource: "alipto-core", withExtension: "js", subdirectory: "Core") ?? Bundle.main.url(forResource: "alipto-core", withExtension: "js"),
           let src = try? String(contentsOf: url, encoding: .utf8) {
            ctx.evaluateScript(src, withSourceURL: url)
        } else {
            Core.reportError("alipto-core.js introuvable dans l'appli")
        }
        api = ctx.objectForKeyedSubscript("__core")
    }

    private static func reportError(_ msg: String) {
        print("Alipto core erreur:", msg)
        Core.shared_lastError = msg
    }
    static var shared_lastError: String?

    /// Copie à jour des données, du carnet affiché et des liens avant un appel
    private func prepare() {
        let s = Store.shared
        if s.coreReset {
            s.coreReset = false; s.coreDirty.removeAll()
            api.invokeMethod("loadJSON", withArguments: [s.allDocsJSONString()])
        } else if !s.coreDirty.isEmpty {
            let keys = s.coreDirty; s.coreDirty.removeAll()
            for key in keys {
                let v: Any = s.rawDoc(key).map { String(decoding: $0.encoded(), as: UTF8.self) } ?? NSNull()
                api.invokeMethod("setJSON", withArguments: [key, v])
            }
        }
        if subject != s.subject { subject = s.subject; api.invokeMethod("setSubject", withArguments: [s.subject]) }
        let l = s.linksJSON(), sig = String(decoding: l.encoded(), as: UTF8.self)
        if sig != linksSig { linksSig = sig; api.invokeMethod("setLinksJSON", withArguments: [sig]) }
    }

    /// Appelle « module.fonction » (ou lit une constante) avec des arguments JSON ; résultat en JSON (nil si erreur)
    @discardableResult
    func call(_ path: String, _ args: JSON...) -> JSON? { callArgs(path, args) }
    func callArgs(_ path: String, _ args: [JSON]) -> JSON? {
        _ = Store.shared.version   // les vues qui affichent un résultat se mettent à jour quand les données changent
        prepare()
        let a = String(decoding: JSON.arr(args).encoded(), as: UTF8.self)
        guard let r = api.invokeMethod("call", withArguments: [path, a]), r.isString, let str = r.toString() else {
            lastError = Core.shared_lastError
            return nil
        }
        let out = JSON.decode(Data(str.utf8))
        return out == .null ? nil : out
    }
    /// Constante (catalogue, bibliothèque, lexique…) gardée en mémoire après la première lecture
    private var constants: [String: JSON] = [:]
    func constant(_ path: String) -> JSON {
        if let c = constants[path] { return c }
        let v = callArgs(path, []) ?? .null
        constants[path] = v
        return v
    }

    /// Fonction qui renvoie une promesse (chargement de la base d'aliments…)
    func callAsync(_ path: String, _ args: [JSON] = []) async throws -> JSON? {
        prepare()
        let id = UUID().uuidString
        let a = String(decoding: JSON.arr(args).encoded(), as: UTF8.self)
        return try await withCheckedThrowingContinuation { cont in
            waiting[id] = { json, err in
                if let err { cont.resume(throwing: NSError(domain: "Alipto", code: 1, userInfo: [NSLocalizedDescriptionKey: err])) }
                else { cont.resume(returning: json) }
            }
            api.invokeMethod("callAsync", withArguments: [id, path, a])
        }
    }
    private func finish(_ id: String, _ json: String?, _ err: String?) {
        guard let f = waiting.removeValue(forKey: id) else { return }
        f(json.flatMap { JSON.decode(Data($0.utf8)) }, err)
    }
}

extension Store {
    /// Document brut (clé « propriétaire|id »), pour la copie envoyée à la logique partagée
    func rawDoc(_ key: String) -> JSON? { docs[key].flatMap { $0.deleted ? nil : $0.data } }
    func allDocsJSONString() -> String {
        var o: [String: JSON] = [:]
        for (k, r) in docs where !r.deleted { if let d = r.data { o[k] = d } }
        return String(decoding: JSON.obj(o).encoded(), as: UTF8.self)
    }
    func linksJSON() -> JSON {
        var prof: [String: JSON] = [:]
        for (k, v) in profiles { prof[k] = v }
        return ["me": me.map { JSON.str($0) } ?? .null, "email": Backend.shared.session.map { JSON.str($0.email) } ?? .null,
                "athletes": .arr(athletes.map { .str($0) }), "coaches": .arr(coaches.map { .str($0) }),
                "profiles": .obj(prof), "myLock": .bool(myLock)]
    }
}
