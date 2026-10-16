import SwiftUI

// Repères (comme la version web) : les échelles de l'appli (ressenti, forme du matin, douleur, notation escalade),
// le lexique et les sources. Une tuile par échelle avec un aperçu ; le détail s'ouvre d'un appui.

private func scaleColor(_ cls: String) -> Color {
    switch cls {
    case "good": return Palette.good
    case "ok": return Color.dyn(0x7d8a2c, 0xb4c35a)
    case "warn": return Palette.warn
    case "crit": return Palette.crit
    default: return Palette.muted
    }
}
private func zoneOf(_ i: Int) -> Int { i <= 4 ? 0 : i <= 6 ? 1 : 2 }
private let ZONE_COL = [Palette.z1, Palette.z2, Palette.z3]
private let PAIN: [(Int, Int, String, String, String)] = [
    (0, 2, "good", "Zone sûre", "Tu continues normalement."),
    (3, 5, "warn", "Acceptable", "Si la douleur redescend d’ici le lendemain matin et n’augmente pas d’une semaine à l’autre."),
    (6, 10, "crit", "Trop", "On modifie ou on arrête ce qui la provoque.")
]
private func painCls(_ v: Int) -> String { PAIN.first { v >= $0.0 && v <= $0.1 }?.2 ?? "good" }

private struct Band { let lo: Int; let hi: Int; let lbl: String; let cls: String; let txt: String }
private func bandRanges() -> [Band] {
    let b = Core.shared.call("rules.bands")?.array ?? []
    return b.indices.map { i in
        let x = b[i]
        let lo = max(5, x[0]?.int ?? 5), hi = i == 0 ? 25 : (b[i - 1][0]?.int ?? 26) - 1
        return Band(lo: lo, hi: hi, lbl: x[1]?.string ?? "", cls: x[2]?.string ?? "", txt: x[3]?.string ?? "")
    }
}

private enum Tile: String, Identifiable, CaseIterable {
    case rpe, well, pain, siv, lex, src
    var id: String { rawValue }
    var title: String {
        switch self {
        case .rpe: return "Ressenti de séance"
        case .well: return "Forme du matin"
        case .pain: return "Douleur"
        case .siv: return "Notation escalade"
        case .lex: return "Lexique"
        case .src: return "Sources"
        }
    }
}

struct ReperesCard: View {
    @State private var open: Tile?
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            CardHeader("Repères")
            Text("Les échelles utilisées dans l’appli, les mots techniques et d’où viennent les chiffres.").font(Typo.sans(13.5)).foregroundStyle(Palette.muted)
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible())], spacing: 10) {
                ForEach(Tile.allCases) { t in
                    Button { Haptics.tap(); open = t } label: { TileView(t: t) }.buttonStyle(PressStyle())
                }
            }
        }
        .card()
        .sheet(item: $open) { t in ReperesSheet(t: t).presentationDetents([.large]).presentationDragIndicator(.visible) }
    }
}

private struct TileView: View {
    let t: Tile
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(t.title).font(Typo.sans(14.5, .semibold)).foregroundStyle(Palette.ink).lineLimit(1).minimumScaleFactor(0.8)
            Text(sub).font(Typo.sans(12)).foregroundStyle(Palette.muted).lineLimit(1).minimumScaleFactor(0.8)
            viz.frame(height: 10)
        }
        .padding(12).frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.sunk.opacity(0.6), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
    private var sub: String {
        switch t {
        case .rpe, .pain: return "0 à 10"
        case .well: return "sur 25"
        case .siv: return "spécificité · intensité · volume"
        case .lex: return "\(Core.shared.constant("glossary.GLOSS").array.count) termes expliqués"
        case .src: return "\(Core.shared.constant("sources.SOURCES").object.count) références"
        }
    }
    @ViewBuilder private var viz: some View {
        switch t {
        case .rpe:
            HStack(spacing: 2) { ForEach(0..<11, id: \.self) { i in RoundedRectangle(cornerRadius: 1.5).fill(ZONE_COL[zoneOf(i)]) } }
        case .well:
            let rs = Array(bandRanges().reversed())
            GeometryReader { g in
                HStack(spacing: 2) {
                    ForEach(rs.indices, id: \.self) { i in
                        RoundedRectangle(cornerRadius: 1.5).fill(scaleColor(rs[i].cls)).frame(width: max(2, (g.size.width - CGFloat(rs.count) * 2) * CGFloat(rs[i].hi - rs[i].lo + 1) / 21))
                    }
                }
            }
        case .pain:
            HStack(spacing: 2) { ForEach(0..<11, id: \.self) { v in RoundedRectangle(cornerRadius: 1.5).fill(scaleColor(painCls(v))) } }
        case .siv:
            GeometryReader { g in
                HStack(spacing: 3) {
                    ForEach([0.7, 0.9, 0.5], id: \.self) { w in Capsule().fill(Palette.kind("grimpe")).frame(width: g.size.width / 3 * w) }
                }
            }
        case .lex:
            Text("RIR · VMA · D′ · BFR").font(Typo.mono(10.5)).foregroundStyle(Palette.muted)
        case .src:
            Text("Études et consensus").font(Typo.mono(10.5)).foregroundStyle(Palette.muted)
        }
    }
}

private struct ReperesSheet: View {
    let t: Tile
    @Environment(\.dismiss) private var dismiss
    @State private var q = ""
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) { content }
                    .padding(16).padding(.bottom, 30)
            }
            .background(Palette.bg)
            .navigationTitle(t.title).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("OK") { dismiss() }.fontWeight(.semibold) } }
            .modifier(SearchIf(on: t == .lex || t == .src, q: $q))
        }
    }
    @ViewBuilder private var content: some View {
        switch t {
        case .rpe: RpeBody()
        case .well: WellBody()
        case .pain: PainBody()
        case .siv: SivBody()
        case .lex: LexBody(q: q)
        case .src: SrcBody(q: q)
        }
    }
}

private struct SearchIf: ViewModifier {
    let on: Bool
    @Binding var q: String
    func body(content: Content) -> some View {
        if on { content.searchable(text: $q, prompt: "Rechercher") } else { content }
    }
}

private struct ScaleRow: View {
    let n: String
    let color: Color
    let title: String
    var text: String? = nil
    var body: some View {
        HStack(alignment: text == nil ? .center : .top, spacing: 12) {
            Text(n).font(Typo.mono(14, .bold)).foregroundStyle(.white)
                .frame(minWidth: 36, minHeight: 30).padding(.horizontal, 4)
                .background(color, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(Typo.sans(15, text == nil ? .regular : .semibold)).foregroundStyle(Palette.ink)
                if let text { Text(text).font(Typo.sans(13.5)).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true) }
            }
            Spacer(minLength: 0)
        }
    }
}

private struct RpeBody: View {
    var body: some View {
        let rpe = Core.shared.constant("rules.RPE").array.compactMap { $0.string }
        let zones = Core.shared.constant("rules.ZONES").array
        VStack(alignment: .leading, spacing: 16) {
            GlossText("Noté environ 30 min après, pour toute la séance. Charge = ressenti × durée en minutes (UA).").font(Typo.sans(14.5)).foregroundStyle(Palette.muted)
            ForEach(zones.indices, id: \.self) { zi in
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 6) {
                        Text(zones[zi][0]?.string ?? "").font(Typo.sans(15, .semibold)).foregroundStyle(Palette.ink)
                        Text(zones[zi][2]?.string ?? "").font(Typo.mono(12.5)).foregroundStyle(Palette.muted)
                    }
                    ForEach(rpe.indices.filter { zoneOf($0) == zi }, id: \.self) { i in
                        ScaleRow(n: "\(i)", color: ZONE_COL[zi], title: rpe[i])
                    }
                }
            }
            SourcesLine(ids: ["foster2001"])
        }
    }
}

private struct WellBody: View {
    var body: some View {
        let rs = bandRanges()
        let well = Core.shared.constant("rules.WELL").array.compactMap { $0[1]?.string }
        VStack(alignment: .leading, spacing: 16) {
            Text(well.joined(separator: ", ") + " : chacun de 1 à 5, chaque matin. L’écart à ta propre moyenne compte plus que le chiffre seul.")
                .font(Typo.sans(14.5)).foregroundStyle(Palette.muted)
            BandStrip(parts: rs.reversed().map { ($0.hi - $0.lo + 1, scaleColor($0.cls), "\($0.lo)–\($0.hi)") })
            ForEach(rs.indices, id: \.self) { i in
                ScaleRow(n: "\(rs[i].lo)–\(rs[i].hi)", color: scaleColor(rs[i].cls), title: rs[i].lbl, text: rs[i].txt)
            }
            SourcesLine(ids: ["mclean2010", "saw2016"])
        }
    }
}

private struct BandStrip: View {
    let parts: [(Int, Color, String)]
    var body: some View {
        let total = CGFloat(max(1, parts.reduce(0) { $0 + $1.0 }))
        GeometryReader { g in
            HStack(spacing: 3) {
                ForEach(parts.indices, id: \.self) { i in
                    VStack(spacing: 4) {
                        RoundedRectangle(cornerRadius: 3).fill(parts[i].1).frame(height: 12)
                        Text(parts[i].2).font(Typo.mono(10.5)).foregroundStyle(Palette.muted).lineLimit(1).minimumScaleFactor(0.6)
                    }
                    .frame(width: max(8, (g.size.width - CGFloat(parts.count - 1) * 3) * CGFloat(parts[i].0) / total))
                }
            }
        }
        .frame(height: 32)
    }
}

private struct PainBody: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Pendant l’effort et le lendemain matin, de 0 (rien) à 10 (insupportable).").font(Typo.sans(14.5)).foregroundStyle(Palette.muted)
            BandStrip(parts: (0...10).map { (1, scaleColor(painCls($0)), "\($0)") })
            ForEach(PAIN.indices, id: \.self) { i in
                let p = PAIN[i]
                ScaleRow(n: "\(p.0)–\(p.1)", color: scaleColor(p.2), title: p.3, text: p.4)
            }
            SourcesLine(ids: ["silbernagel2007"])
        }
    }
}

private struct SivBody: View {
    var body: some View {
        let siv = Core.shared.constant("rules.SIV").array
        VStack(alignment: .leading, spacing: 16) {
            Text("Pour les séances d’escalade, chacun sur 10. Charge de séance = intensité + volume.").font(Typo.sans(14.5)).foregroundStyle(Palette.muted)
            ForEach(siv.indices, id: \.self) { i in
                let q = siv[i][2]?.string ?? ""
                ScaleRow(n: (siv[i][0]?.string ?? "").uppercased(), color: Palette.kind("grimpe"), title: siv[i][1]?.string ?? "", text: q.prefix(1).uppercased() + q.dropFirst())
            }
            Text("Méthode de Marie Akrich ; l’étalonnage sur 10 est propre à l’appli. Pour la muscu, le renfo et la kiné, on note les exercices réalisés (séries × répétitions × charge), la douleur en kiné ; pour le cardio, la distance et la fréquence cardiaque. Le ressenti × la durée reste la charge commune à toutes les activités.")
                .font(Typo.sans(13.5)).foregroundStyle(Palette.muted)
        }
    }
}

private func folded(_ s: String) -> String { s.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "fr_FR")) }

private struct LexBody: View {
    let q: String
    var body: some View {
        let all = Core.shared.constant("glossary.GLOSS").array.sorted { ($0["t"]?.string ?? "").localizedCompare($1["t"]?.string ?? "") == .orderedAscending }
        let f = folded(q.trimmingCharacters(in: .whitespaces))
        let list = f.isEmpty ? all : all.filter { g in
            folded(g["t"]?.string ?? "").contains(f) || folded(g["d"]?.string ?? "").contains(f) || (g["a"]?.array.contains { folded($0.string ?? "").contains(f) } ?? false)
        }
        VStack(alignment: .leading, spacing: 12) {
            if q.isEmpty {
                Text("Les mêmes explications s’ouvrent d’un appui sur les mots soulignés en pointillés, partout dans l’appli.").font(Typo.sans(14)).foregroundStyle(Palette.muted)
            }
            ForEach(list.indices, id: \.self) { i in
                let g = list[i]
                VStack(alignment: .leading, spacing: 6) {
                    Text(g["t"]?.string ?? "").font(Typo.sans(16, .semibold)).foregroundStyle(Palette.ink)
                    Text(g["d"]?.string ?? "").font(Typo.sans(14.5)).foregroundStyle(Palette.ink.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
                    SourcesLine(ids: g["src"]?.array.compactMap { $0.string } ?? [])
                }
                .card(padding: 14)
            }
            if list.isEmpty { Text("Aucun terme ne correspond.").font(Typo.sans(14)).foregroundStyle(Palette.muted) }
        }
    }
}

private func srcText(_ s: JSON) -> String {
    let a: String = s["s"]?.string ?? "", b: String = s["n"]?.string ?? "", c: String = s["r"]?.string ?? ""
    return folded(a + " " + b + " " + c)
}

private struct SrcBody: View {
    let q: String
    var body: some View {
        let all = Core.shared.constant("sources.SOURCES").object.values.sorted { ($0["s"]?.string ?? "").localizedCompare($1["s"]?.string ?? "") == .orderedAscending }
        let f = folded(q.trimmingCharacters(in: .whitespaces))
        let list = f.isEmpty ? all : all.filter { srcText($0).contains(f) }
        VStack(alignment: .leading, spacing: 12) {
            ForEach(list.indices, id: \.self) { i in
                let s = list[i]
                VStack(alignment: .leading, spacing: 4) {
                    Text(s["s"]?.string ?? "").font(Typo.sans(15, .semibold)).foregroundStyle(Palette.ink)
                    Text(s["n"]?.string ?? "").font(Typo.sans(14)).foregroundStyle(Palette.ink.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
                    Text(s["r"]?.string ?? "").font(Typo.sans(12.5)).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
                }
                .card(padding: 14)
            }
        }
    }
}
