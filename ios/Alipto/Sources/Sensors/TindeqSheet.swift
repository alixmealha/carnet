import SwiftUI

/// Mesure d'un test de force des doigts avec le Tindeq Progressor : connexion, tare, compte à rebours, mesure, résultat.
/// kind « max » : 10 s à fond, on garde le pic. kind « cf » : force critique, 24 tractions de 7 s avec 3 s de repos (Giles 2019).
struct TindeqSheet: View {
    let title: String
    let kind: String
    let keys: [JSON]
    let onTake: ([String: Double]) -> Void

    private final class Rec { var s: [[Double]] = []; var active = false }
    private enum Phase: Equatable { case prep, count(Int), run, done }

    @Environment(\.dismiss) private var dismiss
    @State private var tq = Tindeq.shared
    @State private var phase: Phase = .prep
    @State private var side = "D"
    @State private var rec = Rec()
    @State private var started = Date()
    @State private var elapsed = 0.0
    @State private var ticker: Timer?
    @State private var result: JSON?
    @State private var lastRep = -1

    private var sided: Bool { keys.contains { $0["side"]?.string != nil } }
    private var duration: Double { kind == "cf" ? 240 : 10 }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    switch phase {
                    case .prep: prep
                    case .count(let n): big("\(n)", "Prépare-toi")
                    case .run: run
                    case .done: done
                    }
                }
                .padding(20)
            }
            .background(Palette.bg)
            .navigationTitle(title).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Fermer") { close() } } }
        }
        .interactiveDismissDisabled(phase == .run)
        .onAppear { tq.connect() }
        .onChange(of: tq.state) { _, s in if s == .ready, phase == .prep { tq.start() } }
        .onDisappear { ticker?.invalidate(); tq.disconnect() }
    }

    // MARK: étapes

    @ViewBuilder private var prep: some View {
        Text(kind == "cf"
             ? "24 tractions de 7 s à fond, 3 s de repos entre chacune (4 min). La force critique est la moyenne des 6 dernières tractions : c’est la force que tu peux tenir longtemps."
             : "10 s de traction maximale. Le pic de force (lissé sur 0,25 s) est gardé.")
            .font(Typo.sans(14.5)).foregroundStyle(Palette.muted)
        if sided {
            Picker("Main", selection: $side) { Text("Main droite").tag("D"); Text("Main gauche").tag("G") }.pickerStyle(.segmented)
        }
        connection
        if tq.isReady {
            VStack(alignment: .leading, spacing: 6) {
                Text("Force actuelle").font(Typo.sans(12.5, .medium)).foregroundStyle(Palette.muted)
                Text(Fmt.num((tq.force * 10).rounded() / 10) + " kg").font(Typo.display(64)).foregroundStyle(Palette.ink).contentTransition(.numericText())
                gauge(tq.force)
            }
            Text("Installe le capteur sans le charger, appuie sur « Tare », puis mets-toi en position : la valeur doit rester proche de 0 avant de commencer.")
                .font(Typo.sans(13.5)).foregroundStyle(Palette.muted)
            HStack(spacing: 10) {
                Button("Tare") { tq.tare(); Haptics.select() }.buttonStyle(BigButton(kind: .plain))
                Button("Démarrer") { begin() }.buttonStyle(BigButton())
            }
        }
    }

    @ViewBuilder private var connection: some View {
        switch tq.state {
        case .idle:
            Button("Connecter le Tindeq") { tq.connect() }.buttonStyle(BigButton())
            Text("Réveille-le en appuyant sur son bouton. Le Bluetooth sert uniquement à lire la force.").font(Typo.sans(13)).foregroundStyle(Palette.muted)
        case .scanning, .connecting:
            HStack(spacing: 10) { ProgressView(); Text(tq.state == .scanning ? "Recherche du Tindeq…" : "Connexion…").font(Typo.sans(15)).foregroundStyle(Palette.muted) }
        case .failed(let msg):
            Text(msg).font(Typo.sans(14.5)).foregroundStyle(Palette.crit)
            Button("Réessayer") { tq.disconnect(); tq.connect() }.buttonStyle(BigButton(kind: .plain))
        case .ready, .streaming:
            Label("Connecté : " + tq.deviceName, systemImage: "checkmark.circle.fill").font(Typo.sans(14.5, .medium)).foregroundStyle(Palette.good)
        }
    }

    @ViewBuilder private var run: some View {
        let within = kind == "cf" ? elapsed.truncatingRemainder(dividingBy: 10) : elapsed
        let on = kind == "cf" ? within < 7 : true
        let rep = Int(elapsed / 10) + 1
        VStack(spacing: 6) {
            Text(on ? "Tire !" : "Relâche").font(Typo.display(38)).foregroundStyle(on ? Palette.accent : Palette.muted)
            if kind == "cf" { Text("Traction \(min(24, rep)) sur 24").font(Typo.sans(15, .medium)).foregroundStyle(Palette.muted) }
        }.frame(maxWidth: .infinity)
        big(Fmt.num((tq.force * 10).rounded() / 10), "kg")
        gauge(tq.force)
        ProgressView(value: min(1, elapsed / duration)).tint(Palette.accent)
        Text(Fmt.num((max(0, duration - elapsed)).rounded(.up)) + " s restantes").font(Typo.sans(13)).foregroundStyle(Palette.muted).frame(maxWidth: .infinity)
        Button("Arrêter") { finish(cancel: true) }.buttonStyle(BigButton(kind: .plain))
    }

    @ViewBuilder private var done: some View {
        if let r = result, !r.isNull {
            if kind == "cf" {
                let cf = r["cf"]?.double ?? 0, pic = r["pic"]?.double ?? 0
                Eyebrow("Force critique")
                DisplayTitle(Fmt.num(cf) + " kg", size: 44)
                let ratio = r["ratio"]?.int ?? 0
                let partial = r["complete"]?.bool == true ? "" : " · test incomplet, résultat indicatif"
                let line = "Pic \(Fmt.num(pic)) kg · la force critique vaut \(ratio) % du pic\(partial)"
                Text(line).font(Typo.sans(14.5)).foregroundStyle(Palette.muted)
                repBars(r["reps"]?.array.compactMap { $0.double } ?? [])
                Button("Enregistrer force critique et pic") { take(["cf": cf, "pic": pic]) }.buttonStyle(BigButton())
            } else {
                let pk = r["peak"]?.double ?? 0
                Eyebrow("Force maximale")
                DisplayTitle(Fmt.num(pk) + " kg", size: 44)
                if let h = r["hold5"]?.double { Text("Meilleure moyenne sur 5 s : " + Fmt.num(h) + " kg").font(Typo.sans(14.5)).foregroundStyle(Palette.muted) }
                Button("Enregistrer " + Fmt.num(pk) + " kg") { take(["v": pk]) }.buttonStyle(BigButton())
            }
        } else {
            Text("La mesure n’a pas pu être lue (effort trop faible ou test interrompu). Recommence quand tu veux.").font(Typo.sans(15)).foregroundStyle(Palette.muted)
        }
        Button("Refaire la mesure") { result = nil; phase = .prep; tq.start() }.buttonStyle(BigButton(kind: .plain))
    }

    // MARK: éléments

    private func big(_ v: String, _ sub: String) -> some View {
        VStack(spacing: 2) {
            Text(v).font(Typo.display(96)).foregroundStyle(Palette.ink).contentTransition(.numericText())
            Text(sub).font(Typo.sans(15)).foregroundStyle(Palette.muted)
        }.frame(maxWidth: .infinity)
    }

    private func gauge(_ kg: Double) -> some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(Palette.sunk)
                Capsule().fill(Palette.accent).frame(width: max(0, min(1, kg / 80)) * g.size.width)
            }
        }.frame(height: 10)
    }

    private func repBars(_ reps: [Double]) -> some View {
        let top = max(reps.max() ?? 1, 1)
        return HStack(alignment: .bottom, spacing: 3) {
            ForEach(reps.indices, id: \.self) { i in
                RoundedRectangle(cornerRadius: 2).fill(i >= reps.count - 6 ? Palette.accent : Palette.sunk)
                    .frame(height: max(4, CGFloat(reps[i] / top) * 70))
            }
        }.frame(height: 70, alignment: .bottom)
    }

    // MARK: déroulé

    private func begin() {
        Haptics.firm()
        rec = Rec()
        phase = .count(3)
        countdown(3)
    }

    private func countdown(_ n: Int) {
        if n == 0 { go(); return }
        phase = .count(n)
        Haptics.tap()
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) { if case .count = phase { countdown(n - 1) } }
    }

    private func go() {
        let r = rec
        tq.onSample = { t, kg in if r.active { r.s.append([t, kg]) } }
        r.active = true
        started = Date(); elapsed = 0; lastRep = 0
        phase = .run
        Haptics.heavy()
        ticker?.invalidate()
        ticker = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
            elapsed = Date().timeIntervalSince(started)
            if kind == "cf" {
                let rep = Int(elapsed / 10), within = elapsed.truncatingRemainder(dividingBy: 10)
                let key = rep * 2 + (within >= 7 ? 1 : 0)
                if key != lastRep {
                    lastRep = key
                    if key > 0 { if within >= 7 { Haptics.tap() } else { Haptics.firm() } }
                }
            }
            if elapsed >= duration { finish(cancel: false) }
        }
    }

    private func finish(cancel: Bool) {
        ticker?.invalidate(); ticker = nil
        rec.active = false
        tq.stop()
        Haptics.success()
        if cancel && rec.s.count < 40 { phase = .prep; tq.start(); return }
        let arr = JSON.arr(rec.s.map { .arr([.num($0[0]), .num($0[1])]) })
        result = Core.shared.call(kind == "cf" ? "force.cfTest" : "force.maxTest", arr)
        phase = .done
    }

    private func take(_ vals: [String: Double]) {
        var out: [String: Double] = [:]
        for (m, v) in vals {
            let vk = keys.first { $0["m"]?.string == m && (!sided || $0["side"]?.string == side) }
            if let key = vk?["key"]?.string { out[key] = v }
        }
        Haptics.success()
        onTake(out)
        close()
    }

    private func close() {
        ticker?.invalidate()
        tq.disconnect()
        dismiss()
    }
}
