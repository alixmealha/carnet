import SwiftUI

// Alimentation : repas du jour (fiche du jour), bilan de la semaine (Suivi), compléments et réglages (Profil).
// Base Ciqual de l'ANSES et calculs de la version web (logique partagée).

@Observable
final class Foods {
    static let shared = Foods()
    var ready = false
    var error: String?
    private var loading = false
    func load() {
        guard !ready, !loading else { return }
        loading = true
        Task { @MainActor in
            do { _ = try await Core.shared.callAsync("nutrition.loadFoods"); ready = true } catch { self.error = error.localizedDescription }
            loading = false
        }
    }
}

private func R(_ x: Double) -> String {
    let f = NumberFormatter(); f.locale = Locale(identifier: "fr_FR"); f.numberStyle = .decimal; f.maximumFractionDigits = 0
    return f.string(from: NSNumber(value: x.rounded())) ?? "\(Int(x))"
}
private func f1(_ x: Double) -> String { Fmt.num((x * 10).rounded() / 10) }

enum Nutri {
    static var C: Core { Core.shared }
    static var numbers: Bool { C.call("nutrition.nutriPrefs")?["numbers"]?.truthy ?? true }
    static var meals: [(String, String)] { C.constant("nutrition.MEALS").array.map { ($0[0]?.string ?? "", $0[1]?.string ?? "") } }
    static func short(_ n: String) -> String { String(n.split(separator: ",").first ?? Substring(n)) }
}

/// Barre vers un repère (fourchette)
struct NutriBar: View {
    let label: String
    let v: Double
    let lo: Double?
    var hi: Double? = nil
    let unit: String
    let nb: Bool
    var body: some View {
        let mx = max(hi ?? lo ?? 1, v) * 1.15, pct = min(1, v / mx)
        let st: String = lo == nil ? "" : v < lo! * 0.9 ? "low" : (hi != nil && v > hi! * 1.1) ? "high" : v >= lo! ? "ok" : "near"
        let word = ["low": "en dessous", "near": "presque", "ok": "dans le repère", "high": "au-dessus"][st] ?? ""
        let c = st == "ok" ? Palette.good : st == "near" ? Palette.accent : st == "" ? Palette.accent : Palette.warn
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .firstTextBaseline) {
                Text(label).font(Typo.sans(14, .medium)).foregroundStyle(Palette.ink)
                Spacer()
                Text(nb ? R(v) + (unit.isEmpty ? "" : " " + unit) : word).font(Typo.sans(13.5, .semibold)).foregroundStyle(c)
                if nb, let lo { Text(hi.map { R(lo) + "–" + R($0) } ?? "≥ " + R(lo)).font(Typo.mono(11.5)).foregroundStyle(Palette.muted) }
            }
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(Palette.sunk)
                    if let lo { Rectangle().fill(Palette.good.opacity(0.18)).frame(width: max(3, g.size.width * ((hi ?? lo) - lo) / mx)).offset(x: g.size.width * lo / mx) }
                    Capsule().fill(c).frame(width: g.size.width * pct)
                }
            }
            .frame(height: 8)
            .animation(.spring(response: 0.6, dampingFraction: 0.8), value: pct)
        }
    }
}

// MARK: carte du jour

struct NutriDayCard: View {
    let k: String
    @State private var store = Store.shared
    @State private var foods = Foods.shared
    @State private var sheet: TermRef?
    var body: some View {
        let C = Nutri.C
        if C.call("nutrition.nutriVisible")?.truthy == true {
            let nb = Nutri.numbers, m = C.call("nutrition.mealsOf", .str(k)) ?? .emptyObject
            let tg = C.call("nutrition.dayTargets", .str(k)), t = C.call("nutrition.dayTotals", .str(k)) ?? .emptyObject
            let any = C.call("nutrition.loggedDay", .str(k))?.truthy == true
            let ym = C.call("nutrition.mealsOf", .str(D.add(k, -1))) ?? .emptyObject
            let meals = Nutri.meals
            let summary = any ? (nb ? R(t["kcal"]?.double ?? 0) + " kcal · protéines " + R(t["p"]?.double ?? 0) + " g" : "\(meals.filter { !(m[$0.0]?.array ?? []).isEmpty }.count) repas notés") : (tg?["ld"]?["lbl"]?.string ?? "Rien de noté")
            let adv = C.call("nutrition.dayAdvice", .str(k))?.array ?? []
            FoldCard(id: "nutri-day", title: "Alimentation", summary: summary) {
                if tg == nil { Text("Renseigne ton poids et ta taille dans Plus → Profil pour avoir les repères du jour.").font(Typo.sans(13.5)).foregroundStyle(Palette.muted) }
                if let tg {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(tg["ld"]?["lbl"]?.string ?? "").font(Typo.sans(15, .semibold)).foregroundStyle(Palette.ink)
                        if nb, let d = expText(tg) { Text(d).font(Typo.sans(13)).foregroundStyle(Palette.muted) }
                        if nb {
                            Flow(spacing: 8) {
                                rangeChip("Protéines", tg["p"])
                                rangeChip("Glucides", tg["g"])
                                if tg["l"] != nil && tg["l"] != .null { rangeChip("Lipides", tg["l"]) }
                            }
                        }
                        SourcesLine(ids: ["thomas2016", "morton2018", "frankenfield2005", "herrmann2024"])
                    }
                }
                ForEach(meals.map { $0.0 }, id: \.self) { id in
                    let items = m[id]?.array ?? [], mt = C.call("nutrition.totals", .arr(items)) ?? .emptyObject
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(meals.first { $0.0 == id }?.1 ?? id).font(Typo.sans(15, .semibold)).foregroundStyle(Palette.ink)
                            if !items.isEmpty && nb { Text(R(mt["kcal"]?.double ?? 0) + " kcal").font(Typo.mono(12)).foregroundStyle(Palette.muted) }
                            Spacer()
                            if store.isSelf { Button { sheet = TermRef(id: id) } label: { Label("Ajouter", systemImage: "plus") }.buttonStyle(SmallButton()) }
                        }
                        ForEach(items.indices, id: \.self) { i in
                            let it = items[i], g = it["g"]?.double ?? 0
                            HStack {
                                Text(it["n"]?.string ?? "").font(Typo.sans(14)).foregroundStyle(Palette.ink).lineLimit(2)
                                Spacer()
                                Text(itemText(it, g, nb)).font(Typo.mono(12)).foregroundStyle(Palette.muted)
                                if store.isSelf {
                                    Button { var a = items; a.remove(at: i); C.call("nutrition.setMeal", .str(k), .str(id), .arr(a)) } label: {
                                        Image(systemName: "xmark").font(.system(size: 11, weight: .bold)).foregroundStyle(Palette.muted)
                                    }
                                    .accessibilityLabel("Retirer " + (it["n"]?.string ?? ""))
                                }
                            }
                        }
                        if items.isEmpty, store.isSelf, let y = ym[id]?.array, !y.isEmpty {
                            Button("Comme hier (" + y.prefix(3).map { Nutri.short($0["n"]?.string ?? "") }.joined(separator: ", ") + ")") {
                                C.call("nutrition.setMeal", .str(k), .str(id), .arr(y)); toast("Repris d’hier")
                            }
                            .font(Typo.sans(13, .medium)).foregroundStyle(Palette.accent)
                        }
                    }
                    .padding(12).background(Palette.sunk.opacity(0.45), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                if any && foods.ready, let tg {
                    VStack(alignment: .leading, spacing: 10) {
                        if let kc = tg["kcal"]?.array, kc.count == 2 { NutriBar(label: "Énergie", v: t["kcal"]?.double ?? 0, lo: kc[0].double, hi: kc[1].double, unit: "kcal", nb: nb) }
                        bar("Protéines", "p", t, tg, nb)
                        bar("Glucides", "g", t, tg, nb)
                        if tg["l"] != nil && tg["l"] != .null { bar("Lipides", "l", t, tg, nb) }
                        NutriBar(label: "Fibres", v: t["fib"]?.double ?? 0, lo: tg["fib"]?.double, unit: "g", nb: nb)
                        DisclosureGroup {
                            MicroBars(avg: withEpaDha(t), unk: t["unk"] ?? .emptyObject, grams: t["grams"]?.double ?? 0)
                            Text("Sur une seule journée, c’est normal d’être loin de certaines références : le bilan de la semaine (Suivi → Alimentation) est plus parlant.").font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                        } label: { Text("Vitamines et minéraux du jour").font(Typo.sans(14, .semibold)).foregroundStyle(Palette.accent) }
                        .tint(Palette.accent)
                    }
                }
                ForEach(adv.indices, id: \.self) { i in
                    HStack(alignment: .top, spacing: 10) {
                        RoundedRectangle(cornerRadius: 2).fill(Palette.accent).frame(width: 3.5)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(adv[i]["t"]?.string ?? "").font(Typo.sans(14.5, .semibold)).foregroundStyle(Palette.ink)
                            GlossText(adv[i]["d"]?.string).font(Typo.sans(13.5)).foregroundStyle(Palette.muted)
                            SourcesLine(ids: adv[i]["src"]?.array.compactMap { $0.string } ?? [])
                        }
                    }
                }
                Text("Estimations à ±10 % environ, pas un avis médical ni diététique.").font(Typo.sans(12)).foregroundStyle(Palette.muted)
            }
            .onAppear { foods.load() }
            .sheet(item: $sheet) { r in FoodSheet(k: k, meal: r.id).presentationDragIndicator(.visible) }
        }
    }
    private func withEpaDha(_ t: JSON) -> JSON {
        var a = t; a["epadha"] = .num((t["epa"]?.double ?? 0) + (t["dha"]?.double ?? 0)); return a
    }
    private func itemText(_ it: JSON, _ g: Double, _ nb: Bool) -> String {
        guard nb, let kc = Nutri.C.call("nutrition.foodByCode", it["c"] ?? .null)?["v"]?["kcal"]?.double else { return R(g) + " g" }
        return R(g) + " g · " + R(kc * g / 100) + " kcal"
    }
    private func expText(_ tg: JSON) -> String? {
        guard let kc = tg["kcal"]?.array, kc.count == 2 else { return nil }
        var s = "Dépense estimée ≈ " + R(tg["ex"]?["lo"]?.double ?? 0) + " à " + R(tg["ex"]?["hi"]?.double ?? 0) + " kcal"
        let goal = tg["goal"]?.string ?? "maintien"
        if goal != "maintien" { s += " · objectif " + (goal == "perte" ? "perte : " : "prise : ") + R(kc[0].double ?? 0) + "–" + R(kc[1].double ?? 0) + " kcal" }
        return s
    }
    private func rangeChip(_ l: String, _ r: JSON?) -> some View {
        (Text(l + " ").foregroundColor(Palette.muted) + Text("\(r?[0]?.int ?? 0)–\(r?[1]?.int ?? 0) g").font(Typo.sans(13, .semibold)).foregroundColor(Palette.ink))
            .font(Typo.sans(13)).padding(.horizontal, 10).padding(.vertical, 5).background(Palette.sunk, in: Capsule())
    }
    private func bar(_ l: String, _ key: String, _ t: JSON, _ tg: JSON, _ nb: Bool) -> some View {
        NutriBar(label: l, v: t[key]?.double ?? 0, lo: tg[key]?[0]?.double, hi: tg[key]?[1]?.double, unit: "g", nb: nb)
    }
}

struct MicroBars: View {
    let avg: JSON
    let unk: JSON
    let grams: Double
    var body: some View {
        let C = Nutri.C, refs = C.call("nutrition.refs") ?? .emptyObject, nb = Nutri.numbers
        let noAlert = C.constant("nutrition.NO_ALERT")
        VStack(spacing: 8) {
            ForEach(C.constant("nutrition.MICROS").array.indices, id: \.self) { i in
                let x = C.constant("nutrition.MICROS").array[i], key = x[0]?.string ?? "", u = x[2]?.string ?? ""
                let ref = refs[key]?.double ?? 0, v = avg[key]?.double ?? 0, pct = ref > 0 ? v / ref : 0
                let uk = grams > 0 ? (unk[key]?.double ?? 0) / grams : 0
                let low = pct < 0.7 && noAlert[key] == nil
                let val = u == "g" && key == "epadha" ? R(v * 1000) + " mg" : (v < 10 ? f1(v) : R(v)) + " " + u
                HStack(spacing: 8) {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(x[1]?.string ?? key).font(Typo.sans(13, .medium)).foregroundStyle(Palette.ink)
                        if uk > 0.3 { Text("estimation incomplète").font(Typo.sans(10.5)).foregroundStyle(Palette.muted) }
                    }
                    .frame(width: 118, alignment: .leading)
                    GeometryReader { g in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Palette.sunk)
                            Capsule().fill(low ? Palette.warn : Palette.good).frame(width: g.size.width * min(1, pct))
                        }
                    }
                    .frame(height: 7)
                    VStack(alignment: .trailing, spacing: 0) {
                        Text("\(Int((pct * 100).rounded())) %").font(Typo.mono(12, .semibold)).foregroundStyle(low ? Palette.warn : Palette.ink)
                        if nb { Text(val).font(Typo.mono(10)).foregroundStyle(Palette.muted) }
                    }
                    .frame(width: 66, alignment: .trailing)
                }
            }
        }
    }
}

// MARK: ajouter un aliment

struct FoodSheet: View {
    let k: String
    let meal: String
    @Environment(\.dismiss) private var dismiss
    @State private var foods = Foods.shared
    @State private var store = Store.shared
    @State private var q = ""
    @State private var sel: JSON?
    @State private var grams = "100"
    @State private var saveName: String?
    @State private var custom = false
    @FocusState private var focus: Bool

    private var C: Core { Nutri.C }
    private var rec: [JSON] { C.call("nutrition.recents")?.array ?? [] }
    private var cur: [JSON] { C.call("nutrition.mealsOf", .str(k), .null)?[meal]?.array ?? [] }
    private var lbl: String { Nutri.meals.first { $0.0 == meal }?.1 ?? "Repas" }
    private var g: Double { Double(grams.replacingOccurrences(of: ",", with: ".")) ?? 0 }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    currentChips
                    if custom {
                        CustomFoodForm(name: q, onDone: { f in custom = false; pick(f) }, onCancel: { custom = false })
                    } else if let sel {
                        selectedCard(sel)
                    } else {
                        searchField
                        if !q.trimmingCharacters(in: .whitespaces).isEmpty { results } else { browse }
                    }
                    saveRow
                    SourcesLine(ids: ["ciqual2025"])
                }
                .padding(16)
            }
            .background(Palette.bg)
            .navigationTitle(lbl).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("OK") { dismiss() }.fontWeight(.semibold) } }
        }
        .onAppear { foods.load(); focus = true }
    }

    @ViewBuilder private var currentChips: some View {
        let cur = self.cur
        if !cur.isEmpty {
            Flow(spacing: 6) {
                ForEach(cur.indices, id: \.self) { i in
                    HStack(spacing: 6) {
                        Text(chipText(cur[i])).font(Typo.sans(13.5))
                        Button { removeItem(i) } label: { Image(systemName: "xmark").font(.system(size: 10, weight: .bold)) }
                    }
                    .foregroundStyle(Palette.ink).padding(.horizontal, 10).padding(.vertical, 6).background(Palette.sunk, in: Capsule())
                }
            }
        }
    }
    private func chipText(_ it: JSON) -> String { Nutri.short(it["n"]?.string ?? "") + " · " + R(it["g"]?.double ?? 0) + " g" }
    private func removeItem(_ i: Int) { var a = cur; a.remove(at: i); C.call("nutrition.setMeal", .str(k), .str(meal), .arr(a)) }

    private func selectedCard(_ sel: JSON) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(sel["n"]?.string ?? "").font(Typo.sans(17, .semibold)).foregroundStyle(Palette.ink)
            HStack(alignment: .bottom, spacing: 10) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("Quantité (g)").font(Typo.sans(12.5, .medium)).foregroundStyle(Palette.muted)
                    TextField("", text: $grams).keyboardType(.decimalPad).font(Typo.mono(20, .semibold))
                        .padding(.horizontal, 12).frame(width: 110, height: 48).background(Palette.sunk, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                Flow(spacing: 6) { ForEach([30, 50, 100, 150, 200, 250], id: \.self) { x in Chip(label: "\(x) g", on: g == Double(x)) { grams = "\(x)" } } }
            }
            Text(previewText(sel)).font(Typo.mono(12.5)).foregroundStyle(Palette.muted)
            HStack(spacing: 10) {
                Button("Retour") { self.sel = nil }.buttonStyle(BigButton(kind: .plain)).frame(maxWidth: 120)
                Button("Ajouter") { add(sel) }.buttonStyle(BigButton()).disabled(g <= 0)
            }
        }
        .card()
    }
    private func add(_ sel: JSON) {
        guard g > 0 else { return }
        C.call("nutrition.addFood", .str(k), .str(meal), sel, .num(g))
        Haptics.success()
        toast(Nutri.short(sel["n"]?.string ?? "") + " · " + R(g) + " g")
        self.sel = nil
        q = ""
    }

    private var searchField: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "magnifyingglass").foregroundStyle(Palette.muted)
                TextField("Rechercher un aliment (riz, pomme, yaourt…)", text: $q).focused($focus).autocorrectionDisabled()
            }
            .font(Typo.sans(16)).padding(.horizontal, 14).frame(minHeight: 48).background(Palette.sunk, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            if !foods.ready {
                HStack {
                    ProgressView()
                    Text("Chargement de la base d’aliments…").font(Typo.sans(13.5)).foregroundStyle(Palette.muted)
                }
            }
        }
    }

    @ViewBuilder private var results: some View {
        let list = searchList()
        let nb = Nutri.numbers
        VStack(spacing: 0) {
            ForEach(list.indices, id: \.self) { i in foodRow(list[i], nb: nb) { pick(list[i]) } }
            if foods.ready && list.isEmpty {
                Text("Aucun aliment trouvé. Essaie un mot plus simple (« poulet », « pâtes »).").font(Typo.sans(13.5)).foregroundStyle(Palette.muted).padding(.vertical, 10)
            }
            if foods.ready {
                Button { custom = true } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Créer « " + q.trimmingCharacters(in: .whitespaces) + " »").font(Typo.sans(15, .semibold)).foregroundStyle(Palette.accent)
                        Text("produit de marque, complément : avec les valeurs de l’étiquette").font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 10)
                }
                .buttonStyle(.plain)
            }
        }
    }
    private func searchList() -> [JSON] {
        guard foods.ready else { return [] }
        let codes = rec.compactMap { $0["c"] }
        return C.call("nutrition.searchFoods", .str(q), .arr(codes))?.array ?? []
    }

    @ViewBuilder private var browse: some View {
        let saved = C.call("nutrition.savedMeals")?.array ?? []
        let rec = self.rec
        let nb = Nutri.numbers
        if !saved.isEmpty {
            Eyebrow("Repas enregistrés")
            ForEach(saved.indices, id: \.self) { i in savedRow(saved[i]) }
        }
        if !rec.isEmpty {
            Eyebrow("Récents")
            ForEach(rec.prefix(15).indices, id: \.self) { i in
                if let f = C.call("nutrition.foodByCode", rec[i]["c"] ?? .null) {
                    foodRow(f, nb: nb, sub: "dernière portion : " + R(rec[i]["g"]?.double ?? 100) + " g") { pick(f) }
                }
            }
        }
        if rec.isEmpty && saved.isEmpty {
            Text("Tape le nom d’un aliment : la base Ciqual de l’ANSES contient 3 484 aliments courants. Les portions que tu utilises sont retenues pour la prochaine fois.").font(Typo.sans(13.5)).foregroundStyle(Palette.muted)
        }
    }
    private func savedRow(_ s: JSON) -> some View {
        let items = s["items"]?.array ?? []
        let names = items.map { Nutri.short($0["n"]?.string ?? "") }.joined(separator: ", ")
        return HStack {
            Button {
                C.call("nutrition.setMeal", .str(k), .str(meal), .arr(cur + items))
                toast((s["name"]?.string ?? "") + " ajouté")
            } label: {
                VStack(alignment: .leading, spacing: 2) {
                    Text(s["name"]?.string ?? "").font(Typo.sans(15, .semibold)).foregroundStyle(Palette.ink)
                    Text(names).font(Typo.sans(12.5)).foregroundStyle(Palette.muted).lineLimit(2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
            Button(role: .destructive) { C.call("nutrition.deleteMealPreset", s["id"] ?? .null) } label: { Image(systemName: "trash") }.foregroundStyle(Palette.crit)
        }
        .padding(.vertical, 6)
    }

    @ViewBuilder private var saveRow: some View {
        if !cur.isEmpty && sel == nil && !custom {
            if let name = saveName {
                HStack(alignment: .bottom) {
                    TextField("Nom du repas", text: Binding(get: { name }, set: { saveName = $0 })).font(Typo.sans(16)).padding(.horizontal, 12).frame(minHeight: 46).background(Palette.sunk, in: RoundedRectangle(cornerRadius: 12))
                    Button("OK") { savePreset(name) }.buttonStyle(SmallButton()).disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            } else {
                Button("Enregistrer ce repas pour le réutiliser") { saveName = lbl }.buttonStyle(SmallButton(color: Palette.muted))
            }
        }
    }
    private func savePreset(_ name: String) {
        C.call("nutrition.saveMealPreset", .str(name.trimmingCharacters(in: .whitespaces)), .arr(cur))
        saveName = nil
        toast("Repas enregistré")
    }
    private func previewText(_ sel: JSON) -> String {
        let nb = Nutri.numbers
        let item: JSON = ["c": sel["c"] ?? .null, "g": .num(g)]
        guard let p = C.call("nutrition.totals", .arr([item])) else { return "" }
        var s = nb ? R(p["kcal"]?.double ?? 0) + " kcal · " : ""
        s += "P " + f1(p["p"]?.double ?? 0) + " g · G " + f1(p["g"]?.double ?? 0) + " g · L " + f1(p["l"]?.double ?? 0) + " g"
        if let fib = p["fib"]?.double, fib > 0 { s += " · fibres " + f1(fib) + " g" }
        return s
    }
    private func per100(_ v: JSON, _ nb: Bool) -> String {
        var s = ""
        if nb, let kc = v["kcal"]?.double { s += R(kc) + " kcal · " }
        return s + "P " + f1(v["p"]?.double ?? 0) + " · G " + f1(v["g"]?.double ?? 0) + " · L " + f1(v["l"]?.double ?? 0) + " pour 100 g"
    }
    private func pick(_ f: JSON) {
        let r = rec.first { $0["c"] == f["c"] }
        sel = f
        grams = Fmt.num(r?["g"]?.double ?? 100)
    }
    private func foodRow(_ f: JSON, nb: Bool, sub: String? = nil, _ action: @escaping () -> Void) -> some View {
        let v = f["v"] ?? .emptyObject
        return Button(action: action) {
            VStack(alignment: .leading, spacing: 2) {
                Text(f["n"]?.string ?? "").font(Typo.sans(15)).foregroundStyle(Palette.ink).multilineTextAlignment(.leading)
                Text(sub ?? per100(v, nb)).font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
            }
            .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 9)
            .overlay(alignment: .bottom) { Rectangle().fill(Palette.rule.opacity(0.4)).frame(height: 0.5) }
        }
        .buttonStyle(.plain)
    }
}

private struct CustomFoodForm: View {
    let name: String
    let onDone: (JSON) -> Void
    let onCancel: () -> Void
    @State private var n = ""
    @State private var vals: [String: Double] = [:]
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Nouvel aliment").font(Typo.sans(16, .semibold)).foregroundStyle(Palette.ink)
            TextField("Nom", text: $n).font(Typo.sans(16)).padding(.horizontal, 12).frame(minHeight: 46).background(Palette.sunk, in: RoundedRectangle(cornerRadius: 12))
            Text("Valeurs pour 100 g, lues sur l’étiquette.").font(Typo.sans(13)).foregroundStyle(Palette.muted)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(["kcal", "p", "g", "l", "fib"], id: \.self) { key in
                    NumberField(label: ["kcal": "Énergie (kcal)", "p": "Protéines (g)", "g": "Glucides (g)", "l": "Lipides (g)", "fib": "Fibres (g)"][key] ?? key, value: vals[key]) { vals[key] = $0 }
                }
            }
            HStack(spacing: 10) {
                Button("Annuler", action: onCancel).buttonStyle(BigButton(kind: .plain)).frame(maxWidth: 120)
                Button("Enregistrer") {
                    let v: JSON = ["kcal": .num(vals["kcal"] ?? 0), "p": .num(vals["p"] ?? 0), "g": .num(vals["g"] ?? 0), "l": .num(vals["l"] ?? 0), "fib": vals["fib"].map { JSON.num($0) } ?? .null]
                    if let f = Core.shared.call("nutrition.saveCustomFood", .str(n.trimmingCharacters(in: .whitespaces)), v) { onDone(f) }
                }
                .buttonStyle(BigButton()).disabled(n.trimmingCharacters(in: .whitespaces).isEmpty || vals["kcal"] == nil)
            }
            Text("Les vitamines et minéraux de cet aliment ne seront pas comptés.").font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
        }
        .card()
        .onAppear { if n.isEmpty { n = name } }
    }
}

// MARK: bilan de la semaine (Suivi → Alimentation)

struct NutriWeekView: View {
    @State private var foods = Foods.shared
    @State private var store = Store.shared
    @State private var supp = false
    var body: some View {
        let C = Nutri.C
        Group {
            if C.call("nutrition.nutriVisible")?.truthy != true {
                EmptyNote(store.name(store.subject) + " n’a pas partagé son alimentation.")
            } else if !foods.ready {
                HStack {
                    ProgressView()
                    Text("Chargement de la base d’aliments…").font(Typo.sans(14)).foregroundStyle(Palette.muted)
                }
                .frame(maxWidth: .infinity).padding(.vertical, 30)
            } else {
                let ws = C.call("nutrition.weekSummary") ?? .emptyObject, adv = C.call("nutrition.weekAdvice", ws)?.array ?? []
                let nb = Nutri.numbers, n = ws["n"]?.int ?? 0
                VStack(alignment: .leading, spacing: 14) {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                        tile("Jours saisis", "\(n)", "/7", n < 3 ? "au moins 3 pour un bilan" : "sur les 7 derniers jours")
                        tile("Énergie moyenne", energyV(ws, n, nb), n > 0 && nb ? " kcal" : "", energyS(ws, nb))
                        tile("Protéines", kgV(ws["protKg"]), " g/kg", "repère ≈ 1,6 g/kg")
                        tile("Glucides", kgV(ws["choKg"]), " g/kg", "3 à 10 g/kg selon la charge")
                    }
                    if n == 0 {
                        EmptyNote("Note tes repas dans la fiche du jour → Alimentation : le bilan de la semaine apparaîtra ici.")
                    } else {
                        FoldCard(id: "nutri-micro", title: "Vitamines et minéraux", summary: "Moyenne de \(n) jour\(n > 1 ? "s" : "") · références ANSES", open: true) {
                            let unk: JSON = .obj(Dictionary(uniqueKeysWithValues: (ws["cov"]?.array ?? []).map { ($0["key"]?.string ?? "", $0["unk"] ?? .num(0)) }))
                            MicroBars(avg: ws["avg"] ?? .emptyObject, unk: unk, grams: 1)
                            Text("Pourcentage de la référence de l’ANSES (apport qui couvre les besoins de presque tout le monde) : en dessous de 70 % en moyenne, ça vaut le coup d’y regarder ; ce n’est pas un diagnostic. " + (C.constant("nutrition.NO_ALERT")["vd"]?.string ?? ""))
                                .font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                            SourcesLine(ids: ["anses2021", "ciqual2025"])
                        }
                        FoldCard(id: "nutri-adv", title: "Conseils", summary: adv.isEmpty ? (n < 3 ? "Pas encore assez de jours" : "Rien à signaler") : "\(adv.count) point\(adv.count > 1 ? "s" : "")", open: true) {
                            if adv.isEmpty {
                                Text(n < 3 ? "Saisis au moins 3 jours dans la semaine pour un bilan fiable." : "Pas de manque répété sur la semaine. Continue de varier : légumes, fruits, légumineuses, céréales complètes, protéines à chaque repas.").font(Typo.sans(14)).foregroundStyle(Palette.muted)
                            }
                            ForEach(adv.indices, id: \.self) { i in
                                HStack(alignment: .top, spacing: 10) {
                                    RoundedRectangle(cornerRadius: 2).fill(Palette.level(adv[i]["lvl"]?.string)).frame(width: 3.5)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(adv[i]["t"]?.string ?? "").font(Typo.sans(14.5, .semibold)).foregroundStyle(Palette.ink)
                                        GlossText(adv[i]["d"]?.string).font(Typo.sans(13.5)).foregroundStyle(Palette.muted)
                                        SourcesLine(ids: adv[i]["src"]?.array.compactMap { $0.string } ?? [])
                                    }
                                }
                            }
                        }
                    }
                    OptionRow(title: "Compléments alimentaires", text: "Ce qui a des preuves, ce qui est médical, et les précautions anti-dopage", icon: "pills") { supp = true }
                }
            }
        }
        .onAppear { foods.load() }
        .sheet(isPresented: $supp) { SuppSheet() }
    }
    private func energyV(_ ws: JSON, _ n: Int, _ nb: Bool) -> String { n > 0 && nb ? R(ws["avg"]?["kcal"]?.double ?? 0) : "—" }
    private func energyS(_ ws: JSON, _ nb: Bool) -> String {
        guard nb else { return "chiffres masqués" }
        guard let e = ws["exp"]?.double else { return "jours saisis seulement" }
        return "dépense ≈ " + R(e) + " kcal"
    }
    private func kgV(_ v: JSON?) -> String { v?.double.map { f1($0) } ?? "—" }
    private func tile(_ k: String, _ v: String, _ small: String, _ s: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(k).font(Typo.sans(12.5, .medium)).foregroundStyle(Palette.muted)
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(v).font(Typo.display(30)).foregroundStyle(Palette.ink).minimumScaleFactor(0.6).lineLimit(1)
                Text(small).font(Typo.mono(11.5)).foregroundStyle(Palette.muted)
            }
            Text(s).font(Typo.sans(12)).foregroundStyle(Palette.muted).lineLimit(2)
        }
        .card(padding: 14)
    }
}

struct SuppSheet: View {
    var body: some View {
        let C = Nutri.C, u18 = Store.shared.profile()["under18"]?.truthy ?? false
        let list = (C.constant("nutrition.SUPPS").array).filter { !(u18 && $0["perf"]?.truthy == true) }
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text("D’abord l’assiette : un complément ne rattrape pas une alimentation insuffisante.").font(Typo.sans(17, .medium)).foregroundStyle(Palette.ink)
                    Banner(color: Palette.warn, title: C.constant("nutrition.SUPP_WARN").string ?? "")
                    if u18 { Text("Avant 18 ans, les compléments de performance ne sont pas recommandés : on mise sur l’alimentation, le sommeil et l’entraînement.").font(Typo.sans(13.5)).foregroundStyle(Palette.muted) }
                    ForEach(list.indices, id: \.self) { i in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(alignment: .firstTextBaseline) {
                                Text(list[i]["l"]?.string ?? "").font(Typo.sans(16, .semibold)).foregroundStyle(Palette.ink)
                                Spacer()
                                Text(list[i]["lvl"]?.string ?? "").font(Typo.sans(12, .medium)).foregroundStyle(Palette.muted)
                            }
                            GlossText(list[i]["d"]?.string).font(Typo.sans(14)).foregroundStyle(Palette.ink)
                        }
                        .card()
                    }
                    SourcesLine(ids: ["maughan2018"])
                }
                .padding(16)
            }
            .background(Palette.bg)
            .navigationTitle("Compléments").navigationBarTitleDisplayMode(.inline)
        }
    }
}
