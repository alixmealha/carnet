import SwiftUI

// MARK: forme du matin

struct MorningCard: View {
    let k: String
    @State private var store = Store.shared
    @State private var open: Bool?
    @State private var details = false

    var body: some View {
        let e = store.journal(k), t = Rules.score(e), ro = !store.isSelf
        let isOpen = open ?? (t == nil && !ro)
        let flagged = Rules.FLAGS.filter { e["flags"]?[$0.0]?.truthy == true }
        let w = JournalWriter(store)
        Group {
            if !isOpen {
                Button { withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { open = true } } label: {
                    HStack(alignment: .center, spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Eyebrow("Forme du matin")
                            if let t {
                                HStack(spacing: 8) {
                                    Text("\(t)").font(Typo.display(30)).foregroundColor(Palette.ink) + Text("/25").font(Typo.mono(13)).foregroundColor(Palette.muted)
                                    Pill(Rules.verdict(t, store).label, color: Palette.level(Rules.verdict(t, store).cls))
                                }
                            } else {
                                Text("Pas encore remplie").font(Typo.sans(16)).foregroundStyle(Palette.muted)
                            }
                            if !flagged.isEmpty {
                                Text(flagged.map { f in f.1 + ((e["gene"]?[f.0]?.int).map { " \($0)/10" } ?? "") }.joined(separator: " · "))
                                    .font(Typo.sans(13.5, .medium)).foregroundStyle(Palette.warn)
                            }
                        }
                        Spacer()
                        Text(ro ? "Voir" : "Modifier").font(Typo.sans(14, .semibold)).foregroundStyle(Palette.accent)
                    }
                    .card()
                }
                .buttonStyle(PressStyle())
            } else {
                VStack(alignment: .leading, spacing: 14) {
                    CardHeader("Forme du matin") {
                        if t != nil {
                            Button("Replier") { withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { open = false } }
                                .font(Typo.sans(14, .semibold)).foregroundStyle(Palette.accent)
                        } else {
                            Text("1 = mauvais · 5 = au top").font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                        }
                    }
                    ForEach(Rules.WELL, id: \.key) { x in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(alignment: .firstTextBaseline) {
                                Text(x.label).font(Typo.sans(16, .semibold)).foregroundStyle(Palette.ink)
                                Spacer()
                                Text(x.lo + " → " + x.hi).font(Typo.sans(12)).foregroundStyle(Palette.muted)
                            }
                            DotScale(value: e["well"]?[x.key]?.int) { v in w.setWell(k, x.key, v) }
                        }
                    }
                    .disabled(ro)
                    if let t {
                        let v = Rules.verdict(t, store)
                        HStack(spacing: 10) {
                            HStack(alignment: .firstTextBaseline, spacing: 1) {
                                Text("\(t)").font(Typo.display(40)).foregroundStyle(Palette.level(v.cls)).contentTransition(.numericText())
                                Text("/25").font(Typo.mono(14)).foregroundStyle(Palette.muted)
                            }
                            VStack(alignment: .leading, spacing: 2) {
                                Text(v.label).font(Typo.sans(16, .semibold)).foregroundStyle(Palette.ink)
                                Text(v.text).font(Typo.sans(13.5)).foregroundStyle(Palette.muted)
                            }
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Palette.level(v.cls).opacity(0.1), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .transition(.scale(scale: 0.95).combined(with: .opacity))
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Gêne ou douleur au réveil").font(Typo.sans(14.5, .semibold)).foregroundStyle(Palette.ink)
                        Flow(spacing: 7) {
                            ForEach(0..<Rules.FLAGS.count, id: \.self) { j in
                                let f = Rules.FLAGS[j]
                                Chip(label: f.1, on: e["flags"]?[f.0]?.truthy == true, color: Palette.warn) { w.toggleFlag(k, f.0) }
                            }
                        }
                        ForEach(flagged.map { $0.0 }, id: \.self) { fk in
                            let f = (fk, Rules.flagLabel(fk))
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(f.1 + " : gêne").font(Typo.sans(14.5, .medium)).foregroundStyle(Palette.ink)
                                    Spacer()
                                    Text("0 = rien · 10 = maximale").font(Typo.sans(12)).foregroundStyle(Palette.muted)
                                }
                                NumScale(value: e["gene"]?[f.0]?.int, color: Palette.warn) { v in w.setGene(k, f.0, v) }
                            }
                            .transition(.opacity.combined(with: .move(edge: .top)))
                        }
                        if !flagged.isEmpty { JournalTextField(k: k, name: "precis", label: "Précisions", placeholder: "Côté, endroit exact, ce qui la déclenche…") }
                    }
                    .disabled(ro)
                    DisclosureGroup(isExpanded: $details) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Hier, mangé avant et après la séance ?").font(Typo.sans(14.5)).foregroundStyle(Palette.ink)
                            Segmented(options: Rules.REPAS, value: e["repas"]?.string) { v in store.jset(k, ["repas": v.map { JSON.str($0) }]) }
                        }
                        .padding(.top, 8)
                        .disabled(ro)
                    } label: {
                        Text("Plus de détails").font(Typo.sans(14.5, .semibold)).foregroundStyle(Palette.ink)
                    }
                    .tint(Palette.muted)
                }
                .card()
            }
        }
        .animation(.spring(response: 0.4, dampingFraction: 0.85), value: flagged.count)
        .animation(.spring(response: 0.4, dampingFraction: 0.85), value: t)
        .onChange(of: t) { old, new in
            // forme remplie : la carte se replie toute seule
            if old == nil, new != nil { Task { try? await Task.sleep(nanoseconds: 900_000_000); withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { open = false } } }
        }
    }
}

/// Champ texte enregistré dans le journal du jour (à la fin de la saisie)
struct JournalTextField: View {
    let k: String, name: String, label: String
    var placeholder = ""
    var multiline = false
    @State private var text = ""
    @State private var loaded = false
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(Typo.sans(13.5, .medium)).foregroundStyle(Palette.muted)
            TextField(placeholder, text: $text, axis: multiline ? .vertical : .horizontal)
                .lineLimit(multiline ? 3...8 : 1...1)
                .font(Typo.sans(16))
                .focused($focused)
                .padding(.horizontal, 14).padding(.vertical, 12)
                .background(Palette.sunk, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .onSubmit(commit)
                .onChange(of: focused) { _, f in if !f { commit() } }
        }
        .onAppear { if !loaded { text = Store.shared.journal(k)[name]?.string ?? ""; loaded = true } }
        .onDisappear(perform: commit)
    }
    private func commit() {
        let v = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if (Store.shared.journal(k)[name]?.string ?? "") != v { Store.shared.jset(k, [name: v.isEmpty ? nil : .str(v)]) }
    }
}

// MARK: lecture du jour

struct ReadingCard: View {
    let k: String
    @State private var store = Store.shared
    var body: some View {
        if let r = DayReading.of(k, store) {
            VStack(alignment: .leading, spacing: 12) {
                CardHeader("Lecture du jour")
                HStack(spacing: 10) {
                    Circle().fill(Palette.level(r.level)).frame(width: 12, height: 12)
                        .shadow(color: Palette.level(r.level).opacity(0.6), radius: 4)
                    Text(r.head).font(Typo.sans(16, .semibold)).foregroundStyle(Palette.ink)
                }
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(r.items) { x in
                        HStack(alignment: .top, spacing: 10) {
                            RoundedRectangle(cornerRadius: 2).fill(Palette.level(x.lvl)).frame(width: 3.5)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(x.title).font(Typo.sans(15, .semibold)).foregroundStyle(Palette.ink)
                                GlossText(x.text).font(Typo.sans(14)).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
                                SourcesLine(ids: x.src)
                            }
                        }
                    }
                }
                if let a = r.adapt {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Adaptation prévue au plan").font(Typo.sans(14, .semibold)).foregroundStyle(Palette.ink)
                        GlossText(a).font(Typo.sans(14)).foregroundStyle(Palette.ink)
                    }
                    .padding(12).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Palette.warn.opacity(0.1), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }
            .card(tint: Palette.level(r.level))
        }
    }
}

// MARK: séance

struct SessionCard: View {
    let k: String
    @State private var store = Store.shared
    @State private var menu = false

    var body: some View {
        let e = store.journal(k), pr = PlanReader(store), bl = pr.blocks(k), p = pr.progress(k), d = pr.day(k)
        let ro = !store.isSelf, hasSes = bl.contains { !$0.isRest }
        let active = e["cancel"] == nil && bl.contains { b in !b.isRest && !["apart", "moved", "skip"].contains(PlanReader.blockState(e, b) ?? "") }
        let adj = Adapt.summary(k, store)
        VStack(alignment: .leading, spacing: 14) {
            CardHeader("Séance du jour") {
                HStack(spacing: 10) {
                    if p.total > 0 { Text("\(p.done)/\(p.total) fait").font(Typo.mono(13, .medium)).foregroundStyle(Palette.muted) }
                    if !ro && hasSes {
                        Button { Haptics.tap(); menu = true } label: {
                            Image(systemName: "ellipsis").font(.system(size: 15, weight: .bold)).foregroundStyle(Palette.ink)
                                .frame(width: 34, height: 34).background(Palette.sunk, in: Circle())
                        }
                        .accessibilityLabel("Options de la séance")
                    }
                }
            }
            if let c = e["cancel"] {
                Banner(color: Palette.crit, title: ((c["started"]?.truthy ?? false) ? "Séance arrêtée" : "Séance annulée") + " · " + skipLabel(c["r"]?.string).lowercased(),
                       text: (c["note"]?.string).map { "« " + $0 + " »" }, action: ro ? nil : ("Rétablir la séance", { JournalWriter(store).restore(k); toast("Séance rétablie") }))
            } else if let adj {
                Banner(color: Palette.accent, title: adj.head,
                       text: [adj.dropped.isEmpty ? nil : "Retiré : " + adj.dropped.joined(separator: ", "), adj.tip].compactMap { $0 }.joined(separator: "\n"),
                       action: ro ? nil : ("Revenir à la séance prévue", { Adapt.clear(k, store); toast("Retour à la séance prévue") }))
            }
            if let title = d?["title"]?.string, !title.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    rich(title).font(Typo.sans(19, .semibold)).foregroundStyle(Palette.ink)
                    let info = [d?["duree"]?.string.flatMap { $0 == "—" ? nil : "Durée " + $0 }, d?["essais"]?.string.flatMap { $0 == "—" ? nil : "Essais " + $0 }].compactMap { $0 }
                    if !info.isEmpty { Text(info.joined(separator: " · ")).font(Typo.sans(13.5)).foregroundStyle(Palette.muted) }
                }
            }
            GoalView(k: k)
            if bl.isEmpty { Text("Rien de prévu ce jour-là.").font(Typo.sans(15)).foregroundStyle(Palette.muted) }
            ForEach(bl) { b in BlockView(k: k, b: b, e: e, ro: ro) }
            if e["endedAt"] != nil || p.done > 0 { BilanView(k: k, title: "Bilan") }
            if let a = d?["adapt"]?.string, !a.isEmpty {
                DisclosureGroup {
                    rich(a).font(Typo.sans(14)).foregroundStyle(Palette.ink).padding(.top, 6)
                } label: { Text("Si besoin d’adapter").font(Typo.sans(14, .semibold)).foregroundStyle(Palette.warn) }
                .tint(Palette.warn)
            }
            if active && !ro {
                Button { Haptics.firm(); AppState.shared.session = SessionRef(k: k) } label: {
                    Label(e["startedAt"] != nil && e["endedAt"] == nil ? "Reprendre la séance" : p.done > 0 ? "Continuer la séance" : "Démarrer la séance", systemImage: "play.fill")
                }
                .buttonStyle(BigButton())
            }
        }
        .card()
        .sheet(isPresented: $menu) { SessionMenuSheet(k: k).presentationDetents([.medium, .large]).presentationDragIndicator(.visible) }
    }
}

struct Banner: View {
    let color: Color
    let title: String
    var text: String? = nil
    var action: (String, () -> Void)? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(Typo.sans(15, .semibold)).foregroundStyle(Palette.ink)
            if let text, !text.isEmpty { Text(text).font(Typo.sans(14)).foregroundStyle(Palette.muted) }
            if let action {
                Button(action.0) { Haptics.tap(); action.1() }.buttonStyle(SmallButton(color: color)).padding(.top, 2)
            }
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
        .background(color.opacity(0.09), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(alignment: .leading) { RoundedRectangle(cornerRadius: 2).fill(color).frame(width: 3.5).padding(.vertical, 12) }
    }
}

/// Ressenti visé et pourquoi
struct GoalView: View {
    let k: String
    @State private var store = Store.shared
    var body: some View {
        if let tg = PlanReader(store).target(k), tg.rpe != nil || tg.why != nil {
            HStack(alignment: .top, spacing: 14) {
                if tg.rpe != nil {
                    VStack(alignment: .leading, spacing: 0) {
                        Text("RESSENTI\nVISÉ").font(Typo.mono(10, .medium)).foregroundStyle(Palette.muted).lineSpacing(1)
                        (Text(Rules.rng(tg)).font(Typo.display(34)) + Text("/10").font(Typo.mono(12)).foregroundColor(Palette.muted)).foregroundStyle(Palette.accent)
                    }
                }
                if let why = tg.why { rich(why).font(Typo.sans(14)).foregroundStyle(Palette.ink).fixedSize(horizontal: false, vertical: true) }
            }
            .padding(14).frame(maxWidth: .infinity, alignment: .leading)
            .background(Palette.accentSoft.opacity(0.6), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }
}

struct BlockView: View {
    let k: String
    let b: Block
    let e: JSON
    let ro: Bool
    @State private var menu = false
    var body: some View {
        let bs = PlanReader.blockState(e, b), off = bs == "moved" || bs == "skip"
        let color = Palette.kind(b.isRest ? "rest" : b.kind)
        HStack(alignment: .top, spacing: 12) {
            RoundedRectangle(cornerRadius: 3).fill(color).frame(width: 5)
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline) {
                    GlossText(b.title, gloss: false).font(Typo.display(21)).textCase(.uppercase).foregroundStyle(Palette.ink)
                    Spacer(minLength: 4)
                    if !ro && !b.isRest {
                        Button { Haptics.tap(); menu = true } label: {
                            Image(systemName: "ellipsis").font(.system(size: 14, weight: .bold)).foregroundStyle(Palette.muted)
                                .frame(width: 32, height: 26).background(Palette.sunk.opacity(0.7), in: Capsule())
                        }
                        .accessibilityLabel("Options : " + plain(b.title))
                    }
                }
                stateView(bs)
                if !off {
                    if let desc = b.desc { GlossText(desc).font(Typo.sans(14)).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true) }
                    FingerCalcView(k: k, b: b)
                    if let sub = b.sub { GlossText(sub).font(Typo.sans(13.5)).foregroundStyle(Palette.ink).padding(10).frame(maxWidth: .infinity, alignment: .leading).background(Palette.sunk.opacity(0.6), in: RoundedRectangle(cornerRadius: 10)) }
                    if b.isRest {
                        ForEach(b.items) { it in (rich(it.label) + Text(it.det.map { " · " + $0 } ?? "")).font(Typo.sans(14.5)).foregroundStyle(Palette.ink) }
                    } else {
                        VStack(spacing: 0) {
                            ForEach(b.items) { it in ItemRow(k: k, b: b, it: it, e: e, color: color, ro: ro) }
                        }
                    }
                }
            }
        }
        .opacity(off ? 0.55 : 1)
        .sheet(isPresented: $menu) { BlockMenuSheet(k: k, b: b).presentationDetents([.medium, .large]).presentationDragIndicator(.visible) }
    }
    private func apartDone(_ p: JSON) -> String {
        var s = "Fait à part"
        if let d = p["duree"]?.int { s += " · \(d) min" }
        if let r = p["rpe"]?.int { s += " · ressenti \(r)" }
        return s
    }
    private func apartTodo(_ p: JSON) -> String {
        guard let t = p["startedAt"]?.double else { return "À faire à part" }
        return "À faire à part · commencé à " + Date(timeIntervalSince1970: t / 1000).formatted(date: .omitted, time: .shortened)
    }
    private func apartNoteText(_ note: JSON?) -> String? {
        guard let n = note?["text"]?.string else { return nil }
        return note?["changed"]?.truthy == true ? n + " · ordre changé par rapport au plan" : n
    }
    @ViewBuilder private func stateView(_ bs: String?) -> some View {
        if let mf = b.movedFrom, bs == nil {
            Text("Déplacé du " + D.short(mf).lowercased()).font(Typo.sans(13.5, .medium)).foregroundStyle(Palette.muted)
        } else if bs == "moved" {
            Text("Déplacé au " + D.short(e["moved"]?[b.id]?["to"]?.string ?? k).lowercased()).font(Typo.sans(13.5, .medium)).foregroundStyle(Palette.muted)
        } else if bs == "skip" {
            Text("Pas fait · " + skipLabel(e["skip"]?[b.id]?.string).lowercased()).font(Typo.sans(13.5, .medium)).foregroundStyle(Palette.muted)
        } else if bs == "apart" {
            let p = e["apart"]?[b.id] ?? .emptyObject, note = Core.shared.call("plan.apartNote", .str(k), b.raw)
            if p["endedAt"] != nil {
                VStack(alignment: .leading, spacing: 2) {
                    Text(apartDone(p)).font(Typo.sans(14, .semibold)).foregroundStyle(Palette.good)
                    if let n = apartNoteText(note) { Text(n).font(Typo.sans(13)).foregroundStyle(Palette.muted) }
                }
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    Text(apartTodo(p)).font(Typo.sans(14, .semibold)).foregroundStyle(Palette.accent)
                    Text("À un autre moment de la journée : il aura sa propre durée et son ressenti.").font(Typo.sans(13)).foregroundStyle(Palette.muted)
                    if !ro && k == D.today {
                        Button { Haptics.firm(); AppState.shared.session = SessionRef(k: k, part: b.id) } label: {
                            Label(p["startedAt"] != nil ? "Reprendre" : "Lancer", systemImage: "play.fill")
                        }
                        .buttonStyle(SmallButton())
                    }
                }
                .padding(10).frame(maxWidth: .infinity, alignment: .leading)
                .background(Palette.accentSoft.opacity(0.6), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
    }
}

struct ItemRow: View {
    let k: String
    let b: Block
    let it: Item
    let e: JSON
    let color: Color
    let ro: Bool
    var body: some View {
        let key = PlanReader.itemKey(b, it), v = PlanReader.doneN(e, key, it.n), full = v >= it.n
        let ld = PlanReader.itemLoad(b, it, e)
        let w = JournalWriter()
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 12) {
                Button { Haptics.select(); w.setDone(k, b, it, full ? 0 : it.n) } label: {
                    ZStack {
                        RoundedRectangle(cornerRadius: 8, style: .continuous).fill(full ? color : Color.clear)
                        RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(full ? color : Palette.rule, lineWidth: 1.5)
                        if full { Image(systemName: "checkmark").font(.system(size: 13, weight: .heavy)).foregroundStyle(.white).transition(.scale.combined(with: .opacity)) }
                    }
                    .frame(width: 26, height: 26)
                }
                .disabled(ro)
                .accessibilityLabel(it.label)
                .accessibilityAddTraits(full ? .isSelected : [])
                VStack(alignment: .leading, spacing: 3) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        rich(it.label).font(Typo.sans(15.5, .semibold)).foregroundStyle(full ? Palette.muted : Palette.ink).strikethrough(full, color: Palette.muted)
                        if let ld { Text(PlanReader.loadText(ld.v, ld.u)).font(Typo.mono(12.5, .semibold)).foregroundStyle(ld.changed ? Palette.oil : Palette.accent) }
                        Spacer(minLength: 0)
                        if it.n > 1 { Text("\(v)/\(it.n)").font(Typo.mono(12.5, .medium)).foregroundStyle(Palette.muted) }
                    }
                    if let det = it.det { GlossText(det).font(Typo.sans(13.5)).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true) }
                    DemoLink(it: it)
                    if let note = it.adjNote ?? (it.adjN0.flatMap { $0 != it.n ? "Adapté : \(it.n) au lieu de \($0)" : nil }) {
                        Text(note).font(Typo.sans(12.5, .medium)).foregroundStyle(Palette.accent)
                    }
                    if let warn = it.warn { Text(warn).font(Typo.sans(12.5, .medium)).foregroundStyle(Palette.warn) }
                    LastLine(k: k, b: b, it: it, e: e)
                    if it.isWarmup { WarmupView(k: k, b: b, fold: true).padding(.top, 4) }
                }
            }
            if it.n > 1 && it.n <= 30 {
                Pips(n: it.n, v: v, color: color, size: 30) { nv in w.setDone(k, b, it, nv) }
                    .padding(.leading, 38)
                    .disabled(ro)
            }
        }
        .padding(.vertical, 9)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: v)
    }
}

/// Pastilles des séries : appuyer sur la n-ième coche jusqu'à elle, la rappuyer revient en arrière
struct Pips: View {
    let n: Int, v: Int
    var color: Color = Palette.accent
    var size: CGFloat = 30
    let onSet: (Int) -> Void
    var body: some View {
        Flow(spacing: 6) {
            ForEach(1...max(1, n), id: \.self) { i in
                let on = i <= v
                Button { Haptics.select(); onSet(v == i ? i - 1 : i) } label: {
                    Text("\(i)").font(Typo.mono(size * 0.42, .semibold))
                        .foregroundStyle(on ? Color.white : Palette.muted)
                        .frame(width: size, height: size)
                        .background(on ? color : Palette.sunk, in: RoundedRectangle(cornerRadius: size * 0.3, style: .continuous))
                        .scaleEffect(i == v ? 1.08 : 1)
                }
                .buttonStyle(PressStyle())
                .accessibilityLabel("Série \(i)")
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.6), value: v)
    }
}

// MARK: après la séance

struct AfterCard: View {
    let k: String
    @State private var store = Store.shared
    @State private var open: Bool?
    @State private var dur = ""

    var body: some View {
        let e = store.journal(k), tg = PlanReader(store).target(k), ro = !store.isSelf, t = D.today, p = PlanReader(store).progress(k)
        let filled = e["status"] != nil && e["rpe"]?.int != nil
        let isOpen = open ?? (!filled && (e["startedAt"] != nil || p.done > 0 || (k < t && e["status"] != nil)))
        Group {
            if !isOpen {
                let st = Rules.STATUS.first { $0.0 == e["status"]?.string }?.1
                let rpe = e["rpe"]?.int, du = e["duree"]?.int
                let parts = [st, rpe.map { "ressenti \($0)/10" }, du.flatMap { $0 > 0 ? "\($0) min" : nil }, (rpe != nil && (du ?? 0) > 0) ? "\(rpe! * du!) UA" : nil].compactMap { $0 }
                Button { withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { open = true } } label: {
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Eyebrow("Après la séance")
                            Text(parts.isEmpty ? (k > t ? "À remplir après la séance" : k == t ? "À remplir à la fin de ta séance" : "Pas rempli") : parts.joined(separator: " · "))
                                .font(Typo.sans(16, parts.isEmpty ? .regular : .medium)).foregroundStyle(parts.isEmpty ? Palette.muted : Palette.ink)
                            if let n = e["note"]?.string { Text("« " + n + " »").font(Typo.sans(13.5)).foregroundStyle(Palette.muted).lineLimit(2) }
                        }
                        Spacer()
                        Text(ro ? "Voir" : parts.isEmpty ? "Remplir" : "Modifier").font(Typo.sans(14, .semibold)).foregroundStyle(Palette.accent)
                    }
                    .card()
                }
                .buttonStyle(PressStyle())
            } else {
                VStack(alignment: .leading, spacing: 14) {
                    CardHeader("Après la séance") {
                        Button("Replier") { withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { open = false } }
                            .font(Typo.sans(14, .semibold)).foregroundStyle(Palette.accent)
                    }
                    Segmented(options: Rules.STATUS, value: e["status"]?.string) { v in store.jset(k, ["status": v.map { JSON.str($0) }]) }
                    RPEPicker(k: k, value: e["rpe"]?.int, target: tg) { v in store.jset(k, ["rpe": v.map { JSON.num(Double($0)) }]) }
                    HStack(alignment: .bottom, spacing: 12) {
                        FieldBox(label: "Durée totale (min)") {
                            TextField("", text: $dur).keyboardType(.numberPad).font(Typo.mono(17))
                                .onChange(of: dur) { _, v in
                                    let n = Int(v.filter(\.isNumber))
                                    if n != e["duree"]?.int { store.jset(k, ["duree": n.map { JSON.num(Double($0)) }]) }
                                }
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            let load = (e["rpe"]?.int ?? 0) * (Int(dur) ?? 0)
                            Text(load > 0 ? "\(load) UA" : "—").font(Typo.display(26)).foregroundStyle(Palette.ink)
                            Text("Charge = ressenti × durée").font(Typo.sans(11.5)).foregroundStyle(Palette.muted)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    ActFieldsView(k: k)
                    JournalTextField(k: k, name: "note", label: "Note du jour", placeholder: "Ce que tu as vraiment fait, les sensations…", multiline: true)
                }
                .disabled(ro)
                .card()
                .onAppear { dur = e["duree"]?.int.map { String($0) } ?? "" }
            }
        }
    }
}

/// Ressenti de 0 à 10, avec la zone visée et la comparaison
struct RPEPicker: View {
    let k: String
    let value: Int?
    let target: Target?
    let onChange: (Int?) -> Void
    var body: some View {
        let cmp = Rules.rpeCmp(target, value)
        VStack(alignment: .leading, spacing: 8) {
            NumScale(value: value, target: target?.rpe.map { $0.0...$0.1 }, onChange: onChange)
            Group {
                if let value { Text("Ressenti ") + Text("\(value)/10 · \(Rules.RPE[min(10, max(0, value))])").font(Typo.sans(14.5, .semibold)) }
                else { Text("Ressenti global de 0 à 10, environ 30 min après" + (target?.rpe != nil ? " · en bleu, la zone visée" : "")) }
            }
            .font(Typo.sans(14)).foregroundStyle(Palette.ink)
            if let cmp {
                Text(cmp.text).font(Typo.sans(13.5)).foregroundStyle(cmp.good ? Palette.good : Palette.warn)
                    .padding(10).frame(maxWidth: .infinity, alignment: .leading)
                    .background((cmp.good ? Palette.good : Palette.warn).opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
            }
        }
    }
}

// MARK: sommeil

/// Nuit : durée (− / + par quart d'heure), et les valeurs de la montre si tu en as une (VFC, FC de repos)
struct NightCard: View {
    let k: String
    @State private var store = Store.shared
    @State private var open = false

    var body: some View {
        let e = store.journal(k), n = e["nuit"] ?? .emptyObject, tot = Rules.nightTotal(e), ro = !store.isSelf
        let stages = ["profond", "leger", "rem"].filter { n[$0]?.double != nil }.count >= 2
        let summary = tot.map { Rules.durLong($0) + ((n["vfc"]?.int).map { " · VFC \($0)" } ?? "") } ?? "à renseigner"
        VStack(alignment: .leading, spacing: 14) {
            Button { withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { open.toggle() } } label: {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Eyebrow("Sommeil")
                        Text(summary).font(Typo.sans(16, tot == nil ? .regular : .medium)).foregroundStyle(tot == nil ? Palette.muted : Palette.ink)
                    }
                    Spacer()
                    Image(systemName: "chevron.down").font(.system(size: 13, weight: .semibold)).foregroundStyle(Palette.muted).rotationEffect(.degrees(open ? 180 : 0))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if open {
                Group {
                if stages, let tot {
                    Text("Durée calculée avec les phases de ta montre : " + Rules.durLong(tot) + ".").font(Typo.sans(14)).foregroundStyle(Palette.muted)
                } else {
                    HStack(spacing: 0) {
                        stepButton("minus") { setTotal((tot ?? 450) - 15) }
                        VStack(spacing: 0) {
                            Text(tot.map { Rules.durLong($0) } ?? "—").font(Typo.display(36)).foregroundStyle(Palette.ink)
                                .contentTransition(.numericText(value: Double(tot ?? 0)))
                            Text(tot == nil ? "appuie sur + ou −" : "durée de sommeil").font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                        }
                        .frame(maxWidth: .infinity)
                        stepButton("plus") { setTotal((tot ?? 435) + 15) }
                    }
                    .padding(6)
                    .background(Palette.sunk.opacity(0.6), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .animation(.spring(response: 0.3, dampingFraction: 0.8), value: tot)
                }
                HStack(spacing: 10) {
                    MetricField(k: k, key: "vfc", label: "VFC (ms)")
                    MetricField(k: k, key: "fcr", label: "FC repos")
                    MetricField(k: k, key: "recup", label: "Récup (%)")
                }
                Text("Facultatif : les valeurs de ta montre (Garmin, WHOOP, Apple, Polar…). La lecture du jour s’en sert.").font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                }
                .disabled(ro)
            }
        }
        .card()
    }
    private func setTotal(_ m: Int) {
        var n = store.journal(k)["nuit"]?.object ?? [:]
        n["total"] = .num(Double(max(0, min(16 * 60, m))))
        store.jset(k, ["nuit": .obj(n)])
    }
    private func stepButton(_ icon: String, _ action: @escaping () -> Void) -> some View {
        Button { Haptics.select(); action() } label: {
            Image(systemName: icon).font(.system(size: 18, weight: .bold)).foregroundStyle(Palette.ink)
                .frame(width: 54, height: 54).background(Palette.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(PressStyle())
    }
}

/// Valeur entière de la nuit (VFC, FC, récupération), enregistrée à la fin de la saisie
struct MetricField: View {
    let k: String, key: String, label: String
    @State private var text = ""
    @State private var loaded = false
    @FocusState private var focused: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(Typo.sans(12.5, .medium)).foregroundStyle(Palette.muted).lineLimit(1)
            TextField("—", text: $text).keyboardType(.numberPad).font(Typo.mono(17, .medium))
                .focused($focused)
                .padding(.horizontal, 12).frame(minHeight: 44)
                .background(Palette.sunk, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                .onChange(of: focused) { _, f in if !f { commit() } }
        }
        .onAppear { if !loaded { text = (Store.shared.journal(k)["nuit"]?[key]?.int).map { String($0) } ?? ""; loaded = true } }
        .onDisappear(perform: commit)
    }
    private func commit() {
        let s = Store.shared, v = Int(text.filter(\.isNumber))
        var n = s.journal(k)["nuit"]?.object ?? [:]
        if n[key]?.int == v { return }
        if let v { n[key] = .num(Double(v)) } else { n.removeValue(forKey: key) }
        s.jset(k, ["nuit": n.isEmpty ? nil : .obj(n)])
    }
}
