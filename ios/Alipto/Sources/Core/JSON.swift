import Foundation

/// Valeur JSON libre : les documents d'Alipto (plan, séances, journal…) sont du JSON partagé avec la version web.
/// On les lit avec des accesseurs typés, et on les réécrit sans perdre les champs que l'appli iPhone ne connaît pas.
enum JSON: Codable, Equatable, Hashable {
    case null
    case bool(Bool)
    case num(Double)
    case str(String)
    case arr([JSON])
    case obj([String: JSON])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let b = try? c.decode(Bool.self) { self = .bool(b) }
        else if let n = try? c.decode(Double.self) { self = .num(n) }
        else if let s = try? c.decode(String.self) { self = .str(s) }
        else if let a = try? c.decode([JSON].self) { self = .arr(a) }
        else if let o = try? c.decode([String: JSON].self) { self = .obj(o) }
        else { throw DecodingError.dataCorruptedError(in: c, debugDescription: "JSON invalide") }
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let b): try c.encode(b)
        case .num(let n):
            // entiers écrits sans décimale (comme en JavaScript)
            if n.rounded() == n, abs(n) < 9.0e15 { try c.encode(Int64(n)) } else { try c.encode(n) }
        case .str(let s): try c.encode(s)
        case .arr(let a): try c.encode(a)
        case .obj(let o): try c.encode(o)
        }
    }

    // MARK: accès
    subscript(key: String) -> JSON? {
        get { if case .obj(let o) = self { return o[key] }; return nil }
        set {
            guard case .obj(var o) = self else { return }
            if let v = newValue, v != .null { o[key] = v } else { o.removeValue(forKey: key) }
            self = .obj(o)
        }
    }
    subscript(index: Int) -> JSON? { if case .arr(let a) = self, index >= 0, index < a.count { return a[index] }; return nil }
    var string: String? { if case .str(let s) = self { return s }; return nil }
    var double: Double? { if case .num(let n) = self { return n }; return nil }
    var int: Int? { if case .num(let n) = self { return Int(n) }; return nil }
    var bool: Bool? { if case .bool(let b) = self { return b }; return nil }
    var array: [JSON] { if case .arr(let a) = self { return a }; return [] }
    var object: [String: JSON] { if case .obj(let o) = self { return o }; return [:] }
    var isNull: Bool { if case .null = self { return true }; return false }
    /// Vrai pour tout ce que JavaScript considère comme « vrai »
    var truthy: Bool {
        switch self {
        case .null: return false
        case .bool(let b): return b
        case .num(let n): return n != 0
        case .str(let s): return !s.isEmpty
        case .arr, .obj: return true
        }
    }

    static func from(_ any: Any?) -> JSON {
        switch any {
        case nil: return .null
        case let v as JSON: return v
        case let v as Bool: return .bool(v)
        case let v as Int: return .num(Double(v))
        case let v as Double: return .num(v)
        case let v as String: return .str(v)
        case let v as [Any]: return .arr(v.map { JSON.from($0) })
        case let v as [String: Any]: return .obj(v.mapValues { JSON.from($0) })
        default: return .null
        }
    }
    static let emptyObject = JSON.obj([:])

    func encoded() -> Data { (try? JSONEncoder().encode(self)) ?? Data("null".utf8) }
    static func decode(_ data: Data) -> JSON? { try? JSONDecoder().decode(JSON.self, from: data) }
}

extension JSON: ExpressibleByStringLiteral, ExpressibleByIntegerLiteral, ExpressibleByFloatLiteral, ExpressibleByBooleanLiteral, ExpressibleByDictionaryLiteral, ExpressibleByArrayLiteral, ExpressibleByNilLiteral {
    init(stringLiteral v: String) { self = .str(v) }
    init(integerLiteral v: Int) { self = .num(Double(v)) }
    init(floatLiteral v: Double) { self = .num(v) }
    init(booleanLiteral v: Bool) { self = .bool(v) }
    init(dictionaryLiteral elements: (String, JSON)...) { self = .obj(Dictionary(elements, uniquingKeysWith: { $1 })) }
    init(arrayLiteral elements: JSON...) { self = .arr(elements) }
    init(nilLiteral: ()) { self = .null }
}

extension Array {
    /// Élément à l'indice i, ou nil hors limites
    func at(_ i: Int) -> Element? { i >= 0 && i < count ? self[i] : nil }
}
