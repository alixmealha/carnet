import SwiftUI

/// Aujourd'hui : l'échéance, la semaine, le résumé du jour (forme, séance, consigne), puis le détail.
struct TodayView: View {
    @State private var store = Store.shared
    @State private var sel = D.today
    @Namespace private var ns

    var body: some View {
        let t = D.today, pr = PlanReader(store), isToday = sel == t
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header(t, pr)
                    if !store.isSelf {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Eyebrow("Carnet de", color: Palette.accent)
                                Text(store.name(store.subject)).font(Typo.sans(17, .semibold)).foregroundStyle(Palette.ink)
                            }
                            Spacer()
                            Button("Revenir au mien") { Haptics.tap(); store.subject = Store.SELF }.buttonStyle(SmallButton())
                        }
                        .padding(12)
                        .background(Palette.accentSoft, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    WeekStrip(sel: $sel, ns: ns)
                    if !isToday {
                        Button { withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { sel = t } } label: {
                            Label("Revenir à aujourd’hui", systemImage: "arrow.uturn.backward")
                        }
                        .buttonStyle(SmallButton())
                        .frame(maxWidth: .infinity)
                        .transition(.opacity)
                    }
                    if pr.meta == nil && !store.demo {
                        EmptyPlanCard()
                    }
                    if isToday && pr.meta != nil { WeekReviewCard() }
                    DayContent(k: sel, hero: isToday)
                        .id(sel)
                        .transition(.asymmetric(insertion: .opacity.combined(with: .offset(y: 8)), removal: .opacity))
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 40)
            }
            .scrollIndicators(.hidden)
            .background(Palette.bg)
            .statusBarScrim()
            .refreshable { await store.syncNow() }
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    @ViewBuilder
    private func header(_ t: String, _ pr: PlanReader) -> some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 0) {
                Eyebrow(D.long(t))
                Text("AUJOURD’HUI").font(Typo.display(54)).foregroundStyle(Palette.ink).minimumScaleFactor(0.7).lineLimit(1)
            }
            Spacer(minLength: 8)
            if let goal = pr.nextEvent(from: t) {
                let left = D.diff(t, goal.date)
                VStack(alignment: .trailing, spacing: 0) {
                    Text(left > 0 ? "J−\(left)" : "Jour J").font(Typo.display(left > 0 ? 34 : 26)).foregroundStyle(Palette.oil)
                    Text(left > 0 ? "avant " + goal.label : goal.label).font(Typo.sans(12.5, .medium)).foregroundStyle(Palette.muted)
                        .multilineTextAlignment(.trailing).lineLimit(2).frame(maxWidth: 130, alignment: .trailing)
                }
                .padding(.bottom, 8)
                .accessibilityElement(children: .combine)
            }
        }
        .padding(.top, 10)
    }
}

/// Pas encore de plan sur ce compte : l'assistant, ou un plan vide
struct EmptyPlanCard: View {
    @State private var builder = false
    var body: some View {
        NoPlanCard { builder = true }
            .sheet(isPresented: $builder) { BuilderView() }
    }
}

// MARK: semaine

struct WeekStrip: View {
    @Binding var sel: String
    var ns: Namespace.ID
    @State private var store = Store.shared

    var body: some View {
        let mon = D.monday(sel), t = D.today, pr = PlanReader(store), w = pr.week(sel)
        let days = (0..<7).map { D.add(mon, $0) }
        VStack(spacing: 8) {
            HStack {
                navButton("chevron.left", "Semaine précédente") { move(-7) }
                Spacer()
                weekLabel(w, days).font(Typo.sans(13.5)).foregroundColor(Palette.muted).lineLimit(1).minimumScaleFactor(0.8)
                Spacer()
                navButton("chevron.right", "Semaine suivante") { move(7) }
            }
            HStack(spacing: 4) {
                ForEach(0..<7, id: \.self) { i in
                    let k = days[i]
                    DayCell(k: k, i: i, today: k == t, selected: k == sel, ns: ns) {
                        Haptics.select()
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { sel = k }
                    }
                }
            }
        }
        .gesture(DragGesture(minimumDistance: 30).onEnded { v in
            if abs(v.translation.width) > abs(v.translation.height) * 1.5 { move(v.translation.width < 0 ? 7 : -7) }
        })
    }
    private func weekLabel(_ w: Week?, _ days: [String]) -> Text {
        let range = Text(D.rangeTxt(days[0], days[6]))
        guard let w else { return range }
        return Text(w.label).font(Typo.sans(13.5, .semibold)).foregroundColor(Palette.ink) + Text(" · " + w.phaseLabel + " · ") + range
    }
    private func move(_ n: Int) {
        Haptics.tap()
        withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { sel = D.add(sel, n) }
    }
    private func navButton(_ icon: String, _ label: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon).font(.system(size: 14, weight: .semibold)).foregroundStyle(Palette.ink)
                .frame(width: 36, height: 32).background(Palette.surface, in: Capsule())
        }
        .accessibilityLabel(label)
    }
}

struct DayCell: View {
    let k: String, i: Int, today: Bool, selected: Bool
    var ns: Namespace.ID
    let action: () -> Void
    @State private var store = Store.shared

    var body: some View {
        let e = store.journal(k), pr = PlanReader(store), sc = Rules.score(e), st = e["status"]?.string
        let kinds = Array(pr.kinds(k).prefix(3)), p = pr.progress(k)
        let mark = st == "faite" ? "✓" : st == "adaptee" ? "~" : st == "sautee" ? "×" : p.done > 0 ? "·" : ""
        Button(action: action) {
            VStack(spacing: 3) {
                Text(D.dow1[i]).font(Typo.mono(11, .medium)).foregroundStyle(selected ? Palette.accentInk.opacity(0.8) : Palette.muted)
                Text("\(D.dom(k))").font(Typo.display(24)).foregroundStyle(selected ? Palette.accentInk : today ? Palette.accent : Palette.ink)
                HStack(spacing: 2) {
                    ForEach(kinds, id: \.self) { kd in Capsule().fill(Palette.kind(kd)).frame(width: 9, height: 3.5) }
                }
                .frame(height: 4)
                .overlay { if selected && !kinds.isEmpty { Capsule().stroke(Palette.accentInk.opacity(0.5), lineWidth: 0.5) } }
                Group {
                    if !mark.isEmpty { Text(mark).foregroundStyle(selected ? Palette.accentInk : st == "sautee" ? Palette.crit : Palette.good) }
                    else if let sc { Text("\(sc)").foregroundStyle(selected ? Palette.accentInk : Palette.level(Rules.verdict(sc, store).cls)) }
                    else { Text(" ") }
                }
                .font(Typo.mono(11.5, .semibold)).frame(height: 14)
            }
            .frame(maxWidth: .infinity).padding(.vertical, 8)
            .background {
                if selected { RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Palette.accent).matchedGeometryEffect(id: "sel", in: ns) }
                else { RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Palette.surface.opacity(today ? 1 : 0.55)) }
            }
            .overlay {
                if PlanReader(store).eventOn(k) != nil { RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Palette.oil, lineWidth: 1.5) }
            }
        }
        .buttonStyle(PressStyle())
        .accessibilityLabel(D.long(k))
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

// MARK: le jour

/// Contenu d'un jour : résumé (aujourd'hui), forme du matin, lecture, séance, après la séance
struct DayContent: View {
    let k: String
    var hero = false
    @State private var store = Store.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if !hero { DayTitle(k: k) }
            if hero && PlanReader(store).meta != nil { HeroCard(k: k) }
            MorningCard(k: k)
            NightCard(k: k)
            ReadingCard(k: k)
            SessionCard(k: k)
            TestsCard(k: k)
            NutriDayCard(k: k)
            ExchangesCard(k: k)
            AfterCard(k: k)
        }
    }
}

struct DayTitle: View {
    let k: String
    @State private var store = Store.shared
    var body: some View {
        let pr = PlanReader(store), w = pr.week(k)
        VStack(alignment: .leading, spacing: 2) {
            Eyebrow(w.map { $0.label + " · " + $0.phaseLabel } ?? "Hors plan")
            DisplayTitle(D.long(k), size: 32)
            if let ev = pr.eventOn(k) { Pill(ev, color: Palette.oil).padding(.top, 4) }
        }
        .padding(.top, 4)
    }
}

/// Le résumé du jour : anneau de forme, séance, feu, bouton pour démarrer, semaine
struct HeroCard: View {
    let k: String
    @State private var store = Store.shared
    @State private var menu = false

    var body: some View {
        let e = store.journal(k), pr = PlanReader(store), sc = Rules.score(e), v = sc.map { Rules.verdict($0, store) }
        let bl = pr.blocks(k), real = bl.filter { !$0.isRest }, p = pr.progress(k)
        let active = e["cancel"] == nil && real.contains { b in !["apart", "moved", "skip"].contains(PlanReader.blockState(e, b) ?? "") }
        let allMoved = !real.isEmpty && real.allSatisfy { PlanReader.blockState(e, $0) == "moved" }
        let reading = sc != nil ? DayReading.of(k, store) : nil
        let adj = Adapt.summary(k, store), d = pr.day(k)
        let cancel = e["cancel"]
        let meta: String = {
            if let c = cancel { return skipLabel(c["r"]?.string) + ((c["note"]?.string).map { " · « " + $0 + " »" } ?? "") }
            var parts: [String] = []
            if let du = d?["duree"]?.string, du != "—" { parts.append(du) }
            if let adj { parts.append(adj.mode == "time" ? "adaptée à \(e["adj"]?["min"]?.int ?? 0) min" : "allégée") }
            if p.total > 0 { parts.append("\(p.done)/\(p.total) fait") }
            return parts.joined(separator: " · ")
        }()
        let tint: Color? = reading.map { Palette.level($0.level) }

        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .center, spacing: 16) {
                ZStack {
                    Ring(value: sc.map { Double($0) }, color: v.map { Palette.level($0.cls) } ?? Palette.muted, lineWidth: 8)
                    VStack(spacing: -2) {
                        Text(sc.map { "\($0)" } ?? "?").font(Typo.display(30)).foregroundStyle(Palette.ink)
                            .contentTransition(.numericText()).animation(.spring, value: sc)
                        Text(sc != nil ? "/25" : "forme").font(Typo.mono(10.5, .medium)).foregroundStyle(Palette.muted)
                    }
                }
                .frame(width: 82, height: 82)
                .accessibilityLabel(sc.map { "Forme \($0) sur 25, " + (v?.label ?? "") } ?? "Forme du matin à remplir")

                VStack(alignment: .leading, spacing: 3) {
                    Eyebrow(cancel != nil ? ((cancel?["started"]?.truthy ?? false) ? "Séance arrêtée" : "Séance annulée") : active ? "Séance du jour" : "Aujourd’hui")
                    rich(allMoved ? "Séance déplacée" : real.isEmpty ? "Repos" : pr.sessionName(k))
                        .font(Typo.sans(21, .semibold)).foregroundStyle(Palette.ink).lineLimit(3)
                    if !meta.isEmpty { Text(meta).font(Typo.sans(14)).foregroundStyle(Palette.muted).lineLimit(2) }
                }
                Spacer(minLength: 0)
                if !real.isEmpty && !allMoved && store.isSelf {
                    Button { Haptics.tap(); menu = true } label: {
                        Image(systemName: "ellipsis").font(.system(size: 17, weight: .bold)).foregroundStyle(Palette.ink)
                            .frame(width: 40, height: 40).background(Palette.sunk, in: Circle())
                    }
                    .accessibilityLabel("Options de la séance")
                }
            }

            if let reading {
                HStack(spacing: 10) {
                    Circle().fill(Palette.level(reading.level)).frame(width: 10, height: 10)
                    Text(reading.head).font(Typo.sans(15, .semibold)).foregroundStyle(Palette.ink)
                }
            } else if store.isSelf {
                HStack(spacing: 10) {
                    Circle().strokeBorder(Palette.muted, lineWidth: 1.5).frame(width: 10, height: 10)
                    Text(active ? "Remplis ta forme du matin : la séance s’ajuste" : "Note ta forme du matin : elle compte aussi les jours sans séance")
                        .font(Typo.sans(15, .medium)).foregroundStyle(Palette.muted)
                }
            }

            if active && store.isSelf {
                Button {
                    Haptics.firm()
                    AppState.shared.session = SessionRef(k: k)
                } label: {
                    Label(e["startedAt"] != nil && e["endedAt"] == nil ? "Reprendre la séance" : p.done > 0 ? "Continuer la séance" : "Démarrer la séance", systemImage: "play.fill")
                }
                .buttonStyle(BigButton())
            }

            WeekDots(k: k)
        }
        .card(padding: 18, tint: tint)
        .onAppear { if Launch.demo && Launch.screen == "menu" { menu = true } }
        .sheet(isPresented: $menu) { SessionMenuSheet(k: k).presentationDetents([.medium, .large]).presentationDragIndicator(.visible) }
    }
}

/// Les séances de la semaine en pastilles : faite, sautée, ratée, à venir
struct WeekDots: View {
    let k: String
    @State private var store = Store.shared
    var body: some View {
        let pr = PlanReader(store), mon = D.monday(k), t = D.today
        let days: [(String, String)] = (0..<7).map { i in
            let d = D.add(mon, i), act = pr.blocks(d).contains { !$0.isRest }, st = store.journal(d)["status"]?.string
            let ok = st == "faite" || st == "adaptee"
            return (d, act ? (ok ? "ok" : st == "sautee" ? "ko" : d < t ? "miss" : "todo") : "off")
        }
        let planned = days.filter { $0.1 != "off" }.count, done = days.filter { $0.1 == "ok" }.count
        if planned > 0 {
            HStack(spacing: 10) {
                Text("Cette semaine").font(Typo.sans(13.5)).foregroundStyle(Palette.muted)
                HStack(spacing: 5) {
                    ForEach(0..<days.count, id: \.self) { j in
                        let d = days[j]
                        let c: Color = d.1 == "ok" ? Palette.good : d.1 == "ko" ? Palette.crit : d.1 == "miss" ? Palette.warn : Palette.sunk
                        Group {
                            if d.1 == "off" { Circle().strokeBorder(Palette.rule, lineWidth: 1) }
                            else if d.1 == "todo" { Circle().fill(Palette.sunk).overlay(Circle().strokeBorder(Palette.muted.opacity(0.4), lineWidth: 1)) }
                            else { Circle().fill(c) }
                        }
                        .frame(width: 11, height: 11)
                        .overlay { if d.0 == t { Circle().stroke(Palette.ink, lineWidth: 1).frame(width: 16, height: 16) } }
                    }
                }
                Spacer()
                Text("\(done)/\(planned)").font(Typo.mono(14, .semibold)).foregroundStyle(Palette.ink)
            }
            .padding(.top, 2)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Semaine : \(done) séances faites sur \(planned)")
        }
    }
}
