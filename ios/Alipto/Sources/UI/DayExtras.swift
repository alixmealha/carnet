import SwiftUI

// Fiche du jour, suite : échauffement conseillé, activité et exercices réalisés, dernière fois et charge conseillée,
// bilan, menu d'un bloc, calcul des charges doigts, tests du jour, échanges avec le coach, bilan de la semaine.

private let STRONG: Set<String> = ["muscu", "renfo", "doigts", "epaule"]

// MARK: échauffement (méthode RAMP)

struct WarmupView: View {
    let k: String
    let b: Block
    var fold = true
    var onTimer: ((TimerSpec) -> Void)? = nil
    @State private var open = false
    @State private var on: Set<Int> = []

    var body: some View {
        if let w = Core.shared.call("warmup.warmupFor", .str(k), b.raw) {
            let steps = w["steps"]?.array ?? [], ph = Core.shared.constant("warmup.PH_LBL")
            let head = HStack(spacing: 8) {
                Image(systemName: "flame").font(.system(size: 14, weight: .semibold)).foregroundStyle(Palette.oil)
                Text("Échauffement conseillé").font(Typo.sans(15, .semibold)).foregroundStyle(Palette.ink)
                Text("≈ \(w["min"]?.int ?? 10) min · RAMP").font(Typo.mono(12)).foregroundStyle(Palette.muted)
                Spacer(minLength: 0)
            }
            if fold && !open {
                Button { withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) { open = true } } label: {
                    HStack {
                        head
                        Image(systemName: "chevron.down").font(.system(size: 12, weight: .semibold)).foregroundStyle(Palette.muted)
                    }
                        .padding(12).background(Palette.oil.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    if fold {
                        Button { withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) { open = false } } label: {
                            HStack {
                                head
                                Image(systemName: "chevron.up").font(.system(size: 12, weight: .semibold)).foregroundStyle(Palette.muted)
                            }
                        }
                        .buttonStyle(.plain)
                    } else { head }
                    ForEach(steps.indices, id: \.self) { i in
                        let x = steps[i], p = x["ph"]?.string ?? ""
                        if i == 0 || steps[i - 1]["ph"]?.string != p {
                            Eyebrow(ph[p]?.string ?? p, color: Palette.oil).padding(.top, i == 0 ? 0 : 4)
                        }
                        HStack(alignment: .top, spacing: 10) {
                            Button { Haptics.select(); if on.contains(i) { on.remove(i) } else { on.insert(i) } } label: {
                                ZStack {
                                    Circle().strokeBorder(on.contains(i) ? Palette.good : Palette.rule, lineWidth: 1.5)
                                    if on.contains(i) {
                                        Circle().fill(Palette.good)
                                        Image(systemName: "checkmark").font(.system(size: 10, weight: .heavy)).foregroundStyle(.white)
                                    }
                                }
                                .frame(width: 22, height: 22)
                            }
                            .accessibilityLabel((x["t"]?.string ?? "") + (on.contains(i) ? " : fait" : " : à faire"))
                            VStack(alignment: .leading, spacing: 3) {
                                Text(x["t"]?.string ?? "").font(Typo.sans(15, .semibold)).foregroundStyle(on.contains(i) ? Palette.muted : Palette.ink)
                                GlossText(x["d"]?.string).font(Typo.sans(13.5)).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
                                if let t = x["timer"], t != .null, let onTimer {
                                    let T = TimerSpec(raw: t)
                                    Button { Haptics.firm(); onTimer(T) } label: { Label("Lancer le minuteur \(Fmt.num(T.work))/\(Fmt.num(T.rest))", systemImage: "timer") }
                                        .buttonStyle(SmallButton()).padding(.top, 4)
                                }
                            }
                        }
                    }
                    GlossText(w["why"]?.string).font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                    SourcesLine(ids: ["jeffreys2007", "mcgowan2015"] + (steps.contains { $0["src"] != nil } ? ["remilieux"] : []))
                }
                .padding(12)
                .background(Palette.oil.opacity(0.07), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
        }
    }
}

// MARK: dernière fois et charge conseillée

/// « Dernière fois · mar. 13 oct. : 5 × 4 · +12,5 kg → conseillé +15 kg » sous un exercice de force
struct LastLine: View {
    let k: String, b: Block, it: Item, e: JSON
    var body: some View {
        let ld = PlanReader.itemLoad(b, it, e), full = PlanReader.doneN(e, PlanReader.itemKey(b, it), it.n) >= it.n
        if STRONG.contains(b.kind), !it.isWarmup, !full, k >= D.today {
            let sg = (ld == nil || !(ld!.changed)) ? Core.shared.call("history.suggestLoad", b.raw, it.raw, .str(k)) : nil
            let lp = sg?["last"] ?? Core.shared.call("history.lastPerf", .str(it.label), .str(k), it.raw["lib"] ?? .null)
            if let lp, let txt = Core.shared.call("history.perfText", lp)?.string {
                let more = (sg != nil && (ld == nil || sg?["v"]?.double != ld?.v)) ? " → conseillé " + (sg?["text"]?.string ?? "") : ""
                Text("Dernière fois · " + txt + more).font(Typo.sans(12.5, .medium)).foregroundStyle(more.isEmpty ? Palette.muted : Palette.accent)
            }
        }
    }
}

/// Dans le mode séance : charge conseillée d'après la dernière séance, ou charge du jour à noter
struct SuggestBox: View {
    let k: String, b: Block, it: Item
    @State private var own = ""
    var body: some View {
        let s = Store.shared, e = s.journal(k), ld = PlanReader.itemLoad(b, it, e)
        let sug = STRONG.contains(b.kind) && !it.isWarmup ? Core.shared.call("history.suggestLoad", b.raw, it.raw, .str(k)) : nil
        if let ld {
            if let sug, it.load != nil, sug["v"]?.double != ld.v, !ld.changed {
                box(title: "Conseillé d’après ta dernière séance", value: sug["text"]?.string ?? "", why: sug["why"]?.string) {
                    Core.shared.call("history.applySuggested", .str(k), b.raw, it.raw, sug); toast("Charge mise à jour")
                }
            }
        } else if STRONG.contains(b.kind), !it.isWarmup, showsLoadInput(e) {
            VStack(alignment: .leading, spacing: 10) {
                if let sug {
                    box(title: "Charge conseillée", value: sug["text"]?.string ?? "", why: sug["why"]?.string) {
                        Core.shared.call("history.applySuggested", .str(k), b.raw, it.raw, sug); toast("Charge du jour notée")
                    }
                } else {
                    Text(it.raw["repsBySet"] != nil ? "Première fois : une charge très légère, que tu soulèverais bien plus de 30 fois sans brassards." : it.raw["rx"]?["r"] != nil ? "Première fois : prends une charge qui respecte la fourchette et la réserve visées." : "Note la charge pour suivre ta progression.")
                        .font(Typo.sans(13.5)).foregroundStyle(Palette.muted)
                }
                NumberField(label: sug != nil ? "Autre charge (kg)" : it.unitLoad == "+kg" ? "Lest (kg)" : "Charge (kg)", value: nil, placeholder: "kg") { v in
                    guard let v else { return }
                    var loads = s.journal(k)["loads"]?.object ?? [:]; loads[PlanReader.itemKey(b, it)] = .num(v); s.jset(k, ["loads": .obj(loads)])
                }
            }
        }
    }
    private func showsLoadInput(_ e: JSON) -> Bool {
        if it.timer != nil && it.unitLoad != "+kg" { return false }
        if let lib = it.lib, let x = Core.shared.constant("library.LIB_BY_ID")[lib] {
            let t = x["t"]?.string, ld = x["ld"]?.string
            if t == "iso" || t == "mob" || (ld == "bw" && it.raw["unit_load"] == nil) { return false }
        }
        return true
    }
    private func box(title: String, value: String, why: String?, use: @escaping () -> Void) -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(Typo.sans(12.5, .medium)).foregroundStyle(Palette.muted)
                Text(value).font(Typo.display(26)).foregroundStyle(Palette.accent)
                if let why { GlossText(why).font(Typo.sans(13)).foregroundStyle(Palette.ink).fixedSize(horizontal: false, vertical: true) }
            }
            Spacer(minLength: 0)
            Button("Utiliser") { Haptics.success(); use() }.buttonStyle(SmallButton())
        }
        .padding(12).background(Palette.accentSoft.opacity(0.7), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

/// Conseil pour la prochaine séance de grimpe (chutes et ressenti de la dernière fois)
struct ClimbSuggestBox: View {
    let k: String, b: Block, it: Item
    var body: some View {
        if let sg = Core.shared.call("extra.climbSuggestOf", .str(k), .str(b.id), .str(it.id)) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Conseillé d’après ta dernière séance").font(Typo.sans(12.5, .medium)).foregroundStyle(Palette.muted)
                    Text(sg["text"]?.string ?? "").font(Typo.sans(17, .semibold)).foregroundStyle(Palette.accent)
                    GlossText(sg["why"]?.string).font(Typo.sans(13)).foregroundStyle(Palette.ink).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                if sg["canApply"]?.truthy == true {
                    Button("Utiliser") { Haptics.success(); Core.shared.call("extra.climbSuggestApply", .str(k), .str(b.id), .str(it.id)); toast("Séance ajustée") }.buttonStyle(SmallButton())
                }
            }
            .padding(12).background(Palette.accentSoft.opacity(0.7), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }
}

/// Lien vers la vidéo de démonstration d'un exercice (gardée dans le plan)
struct DemoLink: View {
    let it: Item
    var big = false
    var body: some View {
        if let u = Core.shared.call("plan.demoOf", it.raw)?.string, let url = URL(string: u) {
            if big {
                Link(destination: url) { Label("Voir la démo", systemImage: "play.rectangle") }.buttonStyle(SmallButton())
            } else {
                Link(destination: url) { Label("Démo", systemImage: "play.fill").font(Typo.sans(12.5, .semibold)) }.foregroundStyle(Palette.accent)
            }
        }
    }
}

// MARK: bilan chiffré

struct BilanView: View {
    let k: String
    var part: String? = nil
    var title: String? = nil
    var body: some View {
        let rows = Core.shared.call("quantify.sessionBilan", .str(k), part.map { JSON.str($0) } ?? .null)?.array ?? []
        if !rows.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                if let title { Eyebrow(title) }
                ForEach(rows.indices, id: \.self) { i in
                    let x = rows[i], rec = x["rec"]?.truthy == true
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            if rec { Image(systemName: "trophy.fill").font(.system(size: 12)).foregroundStyle(Palette.oil) }
                            GlossText(x["label"]?.string, gloss: false).font(Typo.sans(14.5, .semibold)).foregroundStyle(rec ? Palette.oil : Palette.ink)
                        }
                        ForEach((x["lines"]?.array ?? []).indices, id: \.self) { j in
                            Text(x["lines"]?[j]?.string ?? "").font(Typo.sans(13.5)).foregroundStyle(Palette.muted)
                        }
                    }
                }
            }
            .padding(12).frame(maxWidth: .infinity, alignment: .leading)
            .background(Palette.sunk.opacity(0.6), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }
}

// MARK: menu d'un bloc

/// « Pas possible maintenant ? » : à un autre moment du jour, un autre jour, ou pas fait (avec la raison)
struct BlockMenuSheet: View {
    let k: String
    let b: Block
    @Environment(\.dismiss) private var dismiss
    @State private var mode: String?
    @State private var pick: String?
    @State private var lib = ""
    @State private var intensity = ""
    @State private var unit = "kg"
    @State private var how: Set<String> = []
    var body: some View {
        let s = Store.shared, e = s.journal(k), st = PlanReader.blockState(e, b), t = D.today, name = plain(b.title)
        let real = PlanReader(s).blocks(k).filter { !$0.isRest && $0.id != b.id && PlanReader.blockState(e, $0) == nil }
        let isFirst = PlanReader(s).blocks(k).first { !$0.isRest && PlanReader.blockState(e, $0) == nil }?.id == b.id
        let hasOrder = !(e["order"]?.array ?? []).isEmpty
        let swappable = b.items.filter { !$0.isWarmup && !$0.isCooldown && !$0.opt }
        let days = Core.shared.call("plan.moveTargets", .str(k))?.array.compactMap { $0.string } ?? [], apart = e["apart"]?[b.id]
        let coach = s.isSelf && !s.coaches.isEmpty
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    if let st {
                        Banner(color: Palette.accent, title: st == "apart" ? (apart?["endedAt"] != nil ? "Fait à part." : "À faire à part, à un autre moment de la journée.") : st == "moved" ? "Déplacé au " + D.short(e["moved"]?[b.id]?["to"]?.string ?? k).lowercased() + "." : "Pas fait · " + skipLabel(e["skip"]?[b.id]?.string).lowercased() + ".",
                               action: (st == "apart" && apart?["endedAt"] != nil) ? nil : ("Remettre dans la séance", {
                                   if st == "moved" { Core.shared.call("plan.unmoveBlock", .str(k), b.raw) } else { JournalWriter(s).setBlockState(k, b, nil) }
                                   done("Remis dans la séance")
                               }))
                    }
                    if st != "apart" {
                        OptionRow(title: k == t ? "À un autre moment de la journée" : "À part ce jour-là", text: "Avant ou après la séance, par exemple le matin pour grimper l’après-midi. Il aura sa propre durée et son ressenti.", icon: "clock.arrow.circlepath") {
                            JournalWriter(s).setBlockState(k, b, "apart"); done(name + " : à faire à part")
                        }
                    }
                    if st != "moved" {
                        OptionRow(title: "Un autre jour", text: s.planLocked ? "Ton plan est verrouillé par ton coach : demande-lui, ou fais-le à part aujourd’hui." : "Le bloc est ajouté au plan du jour choisi.", icon: "calendar", on: mode == "day") { mode = mode == "day" ? nil : "day" }
                        if mode == "day" && !s.planLocked {
                            ForEach(days, id: \.self) { d in
                                let warn = Core.shared.call("extra.moveWarn", .str(k), .str(b.id), .str(d))?.string
                                Button {
                                    Core.shared.call("plan.moveBlock", .str(k), b.raw, .str(d)); done(name + " déplacé au " + D.short(d).lowercased())
                                } label: {
                                    VStack(alignment: .leading, spacing: 2) {
                                        HStack {
                                            Text(d == t ? "Aujourd’hui" : D.short(d)).font(Typo.sans(15, .semibold)).foregroundStyle(Palette.ink).frame(width: 110, alignment: .leading)
                                            Text(plain(PlanReader(s).sessionName(d))).font(Typo.sans(14)).foregroundStyle(Palette.muted).lineLimit(1)
                                            Spacer()
                                        }
                                        if let warn { Text(warn).font(Typo.sans(12.5, .medium)).foregroundStyle(Palette.warn) }
                                    }
                                    .padding(.horizontal, 14).padding(.vertical, 10)
                                    .background(Palette.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                                }
                                .buttonStyle(PressStyle())
                            }
                        }
                    }
                    if st == nil, !real.isEmpty {
                        OptionRow(title: "Je l’ai fait à un autre moment de la séance", text: "Par exemple après la grimpe au lieu d’avant. Le plan ne change pas, ton journal garde l’ordre réel.", icon: "arrow.up.arrow.down", on: mode == "order") { mode = mode == "order" ? nil : "order" }
                        if mode == "order" {
                            if !isFirst { choice("En premier", nil) { JournalWriter(s).placeBlock(k, b, after: nil); done(name + " : fait en premier") } }
                            ForEach(real) { x in
                                choice("Juste après", plain(x.title)) { JournalWriter(s).placeBlock(k, b, after: x.id); done(name + " : fait après " + plain(x.title).lowercased()) }
                            }
                            if hasOrder { choice("Remettre l’ordre prévu", nil) { JournalWriter(s).resetOrder(k); done("Ordre prévu remis") } }
                        }
                    }
                    if st == nil, !swappable.isEmpty {
                        OptionRow(title: "J’ai fait un autre exercice", text: "Matériel absent, autre choix : tu notes ce que tu as fait à la place. Le plan ne change pas.", icon: "arrow.triangle.swap", on: mode == "swap") {
                            mode = mode == "swap" ? nil : "swap"
                            if mode == "swap", swappable.count == 1 { openSwap(swappable[0], e) }
                        }
                        if mode == "swap" { swapForm(swappable, e) }
                    }
                    if st != "skip" {
                        OptionRow(title: "Je ne le fais pas", text: "La raison est gardée dans le journal" + (coach ? " et ton coach la voit." : "."), icon: "xmark.circle", on: mode == "skip", danger: true) { mode = mode == "skip" ? nil : "skip" }
                        if mode == "skip" {
                            Flow(spacing: 6) {
                                ForEach(SKIP.map { $0.0 }, id: \.self) { v in
                                    Chip(label: skipLabel(v), on: false, color: Palette.crit) { JournalWriter(s).setBlockState(k, b, "skip", v); done(name + " : pas fait") }
                                }
                            }
                        }
                    }
                }
                .padding(16)
                .animation(.spring(response: 0.35, dampingFraction: 0.85), value: mode)
            }
            .background(Palette.bg)
            .navigationTitle(name).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Fermer") { dismiss() } } }
        }
    }
    private func done(_ msg: String) { Haptics.success(); toast(msg); dismiss() }

    private func choice(_ title: String, _ sub: String?, _ a: @escaping () -> Void) -> some View {
        Button(action: a) {
            HStack {
                Text(title).font(Typo.sans(15, .semibold)).foregroundStyle(Palette.ink)
                if let sub { Text(sub).font(Typo.sans(14)).foregroundStyle(Palette.muted).lineLimit(1) }
                Spacer()
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
            .background(Palette.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(PressStyle())
    }
    private func openSwap(_ it: Item, _ e: JSON) {
        let x = e["swap"]?[PlanReader.itemKey(b, it)]
        pick = it.id
        lib = x?["lib"]?.string ?? ""
        how = Set((x?["how"]?.array ?? []).compactMap { $0.string })
        // sans choix déjà fait, on part de la charge prévue au plan
        let planned = Core.shared.call("plan.plannedIntensity", .str(k), b.raw, it.raw)
        let v = x?["v"]?.double ?? planned?["v"]?.double
        unit = x?["u"]?.string ?? planned?["u"]?.string ?? "kg"
        intensity = v.map { Fmt.num($0) } ?? ""
    }
    private static let hows: [(String, String)] = [("pieds", "Pieds en appui"), ("lest", "Lest"), ("poulie", "Poulie (décharge)")]
    @ViewBuilder private func swapForm(_ items: [Item], _ e: JSON) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if items.count > 1 {
                Flow(spacing: 6) { ForEach(items) { x in Chip(label: plain(x.label), on: pick == x.id) { openSwap(x, e) } } }
            }
            if let cur = items.first(where: { $0.id == pick }) {
                let choices = Core.shared.call("plan.swapChoices", .str(k), b.raw, cur.raw)?.array ?? []
                let ref = Core.shared.call("plan.fingerRef", .str(k))?.double
                if let from = cur.swapFrom { Text("Fait à la place de : " + plain(from)).font(Typo.sans(13.5)).foregroundStyle(Palette.muted) }
                Text("À la place, tu as fait").font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                Flow(spacing: 6) {
                    ForEach(Array(choices.enumerated()), id: \.offset) { _, x in
                        Chip(label: x["name"]?.string ?? "", on: lib == (x["id"]?.string ?? "-")) { lib = x["id"]?.string ?? "" }
                    }
                }
                Text("Charge visée, comme prévu au plan" + (ref.map { " · ton max ≈ \(Fmt.num($0)) kg" } ?? "")).font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                HStack(spacing: 8) {
                    TextField("ex. 9", text: $intensity)
                        .keyboardType(.decimalPad)
                        .font(Typo.sans(16)).padding(12)
                        .background(Palette.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    Chip(label: "kg", on: unit == "kg") { unit = "kg" }
                    Chip(label: "% du max", on: unit == "pct") { unit = "pct" }
                }
                Text("Comment tu as dosé").font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                Flow(spacing: 6) {
                    ForEach(Self.hows, id: \.0) { h in
                        Chip(label: h.1, on: how.contains(h.0)) { if how.contains(h.0) { how.remove(h.0) } else { how.insert(h.0) } }
                    }
                }
                Button("Enregistrer") {
                    guard let ch = choices.first(where: { $0["id"]?.string == lib }) else { return }
                    let v = Double(intensity.replacingOccurrences(of: ",", with: ".")) ?? 0
                    var o: [String: JSON] = ["lib": .str(lib), "label": .str(ch["name"]?.string ?? ""), "u": .str(unit), "how": .arr(Self.hows.map { $0.0 }.filter { how.contains($0) }.map { JSON.str($0) })]
                    if v > 0 { o["v"] = .num(v) }
                    Core.shared.call("plan.setSwap", .str(k), b.raw, cur.raw, .obj(o))
                    done((ch["name"]?.string ?? "Exercice") + " : fait à la place")
                }
                .buttonStyle(BigButton()).disabled(lib.isEmpty)
                if cur.swapFrom != nil {
                    Button("Remettre l’exercice prévu") { JournalWriter(Store.shared).clearSwap(k, b, cur); done("Exercice prévu remis") }.buttonStyle(SmallButton(color: Palette.muted))
                }
            }
        }
    }
}

// MARK: charges du finger lift

struct FingerCalcView: View {
    let k: String, b: Block
    var body: some View {
        if b.kind == "doigts", !b.items.contains(where: { $0.swapFrom != nil }), let fc = Core.shared.call("plan.fingerCalc", b.raw, .str(k)) {
            VStack(alignment: .leading, spacing: 4) {
                Text(fc["text"]?.string ?? "").font(Typo.mono(14, .semibold)).foregroundStyle(Palette.kind("doigts"))
                if let h = fc["hint"]?.string { Text(h).font(Typo.sans(12.5)).foregroundStyle(Palette.muted) }
                if let g = fc["guard"]?.string { Text(g).font(Typo.sans(13, .medium)).foregroundStyle(Palette.warn) }
            }
            .padding(10).frame(maxWidth: .infinity, alignment: .leading)
            .background(Palette.kind("doigts").opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }
}

// MARK: activité et exercices réalisés

struct ActFieldsView: View {
    let k: String
    @State private var more = false
    var body: some View {
        let s = Store.shared, e = s.journal(k), C = Core.shared
        let all = C.constant("activity.ACTS").array.map { ($0[0]?.string ?? "", $0[1]?.string ?? "") }
        let list = C.call("activity.acts", .str(k))?.array.compactMap { $0.string } ?? []
        let planned = C.call("activity.plannedActs", .str(k))?.array.compactMap { $0.string } ?? []
        let rel = C.call("sports.relevantActs")?.array.compactMap { $0.string }
        let shown = all.filter { rel == nil || more || rel!.contains($0.0) || list.contains($0.0) || planned.contains($0.0) }
        let tg = PlanReader(s).target(k)
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Activité").font(Typo.sans(14.5, .semibold)).foregroundStyle(Palette.ink)
                    Text(planned.isEmpty ? "ce que tu as fait" : "d’après le plan, modifiable").font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                }
                Flow(spacing: 6) {
                    ForEach(shown.map { $0.0 }, id: \.self) { key in
                        Chip(label: shown.first { $0.0 == key }?.1 ?? key, on: list.contains(key)) { toggle(key, list, planned, all.map { $0.0 }) }
                    }
                    if shown.count < all.count {
                        Button("Autre…") { more = true }.font(Typo.sans(14, .medium)).foregroundStyle(Palette.muted)
                            .padding(.horizontal, 13).frame(minHeight: 36).overlay(Capsule().strokeBorder(Palette.rule, style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
                    }
                }
            }
            if list.contains("grimpe") {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Profil de la séance d’escalade, sur 10" + (tg?.raw["s"]?.double != nil ? " · en bleu, le profil visé" : "")).font(Typo.sans(13)).foregroundStyle(Palette.muted)
                    ForEach(C.constant("rules.SIV").array.indices, id: \.self) { i in
                        let x = C.constant("rules.SIV").array[i], key = x[0]?.string ?? ""
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(alignment: .firstTextBaseline) {
                                Text(x[1]?.string ?? "").font(Typo.sans(14.5, .semibold)).foregroundStyle(Palette.ink)
                                Text(x[2]?.string ?? "").font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                            }
                            NumScale(value: e["siv"]?[key]?.int, target: tg?.raw[key]?.int.map { $0...$0 }) { v in
                                var siv = s.journal(k)["siv"]?.object ?? [:]
                                if let v { siv[key] = .num(Double(v)) } else { siv.removeValue(forKey: key) }
                                s.jset(k, ["siv": siv.isEmpty ? nil : .obj(siv)])
                            }
                        }
                    }
                }
            }
            if list.contains("force") || list.contains("kine") { ExLogView(k: k) }
            if list.contains("kine") {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("Douleur pendant la séance").font(Typo.sans(14.5, .semibold)).foregroundStyle(Palette.ink)
                        Text("0 aucune · 10 maximale").font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                    }
                    let pain = e["pain"]?.int
                    NumScale(value: pain, color: Palette.warn) { v in s.jset(k, ["pain": v.map { JSON.num(Double($0)) }]) }
                    if let pain {
                        Text(pain <= 2 ? "Zone sûre." : pain <= 5 ? "Acceptable si elle redescend d’ici demain matin et n’augmente pas d’une semaine à l’autre." : "Au-dessus de 5 : modifie ou allège ce qui la provoque, et parles-en à ton kiné.")
                            .font(Typo.sans(13.5)).foregroundStyle(pain <= 2 ? Palette.good : Palette.warn)
                    }
                    SourcesLine(ids: ["silbernagel2007"])
                }
            }
            if list.contains("cardio") {
                HStack(spacing: 10) {
                    NumberField(label: "Distance (km)", value: e["cardio"]?["km"]?.double) { v in setCardio("km", v) }
                    NumberField(label: "FC moyenne (bpm)", value: e["cardio"]?["fc"]?.double, integer: true, placeholder: "facultatif") { v in setCardio("fc", v) }
                }
            }
        }
    }
    private func toggle(_ a: String, _ list: [String], _ planned: [String], _ order: [String]) {
        let next = order.filter { $0 == a ? !list.contains($0) : list.contains($0) }
        let same = next.count == planned.count && next.allSatisfy { planned.contains($0) }
        Store.shared.jset(k, ["act": same ? nil : .arr(next.map { .str($0) })])
    }
    private func setCardio(_ key: String, _ v: Double?) {
        let s = Store.shared
        var c = s.journal(k)["cardio"]?.object ?? [:]
        if let v { c[key] = .num(v) } else { c.removeValue(forKey: key) }
        s.jset(k, ["cardio": c.isEmpty ? nil : .obj(c)])
    }
}

/// « Ce que j'ai fait » : séries × répétitions (ou durée) × charge, même si ça diffère du plan
struct ExLogView: View {
    let k: String
    struct Row: Identifiable, Equatable { var id: String; var label: String; var sets: String; var reps: String; var load: String; var rir: Int?; var src: String? }
    @State private var rows: [Row] = []
    @State private var loadedSig = ""
    var body: some View {
        let saved = Store.shared.journal(k)["log"] ?? .arr([])
        let sig = String(decoding: saved.encoded(), as: UTF8.self)
        let planned = Core.shared.call("activity.plannedLog", .str(k))?.array ?? []
        let missing = planned.filter { p in !rows.contains { $0.src != nil && $0.src == p["src"]?.string } }
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("Ce que j’ai fait").font(Typo.sans(14.5, .semibold)).foregroundStyle(Palette.ink)
                Text("séries × répétitions × charge").font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
            }
            if rows.isEmpty { Text("Liste les exercices réalisés, même s’ils diffèrent du plan.").font(Typo.sans(13.5)).foregroundStyle(Palette.muted) }
            ForEach($rows) { $r in
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        TextField("Nom de l’exercice", text: $r.label, onEditingChanged: { if !$0 { commit() } })
                            .font(Typo.sans(16, .medium))
                        Button { rows.removeAll { $0.id == r.id }; commit() } label: { Image(systemName: "xmark").font(.system(size: 13, weight: .bold)).foregroundStyle(Palette.muted) }
                            .accessibilityLabel("Retirer " + r.label)
                    }
                    HStack(spacing: 6) {
                        field("Séries", $r.sets, .numberPad)
                        field("Rép. / durée", $r.reps, .default, "8 ou 30 s")
                        field("Charge", $r.load, .default, "kg")
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Réserve").font(Typo.sans(11.5, .medium)).foregroundStyle(Palette.muted)
                            Menu {
                                Button("—") { r.rir = nil; commit() }
                                ForEach(0..<5, id: \.self) { x in Button(x == 4 ? "4 et +" : "\(x)") { r.rir = x; commit() } }
                            } label: {
                                Text(r.rir.map { $0 == 4 ? "4+" : "\($0)" } ?? "—").font(Typo.mono(15, .medium)).foregroundStyle(Palette.ink)
                                    .frame(maxWidth: .infinity, minHeight: 40).background(Palette.sunk, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                            }
                        }
                        .frame(width: 64)
                    }
                    if !r.label.isEmpty, let lp = Core.shared.call("history.lastPerf", .str(r.label), .str(k)), let t = Core.shared.call("history.perfText", lp)?.string {
                        Text("Dernière fois · " + t).font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                    }
                }
                .padding(12).background(Palette.sunk.opacity(0.5), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            Flow(spacing: 8) {
                if !missing.isEmpty {
                    Button((rows.isEmpty ? "Reprendre les exercices prévus" : "Ajouter les exercices prévus") + " (\(missing.count))") {
                        rows += missing.map(row(from:)); commit()
                    }
                    .buttonStyle(SmallButton())
                }
                Button { rows.append(Row(id: "l" + UUID().uuidString.prefix(6), label: "", sets: "", reps: "", load: "", rir: nil, src: nil)) } label: { Label("Ajouter un exercice", systemImage: "plus") }
                    .buttonStyle(SmallButton(color: Palette.ink))
            }
        }
        .onAppear { if loadedSig != sig { loadedSig = sig; rows = saved.array.map(row(from:)) } }
        .onChange(of: sig) { _, nv in if nv != loadedSig { loadedSig = nv; rows = (Store.shared.journal(k)["log"]?.array ?? []).map(row(from:)) } }
    }
    private func field(_ label: String, _ v: Binding<String>, _ kb: UIKeyboardType, _ ph: String = "") -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(Typo.sans(11.5, .medium)).foregroundStyle(Palette.muted).lineLimit(1)
            TextField(ph, text: v, onEditingChanged: { if !$0 { commit() } }).keyboardType(kb).font(Typo.mono(15, .medium))
                .padding(.horizontal, 8).frame(minHeight: 40).background(Palette.sunk, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
    }
    private func row(from j: JSON) -> Row {
        let sets: String = j["sets"]?.double.map { Fmt.num($0) } ?? j["sets"]?.string ?? ""
        return Row(id: j["id"]?.string ?? ("l" + UUID().uuidString.prefix(6)), label: j["label"]?.string ?? "", sets: sets, reps: j["reps"]?.string ?? "", load: j["load"]?.string ?? "", rir: j["rir"]?.int, src: j["src"]?.string)
    }
    private func commit() {
        let out: [JSON] = rows.map { r in
            var o: [String: JSON] = ["id": .str(r.id), "label": .str(r.label.trimmingCharacters(in: .whitespaces)), "reps": .str(r.reps), "load": .str(r.load)]
            let st = r.sets.replacingOccurrences(of: ",", with: ".")
            o["sets"] = st.isEmpty ? JSON.null : (Double(st).map { JSON.num($0) } ?? JSON.str(r.sets))
            if let rir = r.rir { o["rir"] = .num(Double(rir)) }
            if let src = r.src { o["src"] = .str(src) }
            return .obj(o)
        }
        let j: JSON = .arr(out)
        loadedSig = String(decoding: (out.isEmpty ? JSON.arr([]) : j).encoded(), as: UTF8.self)
        Store.shared.jset(k, ["log": out.isEmpty ? nil : j])
    }
}

// MARK: tests du jour

struct TestsCard: View {
    let k: String
    var body: some View {
        let tids = Core.shared.call("plan.testIdsOf", .str(k))?.array.compactMap { $0.string } ?? []
        if !tids.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                CardHeader("Résultats des tests") { Text("\(tids.count) test\(tids.count > 1 ? "s" : "")").font(Typo.mono(13)).foregroundStyle(Palette.muted) }
                TestEntry(k: k, tids: tids)
                Text("Tout est enregistré dans Suivi → Tests, avec l’évolution d’une passation à l’autre.").font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
            }
            .card()
        }
    }
}

/// Saisie des résultats de tests d'un jour (avec la valeur précédente et l'écart en %)
struct TestEntry: View {
    let k: String
    let tids: [String]
    @State private var draft: [String: Double] = [:]
    @State private var bw: Double?
    @State private var loaded = false
    @State private var protocolOf: String?
    @State private var incl: String?
    @State private var tindeq: String?
    var body: some View {
        let C = Core.shared
        VStack(alignment: .leading, spacing: 14) {
            ForEach(tids, id: \.self) { tid in
                if let t = C.call("tests.testById", .str(tid)) {
                    let vks = C.call("tests.valueKeys", t)?.array ?? []
                    let prev = C.call("tests.lastResult", .str(tid)).flatMap { ($0["k"]?.string ?? "") < k ? $0 : nil }
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(t["name"]?.string ?? tid).font(Typo.sans(15.5, .semibold)).foregroundStyle(Palette.ink)
                            Spacer()
                            Button("Protocole") { protocolOf = tid }.font(Typo.sans(13, .semibold)).foregroundStyle(Palette.accent)
                        }
                        if C.call("force.tindeqKind", .str(tid))?.string != nil {
                            Button { tindeq = tid } label: { Label("Mesurer avec le Tindeq", systemImage: "dot.radiowaves.left.and.right").font(Typo.sans(14, .semibold)) }
                                .buttonStyle(.bordered).tint(Palette.accent)
                        }
                        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                            ForEach(vks.indices, id: \.self) { i in
                                let vk = vks[i], key = vk["key"]?.string ?? "v", unit = vk["unit"]?.string ?? ""
                                let lbl = (vk["label"]?.string).flatMap { $0.isEmpty ? nil : $0.prefix(1).uppercased() + $0.dropFirst() } ?? "Résultat"
                                let was = prev?["vals"]?[key]?.double, cur = draft[tid + "|" + key]
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack(alignment: .bottom, spacing: 6) {
                                        NumberField(label: lbl + (unit.isEmpty ? "" : " (\(unit))"), value: cur) { v in
                                            draft[tid + "|" + key] = v; commit()
                                        }
                                        if unit == "°" {
                                            Button { incl = tid + "|" + key } label: { Image(systemName: "level").font(.system(size: 16, weight: .semibold)).frame(width: 46, height: 46).background(Palette.sunk, in: RoundedRectangle(cornerRadius: 11)) }
                                                .accessibilityLabel("Mesurer avec le téléphone")
                                        }
                                    }
                                    if let was {
                                        let p = cur.map { ($0 - was) / abs(was == 0 ? 1 : was) * 100 }
                                        (Text("avant : " + Fmt.num(was)) + Text(p.map { " " + ($0 >= 0 ? "+" : "") + Fmt.num(($0 * 10).rounded() / 10) + " %" } ?? "").foregroundColor(p.map { $0 >= 0 ? Palette.good : Palette.crit } ?? Palette.muted))
                                            .font(Typo.sans(12)).foregroundStyle(Palette.muted)
                                    }
                                }
                            }
                        }
                        if let der = C.call("extra.testDerive", .str(tid), .obj(values(tid)))?.string {
                            Text(der).font(Typo.sans(13.5, .semibold)).foregroundStyle(Palette.accent)
                        }
                    }
                }
            }
            NumberField(label: "Poids de corps ce jour (kg)", value: bw) { v in bw = v; Core.shared.call("tests.saveResults", .str(k), ["bw": v.map { JSON.num($0) } ?? .null]) }
                .frame(maxWidth: 200)
        }
        .onAppear(perform: load)
        .sheet(item: Binding(get: { protocolOf.map { TermRef(id: $0) } }, set: { protocolOf = $0?.id })) { r in TestProtocolSheet(tid: r.id) }
        .sheet(item: Binding(get: { tindeq.map { TermRef(id: $0) } }, set: { tindeq = $0?.id })) { r in
            let t = Core.shared.call("tests.testById", .str(r.id))
            TindeqSheet(title: t?["name"]?.string ?? "Tindeq", kind: Core.shared.call("force.tindeqKind", .str(r.id))?.string ?? "max",
                        keys: t.flatMap { Core.shared.call("tests.valueKeys", $0)?.array } ?? []) { vals in
                for (key, v) in vals { draft[r.id + "|" + key] = v }
                commit()
            }
        }
        .sheet(item: Binding(get: { incl.map { TermRef(id: $0) } }, set: { incl = $0?.id })) { r in
            InclinometerView { deg in
                draft[r.id] = Double(deg); commit(); incl = nil
            }
        }
    }
    private func values(_ tid: String) -> [String: JSON] {
        var o: [String: JSON] = [:]
        for (kk, v) in draft where kk.hasPrefix(tid + "|") { o[String(kk.dropFirst(tid.count + 1))] = .num(v) }
        return o
    }
    private func load() {
        guard !loaded else { return }
        loaded = true
        let r = Core.shared.call("tests.resultsOn", .str(k)) ?? .emptyObject
        for (tid, vals) in r["res"]?.object ?? [:] { for (kk, v) in vals.object { if let d = v.double { draft[tid + "|" + kk] = d } } }
        bw = r["bw"]?.double
    }
    private func commit() {
        var res: [String: JSON] = [:]
        for tid in tids { res[tid] = .obj(values(tid)) }
        Core.shared.call("tests.saveResults", .str(k), ["res": .obj(res)])
    }
}

// MARK: échanges avec le coach

struct ExchangesCard: View {
    let k: String
    @State private var store = Store.shared
    @State private var text = ""
    var body: some View {
        let selfView = store.isSelf, show = !selfView || !store.coaches.isEmpty
        if show {
            let msgs = store.get("c:" + k)?["msgs"]?.array ?? [], me = store.me ?? Store.SELF
            let other = selfView ? "ton coach" : store.name(store.subject)
            VStack(alignment: .leading, spacing: 12) {
                CardHeader("Échanges") { if !msgs.isEmpty { Text("\(msgs.count) message\(msgs.count > 1 ? "s" : "")").font(Typo.mono(13)).foregroundStyle(Palette.muted) } }
                if msgs.isEmpty {
                    Text(selfView ? "Un mot pour ton coach sur cette séance ?" : "Ton retour sur cette séance, visible par " + other + ".").font(Typo.sans(14)).foregroundStyle(Palette.muted)
                }
                ForEach(msgs.indices, id: \.self) { i in
                    let m = msgs[i], mine = m["uid"]?.string == me
                    MessageBubble(who: header(m, mine), text: m["text"]?.string ?? "", mine: mine)
                }
                HStack(alignment: .bottom, spacing: 8) {
                    TextField(selfView ? "Écrire à ton coach…" : "Écrire à " + other + "…", text: $text, axis: .vertical).lineLimit(1...5)
                        .font(Typo.sans(16)).padding(.horizontal, 12).padding(.vertical, 10)
                        .background(Palette.sunk, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    Button { send(msgs) } label: {
                        Image(systemName: "arrow.up").font(.system(size: 16, weight: .bold)).foregroundStyle(Palette.accentInk)
                            .frame(width: 40, height: 40).background(Palette.accent, in: Circle())
                    }
                    .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .accessibilityLabel("Envoyer")
                }
            }
            .card()
        }
    }
    private func header(_ m: JSON, _ mine: Bool) -> String {
        let who = mine ? "Toi" : (m["name"]?.string ?? "")
        guard let at = m["at"]?.double else { return who }
        return who + " · " + Date(timeIntervalSince1970: at / 1000).formatted(.dateTime.day().month(.abbreviated).hour().minute())
    }
    private func send(_ msgs: [JSON]) {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines); guard !t.isEmpty else { return }
        let me = store.me ?? Store.SELF, name = store.profile(Store.SELF)["name"]?.string ?? (store.isSelf ? "Moi" : "Coach")
        let m: JSON = ["uid": .str(me), "name": .str(name), "text": .str(t), "at": .num((Date().timeIntervalSince1970 * 1000).rounded())]
        store.put("c:" + k, ["msgs": .arr(msgs + [m])])
        text = ""; Haptics.success(); toast("Envoyé")
    }
}

struct MessageBubble: View {
    let who: String, text: String, mine: Bool
    var body: some View {
        VStack(alignment: mine ? .trailing : .leading, spacing: 3) {
            Text(who).font(Typo.sans(11.5, .medium)).foregroundStyle(Palette.muted)
            Text(text).font(Typo.sans(15)).foregroundStyle(mine ? Palette.accentInk : Palette.ink)
                .padding(.horizontal, 12).padding(.vertical, 9)
                .background(mine ? Palette.accent : Palette.sunk, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .frame(maxWidth: .infinity, alignment: mine ? .trailing : .leading)
    }
}

// MARK: bilan de la semaine (dimanche soir et lundi)

struct WeekReviewCard: View {
    @State private var store = Store.shared
    @State private var hiddenTick = 0
    var body: some View {
        if let mon = Core.shared.call("week.reviewWeek")?.string {
            let key = "alipto-week-seen:" + store.subject + ":" + mon
            if !UserDefaults.standard.bool(forKey: key) || hiddenTick < 0, let r = Core.shared.call("week.weekReview", .str(mon)), (r["planned"]?.int ?? 0) > 0 || (r["formN"]?.int ?? 0) > 0 {
                content(r, mon, key)
            }
        }
    }
    @ViewBuilder private func content(_ r: JSON, _ mon: String, _ key: String) -> some View {
        let w = PlanReader(store).week(mon), planned = r["planned"]?.int ?? 0, done = r["done"]?.int ?? 0
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Eyebrow((store.isSelf ? "Ta semaine" : "Semaine de " + store.name(store.subject)) + (w.map { " · " + $0.label } ?? ""))
                    DisplayTitle(planned > 0 ? "\(done) séance\(done > 1 ? "s" : "") sur \(planned)" : "Semaine sans séance prévue", size: 28)
                }
                Spacer()
                Button { UserDefaults.standard.set(true, forKey: key); withAnimation { hiddenTick += 1 } } label: {
                    Image(systemName: "xmark").font(.system(size: 13, weight: .bold)).foregroundStyle(Palette.muted).frame(width: 32, height: 32).background(Palette.sunk, in: Circle())
                }
                .accessibilityLabel("Masquer le bilan de la semaine")
            }
            WeekStats(r: r)
            if let m = missedText(r) { Text(m).font(Typo.sans(13.5)).foregroundStyle(Palette.muted) }
            if let recs = r["recs"]?.array, !recs.isEmpty {
                ForEach(recs.indices, id: \.self) { i in
                    HStack(spacing: 8) {
                        Image(systemName: "trophy.fill").foregroundStyle(Palette.oil)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(recs[i]["txt"]?.string ?? "").font(Typo.sans(14.5, .semibold)).foregroundStyle(Palette.ink)
                            Text(D.short(recs[i]["k"]?.string ?? "") + " · avant : " + (recs[i]["prev"]?.string ?? "")).font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                        }
                    }
                }
            }
            if let next = r["next"]?.array, !next.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text(nextTitle(r)).font(Typo.sans(13.5, .semibold)).foregroundStyle(Palette.ink)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(next.indices, id: \.self) { i in
                                let x = next[i]
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(D.dow3[D.dow(x["k"]?.string ?? D.today)]).font(Typo.mono(11, .semibold)).foregroundStyle(Palette.muted)
                                    Text(x["ev"]?["label"]?.string ?? x["name"]?.string ?? "").font(Typo.sans(13, .medium)).foregroundStyle(Palette.ink).lineLimit(2)
                                }
                                .padding(8).frame(width: 96, alignment: .leading)
                                .background(Palette.sunk.opacity(0.7), in: RoundedRectangle(cornerRadius: 10))
                            }
                        }
                    }
                }
            }
        }
        .card(tint: Palette.accent)
    }
    private func missedText(_ r: JSON) -> String? {
        guard let missed = r["missed"]?.array, !missed.isEmpty else { return nil }
        let parts: [String] = missed.map { x in
            var s = D.short(x["k"]?.string ?? "").lowercased() + " (" + (x["why"]?.string ?? "").lowercased()
            if let n = x["note"]?.string { s += " · « " + n + " »" }
            return s + ")"
        }
        return "Pas faites : " + parts.joined(separator: ", ")
    }
    private func nextTitle(_ r: JSON) -> String {
        var s = "Semaine prochaine"
        if let p = r["nextPhase"]?.string { s += " · " + p.lowercased() }
        if r["nextLight"]?.truthy == true { s += " : on récupère" }
        return s
    }
}

private struct WeekStats: View {
    let r: JSON
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            if let load = r["load"]?.double, load > 0 { stat("Charge", "\(Int(load)) UA", loadSub, Palette.ink) }
            if let f = r["form"]?.double { stat("Forme moyenne", Fmt.num(f) + "/25", formSub, Palette.level(r["formCls"]?.string)) }
            if let sl = r["sleep"]?.double { stat("Sommeil moyen", Rules.durLong(Int(sl)), nil, Palette.ink) }
        }
    }
    private var loadSub: String? {
        guard let c = r["loadCh"]?.double else { return nil }
        return (c >= 0 ? "+" : "") + "\(Int(c)) % vs la semaine d’avant"
    }
    private var formSub: String { let n = r["formN"]?.int ?? 0; return "\(n) matin" + (n > 1 ? "s" : "") + " notés" }
    private func stat(_ t: String, _ v: String, _ sub: String?, _ c: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(t).font(Typo.sans(11.5, .medium)).foregroundStyle(Palette.muted)
            Text(v).font(Typo.display(24)).foregroundStyle(c)
            if let sub { Text(sub).font(Typo.sans(11.5)).foregroundStyle(Palette.muted) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
