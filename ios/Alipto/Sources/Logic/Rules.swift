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

/// Lecture du jour : forme, sommeil, gênes, charge… avec un feu (vert, orange, rouge) et des conseils.
struct DayReading {
    struct Line: Identifiable { let id = UUID(); let lvl: String; let title: String; let text: String }
    let level: String   // good, warn, crit
    let head: String
    let items: [Line]
    let adapt: String?

    private static let LV = ["crit": 0, "warn": 1, "info": 2, "good": 3]
    private static let WELL_TIPS = [
        "fatigue": "Fatigue générale : priorise la qualité et coupe le volume.",
        "courbatures": "Courbatures marquées : évite l’excentrique lourd et les gros volumes sur les mêmes muscles.",
        "stress": "Stress élevé : la charge mentale s’ajoute à l’entraînement ; garde l’intensité mais raccourcis la séance.",
        "humeur": "Humeur basse : une séance plaisir ou technique passe mieux qu’une séance très dure.",
    ]
    private static func mean(_ a: [Double]) -> Double { a.reduce(0, +) / Double(max(1, a.count)) }
    private static func sd(_ a: [Double]) -> Double {
        guard a.count >= 2 else { return 0 }
        let m = mean(a); return (a.reduce(0) { $0 + ($1 - m) * ($1 - m) } / Double(a.count - 1)).squareRoot()
    }
    private static func f1(_ x: Double) -> String { Fmt.num((x * 10).rounded() / 10) }

    private static func painAdvice(_ zone: String, _ ks: Set<String>) -> String {
        let climb = ks.contains("grimpe") || ks.contains("doigts") || ks.contains("test") || ks.contains("compet")
        let pull = ks.contains("muscu") || ks.contains("renfo") || climb
        switch zone {
        case "doigts": return climb ? " Pas de charge maximale sur les doigts aujourd’hui : ni suspensions max ni réglettes en arqué, grimpe sur grosses prises ou en technique. Une douleur sur le dos d’une articulation de doigt, même brève : arrêt du travail de doigts et avis médical." : " Rien pour les doigts aujourd’hui : revérifie demain matin avant de grimper."
        case "coude": return pull ? " Réduis les tirages (tractions, rowing, blocages) et évite les pinces serrées." : ""
        case "epaule": return pull ? " Évite les poussées au-dessus de la tête, le développé couché lourd et les jetés ; garde un travail des rotateurs léger." : ""
        case "poignet": return " Évite les appuis paume à plat chargés (pompes, dips) et les prises inversées."
        case "dos": return " Évite les charges lourdes et les exercices qui la réveillent ; mobilité douce."
        case "hanche": return " Pas de drop-knee forcé ni d’écart en force ; adapte le renfo des jambes."
        case "genou": return " Évite les réceptions de haut et les crochets talon appuyés ; cardio seulement sans douleur."
        case "cheville": return " Désescalade plutôt que sauts, réceptions contrôlées."
        default: return ""
        }
    }

    /// Charge d'un jour : ressenti × durée (séance principale et blocs faits à part)
    static func dayLoad(_ e: JSON) -> Double {
        var t = 0.0
        if let r = e["rpe"]?.double, let d = e["duree"]?.double, d > 0 { t += r * d }
        for p in (e["apart"]?.object ?? [:]).values { if let r = p["rpe"]?.double, let d = p["duree"]?.double, d > 0 { t += r * d } }
        return t
    }

    static func of(_ k: String, _ s: Store = .shared) -> DayReading? {
        let pr = PlanReader(s), e = s.journal(k)
        var items: [Line] = []
        func add(_ l: String, _ t: String, _ d: String) { items.append(Line(lvl: l, title: t, text: d)) }
        let ks = Set(pr.kinds(k))
        // 1. forme du matin
        if let t = Rules.score(e) {
            let vd = Rules.verdict(t, s), lv = vd.cls == "ok" ? "good" : vd.cls
            add(lv, "Forme du matin · \(t)/25 · \(vd.label)", vd.text)
            let past = (1...28).compactMap { Rules.score(s.journal(D.add(k, -$0))) }.map { Double($0) }
            if past.count >= 7 && (vd.cls == "good" || vd.cls == "ok") {
                let m = mean(past), sdv = max(2, sd(past))
                if Double(t) <= m - sdv { add("warn", "Nettement sous ta moyenne", "Ta moyenne sur 4 semaines est de \(f1(m))/25. C’est l’écart à ta propre habitude qui compte le plus : allège un peu même si le total reste correct.") }
            }
            let low = Rules.WELL.compactMap { w -> (Rules.WellItem, Int)? in
                guard let v = e["well"]?[w.key]?.int, v <= 2 else { return nil }; return (w, v)
            }.sorted { $0.1 < $1.1 }.first
            if let low, low.0.key != "sommeil", let tip = WELL_TIPS[low.0.key] { add("info", "\(low.0.label) · \(low.1)/5", tip) }
            let seq = (0...3).map { Rules.score(s.journal(D.add(k, $0 - 3))) }
            if seq.allSatisfy({ $0 != nil }) {
                let q = seq.map { $0! }
                if q[1] < q[0] && q[2] < q[1] && q[3] < q[2] { add("warn", "Forme en baisse 3 jours de suite", "Gèle la progression : reprends le niveau de la semaine précédente jusqu’à ce que ça remonte.") }
            }
        }
        // 2. sommeil
        let under18 = s.profile()["under18"]?.truthy ?? false, tgt = under18 ? 480 : 420
        if let tot = Rules.nightTotal(e) {
            let prev = Rules.nightTotal(s.journal(D.add(k, -1)))
            if tot < tgt, let prev, prev < tgt {
                add("warn", "Deux nuits courtes de suite", Rules.durLong(prev) + " puis " + Rules.durLong(tot) + ". Le manque de sommeil répété baisse la performance et augmente le risque de blessure : garde la séance mais retire les efforts maximaux. Une sieste de 20 à 30 min avant 16 h aide.")
            } else if tot < tgt {
                add("info", "Nuit courte · " + Rules.durLong(tot), "Une nuit isolée change peu la performance. Vise " + (under18 ? "8 à 10 h" : "7 à 9 h") + " ; une sieste de moins de 30 min est possible.")
            }
        }
        // 3. FC de repos et récupération de la montre
        if let fcr = e["nuit"]?["fcr"]?.double {
            let base = (1...7).compactMap { s.journal(D.add(k, -$0))["nuit"]?["fcr"]?.double }
            if base.count >= 4 {
                let m = mean(base), up = fcr - m
                if up >= 5 {
                    let y = s.journal(D.add(k, -1))["nuit"]?["fcr"]?.double
                    add("warn", "FC de repos haute · +\(Int(up.rounded())) bpm", "Au-dessus de ta moyenne de la semaine (\(Int(m.rounded())) bpm). Fatigue, stress, début de maladie, chaleur ou alcool peuvent la faire monter. " + ((y ?? 0) - m >= 5 ? "Deuxième jour de suite : allège la séance." : "Un seul jour : surveille demain."))
                }
            }
        }
        if let rc = e["nuit"]?["recup"]?.int, rc <= 33 { add("warn", "Récupération basse selon ta montre · \(rc) %", "À croiser avec ta forme du matin : les scores des montres sont peu validés scientifiquement, ta tendance compte plus que le chiffre du jour.") }
        // 4. gênes
        for (f, lbl) in Rules.FLAGS where e["flags"]?[f]?.truthy == true {
            let g = e["gene"]?[f]?.int, spec = painAdvice(f, ks)
            let g7 = s.journal(D.add(k, -7))["gene"]?[f]?.int
            let trend = (g != nil && g7 != nil && g! > g7!) ? " Elle est plus haute qu’il y a une semaine : ne l’ignore pas." : ""
            if let g {
                if g <= 2 { add("info", "\(lbl) · gêne \(g)/10", "Zone sûre : entraînement normal, en surveillant." + trend) }
                else if g <= 5 { add("warn", "\(lbl) · gêne \(g)/10", "Acceptable si elle ne dépasse pas 5/10 pendant l’effort, redescend d’ici demain matin et n’augmente pas d’une semaine à l’autre." + spec + trend) }
                else { add("crit", "\(lbl) · gêne \(g)/10", "Au-dessus de 5/10 : supprime ou modifie ce qui la provoque aujourd’hui. Si ça dure plus de quelques jours, consulte (kiné, médecin)." + spec) }
            } else { add("info", "\(lbl) sensible", "Note la gêne de 0 à 10 pour suivre son évolution." + spec) }
        }
        // 5. charge des derniers jours (au moins 3 semaines de données)
        let loads = (0..<28).map { dayLoad(s.journal(D.add(k, $0 - 27))) }
        if let first = loads.firstIndex(where: { $0 > 0 }), first <= 7 {
            let acute = loads.suffix(7).reduce(0, +), chronic = loads.reduce(0, +) / 4
            if chronic > 0 {
                let r = acute / chronic
                if r > 1.5 { add("warn", "Charge en forte hausse · ratio \(f1(r))", "Les 7 derniers jours pèsent \(f1(r)) fois ta moyenne des 4 semaines. Zone 0,8-1,3 décrite comme favorable (repère discuté) : garde les prochains jours à ce niveau plutôt que d’ajouter.") }
                else if r > 1.3 { add("info", "Charge en hausse · ratio \(f1(r))", "Progression rapide : ça passe si la forme suit.") }
            }
        }
        let y = D.add(k, -1), ye = s.journal(y)
        if let p = ye["pain"]?.int, p > 5 { add("warn", "Douleur élevée pendant la kiné d’hier · \(p)/10", "Au-dessus de 5/10, on allège ou on modifie les exercices qui la provoquent. Vérifie ce matin qu’elle est redescendue ; sinon, parles-en à ton kiné.") }
        if let yt = pr.target(y), let r = yt.rpe, let yr = ye["rpe"]?.int, yr >= r.1 + 2 { add("info", "Séance d’hier plus dure que prévu", "Ressenti \(yr)/10 pour une cible de \(Rules.rng(yt)). Si tu te sens entamé ce matin, commence prudemment.") }
        // 6. repas
        if let rp = e["repas"]?.string, rp == "non" || rp == "partiel" {
            let miss = (0...6).filter { s.journal(D.add(k, -$0))["repas"]?.string == "non" }.count
            if miss >= 3 { add("warn", "Repas manqués \(miss) fois en 7 jours", "Un apport insuffisant et répété fatigue et fragilise (déficit énergétique, REDs). À surveiller, et à en parler si ça continue.") }
            else { add("info", "Peu mangé autour de la séance d’hier", "Glucides et protéines dans les heures qui suivent l’effort aident à récupérer.") }
        }
        guard !items.isEmpty else { return nil }
        items.sort { (LV[$0.lvl] ?? 9) < (LV[$1.lvl] ?? 9) }
        let worst = items[0].lvl
        let level = worst == "crit" ? "crit" : worst == "warn" ? "warn" : "good"
        let head = level == "crit" ? "Feu rouge : version décharge ou repos actif" : level == "warn" ? "Feu orange : séance allégée ou adaptée" : "Feu vert : séance telle que prévue"
        let adapt = level != "good" ? pr.day(k)?["adapt"]?.string : nil
        return DayReading(level: level, head: head, items: items, adapt: adapt)
    }
}
