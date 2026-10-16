import SwiftUI

/// Repères de niveau (escalade, 1RM, cardio) : ceux du profil, ou ceux d'un programme (coach qui prépare le programme d'un athlète).
/// Tout est facultatif ; sans valeur, l'appli estime d'après les tests et les séances.
struct LevelsForm: View {
    var need: JSON? = nil
    var lv: Binding<JSON>? = nil
    @State private var store = Store.shared

    var body: some View {
        let f = Core.shared.call("extra.levelsForm", need ?? .null, lv?.wrappedValue ?? .null) ?? .emptyObject
        let editable = lv != nil || store.isSelf
        let climb = f["climb"]?.array ?? [], lifts = f["lifts"]?.array ?? [], cardio = f["cardio"]?.array ?? []
        VStack(alignment: .leading, spacing: 18) {
            if !climb.isEmpty {
                LevelGroup(title: "Escalade", sub: "bloc en Fontainebleau, voie en cotation française",
                           note: "Flash et à vue : ce que tu passes du premier coup. Les séances de volume s’y calent ; la force et la puissance se calent sur ton max.") {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible())], alignment: .leading, spacing: 12) {
                        ForEach(climb.indices, id: \.self) { i in GradeField(x: climb[i]) { v in set(climb[i]["k"]?.string ?? "", v.map { JSON.str($0) }, nil) } }
                    }
                }
            }
            if !lifts.isEmpty {
                LevelGroup(title: "Force · 1RM", sub: "charge max sur une répétition",
                           note: "Les charges des exercices principaux sont calculées en % de ton 1RM. Sans valeur, l’appli prend ton dernier test ou l’estime d’après tes séries (charge, répétitions et réserve).") {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible())], alignment: .leading, spacing: 12) {
                        ForEach(lifts.indices, id: \.self) { i in
                            let x = lifts[i]
                            LevelNum(label: x["l"]?.string ?? "", value: x["v"]?.double, hint: x["hint"]?.string ?? "", integer: false) { v in
                                set("rm", v.map { JSON.num($0) }, x["id"]?.string)
                            }
                        }
                    }
                }
            }
            if !cardio.isEmpty {
                LevelGroup(title: "Cardio", sub: nil, note: (f["cardioNote"]?.string ?? "") + "\nLa VMA donne tes allures (endurance, 30/30, 3 min), la vitesse critique celles du seuil ; la FTP donne tes watts à vélo ; la FC max, tes zones de fréquence cardiaque.") {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible())], alignment: .leading, spacing: 12) {
                        ForEach(cardio.indices, id: \.self) { i in
                            let x = cardio[i]
                            LevelNum(label: x["l"]?.string ?? "", value: x["v"]?.double, hint: x["hint"]?.string ?? "", integer: x["int"]?.truthy ?? false) { v in
                                set(x["k"]?.string ?? "", v.map { JSON.num($0) }, nil)
                            }
                        }
                    }
                }
            }
            if let hx = f["hyrox"], !hx.isNull {
                LevelGroup(title: "Hyrox", sub: nil, note: "Charges officielles des stations (traîneau compris), selon ta catégorie et le sexe indiqué dans ton profil.") {
                    HyroxField(x: hx) { v in set("hdiv", v.map { JSON.str($0) }, nil) }
                }
            }
            if !editable {
                Text("Repères de l’athlète : lui seul peut les modifier.").font(Typo.sans(13.5)).foregroundStyle(Palette.muted)
            }
        }
        .disabled(!editable)
    }

    private func set(_ key: String, _ val: JSON?, _ sub: String?) {
        guard !key.isEmpty else { return }
        if let lv {
            var x = lv.wrappedValue.isNull ? JSON.emptyObject : lv.wrappedValue
            if let sub {
                var o = x[key] ?? .emptyObject
                o[sub] = val
                x[key] = o
            } else {
                x[key] = val
            }
            lv.wrappedValue = x
        } else {
            Core.shared.call("levels.setLevel", .str(key), val ?? .null, sub.map { JSON.str($0) } ?? .null)
        }
        Haptics.select()
    }
}

private struct LevelGroup<Content: View>: View {
    let title: String
    let sub: String?
    let note: String
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(title).font(Typo.sans(15, .semibold)).foregroundStyle(Palette.ink)
                if let sub { Text(sub).font(Typo.sans(12.5)).foregroundStyle(Palette.muted) }
            }
            content
            GlossText(note).font(Typo.sans(12.5)).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// Cotation déclarée (ou estimation affichée en gris)
private struct GradeField: View {
    let x: JSON
    let onPick: (String?) -> Void
    var body: some View {
        let v = x["v"]?.string ?? "", hint = x["hint"]?.string ?? ""
        let opts = x["opts"]?.array.compactMap { $0.string } ?? []
        VStack(alignment: .leading, spacing: 5) {
            Text(x["l"]?.string ?? "").font(Typo.sans(12.5, .medium)).foregroundStyle(Palette.muted).lineLimit(1).minimumScaleFactor(0.8)
            Menu {
                Button(hint.isEmpty ? "—" : "— (" + hint + ")") { onPick(nil) }
                ForEach(opts.reversed(), id: \.self) { g in
                    Button { onPick(g) } label: { if g == v { Label(g, systemImage: "checkmark") } else { Text(g) } }
                }
            } label: {
                HStack {
                    Text(v.isEmpty ? (hint.isEmpty ? "—" : hint) : v)
                        .font(Typo.mono(16, .medium)).foregroundStyle(v.isEmpty ? Palette.muted : Palette.ink).lineLimit(1).minimumScaleFactor(0.7)
                    Spacer(minLength: 4)
                    Image(systemName: "chevron.up.chevron.down").font(.system(size: 11, weight: .semibold)).foregroundStyle(Palette.muted)
                }
                .padding(.horizontal, 12).frame(minHeight: 46)
                .background(Palette.sunk, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
            }
        }
    }
}

/// Valeur numérique déclarée, avec l'estimation en indice quand elle manque
private struct LevelNum: View {
    let label: String
    let value: Double?
    let hint: String
    let integer: Bool
    let onCommit: (Double?) -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            NumberField(label: label, value: value, integer: integer, placeholder: "—", onCommit: onCommit)
            if value == nil && !hint.isEmpty {
                Text(hint).font(Typo.sans(11.5)).foregroundStyle(Palette.muted).lineLimit(2)
            }
        }
    }
}

private struct HyroxField: View {
    let x: JSON
    let onPick: (String?) -> Void
    var body: some View {
        let v = x["v"]?.string ?? "open"
        VStack(alignment: .leading, spacing: 5) {
            Text(x["l"]?.string ?? "").font(Typo.sans(12.5, .medium)).foregroundStyle(Palette.muted)
            Menu {
                Button { onPick(nil) } label: { if v == "open" { Label("Open", systemImage: "checkmark") } else { Text("Open") } }
                Button { onPick("pro") } label: { if v == "pro" { Label("Pro", systemImage: "checkmark") } else { Text("Pro") } }
            } label: {
                HStack {
                    Text(v == "pro" ? "Pro" : "Open").font(Typo.mono(16, .medium)).foregroundStyle(Palette.ink)
                    Spacer(minLength: 4)
                    Image(systemName: "chevron.up.chevron.down").font(.system(size: 11, weight: .semibold)).foregroundStyle(Palette.muted)
                }
                .padding(.horizontal, 12).frame(minHeight: 46)
                .background(Palette.sunk, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
            }
        }
    }
}
