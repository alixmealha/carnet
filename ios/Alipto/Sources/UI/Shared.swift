import SwiftUI

// Termes du lexique (soulignés, un appui les explique), sources scientifiques, textes du plan en markdown.

/// Texte du plan : pastilles de prise colorées et termes du lexique soulignés (un appui ouvre l'explication)
struct GlossText: View {
    let text: String
    var gloss = true
    init(_ text: String?, gloss: Bool = true) { self.text = text ?? ""; self.gloss = gloss }
    @State private var term: TermRef?
    var body: some View {
        Text(Lexicon.attributed(text, gloss: gloss))
            .environment(\.openURL, OpenURLAction { url in
                if url.scheme == "alipto-term", let id = url.host ?? url.pathComponents.last { term = TermRef(id: id); return .handled }
                return .systemAction
            })
            .sheet(item: $term) { t in TermSheet(id: t.id).presentationDetents([.medium, .large]).presentationDragIndicator(.visible) }
    }
}
struct TermRef: Identifiable { let id: String }

enum Lexicon {
    private static var cache: [String: [(String, String?)]] = [:]
    static func split(_ s: String) -> [(String, String?)] {
        if let c = cache[s] { return c }
        let parts = (Core.shared.call("extra.glossSplit", .str(s))?.array ?? []).map { p -> (String, String?) in (p[0]?.string ?? "", p[1]?.string) }
        let out = parts.isEmpty ? [(s, nil)] : parts
        if cache.count > 800 { cache.removeAll() }
        cache[s] = out
        return out
    }
    static func attributed(_ s: String, gloss: Bool) -> AttributedString {
        var out = AttributedString()
        let pieces: [(String, String?)] = gloss && !s.isEmpty ? split(s) : [(s, nil)]
        for (txt, id) in pieces {
            if let id {
                var a = AttributedString(txt)
                a.link = URL(string: "alipto-term://" + id)
                a.underlineStyle = Text.LineStyle(pattern: .dot, color: Palette.accent.opacity(0.7))
                out += a
            } else {
                out += holds(txt)
            }
        }
        return out
    }
    /// « [bleu] » → pastille de couleur et nom de la prise
    static func holds(_ s: String) -> AttributedString {
        guard let re = try? NSRegularExpression(pattern: #"\[(jaune|vert|bleu|violet|rouge|blanc|noir|rose|orange|gris|marron)\]\s*"#) else { return AttributedString(s) }
        let ns = s as NSString
        var out = AttributedString(), last = 0
        for m in re.matches(in: s, range: NSRange(location: 0, length: ns.length)) {
            if m.range.location > last { out += AttributedString(ns.substring(with: NSRange(location: last, length: m.range.location - last))) }
            let name = ns.substring(with: m.range(at: 1))
            var dot = AttributedString("●\u{2009}"); dot.foregroundColor = Palette.hold(name)
            out += dot + AttributedString(name + " ")
            last = m.range.location + m.range.length
        }
        if last < ns.length { out += AttributedString(ns.substring(from: last)) }
        return out
    }
    static var all: [JSON] { Core.shared.constant("glossary.GLOSS").array }
    static func term(_ id: String) -> JSON? { Core.shared.constant("glossary.GLOSS_BY_ID")[id] }
}

struct TermSheet: View {
    let id: String
    var body: some View {
        let g = Lexicon.term(id)
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text(g?["d"]?.string ?? "").font(Typo.sans(17)).foregroundStyle(Palette.ink).fixedSize(horizontal: false, vertical: true)
                    SourcesLine(ids: g?["src"]?.array.compactMap { $0.string } ?? [])
                }
                .padding(20).frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Palette.bg)
            .navigationTitle(g?["t"]?.string ?? "Lexique")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

/// « Saw et al., 2016 · Hooper 1995 » : un appui ouvre les références complètes
struct SourcesLine: View {
    let ids: [String]
    @State private var open = false
    var body: some View {
        let all = Core.shared.constant("sources.SOURCES")
        let list = ids.filter { all[$0] != nil }
        if !list.isEmpty {
            Button { open = true } label: {
                Text(list.map { all[$0]?["s"]?.string ?? $0 }.joined(separator: " · "))
                    .font(Typo.mono(11.5)).foregroundStyle(Palette.muted).underline(pattern: .dot, color: Palette.muted.opacity(0.6))
                    .multilineTextAlignment(.leading)
            }
            .buttonStyle(.plain)
            .sheet(isPresented: $open) {
                NavigationStack {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 12) {
                            ForEach(list, id: \.self) { id in
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(all[id]?["s"]?.string ?? id).font(Typo.sans(16, .semibold)).foregroundStyle(Palette.ink)
                                    if let n = all[id]?["n"]?.string { Text(n).font(Typo.sans(14.5)).foregroundStyle(Palette.ink) }
                                    if let r = all[id]?["r"]?.string { Text(r).font(Typo.sans(12.5)).foregroundStyle(Palette.muted).textSelection(.enabled) }
                                }
                                .card()
                            }
                        }
                        .padding(16)
                    }
                    .background(Palette.bg)
                    .navigationTitle("Sources").navigationBarTitleDisplayMode(.inline)
                }
                .presentationDetents([.medium, .large])
            }
        }
    }
}

/// Texte en markdown simple (titres, listes, gras) : notes de bloc, explications du plan
struct MarkdownText: View {
    let text: String
    var body: some View {
        let lines = text.components(separatedBy: "\n")
        VStack(alignment: .leading, spacing: 8) {
            ForEach(lines.indices, id: \.self) { i in
                let line = lines[i].trimmingCharacters(in: .whitespaces)
                if line.isEmpty { Color.clear.frame(height: 2) }
                else if line.hasPrefix("### ") || line.hasPrefix("## ") || line.hasPrefix("# ") {
                    Text(line.drop { $0 == "#" }.trimmingCharacters(in: .whitespaces).uppercased()).font(Typo.display(19)).foregroundStyle(Palette.ink).padding(.top, 4)
                } else if line.hasPrefix("- ") || line.hasPrefix("* ") {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Circle().fill(Palette.muted).frame(width: 4, height: 4).offset(y: -3)
                        inline(String(line.dropFirst(2)))
                    }
                } else { inline(line) }
            }
        }
    }
    private func inline(_ s: String) -> some View {
        let a = (try? AttributedString(markdown: s, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(s)
        return Text(a).font(Typo.sans(14.5)).foregroundStyle(Palette.ink).fixedSize(horizontal: false, vertical: true)
    }
}

/// Feuille de choix simple (liste d'options) au style de l'appli
struct OptionRow: View {
    let title: String
    var text: String? = nil
    var icon: String? = nil
    var on = false
    var danger = false
    let action: () -> Void
    var body: some View {
        Button { Haptics.tap(); action() } label: {
            HStack(alignment: .top, spacing: 12) {
                if let icon { Image(systemName: icon).font(.system(size: 17, weight: .semibold)).foregroundStyle(danger ? Palette.crit : Palette.accent).frame(width: 26) }
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(Typo.sans(16, .semibold)).foregroundStyle(danger ? Palette.crit : Palette.ink).multilineTextAlignment(.leading)
                    if let text { Text(text).font(Typo.sans(13.5)).foregroundStyle(Palette.muted).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true) }
                }
                Spacer(minLength: 0)
            }
            .padding(14).frame(maxWidth: .infinity, alignment: .leading)
            .background(Palette.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(on ? (danger ? Palette.crit : Palette.accent) : Palette.rule.opacity(0.6), lineWidth: on ? 1.5 : 0.5))
        }
        .buttonStyle(PressStyle())
    }
}

/// Champ numérique enregistré à la fin de la saisie (virgule acceptée)
struct NumberField: View {
    let label: String
    let value: Double?
    var integer = false
    var placeholder = ""
    let onCommit: (Double?) -> Void
    @State private var text = ""
    @FocusState private var focused: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label).font(Typo.sans(12.5, .medium)).foregroundStyle(Palette.muted).lineLimit(2)
            TextField(placeholder, text: $text)
                .keyboardType(integer ? .numberPad : .decimalPad)
                .font(Typo.mono(17, .medium))
                .focused($focused)
                .padding(.horizontal, 12).frame(minHeight: 46)
                .background(Palette.sunk, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                .onChange(of: focused) { _, f in if !f { commit() } }
                .onSubmit(commit)
        }
        .onAppear { sync() }
        .onChange(of: value) { _, _ in if !focused { sync() } }
    }
    private func sync() { text = value.map { Fmt.num($0) } ?? "" }
    private func commit() {
        let t = text.replacingOccurrences(of: ",", with: ".").trimmingCharacters(in: .whitespaces)
        var n = Double(t)
        if let x = n, integer { n = x.rounded() }
        if n != value { onCommit(n) }
    }
}
