import SwiftUI

/// Mode séance en plein écran : une étape à la fois, repos et minuteurs, puis le bilan (durée, ressenti).
struct SessionModeView: View {
    let ref: SessionRef
    @Environment(\.dismiss) private var dismiss
    @State private var run: SessionRunner
    @State private var store = Store.shared
    @State private var dir: Edge = .trailing

    init(ref: SessionRef) {
        self.ref = ref
        _run = State(initialValue: SessionRunner(k: ref.k, part: ref.part))
    }

    var body: some View {
        let steps = run.steps, pr = PlanReader(store), p = pr.progress(run.k, part: run.part)
        let ii = min(run.i, max(0, steps.count - 1))
        ZStack(alignment: .bottom) {
            Palette.bg.ignoresSafeArea()
            VStack(spacing: 0) {
                topBar(p)
                ProgressBar(frac: p.total > 0 ? Double(p.done) / Double(p.total) : 0)
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 18) {
                            Color.clear.frame(height: 0).id("top")
                            if run.finishing {
                                FinishView(run: run) { dismiss() }
                            } else if steps.isEmpty {
                                Text("Rien à faire dans cette séance : les blocs du jour sont faits à part ou déplacés.")
                                    .font(Typo.sans(16)).foregroundStyle(Palette.muted)
                            } else {
                                if ii == 0 && run.part == nil { GoalView(k: run.k) }
                                StepView(run: run, step: steps[ii], isLast: ii == steps.count - 1) { next(steps.count) }
                                    .id(steps[ii].id)
                                    .transition(.asymmetric(insertion: .move(edge: dir).combined(with: .opacity), removal: .opacity))
                                StepList(run: run, steps: steps, current: ii) { j in go(j) }
                                    .padding(.top, 12)
                            }
                        }
                        .padding(.horizontal, 18).padding(.top, 16)
                        .padding(.bottom, run.rest != nil ? 230 : 120)
                    }
                    .scrollIndicators(.hidden)
                    .onChange(of: run.i) { _, _ in withAnimation { proxy.scrollTo("top", anchor: .top) } }
                    .onChange(of: run.finishing) { _, _ in withAnimation { proxy.scrollTo("top", anchor: .top) } }
                }
            }
            if !run.finishing && !steps.isEmpty && run.rest == nil {
                footer(ii, steps.count)
            }
            if let r = run.rest, run.timer == nil, run.climb == nil, !run.finishing {
                RestPanel(run: run, rest: r)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .overlay {
            if run.timer != nil { IntervalTimerView(run: run).transition(.opacity.combined(with: .scale(scale: 1.03))) }
            else if run.climb != nil { ClimbView(run: run).transition(.opacity.combined(with: .scale(scale: 1.03))) }
        }
        .animation(.spring(response: 0.42, dampingFraction: 0.86), value: run.i)
        .animation(.spring(response: 0.42, dampingFraction: 0.86), value: run.finishing)
        .animation(.spring(response: 0.4, dampingFraction: 0.85), value: run.rest == nil)
        .animation(.easeInOut(duration: 0.25), value: run.timer == nil)
        .animation(.easeInOut(duration: 0.25), value: run.climb == nil)
        .onAppear {
            run.begin()
            if Launch.demo { demoState() }
        }
        .onDisappear { run.stop() }
        .statusBarHidden(run.timer != nil || run.climb != nil)
    }

    /// Captures automatiques : un état précis de la séance
    private func demoState() {
        let steps = run.steps
        switch Launch.screen {
        case "rest":
            if let j = steps.firstIndex(where: { $0.items.first?.id == "tr" }) {
                run.i = j; run.bump(steps[j].b, steps[j].items[0]); run.startRest(180, "Repos · série 2 ensuite")
            }
        case "timer":
            if let j = steps.firstIndex(where: { $0.items.first?.timer != nil }), let T = steps[j].items[0].timer {
                run.i = j; run.openTimer(T, steps[j].b, steps[j].items, title: steps[j].items[0].label)
            }
        case "climb":
            if let j = steps.firstIndex(where: { $0.items.first?.unit == "Bloc" }) {
                run.i = j; run.openClimb(steps[j].b, steps[j].items[0])
            }
        case "finish": run.finishing = true
        default: break
        }
    }

    private func next(_ count: Int) {
        run.endRestSilently()
        if run.i < count - 1 { dir = .trailing; run.i += 1 } else { run.finishing = true }
    }
    private func go(_ j: Int) { dir = j > run.i ? .trailing : .leading; run.i = j }

    private func topBar(_ p: (total: Int, done: Int, skipped: Int)) -> some View {
        HStack(spacing: 10) {
            Button { Haptics.tap(); dismiss() } label: {
                Image(systemName: "xmark").font(.system(size: 15, weight: .bold)).foregroundStyle(Palette.ink)
                    .frame(width: 40, height: 40).background(Palette.surface, in: Circle())
            }
            .accessibilityLabel("Fermer le mode séance")
            Spacer()
            VStack(spacing: 1) {
                Text(run.part != nil ? plain(PlanReader(store).blocks(run.k).first { $0.id == run.part }?.title) + " · à part" : D.long(run.k))
                    .font(Typo.sans(14, .semibold)).foregroundStyle(Palette.ink).lineLimit(1)
                TimelineView(.periodic(from: .now, by: 1)) { ctx in
                    Text(Fmt.mmss(ctx.date.timeIntervalSince(run.started)) + " · \(p.done)/\(p.total) fait")
                        .font(Typo.mono(12.5, .medium)).foregroundStyle(Palette.muted).monospacedDigit()
                }
            }
            Spacer()
            Button(run.finishing ? "Séance" : "Terminer") { Haptics.tap(); run.finishing.toggle() }
                .buttonStyle(SmallButton(color: Palette.ink))
        }
        .padding(.horizontal, 14).padding(.vertical, 8)
    }

    private func footer(_ ii: Int, _ count: Int) -> some View {
        HStack(spacing: 10) {
            Button { Haptics.tap(); go(ii - 1) } label: { Label("Précédent", systemImage: "chevron.left").labelStyle(.iconOnly).frame(width: 30) }
                .buttonStyle(BigButton(kind: .plain)).frame(width: 76).disabled(ii == 0)
            Button { Haptics.tap(); next(count) } label: {
                HStack { Text(ii < count - 1 ? "Étape suivante" : "Terminer la séance"); Image(systemName: "arrow.right") }
            }
            .buttonStyle(BigButton(kind: .ink))
        }
        .padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 6)
        .background(LinearGradient(colors: [Palette.bg.opacity(0), Palette.bg, Palette.bg], startPoint: .top, endPoint: .bottom).ignoresSafeArea())
    }
}

extension SessionRunner {
    /// Passer à l'étape suivante annule le repos en cours (sans son ni « then »)
    func endRestSilently() { rest = nil; Signals.cancel("rest") }
}

struct ProgressBar: View {
    let frac: Double
    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Rectangle().fill(Palette.sunk)
                Rectangle().fill(Palette.accent).frame(width: g.size.width * frac)
            }
        }
        .frame(height: 3)
        .animation(.spring(response: 0.5, dampingFraction: 0.8), value: frac)
    }
}

/// Liste des étapes, pour sauter à l'une d'elles
struct StepList: View {
    let run: SessionRunner
    let steps: [Step]
    let current: Int
    let onPick: (Int) -> Void
    var body: some View {
        let e = Store.shared.journal(run.k)
        VStack(alignment: .leading, spacing: 4) {
            Eyebrow("Étapes")
            ForEach(Array(steps.indices), id: \.self) { j in
                let s = steps[j], d = s.isDone(e), part = !d && s.isStarted(e)
                Button { Haptics.select(); onPick(j) } label: {
                    HStack(spacing: 12) {
                        ZStack {
                            Circle().fill(d ? (s.skip ? Palette.muted : Palette.good) : part ? Palette.accentSoft : Palette.sunk)
                            if s.skip { Text("–").font(Typo.mono(12, .bold)).foregroundStyle(.white) }
                            else if d { Image(systemName: "checkmark").font(.system(size: 11, weight: .heavy)).foregroundStyle(.white) }
                        }
                        .frame(width: 24, height: 24)
                        VStack(alignment: .leading, spacing: 1) {
                            rich(s.title).font(Typo.sans(15, j == current ? .semibold : .regular)).foregroundStyle(Palette.ink).lineLimit(2).multilineTextAlignment(.leading)
                            Text(s.skip ? "Pas fait" : s.list ? "\(s.items.count) éléments" : (KIND[s.b.kind] ?? s.b.title)).font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                        }
                        Spacer()
                    }
                    .padding(.horizontal, 12).padding(.vertical, 9)
                    .background(j == current ? Palette.surface : Color.clear, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: une étape

private let STRENGTH: Set<String> = ["muscu", "renfo", "doigts", "epaule"]

struct StepView: View {
    let run: SessionRunner
    let step: Step
    let isLast: Bool
    let onNext: () -> Void
    @State private var sub = 0            // clusters : répétition ; contraste : 0 lourde, 1 explosive
    @State private var blockMenu = false

    var body: some View {
        let s = Store.shared, e = s.journal(run.k), b = step.b, color = Palette.kind(b.kind), w = JournalWriter(s)
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Capsule().fill(color).frame(width: 18, height: 5)
                rich(b.title).font(Typo.mono(12, .medium)).textCase(.uppercase).foregroundStyle(Palette.muted).lineLimit(1)
            }
            rich(step.title).font(Typo.display(step.title.count > 34 ? 32 : 42)).textCase(.uppercase).foregroundStyle(Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
            let it = step.items.first
            let single = !step.group && !step.list && !step.pair && !step.skip
            if single, let it {
                if let det = it.det { GlossText(det).font(Typo.sans(16)).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true) }
                DemoLink(it: it, big: true)
                if let note = it.adjNote ?? (it.adjN0.flatMap { $0 != it.n ? "Séance adaptée : \(it.n) au lieu de \($0)" : nil }) {
                    Text(note).font(Typo.sans(14, .medium)).foregroundStyle(Palette.accent)
                }
                if let warn = it.warn { Text(warn).font(Typo.sans(14, .medium)).foregroundStyle(Palette.warn) }
                if (STRENGTH.contains(b.kind) || it.climbable) && !it.isWarmup,
                   let lp = Core.shared.call("history.lastPerf", .str(it.label), .str(run.k), it.raw["lib"] ?? .null),
                   let txt = Core.shared.call("history.perfText", lp)?.string {
                    Text("Dernière fois · " + txt).font(Typo.sans(13.5, .medium)).foregroundStyle(Palette.muted)
                }
            } else if let desc = b.desc {
                GlossText(desc).font(Typo.sans(15.5)).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
            }
            FingerCalcView(k: run.k, b: b)

            if step.skip {
                Text("Pas fait · " + skipLabel(e["skip"]?[b.id]?.string).lowercased()).font(Typo.sans(16, .medium)).foregroundStyle(Palette.muted)
                Button("Je le fais finalement") { w.setBlockState(run.k, b, nil) }.buttonStyle(BigButton(kind: .plain))
                nextButton
            } else if step.items.isEmpty {
                let key = b.id + ".*", on = e["done"]?[key]?.truthy ?? false
                if on {
                    nextButton
                    Button("Pas fait finalement") { setStar(key, false) }.buttonStyle(SmallButton(color: Palette.muted))
                } else {
                    Button("Marquer comme fait") { Haptics.success(); setStar(key, true) }.buttonStyle(BigButton())
                }
            } else if step.list {
                listBody(e, color)
            } else if step.group {
                groupBody(e, color)
            } else if step.pair {
                PairBody(run: run, step: step, color: color, next: AnyView(nextButton))
            } else if let it {
                singleBody(it, e, color)
            }
            if !step.skip, let subText = b.sub, !step.list { GlossText(subText).font(Typo.sans(14)).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true) }
            if run.part == nil && !step.skip && !step.isDone(e) {
                Button { Haptics.tap(); blockMenu = true } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Pas possible maintenant ?").font(Typo.sans(14.5, .semibold)).foregroundStyle(Palette.accent)
                        Text("Tout le bloc « " + plain(b.title) + " » : à part, un autre jour ou pas fait").font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain).padding(.top, 6)
            }
        }
        .onChange(of: step.id) { _, _ in sub = 0 }
        .sheet(isPresented: $blockMenu) { BlockMenuSheet(k: run.k, b: step.b).presentationDetents([.medium, .large]).presentationDragIndicator(.visible) }
    }

    private var nextButton: some View {
        Button { Haptics.firm(); onNext() } label: {
            HStack { Text(isLast ? "Terminer la séance" : "Étape suivante"); Image(systemName: "arrow.right") }
        }
        .buttonStyle(BigButton(kind: .ink))
    }
    private func setStar(_ key: String, _ on: Bool) {
        let s = Store.shared
        var done = s.journal(run.k)["done"]?.object ?? [:]
        if on { done[key] = 1 } else { done.removeValue(forKey: key) }
        s.jset(run.k, ["done": done.isEmpty ? nil : .obj(done)])
    }

    @ViewBuilder private func listBody(_ e: JSON, _ color: Color) -> some View {
        let b = step.b, w = JournalWriter()
        let all = step.items.allSatisfy { PlanReader.doneN(e, PlanReader.itemKey(b, $0), 1) >= 1 }
        VStack(spacing: 8) {
            ForEach(step.items) { x in
                let on = PlanReader.doneN(e, PlanReader.itemKey(b, x), 1) >= 1
                Button { Haptics.select(); w.setDone(run.k, b, x, on ? 0 : 1) } label: {
                    HStack(alignment: .top, spacing: 12) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 8, style: .continuous).fill(on ? color : .clear)
                            RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(on ? color : Palette.rule, lineWidth: 1.5)
                            if on { Image(systemName: "checkmark").font(.system(size: 13, weight: .heavy)).foregroundStyle(.white) }
                        }
                        .frame(width: 26, height: 26)
                        VStack(alignment: .leading, spacing: 2) {
                            rich(x.label).font(Typo.sans(16, .semibold)).foregroundStyle(on ? Palette.muted : Palette.ink).multilineTextAlignment(.leading)
                            if let d = x.det { rich(d).font(Typo.sans(14)).foregroundStyle(Palette.muted).multilineTextAlignment(.leading) }
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(12)
                    .background(Palette.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(PressStyle())
            }
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: all)
        if all { nextButton } else {
            Button("Tout est fait") {
                Haptics.success()
                var done = Store.shared.journal(run.k)["done"]?.object ?? [:]
                for x in step.items { done[PlanReader.itemKey(b, x)] = 1 }
                Store.shared.jset(run.k, ["done": .obj(done)])
            }
            .buttonStyle(BigButton())
        }
    }

    @ViewBuilder private func groupBody(_ e: JSON, _ color: Color) -> some View {
        let b = step.b, w = JournalWriter()
        ForEach(step.items) { x in
            let v = PlanReader.doneN(e, PlanReader.itemKey(b, x), x.n)
            VStack(alignment: .leading, spacing: 8) {
                HStack { rich(x.label).font(Typo.sans(15.5, .semibold)).foregroundStyle(Palette.ink); Spacer(); Text("\(v)/\(x.n)").font(Typo.mono(13, .medium)).foregroundStyle(Palette.muted) }
                Pips(n: x.n, v: v, color: color, size: 40) { nv in w.setDone(run.k, b, x, nv) }
            }
        }
        if let T = b.timer {
            let full = step.items.allSatisfy { PlanReader.doneN(e, PlanReader.itemKey(b, $0), $0.n) >= $0.n }
            if full {
                nextButton
                Button("Relancer le minuteur") { run.openTimer(T, b, step.items) }.buttonStyle(SmallButton())
            } else {
                Button { Haptics.firm(); run.openTimer(T, b, step.items) } label: { Label("Lancer le minuteur \(Fmt.num(T.work)):\(Fmt.num(T.rest))", systemImage: "timer") }
                    .buttonStyle(BigButton())
            }
            Text("Le minuteur enchaîne " + (T.sides.isEmpty ? "" : T.sides.joined(separator: " et ").lowercased() + ", ") + "\(T.reps) répétitions de \(Fmt.num(T.work)) s, \(Fmt.num(T.rest)) s de pause, \(Fmt.mmss(T.setRest)) entre les séries, et coche les séries tout seul.")
                .font(Typo.sans(13)).foregroundStyle(Palette.muted)
        }
    }

    @ViewBuilder private func singleBody(_ it: Item, _ e: JSON, _ color: Color) -> some View {
        let b = step.b, key = PlanReader.itemKey(b, it), v = PlanReader.doneN(e, key, it.n), full = v >= it.n
        let T = it.timer, w = JournalWriter()
        LoadStepper(k: run.k, b: b, it: it)
        SuggestBox(k: run.k, b: b, it: it)
        if it.isWarmup { WarmupView(k: run.k, b: b, fold: false) { T in run.openTimer(T, b, [], title: T.name.isEmpty ? "Échauffement" : T.name) } }
        if it.n == 1 {
            if full {
                nextButton
                Button("Pas fait finalement") { w.setDone(run.k, b, it, 0) }.buttonStyle(SmallButton(color: Palette.muted))
            } else {
                Button { Haptics.success(); w.setDone(run.k, b, it, 1) } label: { Text("Marquer comme fait") }.buttonStyle(BigButton())
            }
        } else {
            if let rbs = it.repsBySet, !rbs.isEmpty, !full {
                PhaseBox(top: "Série \(v + 1)/\(it.n)", big: "\(rbs[min(v, rbs.count - 1)]) répétitions")
            }
            Pips(n: it.n, v: v, color: color, size: it.n > 12 ? 34 : 46) { nv in
                w.setDone(run.k, b, it, nv)
                if nv > v, let r = it.rest, T == nil, nv < it.n { run.startRest(r, "Repos") }
            }
            if full && STRENGTH.contains(b.kind) && !["Bloc", "Essai"].contains(it.unit) && T?.kind != "interval" {
                Reserve(k: run.k, b: b, it: it)
            }
            if full { nextButton }
            else { action(it, v, T) }
            if !full, let r = it.rest, T == nil, !(it.climbable && !STRENGTH.contains(b.kind)) {
                Text("\(Fmt.mmss(r)) de repos se lancent tout seuls après chaque \(it.unitWord).").font(Typo.sans(13)).foregroundStyle(Palette.muted)
            }
        }
    }

    @ViewBuilder private func action(_ it: Item, _ v: Int, _ T: TimerSpec?) -> some View {
        let b = step.b
        if let T, T.kind == "interval" {
            Button { Haptics.firm(); run.openTimer(T, b, [it], title: it.label) } label: { Label("Lancer le minuteur", systemImage: "timer") }.buttonStyle(BigButton())
        } else if let T, T.kind == "tempo" {
            Button { Haptics.firm(); run.openTempo(T, b, it, done: v) } label: { Label("Lancer le minuteur tempo", systemImage: "timer") }.buttonStyle(BigButton())
            Text("Tempo : \(Fmt.num(T.ecc)) s d’excentrique" + (T.ret > 0 ? ", \(Fmt.num(T.ret)) s de retour" : "") + ". Les séries se cochent toutes seules.").font(Typo.sans(13)).foregroundStyle(Palette.muted)
        } else if let T, T.kind == "cluster" {
            PhaseBox(top: "Série \(min(it.n, v + 1))/\(it.n) · en clusters", big: "Répétition \(min(T.reps, sub + 1))/\(T.reps)")
            Button("Répétition faite") {
                Haptics.firm()
                if sub + 1 >= T.reps { sub = 0; run.bump(b, it); if v + 1 < it.n { run.startRest(T.setRest > 0 ? T.setRest : 180, "Repos avant la série \(v + 2)", say: "Série suivante") } }
                else { sub += 1; run.startRest(T.intra, "Pause courte, répétition \(sub + 1) ensuite") }
            }
            .buttonStyle(BigButton())
        } else if let T, T.kind == "contrast" {
            let heavy = sub == 0
            PhaseBox(top: "Contraste \(min(it.n, v + 1))/\(it.n)", big: heavy ? "Série lourde" : "Série explosive")
            Button(heavy ? "Lourde faite" : "Explosive faite") {
                Haptics.firm()
                if heavy { sub = 1; run.startRest(T.heavyRest, "Repos avant la série explosive", say: "Explosive") }
                else { sub = 0; run.bump(b, it); if v + 1 < it.n { run.startRest(T.lightRest, "Repos avant le contraste suivant", say: "Série lourde") } }
            }
            .buttonStyle(BigButton())
        } else {
            let cl = it.climbable && it.rest != nil && !STRENGTH.contains(b.kind)
            if it.climbable { ClimbSuggestBox(k: run.k, b: b, it: it) }
            if cl {
                Button { Haptics.firm(); run.openClimb(b, it) } label: {
                    Label("Lancer le mode " + (it.unit == "Essai" ? "essais" : it.unit == "Voie" ? "voies" : "blocs"), systemImage: "figure.climbing")
                }
                .buttonStyle(BigButton())
            }
            Button {
                Haptics.firm()
                run.bump(b, it)
                if let r = it.rest, v + 1 < it.n { run.startRest(r, "Repos · " + it.unitWord + " \(v + 2) ensuite") }
            } label: {
                Text((it.unit == "Bloc" ? "Bloc fait" : it.unit == "Essai" ? "Essai fait" : it.unit == "Voie" ? "Voie faite" : "Série faite") + " · \(v + 1)/\(it.n)")
            }
            .buttonStyle(BigButton(kind: cl ? .plain : .primary))
            if cl {
                Text("Plein écran : « " + (it.unit == "Essai" ? "Réussi" : it.unit == "Voie" ? "Voie finie" : "Bloc fini") + " » lance \(Fmt.mmss(it.rest ?? 60)) de repos, « Tombé » compte aussi et note la chute. Règle la cotation avec − / +.")
                    .font(Typo.sans(13)).foregroundStyle(Palette.muted)
            }
        }
    }
}

struct PhaseBox: View {
    let top: String, big: String
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(top).font(Typo.sans(14, .medium)).foregroundStyle(Palette.muted)
            Text(big.uppercased()).font(Typo.display(30)).foregroundStyle(Palette.ink)
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

/// Charge du jour : − / + (le plan garde sa charge prévue, la tienne est notée à part)
struct LoadStepper: View {
    let k: String, b: Block, it: Item
    var body: some View {
        let s = Store.shared, e = s.journal(k)
        if let ld = PlanReader.itemLoad(b, it, e) {
            let step = abs(ld.v) >= 20 ? 2.5 : 0.5, key = PlanReader.itemKey(b, it)
            let done = PlanReader.doneN(e, key, it.n), sl = PlanReader.setLoads(e, key)
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 0) {
                    stepButton("minus") { JournalWriter(s).setLoad(k, b, it, ((ld.v - step) * 2).rounded() / 2) }
                    VStack(spacing: 0) {
                        Text(PlanReader.loadText(ld.v, ld.u)).font(Typo.display(36)).foregroundStyle(ld.changed ? Palette.oil : Palette.ink)
                            .contentTransition(.numericText(value: ld.v))
                        Text(ld.changed ? "modifié · prévu " + PlanReader.loadText(it.load ?? 0, ld.u) : it.load == nil ? "charge du jour" : "charge prévue")
                            .font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                    }
                    .frame(maxWidth: .infinity)
                    stepButton("plus") { JournalWriter(s).setLoad(k, b, it, ((ld.v + step) * 2).rounded() / 2) }
                }
                .padding(6)
                .background(Palette.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .animation(.spring(response: 0.3, dampingFraction: 0.8), value: ld.v)
                if done > 0, let sl {
                    Text("Séries faites : " + setsText(sl, ld.u) + (sl.last != ld.v ? " · la suivante à " + PlanReader.loadText(ld.v, ld.u) : ""))
                        .font(Typo.sans(13)).foregroundStyle(Palette.muted)
                }
            }
        }
    }
    private func stepButton(_ icon: String, _ action: @escaping () -> Void) -> some View {
        Button { Haptics.select(); action() } label: {
            Image(systemName: icon).font(.system(size: 20, weight: .bold)).foregroundStyle(Palette.ink)
                .frame(width: 60, height: 60).background(Palette.sunk, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(PressStyle())
    }
    private func setsText(_ arr: [Double], _ u: String) -> String {
        var g: [(v: Double, n: Int)] = []
        for v in arr { if let l = g.last, l.v == v { g[g.count - 1].n += 1 } else { g.append((v, 1)) } }
        if g.count == 1 { return PlanReader.loadText(g[0].v, u) }
        return g.map { PlanReader.loadText($0.v, u) + ($0.n > 1 ? " × \($0.n)" : "") }.joined(separator: " · ")
    }
}

/// Réserve sur la dernière série (combien de répétitions de plus) : règle la progression suivante
struct Reserve: View {
    let k: String, b: Block, it: Item
    var body: some View {
        let s = Store.shared, key = PlanReader.itemKey(b, it), v = s.journal(k)["rir"]?[key]?.int
        let labels = ["0 · échec", "1", "2", "3", "4 et +"]
        VStack(alignment: .leading, spacing: 8) {
            Text("Réserve sur la dernière série").font(Typo.sans(15, .semibold)).foregroundStyle(Palette.ink)
            Text("Combien de répétitions de plus tu aurais pu faire" + ((it.raw["rx"]?["rir"]?.int).map { " · visée \($0)" } ?? "")).font(Typo.sans(13)).foregroundStyle(Palette.muted)
            HStack(spacing: 5) {
                ForEach(0..<5, id: \.self) { i in
                    Button {
                        Haptics.select()
                        var r = s.journal(k)["rir"]?.object ?? [:]
                        if v == i { r.removeValue(forKey: key) } else { r[key] = .num(Double(i)) }
                        s.jset(k, ["rir": r.isEmpty ? nil : .obj(r)])
                    } label: {
                        Text(labels[i]).font(Typo.sans(13.5, .semibold)).foregroundStyle(v == i ? Palette.accentInk : Palette.ink)
                            .frame(maxWidth: .infinity, minHeight: 42)
                            .background(v == i ? Palette.accent : Palette.sunk, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .buttonStyle(PressStyle())
                }
            }
        }
        .padding(14).background(Palette.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

/// Deux exercices en alternance : A, repos court, B, repos, A…
struct PairBody: View {
    let run: SessionRunner
    let step: Step
    let color: Color
    let next: AnyView
    var body: some View {
        let s = Store.shared, e = s.journal(run.k), b = step.b, A = step.items[0], B = step.items[1]
        let vA = PlanReader.doneN(e, PlanReader.itemKey(b, A), A.n), vB = PlanReader.doneN(e, PlanReader.itemKey(b, B), B.n)
        let fullA = vA >= A.n, fullB = vB >= B.n, all = fullA && fullB
        let turnB = !fullB && (vB < vA || fullA)
        let restA = A.raw["pairRest"]?.double ?? 60, restB = B.rest ?? 90, hold = B.raw["hold"]?.double
        let w = JournalWriter(s)
        VStack(alignment: .leading, spacing: 10) {
            ForEach(0..<2, id: \.self) { j in
                let x = j == 0 ? A : B, on = j == 0 ? (!turnB && !fullA) : turnB
                let dn = j == 0 ? vA : vB
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        Text(j == 0 ? "A" : "B").font(Typo.mono(12, .bold)).foregroundStyle(on ? Palette.accentInk : Palette.muted)
                            .frame(width: 22, height: 22).background(on ? color : Palette.sunk, in: Circle())
                        rich(x.label).font(Typo.sans(16, .semibold)).foregroundStyle(Palette.ink)
                        Spacer()
                        Text("\(dn)/\(x.n)").font(Typo.mono(13, .medium)).foregroundStyle(Palette.muted)
                    }
                    if on {
                        if let d = x.det { rich(d).font(Typo.sans(14)).foregroundStyle(Palette.muted) }
                        LoadStepper(k: run.k, b: b, it: x)
                        SuggestBox(k: run.k, b: b, it: x)
                        Pips(n: x.n, v: dn, color: color, size: 40) { nv in w.setDone(run.k, b, x, nv) }
                    }
                }
                .padding(14)
                .background(Palette.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(on ? color : .clear, lineWidth: 1.5))
            }
            if fullA && STRENGTH.contains(b.kind) { Reserve(k: run.k, b: b, it: A) }
            if all { next }
            else if turnB {
                if let hold {
                    Button { Haptics.firm(); run.startRest(hold, "Tiens · " + B.label.lowercased(), hold: true) { doneB(A, B, restB) } } label: {
                        Label("Lancer " + B.label.lowercased() + " · \(Fmt.num(hold)) s", systemImage: "timer")
                    }
                    .buttonStyle(BigButton())
                }
                Button(B.label + " faite" + (B.n > 1 ? " · \(vB + 1)/\(B.n)" : "")) { Haptics.firm(); doneB(A, B, restB) }
                    .buttonStyle(BigButton(kind: hold != nil ? .plain : .primary))
            } else {
                Button((A.unit == "Bloc" ? "Bloc fait" : "Série faite") + " · " + A.label.lowercased() + " \(vA + 1)/\(A.n)") {
                    Haptics.firm()
                    run.bump(b, A)
                    run.startRest(fullB ? (A.rest ?? 120) : restA, fullB ? "Repos" : "Repos · " + B.label.lowercased() + " ensuite", say: fullB ? nil : B.label)
                }
                .buttonStyle(BigButton())
            }
            Text("En alternance : \(A.label.lowercased()), \(Fmt.mmss(restA)) de repos, \(B.label.lowercased())" + (hold.map { " (\(Fmt.num($0)) s)" } ?? "") + ", puis \(Fmt.mmss(restB)) avant la série suivante. Les repos se lancent tout seuls.")
                .font(Typo.sans(13)).foregroundStyle(Palette.muted)
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.8), value: turnB)
    }
    private func doneB(_ A: Item, _ B: Item, _ restB: Double) {
        let b = step.b
        run.bump(b, B)
        if PlanReader.doneN(Store.shared.journal(run.k), PlanReader.itemKey(b, A), A.n) < A.n { run.startRest(restB, "Repos · " + A.label.lowercased() + " ensuite", say: A.label) }
    }
}

// MARK: fin de séance

struct FinishView: View {
    let run: SessionRunner
    let onClose: () -> Void
    @State private var menuFor: Block?
    @State private var minutes: Int = 0
    @State private var status: String?
    @State private var ready = false

    var body: some View {
        let s = Store.shared, pr = PlanReader(s), e = s.journal(run.k), p = pr.progress(run.k, part: run.part)
        let tg = run.part == nil ? pr.target(run.k) : nil
        let rpe = run.part != nil ? e["apart"]?[run.part!]?["rpe"]?.int : e["rpe"]?.int
        let auto = p.total > 0 && p.done == p.total ? (p.skipped > 0 ? "adaptee" : "faite") : "adaptee"
        let st = status ?? e["status"]?.string ?? auto
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 6) {
                Eyebrow(run.part != nil ? "Bloc à part" : "Fin de séance")
                DisplayTitle(p.done == p.total && p.total > 0 ? "Bien joué" : "Fin de séance", size: 48)
                Text("\(p.done)/\(p.total) exercices faits." + (run.part != nil ? " Ce bloc compte comme une séance à part dans la charge du jour." : " Le ressenti se note idéalement 30 min après : tu peux aussi le remplir plus tard dans la fiche du jour."))
                    .font(Typo.sans(15.5)).foregroundStyle(Palette.muted)
            }
            let untouched = run.part != nil ? [] : pr.blocks(run.k).filter { b in
                !b.isRest && PlanReader.blockState(e, b) == nil &&
                (b.items.isEmpty ? e["done"]?[b.id + ".*"] == nil : b.items.allSatisfy { PlanReader.doneN(e, PlanReader.itemKey(b, $0), $0.n) == 0 })
            }
            if !untouched.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Pas commencé" + (untouched.count > 1 ? "s" : "")).font(Typo.sans(14.5, .semibold)).foregroundStyle(Palette.ink)
                    ForEach(untouched) { b in
                        HStack {
                            GlossText(b.title, gloss: false).font(Typo.sans(15)).foregroundStyle(Palette.ink)
                            Spacer()
                            Button("Que faire ?") { menuFor = b }.buttonStyle(SmallButton())
                        }
                    }
                    Text("À un autre moment de la journée, un autre jour, ou pas fait avec la raison.").font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                }
                .padding(12).background(Palette.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            BilanView(k: run.k, part: run.part)
            if run.part == nil {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Statut").font(Typo.sans(14.5, .semibold)).foregroundStyle(Palette.ink)
                    Segmented(options: Rules.STATUS, value: st) { v in status = v ?? st }
                }
            }
            VStack(alignment: .leading, spacing: 8) {
                Text("Durée" + (run.part == nil ? " totale" : "")).font(Typo.sans(14.5, .semibold)).foregroundStyle(Palette.ink)
                HStack {
                    Text("\(minutes)").font(Typo.display(44)).foregroundStyle(Palette.ink).contentTransition(.numericText(value: Double(minutes)))
                    Text("min").font(Typo.sans(15)).foregroundStyle(Palette.muted)
                    Spacer()
                    Stepper("", value: $minutes, in: 0...600, step: 5).labelsHidden()
                }
                .animation(.spring(response: 0.3), value: minutes)
            }
            VStack(alignment: .leading, spacing: 8) {
                Text("Ressenti").font(Typo.sans(14.5, .semibold)).foregroundStyle(Palette.ink)
                RPEPicker(k: run.k, value: rpe, target: tg) { v in
                    if let part = run.part {
                        if var a = e["apart"]?[part] { a["rpe"] = v.map { JSON.num(Double($0)) }; var o = e["apart"]?.object ?? [:]; o[part] = a; s.jset(run.k, ["apart": .obj(o)]) }
                    } else { s.jset(run.k, ["rpe": v.map { JSON.num(Double($0)) }]) }
                }
            }
            if run.part == nil { ActFieldsView(k: run.k) }
            HStack(spacing: 10) {
                Button("Retour") { run.finishing = false }.buttonStyle(BigButton(kind: .plain)).frame(maxWidth: 120)
                Button("Enregistrer") {
                    Haptics.success()
                    run.save(minutes: minutes, status: st)
                    toast("Séance enregistrée")
                    onClose()
                }
                .buttonStyle(BigButton())
            }
            .padding(.top, 4)
        }
        .onAppear {
            guard !ready else { return }
            ready = true
            minutes = max(5, Int((Date().timeIntervalSince(run.started) / 60 / 5).rounded()) * 5)
            if let d = e["duree"]?.int, d > 0, e["endedAt"] != nil { minutes = d }
        }
        .sheet(item: $menuFor) { b in BlockMenuSheet(k: run.k, b: b).presentationDetents([.medium, .large]) }
    }
}
