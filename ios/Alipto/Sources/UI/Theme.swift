import SwiftUI
import UIKit

// Couleurs et polices d'Alipto (les mêmes que la version web), en clair et en sombre.
extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        self.init(.sRGB, red: Double((hex >> 16) & 0xff) / 255, green: Double((hex >> 8) & 0xff) / 255, blue: Double(hex & 0xff) / 255, opacity: alpha)
    }
    /// Couleur qui change entre le mode clair et le mode sombre
    static func dyn(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
    }
}
extension UIColor {
    convenience init(hex: UInt32) {
        self.init(red: CGFloat((hex >> 16) & 0xff) / 255, green: CGFloat((hex >> 8) & 0xff) / 255, blue: CGFloat(hex & 0xff) / 255, alpha: 1)
    }
}

enum Palette {
    static let bg = Color.dyn(0xe8ebe8, 0x0f1214)
    static let surface = Color.dyn(0xf8f9f7, 0x171b1e)
    static let sunk = Color.dyn(0xdde2de, 0x21262a)
    static let ink = Color.dyn(0x15191e, 0xe8ebe6)
    static let muted = Color.dyn(0x5d656d, 0x98a1a8)
    static let rule = Color.dyn(0xcbd2cd, 0x2c3237)
    static let accent = Color.dyn(0x1f44c4, 0x86a2ff)
    static let accentInk = Color.dyn(0xffffff, 0x0c1330)
    static let accentSoft = Color.dyn(0xdfe5f9, 0x1c2646)
    static let good = Color.dyn(0x23804a, 0x58c482)
    static let warn = Color.dyn(0xa96406, 0xe3a23e)
    static let crit = Color.dyn(0xbd372a, 0xff7b6c)
    static let oil = Color.dyn(0xee9f2c, 0xf5b04b)
    static let z1 = Color.dyn(0x93a8ea, 0x3b4f93)
    static let z2 = Color.dyn(0x4d6cd6, 0x6886ec)
    static let z3 = Color.dyn(0x1d368f, 0xb4c5ff)

    /// Couleur d'un type de séance (escalade, doigts, muscu…)
    static func kind(_ k: String) -> Color {
        switch k {
        case "grimpe": return .dyn(0x1f44c4, 0x86a2ff)
        case "doigts": return .dyn(0xd5521c, 0xff8b55)
        case "muscu": return .dyn(0x4b525b, 0xa6aeb7)
        case "kine": return .dyn(0x17876b, 0x4fcaa5)
        case "epaule": return .dyn(0x8247c0, 0xbb8ef1)
        case "velo": return .dyn(0x0d8aa3, 0x52c5de)
        case "test": return .dyn(0xc1271f, 0xff6f64)
        case "rest": return .dyn(0x9aa2a0, 0x5c6468)
        case "renfo": return .dyn(0x9c6410, 0xe2a548)
        case "compet": return .dyn(0xb52f7c, 0xf07ab8)
        case "affut": return .dyn(0x557a14, 0xa6cf5b)
        case "recup": return .dyn(0x6f8a86, 0x8fb2ac)
        case "course": return .dyn(0x2e8b57, 0x5fc98c)
        case "sport": return .dyn(0xa3567a, 0xd98bb0)
        default: return .dyn(0x6a6f75, 0x8b9197)
        }
    }
}

enum Typo {
    /// Titres : Big Shoulders Display, en capitales
    static func display(_ size: CGFloat, relativeTo style: Font.TextStyle = .largeTitle) -> Font {
        .custom("BigShouldersDisplayThin-ExtraBold", size: size, relativeTo: style)
    }
    static func sans(_ size: CGFloat, _ weight: Font.Weight = .regular, relativeTo style: Font.TextStyle = .body) -> Font {
        let name: String
        switch weight {
        case .medium: name = "IBMPlexSans-Medium"
        case .semibold: name = "IBMPlexSans-SemiBold"
        case .bold, .heavy, .black: name = "IBMPlexSans-Bold"
        default: name = "IBMPlexSans-Regular"
        }
        return .custom(name, size: size, relativeTo: style)
    }
    static func mono(_ size: CGFloat, _ weight: Font.Weight = .regular, relativeTo style: Font.TextStyle = .body) -> Font {
        let name: String
        switch weight {
        case .medium: name = "IBMPlexMono-Medium"
        case .semibold, .bold, .heavy, .black: name = "IBMPlexMono-SemiBold"
        default: name = "IBMPlexMono-Regular"
        }
        return .custom(name, size: size, relativeTo: style)
    }
}
