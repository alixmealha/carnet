import SwiftUI

// Éditeurs du plan (mêmes règles que la version web) : jour (blocs, exercices, minuteurs, objectif), semaine, réglages, blocs de texte, sections, exercices.

func uid(_ p: String) -> String { p + String(UUID().uuidString.lowercased().replacingOccurrences(of: "-", with: "").prefix(5)) }

extension Binding where Value == JSON {
    func at(_ k: String) -> Binding<JSON> {
        Binding<JSON>(get: { self.wrappedValue[k] ?? .null }, set: { self.wrappedValue[k] = $0 })
    }
    func at(_ i: Int) -> Binding<JSON> {
        Binding<JSON>(get: { self.wrappedValue.array.at(i) ?? .null }, set: { v in
            var a = self.wrappedValue.array
            if i >= 0 && i < a.count { a[i] = v; self.wrappedValue = .arr(a) }
        })
    }
    /// Texte d'un champ ; vide = champ retiré (sauf keep)
    func text(_ k: String, keep: Bool = false, def: String = "") -> Binding<String> {
        Binding<String>(get: { self.wrappedValue[k]?.string ?? def }, set: { v in self.wrappedValue[k] = v.isEmpty && !keep ? nil : .str(v) })
    }
}

/// Champ numérique d'un formulaire (virgule acceptée), enregistré à chaque frappe
struct FormNum: View {
    let label: String
    let value: Double?
    var integer = true
    var placeholder = "—"
    let onChange: (Double?) -> Void
    @State private var text = ""
    @State private var ready = false
    var body: some View {
        HStack {
            Text(label)
            Spacer(minLength: 8)
            TextField(placeholder, text: $text)
                .keyboardType(integer ? .numberPad : .decimalPad)
                .multilineTextAlignment(.trailing)
                .font(Typo.mono(16))
                .frame(maxWidth: 110)
                .onChange(of: text) { _, t in if ready { commit(t) } }
        }
        .onAppear {
            text = value.map { Fmt.num($0) } ?? ""
            DispatchQueue.main.async { ready = true }
        }
    }
    private func commit(_ t: String) {
        let s = t.replacingOccurrences(of: ",", with: ".").trimmingCharacters(in: .whitespaces)
        if s.isEmpty { onChange(nil); return }
        guard var n = Double(s) else { return }
        if integer { n = n.rounded() }
        onChange(n)
    }
}

func dateBinding(_ get: @escaping () -> String, _ set: @escaping (String) -> Void) -> Binding<Date> {
    Binding<Date>(get: { D.date(get().isEmpty ? D.today : get()) }, set: { set(D.key($0)) })
}

private let UNITS = ["Série", "Bloc", "Voie", "Essai"]
private let TIMERS: [(String, String)] = [("", "Aucun"), ("cluster", "Clusters"), ("contrast", "Contraste"), ("interval", "Intervalles"), ("tempo", "Tempo")]
private let FAMS: [(String, String)] = [("vol", "Volume (modéré)"), ("easy", "Facile"), ("hard", "Dur"), ("light", "Léger / récup"), ("muscu", "Muscu"), ("test", "Test")]
private let SIV: [(String, String)] = [("s", "Spécificité"), ("i", "Intensité"), ("v", "Volume")]

// MARK: jour

struct DayEditorView: View {
    let k: String
    var pushed = false
    @Environment(\.dismiss) private var dismiss
    @State private var d: JSON = ["blocks": []]
    @State private var orig: JSON = ["blocks": []]
    @State private var loaded = false
    @State private var allKinds = false
    @State private var copyTo = Date()
    @State private var askClose = false
    @State private var askRest = false
    @State private var askCopy = false
    @State private var delBlock: Int?

    private var blocks: [JSON] { d["blocks"]?.array ?? [] }
    private var dirty: Bool { d != orig }

    var body: some View {
        dialogs(chrome(form))
            .onAppear(perform: load)
    }

    private var form: some View {
        Form {
            DayWarnings(k: k, d: d)
            ForEach(blockIds, id: \.self) { bid in blockSection(bid) }
            if blocks.isEmpty {
                Section { Text("Jour de repos. Ajoute un bloc pour y mettre une séance.").foregroundStyle(Palette.muted) }
            }
            addBlockSection
            TargetSection(d: $d)
            copySection
            if !blocks.isEmpty {
                Section { Button("Passer ce jour en repos", role: .destructive) { askRest = true } }
            }
        }
    }
    @ViewBuilder private func blockSection(_ bid: String) -> some View {
        if let i = blocks.firstIndex(where: { $0["id"]?.string == bid }) {
            BlockEditorSection(b: $d.at("blocks").at(i), i: i, n: blocks.count, onMove: { dir in moveBlock(i, dir) }, onDelete: { delBlock = i })
        }
    }
    private func chrome<V: View>(_ v: V) -> some View {
        v.scrollContentBackground(.hidden).background(Palette.bg)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Séance · " + D.short(k)).navigationBarTitleDisplayMode(.inline)
            .navigationBarBackButtonHidden(pushed)
            .interactiveDismissDisabled(dirty)
            .toolbar { toolbarItems }
    }
    @ToolbarContentBuilder private var toolbarItems: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) { Button("Annuler", action: cancel) }
        ToolbarItem(placement: .topBarTrailing) { Button("OK", action: save).fontWeight(.semibold).disabled(!dirty) }
    }
    private func cancel() { if dirty { askClose = true } else { dismiss() } }
    private var copyTitle: String { "Le " + D.day(D.key(copyTo)) + " a déjà une séance. La remplacer ?" }
    private var delShown: Binding<Bool> { Binding(get: { delBlock != nil }, set: { if !$0 { delBlock = nil } }) }
    private func dialogs<V: View>(_ v: V) -> some View {
        v.confirmationDialog("Abandonner les modifications ?", isPresented: $askClose, titleVisibility: .visible) {
            Button("Abandonner", role: .destructive) { dismiss() }
        }
        .confirmationDialog("Vider ce jour (repos) ?", isPresented: $askRest, titleVisibility: .visible) {
            Button("Passer en repos", role: .destructive) { toRest() }
        }
        .confirmationDialog(deleteTitle, isPresented: delShown, titleVisibility: .visible) {
            Button("Supprimer", role: .destructive) { if let i = delBlock { removeBlock(i) }; delBlock = nil }
        }
        .confirmationDialog(copyTitle, isPresented: $askCopy, titleVisibility: .visible) {
            Button("Remplacer", role: .destructive) { doCopy() }
        }
    }
    private func toRest() { withAnimation { d["blocks"] = .arr([]); d["target"] = nil } }

    private var blockIds: [String] { blocks.map { $0["id"]?.string ?? "" } }
    private var deleteTitle: String {
        guard let i = delBlock, let b = blocks.at(i) else { return "Supprimer ce bloc ?" }
        let t = b["title"]?.string.flatMap { $0.isEmpty ? nil : $0 } ?? KIND[b["kind"]?.string ?? ""] ?? "Bloc"
        return "Supprimer le bloc « " + t + " » ?"
    }

    private var addBlockSection: some View {
        let rel = Core.shared.call("sports.relevantKinds")?.array.compactMap { $0.string }
        let list = KIND_ORDER.filter { $0 != "rest" && (rel == nil || allKinds || rel!.contains($0)) }
        return Section("Ajouter un bloc") {
            Flow(spacing: 8) {
                ForEach(list, id: \.self) { kd in
                    Button { addBlock(kd) } label: {
                        HStack(spacing: 6) {
                            Circle().fill(Palette.kind(kd)).frame(width: 8, height: 8)
                            Text(KIND[kd] ?? kd).font(Typo.sans(14, .medium)).foregroundStyle(Palette.ink)
                        }
                        .padding(.horizontal, 12).frame(minHeight: 34)
                        .background(Palette.sunk, in: Capsule())
                    }
                    .buttonStyle(PressStyle())
                }
                if rel != nil && !allKinds {
                    Button { allKinds = true } label: {
                        Text("Autres types…").font(Typo.sans(14, .medium)).foregroundStyle(Palette.muted)
                            .padding(.horizontal, 12).frame(minHeight: 34)
                            .overlay(Capsule().strokeBorder(Palette.rule, style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
                    }
                    .buttonStyle(PressStyle())
                }
            }
            .padding(.vertical, 4)
        }
    }

    private var copySection: some View {
        Section {
            DatePicker("Vers le", selection: $copyTo, displayedComponents: .date)
            Button("Copier ce jour") {
                if PlanReader().day(D.key(copyTo)) != nil { askCopy = true } else { doCopy() }
            }
            .disabled(D.key(copyTo) == k)
        } header: { Text("Copier ce jour") } footer: {
            Text("Copie la version affichée ici, y compris les modifications pas encore enregistrées.")
        }
    }

    private func load() {
        guard !loaded else { return }
        loaded = true
        var x = PlanReader().day(k) ?? ["blocks": []]
        if x["blocks"] == nil { x["blocks"] = .arr([]) }
        d = x; orig = x
        copyTo = D.date(D.add(k, 7))
    }
    private func addBlock(_ kd: String) {
        Haptics.tap()
        var bl = blocks
        bl.append(["id": .str(uid("b")), "kind": .str(kd), "title": .str(KIND[kd] ?? kd), "desc": "", "sub": "", "items": []])
        withAnimation { d["blocks"] = .arr(bl) }
    }
    private func moveBlock(_ i: Int, _ dir: Int) {
        var bl = blocks
        let j = i + dir
        guard j >= 0 && j < bl.count else { return }
        bl.swapAt(i, j)
        withAnimation { d["blocks"] = .arr(bl) }
    }
    private func removeBlock(_ i: Int) {
        var bl = blocks
        guard i < bl.count else { return }
        bl.remove(at: i)
        withAnimation { d["blocks"] = .arr(bl) }
    }
    private func filled(_ x: JSON) -> JSON {
        var c = x
        var bl = c["blocks"]?.array ?? []
        for i in bl.indices where (bl[i]["title"]?.string ?? "").isEmpty {
            bl[i]["title"] = .str(KIND[bl[i]["kind"]?.string ?? ""] ?? "Bloc")
        }
        c["blocks"] = .arr(bl)
        return c
    }
    private func save() {
        Core.shared.call("plan.saveDay", .str(k), filled(d))
        Haptics.success(); toast("Séance enregistrée")
        orig = d
        dismiss()
    }
    private func doCopy() {
        let to = D.key(copyTo)
        Core.shared.call("plan.saveDay", .str(to), filled(d))
        Haptics.success(); toast("Copié vers le " + D.day(to))
    }
}

/// Règle des 48 h et journal déjà rempli
private struct DayWarnings: View {
    let k: String
    let d: JSON
    var body: some View {
        let w48 = Core.shared.call("builder.check48", .str(k), d)?.array ?? []
        let hasJournal = !Store.shared.journal(k).object.isEmpty
        if !w48.isEmpty || hasJournal {
            Section {
                if !w48.isEmpty {
                    Label { Text(text48(w48)).font(Typo.sans(14)) } icon: { Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Palette.warn) }
                }
                if hasJournal {
                    Text("Ce jour a déjà un journal. Les cases cochées restent liées aux exercices existants ; un exercice supprimé perd ses cases.")
                        .font(Typo.sans(13.5)).foregroundStyle(Palette.muted)
                }
            }
        }
    }
    private func text48(_ w: [JSON]) -> String {
        let parts = w.map { x -> String in
            let g: String = Core.shared.call("builder.groupsTxt", x["groups"] ?? .arr([]))?.string ?? ""
            let when: String = x["when"]?.string ?? ""
            let k: String = x["k"]?.string ?? ""
            return "séance lourde " + when + " (" + D.short(k) + ") sur les mêmes muscles : " + g
        }
        return "Règle des 48 h : " + parts.joined(separator: " ; ") + ". Idéalement 48 h entre deux séances lourdes des mêmes muscles : allège l’une des deux ou décale-la."
    }
}

/// Un bloc : type, titre, résumé, minuteur, tests, exercices
private struct BlockEditorSection: View {
    @Binding var b: JSON
    let i: Int
    let n: Int
    let onMove: (Int) -> Void
    let onDelete: () -> Void

    private var kind: String { b["kind"]?.string ?? "autre" }
    private var items: [JSON] { b["items"]?.array ?? [] }

    var body: some View {
        Section {
            Picker("Type", selection: $b.text("kind", keep: true, def: "autre")) {
                ForEach(KIND_ORDER, id: \.self) { kd in Text(KIND[kd] ?? kd).tag(kd) }
            }
            TextField("Titre", text: $b.text("title", keep: true))
            TextField("Résumé (7 × 5 · RIR 1–2…)", text: $b.text("desc", keep: true))
            TextField("Note (consigne de progression…)", text: $b.text("sub", keep: true), axis: .vertical)
            if kind == "doigts" { fingerFields }
            if b["timer"] != nil { BlockTimerFields(b: $b) }
            if kind == "test" {
                NavigationLink { TestsPickerView(sel: $b.at("tests")) } label: {
                    LabeledContent("Tests à saisir", value: testsSummary())
                }
            }
            if kind != "rest" {
                ForEach(items.indices, id: \.self) { j in itemRow(j) }
                    .onDelete { idx in removeItems(idx) }
                    .onMove { from, to in moveItems(from, to) }
                Button { addItem() } label: { Label("Ajouter un exercice", systemImage: "plus") }
            }
        } header: {
            header
        }
    }

    private var header: some View {
        HStack(spacing: 8) {
            Circle().fill(Palette.kind(kind)).frame(width: 9, height: 9)
            Text(b["title"]?.string.flatMap { $0.isEmpty ? nil : $0 } ?? KIND[kind] ?? "Bloc").font(Typo.sans(13.5, .semibold)).foregroundStyle(Palette.ink).lineLimit(1)
            Spacer()
            Menu {
                Button { onMove(-1) } label: { Label("Monter", systemImage: "arrow.up") }.disabled(i == 0)
                Button { onMove(1) } label: { Label("Descendre", systemImage: "arrow.down") }.disabled(i == n - 1)
                Button(role: .destructive) { onDelete() } label: { Label("Supprimer le bloc", systemImage: "trash") }
            } label: {
                Image(systemName: "ellipsis.circle").font(.system(size: 18)).foregroundStyle(Palette.accent)
            }
        }
        .textCase(nil)
    }

    @ViewBuilder private var fingerFields: some View {
        let f = b["finger"]
        FormNum(label: "Charge finger lift", value: f?["load"]?.double, integer: false) { v in
            if let v { var x = b["finger"] ?? ["unit": "kg"]; x["load"] = .num(v); b["finger"] = x } else { b["finger"] = nil }
        }
        Picker("En", selection: Binding(get: { f?["unit"]?.string ?? "kg" }, set: { v in var x = b["finger"] ?? ["load": 0]; x["unit"] = .str(v); b["finger"] = x })) {
            Text("kg").tag("kg"); Text("% du test").tag("%")
        }
    }

    private func itemRow(_ j: Int) -> some View {
        let it = items[j]
        let prev: Binding<JSON>? = j > 0 ? $b.at("items").at(j - 1) : nil
        return NavigationLink {
            ItemEditorView(it: $b.at("items").at(j), prev: prev, kind: kind) { removeItems(IndexSet(integer: j)) }
        } label: {
            ItemEditLine(it: it, prev: j > 0 ? items[j - 1] : nil)
        }
        .contextMenu {
            Button { moveItems(IndexSet(integer: j), j - 1) } label: { Label("Monter", systemImage: "arrow.up") }.disabled(j == 0)
            Button { moveItems(IndexSet(integer: j), j + 2) } label: { Label("Descendre", systemImage: "arrow.down") }.disabled(j == items.count - 1)
            Button { duplicate(j) } label: { Label("Dupliquer", systemImage: "plus.square.on.square") }
            Button(role: .destructive) { removeItems(IndexSet(integer: j)) } label: { Label("Supprimer", systemImage: "trash") }
        }
    }

    private func testsSummary() -> String {
        let ids = b["tests"]?.array.compactMap { $0.string } ?? []
        if ids.isEmpty { return "aucun" }
        return "\(ids.count)"
    }
    private func addItem() {
        var a = items
        a.append(["id": .str(uid("i")), "label": "Nouvel exercice", "n": 3, "unit": .str(kind == "grimpe" ? "Bloc" : "Série")])
        withAnimation { b["items"] = .arr(a) }
    }
    private func duplicate(_ j: Int) {
        var a = items
        var c = a[j]; c["id"] = .str(uid("i")); c["superset"] = nil
        a.insert(c, at: j + 1)
        withAnimation { b["items"] = .arr(a) }
    }
    private func removeItems(_ idx: IndexSet) {
        var a = items
        a.remove(atOffsets: idx)
        withAnimation { b["items"] = .arr(a) }
    }
    private func moveItems(_ from: IndexSet, _ to: Int) {
        var a = items
        a.move(fromOffsets: from, toOffset: max(0, min(a.count, to)))
        withAnimation { b["items"] = .arr(a) }
    }
}

private struct ItemEditLine: View {
    let it: JSON
    let prev: JSON?
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(it["label"]?.string.flatMap { $0.isEmpty ? nil : $0 } ?? "Sans nom").font(Typo.sans(15, .medium)).foregroundStyle(Palette.ink)
            Text(summary()).font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
        }
    }
    private func summary() -> String {
        var p: [String] = []
        let n = it["n"]?.int ?? 1
        p.append("\(n) × " + (it["unit"]?.string ?? "Série").lowercased())
        if let l = it["load"]?.double { p.append((it["unit_load"]?.string == "+kg" ? "+" : "") + Fmt.num(l) + " kg") }
        if let r = it["rest"]?.int, r > 0 { p.append("\(r) s de repos") }
        if let tk = it["timer"]?["kind"]?.string, let t = TIMERS.first(where: { $0.0 == tk }) { p.append(t.1.lowercased()) }
        if let s = it["superset"]?.string, let pid = prev?["id"]?.string, s == pid { p.append("en alternance") }
        return p.joined(separator: " · ")
    }
}

/// Minuteur d'un bloc entier (séries de suspensions…)
private struct BlockTimerFields: View {
    @Binding var b: JSON
    var body: some View {
        let t = b["timer"] ?? .emptyObject
        timerNum("Effort (s)", "work", t, min: 1)
        timerNum("Pause (s)", "rest", t, min: 0)
        timerNum("Répétitions", "reps", t, min: 1)
        timerNum("Séries", "sets", t, min: 1)
        timerNum("Entre séries (s)", "setRest", t, min: 0)
        Button("Retirer le minuteur", role: .destructive) { b["timer"] = nil }
    }
    private func timerNum(_ l: String, _ key: String, _ t: JSON, min: Double) -> some View {
        FormNum(label: l, value: t[key]?.double) { v in
            var x = b["timer"] ?? .emptyObject
            x[key] = .num(v ?? min)
            b["timer"] = x
        }
    }
}

/// Tests à saisir un jour de test
private struct TestsPickerView: View {
    @Binding var sel: JSON
    var body: some View {
        let C = Core.shared
        let tests = C.call("tests.allTests")?.array ?? []
        let cats = C.constant("tests.CATS").array.map { ($0[0]?.string ?? "", $0[1]?.string ?? "") }
        let on = Set(sel.array.compactMap { $0.string })
        Form {
            ForEach(cats.indices, id: \.self) { ci in
                let list = tests.filter { $0["cat"]?.string == cats[ci].0 }
                if !list.isEmpty {
                    Section(cats[ci].1) {
                        ForEach(list.indices, id: \.self) { i in
                            let id = list[i]["id"]?.string ?? ""
                            Button { toggle(id, on) } label: {
                                HStack {
                                    Text(list[i]["name"]?.string ?? id).foregroundStyle(Palette.ink)
                                    Spacer()
                                    if on.contains(id) { Image(systemName: "checkmark").foregroundStyle(Palette.accent).fontWeight(.semibold) }
                                }
                            }
                        }
                    }
                }
            }
        }
        .scrollContentBackground(.hidden).background(Palette.bg)
        .navigationTitle("Tests du jour").navigationBarTitleDisplayMode(.inline)
    }
    private func toggle(_ id: String, _ on: Set<String>) {
        Haptics.select()
        var a = sel.array.compactMap { $0.string }
        if on.contains(id) { a.removeAll { $0 == id } } else { a.append(id) }
        sel = a.isEmpty ? .null : .arr(a.map { .str($0) })
    }
}

/// Objectif de la séance : ressenti, type, spécificité / intensité / volume visés
private struct TargetSection: View {
    @Binding var d: JSON
    var body: some View {
        let has = d["target"] != nil
        Section {
            Toggle("Objectif de la séance", isOn: Binding(get: { has }, set: { on in
                let t: JSON = ["rpe": [5, 6], "s": 5, "i": 5, "v": 5, "fam": "vol", "why": ""]
                withAnimation { d["target"] = on ? t : nil }
            }))
            .tint(Palette.accent)
            if has { fields }
        } footer: {
            if !has { Text("Sans objectif, pas de zone visée ni de comparaison du ressenti.") }
        }
    }
    @ViewBuilder private var fields: some View {
        let tg = $d.at("target")
        Picker("Ressenti min", selection: rpe(0)) { rpeOptions }
        Picker("Ressenti max", selection: rpe(1)) { rpeOptions }
        Picker("Type", selection: tg.text("fam", keep: true, def: "vol")) {
            ForEach(FAMS.indices, id: \.self) { i in Text(FAMS[i].1).tag(FAMS[i].0) }
        }
        ForEach(SIV.indices, id: \.self) { i in
            let key = SIV[i].0
            Stepper(value: Binding(get: { d["target"]?[key]?.int ?? 0 }, set: { v in d["target"]?[key] = .num(Double(v)) }), in: 0...10) {
                HStack {
                    Text(SIV[i].1 + " visée")
                    Spacer()
                    Text("\(d["target"]?[key]?.int ?? 0)/10").font(Typo.mono(15)).foregroundStyle(Palette.muted)
                }
            }
        }
        TextField("Pourquoi", text: tg.text("why", keep: true), axis: .vertical)
    }
    @ViewBuilder private var rpeOptions: some View {
        Text("—").tag(-1)
        ForEach(0...10, id: \.self) { v in Text("\(v)").tag(v) }
    }
    private func rpe(_ side: Int) -> Binding<Int> {
        Binding<Int>(get: { d["target"]?["rpe"]?[side]?.int ?? -1 }, set: { v in
            if v < 0 { d["target"]?["rpe"] = nil; return }
            let lo = d["target"]?["rpe"]?[0]?.int ?? v, hi = d["target"]?["rpe"]?[1]?.int ?? v
            let pair = side == 0 ? [v, max(v, hi)] : [min(v, lo), v]
            d["target"]?["rpe"] = .arr(pair.map { .num(Double($0)) })
        })
    }
}

// MARK: exercice

struct ItemEditorView: View {
    @Binding var it: JSON
    let prev: Binding<JSON>?
    let kind: String
    let onDelete: () -> Void
    @Environment(\.dismiss) private var dismiss

    private var tk: String { it["timer"]?["kind"]?.string ?? "" }
    private var paired: Bool { if let p = prev?.wrappedValue["id"]?.string { return it["superset"]?.string == p }; return false }

    var body: some View {
        Form {
            Section {
                TextField("Exercice", text: $it.text("label", keep: true))
                TextField("Détail : répétitions, cotation, consigne…", text: $it.text("det"), axis: .vertical)
            }
            Section {
                Stepper(value: Binding(get: { max(1, it["n"]?.int ?? 1) }, set: { it["n"] = .num(Double($0)) }), in: 1...99) {
                    HStack { Text("Nombre"); Spacer(); Text("\(max(1, it["n"]?.int ?? 1))").font(Typo.mono(16)).foregroundStyle(Palette.muted) }
                }
                Picker("Unité", selection: $it.text("unit", keep: true, def: "Série")) {
                    ForEach(UNITS, id: \.self) { u in Text(u).tag(u) }
                }
                FormNum(label: "Repos (s)", value: it["rest"]?.double) { v in it["rest"] = (v ?? 0) > 0 ? .num(v ?? 0) : nil }
            }
            Section("Charge") {
                FormNum(label: "Charge (kg)", value: it["load"]?.double, integer: false) { v in
                    if let v { it["load"] = .num(v); if it["unit_load"] == nil { it["unit_load"] = "kg" } } else { it["load"] = nil; it["unit_load"] = nil }
                }
                Picker("Type de charge", selection: $it.text("unit_load", keep: true, def: "kg")) {
                    Text("kg").tag("kg"); Text("lest +kg").tag("+kg")
                }
            }
            Section("Minuteur") {
                Picker("Minuteur", selection: Binding(get: { tk }, set: setKind)) {
                    ForEach(TIMERS.indices, id: \.self) { i in Text(TIMERS[i].1).tag(TIMERS[i].0) }
                }
                timerFields
            }
            if let prev { pairSection(prev) }
            Section {
                Button("Supprimer l’exercice", role: .destructive) {
                    dismiss()
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { onDelete() }
                }
            }
        }
        .scrollContentBackground(.hidden).background(Palette.bg)
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle(it["label"]?.string ?? "Exercice").navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder private var timerFields: some View {
        let t = it["timer"] ?? .emptyObject
        switch tk {
        case "cluster":
            tNum("Rép. par série", "reps", t, 1); tNum("Entre rép. (s)", "intra", t, 0); tNum("Entre séries (s)", "setRest", t, 0)
        case "contrast":
            tNum("Après la lourde (s)", "heavyRest", t, 0); tNum("Après l’explosive (s)", "lightRest", t, 0)
        case "interval":
            tNum("Effort (s)", "work", t, 1); tNum("Pause (s)", "rest", t, 0); tNum("Répétitions", "reps", t, 1); tNum("Séries", "sets", t, 1)
        case "tempo":
            tNum("Mise en place (s)", "prep", t, 0); tNum("Excentrique (s)", "ecc", t, 1); tNum("Retour (s)", "ret", t, 0)
            tNum(t["sides"] != nil ? "Rép. par bras" : "Rép. par série", "reps", t, 1)
            Picker("Bras", selection: Binding(get: { t["sides"] != nil ? "uni" : "bi" }, set: { v in setT("sides", v == "uni" ? ["Bras droit", "Bras gauche"] : nil) })) {
                Text("Ensemble").tag("bi"); Text("Un à un").tag("uni")
            }
            if t["sides"] != nil { tNum("Changement de bras (s)", "sideRest", t, 0) }
            tNum("Entre séries (s)", "setRest", t, 0)
        default:
            EmptyView()
        }
    }
    private func tNum(_ l: String, _ key: String, _ t: JSON, _ min: Double) -> some View {
        FormNum(label: l, value: t[key]?.double) { v in setT(key, .num(v ?? min)) }
    }
    private func setT(_ key: String, _ v: JSON?) {
        var x = it["timer"] ?? .emptyObject
        x[key] = v
        it["timer"] = x
    }
    private func setKind(_ kd: String) {
        let reps = it["reps"]?.double ?? 8, rest = it["rest"]?.double ?? 60, n = Double(it["n"]?.int ?? 4)
        switch kd {
        case "cluster": it["timer"] = ["kind": "cluster", "reps": 3, "intra": 25, "setRest": 180]
        case "contrast": it["timer"] = ["kind": "contrast", "heavyRest": 300, "lightRest": 180]
        case "tempo": it["timer"] = ["kind": "tempo", "prep": 5, "ecc": 6, "ret": 4, "reps": .num(reps), "sideRest": 10, "setRest": .num(rest)]
        case "interval": it["timer"] = ["kind": "interval", "name": it["label"] ?? "", "work": 60, "rest": 60, "reps": .num(n), "sets": 1, "setRest": 0, "prep": 10, "workLabel": "Effort", "restLabel": "Repos"]
        default: it["timer"] = nil
        }
    }

    private func pairSection(_ prev: Binding<JSON>) -> some View {
        let pl = prev.wrappedValue["label"]?.string ?? "l’exercice précédent"
        return Section {
            Toggle("En alternance avec « " + pl + " »", isOn: Binding(get: { paired }, set: { on in
                if on { it["superset"] = prev.wrappedValue["id"]; if it["rest"] == nil { it["rest"] = 90 } } else { it["superset"] = nil }
            }))
            .tint(Palette.accent)
            if paired {
                FormNum(label: "Repos avant (s)", value: prev.wrappedValue["pairRest"]?.double, placeholder: "60") { v in prev.wrappedValue["pairRest"] = (v ?? 0) > 0 ? .num(v ?? 0) : nil }
                FormNum(label: "Tenue (s)", value: it["hold"]?.double) { v in it["hold"] = (v ?? 0) > 0 ? .num(v ?? 0) : nil }
            }
        } footer: {
            if paired {
                Text("« Repos avant » : entre une série de « " + pl + " » et cet exercice. « Tenue » : durée chronométrée, si c’est un maintien. Le « Repos » plus haut : avant la série suivante de « " + pl + " ».")
            } else {
                Text("Les deux exercices s’enchaînent série après série.")
            }
        }
    }
}

// MARK: semaine

struct WeekSheet: View {
    let id: String
    @State private var store = Store.shared
    @Environment(\.dismiss) private var dismiss
    @State private var bloc = ""
    @State private var to = ""
    @State private var askCopy = false
    @FocusState private var focus: Bool

    var body: some View {
        let ws = PlanReader(store).weeks()
        let w = ws.first { $0.raw["id"]?.string == id }
        NavigationStack {
            Form {
                if let w { content(w, ws) }
            }
            .scrollContentBackground(.hidden).background(Palette.bg)
            .navigationTitle(title(w)).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Fermer") { commitBloc(); dismiss() }.fontWeight(.semibold) } }
            .onAppear { bloc = w?.bloc ?? "" }
        }
    }

    @ViewBuilder private func content(_ w: Week, _ ws: [Week]) -> some View {
        Section {
            Picker("Phase", selection: Binding(get: { w.phase.isEmpty ? "autre" : w.phase }, set: { v in setWeek(["phase": .str(v)]) })) {
                ForEach(PHASES, id: \.self) { p in Text(PHASE_LABEL[p] ?? p).tag(p) }
            }
            HStack {
                Text("Nom du bloc")
                Spacer()
                TextField("Cycle 1", text: $bloc).multilineTextAlignment(.trailing).focused($focus).onSubmit(commitBloc)
            }
        }
        .onChange(of: focus) { _, f in if !f { commitBloc() } }
        Section("Jours") {
            ForEach(D.range(w.start, w.end), id: \.self) { k in
                NavigationLink { DayEditorView(k: k, pushed: true) } label: { DayEditLine(k: k) }
            }
        }
        Section {
            Picker("Vers", selection: $to) {
                Text("Choisir une semaine").tag("")
                ForEach(ws.filter { $0.raw["id"]?.string != id }, id: \.start) { x in
                    Text(x.label + " · " + D.rangeTxt(x.start, x.end)).tag(x.raw["id"]?.string ?? "")
                }
            }
            Button("Copier la semaine") { askCopy = true }.disabled(to.isEmpty)
        } header: { Text("Copier toute la semaine") } footer: {
            Text("Chaque jour va sur le même jour de la semaine choisie. Le journal n’est pas touché.")
        }
        .confirmationDialog(copyTitle(w, ws), isPresented: $askCopy, titleVisibility: .visible) {
            Button("Remplacer", role: .destructive) { copy(w, ws) }
        }
    }

    private func title(_ w: Week?) -> String {
        guard let w else { return "Semaine" }
        return w.label + " · " + D.rangeTxt(w.start, w.end)
    }
    private func copyTitle(_ w: Week, _ ws: [Week]) -> String {
        let tw = ws.first { $0.raw["id"]?.string == to }
        let tl: String = tw?.label ?? ""
        return "Remplacer toutes les séances de " + tl + " par celles de " + w.label + " ?"
    }
    private func copy(_ w: Week, _ ws: [Week]) {
        guard let tw = ws.first(where: { $0.raw["id"]?.string == to }) else { return }
        Core.shared.call("plan.copyWeek", w.raw, tw.raw)
        Haptics.success(); toast(w.label + " copiée vers " + tw.label)
    }
    private func setWeek(_ patch: JSON) { Core.shared.call("plan.setWeek", .str(id), patch) }
    private func commitBloc() {
        let w = PlanReader(store).weeks().first { $0.raw["id"]?.string == id }
        if let w, (w.bloc ?? "") != bloc { setWeek(["bloc": .str(bloc)]) }
    }
}

struct DayEditLine: View {
    let k: String
    @State private var store = Store.shared
    var body: some View {
        let pr = PlanReader(store), kinds = pr.kinds(k)
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(D.short(k)).font(Typo.sans(15, .medium)).foregroundStyle(k == D.today ? Palette.accent : Palette.ink)
                rich(pr.sessionName(k)).font(Typo.sans(12.5)).foregroundStyle(Palette.muted).lineLimit(1)
            }
            Spacer()
            HStack(spacing: 3) {
                ForEach(kinds.prefix(4), id: \.self) { kd in RoundedRectangle(cornerRadius: 2).fill(Palette.kind(kd)).frame(width: 8, height: 8) }
            }
        }
    }
}

// MARK: réglages du plan

struct PlanSettingsSheet: View {
    @State private var store = Store.shared
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var goal = ""
    @State private var newTest = Date()
    @State private var n = 4
    @State private var ph = "autre"
    @State private var bn = "Nouveau cycle"
    @State private var askRemove = false
    @State private var loaded = false

    private var m: JSON { store.get("plan") ?? .emptyObject }

    var body: some View {
        let ws = PlanReader(store).weeks(), last = ws.last
        NavigationStack {
            Form {
                Section {
                    TextField("Nom du plan", text: $title).onSubmit(commitText)
                    TextField("Objectif (compétition, voyage…)", text: $goal).onSubmit(commitText)
                    Toggle("Date de l’objectif", isOn: Binding(get: { m["goal"]?["date"] != nil }, set: setHasDate)).tint(Palette.accent)
                    if m["goal"]?["date"] != nil {
                        DatePicker("Date", selection: dateBinding({ m["goal"]?["date"]?.string ?? "" }, { v in setGoalDate(v) }), displayedComponents: .date)
                    }
                } header: { Text("Plan") } footer: { Text("Le compte à rebours de l’écran Aujourd’hui vise cette date.") }
                testsSection
                Section {
                    Picker("Semaines", selection: $n) { ForEach([1, 2, 3, 4, 5, 6, 8, 10, 12], id: \.self) { x in Text("\(x)").tag(x) } }
                    Picker("Phase", selection: $ph) { ForEach(PHASES, id: \.self) { p in Text(PHASE_LABEL[p] ?? p).tag(p) } }
                    HStack { Text("Bloc"); Spacer(); TextField("Nouveau cycle", text: $bn).multilineTextAlignment(.trailing) }
                    Button("Ajouter après " + (last?.label ?? "le début")) {
                        Core.shared.call("plan.addWeeks", .num(Double(n)), .str(ph), .str(bn))
                        Haptics.success(); toast(Fmt.plural(n, "semaine") + (n > 1 ? " ajoutées" : " ajoutée"))
                    }
                } header: { Text("Prolonger le plan") } footer: {
                    Text("Les nouvelles semaines sont vides : remplis-les jour par jour, ou copie une semaine existante.")
                }
                if let last {
                    Section {
                        Button("Retirer la dernière semaine (" + last.label + ")", role: .destructive) { askRemove = true }
                    }
                    .confirmationDialog("Retirer " + last.label + " et ses séances ? Le journal est conservé.", isPresented: $askRemove, titleVisibility: .visible) {
                        Button("Retirer", role: .destructive) { Core.shared.call("plan.removeLastWeek"); Haptics.success() }
                    }
                }
            }
            .scrollContentBackground(.hidden).background(Palette.bg)
            .navigationTitle("Réglages du plan").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("OK") { commitText(); dismiss() }.fontWeight(.semibold) } }
            .onAppear {
                guard !loaded else { return }
                loaded = true
                title = m["title"]?.string ?? ""; goal = m["goal"]?["label"]?.string ?? ""
            }
            .onDisappear(perform: commitText)
        }
    }

    private var testsSection: some View {
        let tests = m["tests"]?.array.compactMap { $0.string } ?? []
        return Section {
            ForEach(tests, id: \.self) { t in Text(D.short(t)) }
                .onDelete { idx in
                    var a = tests; a.remove(atOffsets: idx)
                    save(["tests": .arr(a.map { .str($0) })])
                }
            DatePicker("Ajouter", selection: $newTest, displayedComponents: .date)
            Button("Ajouter ce jour de test") {
                let k = D.key(newTest)
                let a = Array(Set(tests + [k])).sorted()
                save(["tests": .arr(a.map { .str($0) })]); Haptics.success()
            }
        } header: { Text("Jours de test doigts") } footer: {
            Text("Ces jours affichent la saisie du test, et les charges en % s’appuient sur le dernier test. Glisse une date vers la gauche pour la retirer.")
        }
    }

    private func save(_ patch: [String: JSON?]) {
        var x = m
        for (k, v) in patch { x[k] = v ?? .null }
        Core.shared.call("plan.savePlan", x)
    }
    private func commitText() {
        guard loaded else { return }
        var patch: [String: JSON?] = [:]
        if title != (m["title"]?.string ?? "") && !title.isEmpty { patch["title"] = .str(title) }
        if goal != (m["goal"]?["label"]?.string ?? "") {
            var g = m["goal"]?.object ?? [:]
            g["label"] = .str(goal)
            patch["goal"] = .obj(g)
        }
        if !patch.isEmpty { save(patch) }
    }
    private func setHasDate(_ on: Bool) {
        if on {
            var g = m["goal"]?.object ?? [:]
            if g["label"] == nil { g["label"] = .str(goal.isEmpty ? "Objectif" : goal) }
            g["date"] = .str(D.add(D.today, 28))
            save(["goal": .obj(g)])
        } else {
            save(["goal": nil])
        }
    }
    private func setGoalDate(_ k: String) {
        var g = m["goal"]?.object ?? [:]
        if g["label"] == nil { g["label"] = .str(goal.isEmpty ? "Objectif" : goal) }
        g["date"] = .str(k)
        save(["goal": .obj(g)])
    }
}

// MARK: bloc de texte

struct BlocTextSheet: View {
    let idx: Int
    @State private var store = Store.shared
    @Environment(\.dismiss) private var dismiss
    @State private var b: JSON = .emptyObject
    @State private var loaded = false
    @State private var askDelete = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Nom", text: $b.text("name", keep: true))
                    DatePicker("Du", selection: dateBinding({ b["from"]?.string ?? "" }, { b["from"] = .str($0) }), displayedComponents: .date)
                    DatePicker("Au", selection: dateBinding({ b["to"]?.string ?? "" }, { b["to"] = .str($0) }), displayedComponents: .date)
                }
                Section("Objectif") { TextField("Objectif du bloc", text: $b.text("obj", keep: true), axis: .vertical).lineLimit(2...6) }
                Section {
                    TextEditor(text: $b.text("notes", keep: true)).frame(minHeight: 200)
                } header: { Text("Notes") } footer: { Text("Mise en forme : **gras**, lignes qui commencent par « - » pour une liste.") }
                if idx >= 0 {
                    Section { Button("Supprimer ce bloc", role: .destructive) { askDelete = true } }
                }
            }
            .scrollContentBackground(.hidden).background(Palette.bg)
            .navigationTitle(idx < 0 ? "Nouveau bloc" : (b["name"]?.string ?? "Bloc")).navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Annuler") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) { Button("OK", action: save).fontWeight(.semibold) }
            }
            .confirmationDialog("Supprimer ce bloc de texte ? Les séances ne sont pas touchées.", isPresented: $askDelete, titleVisibility: .visible) {
                Button("Supprimer", role: .destructive) { remove() }
            }
            .onAppear(perform: load)
        }
    }
    private func load() {
        guard !loaded else { return }
        loaded = true
        let m = store.get("plan") ?? .emptyObject
        if idx >= 0, let x = m["blocs"]?.array.at(idx) { b = x }
        else { b = ["name": "Nouveau bloc", "from": m["start"] ?? .str(D.today), "to": m["end"] ?? .str(D.today), "obj": "", "notes": ""] }
    }
    private func save() {
        var m = store.get("plan") ?? .emptyObject
        var bl = m["blocs"]?.array ?? []
        if idx >= 0 && idx < bl.count { bl[idx] = b } else { bl.append(b) }
        bl.sort { ($0["from"]?.string ?? "") < ($1["from"]?.string ?? "") }
        m["blocs"] = .arr(bl)
        Core.shared.call("plan.savePlan", m)
        Haptics.success(); dismiss()
    }
    private func remove() {
        var m = store.get("plan") ?? .emptyObject
        var bl = m["blocs"]?.array ?? []
        if idx >= 0 && idx < bl.count { bl.remove(at: idx) }
        m["blocs"] = .arr(bl)
        Core.shared.call("plan.savePlan", m)
        dismiss()
    }
}

// MARK: section de repères

struct SectionSheet: View {
    let idx: Int
    @State private var store = Store.shared
    @Environment(\.dismiss) private var dismiss
    @State private var s: JSON = .emptyObject
    @State private var loaded = false
    @State private var askDelete = false

    var body: some View {
        let count = store.get("plan")?["sections"]?.array.count ?? 0
        NavigationStack {
            Form {
                Section { TextField("Titre", text: $s.text("title", keep: true)) }
                Section {
                    TextEditor(text: $s.text("body", keep: true)).font(Typo.mono(14)).frame(minHeight: 320)
                } header: { Text("Texte") } footer: {
                    Text("**gras**, « - » pour une liste, « ### » pour un sous-titre, et les tableaux en | colonnes | séparées |.")
                }
                if idx >= 0 {
                    Section {
                        Button("Monter") { move(-1) }.disabled(idx == 0)
                        Button("Descendre") { move(1) }.disabled(idx >= count - 1)
                        Button("Supprimer", role: .destructive) { askDelete = true }
                    }
                }
            }
            .scrollContentBackground(.hidden).background(Palette.bg)
            .navigationTitle(idx < 0 ? "Nouvelle section" : (s["title"]?.string ?? "Section")).navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Annuler") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) { Button("OK", action: save).fontWeight(.semibold) }
            }
            .confirmationDialog(deleteTitle, isPresented: $askDelete, titleVisibility: .visible) {
                Button("Supprimer", role: .destructive) { remove() }
            }
            .onAppear(perform: load)
        }
    }
    private var deleteTitle: String {
        let t: String = s["title"]?.string ?? ""
        return "Supprimer la section « " + t + " » ?"
    }
    private func load() {
        guard !loaded else { return }
        loaded = true
        if idx >= 0, let x = store.get("plan")?["sections"]?.array.at(idx) { s = x }
        else { s = ["id": .str(uid("s")), "title": "Nouvelle section", "body": ""] }
    }
    private func write(_ f: (inout [JSON]) -> Void) {
        var m = store.get("plan") ?? .emptyObject
        var ss = m["sections"]?.array ?? []
        f(&ss)
        m["sections"] = .arr(ss)
        Core.shared.call("plan.savePlan", m)
    }
    private func save() {
        write { ss in if idx >= 0 && idx < ss.count { ss[idx] = s } else { ss.append(s) } }
        Haptics.success(); dismiss()
    }
    private func move(_ dir: Int) {
        write { ss in let j = idx + dir; if idx < ss.count && j >= 0 && j < ss.count { ss[idx] = s; ss.swapAt(idx, j) } }
        dismiss()
    }
    private func remove() {
        write { ss in if idx >= 0 && idx < ss.count { ss.remove(at: idx) } }
        dismiss()
    }
}

// MARK: exercice du plan (renommer partout, vidéo de démo)

func okUrl(_ u: String) -> Bool { u.trimmingCharacters(in: .whitespaces).range(of: #"^https://[^\s]+\.[^\s]+$"#, options: [.regularExpression, .caseInsensitive]) != nil }

struct ExerciseSheet: View {
    let ex: JSON
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var future = true
    @State private var vid = ""
    @State private var d0 = ""
    @State private var loaded = false

    private var label: String { ex["label"]?.string ?? "" }
    private var nameCh: Bool { let v = name.trimmingCharacters(in: .whitespaces); return !v.isEmpty && v != label }
    private var vidCh: Bool { vid.trimmingCharacters(in: .whitespaces) != d0 }
    private var badVid: Bool { let v = vid.trimmingCharacters(in: .whitespaces); return !v.isEmpty && !okUrl(v) }

    var body: some View {
        NavigationStack {
            Form {
                Section("Nom") { TextField("Nom", text: $name) }
                if nameCh {
                    Section {
                        Toggle("À partir d’aujourd’hui seulement", isOn: $future).tint(Palette.accent)
                    } footer: { Text("Les séances passées gardent l’ancien nom.") }
                }
                Section {
                    TextField("https://", text: $vid).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                    if badVid { Text("Colle un lien complet, qui commence par https://").font(Typo.sans(13)).foregroundStyle(Palette.crit) }
                } header: { Text("Vidéo de démo (Instagram, TikTok, YouTube…)") } footer: {
                    Text("Renommer sert à changer d’exercice sur tout le plan d’un coup, par exemple presse épaule → dips. La vidéo s’ouvre d’un appui sur la fiche du jour et en séance.")
                }
            }
            .scrollContentBackground(.hidden).background(Palette.bg)
            .navigationTitle("Exercice").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Annuler") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) { Button("OK", action: save).fontWeight(.semibold).disabled(!(nameCh || vidCh) || badVid) }
            }
            .onAppear {
                guard !loaded else { return }
                loaded = true
                name = label
                d0 = Core.shared.call("plan.demoOf", ["label": .str(label)])?.string ?? ""
                vid = d0
            }
        }
    }
    private func save() {
        let to = nameCh ? name.trimmingCharacters(in: .whitespaces) : label
        let v = vid.trimmingCharacters(in: .whitespaces)
        if nameCh {
            let n = Core.shared.call("plan.renameExercise", .str(label), .str(to), .bool(future))?.int ?? 0
            toast(Fmt.plural(n, "séance") + (n > 1 ? " modifiées" : " modifiée"))
        }
        if vidCh || (nameCh && !v.isEmpty) {
            if nameCh { Core.shared.call("plan.setDemo", .str(label), .str("")) }
            Core.shared.call("plan.setDemo", .str(to), .str(v))
            if !nameCh { toast(v.isEmpty ? "Vidéo retirée" : "Vidéo de démo ajoutée") }
        }
        Haptics.success(); dismiss()
    }
}
