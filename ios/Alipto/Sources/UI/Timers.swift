import SwiftUI

/// Repos entre les séries : panneau en bas de l'écran, avec l'anneau qui se vide
struct RestPanel: View {
    let run: SessionRunner
    let rest: SessionRunner.Rest
    var body: some View {
        let left = max(0, rest.until.timeIntervalSince(run.now)), frac = rest.total > 0 ? left / rest.total : 0
        let bg = rest.hold ? Palette.accent : Palette.ink, fg = rest.hold ? Palette.accentInk : Palette.bg
        VStack(spacing: 14) {
            HStack(spacing: 16) {
                ZStack {
                    Circle().stroke(fg.opacity(0.15), lineWidth: 6)
                    Circle().trim(from: 0, to: frac).stroke(fg, style: StrokeStyle(lineWidth: 6, lineCap: .round)).rotationEffect(.degrees(-90))
                        .animation(.linear(duration: 0.1), value: frac)
                }
                .frame(width: 58, height: 58)
                VStack(alignment: .leading, spacing: 0) {
                    Text(left > 0 ? Fmt.mmss(left) : (rest.hold ? "Lâche" : "Go"))
                        .font(Typo.display(54)).foregroundStyle(fg).monospacedDigit()
                        .contentTransition(.numericText(countsDown: true))
                        .animation(.snappy, value: Int(left.rounded(.up)))
                    Text(left > 0 ? rest.label : rest.hold ? "Terminé" : "C’est reparti")
                        .font(Typo.sans(14, .medium)).foregroundStyle(fg.opacity(0.75)).lineLimit(2)
                }
                Spacer(minLength: 0)
            }
            HStack(spacing: 8) {
                if !rest.hold {
                    pill("−15 s") { run.addRest(-15) }
                    pill("+15 s") { run.addRest(15) }
                }
                Button { Haptics.tap(); run.endRest() } label: {
                    Text(rest.hold ? "Fini" : "Passer").font(Typo.sans(16, .semibold)).foregroundStyle(bg)
                        .frame(maxWidth: .infinity, minHeight: 46).background(fg, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                }
                .buttonStyle(PressStyle())
            }
        }
        .padding(18)
        .background(bg, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .shadow(color: .black.opacity(0.25), radius: 20, y: 8)
        .padding(.horizontal, 12).padding(.bottom, 8)
    }
    private func pill(_ t: String, _ a: @escaping () -> Void) -> some View {
        let fg = rest.hold ? Palette.accentInk : Palette.bg
        return Button { Haptics.tap(); a() } label: {
            Text(t).font(Typo.sans(15, .semibold)).foregroundStyle(fg)
                .frame(maxWidth: .infinity, minHeight: 46).background(fg.opacity(0.13), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
        }
        .buttonStyle(PressStyle())
    }
}

/// Minuteur à intervalles (suspensions, circuits) et tempo : plein écran, couleur selon la phase
struct IntervalTimerView: View {
    let run: SessionRunner
    var body: some View {
        if let t = run.timer {
            let n = run.now, idx = t.index(n), ph = t.phases[idx], left = t.left(n), sec = Int(left.rounded(.up))
            let el = t.elapsed(n), total = max(1, t.total)
            let (bg, fg): (Color, Color) = {
                switch ph.type {
                case "work", "ecc": return (Palette.accent, Palette.accentInk)
                case "done": return (Palette.good, .white)
                case "rest", "ret": return (Palette.surface, Palette.ink)
                case "sw": return (Palette.oil, Color(hex: 0x15191e))
                default: return (Palette.ink, Palette.bg)
                }
            }()
            let phaseLabel = ph.type == "setrest" ? "Repos · ensuite " + (ph.side?.lowercased() ?? "la série \(ph.set)") : ph.label
            let nextWork = t.phases[(idx + 1)...].first { $0.isWork }
            ZStack {
                bg.ignoresSafeArea()
                VStack(spacing: 0) {
                    HStack {
                        Text(t.title).font(Typo.sans(15, .semibold)).foregroundStyle(fg.opacity(0.8)).lineLimit(1)
                        Spacer()
                        Button(ph.type == "done" ? "Fermer" : "Arrêter") { Haptics.tap(); run.closeTimer() }
                            .font(Typo.sans(15, .semibold)).foregroundStyle(fg)
                            .padding(.horizontal, 14).frame(minHeight: 36).background(fg.opacity(0.14), in: Capsule())
                    }
                    .padding(.horizontal, 20).padding(.top, 12)
                    Spacer()
                    Text(phaseLabel.uppercased()).font(Typo.display(30)).foregroundStyle(fg).multilineTextAlignment(.center)
                        .padding(.horizontal, 20)
                    Text(ph.type == "done" ? "✓" : ph.dur >= 60 ? Fmt.mmss(Double(sec)) : "\(sec)")
                        .font(Typo.display(ph.dur >= 60 ? 150 : 210)).foregroundStyle(fg).monospacedDigit()
                        .contentTransition(.numericText(countsDown: true))
                        .animation(.snappy(duration: 0.25), value: sec)
                        .minimumScaleFactor(0.5).lineLimit(1)
                    Text(subtitle(t, ph)).font(Typo.sans(17, .medium)).foregroundStyle(fg.opacity(0.8)).multilineTextAlignment(.center).padding(.horizontal, 20)
                    if t.tempo && !["done", "setrest"].contains(ph.type) {
                        let doneReps = ph.type == "ecc" ? ph.rep - 1 : ph.type == "ret" ? ph.rep : ph.type == "sw" ? t.reps : 0
                        HStack(spacing: 6) {
                            ForEach(0..<max(1, t.reps), id: \.self) { i in Circle().fill(i < doneReps ? fg : fg.opacity(0.2)).frame(width: 10, height: 10) }
                        }
                        .padding(.top, 14)
                    }
                    Spacer()
                    if t.pausedAt != nil { Text("En pause").font(Typo.mono(14, .semibold)).foregroundStyle(fg).padding(.bottom, 8) }
                    if let nw = nextWork, !ph.isWork, ph.type != "done" {
                        Text("Ensuite : " + (nw.side.map { $0.lowercased() + ", " } ?? "") + nw.label.lowercased() + " " + (nw.dur >= 60 ? Fmt.mmss(nw.dur) : Fmt.num(nw.dur) + " s"))
                            .font(Typo.sans(15)).foregroundStyle(fg.opacity(0.75)).padding(.bottom, 10)
                    }
                    GeometryReader { g in
                        ZStack(alignment: .leading) {
                            Capsule().fill(fg.opacity(0.15))
                            Capsule().fill(fg).frame(width: g.size.width * min(1, el / total))
                        }
                    }
                    .frame(height: 6).padding(.horizontal, 20)
                    if ph.type != "done" {
                        HStack(spacing: 10) {
                            ctl(t.pausedAt != nil ? "Reprendre" : "Pause", fg) { run.toggleTimer() }
                            ctl("Passer", fg) { run.skipPhase() }
                        }
                        .padding(.horizontal, 20).padding(.top, 16)
                    }
                }
                .padding(.bottom, 20)
            }
            .animation(.easeInOut(duration: 0.3), value: ph.type)
        }
    }
    private func subtitle(_ t: SessionRunner.IntervalRun, _ ph: Phase) -> String {
        if ph.type == "done" { return "Les séries sont cochées dans la séance." }
        if ph.type == "sw" { return "Ensuite : " + (ph.side ?? "autre côté").lowercased() }
        return [ph.side, ph.set > 0 ? "série \(ph.set)/\(t.sets)" : nil, ph.rep > 0 ? "répétition \(ph.rep)/\(t.reps)" : nil].compactMap { $0 }.joined(separator: " · ")
    }
    private func ctl(_ t: String, _ fg: Color, _ a: @escaping () -> Void) -> some View {
        Button { Haptics.tap(); a() } label: {
            Text(t).font(Typo.sans(17, .semibold)).foregroundStyle(fg)
                .frame(maxWidth: .infinity, minHeight: 56).background(fg.opacity(0.14), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(PressStyle())
    }
}

/// Mode blocs : « Bloc fini » lance le repos, « Tombé » compte aussi et note la chute ; cotation réglable
struct ClimbView: View {
    let run: SessionRunner
    var body: some View {
        if let c = run.climb {
            let n = run.now, it = c.it, key = PlanReader.itemKey(c.b, it), e = Store.shared.journal(run.k)
            let v = PlanReader.doneN(e, key, it.n), p = PlanReader.plusN(e, key), over = v >= it.n, no = v + p + 1, falls = e["falls"]?[key]?.int ?? 0, t = c.t(n)
            let W = it.unit == "Essai" ? "Essai" : it.unit == "Voie" ? "Voie" : "Bloc", wl = W.lowercased()
            let restLeft = c.ph == "rest" ? max(0, c.dur - t) : 0
            let (bg, fg): (Color, Color) = c.ph == "wall" ? (Palette.accent, Palette.accentInk) : c.ph == "rest" ? (Palette.ink, Palette.bg) : (Palette.good, .white)
            ZStack {
                bg.ignoresSafeArea()
                VStack(spacing: 0) {
                    HStack {
                        rich(it.label).font(Typo.sans(15, .semibold)).foregroundStyle(fg.opacity(0.8)).lineLimit(1)
                        Spacer()
                        Button(c.ph == "done" ? "Fermer" : "Arrêter") { Haptics.tap(); run.climb = nil; Signals.cancel("rest") }
                            .font(Typo.sans(15, .semibold)).foregroundStyle(fg)
                            .padding(.horizontal, 14).frame(minHeight: 36).background(fg.opacity(0.14), in: Capsule())
                    }
                    .padding(.horizontal, 20).padding(.top, 12)
                    if c.ph != "done" {
                        HStack(spacing: 18) {
                            gradeButton("minus", fg) { run.climbGrade(-1) }
                            Text(c.grade ?? "cotation ?").font(Typo.display(34)).foregroundStyle(fg).frame(minWidth: 110)
                            gradeButton("plus", fg) { run.climbGrade(1) }
                        }
                        .padding(.top, 18)
                    }
                    Spacer()
                    switch c.ph {
                    case "wall":
                        Text("\(W) en cours".uppercased()).font(Typo.display(28)).foregroundStyle(fg)
                        (Text("\(no)").font(Typo.display(170)) + Text(over ? " · en plus" : "/\(it.n)").font(Typo.display(over ? 36 : 50)))
                            .foregroundStyle(fg).contentTransition(.numericText())
                        Text("sur \(it.unit == "Voie" ? "la" : "le") \(wl) depuis " + Fmt.mmss(t) + (c.pausedAt != nil ? " · en pause" : ""))
                            .font(Typo.sans(17, .medium)).foregroundStyle(fg.opacity(0.8)).monospacedDigit()
                    case "rest":
                        Text("Repos · ensuite \(wl) \(no)".uppercased()).font(Typo.display(28)).foregroundStyle(fg)
                        Text(Fmt.mmss(restLeft)).font(Typo.display(150)).foregroundStyle(fg).monospacedDigit()
                            .contentTransition(.numericText(countsDown: true)).animation(.snappy, value: Int(restLeft.rounded(.up)))
                        Text("\(v + p) fait\(v + p > 1 ? "s" : "")" + (over ? " (\(p) en plus)" : " · \(it.n - v) restant\(it.n - v > 1 ? "s" : "")") + (falls > 0 ? " · \(falls) chute\(falls > 1 ? "s" : "")" : ""))
                            .font(Typo.sans(17, .medium)).foregroundStyle(fg.opacity(0.8))
                    default:
                        Text("TERMINÉ").font(Typo.display(34)).foregroundStyle(fg)
                        Text("✓").font(Typo.display(150)).foregroundStyle(fg)
                        Text("\(v + p) \(wl)\(v + p > 1 ? "s" : "")" + (p > 0 ? " (dont \(p) en plus)" : "") + (falls > 0 ? " · \(falls) chute\(falls > 1 ? "s" : "")" : "")).font(Typo.sans(17, .medium)).foregroundStyle(fg.opacity(0.8))
                    }
                    if it.n <= 40 && c.ph != "done" {
                        HStack(spacing: 5) { ForEach(0..<it.n, id: \.self) { i in Circle().fill(i < v ? fg : fg.opacity(0.2)).frame(width: 9, height: 9) } }
                            .padding(.top, 14)
                    }
                    Spacer()
                    VStack(spacing: 10) {
                        if c.ph == "wall" {
                            Button { Haptics.success(); run.climbFinish(fell: false) } label: {
                                Text(it.unit == "Essai" ? "Réussi" : W + " fini" + (it.unit == "Voie" ? "e" : "")).font(Typo.display(30))
                                    .foregroundStyle(bg).frame(maxWidth: .infinity, minHeight: 92)
                                    .background(fg, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
                            }
                            .buttonStyle(PressStyle())
                            HStack(spacing: 10) {
                                ctl(c.pausedAt != nil ? "Reprendre" : "Pause", fg) { run.climbToggle() }
                                ctl("Tombé · " + (it.unit == "Essai" ? "essai compté" : "compte quand même"), fg) { Haptics.warning(); run.climbFinish(fell: true) }
                            }
                        } else if c.ph == "done" {
                            Button { Haptics.firm(); run.climbGo() } label: {
                                Text("Un \(wl) de plus").font(Typo.display(30))
                                    .foregroundStyle(bg).frame(maxWidth: .infinity, minHeight: 92)
                                    .background(fg, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
                            }
                            .buttonStyle(PressStyle())
                        } else if c.ph == "rest" {
                            HStack(spacing: 10) {
                                ctl("−15 s", fg) { run.climbAdd(-15) }
                                ctl("+15 s", fg) { run.climbAdd(15) }
                                ctl("Go", fg) { run.climbGo() }
                            }
                            HStack(spacing: 10) {
                                ctl(c.pausedAt != nil ? "Reprendre" : "Pause", fg) { run.climbToggle() }
                                ctl("Annuler le dernier \(wl)", fg) { run.climbUndo() }
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                }
                .padding(.bottom, 20)
            }
            .animation(.easeInOut(duration: 0.3), value: c.ph)
        }
    }
    private func gradeButton(_ icon: String, _ fg: Color, _ a: @escaping () -> Void) -> some View {
        Button { Haptics.select(); a() } label: {
            Image(systemName: icon).font(.system(size: 18, weight: .bold)).foregroundStyle(fg)
                .frame(width: 48, height: 48).background(fg.opacity(0.14), in: Circle())
        }
    }
    private func ctl(_ t: String, _ fg: Color, _ a: @escaping () -> Void) -> some View {
        Button { Haptics.tap(); a() } label: {
            Text(t).font(Typo.sans(15.5, .semibold)).foregroundStyle(fg).multilineTextAlignment(.center)
                .frame(maxWidth: .infinity, minHeight: 54).background(fg.opacity(0.14), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(PressStyle())
    }
}
