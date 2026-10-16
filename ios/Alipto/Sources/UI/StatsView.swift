import SwiftUI
import Charts

// Suivi : tableau de bord (graphiques natifs), tests, alimentation — comme la version web.

extension Palette {
    static let plan = Color.dyn(0xc3cac4, 0x3d4549)
    static func stage(_ s: String) -> Color {
        switch s {
        case "profond": return .dyn(0x22327a, 0x5d74e0)
        case "leger": return .dyn(0x6f86d6, 0x9fb2f0)
        case "rem": return .dyn(0xa157c9, 0xc48ae8)
        default: return .dyn(0xe0789a, 0xf29bb6)
        }
    }
    static func zone(_ j: Int) -> Color { j == 0 ? z1 : j == 1 ? z2 : z3 }
}

private let fmtInt: (Double) -> String = { v in
    let f = NumberFormatter(); f.locale = Locale(identifier: "fr_FR"); f.numberStyle = .decimal; f.maximumFractionDigits = 0
    return f.string(from: NSNumber(value: v.rounded())) ?? "\(Int(v))"
}

struct StatsView: View {
    @State private var store = Store.shared
    @AppStorage("carnet-stats-view") private var view = "dash"
    var body: some View {
        let pr = PlanReader(store)
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 0) {
                        Eyebrow(pr.meta?["title"]?.string ?? "Ton suivi")
                        Text("SUIVI").font(Typo.display(54)).foregroundStyle(Palette.ink)
                    }
                    .padding(.top, 10)
                    Segmented(options: [("dash", "Tableau de bord"), ("tests", "Tests"), ("nutri", "Alimentation")], value: view) { v in if let v { withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) { view = v } } }
                    Group {
                        if view == "tests" { TestsView() }
                        else if view == "nutri" { NutriWeekView() }
                        else { Dashboard() }
                    }
                    .transition(.opacity)
                }
                .padding(.horizontal, 16).padding(.bottom, 40)
            }
            .scrollIndicators(.hidden)
            .background(Palette.bg)
            .statusBarScrim()
            .refreshable { await store.syncNow() }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: String.self) { k in DayDetail(k: k) }
        }
    }
}

private struct Dashboard: View {
    @State private var store = Store.shared
    var body: some View {
        let C = Core.shared
        let ws = C.call("stats.weeksStats")?.array ?? []
        let ci = C.call("stats.currentWeekIndex", .arr(ws))?.int ?? 0
        VStack(alignment: .leading, spacing: 14) {
            TilesView(ws: ws)
            ProgressCard()
            WeekBilanCard()
            AlertsCard(ws: ws)
            if C.call("sports.climber")?.truthy ?? true { PlanVsRealCard(ws: ws, ci: ci) }
            LoadCard(ws: ws, ci: ci)
            ZonesCard(ws: ws, ci: ci)
            WellnessCard()
            SleepCard()
            LoadsCard()
            JournalCard()
        }
    }
}

// MARK: tuiles

private struct TilesView: View {
    let ws: [JSON]
    var body: some View {
        let t = Core.shared.call("stats.tiles", .arr(ws)) ?? .emptyObject
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
            tile("Séances faites", "\(t["done"]?.int ?? 0)", "/\(t["planned"]?.int ?? 0)", "depuis le début du plan")
            tile("Forme sur 7 jours", wellV(t), t["well"]?.double != nil ? "/25" : "", t["wellLbl"]?.string ?? "pas encore de données")
            tile("Sommeil sur 7 jours", sleepV(t), "", sleepS(t))
            tile("Charge de la semaine", uaV(t), t["ua"]?.double != nil ? " UA" : "", uaS(t))
        }
    }
    private func wellV(_ t: JSON) -> String { guard let w = t["well"]?.double else { return "—" }; return Fmt.num((w * 10).rounded() / 10) }
    private func sleepV(_ t: JSON) -> String { guard let s = t["sleep"]?.int else { return "—" }; return Rules.durLong(s) }
    private func sleepS(_ t: JSON) -> String { let n = t["sleepN"]?.int ?? 0; return n > 0 ? "moyenne de \(n) nuit" + (n > 1 ? "s" : "") : "nuits non renseignées" }
    private func uaV(_ t: JSON) -> String { guard let u = t["ua"]?.double else { return "—" }; return fmtInt(u) }
    private func uaS(_ t: JSON) -> String { guard let d = t["uaDelta"]?.int else { return "ressenti × durée" }; return (d > 0 ? "+" : "") + "\(d) % vs semaine passée" }
    private func tile(_ k: String, _ v: String, _ small: String, _ s: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(k).font(Typo.sans(12.5, .medium)).foregroundStyle(Palette.muted)
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(v).font(Typo.display(32)).foregroundStyle(Palette.ink).contentTransition(.numericText()).minimumScaleFactor(0.6).lineLimit(1)
                Text(small).font(Typo.mono(12)).foregroundStyle(Palette.muted)
            }
            Text(s).font(Typo.sans(12)).foregroundStyle(Palette.muted).lineLimit(2)
        }
        .card(padding: 14)
    }
}

// MARK: progrès (records)

private struct ProgressCard: View {
    var body: some View {
        let R = Core.shared.call("records.allRecords") ?? .emptyObject
        let from = D.add(D.today, -60)
        let recent = (R["list"]?.array ?? []).filter { ($0["k"]?.string ?? "") >= from }.reversed().map { $0 }
        let best = (R["best"]?.array ?? []).sorted { ($0["k"]?.string ?? "") > ($1["k"]?.string ?? "") }.prefix(6)
        let grades = R["grades"]?.array ?? []
        if !best.isEmpty || !grades.isEmpty {
            FoldCard(id: "stats-progress", title: "Tes progrès", summary: recent.isEmpty ? "Meilleures charges et cotations" : "\(recent.count) record\(recent.count > 1 ? "s" : "") en 2 mois · le dernier : " + D.short(recent[0]["k"]?.string ?? "").lowercased(), open: true) {
                ForEach(recent.prefix(5).indices, id: \.self) { i in
                    let r = recent[i]
                    HStack(spacing: 10) {
                        Image(systemName: "trophy.fill").foregroundStyle(Palette.oil)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(r["txt"]?.string ?? "").font(Typo.sans(15, .semibold)).foregroundStyle(Palette.ink)
                            Text(D.short(r["k"]?.string ?? "") + " · avant : " + (r["prev"]?.string ?? "")).font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                        }
                    }
                }
                VStack(spacing: 0) {
                    ForEach(grades.indices, id: \.self) { i in
                        row(grades[i]["disc"]?.string == "bloc" ? "Bloc le plus dur" : "Voie la plus dure", grades[i]["g"]?.string ?? "", grades[i]["k"]?.string ?? "")
                    }
                    ForEach(Array(best), id: \.self) { b in
                        let v = b["v"]?.double ?? 0, u = b["u"]?.string ?? "kg"
                        row(b["name"]?.string ?? "", PlanReader.loadText(v, u) + ((b["reps"]?.int).map { " × \($0)" } ?? ""), b["k"]?.string ?? "")
                    }
                }
                Text("Un record compte à partir de la deuxième séance d’un exercice. Cotations : enchaînées sans chute en mode blocs.").font(Typo.sans(12)).foregroundStyle(Palette.muted)
            }
        }
    }
    private func row(_ a: String, _ b: String, _ k: String) -> some View {
        HStack {
            GlossText(a, gloss: false).font(Typo.sans(14)).foregroundStyle(Palette.ink).lineLimit(2)
            Spacer()
            Text(b).font(Typo.mono(14, .semibold)).foregroundStyle(Palette.ink)
            Text(D.day(k)).font(Typo.sans(12)).foregroundStyle(Palette.muted).frame(width: 64, alignment: .trailing)
        }
        .padding(.vertical, 7)
        .overlay(alignment: .bottom) { Rectangle().fill(Palette.rule.opacity(0.4)).frame(height: 0.5) }
    }
}

// MARK: bilan des 7 derniers jours

private struct WeekBilanCard: View {
    var body: some View {
        let items = Core.shared.call("insights.weekInsights")?.array ?? []
        let worst = items.contains { $0["lvl"]?.string == "crit" } ? "crit" : items.contains { $0["lvl"]?.string == "warn" } ? "warn" : "good"
        FoldCard(id: "stats-bilan", title: "Bilan des 7 derniers jours", summary: items.isEmpty ? "Pas encore assez de données" : worst == "crit" ? "À surveiller de près" : worst == "warn" ? "Quelques points d’attention" : "Tout va dans le bon sens", open: true) {
            if items.isEmpty {
                Text("Remplis ta forme du matin, ton sommeil et le ressenti de tes séances quelques jours : le bilan apparaîtra ici.").font(Typo.sans(14)).foregroundStyle(Palette.muted)
            }
            ForEach(items.indices, id: \.self) { i in
                let x = items[i]
                HStack(alignment: .top, spacing: 10) {
                    RoundedRectangle(cornerRadius: 2).fill(Palette.level(x["lvl"]?.string)).frame(width: 3.5)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(x["t"]?.string ?? "").font(Typo.sans(15, .semibold)).foregroundStyle(Palette.ink)
                        GlossText(x["d"]?.string).font(Typo.sans(14)).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
                        SourcesLine(ids: x["src"]?.array.compactMap { $0.string } ?? [])
                    }
                }
            }
        }
    }
}

// MARK: signaux

private struct AlertsCard: View {
    let ws: [JSON]
    @State private var all = false
    var body: some View {
        let a = Core.shared.call("stats.alerts", .arr(ws))?.array ?? []
        if !a.isEmpty {
            FoldCard(id: "stats-alerts", title: "Signaux", summary: "\(a.count) \(a.count > 1 ? "signaux" : "signal") · le plus récent : " + D.short(a[0]["k"]?.string ?? "")) {
                Text("Ce qui mérite ton attention, du plus récent au plus ancien.").font(Typo.sans(13)).foregroundStyle(Palette.muted)
                ForEach((all ? a : Array(a.prefix(4))).indices, id: \.self) { i in
                    let x = a[i], c = (x["c"]?.string ?? "").contains("crit") ? Palette.crit : Palette.warn
                    NavigationLink(value: x["k"]?.string ?? D.today) {
                        HStack(alignment: .top, spacing: 10) {
                            RoundedRectangle(cornerRadius: 2).fill(c).frame(width: 3.5)
                            VStack(alignment: .leading, spacing: 2) {
                                HStack { Text(x["t"]?.string ?? "").font(Typo.sans(14.5, .semibold)).foregroundStyle(Palette.ink); Spacer(); Text(D.short(x["k"]?.string ?? "")).font(Typo.mono(11.5)).foregroundStyle(Palette.muted) }
                                Text(x["d"]?.string ?? "").font(Typo.sans(13)).foregroundStyle(Palette.muted).multilineTextAlignment(.leading)
                            }
                        }
                        .padding(.vertical, 4).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                if a.count > 4 { Button(all ? "Voir moins" : "Voir les \(a.count) signaux") { withAnimation { all.toggle() } }.buttonStyle(SmallButton()) }
            }
        }
    }
}

// MARK: graphiques par semaine

private struct WeekBar: Identifiable { let id = UUID(); let label: String; let serie: String; let v: Double; let hl: Bool }

private struct PlanVsRealCard: View {
    let ws: [JSON], ci: Int
    @State private var sel: String?
    var body: some View {
        let has = ws.contains { $0["real"]?.double != nil }
        let cw: JSON? = ws.at(ci)
        FoldCard(id: "stats-pvr", title: "Prévu ou réalisé", summary: !has ? "Pas encore de données" : cw.map { "Cette semaine : prévu \($0["plan"]?.int ?? 0)" + (($0["real"]?.int).map { " · réalisé \($0)" } ?? "") } ?? "") {
            Text("Intensité + volume de chaque séance (sur 10), cumulés sur la semaine.").font(Typo.sans(13)).foregroundStyle(Palette.muted)
            if !has {
                EmptyNote("Note le profil réalisé (intensité, volume) après tes séances pour voir la comparaison.")
            } else {
                let bars = ws.flatMap { w -> [WeekBar] in
                    let l = w["label"]?.string ?? "", hl = w["wi"]?.int == ci
                    var out = [WeekBar(label: l, serie: "Prévu", v: w["plan"]?.double ?? 0, hl: hl)]
                    if let r = w["real"]?.double { out.append(WeekBar(label: l, serie: "Réalisé", v: r, hl: hl)) }
                    return out
                }
                Chart(bars) { b in
                    BarMark(x: .value("Semaine", b.label), y: .value("Charge", b.v), width: .ratio(0.8))
                        .foregroundStyle(by: .value("Série", b.serie))
                        .position(by: .value("Série", b.serie))
                        .clipShape(UnevenRoundedRectangle(topLeadingRadius: 3, topTrailingRadius: 3))
                    if let sel, sel == b.label, b.serie == "Prévu" {
                        RuleMark(x: .value("Semaine", sel)).foregroundStyle(Palette.muted.opacity(0.25))
                            .annotation(position: .top, overflowResolution: .init(x: .fit, y: .disabled)) { callout(sel) }
                    }
                }
                .chartForegroundStyleScale(["Prévu": Palette.plan, "Réalisé": Palette.accent])
                .chartXSelection(value: $sel)
                .weekAxes()
                .frame(height: 180)
            }
        }
    }
    private func callout(_ l: String) -> some View {
        let w = ws.first { $0["label"]?.string == l } ?? .emptyObject
        return Callout(title: l + " · " + (w["range"]?.string ?? ""), lines: ["Prévu \(w["plan"]?.int ?? 0)" + ((w["real"]?.int).map { " · réalisé \($0)" } ?? ""), (w["adherence"]?.double).map { "Exercices cochés \(Int(($0 * 100).rounded())) %" }].compactMap { $0 })
    }
}

private struct LoadCard: View {
    let ws: [JSON], ci: Int
    @State private var sel: String?
    var body: some View {
        let has = ws.contains { ($0["ua"]?.double ?? 0) > 0 }
        let cw: JSON? = ws.at(ci), pw: JSON? = ws.at(ci - 1)
        let sum: String = {
            guard let ua = cw?["ua"]?.double, ua > 0 else { return "Rien cette semaine pour l’instant" }
            var s = "Cette semaine : " + fmtInt(ua) + " UA"
            if let p = pw?["ua"]?.double, p > 0 { s += " (" + (ua >= p ? "+" : "") + "\(Int(((ua / p - 1) * 100).rounded())) %)" }
            return s
        }()
        FoldCard(id: "stats-load", title: "Charge interne", summary: has ? sum : "Pas encore de données") {
            Text("Ressenti × durée de chaque séance (UA), par semaine. En orange : plus de 30 % de hausse d’un coup.").font(Typo.sans(13)).foregroundStyle(Palette.muted)
            if !has { EmptyNote("Note le ressenti et la durée de tes séances pour suivre ta charge.") }
            else {
                Chart(ws.indices, id: \.self) { i in
                    let w = ws[i], ua = w["ua"]?.double ?? 0, p = i > 0 ? ws[i - 1]["ua"]?.double : nil
                    let spike = p.map { $0 > 0 && ua > $0 * 1.3 } ?? false
                    BarMark(x: .value("Semaine", w["label"]?.string ?? ""), y: .value("UA", ua), width: .ratio(0.6))
                        .foregroundStyle(spike ? Palette.warn : Palette.accent)
                        .clipShape(UnevenRoundedRectangle(topLeadingRadius: 4, topTrailingRadius: 4))
                        .annotation(position: .top) { if spike, let p { Text("+\(Int(((ua / p - 1) * 100).rounded()))%").font(Typo.mono(9.5)).foregroundStyle(Palette.warn) } }
                    if let sel, sel == w["label"]?.string {
                        RuleMark(x: .value("Semaine", sel)).foregroundStyle(Palette.muted.opacity(0.25))
                            .annotation(position: .top, overflowResolution: .init(x: .fit, y: .disabled)) {
                                Callout(title: sel + " · " + (w["range"]?.string ?? ""), lines: [loadLine(ua, p)])
                            }
                    }
                }
                .chartXSelection(value: $sel)
                .weekAxes(fmtY: { v in v >= 1000 ? Fmt.num((v / 100).rounded() / 10) + "k" : "\(Int(v))" })
                .frame(height: 180)
            }
        }
    }
}

private func loadLine(_ ua: Double, _ p: Double?) -> String {
    guard ua > 0 else { return "Pas de données" }
    var s = fmtInt(ua) + " UA"
    if let p, p > 0 { s += " (" + (ua >= p ? "+" : "") + "\(Int(((ua / p - 1) * 100).rounded())) %)" }
    return s
}

private struct ZoneSeg: Identifiable { let id = UUID(); let label: String; let zone: String; let pct: Double; let j: Int }
private struct ZonesCard: View {
    let ws: [JSON], ci: Int
    var body: some View {
        let ZONES = Core.shared.constant("rules.ZONES").array.map { ($0[0]?.string ?? "", $0[2]?.string ?? "") }
        let cl = Core.shared.call("sports.climber")?.truthy ?? true
        let tot: (JSON) -> Double = { w in (w["tz"]?.array ?? []).reduce(0) { $0 + ($1.double ?? 0) } }
        let has = ws.contains { tot($0) > 0 }
        let cw: JSON? = ws.at(ci)
        let sum: String = {
            guard let cw, tot(cw) > 0 else { return "Rien cette semaine pour l’instant" }
            let t = tot(cw)
            return "Cette semaine : " + ZONES.indices.map { j in "\(Int(((cw["tz"]?[j]?.double ?? 0) / t * 100).rounded())) % " + ZONES[j].0.lowercased() }.joined(separator: " · ")
        }()
        FoldCard(id: "stats-zones", title: "Répartition de l’intensité", summary: has ? sum : "Pas encore de données") {
            Text((cl ? "Minutes d’escalade et de doigts" : "Minutes d’entraînement") + " selon le ressenti. " + (cl ? "Le trait marque 80 % de facile, en repère seulement pour la force et la puissance." : "Repère d’endurance : environ 80 % du temps en facile (entraînement polarisé)."))
                .font(Typo.sans(13)).foregroundStyle(Palette.muted)
            if !has { EmptyNote("Ressenti et durée de tes séances : la répartition apparaîtra ici.") }
            else {
                let segs: [ZoneSeg] = ws.flatMap { w -> [ZoneSeg] in
                    let t = tot(w); guard t > 0 else { return [] }
                    return (0..<3).map { j in ZoneSeg(label: w["label"]?.string ?? "", zone: ZONES[j].0, pct: (w["tz"]?[j]?.double ?? 0) / t * 100, j: j) }
                }
                Chart {
                    ForEach(segs) { s in
                        BarMark(x: .value("Semaine", s.label), y: .value("%", s.pct), width: .ratio(0.6))
                            .foregroundStyle(by: .value("Zone", s.zone))
                    }
                    ForEach(ws.indices, id: \.self) { i in
                        let ph = ws[i]["w"]?["phase"]?.string
                        if ph == "force" || ph == "puissance" {
                            RuleMark(xStart: .value("Semaine", ws[i]["label"]?.string ?? ""), xEnd: .value("Semaine", ws[i]["label"]?.string ?? ""), y: .value("%", 80))
                                .foregroundStyle(Palette.ink).lineStyle(StrokeStyle(lineWidth: 1.5, dash: [3, 2]))
                        }
                    }
                }
                .chartForegroundStyleScale(domain: ZONES.map { $0.0 }, range: [Palette.z1, Palette.z2, Palette.z3])
                .chartYScale(domain: 0...100)
                .weekAxes(fmtY: { "\(Int($0))%" })
                .frame(height: 180)
            }
        }
    }
}

// MARK: séries par jour

private struct RangePicker: View {
    @Binding var r: String
    var body: some View { Segmented(options: [("28", "28 j"), ("all", "Tout")], value: r) { v in if let v { r = v } }.frame(width: 150) }
}
private func dayRange(_ r: String) -> [String] {
    let m = Store.shared.get("plan"), t = D.today
    let end = (m?["end"]?.string).map { $0 < t ? $0 : t } ?? t
    var start = r == "28" ? D.add(end, -27) : (m?["start"]?.string ?? D.add(end, -27))
    if let ms = m?["start"]?.string, start < ms { start = ms }
    return D.range(start < end ? start : end, end)
}

private struct DayPt: Identifiable { let id = UUID(); let k: String; let v: Double; var s: String = "" }

private struct WellnessCard: View {
    @State private var store = Store.shared
    @State private var r = "28"
    @State private var sel: Date?
    var body: some View {
        let ks = dayRange(r)
        let pts = ks.compactMap { k in Rules.score(store.journal(k)).map { DayPt(k: k, v: Double($0)) } }
        let avg7 = pts.suffix(7).map(\.v).reduce(0, +) / Double(max(1, min(7, pts.count)))
        FoldCard(id: "stats-well", title: "Forme du matin", summary: pts.isEmpty ? "Pas encore de données" : "Moyenne 7 j : " + Fmt.num((avg7 * 10).rounded() / 10) + "/25 · dernier \(Int(pts.last!.v))/25") {
            HStack { Text("Sommeil, fatigue, courbatures, stress, humeur : total sur 25.").font(Typo.sans(13)).foregroundStyle(Palette.muted); Spacer(); RangePicker(r: $r) }
            if pts.isEmpty { EmptyNote("Remplis la forme du matin pour voir ta courbe.") }
            else {
                Chart {
                    RectangleMark(yStart: .value("", 20), yEnd: .value("", 25)).foregroundStyle(Palette.good.opacity(0.08))
                    RectangleMark(yStart: .value("", 10), yEnd: .value("", 14)).foregroundStyle(Palette.warn.opacity(0.08))
                    RectangleMark(yStart: .value("", 5), yEnd: .value("", 10)).foregroundStyle(Palette.crit.opacity(0.08))
                    ForEach(pts) { p in
                        LineMark(x: .value("Jour", D.utc(p.k), unit: .day), y: .value("Forme", p.v))
                            .foregroundStyle(Palette.accent).lineStyle(StrokeStyle(lineWidth: 2)).interpolationMethod(.monotone)
                        PointMark(x: .value("Jour", D.utc(p.k), unit: .day), y: .value("Forme", p.v))
                            .foregroundStyle(Palette.level(Rules.verdict(Int(p.v)).cls)).symbolSize(ks.count > 40 ? 18 : 36)
                    }
                    if let sel, let p = pts.min(by: { abs(D.utc($0.k).timeIntervalSince(sel)) < abs(D.utc($1.k).timeIntervalSince(sel)) }) {
                        RuleMark(x: .value("Jour", D.utc(p.k), unit: .day)).foregroundStyle(Palette.muted.opacity(0.3))
                            .annotation(position: .top, overflowResolution: .init(x: .fit, y: .disabled)) { Callout(title: D.short(p.k), lines: ["\(Int(p.v))/25 · " + Rules.verdict(Int(p.v)).label]) }
                    }
                }
                .chartXSelection(value: $sel)
                .chartYScale(domain: 5...25)
                .dayAxes(yValues: [5, 10, 15, 20, 25])
                .frame(height: 180)
            }
        }
    }
}

private struct SleepCard: View {
    @State private var store = Store.shared
    @State private var r = "28"
    @State private var sel: Date?
    struct Seg: Identifiable { let id = UUID(); let k: String; let stage: String; let label: String; let min: Double }
    var body: some View {
        let ks = dayRange(r)
        let STAGES = [("profond", "Profond"), ("leger", "Léger"), ("rem", "Paradoxal")]
        let tots = ks.compactMap { k in Rules.nightTotal(store.journal(k)).map { (k, $0) } }
        let segs: [Seg] = tots.flatMap { (k, tt) -> [Seg] in
            let n = store.journal(k)["nuit"] ?? .emptyObject
            let st = STAGES.filter { n[$0.0]?.double != nil }
            if st.count < 2 { return [Seg(k: k, stage: "leger", label: "Sommeil", min: Double(tt))] }
            return st.map { Seg(k: k, stage: $0.0, label: $0.1, min: n[$0.0]?.double ?? 0) }
        }
        let vf = ks.compactMap { k in store.journal(k)["nuit"]?["vfc"]?.double.map { DayPt(k: k, v: $0) } }
        let avg7 = tots.suffix(7).map { Double($0.1) }.reduce(0, +) / Double(max(1, min(7, tots.count)))
        FoldCard(id: "stats-sleep", title: "Sommeil", summary: tots.isEmpty ? "Pas encore de données" : "Moyenne 7 j : " + Rules.durLong(Int(avg7.rounded()))) {
            HStack { Text("Durée de chaque nuit, par phase quand ta montre les donne. Le trait marque 7 h.").font(Typo.sans(13)).foregroundStyle(Palette.muted); Spacer(); RangePicker(r: $r) }
            if tots.isEmpty { EmptyNote("Renseigne ta nuit dans la fiche du jour, ou relie Apple Santé dans Plus.") }
            else {
                Chart {
                    ForEach(segs) { s in
                        BarMark(x: .value("Jour", D.utc(s.k), unit: .day), y: .value("Minutes", s.min))
                            .foregroundStyle(by: .value("Phase", s.label))
                    }
                    RuleMark(y: .value("7 h", 420)).foregroundStyle(Palette.ink).lineStyle(StrokeStyle(lineWidth: 1.2, dash: [4, 3]))
                    if let sel, let t = tots.min(by: { abs(D.utc($0.0).timeIntervalSince(sel)) < abs(D.utc($1.0).timeIntervalSince(sel)) }) {
                        RuleMark(x: .value("Jour", D.utc(t.0), unit: .day)).foregroundStyle(Palette.muted.opacity(0.3))
                            .annotation(position: .top, overflowResolution: .init(x: .fit, y: .disabled)) { Callout(title: D.short(t.0) + " · " + Rules.durLong(t.1), lines: sleepLines(t.0)) }
                    }
                }
                .chartForegroundStyleScale(domain: ["Profond", "Léger", "Paradoxal", "Sommeil"], range: [Palette.stage("profond"), Palette.stage("leger"), Palette.stage("rem"), Palette.stage("leger").opacity(0.75)])
                .chartXSelection(value: $sel)
                .dayAxes(yValues: [0, 180, 360, 540], fmtY: { "\(Int($0 / 60))h" })
                .frame(height: 190)
                if vf.count >= 2 {
                    let avg = vf.map(\.v).reduce(0, +) / Double(vf.count)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("VFC (ms)").font(Typo.sans(14, .semibold)).foregroundStyle(Palette.ink)
                        Text("variabilité cardiaque nocturne : plus haut = mieux récupéré, à comparer à ta propre moyenne").font(Typo.sans(12)).foregroundStyle(Palette.muted)
                    }
                    Chart {
                        RuleMark(y: .value("Moyenne", avg)).foregroundStyle(Palette.muted).lineStyle(StrokeStyle(lineWidth: 1, dash: [2, 3]))
                        ForEach(vf) { p in
                            LineMark(x: .value("Jour", D.utc(p.k), unit: .day), y: .value("VFC", p.v)).foregroundStyle(Palette.stage("rem")).lineStyle(StrokeStyle(lineWidth: 2))
                            PointMark(x: .value("Jour", D.utc(p.k), unit: .day), y: .value("VFC", p.v)).foregroundStyle(Palette.stage("rem")).symbolSize(28)
                        }
                    }
                    .chartYScale(domain: .automatic(includesZero: false))
                    .dayAxes(yValues: nil)
                    .frame(height: 120)
                }
            }
        }
    }
    private func sleepLines(_ k: String) -> [String] {
        let n = store.journal(k)["nuit"] ?? .emptyObject
        var out: [String] = []
        let st = [("profond", "Profond"), ("leger", "Léger"), ("rem", "Paradoxal")].compactMap { s in n[s.0]?.int.map { s.1 + " " + Rules.durLong($0) } }
        if !st.isEmpty { out.append(st.joined(separator: " · ")) }
        var m: [String] = []
        if let v = n["vfc"]?.int { m.append("VFC \(v) ms") }
        if let f = n["fcr"]?.int { m.append("FC \(f)") }
        if !m.isEmpty { out.append(m.joined(separator: " · ")) }
        return out
    }
}

// MARK: charges

private struct LoadsCard: View {
    @State private var sel: String?
    var body: some View {
        let series = Core.shared.call("stats.loadSeries")?.array ?? []
        FoldCard(id: "stats-loads", title: "Charges", summary: series.isEmpty ? "Pas encore de données" : "\(series.count) exercice\(series.count > 1 ? "s" : "") suivi\(series.count > 1 ? "s" : "")") {
            Text("Charge utilisée à chaque séance où l’exercice est coché.").font(Typo.sans(13)).foregroundStyle(Palette.muted)
            if series.isEmpty { EmptyNote("Coche tes séries de muscu : les charges utilisées s’afficheront ici, séance après séance.") }
            else {
                let s = series.first { $0["name"]?.string == sel } ?? series[0]
                let pts = s["pts"]?.array ?? [], unit = s["unit"]?.string ?? "kg"
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(series.compactMap { $0["name"]?.string }, id: \.self) { n in Chip(label: plain(n), on: n == s["name"]?.string) { withAnimation { sel = n } } }
                    }
                }
                if let first = pts.first, let last = pts.last {
                    let lv = last["v"]?.double ?? 0, fv = first["v"]?.double ?? 0
                    HStack(alignment: .firstTextBaseline) {
                        Text(PlanReader.loadText(lv, unit)).font(Typo.display(30)).foregroundStyle(Palette.ink).contentTransition(.numericText())
                        Spacer()
                        Text(pts.count > 1 ? (lv - fv >= 0 ? "+" : "−") + Fmt.num(abs(lv - fv)) + " kg depuis le " + D.day(first["k"]?.string ?? "") : "Première séance le " + D.day(first["k"]?.string ?? ""))
                            .font(Typo.sans(13)).foregroundStyle(Palette.muted)
                    }
                    Chart(pts.indices, id: \.self) { i in
                        let p = pts[i], full = (p["sets"]?.int ?? 0) >= (p["n"]?.int ?? 1)
                        LineMark(x: .value("Séance", i), y: .value("kg", p["v"]?.double ?? 0)).foregroundStyle(Palette.kind("muscu")).lineStyle(StrokeStyle(lineWidth: 2))
                        PointMark(x: .value("Séance", i), y: .value("kg", p["v"]?.double ?? 0))
                            .symbol { Circle().fill(full ? Palette.kind("muscu") : Palette.surface).overlay(Circle().stroke(Palette.kind("muscu"), lineWidth: 2)).frame(width: 9, height: 9) }
                    }
                    .chartYScale(domain: .automatic(includesZero: false))
                    .chartXAxis {
                        AxisMarks(values: Array(pts.indices)) { v in
                            if let i = v.as(Int.self), i < pts.count, pts.count <= 8 || i % max(1, pts.count / 6) == 0 {
                                AxisValueLabel { Text(D.day(pts[i]["k"]?.string ?? "")).font(Typo.mono(9.5)) }
                            }
                        }
                    }
                    .chartYAxis {
                        AxisMarks(position: .leading) { _ in
                            AxisGridLine().foregroundStyle(Palette.rule.opacity(0.5))
                            AxisValueLabel().font(Typo.mono(10))
                        }
                    }
                    .frame(height: 160)
                    .id(s["name"]?.string ?? "")
                    .transition(.opacity)
                    Text("Point plein : toutes les séries faites. Point vide : séance incomplète.").font(Typo.sans(12)).foregroundStyle(Palette.muted)
                }
            }
        }
    }
}

// MARK: journal

private struct JournalCard: View {
    @State private var store = Store.shared
    @State private var n = 10
    var body: some View {
        let keys = store.ids("j:").map { String($0.dropFirst(2)) }.filter { !store.journal($0).object.isEmpty }.reversed().map { $0 }
        if !keys.isEmpty {
            FoldCard(id: "stats-journal", title: "Journal", summary: "\(keys.count) jour\(keys.count > 1 ? "s" : "") renseigné\(keys.count > 1 ? "s" : "")") {
                ForEach(keys.prefix(n), id: \.self) { k in
                    let e = store.journal(k), sc = Rules.score(e), nt = Rules.nightTotal(e)
                    NavigationLink(value: k) {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(alignment: .firstTextBaseline) {
                                Text(D.short(k)).font(Typo.sans(14.5, .semibold)).foregroundStyle(Palette.ink)
                                GlossText(PlanReader(store).sessionName(k), gloss: false).font(Typo.sans(13)).foregroundStyle(Palette.muted).lineLimit(1)
                                Spacer()
                                Image(systemName: "chevron.right").font(.system(size: 11, weight: .semibold)).foregroundStyle(Palette.muted.opacity(0.6))
                            }
                            Flow(spacing: 10) {
                                if let sc { chip("Forme", "\(sc)") }
                                if let nt { chip("Nuit", Rules.durLong(nt)) }
                                if let r = e["rpe"]?.int { chip("Ressenti", "\(r)") }
                                if let d = e["duree"]?.int { chip("", "\(d) min") }
                                if let r = e["rpe"]?.double, let d = e["duree"]?.double { chip("", fmtInt(r * d) + " UA") }
                                if let st = Rules.STATUS.first(where: { $0.0 == e["status"]?.string }) { chip("", st.1) }
                            }
                            if let note = e["note"]?.string { Text(note).font(Typo.sans(12.5)).foregroundStyle(Palette.muted).lineLimit(2) }
                        }
                        .padding(.vertical, 6).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                if keys.count > n { Button("Afficher plus") { withAnimation { n += 20 } }.buttonStyle(SmallButton()) }
            }
        }
    }
    private func chip(_ k: String, _ v: String) -> some View {
        (Text(k.isEmpty ? "" : k + " ").foregroundColor(Palette.muted) + Text(v).font(Typo.sans(13, .semibold)).foregroundColor(Palette.ink)).font(Typo.sans(13))
    }
}

// MARK: briques de graphiques

struct Callout: View {
    let title: String
    let lines: [String]
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(Typo.sans(12, .semibold)).foregroundStyle(Palette.bg)
            ForEach(lines, id: \.self) { Text($0).font(Typo.sans(11.5)).foregroundStyle(Palette.bg.opacity(0.85)) }
        }
        .padding(.horizontal, 10).padding(.vertical, 7)
        .background(Palette.ink, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}
struct EmptyNote: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text).font(Typo.sans(14)).foregroundStyle(Palette.muted).multilineTextAlignment(.center)
            .frame(maxWidth: .infinity).padding(.vertical, 18)
            .background(Palette.sunk.opacity(0.5), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

extension View {
    /// Axes discrets pour les graphiques par semaine
    func weekAxes(fmtY: ((Double) -> String)? = nil) -> some View {
        self
            .chartYAxis {
                AxisMarks(position: .leading) { v in
                    AxisGridLine().foregroundStyle(Palette.rule.opacity(0.5))
                    AxisValueLabel { if let d = v.as(Double.self) { Text(fmtY?(d) ?? Fmt.num(d)).font(Typo.mono(10)) } }
                }
            }
            .chartXAxis { AxisMarks { _ in AxisValueLabel().font(Typo.mono(9.5)) } }
            .chartLegend(position: .top, alignment: .leading)
    }
    /// Axes pour les séries par jour (une date par semaine)
    func dayAxes(yValues: [Double]?, fmtY: ((Double) -> String)? = nil) -> some View {
        self
            .chartYAxis {
                if let yValues {
                    AxisMarks(position: .leading, values: yValues) { v in
                        AxisGridLine().foregroundStyle(Palette.rule.opacity(0.5))
                        AxisValueLabel { if let d = v.as(Double.self) { Text(fmtY?(d) ?? Fmt.num(d)).font(Typo.mono(10)) } }
                    }
                } else {
                    AxisMarks(position: .leading) { v in
                        AxisGridLine().foregroundStyle(Palette.rule.opacity(0.5))
                        AxisValueLabel { if let d = v.as(Double.self) { Text(Fmt.num(d)).font(Typo.mono(10)) } }
                    }
                }
            }
            .chartXAxis {
                AxisMarks(values: .stride(by: .day, count: 7)) { v in
                    AxisGridLine().foregroundStyle(Palette.rule.opacity(0.25))
                    AxisValueLabel { if let d = v.as(Date.self) { Text(D.day(D.keyUTC(d))).font(Typo.mono(9.5)) } }
                }
            }
            .chartLegend(position: .top, alignment: .leading)
    }
}

extension D {
    /// Date (minuit UTC) → « AAAA-MM-JJ »
    static func keyUTC(_ d: Date) -> String {
        var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "UTC")!
        let x = c.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", x.year ?? 2000, x.month ?? 1, x.day ?? 1)
    }
}
