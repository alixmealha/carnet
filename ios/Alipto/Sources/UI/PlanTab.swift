import SwiftUI

// Onglet Plan : le calendrier (jour par jour) et le programme (blocs, semaines, repères), comme la version web.

/// Couleur d'une phase (barres de la frise, calendrier)
func phaseColor(_ p: String) -> Color {
    switch p {
    case "volume", "reprise": return Palette.z1
    case "puissance", "specifique": return Palette.z3
    case "affutage": return Palette.kind("affut")
    case "recup", "deload", "transition", "coupure": return Palette.sunk
    default: return Palette.z2
    }
}
let PHASES = ["volume", "reprise", "force", "puissance", "specifique", "affutage", "recup", "deload", "transition", "coupure", "autre"]
let KIND_ORDER = ["grimpe", "doigts", "muscu", "renfo", "epaule", "kine", "velo", "course", "sport", "test", "compet", "affut", "recup", "autre", "rest"]

/// Ce qu'ouvre l'onglet Plan par-dessus l'écran
enum PlanSheet: Identifiable {
    case settings, week(String), day(String), bloc(Int), section(Int), exercise(JSON), builder
    var id: String {
        switch self {
        case .settings: return "settings"
        case .week(let w): return "w" + w
        case .day(let k): return "d" + k
        case .bloc(let i): return "b\(i)"
        case .section(let i): return "s\(i)"
        case .exercise(let x): return "x" + (x["label"]?.string ?? "")
        case .builder: return "builder"
        }
    }
}

struct PlanTabView: View {
    @State private var store = Store.shared
    @AppStorage("plan-view") private var view = "cal"
    @State private var sheet: PlanSheet?
    @State private var scrolled = false

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        PlanHeader(view: view, sheet: $sheet)
                        content
                    }
                    .padding(.horizontal, 16).padding(.bottom, 40)
                }
                .scrollIndicators(.hidden)
                .background(Palette.bg)
                .statusBarScrim()
                .onAppear {
                    scrollToWeek(proxy)
                    if Launch.screen == "builder" && sheet == nil { sheet = .builder }
                    if Launch.screen == "dayedit" && sheet == nil { sheet = .day(D.today) }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: String.self) { k in DayDetail(k: k) }
            .sheet(item: $sheet) { s in PlanSheetView(sheet: s) }
        }
    }

    @ViewBuilder private var content: some View {
        if store.get("plan") == nil {
            NoPlanCard { sheet = .builder }
        } else {
            Segmented(options: [("cal", "Calendrier"), ("prog", "Programme")], value: view) { v in
                guard let v, v != view else { return }
                withAnimation(.spring(response: 0.42, dampingFraction: 0.86)) { view = v }
            }
            if view == "prog" {
                ProgrammeView(sheet: $sheet)
                    .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity), removal: .opacity))
            } else {
                CalendarGrid()
                    .transition(.asymmetric(insertion: .move(edge: .leading).combined(with: .opacity), removal: .opacity))
            }
        }
    }

    private func scrollToWeek(_ proxy: ScrollViewProxy) {
        guard !scrolled, view == "cal" else { return }
        scrolled = true
        let ws = PlanReader(store).weeks()
        let t = D.today
        guard let i = ws.firstIndex(where: { t >= $0.start && t <= $0.end }), i > 2 else { return }
        DispatchQueue.main.async { proxy.scrollTo("cal-" + ws[i].start, anchor: .center) }
    }
}

/// En-tête : nom du plan, assistant, réglages
private struct PlanHeader: View {
    let view: String
    @Binding var sheet: PlanSheet?
    @State private var store = Store.shared
    var body: some View {
        let m = store.get("plan")
        HStack(alignment: .bottom, spacing: 10) {
            VStack(alignment: .leading, spacing: 0) {
                Eyebrow(eyebrow(m))
                DisplayTitle("Plan", size: 52)
            }
            Spacer(minLength: 0)
            if m != nil && store.canEditPlan {
                RoundIcon(icon: "wand.and.stars", label: "Assistant de programme") { sheet = .builder }
                if view == "prog" { RoundIcon(icon: "slider.horizontal.3", label: "Réglages du plan") { sheet = .settings } }
            }
        }
        .padding(.top, 8)
    }
    private func eyebrow(_ m: JSON?) -> String {
        guard let m else { return "Ton plan" }
        let title = m["title"]?.string ?? "Plan"
        if view == "prog" {
            if !store.isSelf { return "Plan de " + store.name(store.subject) }
            if let g = m["goal"], let l = g["label"]?.string, let d = g["date"]?.string { return l + " · " + D.short(d) }
            return title
        }
        let ws = PlanReader(store).weeks()
        guard let a = ws.first, let b = ws.last else { return title }
        return title + " · " + a.label + " à " + b.label
    }
}

struct RoundIcon: View {
    let icon: String
    let label: String
    let action: () -> Void
    var body: some View {
        Button { Haptics.tap(); action() } label: {
            Image(systemName: icon).font(.system(size: 16, weight: .semibold)).foregroundStyle(Palette.ink)
                .frame(width: 42, height: 42).background(Palette.surface, in: Circle())
                .overlay(Circle().strokeBorder(Palette.rule.opacity(0.6), lineWidth: 0.5))
        }
        .buttonStyle(PressStyle())
        .accessibilityLabel(label)
    }
}

/// Pas encore de plan : l'assistant, ou un plan vide à remplir
struct NoPlanCard: View {
    let onBuilder: () -> Void
    @State private var store = Store.shared
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            CardHeader("Pas encore de plan")
            if store.planLocked {
                Text("Ton coach prépare ton plan : il apparaîtra ici tout seul.").font(Typo.sans(15)).foregroundStyle(Palette.muted)
            } else {
                Text("L’assistant écrit un programme complet d’après ton objectif, tes jours et ton matériel. Tu peux aussi partir d’un plan vide de 12 semaines et le remplir jour par jour.")
                    .font(Typo.sans(15)).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
                Button { onBuilder() } label: { Label("Créer mon programme", systemImage: "wand.and.stars") }.buttonStyle(BigButton())
                Button("Commencer avec un plan vide") {
                    Core.shared.call("plan.newPlan")
                    Haptics.success(); toast("Plan vide créé")
                }
                .buttonStyle(BigButton(kind: .plain))
            }
        }
        .card()
    }
}

// MARK: calendrier

private struct WeekGroup { let phase: String; let bloc: String; var weeks: [Week] }

private func groupWeeks(_ ws: [Week]) -> [WeekGroup] {
    var out: [WeekGroup] = []
    for w in ws {
        if var g = out.last, g.phase == w.phase, g.bloc == (w.bloc ?? "") {
            g.weeks.append(w); out[out.count - 1] = g
        } else {
            out.append(WeekGroup(phase: w.phase, bloc: w.bloc ?? "", weeks: [w]))
        }
    }
    return out
}

struct CalendarGrid: View {
    @State private var store = Store.shared
    var body: some View {
        let ws = PlanReader(store).weeks()
        let groups = groupWeeks(ws)
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 4) {
                Color.clear.frame(width: 26, height: 1)
                ForEach(0..<7, id: \.self) { i in
                    Text(D.dow1[i]).font(Typo.mono(11, .medium)).foregroundStyle(Palette.muted).frame(maxWidth: .infinity)
                }
            }
            ForEach(groups.indices, id: \.self) { gi in
                CalGroupView(g: groups[gi], first: gi == 0, planStart: ws.first?.start ?? "")
            }
            CalLegend().padding(.top, 10)
        }
        .card(padding: 12)
    }
}

private struct CalGroupView: View {
    let g: WeekGroup
    let first: Bool
    let planStart: String
    var body: some View {
        let a = g.weeks[0], z = g.weeks[g.weeks.count - 1]
        let rest = ["deload", "transition", "recup", "coupure"].contains(g.phase)
        VStack(alignment: .leading, spacing: 5) {
            VStack(alignment: .leading, spacing: 1) {
                Text(PHASE_LABEL[g.phase] ?? g.bloc).font(Typo.sans(14, .semibold)).foregroundStyle(rest ? Palette.muted : Palette.ink)
                Text(range(a, z)).font(Typo.mono(11)).foregroundStyle(Palette.muted)
            }
            .padding(.top, first ? 4 : 12).padding(.bottom, 2)
            ForEach(g.weeks.indices, id: \.self) { i in
                CalWeekRow(w: g.weeks[i], planStart: planStart).id("cal-" + g.weeks[i].start)
            }
        }
    }
    private func range(_ a: Week, _ z: Week) -> String {
        let lbl = a.start == z.start ? a.label : a.label + "–" + z.label
        return lbl + " · " + D.day(a.start) + " → " + D.day(z.end)
    }
}

private struct CalWeekRow: View {
    let w: Week
    let planStart: String
    var body: some View {
        let mon = D.monday(w.start)
        HStack(spacing: 4) {
            Text(w.label).font(Typo.mono(10.5, .medium)).foregroundStyle(Palette.muted).frame(width: 26, alignment: .leading).lineLimit(1).minimumScaleFactor(0.7)
            ForEach(0..<7, id: \.self) { i in
                let k = D.add(mon, i)
                if k < w.start || k > w.end {
                    Color.clear.frame(maxWidth: .infinity, minHeight: 60)
                } else {
                    NavigationLink(value: k) { CalCell(k: k, planStart: planStart) }
                        .buttonStyle(PressStyle())
                        .simultaneousGesture(TapGesture().onEnded { Haptics.tap() })
                }
            }
        }
    }
}

private struct CalCell: View {
    let k: String
    let planStart: String
    @State private var store = Store.shared
    var body: some View {
        let pr = PlanReader(store), e = store.journal(k), t = D.today
        let sc = Rules.score(e), st = e["status"]?.string
        let kinds = pr.kinds(k), ev = pr.eventOn(k) != nil
        let isToday = k == t, past = k < t, logged = st != nil || sc != nil
        VStack(alignment: .leading, spacing: 4) {
            dayNumber(isToday)
            HStack(spacing: 2) {
                ForEach(kinds.prefix(3), id: \.self) { kd in Capsule().fill(Palette.kind(kd)).frame(height: 4) }
            }
            .frame(height: 4)
            Spacer(minLength: 0)
            HStack(spacing: 0) {
                if let sc { Text("\(sc)").font(Typo.mono(10.5, .semibold)).foregroundStyle(Palette.level(Rules.verdict(sc, store).cls)) }
                Spacer(minLength: 0)
                Text(sign(st)).font(Typo.mono(11, .bold)).foregroundStyle(signColor(st))
            }
        }
        .padding(5)
        .frame(maxWidth: .infinity, minHeight: 60, alignment: .topLeading)
        .background(isToday ? Palette.accentSoft : Palette.sunk.opacity(past ? 0.45 : 0.8), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 9, style: .continuous).strokeBorder(border(isToday, ev), lineWidth: isToday || ev ? 1.4 : 0))
        .opacity(past && !logged ? 0.6 : 1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(D.long(k) + " : " + (kinds.isEmpty ? "repos" : pr.sessionName(k)))
    }
    private func dayNumber(_ today: Bool) -> some View {
        let showMonth = D.dom(k) == 1 || k == planStart
        return HStack(alignment: .firstTextBaseline, spacing: 2) {
            Text("\(D.dom(k))").font(Typo.mono(12.5, .semibold)).foregroundStyle(today ? Palette.accent : Palette.ink)
            if showMonth { Text(D.monS[D.mon(k)].replacingOccurrences(of: ".", with: "")).font(Typo.sans(8.5, .medium)).foregroundStyle(Palette.muted).lineLimit(1) }
        }
    }
    private func border(_ today: Bool, _ ev: Bool) -> Color { today ? Palette.accent : ev ? Palette.kind("compet") : .clear }
    private func sign(_ st: String?) -> String {
        switch st { case "faite": return "✓"; case "adaptee": return "~"; case "sautee": return "×"; default: return "" }
    }
    private func signColor(_ st: String?) -> Color {
        switch st { case "faite": return Palette.good; case "adaptee": return Palette.warn; case "sautee": return Palette.crit; default: return Palette.muted }
    }
}

private struct CalLegend: View {
    @State private var store = Store.shared
    var body: some View {
        let kinds = usedKinds(), hasEv = !(store.get("plan")?["events"]?.array ?? []).isEmpty
        VStack(alignment: .leading, spacing: 8) {
            Rectangle().fill(Palette.rule.opacity(0.6)).frame(height: 0.5)
            Flow(spacing: 10) {
                ForEach(kinds, id: \.self) { kd in legendItem(Palette.kind(kd), KIND[kd] ?? kd) }
                if hasEv { legendItem(Palette.kind("compet"), "Compétition", round: true) }
            }
            Text("Chiffre = forme /25 · ✓ faite · ~ adaptée · × sautée").font(Typo.sans(12)).foregroundStyle(Palette.muted)
        }
    }
    private func legendItem(_ c: Color, _ l: String, round: Bool = false) -> some View {
        HStack(spacing: 5) {
            RoundedRectangle(cornerRadius: round ? 5 : 2).fill(c).frame(width: 10, height: 10)
            Text(l).font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
        }
    }
    private func usedKinds() -> [String] {
        var seen = Set<String>()
        let pr = PlanReader(store)
        for id in store.ids("p:") {
            for b in pr.rawBlocks(String(id.dropFirst(2))) {
                if let kd = b["kind"]?.string, kd != "rest" { seen.insert(kd) }
            }
        }
        return KIND_ORDER.filter { seen.contains($0) }
    }
}

// MARK: programme

struct ProgrammeView: View {
    @Binding var sheet: PlanSheet?
    @State private var store = Store.shared
    var body: some View {
        let m = store.get("plan") ?? .emptyObject
        let ed = store.canEditPlan
        VStack(alignment: .leading, spacing: 14) {
            if !ed { LockNote() }
            if !store.isSelf && store.athletes.contains(store.subject) { LockToggleCard() }
            EditedLine(m: m)
            if ed { BuilderEntryCard { sheet = .builder } }
            TimelineCard(m: m) { w in if ed { sheet = .week(w.raw["id"]?.string ?? "") } }
            EventsCard(m: m)
            BlocsList(m: m, ed: ed, sheet: $sheet)
            WeeksCard(m: m, ed: ed) { w in sheet = .week(w.raw["id"]?.string ?? "") }
            PlanExercisesCard(ed: ed) { x in sheet = .exercise(x) }
            SectionsList(m: m, ed: ed, sheet: $sheet)
        }
    }
}

private struct LockNote: View {
    var body: some View {
        Label("Plan verrouillé par ton coach : tu le consultes, lui seul le modifie.", systemImage: "lock.fill")
            .font(Typo.sans(14)).foregroundStyle(Palette.muted)
            .padding(12).frame(maxWidth: .infinity, alignment: .leading)
            .background(Palette.sunk, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

private struct LockToggleCard: View {
    @State private var store = Store.shared
    @State private var busy = false
    var body: some View {
        let a = store.subject, name = store.name(a), on = store.locks[a] ?? false
        Toggle(isOn: Binding(get: { on }, set: { v in set(a, v) })) {
            VStack(alignment: .leading, spacing: 3) {
                Label("Verrouiller le plan", systemImage: "lock.fill").font(Typo.sans(16, .semibold)).foregroundStyle(Palette.ink)
                Text(on ? name + " ne peut plus modifier ses séances ni son plan." : name + " peut aussi modifier ses séances.")
                    .font(Typo.sans(13.5)).foregroundStyle(Palette.muted)
            }
        }
        .tint(Palette.accent)
        .disabled(busy)
        .card()
    }
    private func set(_ a: String, _ v: Bool) {
        busy = true
        Task { @MainActor in
            do { try await store.setLock(a, v); Haptics.success(); toast(v ? "Plan verrouillé" : "Plan déverrouillé") }
            catch { toast(error.localizedDescription) }
            busy = false
        }
    }
}

private struct EditedLine: View {
    let m: JSON
    @State private var store = Store.shared
    var body: some View {
        if let ed = m["edited"], let uid = ed["uid"]?.string, uid != store.me {
            Text(line(ed)).font(Typo.sans(13)).foregroundStyle(Palette.muted)
        }
    }
    private func line(_ ed: JSON) -> String {
        var who: String = ed["name"]?.string ?? ""
        if who.isEmpty { who = "ton coach" }
        return "Plan modifié par " + who + " · " + when(ed["at"]?.double)
    }
    private func when(_ ms: Double?) -> String {
        guard let ms else { return "" }
        return D.day(D.key(Date(timeIntervalSince1970: ms / 1000)))
    }
}

struct BuilderEntryCard: View {
    let action: () -> Void
    var body: some View {
        Button { Haptics.tap(); action() } label: {
            HStack(spacing: 14) {
                Image(systemName: "wand.and.stars").font(.system(size: 20, weight: .semibold)).foregroundStyle(Palette.accent)
                    .frame(width: 44, height: 44).background(Palette.accentSoft, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Assistant de programme").font(Typo.sans(16, .semibold)).foregroundStyle(Palette.ink)
                    Text("Objectif, filières, exercices, repos et progression, écrits dans ton plan").font(Typo.sans(13)).foregroundStyle(Palette.muted).multilineTextAlignment(.leading)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Palette.muted.opacity(0.6))
            }
            .card(padding: 14)
        }
        .buttonStyle(PressStyle())
    }
}

/// Frise des semaines, colorées par phase
private struct TimelineCard: View {
    let m: JSON
    let onWeek: (Week) -> Void
    @State private var store = Store.shared
    var body: some View {
        let ws = PlanReader(store).weeks()
        VStack(alignment: .leading, spacing: 10) {
            CardHeader("Les \(ws.count) semaines") {
                Text(span()).font(Typo.mono(12)).foregroundStyle(Palette.muted)
            }
            if !ws.isEmpty {
                TimelineNames(ws: ws)
                TimelineBars(ws: ws, m: m, onWeek: onWeek)
                TimelineLegend(ws: ws, m: m)
            }
        }
        .card()
    }
}

extension TimelineCard {
    fileprivate func span() -> String {
        let a: String = m["start"]?.string ?? "", b: String = m["end"]?.string ?? ""
        return D.day(a) + " → " + D.day(b)
    }
}

private struct TimelineNames: View {
    let ws: [Week]
    var body: some View {
        let groups = groupWeeks(ws), n = CGFloat(ws.count)
        GeometryReader { geo in
            let unit = geo.size.width / max(1, n)
            HStack(spacing: 0) {
                ForEach(groups.indices, id: \.self) { i in
                    let g = groups[i]
                    Text(name(g)).font(Typo.sans(11, .semibold)).foregroundStyle(Palette.muted).lineLimit(1).minimumScaleFactor(0.7)
                        .frame(width: unit * CGFloat(g.weeks.count), alignment: .leading)
                }
            }
        }
        .frame(height: 14)
    }
    private func name(_ g: WeekGroup) -> String {
        let short = ["volume": "Vol.", "reprise": "Rep.", "force": "Force", "puissance": "Puiss.", "specifique": "Spéc.", "affutage": "Affût.", "recup": "Récup.", "deload": "Déch.", "transition": "Trans.", "coupure": "Coup.", "autre": "Cycle"]
        if g.weeks.count >= 4 { return PHASE_LABEL[g.phase] ?? g.bloc }
        if g.weeks.count >= 2 { return short[g.phase] ?? g.bloc }
        return ""
    }
}

private struct TimelineBars: View {
    let ws: [Week]
    let m: JSON
    let onWeek: (Week) -> Void
    var body: some View {
        let t = D.today
        let tests = m["tests"]?.array.compactMap { $0.string } ?? []
        let evs = m["events"]?.array.compactMap { $0["date"]?.string } ?? []
        HStack(spacing: 3) {
            ForEach(ws.indices, id: \.self) { i in
                let w = ws[i]
                let now = t >= w.start && t <= w.end
                let test = tests.contains { $0 >= w.start && $0 <= w.end }
                let comp = evs.contains { $0 >= w.start && $0 <= w.end }
                Button { Haptics.tap(); onWeek(w) } label: { bar(w, now: now, test: test, comp: comp, n: i + 1) }
                    .buttonStyle(PressStyle())
                    .accessibilityLabel("Semaine " + w.label)
            }
        }
    }
    private func bar(_ w: Week, now: Bool, test: Bool, comp: Bool, n: Int) -> some View {
        VStack(spacing: 4) {
            ZStack(alignment: .top) {
                RoundedRectangle(cornerRadius: 4, style: .continuous).fill(phaseColor(w.phase))
                    .overlay(RoundedRectangle(cornerRadius: 4, style: .continuous).strokeBorder(Palette.rule, lineWidth: ["recup", "deload", "transition", "coupure"].contains(w.phase) ? 0.8 : 0))
                HStack(spacing: 2) {
                    if test { Circle().fill(Palette.kind("test")).frame(width: 5, height: 5) }
                    if comp { Circle().fill(Palette.kind("compet")).frame(width: 5, height: 5) }
                }
                .padding(.top, 4)
            }
            .frame(height: 34)
            .overlay(RoundedRectangle(cornerRadius: 5, style: .continuous).strokeBorder(Palette.ink, lineWidth: now ? 1.6 : 0).padding(-2))
            Text(w.raw["label"]?.string != nil ? "" : "\(w.raw["n"]?.int ?? n)").font(Typo.mono(9.5, now ? .bold : .regular)).foregroundStyle(now ? Palette.ink : Palette.muted)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct TimelineLegend: View {
    let ws: [Week]
    let m: JSON
    var body: some View {
        var seen: [String] = []
        for w in ws where !seen.contains(w.phase) { seen.append(w.phase) }
        let hasTest = !(m["tests"]?.array ?? []).isEmpty, hasEv = !(m["events"]?.array ?? []).isEmpty
        return Flow(spacing: 10) {
            ForEach(seen, id: \.self) { p in
                HStack(spacing: 5) {
                    RoundedRectangle(cornerRadius: 2).fill(phaseColor(p)).frame(width: 10, height: 10)
                        .overlay(RoundedRectangle(cornerRadius: 2).strokeBorder(Palette.rule, lineWidth: 0.6))
                    Text(PHASE_LABEL[p] ?? p).font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                }
            }
            if hasTest { dot(Palette.kind("test"), "Test") }
            if hasEv { dot(Palette.kind("compet"), "Compétition") }
        }
    }
    private func dot(_ c: Color, _ l: String) -> some View {
        HStack(spacing: 5) { Circle().fill(c).frame(width: 7, height: 7); Text(l).font(Typo.sans(12.5)).foregroundStyle(Palette.muted) }
    }
}

private struct EventsCard: View {
    let m: JSON
    var body: some View {
        let evs = m["events"]?.array ?? [], t = D.today
        if !evs.isEmpty {
            FoldCard(id: "plan-events", title: "Compétitions", summary: summary(evs, t), open: true) {
                ForEach(evs.indices, id: \.self) { i in
                    EventRow(e: evs[i], past: ((evs[i]["end"]?.string ?? evs[i]["date"]?.string) ?? "") < t)
                }
            }
        }
    }
    private func summary(_ evs: [JSON], _ t: String) -> String {
        if let nx = evs.first(where: { ((($0["end"]?.string ?? $0["date"]?.string) ?? "")) >= t }) {
            let l: String = nx["label"]?.string ?? "", d: String = nx["date"]?.string ?? ""
            return "Prochaine : " + l + " · " + D.day(d)
        }
        return "\(evs.count) compétitions"
    }
}

private struct EventRow: View {
    let e: JSON
    let past: Bool
    var body: some View {
        let d = e["date"]?.string ?? "", end = e["end"]?.string
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(dates(d, end)).font(Typo.mono(12.5)).foregroundStyle(Palette.muted).frame(width: 110, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text(e["label"]?.string ?? "").font(Typo.sans(15, .semibold)).foregroundStyle(Palette.ink)
                if let l = e["lvl"]?.string { Text(l).font(Typo.sans(12.5)).foregroundStyle(Palette.muted) }
            }
        }
        .opacity(past ? 0.5 : 1)
        .padding(.vertical, 4)
    }
    private func dates(_ d: String, _ end: String?) -> String {
        guard let end, end != d else { return D.day(d) }
        return D.day(d) + " → " + D.day(end)
    }
}

/// Blocs d'entraînement (texte : objectif, notes)
private struct BlocsList: View {
    let m: JSON
    let ed: Bool
    @Binding var sheet: PlanSheet?
    var body: some View {
        let bl = m["blocs"]?.array ?? []
        ForEach(bl.indices, id: \.self) { i in
            BlocCard(b: bl[i], ed: ed) { sheet = .bloc(i) }
        }
        if ed {
            Button { sheet = .bloc(-1) } label: { Label("Ajouter un bloc de texte", systemImage: "plus") }.buttonStyle(BigButton(kind: .plain))
        }
    }
}

private struct BlocCard: View {
    let b: JSON
    let ed: Bool
    let onEdit: () -> Void
    @State private var open = false
    var body: some View {
        let from = b["from"]?.string ?? "", to = b["to"]?.string ?? "", t = D.today
        let now = t >= from && t <= to
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Eyebrow(blocDates(from, to, now), color: now ? Palette.accent : Palette.muted)
                    DisplayTitle(b["name"]?.string ?? "Bloc", size: 24)
                }
                Spacer(minLength: 8)
                if ed { RoundIcon(icon: "pencil", label: "Modifier", action: onEdit) }
            }
            if let o = b["obj"]?.string, !o.isEmpty { rich(o).font(Typo.sans(15.5)).foregroundStyle(Palette.ink).fixedSize(horizontal: false, vertical: true) }
            if let n = b["notes"]?.string, !n.isEmpty {
                DisclosureGroup(isExpanded: $open) {
                    MarkdownText(text: n).padding(.top, 8)
                } label: {
                    Text("Détails du bloc").font(Typo.sans(14, .semibold)).foregroundStyle(Palette.accent)
                }
                .tint(Palette.accent)
            }
        }
        .card()
    }
}

/// Liste des semaines (phase, contenu)
private func blocDates(_ from: String, _ to: String, _ now: Bool) -> String {
    let s: String = D.day(from) + " → " + D.day(to)
    return now ? s + " · en cours" : s
}

private struct WeeksCard: View {
    let m: JSON
    let ed: Bool
    let onWeek: (Week) -> Void
    @State private var store = Store.shared
    var body: some View {
        let ws = PlanReader(store).weeks(), t = D.today
        let cw = ws.first { t >= $0.start && t <= $0.end }
        FoldCard(id: "plan-weeks", title: "Semaines", summary: summary(ws.count, cw)) {
            ForEach(ws.indices, id: \.self) { i in
                WeekLine(w: ws[i], now: cw?.start == ws[i].start, ed: ed) { onWeek(ws[i]) }
                if i < ws.count - 1 { Divider().overlay(Palette.rule.opacity(0.5)) }
            }
        }
    }
    private func summary(_ n: Int, _ cw: Week?) -> String {
        var s = "\(n) semaines"
        if let cw { s += " · en cours : " + cw.label + " (" + cw.phaseLabel + ")" }
        return s
    }
}

func weekSummary(_ w: Week, _ store: Store) -> String {
    let pr = PlanReader(store)
    var c: [String: Int] = [:]
    for k in D.range(w.start, w.end) { for kd in pr.kinds(k) { c[kd, default: 0] += 1 } }
    let parts = KIND_ORDER.filter { c[$0] != nil }.map { kd -> String in
        let n = c[kd] ?? 0
        return (n > 1 ? "\(n) × " : "") + (KIND[kd] ?? kd).lowercased()
    }
    return parts.isEmpty ? "repos" : parts.joined(separator: " · ")
}

private struct WeekLine: View {
    let w: Week
    let now: Bool
    let ed: Bool
    let action: () -> Void
    @State private var store = Store.shared
    var body: some View {
        Button { if ed { Haptics.tap(); action() } } label: {
            HStack(alignment: .center, spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(w.label).font(Typo.sans(15, .semibold)).foregroundStyle(now ? Palette.accent : Palette.ink)
                        Text(D.rangeTxt(w.start, w.end)).font(Typo.sans(14)).foregroundStyle(Palette.muted)
                    }
                    Text(w.phaseLabel + " · " + weekSummary(w, store)).font(Typo.sans(12.5)).foregroundStyle(Palette.muted).multilineTextAlignment(.leading)
                }
                Spacer(minLength: 0)
                if ed { Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Palette.muted.opacity(0.6)) }
            }
            .padding(.vertical, 8).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// Exercices du plan, rangés par type de séance : un appui renomme un exercice partout ou ajoute une vidéo
private struct PlanExercisesCard: View {
    let ed: Bool
    let onPick: (JSON) -> Void
    @State private var store = Store.shared
    var body: some View {
        let exs = Core.shared.call("plan.exerciseNames")?.array ?? []
        let groups = group(exs)
        if !exs.isEmpty {
            FoldCard(id: "plan-exos", title: "Exercices", summary: Fmt.plural(exs.count, "exercice") + (ed ? " · nom et vidéo de démo" : "")) {
                ForEach(groups.indices, id: \.self) { i in
                    ExerciseGroup(kind: groups[i].0, list: groups[i].1, ed: ed, onPick: onPick)
                }
            }
        }
    }
    private func group(_ exs: [JSON]) -> [(String, [JSON])] {
        var g: [String: [JSON]] = [:]
        for x in exs {
            let ks = x["kinds"]?.array.compactMap { $0.string } ?? []
            let k = KIND_ORDER.first { ks.contains($0) } ?? "autre"
            g[k, default: []].append(x)
        }
        return KIND_ORDER.compactMap { k in g[k].map { (k, $0) } }
    }
}

private struct ExerciseGroup: View {
    let kind: String
    let list: [JSON]
    let ed: Bool
    let onPick: (JSON) -> Void
    @State private var open = false
    var body: some View {
        DisclosureGroup(isExpanded: $open) {
            VStack(spacing: 0) {
                ForEach(list.indices, id: \.self) { i in ExerciseLine(x: list[i], ed: ed) { onPick(list[i]) } }
            }
            .padding(.top, 4)
        } label: {
            HStack(spacing: 8) {
                Circle().fill(Palette.kind(kind)).frame(width: 9, height: 9)
                Text(KIND[kind] ?? kind).font(Typo.sans(15, .semibold)).foregroundStyle(Palette.ink)
                Spacer()
                Text("\(list.count)").font(Typo.mono(12.5)).foregroundStyle(Palette.muted)
            }
        }
        .tint(Palette.muted)
    }
}

private struct ExerciseLine: View {
    let x: JSON
    let ed: Bool
    let action: () -> Void
    var body: some View {
        let label = x["label"]?.string ?? ""
        Button { if ed { Haptics.tap(); action() } } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(label).font(Typo.sans(14.5, .medium)).foregroundStyle(Palette.ink).multilineTextAlignment(.leading)
                    Text(detail(label)).font(Typo.sans(12)).foregroundStyle(Palette.muted)
                }
                Spacer(minLength: 0)
                if ed { Image(systemName: "chevron.right").font(.system(size: 11, weight: .semibold)).foregroundStyle(Palette.muted.opacity(0.6)) }
            }
            .padding(.vertical, 7).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
    private func detail(_ label: String) -> String {
        let n = x["n"]?.int ?? 0
        let a: String = x["first"]?.string ?? "", b: String = x["last"]?.string ?? ""
        var s: String = Fmt.plural(n, "séance")
        s += " · du " + D.day(a) + " au " + D.day(b)
        if Core.shared.call("plan.demoOf", ["label": .str(label)])?.string != nil { s += " · vidéo" }
        return s
    }
}

/// Repères du plan (sections de texte)
private struct SectionsList: View {
    let m: JSON
    let ed: Bool
    @Binding var sheet: PlanSheet?
    var body: some View {
        let ss = m["sections"]?.array ?? []
        if !ss.isEmpty || ed {
            DisplayTitle("Repères du plan", size: 24).padding(.top, 8)
        }
        ForEach(ss.indices, id: \.self) { i in
            let s = ss[i]
            FoldCard(id: "plan-sec-" + (s["id"]?.string ?? "\(i)"), title: s["title"]?.string ?? "Section") {
                MarkdownText(text: s["body"]?.string ?? "")
                if ed {
                    Button { sheet = .section(i) } label: { Label("Modifier", systemImage: "pencil") }.buttonStyle(SmallButton())
                }
            }
        }
        if ed {
            Button { sheet = .section(-1) } label: { Label("Ajouter une section", systemImage: "plus") }.buttonStyle(BigButton(kind: .plain))
        }
    }
}

/// Feuilles de l'onglet Plan
struct PlanSheetView: View {
    let sheet: PlanSheet
    var body: some View {
        switch sheet {
        case .settings: PlanSettingsSheet()
        case .week(let id): WeekSheet(id: id)
        case .day(let k): NavigationStack { DayEditorView(k: k) }
        case .bloc(let i): BlocTextSheet(idx: i)
        case .section(let i): SectionSheet(idx: i)
        case .exercise(let x): ExerciseSheet(ex: x)
        case .builder: BuilderView()
        }
    }
}
