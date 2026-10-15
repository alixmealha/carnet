import SwiftUI

/// Le plan semaine par semaine ; un jour s'ouvre avec sa fiche complète (forme, séance, après la séance)
struct PlanListView: View {
    @State private var store = Store.shared
    @State private var scrolled = false

    var body: some View {
        let pr = PlanReader(store), t = D.today
        let weeks = weekStarts(pr, t)
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        VStack(alignment: .leading, spacing: 0) {
                            Eyebrow(pr.meta?["title"]?.string ?? "Ton plan")
                            DisplayTitle("Plan", size: 52)
                        }
                        .padding(.top, 8)
                        if pr.meta == nil && !store.demo { EmptyPlanCard() }
                        ForEach(weeks, id: \.self) { mon in
                            WeekSection(mon: mon).id(mon)
                        }
                    }
                    .padding(.horizontal, 16).padding(.bottom, 30)
                }
                .scrollIndicators(.hidden)
                .background(Palette.bg)
                .onAppear {
                    guard !scrolled else { return }
                    scrolled = true
                    DispatchQueue.main.async { proxy.scrollTo(D.monday(t), anchor: .top) }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: String.self) { k in DayDetail(k: k) }
        }
    }

    private func weekStarts(_ pr: PlanReader, _ t: String) -> [String] {
        let ws = pr.weeks()
        var a = D.monday(D.add(t, -14)), b = D.monday(D.add(t, 28))
        if let f = ws.first?.start, !f.isEmpty { a = min(a, D.monday(f)) }
        if let l = ws.last?.end, !l.isEmpty { b = max(b, D.monday(l)) }
        var out: [String] = [], k = a
        while k <= b && out.count < 80 { out.append(k); k = D.add(k, 7) }
        return out
    }
}

struct WeekSection: View {
    let mon: String
    @State private var store = Store.shared
    var body: some View {
        let pr = PlanReader(store), w = pr.week(mon) ?? pr.week(D.add(mon, 6)), t = D.today
        let days = (0..<7).map { D.add(mon, $0) }
        let current = t >= mon && t <= days[6]
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text((w?.label ?? "Semaine").uppercased()).font(Typo.display(22)).foregroundStyle(current ? Palette.accent : Palette.ink)
                if let w, !w.phaseLabel.isEmpty { Pill(w.phaseLabel, color: current ? Palette.accent : Palette.muted) }
                Spacer()
                Text(D.rangeTxt(days[0], days[6])).font(Typo.sans(13)).foregroundStyle(Palette.muted)
            }
            VStack(spacing: 0) {
                ForEach(days, id: \.self) { k in
                    NavigationLink(value: k) { DayRow(k: k, today: k == t) }
                        .buttonStyle(.plain)
                    if k != days[6] { Rectangle().fill(Palette.rule.opacity(0.5)).frame(height: 0.5).padding(.leading, 62) }
                }
            }
            .background(Palette.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(current ? Palette.accent.opacity(0.5) : Palette.rule.opacity(0.6), lineWidth: current ? 1.2 : 0.5))
        }
    }
}

struct DayRow: View {
    let k: String, today: Bool
    @State private var store = Store.shared
    var body: some View {
        let pr = PlanReader(store), e = store.journal(k), kinds = pr.kinds(k), st = e["status"]?.string
        let has = !kinds.isEmpty, ev = pr.eventOn(k)
        HStack(spacing: 12) {
            VStack(spacing: -2) {
                Text(D.dow3[D.dow(k)].uppercased()).font(Typo.mono(10.5, .medium)).foregroundStyle(today ? Palette.accent : Palette.muted)
                Text("\(D.dom(k))").font(Typo.display(26)).foregroundStyle(today ? Palette.accent : Palette.ink)
            }
            .frame(width: 40)
            VStack(alignment: .leading, spacing: 3) {
                rich(has ? pr.sessionName(k) : "Repos").font(Typo.sans(15, has ? .semibold : .regular)).foregroundStyle(has ? Palette.ink : Palette.muted).lineLimit(2)
                HStack(spacing: 4) {
                    ForEach(kinds.prefix(4), id: \.self) { kd in Capsule().fill(Palette.kind(kd)).frame(width: 14, height: 4) }
                    if let ev { Text(ev).font(Typo.sans(12, .semibold)).foregroundStyle(Palette.oil).lineLimit(1) }
                }
            }
            Spacer(minLength: 4)
            if let st {
                Image(systemName: st == "faite" ? "checkmark.circle.fill" : st == "adaptee" ? "circle.lefthalf.filled" : "xmark.circle.fill")
                    .font(.system(size: 18)).foregroundStyle(st == "sautee" ? Palette.crit : st == "adaptee" ? Palette.warn : Palette.good)
            } else if let sc = Rules.score(e) {
                Text("\(sc)").font(Typo.mono(13, .semibold)).foregroundStyle(Palette.level(Rules.verdict(sc, store).cls))
            }
            Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Palette.muted.opacity(0.6))
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .contentShape(Rectangle())
    }
}

struct DayDetail: View {
    let k: String
    @State private var sel: String
    init(k: String) { self.k = k; _sel = State(initialValue: k) }
    var body: some View {
        ScrollView {
            DayContent(k: sel, hero: false)
                .id(sel)
                .padding(.horizontal, 16).padding(.bottom, 40)
        }
        .background(Palette.bg)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button { Haptics.tap(); withAnimation { sel = D.add(sel, -1) } } label: { Image(systemName: "chevron.left") }.accessibilityLabel("Jour précédent")
                Button { Haptics.tap(); withAnimation { sel = D.add(sel, 1) } } label: { Image(systemName: "chevron.right") }.accessibilityLabel("Jour suivant")
            }
        }
    }
}
