import SwiftUI
import Charts
import CoreMotion

// Suivi → Tests : catalogue par catégorie, historique et courbe de chaque test, passations, tests perso, inclinomètre.

private func f1(_ x: Double) -> String { Fmt.num((x * 10).rounded() / 10) }

struct DeltaText: View {
    let p: Double?
    var body: some View {
        if let p, !p.isNaN {
            Text((p > 0 ? "+" : "") + f1(p) + " %").font(Typo.mono(12.5, .semibold))
                .foregroundStyle(p > 0.05 ? Palette.good : p < -0.05 ? Palette.crit : Palette.muted)
        }
    }
}

enum TestsAPI {
    static func valueKeys(_ t: JSON) -> [JSON] { Core.shared.call("tests.valueKeys", t)?.array ?? [] }
    static func history(_ tid: String) -> [JSON] { Core.shared.call("tests.history", .str(tid))?.array ?? [] }
    static func fmtVals(_ t: JSON, _ vals: JSON) -> String {
        valueKeys(t).compactMap { vk -> String? in
            guard let v = vals[vk["key"]?.string ?? ""]?.double else { return nil }
            let pre = vk["side"]?.string.map { $0 + " " } ?? ((vk["label"]?.string).flatMap { $0.isEmpty ? nil : $0 + " " } ?? "")
            let u = vk["unit"]?.string ?? ""
            return pre + Fmt.num(v) + (u.isEmpty ? "" : " " + u)
        }.joined(separator: " · ")
    }
    static func pct(_ a: Double?, _ b: Double?) -> Double? { guard let a, let b, b != 0 else { return nil }; return (a - b) / abs(b) * 100 }
}

struct TestsView: View {
    @State private var store = Store.shared
    @State private var sheet: TestsSheet?
    @State private var all = false
    enum TestsSheet: Identifiable {
        case test(String), entry(String?, [String]), custom(JSON?)
        var id: String {
            switch self { case .test(let t): return "t" + t; case .entry(let k, let p): return "e" + (k ?? "") + p.joined(); case .custom(let j): return "c" + (j?["id"]?.string ?? "") }
        }
    }
    private struct Model {
        var tests: [JSON] = [], cats: [(String, String)] = [], days: [String] = []
        var done = Set<String>(), rel: [String]? = nil
    }
    private func model() -> Model {
        let C = Core.shared
        var m = Model()
        m.tests = C.call("tests.allTests")?.array ?? []
        m.cats = C.constant("tests.CATS").array.map { ($0[0]?.string ?? "", $0[1]?.string ?? "") }
        m.days = Array((C.call("tests.testDays")?.array.compactMap { $0.string } ?? []).reversed())
        for d in m.days {
            let res = C.call("tests.resultsOn", .str(d))?["res"]?.object ?? [:]
            for id in res.keys { m.done.insert(id) }
        }
        m.rel = C.call("sports.relevantTestCats")?.array.compactMap { $0.string }
        return m
    }
    private func visible(_ c: String, _ m: Model) -> Bool {
        if all { return true }
        guard let rel = m.rel else { return true }
        if rel.contains(c) { return true }
        return m.tests.contains { $0["cat"]?.string == c && m.done.contains($0["id"]?.string ?? "") }
    }
    private func hiddenCount(_ m: Model) -> Int {
        m.cats.filter { c in !visible(c.0, m) && m.tests.contains { $0["cat"]?.string == c.0 } }.count
    }
    private func plural(_ n: Int, _ w: String) -> String { "\(n) " + w + (n > 1 ? "s" : "") }

    var body: some View {
        let _ = store.version
        let m = model()
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                Button { sheet = .entry(nil, []) } label: { Label("Nouvelle passation", systemImage: "plus") }.buttonStyle(BigButton())
                Button("Créer un test") { sheet = .custom(nil) }.buttonStyle(BigButton(kind: .plain)).frame(maxWidth: 140)
            }
            if !m.days.isEmpty { daysCard(m) }
            ForEach(m.cats.map { $0.0 }, id: \.self) { c in catCard(c, m) }
            let hn = hiddenCount(m)
            if hn > 0 {
                Button("Voir les autres tests (" + plural(hn, "catégorie") + ")") { withAnimation { all = true } }.buttonStyle(SmallButton()).frame(maxWidth: .infinity)
            }
            Text("Les pourcentages comparent au résultat précédent (côté droit ou première mesure).").font(Typo.sans(12.5)).foregroundStyle(Palette.muted).frame(maxWidth: .infinity)
        }
        .sheet(item: $sheet) { s in sheetView(s) }
    }
    private func daysCard(_ m: Model) -> some View {
        FoldCard(id: "tests-days", title: "Passations", summary: plural(m.days.count, "passation") + " · dernière le " + D.day(m.days[0]), open: true) {
            ForEach(m.days.prefix(12), id: \.self) { d in
                TestDayRow(d: d, tests: m.tests) { sheet = .entry(d, []) }
            }
        }
    }
    @ViewBuilder private func catCard(_ c: String, _ m: Model) -> some View {
        let list = m.tests.filter { $0["cat"]?.string == c }
        if !list.isEmpty && visible(c, m) {
            TestCatCard(cat: c, title: m.cats.first { $0.0 == c }?.1 ?? c, list: list, done: m.done) { tid in sheet = .test(tid) }
        }
    }
    @ViewBuilder private func sheetView(_ s: TestsSheet) -> some View {
        switch s {
        case .test(let tid): TestSheet(tid: tid) { sheet = .entry(nil, [tid]) }
        case .entry(let k, let pre): EntrySheet(k0: k, pre: pre)
        case .custom(let t): CustomTestSheet(t: t)
        }
    }
}

private struct TestDayRow: View {
    let d: String, tests: [JSON]
    let open: () -> Void
    var body: some View {
        let res = Core.shared.call("tests.resultsOn", .str(d))?["res"]?.object ?? [:]
        let names = res.keys.sorted().map { id in name(id) }.joined(separator: " · ")
        Button(action: open) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(D.short(d)).font(Typo.sans(15, .semibold)).foregroundStyle(Palette.ink)
                    Text(count(res.count)).font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                }
                .frame(width: 110, alignment: .leading)
                Text(names).font(Typo.sans(13.5)).foregroundStyle(Palette.muted).multilineTextAlignment(.leading)
                Spacer(minLength: 0)
            }
            .padding(.vertical, 8).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
    private func name(_ id: String) -> String { tests.first { $0["id"]?.string == id }?["name"]?.string ?? id }
    private func count(_ n: Int) -> String { "\(n) test" + (n > 1 ? "s" : "") }
}

private struct TestCatCard: View {
    let cat: String, title: String, list: [JSON], done: Set<String>
    let open: (String) -> Void
    var body: some View {
        let n = list.filter { done.contains($0["id"]?.string ?? "") }.count
        FoldCard(id: "tests-cat-" + cat, title: title, summary: summary(n), open: n > 0) {
            ForEach(list.indices, id: \.self) { i in
                TestRow(t: list[i]) { open(list[i]["id"]?.string ?? "") }
            }
        }
    }
    private func summary(_ n: Int) -> String {
        "\(list.count) test" + (list.count > 1 ? "s" : "") + (n > 0 ? " · \(n) avec résultats" : "")
    }
}

private struct TestRow: View {
    let t: JSON
    let open: () -> Void
    var body: some View {
        let tid = t["id"]?.string ?? ""
        let h = TestsAPI.history(tid)
        Button(action: open) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(t["name"]?.string ?? tid).font(Typo.sans(15, .medium)).foregroundStyle(Palette.ink).multilineTextAlignment(.leading)
                    Text(lastLine(h.last)).font(Typo.sans(12.5)).foregroundStyle(Palette.muted).multilineTextAlignment(.leading)
                }
                Spacer()
                DeltaText(p: delta(h))
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Palette.muted.opacity(0.6))
            }
            .padding(.vertical, 8).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
    private func lastLine(_ last: JSON?) -> String {
        guard let last else { return "Pas encore testé" }
        return D.short(last["k"]?.string ?? "") + " · " + TestsAPI.fmtVals(t, last["vals"] ?? .emptyObject)
    }
    private func delta(_ h: [JSON]) -> Double? {
        guard h.count > 1 else { return nil }
        let vk = TestsAPI.valueKeys(t).first
        let better: Double = vk?["better"]?.string == "down" ? -1 : 1
        let key = vk?["key"]?.string ?? "v"
        let p = TestsAPI.pct(h[h.count - 1]["vals"]?[key]?.double, h[h.count - 2]["vals"]?[key]?.double)
        return p.map { $0 * better }
    }
}

/// Un test : dernier résultat, écarts, courbe, historique et protocole
struct TestSheet: View {
    let tid: String
    let onAdd: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var edit = false
    @State private var confirmDelete = false
    var body: some View {
        let t = Core.shared.call("tests.testById", .str(tid))
        NavigationStack {
            ScrollView {
                if let t { content(t) }
            }
            .background(Palette.bg)
            .navigationTitle(t?["name"]?.string ?? "Test")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Fermer") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) { Button("Ajouter") { add() }.fontWeight(.semibold) }
            }
        }
    }
    private func add() { dismiss(); DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { onAdd() } }
    @ViewBuilder private func content(_ t: JSON) -> some View {
        let h = TestsAPI.history(tid)
        VStack(alignment: .leading, spacing: 14) {
            if h.isEmpty {
                Text("Pas encore de résultat. Touche « Ajouter » après une passation.").font(Typo.sans(15)).foregroundStyle(Palette.muted).frame(maxWidth: .infinity).padding(.vertical, 20)
            } else {
                TestLastCard(tid: tid, t: t, h: h)
                TestHistoryCard(t: t, h: h)
            }
            TestProtocolCard(t: t)
            if t["custom"]?.truthy == true { customButtons }
        }
        .padding(16)
        .sheet(isPresented: $edit) { CustomTestSheet(t: t) }
    }
    private var customButtons: some View {
        HStack(spacing: 10) {
            Button("Modifier ce test") { edit = true }.buttonStyle(BigButton(kind: .plain))
            Button("Supprimer") { confirmDelete = true }.buttonStyle(BigButton(kind: .danger))
        }
        .confirmationDialog("Supprimer ce test ?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Supprimer", role: .destructive) { Core.shared.call("tests.deleteCustomTest", .str(tid)); dismiss() }
        } message: { Text("Les résultats déjà notés restent dans l’historique.") }
    }
}

private func vkLabel(_ vk: JSON) -> String { (vk["label"]?.string).flatMap { $0.isEmpty ? nil : $0 } ?? "Résultat" }
private func vkBetter(_ vks: [JSON]) -> Double { vks.first?["better"]?.string == "down" ? -1 : 1 }

private struct TestLastCard: View {
    let tid: String, t: JSON, h: [JSON]
    var body: some View {
        let vks = TestsAPI.valueKeys(t), last = h[h.count - 1]
        VStack(alignment: .leading, spacing: 12) {
            CardHeader("Dernier résultat") { Text(D.short(last["k"]?.string ?? "")).font(Typo.mono(12.5)).foregroundStyle(Palette.muted) }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 12) {
                ForEach(vks.indices, id: \.self) { i in
                    TestValueCell(t: t, vk: vks[i], h: h, better: vkBetter(vks))
                }
            }
            if tid == "er-90" || tid == "ir-90" { RatioNote(k: last["k"]?.string ?? "") }
            TestChart(t: t, h: h)
        }
        .card()
    }
}

private struct TestValueCell: View {
    let t: JSON, vk: JSON, h: [JSON], better: Double
    var body: some View {
        let key = vk["key"]?.string ?? "v", last = h[h.count - 1]
        if let v = last["vals"]?[key]?.double {
            VStack(alignment: .leading, spacing: 2) {
                Text(vkLabel(vk)).font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                HStack(alignment: .firstTextBaseline, spacing: 3) {
                    Text(Fmt.num(v)).font(Typo.display(32)).foregroundStyle(Palette.ink)
                    Text(vk["unit"]?.string ?? "").font(Typo.mono(12)).foregroundStyle(Palette.muted)
                }
                if let rel = Core.shared.call("tests.relValue", t, .num(v), last["bw"] ?? .null)?.double {
                    Text(f1(rel) + " % du poids de corps").font(Typo.sans(12)).foregroundStyle(Palette.muted)
                }
                if h.count > 1, let pv = h[h.count - 2]["vals"]?[key]?.double {
                    compare("vs précédent", v, pv)
                }
                if h.count > 2, let fv = h[0]["vals"]?[key]?.double {
                    compare("vs premier", v, fv)
                }
            }
        }
    }
    private func compare(_ l: String, _ v: Double, _ ref: Double) -> some View {
        HStack(spacing: 4) {
            Text(l).font(Typo.sans(12)).foregroundStyle(Palette.muted)
            DeltaText(p: TestsAPI.pct(v, ref).map { $0 * better })
        }
    }
}

private struct TestHistoryCard: View {
    let t: JSON, h: [JSON]
    var body: some View {
        let vks = TestsAPI.valueKeys(t)
        VStack(alignment: .leading, spacing: 0) {
            CardHeader("Historique").padding(.bottom, 6)
            ForEach(Array(h.indices.reversed()), id: \.self) { i in
                TestHistRow(x: h[i], p: i > 0 ? h[i - 1] : nil, vks: vks)
                Divider().overlay(Palette.rule.opacity(0.5))
            }
        }
        .card()
    }
}

private struct TestHistRow: View {
    let x: JSON, p: JSON?, vks: [JSON]
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(D.short(x["k"]?.string ?? "")).font(Typo.sans(14.5, .semibold)).foregroundStyle(Palette.ink)
                Spacer()
                if let bw = x["bw"]?.double { Text("poids " + Fmt.num(bw) + " kg").font(Typo.sans(12)).foregroundStyle(Palette.muted) }
            }
            Flow(spacing: 10) {
                ForEach(vks.indices, id: \.self) { j in cell(vks[j]) }
            }
            if let n = x["note"]?.string { Text(n).font(Typo.sans(12.5)).foregroundStyle(Palette.muted) }
        }
        .padding(.vertical, 8)
    }
    private func line(_ vk: JSON, _ v: Double) -> String {
        let u: String = vk["unit"]?.string ?? ""
        let l: String = vkLabel(vk)
        return l + " " + Fmt.num(v) + " " + u
    }
    private func delta(_ v: Double, _ key: String) -> Double? {
        let ref: Double? = p?["vals"]?[key]?.double
        guard let d = TestsAPI.pct(v, ref) else { return nil }
        return d * vkBetter(vks)
    }
    @ViewBuilder private func cell(_ vk: JSON) -> some View {
        let key = vk["key"]?.string ?? "v"
        if let v = x["vals"]?[key]?.double {
            HStack(spacing: 4) {
                Text(line(vk, v)).font(Typo.sans(13.5)).foregroundStyle(Palette.ink)
                DeltaText(p: delta(v, key))
            }
        }
    }
}

private struct RatioNote: View {
    let k: String
    var body: some View {
        let r = Core.shared.call("tests.resultsOn", .str(k))?["res"] ?? .emptyObject
        let ir = r["ir-90"], er = r["er-90"]
        let parts = [("D", "droite"), ("G", "gauche")].compactMap { s -> String? in
            guard let i = ir?["v." + s.0]?.double, let e = er?["v." + s.0]?.double, i > 0 else { return nil }
            return s.1 + " " + f1(e / i * 100) + " %"
        }
        if !parts.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                Text("Rapport RE/RI : " + parts.joined(separator: " · ") + ". Une rotation externe nettement plus faible que l’interne est associée à plus de blessures d’épaule.")
                    .font(Typo.sans(13)).foregroundStyle(Palette.muted)
                SourcesLine(ids: ["byram2010"])
            }
        }
    }
}

/// Courbe d'un test (une ligne par mesure ou par côté)
struct TestChart: View {
    let t: JSON
    let h: [JSON]
    private let colors: [Color] = [Palette.accent, Palette.kind("doigts"), Palette.kind("kine"), Palette.kind("epaule")]
    struct P: Identifiable { let id = UUID(); let i: Int; let k: String; let v: Double; let s: String }
    var body: some View {
        let vks = TestsAPI.valueKeys(t).filter { vk in h.contains { $0["vals"]?[vk["key"]?.string ?? ""]?.double != nil } }
        if h.count >= 2 && !vks.isEmpty {
            let names = vks.map { ($0["label"]?.string).flatMap { $0.isEmpty ? nil : $0 } ?? "Résultat" }
            let pts: [P] = vks.indices.flatMap { j in h.indices.compactMap { i -> P? in
                guard let v = h[i]["vals"]?[vks[j]["key"]?.string ?? ""]?.double else { return nil }
                return P(i: i, k: h[i]["k"]?.string ?? "", v: v, s: names[j])
            } }
            Chart(pts) { p in
                LineMark(x: .value("Passation", D.day(p.k)), y: .value("Valeur", p.v))
                    .foregroundStyle(by: .value("Mesure", p.s)).lineStyle(StrokeStyle(lineWidth: 2)).interpolationMethod(.monotone)
                PointMark(x: .value("Passation", D.day(p.k)), y: .value("Valeur", p.v))
                    .foregroundStyle(by: .value("Mesure", p.s)).symbolSize(48)
            }
            .chartForegroundStyleScale(domain: names, range: Array(colors.prefix(max(1, names.count))))
            .chartLegend(names.count > 1 ? .visible : .hidden)
            .chartYScale(domain: .automatic(includesZero: false))
            .chartYAxis {
                AxisMarks(position: .leading) { _ in
                    AxisGridLine().foregroundStyle(Palette.rule.opacity(0.5))
                    AxisValueLabel().font(Typo.mono(10))
                }
            }
            .chartXAxis { AxisMarks { _ in AxisValueLabel().font(Typo.mono(10)) } }
            .frame(height: 170)
        }
    }
}

struct TestProtocolCard: View {
    let t: JSON
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            CardHeader("Protocole")
            let proto = t["proto"]?.array.compactMap { $0.string } ?? []
            if proto.isEmpty { Text(t["desc"]?.string ?? "Pas de protocole écrit.").font(Typo.sans(14.5)).foregroundStyle(Palette.muted) }
            ForEach(proto.indices, id: \.self) { i in
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text("\(i + 1)").font(Typo.mono(13, .semibold)).foregroundStyle(Palette.accent).frame(width: 18)
                    GlossText(proto[i]).font(Typo.sans(14.5)).foregroundStyle(Palette.ink).fixedSize(horizontal: false, vertical: true)
                }
            }
            if let e = t["equip"]?.string { (Text("Matériel. ").font(Typo.sans(13.5, .semibold)) + Text(e)).font(Typo.sans(13.5)).foregroundStyle(Palette.ink) }
            if let tips = t["tips"]?.string { (Text("À savoir. ").font(Typo.sans(13.5, .semibold)) + Text(tips)).font(Typo.sans(13.5)).foregroundStyle(Palette.ink) }
            SourcesLine(ids: t["src"]?.array.compactMap { $0.string } ?? [])
            Text("Mêmes conditions à chaque passation : même heure, même échauffement, même ordre, 48 h sans séance dure.").font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
        }
        .card()
    }
}

struct TestProtocolSheet: View {
    let tid: String
    var body: some View {
        NavigationStack {
            ScrollView {
                if let t = Core.shared.call("tests.testById", .str(tid)) { TestProtocolCard(t: t).padding(16) }
            }
            .background(Palette.bg)
            .navigationTitle(Core.shared.call("tests.testById", .str(tid))?["name"]?.string ?? "Protocole").navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium, .large])
    }
}

/// Passation : date, tests choisis par catégorie, résultats, note
struct EntrySheet: View {
    let k0: String?
    let pre: [String]
    @Environment(\.dismiss) private var dismiss
    @State private var date = Date()
    @State private var sel: [String] = []
    @State private var cat: String?
    @State private var note = ""
    @State private var ready = false
    private var k: String { D.key(date) }
    var body: some View {
        let C = Core.shared
        let tests = C.call("tests.allTests")?.array ?? []
        let cats = C.constant("tests.CATS").array.map { ($0[0]?.string ?? "", $0[1]?.string ?? "") }.filter { c in tests.contains { $0["cat"]?.string == c.0 } }
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                        .font(Typo.sans(16, .medium)).environment(\.locale, Locale(identifier: "fr_FR"))
                        .onChange(of: date) { _, _ in
                            sel = Array(Set(sel + (C.call("tests.resultsOn", .str(k))?["res"]?.object.keys.map { $0 } ?? [])))
                            note = C.call("tests.resultsOn", .str(k))?["note"]?.string ?? ""
                        }
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(alignment: .firstTextBaseline) {
                            Text("Tests de la passation").font(Typo.sans(14.5, .semibold)).foregroundStyle(Palette.ink)
                            Text(sel.isEmpty ? "touche pour ajouter" : "\(sel.count) choisi\(sel.count > 1 ? "s" : "")").font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                        }
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) { ForEach(cats.map { $0.0 }, id: \.self) { c in Chip(label: cats.first { $0.0 == c }?.1 ?? c, on: cat == c) { cat = cat == c ? nil : c } } }
                        }
                        if let cat {
                            Flow(spacing: 6) {
                                ForEach(tests.filter { $0["cat"]?.string == cat }.compactMap { $0["id"]?.string }, id: \.self) { id in
                                    Chip(label: tests.first { $0["id"]?.string == id }?["name"]?.string ?? id, on: sel.contains(id)) {
                                        if sel.contains(id) { sel.removeAll { $0 == id } } else { sel.append(id) }
                                    }
                                }
                            }
                        }
                    }
                    if sel.isEmpty {
                        Text("Choisis une catégorie puis les tests réalisés.").font(Typo.sans(14.5)).foregroundStyle(Palette.muted).frame(maxWidth: .infinity).padding(.vertical, 10)
                    } else {
                        TestEntry(k: k, tids: sel).id(k + sel.joined(separator: ","))
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Note de la passation").font(Typo.sans(13.5, .medium)).foregroundStyle(Palette.muted)
                        TextField("Conditions, heure, sensations, matériel…", text: $note, axis: .vertical).lineLimit(2...6)
                            .font(Typo.sans(16)).padding(12).background(Palette.sunk, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                }
                .padding(16)
            }
            .background(Palette.bg)
            .navigationTitle("Passation de tests").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Fermer") { saveNote(); dismiss() } }
                ToolbarItem(placement: .topBarTrailing) { Button("OK") { saveNote(); toast("Résultats enregistrés"); dismiss() }.fontWeight(.semibold) }
            }
        }
        .onAppear {
            guard !ready else { return }
            ready = true
            if let k0 { date = D.utc(k0).addingTimeInterval(12 * 3600) }
            let done = C.call("tests.resultsOn", .str(k))?["res"]?.object.keys.map { $0 } ?? []
            sel = Array(NSOrderedSet(array: pre + done)) as? [String] ?? pre + done
            note = C.call("tests.resultsOn", .str(k))?["note"]?.string ?? ""
        }
    }
    private func saveNote() {
        let n = note.trimmingCharacters(in: .whitespacesAndNewlines)
        Core.shared.call("tests.saveResults", .str(k), n.isEmpty ? JSON.obj([:]) : ["note": .str(n)])
    }
}

/// Créer ou modifier un test perso
struct CustomTestSheet: View {
    let t: JSON?
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var unit = ""
    @State private var better = "up"
    @State private var sides = false
    @State private var equip = ""
    @State private var proto = ""
    @State private var id = ""
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Nom (ex. Suspension max 15 mm)", text: $name)
                    TextField("Unité (kg, s, cm, rép.…)", text: $unit)
                    Picker("Meilleur résultat", selection: $better) { Text("Plus haut = mieux").tag("up"); Text("Plus bas = mieux").tag("down") }
                    Toggle("Côté droit et gauche séparés", isOn: $sides)
                }
                Section("Matériel") { TextField("Matériel", text: $equip) }
                Section("Protocole (une étape par ligne)") { TextField("Étapes", text: $proto, axis: .vertical).lineLimit(4...12) }
            }
            .scrollContentBackground(.hidden).background(Palette.bg)
            .navigationTitle(t == nil ? "Nouveau test" : "Modifier le test").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Annuler") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) { Button("OK", action: save).fontWeight(.semibold) }
            }
        }
        .onAppear {
            guard id.isEmpty else { return }
            id = t?["id"]?.string ?? ("perso-" + String(UUID().uuidString.prefix(5)).lowercased())
            name = t?["name"]?.string ?? ""; unit = t?["unit"]?.string ?? ""; sides = t?["sides"]?.truthy ?? false
            better = t?["measures"]?[0]?["better"]?.string ?? "up"; equip = t?["equip"]?.string ?? ""
            proto = (t?["proto"]?.array.compactMap { $0.string } ?? []).joined(separator: "\n")
        }
    }
    private func save() {
        let n = name.trimmingCharacters(in: .whitespaces)
        guard !n.isEmpty else { toast("Donne un nom au test"); return }
        let u = unit.trimmingCharacters(in: .whitespaces)
        var o: [String: JSON] = ["id": .str(id), "name": .str(n), "unit": .str(u), "sides": .bool(sides), "cat": "perso",
                                 "measures": [["k": "v", "l": "Résultat", "unit": .str(u), "better": .str(better)]],
                                 "proto": .arr(proto.components(separatedBy: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }.map { .str($0) })]
        let e = equip.trimmingCharacters(in: .whitespaces); if !e.isEmpty { o["equip"] = .str(e) }
        Core.shared.call("tests.saveCustomTest", .obj(o))
        toast("Test enregistré"); dismiss()
    }
}

/// Le téléphone comme inclinomètre : posé à plat sur le segment, il donne l'angle avec le sol
struct InclinometerView: View {
    let onTake: (Int) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var deg: Double?
    @State private var zero: Double = 0
    @State private var zeroed = false
    @State private var motion = CMMotionManager()
    var body: some View {
        let val = deg.map { Int(abs(($0 - zero).rounded())) }
        NavigationStack {
            VStack(spacing: 20) {
                Text("Pose le téléphone à plat dans la longueur du segment (tibia, cuisse, avant-bras). L’angle est celui du téléphone avec le sol ; « Remettre à zéro » mesure par rapport à une autre position de départ.")
                    .font(Typo.sans(14.5)).foregroundStyle(Palette.muted)
                Spacer()
                ZStack {
                    Circle().stroke(Palette.sunk, lineWidth: 10)
                    Circle().trim(from: 0, to: min(1, Double(val ?? 0) / 180)).stroke(Palette.accent, style: StrokeStyle(lineWidth: 10, lineCap: .round)).rotationEffect(.degrees(-90))
                        .animation(.spring(response: 0.3), value: val)
                    Text(val.map { "\($0)°" } ?? "—").font(Typo.display(84)).foregroundStyle(Palette.ink).contentTransition(.numericText())
                }
                .frame(width: 230, height: 230)
                if !motion.isDeviceMotionAvailable { Text("Ce téléphone ne donne pas accès à ses capteurs de mouvement : saisis l’angle à la main.").font(Typo.sans(14)).foregroundStyle(Palette.crit) }
                Spacer()
                HStack(spacing: 10) {
                    Button(zeroed ? "Zéro fait" : "Remettre à zéro") { if let d = deg { zero = d; zeroed = true; Haptics.select() } }.buttonStyle(BigButton(kind: .plain)).disabled(deg == nil)
                    Button("Prendre" + (val.map { " \($0)°" } ?? "")) { if let v = val { Haptics.success(); onTake(v) } }.buttonStyle(BigButton()).disabled(val == nil)
                }
            }
            .padding(20)
            .background(Palette.bg)
            .navigationTitle("Mesurer l’angle").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Fermer") { dismiss() } } }
        }
        .onAppear {
            guard motion.isDeviceMotionAvailable else { return }
            motion.deviceMotionUpdateInterval = 1.0 / 20
            motion.startDeviceMotionUpdates(to: .main) { m, _ in
                guard let g = m?.gravity else { return }
                // pente du grand axe du téléphone par rapport à l'horizontale
                deg = atan2(-g.y, (g.x * g.x + g.z * g.z).squareRoot()) * 180 / .pi
            }
        }
        .onDisappear { motion.stopDeviceMotionUpdates() }
    }
}

/// Carte dépliable dont l'état est retenu sur le téléphone
struct FoldCard<Content: View>: View {
    let id: String
    let title: String
    var summary: String? = nil
    var open: Bool = false
    @ViewBuilder var content: Content
    @State private var isOpen: Bool?
    var body: some View {
        let o = isOpen ?? (UserDefaults.standard.object(forKey: "fold:" + id) as? Bool ?? open)
        VStack(alignment: .leading, spacing: 10) {
            Button {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { isOpen = !o }
                UserDefaults.standard.set(!o, forKey: "fold:" + id)
                Haptics.select()
            } label: {
                HStack(alignment: .center) {
                    VStack(alignment: .leading, spacing: 3) {
                        DisplayTitle(title, size: 21)
                        if let summary { Text(summary).font(Typo.sans(13)).foregroundStyle(Palette.muted).multilineTextAlignment(.leading) }
                    }
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.down").font(.system(size: 13, weight: .semibold)).foregroundStyle(Palette.muted).rotationEffect(.degrees(o ? 180 : 0))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if o { content.transition(.opacity.combined(with: .move(edge: .top))) }
        }
        .card()
    }
}
