import Foundation

/// Jours au format « AAAA-MM-JJ » (heure locale), comme la version web.
enum D {
    static let monS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
    static let monL = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
    static let dowL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
    static let dow3 = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
    static let dow1 = ["L", "M", "M", "J", "V", "S", "D"]

    private static var utcCal: Calendar = { var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "UTC")!; return c }()

    static func key(_ d: Date = Date()) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year ?? 2000, c.month ?? 1, c.day ?? 1)
    }
    static var today: String { key() }
    /// Le jour k à midi (heure locale), pour les sélecteurs de date
    static func date(_ k: String) -> Date {
        let (y, m, d) = parts(k)
        return Calendar.current.date(from: DateComponents(year: y, month: m, day: d, hour: 12)) ?? Date()
    }
    private static func parts(_ k: String) -> (Int, Int, Int) {
        let p = k.split(separator: "-").compactMap { Int($0) }
        return p.count == 3 ? (p[0], p[1], p[2]) : (2000, 1, 1)
    }
    /// Minuit UTC du jour (pour compter les jours sans souci d'heure d'été)
    static func utc(_ k: String) -> Date {
        let (y, m, d) = parts(k)
        return utcCal.date(from: DateComponents(year: y, month: m, day: d)) ?? Date(timeIntervalSince1970: 0)
    }
    static func add(_ k: String, _ n: Int) -> String {
        let d = utcCal.date(byAdding: .day, value: n, to: utc(k)) ?? utc(k)
        let c = utcCal.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year ?? 2000, c.month ?? 1, c.day ?? 1)
    }
    static func diff(_ a: String, _ b: String) -> Int { Int(((utc(b).timeIntervalSince(utc(a))) / 86400).rounded()) }
    /// 0 = lundi … 6 = dimanche
    static func dow(_ k: String) -> Int { (utcCal.component(.weekday, from: utc(k)) + 5) % 7 }
    static func dom(_ k: String) -> Int { parts(k).2 }
    static func mon(_ k: String) -> Int { parts(k).1 - 1 }
    static func monday(_ k: String) -> String { add(k, -dow(k)) }
    static func range(_ a: String, _ b: String) -> [String] { var out: [String] = []; var k = a; while k <= b { out.append(k); k = add(k, 1) }; return out }
    private static func domTxt(_ k: String) -> String { dom(k) == 1 ? "1er" : String(dom(k)) }
    static func day(_ k: String) -> String { domTxt(k) + " " + monS[mon(k)] }
    static func long(_ k: String) -> String { dowL[dow(k)] + " " + domTxt(k) + " " + monL[mon(k)] }
    static func short(_ k: String) -> String { dow3[dow(k)] + " " + day(k) }
    static func rangeTxt(_ a: String, _ b: String) -> String {
        if a == b { return day(a) }
        return mon(a) == mon(b) ? domTxt(a) + "–" + day(b) : day(a) + " – " + day(b)
    }
}

enum Fmt {
    /// 17.5 → « 17,5 »
    static func num(_ v: Double) -> String {
        if v.rounded() == v { return String(Int(v)) }
        let s = String(format: "%.2f", v).replacingOccurrences(of: #"0+$"#, with: "", options: .regularExpression)
        return s.replacingOccurrences(of: ".", with: ",")
    }
    static func mmss(_ s: Double) -> String { let t = max(0, Int(s.rounded())); return "\(t / 60):" + String(format: "%02d", t % 60) }
    static func plural(_ n: Int, _ w: String, _ p: String? = nil) -> String { "\(n) " + (n > 1 ? (p ?? w + "s") : w) }
}
