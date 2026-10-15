import Foundation

/// Opérations sur les blocs du jour (mêmes règles que la version web) : déplacer, faire à part, pas fait.
extension JournalWriter {
    private func without(_ o: JSON?, _ key: String) -> JSON? {
        guard var d = o?.object else { return nil }
        d.removeValue(forKey: key); return d.isEmpty ? nil : .obj(d)
    }
    /// « apart » (à un autre moment de la journée), « skip » (pas fait, avec la raison) ou nil (dans la séance)
    func setBlockState(_ k: String, _ b: Block, _ state: String?, _ val: String? = nil) {
        let e = s.journal(k)
        var patch: [String: JSON?] = ["apart": without(e["apart"], b.id), "skip": without(e["skip"], b.id)]
        if state == "apart" {
            var a = e["apart"]?.object ?? [:]
            var cur = a[b.id]?.object ?? [:]
            if cur["at"] == nil { cur["at"] = .num((Date().timeIntervalSince1970 * 1000).rounded()) }
            a[b.id] = .obj(cur); patch["apart"] = .obj(a)
        }
        if state == "skip" {
            var sk = e["skip"]?.object ?? [:]; sk[b.id] = .str(val ?? "autre"); patch["skip"] = .obj(sk)
        }
        s.jset(k, patch)
    }
    /// Déplace un bloc à un autre jour (le plan du jour d'arrivée reçoit une copie)
    func moveBlock(_ k: String, _ b: JSON, to: String) {
        let pr = PlanReader(s)
        let src = pr.day(k) ?? ["blocks": []], dst = pr.day(to) ?? ["blocks": []]
        let bid = b["id"]?.string ?? ""
        let srcReal = (src["blocks"]?.array ?? []).filter { $0["kind"]?.string != "rest" }
        let i = srcReal.firstIndex { $0["id"]?.string == bid } ?? 0
        let dstBlocks = dst["blocks"]?.array ?? []
        let taken = Set(dstBlocks.compactMap { $0["id"]?.string })
        let mmdd = String(k.dropFirst(5).prefix(2)) + String(k.dropFirst(8).prefix(2))
        let base = "mv" + mmdd
        var id = base, n = 2
        while taken.contains(id) { id = base + "-" + String(n); n += 1 }
        var copy = b; copy["id"] = .str(id); copy["movedFrom"] = .str(k); copy["heavy"] = nil
        let rest = dstBlocks.filter { $0["kind"]?.string == "rest" }, real = dstBlocks.filter { $0["kind"]?.string != "rest" }
        let before = i == 0 && srcReal.count > 1
        var nd = dst
        nd["blocks"] = .arr(before ? [copy] + real : real + [copy])
        if !rest.isEmpty && real.isEmpty { nd["restBak"] = .arr(rest) }
        s.put("p:" + to, nd)
        let e = s.journal(k)
        var moved = e["moved"]?.object ?? [:]; moved[bid] = ["to": .str(to), "id": .str(id)]
        s.jset(k, ["moved": .obj(moved), "apart": without(e["apart"], bid), "skip": without(e["skip"], bid)])
    }
}
