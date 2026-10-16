import Foundation
import Observation

/// Moteur du mode séance : étape en cours, repos, minuteurs, mode blocs. Tout se calcule à partir de l'heure :
/// si l'iPhone met l'appli en pause, on reprend au bon endroit (et les séries passées entre-temps sont cochées).
@Observable
final class SessionRunner {
    let k: String
    let part: String?
    let store: Store
    var i = 0
    var finishing = false
    var now = Date()
    var rest: Rest?
    var timer: IntervalRun?
    var climb: ClimbRun?

    struct Rest {
        var until: Date
        var total: Double
        var label: String
        var say: String?
        var hold = false
        var then: (() -> Void)?
    }
    struct IntervalRun {
        let title: String
        let b: Block
        let items: [Item]
        let phases: [Phase]
        let sets: Int
        let reps: Int
        let tempo: Bool
        var t0 = Date()
        var acc: Double = 0
        var pausedAt: Date?
        var skip: Double = 0
        var marked = -1
        var entered = -1
        var lastTick = ""
        var total: Double { phases.last?.at ?? 0 }
        func elapsed(_ now: Date) -> Double { max(0, (pausedAt ?? now).timeIntervalSince(t0) - acc + skip) }
        func index(_ now: Date) -> Int {
            let el = elapsed(now)
            return phases.firstIndex { $0.dur > 0 && el < $0.at + $0.dur } ?? phases.count - 1
        }
        func left(_ now: Date) -> Double { let p = phases[index(now)]; return p.dur > 0 ? max(0, p.at + p.dur - elapsed(now)) : 0 }
    }
    struct ClimbRun {
        let b: Block
        let it: Item
        var ph = "wall"           // wall (sur le bloc), rest, done
        var t0 = Date()
        var dur: Double
        var pausedAt: Date?
        var acc: Double = 0
        var grade: String?
        var last: (ws: Int, fell: Bool, t0: Date, acc: Double)?
        var lastSec = -1
        func t(_ now: Date) -> Double { max(0, (pausedAt ?? now).timeIntervalSince(t0) - acc) }
    }

    @ObservationIgnored private var loop: Task<Void, Never>?
    @ObservationIgnored private var lastRestSec = -1

    init(k: String, part: String?, store: Store = .shared) {
        self.k = k; self.part = part; self.store = store
        let steps = Step.build(k, part: part, store), e = store.journal(k)
        i = steps.firstIndex { !$0.isDone(e) } ?? 0
    }

    var steps: [Step] { Step.build(k, part: part, store) }
    var started: Date {
        let e = store.journal(k)
        let ms = part != nil ? e["apart"]?[part!]?["startedAt"]?.double : e["startedAt"]?.double
        return ms.map { Date(timeIntervalSince1970: $0 / 1000) } ?? Date()
    }

    // MARK: cycle de vie
    func begin() {
        Signals.begin()
        let e = store.journal(k), nowMs = JSON.num((Date().timeIntervalSince1970 * 1000).rounded())
        if let part {
            if var p = e["apart"]?[part], p["startedAt"] == nil || p["endedAt"] != nil {
                p["startedAt"] = nowMs; p["endedAt"] = nil
                var a = e["apart"]?.object ?? [:]; a[part] = p; store.jset(k, ["apart": .obj(a)])
            }
        } else if e["startedAt"] == nil || e["endedAt"] != nil {
            store.jset(k, ["startedAt": nowMs, "endedAt": nil])
        }
        loop?.cancel()
        loop = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                self?.tick()
                try? await Task.sleep(nanoseconds: 100_000_000)
            }
        }
    }
    func stop() { loop?.cancel(); loop = nil; Signals.end(); LiveRest.stop() }

    // MARK: séries
    func bump(_ b: Block, _ it: Item, by n: Int = 1) {
        let cur = PlanReader.doneN(store.journal(k), PlanReader.itemKey(b, it), it.n)
        JournalWriter(store).setDone(k, b, it, min(it.n, cur + n))
    }

    // MARK: repos
    func startRest(_ sec: Double, _ label: String, say: String? = nil, hold: Bool = false, then: (() -> Void)? = nil) {
        guard sec > 0 else { then?(); return }
        let until = Date().addingTimeInterval(sec)
        rest = Rest(until: until, total: sec, label: label, say: say, hold: hold, then: then)
        lastRestSec = -1
        if hold { Signals.go() } else {
            Signals.schedule("rest", at: until, title: "Repos terminé", body: say.map { $0 + " : c’est reparti" } ?? "C’est reparti")
        }
        LiveRest.show(title: liveTitle, until: until, label: label, next: say, phase: hold ? "work" : "rest")
    }
    func addRest(_ d: Double) {
        guard var r = rest else { return }
        r.until = r.until.addingTimeInterval(d); r.total = max(1, r.total + d); rest = r
        Signals.schedule("rest", at: r.until, title: "Repos terminé", body: r.say.map { $0 + " : c’est reparti" } ?? "C’est reparti")
        LiveRest.show(title: liveTitle, until: r.until, label: r.label, next: r.say, phase: r.hold ? "work" : "rest")
    }
    var liveTitle: String { plain(PlanReader(store).sessionName(k)) }
    func endRest() {
        let r = rest; rest = nil
        Signals.cancel("rest")
        LiveRest.finish()
        r?.then?()
    }

    // MARK: minuteur à intervalles ou tempo
    func openTimer(_ T: TimerSpec, _ b: Block, _ items: [Item], title: String? = nil) {
        rest = nil; Signals.cancel("rest")
        let phases = Phase.interval(T)
        timer = IntervalRun(title: title ?? (T.name.isEmpty ? b.title : T.name), b: b, items: items, phases: phases, sets: T.sets, reps: T.reps, tempo: false)
    }
    func openTempo(_ T: TimerSpec, _ b: Block, _ it: Item, done v: Int) {
        rest = nil; Signals.cancel("rest")
        let sets = max(1, it.n - v), reps = T.raw["reps"]?.int ?? it.reps ?? 8
        var raw = T.raw
        if raw["setRest"] == nil, let r = it.rest { raw["setRest"] = .num(r) }
        timer = IntervalRun(title: it.label, b: b, items: [it], phases: Phase.tempo(TimerSpec(raw: raw), sets: sets, reps: reps), sets: sets, reps: reps, tempo: true)
    }
    func toggleTimer() {
        guard var t = timer else { return }
        if let p = t.pausedAt { t.acc += Date().timeIntervalSince(p); t.pausedAt = nil } else { t.pausedAt = Date() }
        timer = t
    }
    func skipPhase() { guard var t = timer else { return }; t.skip += t.left(Date()) + 0.01; timer = t }
    func closeTimer() { timer = nil; LiveRest.finish(label: "Minuteur terminé") }

    // MARK: mode blocs
    func openClimb(_ b: Block, _ it: Item) {
        rest = nil; Signals.cancel("rest")
        let key = PlanReader.itemKey(b, it), disc = it.unit == "Voie" ? "voie" : "bloc"
        let log = store.journal(k)["cl"]?[key]?.array ?? []
        let g = log.last?["g"]?.string ?? it.grade ?? Grades.find(it.label + " " + (it.det ?? ""), disc)
        climb = ClimbRun(b: b, it: it, dur: it.rest ?? 60, grade: g)
    }
    func climbFinish(fell: Bool) {
        guard var c = climb else { return }
        let key = PlanReader.itemKey(c.b, c.it), e = store.journal(k)
        let cur = PlanReader.doneN(e, key, c.it.n), ws = c.ph == "wall" ? Int(c.t(Date()).rounded()) : 0
        JournalWriter(store).setDone(k, c.b, c.it, min(c.it.n, cur + 1))
        let e2 = store.journal(k)
        var wall = e2["wall"]?.object ?? [:]; wall[key] = .num(Double((wall[key]?.int ?? 0) + ws))
        var patch: [String: JSON?] = ["wall": .obj(wall)]
        if fell { var f = e2["falls"]?.object ?? [:]; f[key] = .num(Double((f[key]?.int ?? 0) + 1)); patch["falls"] = .obj(f) }
        var cl = e2["cl"]?.object ?? [:]
        var entry: [String: JSON] = ["t": .num(Double(ws))]
        if let g = c.grade { entry["g"] = .str(g) }
        if fell { entry["f"] = 1 }
        cl[key] = .arr((cl[key]?.array ?? []) + [.obj(entry)]); patch["cl"] = .obj(cl)
        store.jset(k, patch)
        c.last = (ws, fell, c.t0, c.acc)
        if cur + 1 >= c.it.n { Signals.done(); Signals.say("Terminé"); c.ph = "done" }
        else {
            Signals.rest(); c.ph = "rest"; c.t0 = Date(); c.acc = 0; c.pausedAt = nil; c.dur = c.it.rest ?? 60
            let unit = c.it.unit == "Essai" ? "Essai" : c.it.unit == "Voie" ? "Voie" : "Bloc"
            Signals.schedule("rest", at: Date().addingTimeInterval(c.dur), title: "Repos terminé", body: "\(unit) \(cur + 2) : c’est reparti")
            LiveRest.show(title: c.it.label, until: Date().addingTimeInterval(c.dur), label: "Repos · ensuite " + unit.lowercased() + " \(cur + 2)", next: c.grade, phase: "rest")
        }
        climb = c
    }
    func climbUndo() {
        guard var c = climb, let L = c.last else { return }
        let key = PlanReader.itemKey(c.b, c.it), e = store.journal(k)
        let cur = PlanReader.doneN(e, key, c.it.n)
        JournalWriter(store).setDone(k, c.b, c.it, max(0, cur - 1))
        let e2 = store.journal(k)
        var wall = e2["wall"]?.object ?? [:]; wall[key] = .num(Double(max(0, (wall[key]?.int ?? 0) - L.ws)))
        var patch: [String: JSON?] = ["wall": .obj(wall)]
        if L.fell { var f = e2["falls"]?.object ?? [:]; f[key] = .num(Double(max(0, (f[key]?.int ?? 0) - 1))); patch["falls"] = .obj(f) }
        var cl = e2["cl"]?.object ?? [:]; cl[key] = .arr(Array((cl[key]?.array ?? []).dropLast())); patch["cl"] = .obj(cl)
        store.jset(k, patch)
        Signals.cancel("rest")
        c.ph = "wall"; c.t0 = L.t0; c.acc = L.acc; c.pausedAt = nil; c.last = nil
        climb = c
    }
    func climbGo() {
        guard var c = climb else { return }
        Signals.go(); Signals.cancel("rest"); LiveRest.finish()
        c.ph = "wall"; c.t0 = Date(); c.acc = 0; c.pausedAt = nil
        climb = c
    }
    func climbToggle() {
        guard var c = climb else { return }
        if let p = c.pausedAt { c.acc += Date().timeIntervalSince(p); c.pausedAt = nil } else { c.pausedAt = Date() }
        climb = c
    }
    func climbAdd(_ d: Double) { guard var c = climb else { return }; c.dur = max(5, c.dur + d); climb = c }
    func climbGrade(_ n: Int) {
        guard var c = climb else { return }
        let disc = c.it.unit == "Voie" ? "voie" : "bloc"
        c.grade = c.grade.flatMap { Grades.shift($0, n, disc) } ?? (disc == "voie" ? "6a" : "6A")
        climb = c
    }

    // MARK: horloge (10 fois par seconde)
    @MainActor private func tick() {
        let n = Date()
        if rest != nil || timer != nil || climb != nil { now = n }
        if let r = rest {
            let left = r.until.timeIntervalSince(n), sec = Int(left.rounded(.up))
            if sec != lastRestSec {
                lastRestSec = sec
                if sec > 0 && sec <= 3 { Signals.tick() }
                if sec <= 0 {
                    Signals.done()
                    if let s = r.say { Signals.say(s) } else if !r.hold { Signals.say("C’est reparti") }
                    endRest()
                }
            }
        }
        if var t = timer {
            let idx = t.index(n)
            // séries terminées (y compris pendant une mise en veille)
            if idx - 1 > t.marked {
                for j in (t.marked + 1)..<idx where t.phases[j].type == "mark" {
                    let ph = t.phases[j]
                    let it = t.items.count > 1 && ph.si < t.items.count ? t.items[ph.si] : t.items.first
                    if let it { bump(t.b, it) }
                }
                t.marked = idx - 1
            }
            let ph = t.phases[idx]
            if t.entered != idx {
                t.entered = idx
                switch ph.type {
                case "work": Signals.go(); if ph.rep == 1, let s = ph.side { Signals.say(s) }
                case "ecc": Signals.go()
                case "rest", "ret": Signals.rest()
                case "prep": if t.tempo, let s = ph.side { Signals.say(s) }
                case "sw": Signals.rest(); Signals.say("Change de bras")
                case "setrest": Signals.rest(); Signals.say("Repos")
                case "done": Signals.done(); Signals.say("Terminé")
                default: break
                }
                // écran verrouillé / Dynamic Island : la phase en cours et son décompte
                if ph.dur > 0 {
                    let nx = t.phases[(idx + 1)...].first { $0.dur > 0 }
                    LiveRest.show(title: t.title, until: n.addingTimeInterval(t.left(n)), label: Self.phaseLabel(ph, t.sets), next: nx.map { Self.nextLabel($0) }, phase: ph.isWork ? "work" : "rest", paused: t.pausedAt != nil)
                } else if ph.type == "done" { LiveRest.finish(label: "Minuteur terminé") }
                // notification si l'iPhone se verrouille pendant un repos
                if ["setrest", "sw", "prep", "rest"].contains(ph.type), ph.dur >= 15 {
                    let nx = t.phases[(idx + 1)...].first { $0.dur > 0 }
                    Signals.schedule("rest", at: n.addingTimeInterval(t.left(n)), title: t.title + " · repos terminé", body: [nx?.side, nx.map { "série \($0.set)" }].compactMap { $0 }.joined(separator: " · "))
                } else if ph.type == "done" { Signals.cancel("rest") }
            }
            if t.pausedAt == nil && ph.dur > 0 {
                let sec = Int(t.left(n).rounded(.up)), key = "\(idx):\(sec)"
                if t.lastTick != key {
                    t.lastTick = key
                    if ph.type == "ecc" ? (sec > 0 && Double(sec) < ph.dur) : (sec > 0 && sec <= 3 && ph.dur >= 5) { Signals.tick() }
                }
            }
            timer = t
        }
        if var c = climb, c.ph == "rest", c.pausedAt == nil {
            let left = c.dur - c.t(n), sec = Int(left.rounded(.up))
            if left <= 0 {
                let v = PlanReader.doneN(store.journal(k), PlanReader.itemKey(c.b, c.it), c.it.n)
                Signals.go(); Signals.say((c.it.unit == "Voie" ? "Voie" : c.it.unit == "Essai" ? "Essai" : "Bloc") + " \(v + 1)")
                LiveRest.finish()
                c.ph = "wall"; c.t0 = c.t0.addingTimeInterval(c.acc + c.dur); c.acc = 0
                climb = c
            } else if sec != c.lastSec {
                c.lastSec = sec
                if sec > 0 && sec <= 3 { Signals.tick() }
                climb = c
            }
        }
    }

    static func phaseLabel(_ ph: Phase, _ sets: Int) -> String {
        var s = ph.type == "setrest" ? "Repos" : ph.label
        if let side = ph.side { s += " · " + side }
        if ph.set > 0 { s += " · série \(ph.set)/\(sets)" }
        return s
    }
    static func nextLabel(_ p: Phase) -> String {
        guard let side = p.side else { return p.label }
        return side + " · " + p.label
    }

    // MARK: fin
    func save(minutes: Int, status: String) {
        let nowMs = JSON.num((Date().timeIntervalSince1970 * 1000).rounded())
        if let part {
            let e = store.journal(k)
            if var p = e["apart"]?[part] {
                p["duree"] = minutes > 0 ? .num(Double(minutes)) : nil; p["endedAt"] = nowMs
                var a = e["apart"]?.object ?? [:]; a[part] = p; store.jset(k, ["apart": .obj(a)])
            }
        } else {
            store.jset(k, ["duree": minutes > 0 ? .num(Double(minutes)) : nil, "status": .str(status), "endedAt": nowMs])
        }
        stop()
    }
}

/// Cotations bloc (Fontainebleau) et voie (française)
enum Grades {
    static let FONT = ["3", "4", "4+", "5", "5+", "6A", "6A+", "6B", "6B+", "6C", "6C+", "7A", "7A+", "7B", "7B+", "7C", "7C+", "8A", "8A+", "8B", "8B+", "8C", "8C+", "9A"]
    static let FR = ["3", "4a", "4b", "4c", "5a", "5b", "5c", "6a", "6a+", "6b", "6b+", "6c", "6c+", "7a", "7a+", "7b", "7b+", "7c", "7c+", "8a", "8a+", "8b", "8b+", "8c", "8c+", "9a", "9a+", "9b", "9b+", "9c"]
    static func scale(_ d: String) -> [String] { d == "voie" ? FR : FONT }
    static func idx(_ g: String, _ d: String) -> Int? {
        let t = g.replacingOccurrences(of: " ", with: "").lowercased()
        return scale(d).firstIndex { $0.lowercased() == t }
    }
    static func shift(_ g: String, _ n: Int, _ d: String) -> String? {
        guard let i = idx(g, d) else { return nil }
        let s = scale(d); return s[max(0, min(s.count - 1, i + n))]
    }
    /// Première cotation trouvée dans un texte (« 22 blocs 6a » → 6A en bloc)
    static func find(_ text: String, _ d: String) -> String? {
        guard let re = try? NSRegularExpression(pattern: #"\b([3-9](?:[abcABC]\+?|\+)?)(?=\b|\s|$|\+)"#) else { return nil }
        let ns = text as NSString
        for m in re.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
            let x = ns.substring(with: m.range(at: 1))
            if let i = idx(x, d), x.range(of: "[abc+]", options: [.regularExpression, .caseInsensitive]) != nil { return scale(d)[i] }
        }
        return nil
    }
}
