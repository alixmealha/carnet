import SwiftUI
import UIKit

// Briques d'interface d'Alipto : cartes, titres, pastilles, échelles de notes, boutons, anneau de forme.

enum Haptics {
    static func tap() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    static func select() { UISelectionFeedbackGenerator().selectionChanged() }
    static func firm() { UIImpactFeedbackGenerator(style: .medium).impactOccurred() }
    static func heavy() { UIImpactFeedbackGenerator(style: .heavy).impactOccurred() }
    static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    static func warning() { UINotificationFeedbackGenerator().notificationOccurred(.warning) }
}

extension Palette {
    static func level(_ l: String?) -> Color {
        switch l {
        case "good", "ok": return good
        case "warn": return warn
        case "crit": return crit
        case "info": return accent
        default: return muted
        }
    }
    /// Pastille de couleur des prises : [jaune], [bleu]…
    static func hold(_ name: String) -> Color {
        switch name {
        case "jaune": return Color(hex: 0xe9b800)
        case "vert": return Color(hex: 0x2b9a4a)
        case "bleu": return Color(hex: 0x2e6ada)
        case "violet": return Color(hex: 0x8550ce)
        case "rouge": return Color(hex: 0xd53939)
        case "blanc": return Color(hex: 0xf2f2f2)
        case "noir": return Color(hex: 0x161616)
        case "rose": return Color(hex: 0xee6aa7)
        case "orange": return Color(hex: 0xf08a24)
        case "gris": return Color(hex: 0x9aa0a6)
        case "marron": return Color(hex: 0x8a5a33)
        default: return muted
        }
    }
}

// MARK: textes

/// Texte du plan avec les pastilles de prise « [bleu] » dessinées en couleur
func rich(_ s: String?) -> Text {
    let str = s ?? ""
    guard let re = try? NSRegularExpression(pattern: #"\[(jaune|vert|bleu|violet|rouge|blanc|noir|rose|orange|gris|marron)\]\s*"#) else { return Text(str) }
    let ns = str as NSString
    var out = Text(""), last = 0
    for m in re.matches(in: str, range: NSRange(location: 0, length: ns.length)) {
        if m.range.location > last { out = out + Text(ns.substring(with: NSRange(location: last, length: m.range.location - last))) }
        let name = ns.substring(with: m.range(at: 1))
        out = out + Text("●\u{2009}").foregroundColor(Palette.hold(name)) + Text(name + " ")
        last = m.range.location + m.range.length
    }
    if last < ns.length { out = out + Text(ns.substring(from: last)) }
    return out
}

struct Eyebrow: View {
    let text: String
    var color: Color = Palette.muted
    init(_ text: String, color: Color = Palette.muted) { self.text = text; self.color = color }
    var body: some View {
        Text(text.uppercased()).font(Typo.mono(11.5, .medium)).tracking(1.1).foregroundStyle(color).lineLimit(1)
    }
}

struct DisplayTitle: View {
    let text: String
    var size: CGFloat = 26
    init(_ text: String, size: CGFloat = 26) { self.text = text; self.size = size }
    var body: some View {
        Text(text.uppercased()).font(Typo.display(size)).foregroundStyle(Palette.ink).lineSpacing(-2).fixedSize(horizontal: false, vertical: true)
    }
}

struct Pill: View {
    let text: String
    var color: Color = Palette.accent
    init(_ text: String, color: Color = Palette.accent) { self.text = text; self.color = color }
    var body: some View {
        Text(text).font(Typo.sans(12.5, .semibold)).foregroundStyle(color)
            .padding(.horizontal, 9).padding(.vertical, 3)
            .background(color.opacity(0.13), in: Capsule())
    }
}

// MARK: cartes

struct CardModifier: ViewModifier {
    var padding: CGFloat = 18
    var tint: Color? = nil
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Palette.surface)
                if let tint { RoundedRectangle(cornerRadius: 22, style: .continuous).fill(tint.opacity(0.06)) }
            }
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(tint?.opacity(0.35) ?? Palette.rule.opacity(0.7), lineWidth: tint == nil ? 0.5 : 1))
    }
}
extension View {
    func card(padding: CGFloat = 18, tint: Color? = nil) -> some View { modifier(CardModifier(padding: padding, tint: tint)) }
}

struct CardHeader<Trailing: View>: View {
    let title: String
    var trailing: Trailing
    init(_ title: String, @ViewBuilder trailing: () -> Trailing) { self.title = title; self.trailing = trailing() }
    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            DisplayTitle(title, size: 22)
            Spacer(minLength: 8)
            trailing
        }
    }
}
extension CardHeader where Trailing == EmptyView {
    init(_ title: String) { self.init(title) { EmptyView() } }
}

// MARK: boutons

struct BigButton: ButtonStyle {
    enum Kind { case primary, ink, plain, danger, soft }
    var kind: Kind = .primary
    @Environment(\.isEnabled) private var enabled
    func makeBody(configuration: Configuration) -> some View {
        let (bg, fg): (Color, Color) = {
            switch kind {
            case .primary: return (Palette.accent, Palette.accentInk)
            case .ink: return (Palette.ink, Palette.bg)
            case .plain: return (Palette.sunk, Palette.ink)
            case .danger: return (Palette.crit, .white)
            case .soft: return (Palette.accentSoft, Palette.accent)
            }
        }()
        return configuration.label
            .font(Typo.sans(17, .semibold))
            .foregroundStyle(fg)
            .frame(maxWidth: .infinity, minHeight: 56)
            .padding(.horizontal, 16)
            .background(bg, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .opacity(enabled ? 1 : 0.4)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}
struct SmallButton: ButtonStyle {
    var color: Color = Palette.accent
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Typo.sans(14, .semibold)).foregroundStyle(color)
            .padding(.horizontal, 12).frame(minHeight: 34)
            .background(color.opacity(configuration.isPressed ? 0.2 : 0.1), in: Capsule())
    }
}
/// Bouton qui rétrécit un peu quand on appuie (cartes, cases…)
struct PressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.scaleEffect(configuration.isPressed ? 0.97 : 1).opacity(configuration.isPressed ? 0.85 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

// MARK: anneau de forme

struct Ring: View {
    var value: Double?
    var max: Double = 25
    var color: Color
    var lineWidth: CGFloat = 9
    @State private var shown: Double = 0
    var body: some View {
        ZStack {
            Circle().stroke(Palette.sunk, lineWidth: lineWidth)
            Circle().trim(from: 0, to: shown)
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .onAppear { withAnimation(.spring(response: 0.9, dampingFraction: 0.8).delay(0.1)) { shown = frac } }
        .onChange(of: frac) { _, v in withAnimation(.spring(response: 0.7, dampingFraction: 0.75)) { shown = v } }
    }
    private var frac: Double { guard let value else { return 0 }; return Swift.max(0, Swift.min(1, value / max)) }
}

// MARK: échelles de notes

/// Note de 1 à 5 (forme du matin) : cinq pastilles, appuyer à nouveau efface
struct DotScale: View {
    let value: Int?
    var from = 1, to = 5
    var color: Color = Palette.accent
    let onChange: (Int?) -> Void
    var body: some View {
        HStack(spacing: 8) {
            ForEach(from...to, id: \.self) { i in
                let on = value != nil && i <= value!, cur = value == i
                Button {
                    Haptics.select()
                    onChange(value == i ? nil : i)
                } label: {
                    Text("\(i)").font(Typo.mono(15, .semibold))
                        .foregroundStyle(on ? Palette.accentInk : Palette.muted)
                        .frame(maxWidth: .infinity, minHeight: 40)
                        .background(on ? color.opacity(cur ? 1 : 0.55) : Palette.sunk, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                        .scaleEffect(cur ? 1.06 : 1)
                }
                .buttonStyle(PressStyle())
                .accessibilityLabel("\(i)")
                .accessibilityAddTraits(cur ? .isSelected : [])
            }
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.65), value: value)
    }
}

/// Note de 0 à 10 (ressenti, gêne) en une ligne serrée ; « cible » colore la zone visée
struct NumScale: View {
    let value: Int?
    var from = 0, to = 10
    var target: ClosedRange<Int>? = nil
    var color: Color = Palette.accent
    let onChange: (Int?) -> Void
    var body: some View {
        HStack(spacing: 4) {
            ForEach(from...to, id: \.self) { i in
                let cur = value == i, inT = target?.contains(i) ?? false
                Button { Haptics.select(); onChange(cur ? nil : i) } label: {
                    Text("\(i)").font(Typo.mono(14, .semibold))
                        .foregroundStyle(cur ? Palette.accentInk : inT ? Palette.accent : Palette.ink)
                        .frame(maxWidth: .infinity, minHeight: 40)
                        .background(cur ? color : inT ? Palette.accentSoft : Palette.sunk, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                }
                .buttonStyle(PressStyle())
                .accessibilityAddTraits(cur ? .isSelected : [])
            }
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: value)
    }
}

/// Choix parmi quelques options (statut, repas…)
struct Segmented: View {
    let options: [(String, String)]
    let value: String?
    let onChange: (String?) -> Void
    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<options.count, id: \.self) { j in
                let o = options[j]
                let on = value == o.0
                Button { Haptics.select(); onChange(on ? nil : o.0) } label: {
                    Text(o.1).font(Typo.sans(15, on ? .semibold : .medium))
                        .foregroundStyle(on ? Palette.ink : Palette.muted)
                        .frame(maxWidth: .infinity, minHeight: 40)
                        .background { if on { RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Palette.surface).shadow(color: .black.opacity(0.08), radius: 3, y: 1) } }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Palette.sunk, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: value)
    }
}

struct Chip: View {
    let label: String
    let on: Bool
    var color: Color = Palette.accent
    let action: () -> Void
    var body: some View {
        Button { Haptics.select(); action() } label: {
            Text(label).font(Typo.sans(14, .medium))
                .foregroundStyle(on ? Palette.accentInk : Palette.ink)
                .padding(.horizontal, 13).frame(minHeight: 36)
                .background(on ? color : Palette.sunk, in: Capsule())
        }
        .buttonStyle(PressStyle())
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

/// Rangée qui passe à la ligne (pastilles)
struct Flow: Layout {
    var spacing: CGFloat = 8
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let w = proposal.width ?? 320
        var x: CGFloat = 0, y: CGFloat = 0, line: CGFloat = 0, maxX: CGFloat = 0
        for s in subviews {
            let sz = s.sizeThatFits(.unspecified)
            if x > 0 && x + sz.width > w { x = 0; y += line + spacing; line = 0 }
            x += sz.width + spacing; line = max(line, sz.height); maxX = max(maxX, x)
        }
        return CGSize(width: proposal.width ?? maxX, height: y + line)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, line: CGFloat = 0
        for s in subviews {
            let sz = s.sizeThatFits(.unspecified)
            if x > bounds.minX && x + sz.width > bounds.maxX { x = bounds.minX; y += line + spacing; line = 0 }
            s.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(sz))
            x += sz.width + spacing; line = max(line, sz.height)
        }
    }
}

// MARK: messages brefs

@Observable
final class Toasts {
    static let shared = Toasts()
    var text: String?
    @ObservationIgnored private var task: Task<Void, Never>?
    func show(_ t: String) {
        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { text = t }
        task?.cancel()
        task = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 2_200_000_000)
            if Task.isCancelled { return }
            withAnimation(.easeOut(duration: 0.25)) { self.text = nil }
        }
    }
}
func toast(_ t: String) { Toasts.shared.show(t) }

struct ToastOverlay: View {
    var body: some View {
        VStack {
            Spacer()
            if let t = Toasts.shared.text {
                Text(t).font(Typo.sans(15, .semibold)).foregroundStyle(Palette.bg)
                    .padding(.horizontal, 18).padding(.vertical, 12)
                    .background(Palette.ink, in: Capsule())
                    .padding(.bottom, 96)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .allowsHitTesting(false)
    }
}

/// Champ de saisie au style de l'appli
struct FieldBox<Content: View>: View {
    let label: String
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(Typo.sans(13.5, .medium)).foregroundStyle(Palette.muted)
            content
                .font(Typo.sans(17))
                .padding(.horizontal, 14).frame(minHeight: 48)
                .background(Palette.sunk, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }
}
