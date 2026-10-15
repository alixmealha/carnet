import Foundation

/// Adapter la séance du jour : moins de temps que prévu, ou forme basse (alléger). Même calcul que la version web :
/// avec moins de temps, on garde d'abord l'échauffement (raccourci) et les exercices principaux, puis les accessoires,
/// puis la prévention. Les séries restent complètes : on en retire, on ne les raccourcit pas. Tout va dans le journal (adj).
enum Adapt {
    private static let MAIN_KINDS: Set<String> = ["grimpe", "doigts", "muscu", "velo", "course", "compet", "test", "sport"]
    private static let STRENGTH: Set<String> = ["muscu", "renfo", "epaule"]
    private static let DEFAULT_MIN: [String: Double] = ["kine": 30, "recup": 20, "velo": 40, "course": 40, "sport": 60, "compet": 60]

    /// « 30–40 min », « 10 à 15 min », « 1 h 30 » → minutes (milieu de la fourchette)
    static func minsOf(_ s0: String?) -> Double? {
        let s = s0 ?? ""
        let m = s.firstMatch(#"(\d+(?:[.,]\d+)?)\s*(?:(?:à|-|–)\s*(\d+(?:[.,]\d+)?)\s*)?min"#)
        if let m {
            let a = Double(m[1].replacingOccurrences(of: ",", with: ".")) ?? 0
            if m.count > 2, !m[2].isEmpty, let b = Double(m[2].replacingOccurrences(of: ",", with: ".")) { return (a + b) / 2 }
            return a
        }
        if let h = s.firstMatch(#"(?i)(\d+)\s*h\s*(\d{2})?(?![a-zà-ÿ])"#) {
            return (Double(h[1]) ?? 0) * 60 + (h.count > 2 && !h[2].isEmpty ? Double(h[2]) ?? 0 : 0)
        }
        return nil
    }

    struct Unit {
        let key: String
        let b: JSON
        let it: JSON?
        let label: String
        let prio: Int
        let order: Int
        // en séries
        var n0 = 0, min = 1, done0 = 0
        var started = false
        var cost: (Int) -> Double = { _ in 0 }
        // en minutes
        var mins: Double? = nil
        var minMins: Double = 0
        var done = false
        var warm = false, again = false
        var kind: String { b["kind"]?.string ?? "" }
    }
    struct Row: Identifiable {
        var id: String { u.key }
        let u: Unit
        let act: String       // full, reduce, short, drop
        var n: Int? = nil
        var m: Double? = nil
        let sec: Double
    }
    struct Result {
        let k: String
        let mode: String      // time, light
        let base: Int
        let total: Int
        let rows: [Row]
        var min: Int? = nil
        var frac: Double? = nil
        var changed: Bool { rows.contains { $0.act != "full" } }
    }

    // Coût en secondes d'un exercice pour n séries (ou blocs, essais, répétitions selon le minuteur)
    private static func costFn(_ b: JSON, _ it: JSON) -> (Int) -> Double {
        let T = it["timer"].flatMap { $0.isNull ? nil : $0 }, u = it["unit"]?.string ?? "Série", n0 = it["n"]?.int ?? 1
        let perMin = n0 > 1 ? minsOf(it["label"]?.string) : nil
        func d(_ x: JSON?, _ k: String, _ def: Double) -> Double { x?[k]?.double ?? def }
        if let T, T["kind"]?.string ?? "interval" == "interval" {
            let prep = d(T, "prep", 10), sides = Double(max(1, T["sides"]?.array.count ?? 1)), work = d(T, "work", 7), rest = d(T, "rest", 3)
            if T["markEach"]?.string == "rep" { return { n in prep + Double(n) * (work + rest) - rest } }
            let reps = d(T, "reps", 1), setRest = d(T, "setRest", 0)
            return { n in prep + Double(n) * (reps * (work + rest) - rest) * sides + Double(max(0, n - 1)) * setRest }
        }
        if let T, T["kind"]?.string == "cluster" {
            let reps = d(T, "reps", 1), intra = d(T, "intra", 20), setRest = d(T, "setRest", 180)
            return { n in Double(n) * (reps * 5 + (reps - 1) * intra) + Double(max(0, n - 1)) * setRest }
        }
        if let T, T["kind"]?.string == "contrast" {
            let hr = d(T, "heavyRest", 240), lr = d(T, "lightRest", 180)
            return { n in Double(n) * (30 + hr + 15) + Double(max(0, n - 1)) * lr }
        }
        if let T, T["kind"]?.string == "tempo" {
            let sides: Double = (T["sides"]?.array.count ?? 0) > 1 ? 2 : 1
            let prep = d(T, "prep", 5), reps = T["reps"]?.double ?? it["reps"]?.double ?? 8, ecc = d(T, "ecc", 6), ret = d(T, "ret", 4)
            let setRest = T["setRest"]?.double ?? it["rest"]?.double ?? 60
            return { n in Double(n) * (prep + reps * (ecc + ret) * sides) + Double(max(0, n - 1)) * setRest }
        }
        let kind = b["kind"]?.string ?? ""
        var work = 40.0
        if let pm = perMin { work = pm * 60 }
        else if u == "Bloc" { work = 60 } else if u == "Voie" { work = 240 } else if u == "Essai" { work = 30 }
        else if let r = it["reps"]?.double { work = r * 3 + 10 }
        var rest = 60.0
        if let r = it["rest"]?.double { rest = r }
        else if u == "Bloc" { rest = 90 } else if u == "Voie" { rest = 300 } else if u == "Essai" { rest = 180 } else if STRENGTH.contains(kind) { rest = 120 }
        return { n in Double(n) * work + Double(max(0, n - 1)) * rest }
    }
    private static func groupCost(_ b: JSON) -> (Int) -> Double {
        let T = b["timer"] ?? .emptyObject
        let sides = Double(max(1, T["sides"]?.array.count ?? 1)), prep = T["prep"]?.double ?? 10, reps = T["reps"]?.double ?? 1
        let work = T["work"]?.double ?? 7, rest = T["rest"]?.double ?? 3, setRest = T["setRest"]?.double ?? 0
        return { n in prep + Double(n) * (reps * (work + rest) - rest) * sides + Double(max(0, n - 1)) * setRest }
    }
    // Priorité : 0 échauffement, 1 principal (et rééducation), 2 accessoire, 3 prévention, 4 retour au calme ou facultatif
    private static func prioOf(_ b: JSON, _ it: JSON, _ idx: Int) -> Int {
        let id = it["id"]?.string ?? "", kind = b["kind"]?.string ?? "", unit = it["unit"]?.string ?? ""
        if id == "ech" { return 0 }
        if id == "rac" || it["opt"]?.truthy == true { return 4 }
        if it["extra"]?.truthy == true { return 3 }
        if kind == "kine" || kind == "test" { return 1 }
        let r = it["rx"]?["role"]?.string
        if r == "main" || r == "puiss" { return 1 }
        if r == "acc" { return 2 }
        if r == "prev" { return 3 }
        if ["epaule", "renfo", "recup"].contains(kind) { return 3 }
        if !MAIN_KINDS.contains(kind) { return 2 }
        if ["Bloc", "Voie", "Essai"].contains(unit) || kind == "doigts" { return 1 }
        if kind == "muscu" { let reps = it["reps"]?.int ?? 99; return (reps <= 6 || (it["n"]?.int ?? 1) >= 5 || idx == 0) ? 1 : 2 }
        return idx == 0 ? 1 : 2
    }
    private static func minOf(_ it: JSON, _ prio: Int, _ done: Int) -> Int {
        let n = it["n"]?.int ?? 1, unit = it["unit"]?.string ?? ""
        let m: Int
        if unit == "Bloc" || unit == "Voie" { m = Int((Double(n) * 0.3).rounded(.up)) }
        else if it["timer"]?["markEach"]?.string == "rep" { m = Int((Double(n) * 0.5).rounded(.up)) }
        else if prio == 1 { m = Swift.min(n, 2) }
        else { m = n >= 3 ? 2 : 1 }
        return Swift.max(m, done, 1)
    }

    /// Ce qui compose la séance (pas les blocs faits à part, déplacés ou pas faits, ni la kiné)
    static func units(_ k: String, _ s: Store = .shared) -> [Unit] {
        let pr = PlanReader(s), e = s.journal(k)
        var out: [Unit] = [], warmed = false
        func warmUnit(_ b: JSON, _ it: JSON) -> Unit {
            let m0 = minsOf(it["det"]?.string) ?? 10
            var u = Unit(key: (b["id"]?.string ?? "") + ".ech", b: b, it: it, label: warmed ? "Remise en route" : "Échauffement", prio: 0, order: 0)
            u.mins = m0; u.minMins = Swift.min(m0, warmed ? 4 : 6); u.again = warmed; u.warm = true
            return u
        }
        for b in pr.rawBlocks(k) {
            let bb = Block(raw: b)
            if bb.isRest || bb.kind == "kine" || PlanReader.blockState(e, bb) != nil { continue }
            let its = b["items"]?.array ?? [], bid = bb.id
            if b["timer"] != nil && b["timer"] != .null && its.contains(where: { $0["id"]?.string != "ech" }) {
                if let ech = its.first(where: { $0["id"]?.string == "ech" }) { out.append(warmUnit(b, ech)); warmed = true }
                let g = its.filter { $0["id"]?.string != "ech" }
                let done = g.map { PlanReader.doneN(e, bid + "." + ($0["id"]?.string ?? ""), $0["n"]?.int ?? 1) }.min() ?? 0
                var u = Unit(key: "b:" + bid, b: b, it: nil, label: b["timer"]?["name"]?.string ?? bb.title, prio: bb.kind == "doigts" ? 1 : prioOf(b, g[0], 0), order: out.count)
                u.n0 = b["timer"]?["sets"]?.int ?? 1; u.min = Swift.max(1, done); u.done0 = done; u.started = done > 0; u.cost = groupCost(b)
                out.append(u)
                continue
            }
            let main = its.filter { $0["id"]?.string != "ech" }
            for it in its {
                let iid = it["id"]?.string ?? ""
                if iid == "ech" { out.append(warmUnit(b, it)); warmed = true; continue }
                let idx = main.firstIndex(of: it) ?? 0
                let prio = prioOf(b, it, idx), n = it["n"]?.int ?? 1
                let done = PlanReader.doneN(e, bid + "." + iid, n)
                var u = Unit(key: bid + "." + iid, b: b, it: it, label: it["label"]?.string ?? "Exercice", prio: prio, order: out.count)
                if n == 1 && (it["timer"] == nil || it["timer"] == .null) {
                    let label = it["label"]?.string ?? "", det = it["det"]?.string ?? ""
                    let m0 = minsOf(label) ?? minsOf(det) ?? DEFAULT_MIN[bb.kind] ?? 10
                    let elastic = ["velo", "course", "recup"].contains(bb.kind) || (bb.kind == "grimpe" && (minsOf(label) != nil || (label + " " + det).range(of: "continuit|travers|volume", options: [.regularExpression, .caseInsensitive]) != nil))
                    u.mins = m0; u.minMins = elastic ? Swift.min(m0, Swift.max(15, (m0 / 3).rounded())) : m0; u.done = done > 0
                    out.append(u)
                    continue
                }
                u.n0 = n; u.min = minOf(it, prio, done); u.done0 = done; u.started = done > 0; u.cost = costFn(b, it)
                out.append(u)
            }
        }
        return out
    }
    private static func secOf(_ u: Unit, _ n: Int? = nil, _ m: Double? = nil) -> Double {
        if let mins = u.mins { return (m ?? mins) * 60 }
        return u.cost(n ?? u.n0)
    }
    static func plannedMin(_ units: [Unit]) -> Int { Int((units.reduce(0) { $0 + secOf($1) } / 60).rounded()) }

    private enum Pick { case n(Int), m(Double), drop }

    /// Moins de temps : la séance qui tient dans « minutes »
    static func fitToTime(_ k: String, _ minutes: Int, _ s: Store = .shared) -> Result {
        let units = Self.units(k, s)
        var res: [String: Pick] = [:], left = Double(minutes) * 60
        // 1. échauffements : raccourcis jusqu'à ~18 % du temps disponible, jamais sous leur minimum
        for u in units where u.warm {
            let m = u.again ? u.minMins : Swift.max(u.minMins, Swift.min(u.mins ?? 10, (Double(minutes) * 0.18).rounded()))
            res[u.key] = .m(m); left -= m * 60
        }
        let rest = units.filter { !$0.warm }.sorted { $0.prio != $1.prio ? $0.prio < $1.prio : $0.order < $1.order }
        // 2. principaux : tous gardés ; s'ils ne tiennent pas, on retire des séries à chacun, dans la même proportion
        let p1 = rest.filter { $0.prio <= 1 }
        let full1 = p1.reduce(0) { $0 + secOf($1) }
        if full1 <= left {
            for u in p1 { res[u.key] = u.mins != nil ? .m(u.mins!) : .n(u.n0) }
            left -= full1
        } else {
            struct T { var u: Unit; var n: Int?; var m: Double? }
            var pick: ([T], Double) = ([], 0)
            var f = 0.95
            while f >= -0.001 {
                let t = p1.map { u -> T in u.mins != nil ? T(u: u, n: nil, m: Swift.max(u.minMins, (u.mins! * f).rounded())) : T(u: u, n: Swift.max(u.min, Int((Double(u.n0) * f).rounded())), m: nil) }
                let s = t.reduce(0) { $0 + secOf($1.u, $1.n, $1.m) }
                pick = (t, s)
                if s <= left { break }
                f -= 0.05
            }
            var t = pick.0, sum = pick.1
            while sum > left && t.count > 1 { let x = t.removeLast(); sum -= secOf(x.u, x.n, x.m); res[x.u.key] = .drop }
            left -= sum
            // le temps qui reste revient d'abord aux principaux, une série à la fois
            var grew = true
            while grew {
                grew = false
                for i in t.indices {
                    if let m = t[i].m {
                        let m2 = Swift.min(t[i].u.mins ?? m, m + 5)
                        if m2 > m && (m2 - m) * 60 <= left { left -= (m2 - m) * 60; t[i].m = m2; grew = true }
                        continue
                    }
                    if let n = t[i].n, n < t[i].u.n0 {
                        let dd = t[i].u.cost(n + 1) - t[i].u.cost(n)
                        if dd <= left { left -= dd; t[i].n = n + 1; grew = true }
                    }
                }
            }
            for x in t { res[x.u.key] = x.m != nil ? .m(x.m!) : .n(x.n ?? x.u.n0) }
        }
        // 3. le reste par priorité : complet si ça tient, sinon moins de séries, sinon retiré
        for u in rest where u.prio > 1 {
            if let mins = u.mins {
                if mins * 60 <= left { res[u.key] = .m(mins); left -= mins * 60 }
                else if u.minMins < mins && (left / 60).rounded(.down) >= u.minMins {
                    var m = ((left / 60 / 5).rounded(.down)) * 5; if m == 0 { m = (left / 60).rounded(.down) }
                    res[u.key] = .m(m); left -= m * 60
                } else { res[u.key] = u.done ? .m(mins) : .drop }
                continue
            }
            var n = u.n0
            while n > u.min && u.cost(n) > left { n -= 1 }
            if u.cost(n) <= left { res[u.key] = .n(n); left -= u.cost(n) }
            else if u.started { res[u.key] = .n(u.min); left -= u.cost(u.min) }
            else { res[u.key] = .drop }
        }
        var r = result(k, units, res, "time"); r.min = minutes
        return r
    }

    /// Forme basse : un tiers de séries en moins (fatigué) ou la moitié (version décharge), mêmes exercices
    static func lighten(_ k: String, _ frac: Double, _ s: Store = .shared) -> Result {
        let units = Self.units(k, s)
        var res: [String: Pick] = [:]
        for u in units {
            if u.warm { res[u.key] = .m(u.mins ?? 10); continue }
            if let mins = u.mins { res[u.key] = .m(u.minMins < mins ? Swift.max(u.minMins, (mins * (1 - frac) / 5).rounded() * 5) : mins); continue }
            res[u.key] = .n(Swift.max(1, u.done0, Int((Double(u.n0) * (1 - frac)).rounded())))
        }
        var r = result(k, units, res, "light"); r.frac = frac
        return r
    }

    private static func result(_ k: String, _ units: [Unit], _ res: [String: Pick], _ mode: String) -> Result {
        let rows = units.map { u -> Row in
            let p = res[u.key]
            if case .drop = p { return Row(u: u, act: "drop", sec: 0) }
            if let mins = u.mins {
                var m = mins; if case .m(let x) = p { m = x }
                return Row(u: u, act: m < mins ? "short" : "full", m: m, sec: m * 60)
            }
            var n = u.n0; if case .n(let x) = p { n = x }
            return Row(u: u, act: n < u.n0 ? "reduce" : "full", n: n, sec: u.cost(n))
        }
        return Result(k: k, mode: mode, base: plannedMin(units), total: Int((rows.reduce(0) { $0 + $1.sec } / 60).rounded()), rows: rows)
    }

    /// Enregistre l'adaptation dans le journal du jour
    static func apply(_ r: Result, _ s: Store = .shared) {
        var items: [String: JSON] = [:]
        let fm = { (m: Double) in "\(Int(m.rounded())) min" }
        for x in r.rows {
            switch x.act {
            case "drop": items[x.u.key] = ["drop": true]
            case "reduce": items[x.u.key] = ["n": .num(Double(x.n ?? x.u.n0))]
            case "short": items[x.u.key] = ["note": .str((x.u.warm ? "Raccourci à " : "") + fm(x.m ?? 0) + (x.u.warm ? "" : " au lieu de " + fm(x.u.mins ?? 0)))]
            default: break
            }
        }
        var adj: [String: JSON] = ["mode": .str(r.mode), "base": .num(Double(r.base)), "total": .num(Double(r.total)), "at": .num((Date().timeIntervalSince1970 * 1000).rounded()), "items": .obj(items)]
        if let m = r.min { adj["min"] = .num(Double(m)) }
        if let f = r.frac { adj["frac"] = .num(f) }
        s.jset(r.k, ["adj": .obj(adj)])
    }
    static func clear(_ k: String, _ s: Store = .shared) { s.jset(k, ["adj": nil]) }

    struct Summary { let head: String; let dropped: [String]; let reduced: Int; let tip: String?; let mode: String }
    static func summary(_ k: String, _ s: Store = .shared) -> Summary? {
        guard let a = s.journal(k)["adj"], let items = a["items"]?.object else { return nil }
        let raw = PlanReader(s).rawBlocks(k)
        func name(_ key: String) -> String? {
            if key.hasPrefix("b:") { let b = raw.first { $0["id"]?.string == String(key.dropFirst(2)) }; return b.map { $0["timer"]?["name"]?.string ?? Block(raw: $0).title } }
            let p = key.split(separator: ".", maxSplits: 1).map(String.init); guard p.count == 2 else { return nil }
            let b = raw.first { $0["id"]?.string == p[0] }
            return b?["items"]?.array.first { $0["id"]?.string == p[1] }?["label"]?.string
        }
        let dropped = items.filter { $0.value["drop"]?.truthy == true }.keys.sorted().compactMap { name($0) }.map { plain($0) }
        let reduced = items.values.filter { $0["n"] != nil }.count
        let mode = a["mode"]?.string ?? "time", frac = a["frac"]?.double ?? 0
        let head = mode == "time" ? "Séance adaptée à \(a["min"]?.int ?? 0) min" + ((a["base"]?.int).map { " (prévue ≈ \($0) min)" } ?? "")
            : frac >= 0.5 ? "Version décharge : moitié des séries" : "Séance allégée : un tiers de séries en moins"
        let tip: String? = mode == "light" ? (frac >= 0.5 ? "Rien au maximum : garde 2 à 3 répétitions en réserve, cotations un cran en dessous." : "Pas de nouveau palier de charge aujourd’hui.") : nil
        return Summary(head: head, dropped: dropped, reduced: reduced, tip: tip, mode: mode)
    }
}

/// Texte sans les pastilles de couleur de prise ([jaune], [bleu]…)
func plain(_ s: String?) -> String {
    (s ?? "").replacingOccurrences(of: #"\[[a-z]+\]\s*"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespaces)
}

extension String {
    /// Première correspondance d'une expression régulière : [tout, groupe 1, groupe 2…] (groupe absent = "")
    func firstMatch(_ pattern: String) -> [String]? {
        guard let re = try? NSRegularExpression(pattern: pattern) else { return nil }
        let ns = self as NSString
        guard let m = re.firstMatch(in: self, range: NSRange(location: 0, length: ns.length)) else { return nil }
        return (0..<m.numberOfRanges).map { i in
            let r = m.range(at: i); return r.location == NSNotFound ? "" : ns.substring(with: r)
        }
    }
}
