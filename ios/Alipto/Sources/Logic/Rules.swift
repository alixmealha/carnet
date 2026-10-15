import Foundation

/// Règles partagées avec la version web : forme du matin, paliers, ressenti, gênes.
enum Rules {
    struct WellItem { let key: String; let label: String; let lo: String; let hi: String }
    static let WELL: [WellItem] = [
        .init(key: "sommeil", label: "Sommeil", lo: "très mauvais", hi: "excellent"),
        .init(key: "fatigue", label: "Fatigue", lo: "épuisé", hi: "frais"),
        .init(key: "courbatures", label: "Courbatures", lo: "très courbaturé", hi: "aucune"),
        .init(key: "stress", label: "Stress", lo: "très stressé", hi: "détendu"),
        .init(key: "humeur", label: "Humeur", lo: "très basse", hi: "excellente"),
    ]
    static let FLAGS: [(String, String)] = [("doigts", "Doigts"), ("poignet", "Poignet"), ("coude", "Coude"), ("epaule", "Épaule"), ("dos", "Dos"), ("hanche", "Hanche / aine"), ("genou", "Genou"), ("cheville", "Cheville"), ("autre", "Autre")]
    static let RPE = ["Repos", "Très très facile", "Facile", "Modéré", "Un peu dur", "Dur", "Dur", "Très dur", "Très dur", "Presque maximal", "Maximal"]
    static let STATUS: [(String, String)] = [("faite", "Faite"), ("adaptee", "Adaptée"), ("sautee", "Sautée")]
    static let REPAS: [(String, String)] = [("oui", "Oui"), ("partiel", "En partie"), ("non", "Non")]
    static func flagLabel(_ f: String) -> String { FLAGS.first { $0.0 == f }?.1 ?? f }

    /// Total de la forme du matin (sur 25), seulement si les 5 valeurs sont notées
    static func score(_ e: JSON) -> Int? {
        guard let w = e["well"] else { return nil }
        var t = 0
        for x in WELL { guard let v = w[x.key]?.double else { return nil }; t += Int(v) }
        return t
    }

    struct Band: Equatable { let min: Int; let label: String; let cls: String; let text: String }
    static let defaultBands: [Band] = [
        .init(min: 20, label: "En forme", cls: "good", text: "Séance telle que prévue. Bon jour pour un effort intense ou un test."),
        .init(min: 15, label: "Correct", cls: "ok", text: "Séance telle que prévue."),
        .init(min: 11, label: "Fatigué", cls: "warn", text: "Garde la séance mais allège : environ un tiers de volume en moins, pas de nouveau record ni de palier de charge."),
        .init(min: 0, label: "Très fatigué", cls: "crit", text: "Version décharge : moitié du volume, rien au maximum, ou repos actif. Si ça dure plus de 2 jours, parles-en."),
    ]
    /// Paliers du plan s'il en définit (wellBands), sinon ceux par défaut
    static func bands(_ s: Store = .shared) -> [Band] {
        let wb = s.get("plan")?["wellBands"]?.array ?? []
        let parsed = wb.compactMap { x -> Band? in
            guard let m = x[0]?.int, let l = x[1]?.string else { return nil }
            return Band(min: m, label: l, cls: x[2]?.string ?? "ok", text: x[3]?.string ?? "")
        }
        return parsed.isEmpty ? defaultBands : parsed
    }
    static func verdict(_ t: Int, _ s: Store = .shared) -> Band {
        let b = bands(s)
        return b.first { t >= $0.min } ?? b[b.count - 1]
    }

    // MARK: ressenti visé
    private static let ADJ: [String: (String, String)] = [
        "vol": ("Plus facile que prévu. Si ça se répète à la prochaine séance volume, passe un tiers des blocs une cotation au-dessus.", "Plus dur que prévu. Regarde ta nuit et ta forme du matin ; si ça se répète, n’ajoute pas de blocs la semaine suivante."),
        "easy": ("Plus facile que prévu, sans gravité pour ce type de séance.", "Plus dur que prévu pour une séance qui doit rester facile : baisse les cotations ou la charge la prochaine fois."),
        "hard": ("Plus facile que prévu : prends des blocs plus durs la prochaine fois.", "Au-dessus de la cible : moins de blocs ou d’essais la prochaine fois, surtout si les doigts tirent."),
        "light": ("Sous la cible : aucun souci sur une séance légère.", "Trop dur pour une séance légère : lève le pied, c’est elle qui te fait récupérer."),
        "muscu": ("Plus facile que prévu : vérifie le RIR des dernières séries. S’il te restait plus de 2 répétitions, la charge est trop légère.", "Plus dur que prévu : si le RIR visé n’est pas tenu, garde la même charge la prochaine fois."),
    ]
    static func rng(_ tg: Target?) -> String {
        guard let r = tg?.rpe else { return "" }
        return r.0 == r.1 ? String(r.0) : "\(r.0)–\(r.1)"
    }
    static func rpeCmp(_ tg: Target?, _ rpe: Int?) -> (good: Bool, text: String)? {
        guard let tg, let r = tg.rpe, let rpe, tg.raw["fam"]?.string != "test" else { return nil }
        let adj = ADJ[tg.raw["fam"]?.string ?? ""] ?? ADJ["easy"]!
        if rpe < r.0 { return (false, "Sous la cible (\(rng(tg))). " + adj.0) }
        if rpe > r.1 { return (false, "Au-dessus de la cible (\(rng(tg))). " + adj.1) }
        return (true, "Dans la cible (\(rng(tg))).")
    }

    // MARK: nuit
    static func nightTotal(_ e: JSON) -> Int? {
        guard let n = e["nuit"] else { return nil }
        let v = ["profond", "leger", "rem"].compactMap { n[$0]?.double }
        if v.count >= 2 { return Int(v.reduce(0, +)) }
        if let t = n["total"]?.double { return Int(t) }
        return v.first.map { Int($0) }
    }
    static func durLong(_ min: Int) -> String { let h = min / 60, m = min % 60; return h > 0 ? "\(h) h " + String(format: "%02d", m) : "\(m) min" }
}

/// Lecture du jour (calculée par la logique partagée avec la version web) : feu vert / orange / rouge et conseils
struct DayReading {
    struct Line: Identifiable { let id = UUID(); let lvl: String; let title: String; let text: String; let src: [String] }
    let level: String   // good, warn, crit
    let head: String
    let items: [Line]
    let adapt: String?

    static func of(_ k: String, _ s: Store = .shared) -> DayReading? {
        guard let r = Core.shared.call("insights.dayInsights", .str(k)), let items = r["items"]?.array, !items.isEmpty else { return nil }
        return DayReading(level: r["level"]?.string ?? "good", head: r["head"]?.string ?? "",
                          items: items.map { Line(lvl: $0["lvl"]?.string ?? "info", title: $0["t"]?.string ?? "", text: $0["d"]?.string ?? "", src: $0["src"]?.array.compactMap { $0.string } ?? []) },
                          adapt: r["adapt"]?.string)
    }
}
