import Foundation

/// Données inventées pour les captures et l'aperçu (lancement avec « -demo 1 ») : aucune donnée réelle.
enum DemoData {
    static func make() -> [String: JSON] {
        let t = D.today, mon = D.monday(t)
        var m: [String: JSON] = [:]
        let start = D.add(mon, -14), end = D.add(mon, 13)
        m["plan"] = [
            "title": "Prépa bloc · démo",
            "start": .str(start), "end": .str(end),
            "weeks": [
                ["n": 1, "label": "S1", "phase": "volume", "start": .str(start), "end": .str(D.add(start, 6))],
                ["n": 2, "label": "S2", "phase": "volume", "start": .str(D.add(start, 7)), "end": .str(D.add(start, 13))],
                ["n": 3, "label": "S3", "phase": "force", "start": .str(mon), "end": .str(D.add(mon, 6)), "why": "Semaine de force : moins de blocs, plus durs, repos complets."],
                ["n": 4, "label": "S4", "phase": "force", "start": .str(D.add(mon, 7)), "end": .str(end)],
            ],
            "events": [["date": .str(D.add(t, 23)), "label": "Contest de la salle"]],
        ]
        for i in 0..<28 {
            let k = D.add(start, i)
            switch D.dow(k) {
            case 0: m["p:" + k] = climbDay
            case 1: m["p:" + k] = strengthDay
            case 3: m["p:" + k] = fingersDay
            case 5: m["p:" + k] = limitDay
            case 6: m["p:" + k] = runDay
            default: m["p:" + k] = ["blocks": [["id": "r", "kind": "rest", "title": "Repos", "items": [["id": "r1", "label": "Marche ou mobilité douce", "det": "20 à 30 min"]]]]]
            }
        }
        // journal des jours passés
        let wells: [[Int]] = [[4, 4, 3, 4, 4], [3, 3, 3, 4, 4], [4, 4, 4, 3, 5], [2, 3, 3, 3, 3], [4, 4, 4, 4, 4], [5, 4, 4, 4, 5], [3, 4, 3, 4, 4], [4, 3, 4, 4, 4], [4, 4, 3, 4, 3], [3, 3, 4, 3, 4], [4, 4, 4, 4, 4], [4, 3, 3, 4, 4], [5, 5, 4, 4, 4]]
        for d in 1...13 {
            let k = D.add(t, -d), w = wells[d - 1]
            var j: [String: JSON] = ["well": ["sommeil": .num(Double(w[0])), "fatigue": .num(Double(w[1])), "courbatures": .num(Double(w[2])), "stress": .num(Double(w[3])), "humeur": .num(Double(w[4]))]]
            if [0, 1, 3, 5, 6].contains(D.dow(k)) {
                j["status"] = .str(d == 4 ? "sautee" : d == 9 ? "adaptee" : "faite")
                if d != 4 { j["rpe"] = .num(Double([6, 7, 5, 8, 7][d % 5])); j["duree"] = .num(Double([75, 90, 60, 80, 45][d % 5])) }
            }
            m["j:" + k] = .obj(j)
        }
        // aujourd'hui : forme remplie, rien de fait
        m["j:" + t] = ["well": ["sommeil": 4, "fatigue": 4, "courbatures": 3, "stress": 4, "humeur": 4]]
        m["profile"] = ["name": "Camille"]
        // aujourd'hui : la séance de force (pour les captures)
        m["p:" + t] = Launch.screen == "climb" ? climbDay : strengthDay
        if Launch.screen == "morning" { m["j:" + t] = ["flags": ["doigts": true], "gene": ["doigts": 3]] }
        return m
    }

    static let warmup: JSON = ["id": "ech", "label": "Échauffement", "det": "10 min : mobilité épaules, tractions élastique, 2 séries de montée en charge", "n": 1]

    static let strengthDay: JSON = [
        "title": "Force · tirage et doigts",
        "duree": "75–90 min",
        "target": ["rpe": [7, 8], "fam": "muscu", "why": "Charges lourdes, peu de répétitions, repos complets : la qualité de chaque série compte plus que le volume."],
        "blocks": [
            ["id": "m", "kind": "muscu", "title": "Muscu A · tirage", "items": [
                warmup,
                ["id": "tr", "label": "Tractions lestées", "det": "Prise pronation, descente contrôlée", "n": 5, "reps": 4, "unit": "Série", "rest": 180, "load": 12.5, "unit_load": "+kg", "rx": ["role": "main", "rir": 2]],
                ["id": "ro", "label": "Rowing haltère", "det": "Dos plat, coude près du corps", "n": 3, "reps": 8, "unit": "Série", "rest": 90, "load": 26],
                ["id": "gn", "label": "Gainage hollow", "det": "Bas du dos collé au sol", "n": 3, "unit": "Série", "superset": "ro", "hold": 30, "rest": 60],
            ]],
            ["id": "d", "kind": "doigts", "title": "Doigts · finger lift", "desc": "Préhension semi-arquée, charge à 80 % du test.", "items": [
                ["id": "fl", "label": "Finger lift 7/3", "n": 4, "unit": "Série", "load": 42, "timer": ["kind": "interval", "name": "Finger lift 7/3", "work": 7, "rest": 3, "reps": 6, "sets": 4, "setRest": 120, "prep": 10, "workLabel": "Tire", "restLabel": "Relâche"]],
            ]],
            ["id": "e", "kind": "epaule", "title": "Épaules · prévention", "items": [
                ["id": "re", "label": "Rotations externes élastique", "n": 2, "reps": 15, "unit": "Série", "rest": 45],
                ["id": "yt", "label": "Y-T au sol", "n": 2, "reps": 10, "unit": "Série", "rest": 45],
            ]],
        ],
    ]
    static let climbDay: JSON = [
        "title": "Grimpe volume",
        "duree": "90 min",
        "target": ["rpe": [5, 6], "fam": "vol"],
        "blocks": [["id": "g", "kind": "grimpe", "title": "Escalade · volume", "items": [
            warmup,
            ["id": "bl", "label": "Blocs [bleu] 6A–6B", "det": "Enchaîner proprement, pieds précis", "n": 15, "unit": "Bloc", "rest": 90],
            ["id": "tv", "label": "Traversée continuité", "det": "2 × 8 min sans poser pied", "n": 1],
        ]]],
    ]
    static let fingersDay: JSON = [
        "title": "Doigts et épaules",
        "duree": "60 min",
        "target": ["rpe": [6, 7], "fam": "hard"],
        "blocks": [
            ["id": "d", "kind": "doigts", "title": "Doigts · suspensions", "items": [
                warmup,
                ["id": "su", "label": "Suspensions 10 s", "n": 5, "unit": "Série", "load": 8, "unit_load": "+kg", "timer": ["kind": "interval", "name": "Suspensions", "work": 10, "rest": 0, "reps": 1, "sets": 5, "setRest": 180, "prep": 10]],
            ]],
            ["id": "e", "kind": "epaule", "title": "Épaules", "items": [["id": "re", "label": "Rotations externes", "n": 3, "reps": 12, "unit": "Série", "rest": 45]]],
        ],
    ]
    static let limitDay: JSON = [
        "title": "Grimpe limite",
        "duree": "2 h",
        "target": ["rpe": [8, 9], "fam": "hard"],
        "blocks": [["id": "g", "kind": "grimpe", "title": "Escalade · limite", "items": [
            warmup,
            ["id": "li", "label": "Blocs au max 7A+", "det": "3 à 4 essais par bloc, repos complets", "n": 12, "unit": "Essai", "rest": 180],
        ]]],
    ]
    static let runDay: JSON = [
        "title": "Footing",
        "duree": "40 min",
        "target": ["rpe": [3, 4], "fam": "light"],
        "blocks": [["id": "c", "kind": "course", "title": "Course · endurance", "items": [["id": "fo", "label": "Footing Z2 · 35–40 min", "det": "Aisance respiratoire, tu peux parler"]]]],
    ]
}
