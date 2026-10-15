import Foundation

/// Étapes du mode séance : un exercice, une liste à cocher, un bloc à minuteur ou deux exercices en alternance.
struct Step: Identifiable {
    let b: Block
    var items: [Item]
    var skip = false, list = false, group = false, pair = false
    var id: String { b.id + ":" + items.map(\.id).joined(separator: ",") + (skip ? ":skip" : "") }

    var title: String {
        if skip || list || items.isEmpty { return b.title }
        if group { return b.timer?.name.isEmpty == false ? b.timer!.name : b.title }
        if pair { return items.map(\.label).joined(separator: " + ") }
        return items[0].label
    }

    /// part : id d'un bloc fait à part ; sinon la séance principale, sans les blocs à part ou déplacés
    static func build(_ k: String, part: String? = nil, _ s: Store = .shared) -> [Step] {
        var st: [Step] = []
        let e = s.journal(k)
        for b in PlanReader(s).blocks(k) where !b.isRest {
            let bs = PlanReader.blockState(e, b)
            if let part { if b.id != part { continue } } else if bs == "apart" || bs == "moved" { continue }
            if part == nil && bs == "skip" { st.append(Step(b: b, items: b.items, skip: true)); continue }
            let its = b.items
            if its.isEmpty { st.append(Step(b: b, items: [])); continue }
            // éléments simples (échauffement, consignes) : une seule étape en liste à cocher
            if its.count > 1 && b.timer == nil && its.allSatisfy({ $0.n == 1 && $0.rest == nil && $0.timer == nil && $0.load == nil }) {
                st.append(Step(b: b, items: its, list: true)); continue
            }
            let grpIds = b.timer?.items ?? []
            let grp = b.timer != nil && !grpIds.isEmpty ? its.filter { grpIds.contains($0.id) } : nil
            var pushed = false
            for x in its {
                if let grp, grpIds.contains(x.id) {
                    if !pushed { st.append(Step(b: b, items: grp, group: true)); pushed = true }
                    continue
                }
                // exercice en alternance avec le précédent (ex. gainage entre les séries de tractions)
                if let sup = x.superset, var prev = st.last, prev.b.id == b.id, prev.items.count == 1, !prev.list, !prev.group,
                   prev.items[0].id == sup, prev.items[0].timer == nil, x.timer == nil, prev.items[0].n > 1 {
                    prev.items.append(x); prev.pair = true; st[st.count - 1] = prev; continue
                }
                st.append(Step(b: b, items: [x]))
            }
        }
        return st
    }
    func isDone(_ e: JSON) -> Bool {
        if skip { return true }
        if items.isEmpty { return e["done"]?[b.id + ".*"]?.truthy ?? false }
        return items.allSatisfy { PlanReader.doneN(e, PlanReader.itemKey(b, $0), $0.n) >= $0.n }
    }
    func isStarted(_ e: JSON) -> Bool { items.contains { PlanReader.doneN(e, PlanReader.itemKey(b, $0), $0.n) > 0 } }
}

/// Phases d'un minuteur à intervalles (suspensions, circuits…) ou tempo, avec leur heure de début
struct Phase: Equatable {
    var type: String          // prep, work, rest, setrest, mark, done, ecc, ret, sw
    var dur: Double = 0
    var label: String = ""
    var side: String? = nil
    var si = 0
    var set = 0
    var rep = 0
    var at: Double = 0        // secondes depuis le départ

    static func interval(_ T: TimerSpec, sets: Int? = nil) -> [Phase] {
        var ph: [Phase] = []
        let sides: [String?] = T.sides.isEmpty ? [nil] : T.sides.map { Optional($0) }
        let nSets = sets ?? T.sets
        if T.prep > 0 { ph.append(Phase(type: "prep", dur: T.prep, label: "Prépare-toi", side: sides[0])) }
        for s in 0..<max(1, nSets) {
            for si in sides.indices {
                for r in 0..<max(1, T.reps) {
                    ph.append(Phase(type: "work", dur: T.work, label: T.raw["workLabel"]?.string ?? "Tire", side: sides[si], si: si, set: s + 1, rep: r + 1))
                    if T.markEach == "rep" { ph.append(Phase(type: "mark", si: si, set: s + 1, rep: r + 1)) }
                    if r < T.reps - 1 { ph.append(Phase(type: "rest", dur: T.rest, label: T.raw["restLabel"]?.string ?? "Relâche", side: sides[si], si: si, set: s + 1, rep: r + 1)) }
                }
                if T.markEach != "rep" { ph.append(Phase(type: "mark", si: si, set: s + 1)) }
                let last = s == nSets - 1 && si == sides.count - 1
                if !last {
                    let nsi = (si + 1) % sides.count
                    ph.append(Phase(type: "setrest", dur: T.setRest, label: "Repos", side: sides[nsi], si: nsi, set: nsi == 0 ? s + 2 : s + 1))
                }
            }
        }
        ph.append(Phase(type: "done", label: "Terminé"))
        return timed(ph)
    }
    static func tempo(_ T: TimerSpec, sets: Int, reps: Int) -> [Phase] {
        var ph: [Phase] = []
        let sides: [String?] = T.sides.isEmpty ? [nil] : T.sides.map { Optional($0) }
        let prep = T.raw["prep"]?.double ?? 5, ecc = T.ecc, ret = T.ret, sideRest = T.raw["sideRest"]?.double ?? 10
        let setRest = T.raw["setRest"]?.double ?? 60
        for s in 0..<max(1, sets) {
            for (si, side) in sides.enumerated() {
                if prep > 0 { ph.append(Phase(type: "prep", dur: prep, label: "Mise en place", side: side, si: si, set: s + 1)) }
                for r in 1...max(1, reps) {
                    ph.append(Phase(type: "ecc", dur: ecc, label: "Excentrique · descends", side: side, si: si, set: s + 1, rep: r))
                    if ret > 0 && r < reps { ph.append(Phase(type: "ret", dur: ret, label: "Retour · remets-toi en place", side: side, si: si, set: s + 1, rep: r)) }
                }
                if si < sides.count - 1 { ph.append(Phase(type: "sw", dur: sideRest, label: "Change de bras", side: sides[si + 1], si: si + 1, set: s + 1)) }
            }
            ph.append(Phase(type: "mark", set: s + 1))
            if s < sets - 1 { ph.append(Phase(type: "setrest", dur: setRest, label: "Repos", side: sides[0], si: 0, set: s + 2)) }
        }
        ph.append(Phase(type: "done", label: "Terminé"))
        return timed(ph)
    }
    private static func timed(_ ph: [Phase]) -> [Phase] {
        var t = 0.0
        return ph.map { var p = $0; p.at = t; t += p.dur; return p }
    }
    var isWork: Bool { type == "work" || type == "ecc" }
}
