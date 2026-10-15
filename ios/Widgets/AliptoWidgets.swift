import SwiftUI
import WidgetKit
import ActivityKit

// Widgets d'Alipto : la journée (forme, séance, échéance) sur l'écran d'accueil et l'écran verrouillé,
// et le minuteur de repos en Live Activity (écran verrouillé et Dynamic Island).

@main
struct AliptoWidgets: WidgetBundle {
    var body: some Widget {
        TodayWidget()
        CountdownWidget()
        RestLiveActivity()
    }
}

// MARK: données

struct DayEntry: TimelineEntry {
    let date: Date
    let s: WidgetSnapshot
}

struct DayProvider: TimelineProvider {
    func placeholder(in context: Context) -> DayEntry { DayEntry(date: Date(), s: .sample) }
    func getSnapshot(in context: Context, completion: @escaping (DayEntry) -> Void) {
        completion(DayEntry(date: Date(), s: context.isPreview ? .sample : WidgetSnapshot.read()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<DayEntry>) -> Void) {
        let s = WidgetSnapshot.read()
        // nouvelle journée à minuit : le widget se recharge (l'appli le remet à jour dès qu'elle s'ouvre)
        let midnight = Calendar.current.startOfDay(for: Date().addingTimeInterval(86400))
        completion(Timeline(entries: [DayEntry(date: Date(), s: s)], policy: .after(midnight)))
    }
}

extension WidgetSnapshot {
    static let sample: WidgetSnapshot = {
        var s = WidgetSnapshot()
        s.day = "2026-10-16"; s.score = 19; s.verdict = "Correct"; s.level = "ok"; s.session = "Force · tirage et doigts"
        s.kinds = ["muscu", "doigts"]; s.done = 2; s.total = 7; s.event = "Contest"; s.eventDays = 23; s.weekDone = 2; s.weekPlanned = 5
        return s
    }()
    /// La photo date d'un autre jour : on n'affiche plus la forme ni la progression
    var isToday: Bool {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        return day == String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
}

private func levelColor(_ l: String?) -> Color {
    switch l { case "good", "ok": return Palette.good; case "warn": return Palette.warn; case "crit": return Palette.crit; default: return Palette.muted }
}

// MARK: widget « Aujourd'hui »

struct TodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "today", provider: DayProvider()) { e in
            TodayWidgetView(s: e.s).containerBackground(for: .widget) { Palette.surface }
        }
        .configurationDisplayName("Aujourd’hui")
        .description("Ta forme du matin, la séance du jour et ta semaine.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

struct TodayWidgetView: View {
    let s: WidgetSnapshot
    @Environment(\.widgetFamily) private var family
    var body: some View {
        let today = s.isToday, score = today ? s.score : nil
        switch family {
        case .accessoryCircular:
            Gauge(value: Double(score ?? 0), in: 0...25) {
                Text("Forme")
            } currentValueLabel: {
                Text(score.map { "\($0)" } ?? "?").font(.system(size: 18, weight: .bold, design: .rounded))
            }
            .gaugeStyle(.accessoryCircularCapacity)
            .widgetAccentable()
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Text(score.map { "Forme \($0)/25" } ?? "Forme à noter").font(.system(size: 12, weight: .semibold)).widgetAccentable()
                Text(s.session).font(.system(size: 15, weight: .bold)).lineLimit(1)
                if today, s.total > 0 { Text("\(s.done)/\(s.total) fait").font(.system(size: 12)) }
                else if let e = s.event, let d = s.eventDays, d > 0 { Text("J−\(d) · " + e).font(.system(size: 12)).lineLimit(1) }
            }
        case .accessoryInline:
            Text(s.session + (score.map { " · forme \($0)" } ?? ""))
        case .systemMedium:
            HStack(spacing: 14) {
                ring(score)
                VStack(alignment: .leading, spacing: 4) {
                    Text("AUJOURD’HUI").font(Typo.mono(10.5, .medium)).foregroundStyle(Palette.muted)
                    Text(s.session).font(Typo.sans(17, .semibold)).foregroundStyle(Palette.ink).lineLimit(2)
                    if today, s.total > 0 { Text("\(s.done)/\(s.total) fait").font(Typo.sans(12.5)).foregroundStyle(Palette.muted) }
                    if let r = s.reading, today { Text(r).font(Typo.sans(12)).foregroundStyle(levelColor(s.level)).lineLimit(2) }
                    Spacer(minLength: 0)
                    HStack(spacing: 4) {
                        ForEach(s.kinds.prefix(4), id: \.self) { k in Capsule().fill(Palette.kind(k)).frame(width: 16, height: 4) }
                        Spacer()
                        if let e = s.event, let d = s.eventDays, d > 0 {
                            Text("J−\(d)").font(Typo.display(18)).foregroundStyle(Palette.oil)
                            Text(e).font(Typo.sans(11)).foregroundStyle(Palette.muted).lineLimit(1)
                        }
                    }
                }
            }
        default:
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    ring(score).frame(width: 52, height: 52)
                    Spacer()
                    if let d = s.eventDays, d > 0 {
                        VStack(alignment: .trailing, spacing: -2) {
                            Text("J−\(d)").font(Typo.display(20)).foregroundStyle(Palette.oil)
                            Text(s.event ?? "").font(Typo.sans(9.5)).foregroundStyle(Palette.muted).lineLimit(1)
                        }
                    }
                }
                Spacer(minLength: 0)
                Text(s.session).font(Typo.sans(14, .semibold)).foregroundStyle(Palette.ink).lineLimit(2)
                if today && s.total > 0 { Text("\(s.done)/\(s.total) fait").font(Typo.sans(11.5)).foregroundStyle(Palette.muted) }
                else if s.weekPlanned > 0 { Text("Semaine \(s.weekDone)/\(s.weekPlanned)").font(Typo.sans(11.5)).foregroundStyle(Palette.muted) }
            }
        }
    }
    private func ring(_ score: Int?) -> some View {
        ZStack {
            Circle().stroke(Palette.sunk, lineWidth: 6)
            Circle().trim(from: 0, to: Double(score ?? 0) / 25).stroke(levelColor(s.level), style: StrokeStyle(lineWidth: 6, lineCap: .round)).rotationEffect(.degrees(-90))
            VStack(spacing: -3) {
                Text(score.map { "\($0)" } ?? "?").font(Typo.display(22)).foregroundStyle(Palette.ink)
                Text(score == nil ? "forme" : "/25").font(Typo.mono(8.5)).foregroundStyle(Palette.muted)
            }
        }
        .frame(width: 62, height: 62)
    }
}

// MARK: widget « Compte à rebours »

struct CountdownWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "countdown", provider: DayProvider()) { e in
            CountdownView(s: e.s).containerBackground(for: .widget) { Color(hex: 0x15191e) }
        }
        .configurationDisplayName("Compte à rebours")
        .description("Les jours avant ta prochaine compétition ou ton objectif.")
        .supportedFamilies([.systemSmall, .accessoryCircular])
    }
}
struct CountdownView: View {
    let s: WidgetSnapshot
    @Environment(\.widgetFamily) private var family
    var body: some View {
        if family == .accessoryCircular {
            VStack(spacing: -2) {
                Text(s.eventDays.map { $0 > 0 ? "J−\($0)" : "J" } ?? "—").font(.system(size: 17, weight: .heavy, design: .rounded))
                Text(s.event ?? "objectif").font(.system(size: 9)).lineLimit(1)
            }
            .widgetAccentable()
        } else {
            VStack(alignment: .leading, spacing: 4) {
                Text("PROCHAIN OBJECTIF").font(Typo.mono(9.5, .medium)).foregroundStyle(Color.white.opacity(0.6))
                Spacer(minLength: 0)
                if let d = s.eventDays {
                    Text(d > 0 ? "J−\(d)" : "JOUR J").font(Typo.display(48)).foregroundStyle(Color(hex: 0xf2a93b)).minimumScaleFactor(0.6)
                    Text(s.event ?? "").font(Typo.sans(14, .semibold)).foregroundStyle(.white).lineLimit(2)
                } else {
                    Text("Pas d’échéance").font(Typo.sans(15, .semibold)).foregroundStyle(.white)
                    Text("Ajoute une compétition à ton plan.").font(Typo.sans(11.5)).foregroundStyle(Color.white.opacity(0.6))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// MARK: minuteur de repos (Live Activity)

struct RestLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestAttributes.self) { ctx in
            RestLockView(st: ctx.state, title: ctx.attributes.title)
                .activityBackgroundTint(ctx.state.phase == "work" ? Color(hex: 0x1f44c4) : Color(hex: 0x15191e))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { ctx in
            let st = ctx.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(st.phase == "work" ? "Effort" : "Repos", systemImage: st.phase == "work" ? "flame.fill" : "timer")
                        .font(.system(size: 14, weight: .semibold)).foregroundStyle(Color(hex: 0x86a2ff))
                }
                DynamicIslandExpandedRegion(.trailing) {
                    countdown(st).font(.system(size: 30, weight: .heavy, design: .rounded)).foregroundStyle(.white).monospacedDigit()
                        .frame(maxWidth: 110, alignment: .trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(st.label).font(.system(size: 15, weight: .semibold)).foregroundStyle(.white).lineLimit(1)
                        if let n = st.next { Text("Ensuite : " + n).font(.system(size: 13)).foregroundStyle(.white.opacity(0.7)).lineLimit(1) }
                        if !st.paused && st.until > Date() {
                            ProgressView(timerInterval: st.start...st.until, countsDown: true) { EmptyView() } currentValueLabel: { EmptyView() }
                                .tint(Color(hex: 0x86a2ff))
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: st.phase == "work" ? "flame.fill" : "timer").foregroundStyle(Color(hex: 0x86a2ff))
            } compactTrailing: {
                countdown(st).monospacedDigit().font(.system(size: 14, weight: .bold, design: .rounded)).foregroundStyle(.white).frame(maxWidth: 52)
            } minimal: {
                if !st.paused && st.until > Date() {
                    ProgressView(timerInterval: st.start...st.until, countsDown: true) { EmptyView() } currentValueLabel: { Image(systemName: "timer").font(.system(size: 10)) }
                        .progressViewStyle(.circular).tint(Color(hex: 0x86a2ff))
                } else {
                    Image(systemName: "checkmark").foregroundStyle(Color(hex: 0x58c482))
                }
            }
            .keylineTint(Color(hex: 0x86a2ff))
        }
    }
}

@ViewBuilder
private func countdown(_ st: RestAttributes.ContentState) -> some View {
    if st.paused { Text("pause") }
    else if st.until > Date() { Text(timerInterval: Date()...st.until, countsDown: true) }
    else { Text(st.phase == "done" ? "✓" : "Go") }
}

struct RestLockView: View {
    let st: RestAttributes.ContentState
    let title: String
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title.uppercased()).font(Typo.mono(11, .medium)).foregroundStyle(.white.opacity(0.6)).lineLimit(1)
                Spacer()
                Image(systemName: st.phase == "work" ? "flame.fill" : "timer").foregroundStyle(Color(hex: 0x86a2ff))
            }
            HStack(alignment: .firstTextBaseline) {
                countdown(st).font(Typo.display(52)).foregroundStyle(.white).monospacedDigit()
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(st.label).font(Typo.sans(15, .semibold)).foregroundStyle(.white).lineLimit(2).multilineTextAlignment(.trailing)
                    if let n = st.next { Text("Ensuite : " + n).font(Typo.sans(12.5)).foregroundStyle(.white.opacity(0.7)).lineLimit(1) }
                }
            }
            if !st.paused && st.until > Date() {
                ProgressView(timerInterval: st.start...st.until, countsDown: true) { EmptyView() } currentValueLabel: { EmptyView() }
                    .tint(Color(hex: 0x86a2ff))
            }
        }
        .padding(16)
    }
}
