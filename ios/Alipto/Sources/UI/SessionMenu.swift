import SwiftUI

/// « ••• » de la séance : moins de temps que prévu, alléger, déplacer à un autre jour, annuler (avec la raison).
struct SessionMenuSheet: View {
    let k: String
    @Environment(\.dismiss) private var dismiss
    @State private var store = Store.shared
    @State private var mode: String? = Launch.demo && Launch.screen == "menu" ? "time" : nil

    var body: some View {
        let e = store.journal(k), pr = PlanReader(store)
        let units = Adapt.units(k, store), base = Adapt.plannedMin(units)
        let adj = Adapt.summary(k, store), cancel = e["cancel"]
        let lvl = DayReading.of(k, store)?.level
        let started = pr.progress(k).done > 0
        let coach = store.isSelf && !store.coaches.isEmpty
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    if let c = cancel {
                        Banner(color: Palette.crit, title: ((c["started"]?.truthy ?? false) ? "Séance arrêtée" : "Séance annulée") + " · " + skipLabel(c["r"]?.string).lowercased(),
                               text: (c["note"]?.string).map { "« " + $0 + " »" }, action: ("Rétablir la séance", { JournalWriter(store).restore(k); done("Séance rétablie") }))
                    }
                    if let adj, cancel == nil {
                        Banner(color: Palette.accent, title: adj.head, text: adj.dropped.isEmpty ? nil : "Retiré : " + adj.dropped.joined(separator: ", "),
                               action: ("Revenir à la séance prévue", { Adapt.clear(k, store); done("Retour à la séance prévue") }))
                    }
                    if cancel == nil && !units.isEmpty {
                        option("time", "J’ai moins de temps que prévu", "Séance prévue ≈ \(base) min. Indique le temps que tu as : l’appli garde l’essentiel et te montre ce qui change.", icon: "timer")
                        if mode == "time" { TimeFit(k: k, base: base) { done($0) }.transition(.opacity.combined(with: .move(edge: .top))) }
                        option("light", "Alléger ma séance", lvl == "crit" ? "Ta forme du matin conseille la version décharge." : lvl == "warn" ? "Ta forme du matin conseille d’alléger d’un tiers." : "Fatigue, courbatures, mauvaise nuit : mêmes exercices, moins de séries.", icon: "leaf")
                        if mode == "light" { LightenView(k: k, reco: lvl == "crit" ? 0.5 : 1.0 / 3) { done($0) }.transition(.opacity.combined(with: .move(edge: .top))) }
                    }
                    if cancel == nil && !started && !units.isEmpty {
                        option("move", "Déplacer à un autre jour", store.planLocked ? "Ton plan est verrouillé par ton coach : demande-lui." : "Plus tôt ou plus tard : toute la séance passe au jour choisi, ou s’échange avec celle de ce jour.", icon: "calendar")
                        if mode == "move" && !store.planLocked { MoveDays(k: k) { done($0) }.transition(.opacity) }
                    }
                    if cancel == nil {
                        option("cancel", started ? "Arrêter la séance ici" : "Annuler la séance", (started ? "Ce qui est fait est gardé ; le reste passe en « pas fait ». " : "") + "Avec la raison" + (coach ? " : ton coach la voit." : ", gardée dans le journal."), icon: "xmark.circle", danger: true)
                        if mode == "cancel" { CancelForm(k: k, started: started, coach: coach) { done($0) }.transition(.opacity) }
                    }
                }
                .padding(16)
                .animation(.spring(response: 0.4, dampingFraction: 0.85), value: mode)
            }
            .background(Palette.bg)
            .navigationTitle(plain(pr.sessionName(k)))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Fermer") { dismiss() } } }
        }
    }

    private func done(_ msg: String) { Haptics.success(); toast(msg); dismiss() }

    private func option(_ m: String, _ title: String, _ text: String, icon: String, danger: Bool = false) -> some View {
        let on = mode == m
        return Button { Haptics.tap(); mode = on ? nil : m } label: {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: icon).font(.system(size: 17, weight: .semibold)).foregroundStyle(danger ? Palette.crit : Palette.accent).frame(width: 26)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(Typo.sans(16, .semibold)).foregroundStyle(danger ? Palette.crit : Palette.ink)
                    Text(text).font(Typo.sans(13.5)).foregroundStyle(Palette.muted).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.down").font(.system(size: 13, weight: .semibold)).foregroundStyle(Palette.muted).rotationEffect(.degrees(on ? 180 : 0))
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Palette.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(on ? (danger ? Palette.crit : Palette.accent) : Palette.rule.opacity(0.6), lineWidth: on ? 1.5 : 0.5))
        }
        .buttonStyle(PressStyle())
    }
}

/// Une ligne de l'aperçu : gardé, réduit, raccourci ou retiré
private struct FitRow: View {
    let x: Adapt.Row
    var body: some View {
        let u = x.u
        let w: (Int) -> String = { n in
            let unit = u.it?["unit"]?.string, base = unit == "Bloc" ? "bloc" : unit == "Essai" ? "essai" : unit == "Voie" ? "voie" : u.it?["timer"]?["markEach"]?.string == "rep" ? "répétition" : "série"
            return "\(n) \(base)" + (n > 1 ? "s" : "")
        }
        let what: String = {
            if x.act == "drop" { return "retiré" }
            if let mins = u.mins { return x.act == "short" ? "\(Int((x.m ?? 0).rounded())) min au lieu de \(Int(mins.rounded()))" : "\(Int(mins.rounded())) min" }
            return x.act == "reduce" ? w(x.n ?? u.n0) + " au lieu de \(u.n0)" : w(u.n0)
        }()
        HStack(alignment: .firstTextBaseline) {
            Text(plain(u.label)).font(Typo.sans(14.5)).foregroundStyle(x.act == "drop" ? Palette.muted : Palette.ink).strikethrough(x.act == "drop")
            Spacer(minLength: 8)
            Text(what).font(Typo.sans(13.5, .medium)).foregroundStyle(x.act == "full" ? Palette.muted : x.act == "drop" ? Palette.crit : Palette.accent).multilineTextAlignment(.trailing)
        }
        .padding(.vertical, 4)
    }
}

private struct TimeFit: View {
    let k: String, base: Int
    let onDone: (String) -> Void
    @State private var minutes = 45
    @State private var ready = false
    var body: some View {
        let sugg = [20, 30, 45, 60, 75, 90].filter { $0 < base }
        let r = minutes >= 10 ? Adapt.fitToTime(k, minutes) : nil
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 14) {
                Text("\(minutes)").font(Typo.display(44)).foregroundStyle(Palette.ink).contentTransition(.numericText()).frame(minWidth: 70, alignment: .leading)
                Text("min").font(Typo.sans(15)).foregroundStyle(Palette.muted)
                Spacer()
                Stepper("", value: $minutes, in: 10...300, step: 5).labelsHidden()
            }
            if !sugg.isEmpty {
                Flow(spacing: 6) { ForEach(sugg, id: \.self) { m in Chip(label: "\(m) min", on: m == minutes) { withAnimation { minutes = m } } } }
            }
            if let r {
                (Text("≈ \(r.total) min").font(Typo.sans(15, .semibold)) + Text(" au lieu de ≈ \(r.base)" + (r.total > minutes + 2 ? " · ce qui est déjà fait ne peut pas être retiré" : "")))
                    .font(Typo.sans(14)).foregroundStyle(Palette.ink)
                VStack(spacing: 0) { ForEach(r.rows) { FitRow(x: $0) } }
                Text("Gardés en priorité : l’échauffement (raccourci) et les exercices principaux, en séries complètes. Ensuite les accessoires, puis la prévention.")
                    .font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                Button(r.changed ? "Adapter la séance" : "Ta séance tient déjà dans ce temps") { Adapt.apply(r); onDone("Séance adaptée à \(minutes) min") }
                    .buttonStyle(BigButton()).disabled(!r.changed)
            }
        }
        .padding(14).background(Palette.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .onAppear {
            guard !ready else { return }
            ready = true
            if !sugg.isEmpty { minutes = sugg.first { Double($0) >= Double(base) * 0.55 } ?? sugg[sugg.count - 1] } else { minutes = max(10, base - 10) }
        }
    }
}

private struct LightenView: View {
    let k: String, reco: Double
    let onDone: (String) -> Void
    @State private var frac: Double?
    var body: some View {
        let f = frac ?? reco, r = Adapt.lighten(k, f)
        let less = r.rows.reduce(0) { $0 + ($1.u.mins == nil && $1.n != nil ? $1.u.n0 - $1.n! : 0) }
        VStack(alignment: .leading, spacing: 12) {
            Flow(spacing: 6) {
                ForEach([1.0 / 3, 0.5], id: \.self) { x in
                    Chip(label: (x >= 0.5 ? "Moitié · version décharge" : "Un tiers en moins") + (abs(x - reco) < 0.01 ? " · conseillé" : ""), on: abs(x - f) < 0.01) { frac = x }
                }
            }
            (Text("\(less) série\(less > 1 ? "s" : "") en moins").font(Typo.sans(15, .semibold)) + Text(" · ≈ \(r.total) min au lieu de ≈ \(r.base)"))
                .font(Typo.sans(14)).foregroundStyle(Palette.ink)
            VStack(spacing: 0) { ForEach(r.rows.filter { !$0.u.warm }) { FitRow(x: $0) } }
            Text(f >= 0.5 ? "Rien au maximum : garde 2 à 3 répétitions en réserve, cotations un cran en dessous." : "Mêmes charges, pas de nouveau palier aujourd’hui.")
                .font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
            Button("Alléger la séance") { Adapt.apply(r); onDone(f >= 0.5 ? "Version décharge" : "Séance allégée") }.buttonStyle(BigButton())
        }
        .padding(14).background(Palette.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

private struct MoveDays: View {
    let k: String
    let onDone: (String) -> Void
    var body: some View {
        let days = Core.shared.call("plan.moveTargets", .str(k))?.array.compactMap { $0.string } ?? []
        VStack(spacing: 6) {
            ForEach(days, id: \.self) { d in MoveDayRow(k: k, d: d, onDone: onDone) }
            Text("« Échanger » : ta séance passe ce jour-là et la sienne vient ici.").font(Typo.sans(12.5)).foregroundStyle(Palette.muted)
                .frame(maxWidth: .infinity, alignment: .leading).padding(.top, 2)
        }
    }
}

private struct MoveDayRow: View {
    let k: String
    let d: String
    let onDone: (String) -> Void
    var body: some View {
        let pr = PlanReader(Store.shared), name = pr.sessionName(d), busy = pr.hasSession(d)
        let lbl = d == D.today ? "Aujourd’hui" : D.short(d)
        HStack(spacing: 6) {
            Button {
                Core.shared.call("plan.moveSession", .str(k), .str(d))
                onDone("Séance déplacée " + (d == D.today ? "à aujourd’hui" : "au " + D.short(d).lowercased()))
            } label: {
                HStack {
                    Text(lbl).font(Typo.sans(15, .semibold)).foregroundStyle(d < k ? Palette.accent : Palette.ink).frame(width: 110, alignment: .leading)
                    Text(plain(name)).font(Typo.sans(14)).foregroundStyle(busy ? Palette.ink : Palette.muted).lineLimit(1)
                    Spacer(minLength: 4)
                    Image(systemName: d < k ? "arrow.left" : "arrow.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Palette.accent)
                }
                .padding(.horizontal, 14).frame(minHeight: 46)
                .background(Palette.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(PressStyle())
            if busy {
                Button {
                    Core.shared.call("plan.swapSessions", .str(k), .str(d))
                    onDone("Séances échangées avec " + (d == D.today ? "aujourd’hui" : "le " + D.short(d).lowercased()))
                } label: {
                    Image(systemName: "arrow.left.arrow.right").font(.system(size: 15, weight: .semibold)).foregroundStyle(Palette.accent)
                        .frame(width: 46, height: 46)
                        .background(Palette.accentSoft, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(PressStyle())
                .accessibilityLabel("Échanger avec " + lbl)
            }
        }
    }
}

private struct CancelForm: View {
    let k: String, started: Bool, coach: Bool
    let onDone: (String) -> Void
    @State private var reason: String?
    @State private var note = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Pourquoi ?").font(Typo.sans(14.5, .semibold)).foregroundStyle(Palette.ink)
            Flow(spacing: 6) {
                ForEach(SKIP.filter { $0.0 != "materiel" }.map { $0.0 }, id: \.self) { v in
                    Chip(label: skipLabel(v), on: reason == v, color: Palette.crit) { reason = reason == v ? nil : v }
                }
            }
            VStack(alignment: .leading, spacing: 6) {
                Text("Un mot · facultatif" + (coach ? ", ton coach le lit" : "")).font(Typo.sans(13.5, .medium)).foregroundStyle(Palette.muted)
                TextField("Mal dormi, journée chargée, douleur au genou…", text: $note, axis: .vertical).lineLimit(2...5)
                    .font(Typo.sans(16)).padding(12).background(Palette.sunk, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            Button(started ? "Arrêter la séance" : "Annuler la séance") {
                guard let reason else { return }
                JournalWriter().cancel(k, reason: reason, note: note.trimmingCharacters(in: .whitespacesAndNewlines))
                onDone(started ? "Séance arrêtée" : "Séance annulée")
            }
            .buttonStyle(BigButton(kind: .danger)).disabled(reason == nil)
            if reason == nil { Text("Choisis une raison : elle aide à comprendre ta semaine" + (coach ? ", et ton coach à adapter la suite." : ".")).font(Typo.sans(12.5)).foregroundStyle(Palette.muted) }
        }
        .padding(14).background(Palette.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
