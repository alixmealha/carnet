import Foundation

// Lecture du plan (mêmes documents que la version web) : jours, blocs, exercices, minuteurs.

let KIND: [String: String] = ["grimpe": "Escalade", "doigts": "Doigts", "muscu": "Muscu", "renfo": "Renfo", "epaule": "Épaule", "kine": "Kiné", "velo": "Cardio", "course": "Course", "sport": "Sport", "test": "Test", "compet": "Compétition", "affut": "Affûtage", "recup": "Récupération", "autre": "Autre", "rest": "Repos"]
let PHASE_LABEL: [String: String] = ["volume": "Volume", "reprise": "Reprise", "force": "Force", "puissance": "Puissance", "specifique": "Spécifique", "affutage": "Affûtage", "recup": "Récupération", "deload": "Décharge", "transition": "Transition", "coupure": "Coupure", "autre": "Cycle"]

/// Minuteur d'un exercice ou d'un bloc
struct TimerSpec: Equatable {
    let raw: JSON
    var kind: String { raw["kind"]?.string ?? "interval" }
    var name: String { raw["name"]?.string ?? "" }
    var work: Double { raw["work"]?.double ?? 7 }
    var rest: Double { raw["rest"]?.double ?? 3 }
    var reps: Int { raw["reps"]?.int ?? 1 }
    var sets: Int { raw["sets"]?.int ?? 1 }
    var setRest: Double { raw["setRest"]?.double ?? 0 }
    var prep: Double { raw["prep"]?.double ?? 10 }
    var workLabel: String { raw["workLabel"]?.string ?? "Effort" }
    var restLabel: String { raw["restLabel"]?.string ?? "Repos" }
    var markEach: String { raw["markEach"]?.string ?? "set" }
    var sides: [String] { raw["sides"]?.array.compactMap { $0.string } ?? [] }
    var items: [String] { raw["items"]?.array.compactMap { $0.string } ?? [] }
    var heavyRest: Double { raw["heavyRest"]?.double ?? 240 }
    var lightRest: Double { raw["lightRest"]?.double ?? 180 }
    var intra: Double { raw["intra"]?.double ?? 20 }
    var ecc: Double { raw["ecc"]?.double ?? 6 }
    var ret: Double { raw["ret"]?.double ?? 4 }
}

struct Item: Identifiable, Equatable {
    let raw: JSON
    var id: String { raw["id"]?.string ?? "x" }
    var label: String { raw["label"]?.string ?? "Exercice" }
    var det: String? { raw["det"]?.string.flatMap { $0.isEmpty ? nil : $0 } }
    var n: Int { max(1, raw["n"]?.int ?? 1) }
    var unit: String { raw["unit"]?.string ?? "Série" }
    var rest: Double? { raw["rest"]?.double }
    var load: Double? { raw["load"]?.double }
    var unitLoad: String { raw["unit_load"]?.string ?? "kg" }
    var reps: Int? { raw["reps"]?.int }
    var timer: TimerSpec? { raw["timer"].flatMap { $0.isNull ? nil : TimerSpec(raw: $0) } }
    var lib: String? { raw["lib"]?.string }
    var opt: Bool { raw["opt"]?.truthy ?? false }
    var grade: String? { raw["grade"]?.string }
    var warn: String? { raw["warn"]?.string }
    var repsBySet: [Int]? { raw["repsBySet"].map { $0.array.compactMap { $0.int } } }
    var superset: String? { raw["superset"]?.string }
    /// Séance adaptée : nombre prévu à l'origine, note (« 25 min au lieu de 35 »)
    var adjN0: Int? { raw["adj"]?["n0"]?.int }
    var adjNote: String? { raw["adj"]?["note"]?.string }
    /// Exercice fait à la place de celui du plan : nom de l'exercice prévu
    var swapFrom: String? { raw["swap"]?["from"]?.string }
    var isWarmup: Bool { id == "ech" }
    var isCooldown: Bool { id == "rac" }
    var unitWord: String {
        switch unit {
        case "Bloc": return "bloc"
        case "Essai": return "essai"
        case "Voie": return "voie"
        default: return timer?.markEach == "rep" ? "répétition" : "série"
        }
    }
    var climbable: Bool { ["Bloc", "Voie", "Essai"].contains(unit) }
    func with(_ key: String, _ v: JSON?) -> Item { var r = raw; r[key] = v; return Item(raw: r) }
}

struct Block: Identifiable, Equatable {
    let raw: JSON
    var id: String { raw["id"]?.string ?? "b" }
    var kind: String { raw["kind"]?.string ?? "autre" }
    var title: String { raw["title"]?.string ?? (KIND[kind] ?? "Bloc") }
    var desc: String? { raw["desc"]?.string.flatMap { $0.isEmpty ? nil : $0 } }
    var sub: String? { raw["sub"]?.string.flatMap { $0.isEmpty ? nil : $0 } }
    var items: [Item] { raw["items"]?.array.map { Item(raw: $0) } ?? [] }
    var timer: TimerSpec? { raw["timer"].flatMap { $0.isNull ? nil : TimerSpec(raw: $0) } }
    var movedFrom: String? { raw["movedFrom"]?.string }
    var isRest: Bool { kind == "rest" }
}

struct Week: Equatable {
    let raw: JSON
    var start: String { raw["start"]?.string ?? "" }
    var end: String { raw["end"]?.string ?? "" }
    var phase: String { raw["phase"]?.string ?? "" }
    var bloc: String? { raw["bloc"]?.string }
    var label: String { raw["label"]?.string ?? ("S" + String(raw["n"]?.int ?? 0)) }
    var phaseLabel: String { PHASE_LABEL[phase] ?? bloc ?? "" }
    var why: String? { raw["why"]?.string }
}

struct Target: Equatable {
    let raw: JSON
    var rpe: (Int, Int)? { let a = raw["rpe"]?.array.compactMap { $0.int } ?? []; return a.count == 2 ? (a[0], a[1]) : nil }
    var why: String? { raw["why"]?.string }
    static func == (a: Target, b: Target) -> Bool { a.raw == b.raw }
}

/// Lecture du plan d'un carnet (celui affiché)
struct PlanReader {
    let s: Store
    init(_ s: Store = .shared) { self.s = s }

    var meta: JSON? { s.get("plan") }
    func day(_ k: String) -> JSON? { s.get("p:" + k) }
    func rawBlocks(_ k: String) -> [JSON] { day(k)?["blocks"]?.array ?? [] }

    /// Blocs du jour, avec l'adaptation éventuelle (moins de temps, allégée) appliquée — comme la version web
    func blocks(_ k: String) -> [Block] {
        let j = s.journal(k)
        var arr = rawBlocks(k)
        if let items = j["adj"]?["items"]?.object { arr = Self.applyAdj(arr, items) }
        if let sw = j["swap"]?.object, !sw.isEmpty { arr = Self.applySwap(arr, sw) }
        if let o = j["order"]?.array, !o.isEmpty { arr = Self.applyOrder(arr, o.compactMap { $0.string }) }
        return arr.map { Block(raw: $0) }
    }
    private static func applyAdj(_ bl: [JSON], _ items: [String: JSON]) -> [JSON] {
        var out: [JSON] = []
        for b in bl {
            let bid = b["id"]?.string ?? ""
            let g = items["b:" + bid]
            if g?["drop"]?.truthy == true { continue }
            let hasTimer = b["timer"] != nil && b["timer"] != .null
            var its: [JSON] = []
            for it in b["items"]?.array ?? [] {
                let iid = it["id"]?.string ?? ""
                let x = items[bid + "." + iid]
                if x?["drop"]?.truthy == true { continue }
                if let g, hasTimer, iid != "ech" { its.append(Self.adjItem(it, g["n"]?.int, nil)); continue }
                its.append(x != nil ? Self.adjItem(it, x?["n"]?.int, x?["note"]?.string) : it)
            }
            if !(b["items"]?.array ?? []).isEmpty && its.isEmpty { continue }
            var nb = b; nb["items"] = .arr(its)
            if let g, hasTimer, let n = g["n"]?.int, var t = b["timer"] { t["sets"] = .num(Double(n)); nb["timer"] = t }
            out.append(nb)
        }
        return out
    }
    /// Exercice fait à la place de celui du plan : même clé (les séries cochées restent), sans minuteur ni charge en kilos
    private static func applySwap(_ bl: [JSON], _ sw: [String: JSON]) -> [JSON] {
        bl.map { b in
            let bid = b["id"]?.string ?? ""
            guard let its = b["items"]?.array, its.contains(where: { sw[bid + "." + ($0["id"]?.string ?? "")] != nil }) else { return b }
            var nb = b
            nb["items"] = .arr(its.map { it in
                guard let x = sw[bid + "." + (it["id"]?.string ?? "")] else { return it }
                var c = it
                c["label"] = .str(x["label"]?.string ?? it["label"]?.string ?? "Exercice")
                c["det"] = .str(x["det"]?.string ?? "")
                c["swap"] = .obj(["from": it["label"] ?? .str("Exercice")])
                for key in ["load", "unit_load", "repsBySet", "lib", "adj"] { c[key] = nil }
                if let l = x["lib"]?.string, !l.isEmpty { c["lib"] = .str(l) }
                // le minuteur du plan reste valable (mêmes temps) ; seul son libellé suit l'exercice
                if var t = c["timer"], t != .null {
                    t["name"] = c["label"]
                    if t["workLabel"]?.string == "Lève" { t["workLabel"] = .str("Suspends") }
                    c["timer"] = t
                }
                return c
            })
            return nb
        }
    }
    /// Ordre réellement suivi : les blocs listés reprennent, dans l'ordre noté, les places qu'ils occupent
    private static func applyOrder(_ bl: [JSON], _ order: [String]) -> [JSON] {
        var rank: [String: Int] = [:]
        for (i, id) in order.enumerated() { rank[id] = i }
        var slots: [Int] = [], list: [JSON] = []
        for (i, b) in bl.enumerated() where b["kind"]?.string != "rest" {
            if let id = b["id"]?.string, rank[id] != nil { slots.append(i); list.append(b) }
        }
        list.sort { (rank[$0["id"]?.string ?? ""] ?? 0) < (rank[$1["id"]?.string ?? ""] ?? 0) }
        var out = bl
        for (n, i) in slots.enumerated() { out[i] = list[n] }
        return out
    }
    private static func adjItem(_ it: JSON, _ n: Int?, _ note: String?) -> JSON {
        var c = it
        let n0 = it["n"]?.int ?? 1
        c["adj"] = .obj(["n0": .num(Double(n0)), "note": note.map { .str($0) } ?? .null].filter { $0.value != .null })
        guard let n, n != n0 else { return c }
        c["n"] = .num(Double(n))
        let lead = String(n0) + " "
        if let l = it["label"]?.string, l.hasPrefix(lead) { c["label"] = .str(String(n) + " " + l.dropFirst(lead.count)) }
        if var t = it["timer"], t != .null {
            if t["markEach"]?.string == "rep" { t["reps"] = .num(Double(n)) } else if t["sets"] != nil { t["sets"] = .num(Double(n)) }
            c["timer"] = t
        }
        if let r = it["repsBySet"]?.array { c["repsBySet"] = .arr(Array(r.prefix(n))) }
        return c
    }

    func target(_ k: String) -> Target? { day(k)?["target"].flatMap { $0.isNull ? nil : Target(raw: $0) } }
    func weeks() -> [Week] { meta?["weeks"]?.array.map { Week(raw: $0) } ?? [] }
    func week(_ k: String) -> Week? { weeks().first { k >= $0.start && k <= $0.end } }
    static func itemKey(_ b: Block, _ it: Item) -> String { b.id + "." + it.id }
    static func doneN(_ e: JSON, _ key: String, _ n: Int) -> Int { min(n, max(0, e["done"]?[key]?.int ?? 0)) }
    /// Blocs (voies, essais) faits en plus du plan : compteur séparé, le « fait / prévu » reste plafonné au plan
    static func plusN(_ e: JSON, _ key: String) -> Int { min(99, max(0, e["plus"]?[key]?.int ?? 0)) }
    static func blockState(_ e: JSON, _ b: Block) -> String? {
        if e["apart"]?[b.id] != nil { return "apart" }
        if e["moved"]?[b.id] != nil { return "moved" }
        if e["skip"]?[b.id] != nil { return "skip" }
        return nil
    }
    /// Progression de la séance principale (sans les blocs faits à part ou déplacés)
    func progress(_ k: String, part: String? = nil) -> (total: Int, done: Int, skipped: Int) {
        let e = s.journal(k); var total = 0, done = 0, skipped = 0
        for b in blocks(k) where !b.isRest {
            let st = Self.blockState(e, b)
            if let part { if b.id != part { continue } }
            else if st == "apart" || st == "moved" { continue }
            else if st == "skip" { skipped += b.items.count; continue }
            for it in b.items {
                let v = Self.doneN(e, Self.itemKey(b, it), it.n)
                if it.opt && v == 0 { continue }
                total += 1; if v >= it.n { done += 1 }
            }
        }
        return (total, done, skipped)
    }
    func sessionName(_ k: String) -> String {
        if let s = day(k)?["short"]?.string, !s.isEmpty { return s }
        var n: [String] = []
        for b in blocks(k) where !b.isRest {
            let s = b.kind == "grimpe" ? b.title.replacingOccurrences(of: "Escalade · ", with: "Grimpe ") : b.kind == "muscu" ? String(b.title.split(separator: "·").first ?? Substring(b.title)).trimmingCharacters(in: .whitespaces) : (KIND[b.kind] ?? b.title)
            if !n.contains(s) { n.append(s) }
        }
        return n.isEmpty ? "Repos" : n.joined(separator: ", ")
    }
    func kinds(_ k: String) -> [String] { var out: [String] = []; for b in blocks(k) where !b.isRest && !out.contains(b.kind) { out.append(b.kind) }; return out }
    func hasSession(_ k: String) -> Bool { blocks(k).contains { !$0.isRest } }

    /// Prochaine échéance : compétition à venir ou objectif du plan
    func nextEvent(from t: String = D.today) -> (date: String, label: String)? {
        guard let m = meta else { return nil }
        let evs = m["events"]?.array ?? []
        let up = evs.filter { ($0["end"]?.string ?? $0["date"]?.string ?? "") >= t }.sorted { ($0["date"]?.string ?? "") < ($1["date"]?.string ?? "") }
        if let e = up.first, let d = e["date"]?.string { return (d, e["label"]?.string ?? "Objectif") }
        if let g = m["goal"], let d = g["date"]?.string, d >= t { return (d, g["label"]?.string ?? "Objectif") }
        return nil
    }
    func eventOn(_ k: String) -> String? {
        for e in meta?["events"]?.array ?? [] { if let d = e["date"]?.string, k >= d, k <= (e["end"]?.string ?? d) { return e["label"]?.string } }
        return nil
    }

    /// Charge de l'exercice : la sienne (modifiée en séance) ou celle du plan
    static func itemLoad(_ b: Block, _ it: Item, _ e: JSON) -> (v: Double, u: String, changed: Bool)? {
        let own = e["loads"]?[itemKey(b, it)]?.double
        guard it.load != nil || own != nil else { return nil }
        let v = own ?? it.load!
        return (v, it.unitLoad, it.load != nil && own != nil && own != it.load)
    }
    static func loadText(_ v: Double, _ u: String) -> String { (u == "+kg" && v >= 0 ? "+" : "") + Fmt.num(v) + " kg" }
    static func setLoads(_ e: JSON, _ key: String) -> [Double]? { let a = e["setLoads"]?[key]?.array.compactMap { $0.double } ?? []; return a.isEmpty ? nil : a }
}

/// Écritures dans le journal du jour (cocher des séries, statut, ressenti…)
struct JournalWriter {
    let s: Store
    init(_ s: Store = .shared) { self.s = s }

    func setDone(_ k: String, _ b: Block, _ it: Item, _ val0: Int) {
        let e = s.journal(k), key = PlanReader.itemKey(b, it), cur = PlanReader.doneN(e, key, it.n)
        let val = max(0, min(it.n, val0))
        var done = e["done"]?.object ?? [:]
        if val > 0 { done[key] = .num(Double(val)) } else { done.removeValue(forKey: key) }
        var patch: [String: JSON?] = ["done": done.isEmpty ? nil : .obj(done)]
        if let ld = PlanReader.itemLoad(b, it, e) ?? PlanReader.setLoads(e, key).map({ ($0.last ?? 0, it.unitLoad, false) }) {
            var sl = e["setLoads"]?.object ?? [:]
            var arr = Array((sl[key]?.array.compactMap { $0.double } ?? []).prefix(min(cur, val)))
            while arr.count < val { arr.append(PlanReader.itemLoad(b, it, e)?.v ?? arr.last ?? ld.v) }
            if arr.isEmpty { sl.removeValue(forKey: key) } else { sl[key] = .arr(arr.map { .num($0) }) }
            patch["setLoads"] = sl.isEmpty ? nil : .obj(sl)
        }
        if e["startedAt"] == nil && val > 0 { patch["startedAt"] = .num((Date().timeIntervalSince1970 * 1000).rounded()) }
        s.jset(k, patch)
        // tout est fait : la séance passe en « faite » (ou « adaptée » s'il manque des blocs)
        let p = PlanReader(s).progress(k)
        if p.total > 0 && p.done == p.total && s.journal(k)["status"] == nil { s.jset(k, ["status": .str(p.skipped > 0 ? "adaptee" : "faite")]) }
    }
    func setPlus(_ k: String, _ b: Block, _ it: Item, _ val: Int) {
        let e = s.journal(k), key = PlanReader.itemKey(b, it)
        var plus = e["plus"]?.object ?? [:]
        let v = max(0, min(99, val))
        if v > 0 { plus[key] = .num(Double(v)) } else { plus.removeValue(forKey: key) }
        s.jset(k, ["plus": plus.isEmpty ? nil : .obj(plus)])
    }
    /// Faire un bloc après un autre (after : le bloc qui le précède, nil pour en premier) : le plan ne change pas
    func placeBlock(_ k: String, _ b: Block, after: String?) {
        var ids = PlanReader(s).blocks(k).filter { $0.kind != "rest" && $0.id != b.id }.map { $0.id }
        let at = after.flatMap { ids.firstIndex(of: $0) }.map { $0 + 1 } ?? 0
        ids.insert(b.id, at: at)
        s.jset(k, ["order": .arr(ids.map { JSON.str($0) })])
    }
    func resetOrder(_ k: String) { s.jset(k, ["order": nil]) }
    func clearSwap(_ k: String, _ b: Block, _ it: Item) {
        var sw = s.journal(k)["swap"]?.object ?? [:]
        sw.removeValue(forKey: PlanReader.itemKey(b, it))
        s.jset(k, ["swap": sw.isEmpty ? nil : .obj(sw)])
    }
    func setLoad(_ k: String, _ b: Block, _ it: Item, _ v: Double) {
        let e = s.journal(k), key = PlanReader.itemKey(b, it)
        var loads = e["loads"]?.object ?? [:]
        if let l = it.load, l == v { loads.removeValue(forKey: key) } else { loads[key] = .num(v) }
        s.jset(k, ["loads": loads.isEmpty ? nil : .obj(loads)])
    }
    func setWell(_ k: String, _ key: String, _ v: Int?) {
        var w = s.journal(k)["well"]?.object ?? [:]
        if let v { w[key] = .num(Double(v)) } else { w.removeValue(forKey: key) }
        s.jset(k, ["well": w.isEmpty ? nil : .obj(w)])
    }
    func toggleFlag(_ k: String, _ f: String) {
        let e = s.journal(k)
        var flags = e["flags"]?.object ?? [:], gene = e["gene"]?.object ?? [:]
        if flags[f]?.truthy == true { flags.removeValue(forKey: f); gene.removeValue(forKey: f) } else { flags[f] = true }
        s.jset(k, ["flags": flags.isEmpty ? nil : .obj(flags), "gene": gene.isEmpty ? nil : .obj(gene)])
    }
    func setGene(_ k: String, _ f: String, _ v: Int?) {
        var g = s.journal(k)["gene"]?.object ?? [:]
        if let v { g[f] = .num(Double(v)) } else { g.removeValue(forKey: f) }
        s.jset(k, ["gene": g.isEmpty ? nil : .obj(g)])
    }
    /// Annuler toute la séance (ou l'arrêter là), avec la raison et un mot : le coach les voit
    func cancel(_ k: String, reason: String, note: String) {
        let e = s.journal(k), pr = PlanReader(s)
        var skip = e["skip"]?.object ?? [:], ids: [JSON] = []
        for b in pr.rawBlocks(k).map({ Block(raw: $0) }) where !b.isRest && PlanReader.blockState(e, b) == nil { skip[b.id] = .str(reason); ids.append(.str(b.id)) }
        let started = pr.progress(k).done > 0 || (e["done"]?.object.values.contains { ($0.double ?? 0) > 0 } ?? false)
        var c: [String: JSON] = ["r": .str(reason), "at": .num((Date().timeIntervalSince1970 * 1000).rounded()), "ids": .arr(ids), "started": .bool(started)]
        if !note.isEmpty { c["note"] = .str(note) }
        var patch: [String: JSON?] = ["skip": .obj(skip), "status": .str(started ? "adaptee" : "sautee"), "cancel": .obj(c)]
        if !note.isEmpty && e["note"] == nil { patch["note"] = .str(note) }
        s.jset(k, patch)
    }
    func restore(_ k: String) {
        let e = s.journal(k); guard let c = e["cancel"] else { return }
        var skip = e["skip"]?.object ?? [:]
        for id in c["ids"]?.array.compactMap({ $0.string }) ?? [] where skip[id]?.string == c["r"]?.string { skip.removeValue(forKey: id) }
        var patch: [String: JSON?] = ["skip": skip.isEmpty ? nil : .obj(skip), "cancel": nil]
        if e["status"]?.string == ((c["started"]?.truthy ?? false) ? "adaptee" : "sautee") { patch["status"] = nil }
        if let n = c["note"]?.string, e["note"]?.string == n { patch["note"] = nil }
        s.jset(k, patch)
    }
}

let SKIP: [(String, String)] = [("fatigue", "Fatigue"), ("malade", "Malade"), ("gene", "Gêne ou douleur"), ("temps", "Pas le temps"), ("materiel", "Pas le matériel"), ("autre", "Autre raison")]
func skipLabel(_ v: String?) -> String { SKIP.first { $0.0 == v }?.1 ?? "Autre raison" }
