import SwiftUI

// Onglet Athlètes (coach, comme la version web) : une carte par athlète (forme, nuit, séances de la semaine, gênes),
// l'ajout d'un athlète avec son code, et le fil d'activité des 14 derniers jours.

private let STATUS_LBL = ["faite": "Faite", "adaptee": "Adaptée", "sautee": "Sautée"]

enum Coach {
    static func seen() -> [String: Double] {
        (Store.shared.get("seen", owner: Store.SELF)?.object ?? [:]).compactMapValues { $0.double }
    }
    static func markSeen(_ uid: String) {
        var m = Store.shared.get("seen", owner: Store.SELF) ?? .emptyObject
        m[uid] = .num((Date().timeIntervalSince1970 * 1000).rounded())
        Store.shared.put("seen", m, owner: Store.SELF)
    }
    static func dayName(_ uid: String, _ k: String) -> String {
        guard let d = Store.shared.get("p:" + k, owner: uid) else { return "Repos" }
        if let s = d["short"]?.string, !s.isEmpty { return s }
        var ks: [String] = []
        for b in d["blocks"]?.array ?? [] {
            let kd = b["kind"]?.string ?? ""
            if kd != "rest", let l = KIND[kd], !ks.contains(l) { ks.append(l) }
        }
        return ks.isEmpty ? "Repos" : ks.joined(separator: ", ")
    }

    struct Act: Identifiable {
        let uid: String; let k: String?; let kind: String; let at: Double; var e: JSON? = nil; var text: String? = nil
        var id: String {
            let kk: String = k ?? ""
            return uid + kind + kk + String(at)
        }
    }
    /// Séances validées, séances ou plan modifiés par l'athlète, messages (14 derniers jours)
    static func activity(_ uid: String) -> [Act] {
        let s = Store.shared, from = D.add(D.today, -14), since = Date().timeIntervalSince1970 * 1000 - 14 * 86_400_000
        var out: [Act] = []
        for id in s.ids("j:", owner: uid) {
            let k = String(id.dropFirst(2)); if k < from { continue }
            guard let e = s.get(id, owner: uid), let at = s.updatedAt(id, owner: uid) else { continue }
            // un jour rempli plus de 3 jours après coup (import, rattrapage) ne compte pas comme nouveauté
            if at - (D.utc(k).timeIntervalSince1970 * 1000 + 86_399_000) > 3 * 86_400_000 { continue }
            if e["status"] != nil || e["rpe"]?.double != nil || e["note"] != nil { out.append(Act(uid: uid, k: k, kind: "session", at: at, e: e)) }
        }
        for id in s.ids("p:", owner: uid) {
            if let ed = s.get(id, owner: uid)?["edited"], ed["uid"]?.string == uid, let at = ed["at"]?.double, at > since {
                out.append(Act(uid: uid, k: String(id.dropFirst(2)), kind: "edit", at: at))
            }
        }
        if let ed = s.get("plan", owner: uid)?["edited"], ed["uid"]?.string == uid, let at = ed["at"]?.double, at > since {
            out.append(Act(uid: uid, k: nil, kind: "planedit", at: at))
        }
        for id in s.ids("c:", owner: uid) {
            let k = String(id.dropFirst(2)); if k < from { continue }
            guard let last = s.get(id, owner: uid)?["msgs"]?.array.last, last["uid"]?.string == uid else { continue }
            out.append(Act(uid: uid, k: k, kind: "msg", at: last["at"]?.double ?? (s.updatedAt(id, owner: uid) ?? 0), text: last["text"]?.string))
        }
        return out
    }
    static func unread() -> Int {
        let seen = seen()
        return Store.shared.athletes.reduce(0) { n, uid in n + activity(uid).filter { $0.at > (seen[uid] ?? 0) }.count }
    }
}

struct AthletesView: View {
    @State private var store = Store.shared
    @State private var day: DayRef?
    var body: some View {
        let _ = store.version
        let seen = Coach.seen()
        let feed = store.athletes.flatMap { Coach.activity($0) }.sorted { $0.at > $1.at }.prefix(30)
        let unread = feed.filter { $0.at > (seen[$0.uid] ?? 0) }.count
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .bottom) {
                        VStack(alignment: .leading, spacing: 0) {
                            Eyebrow("Coach · " + Fmt.plural(store.athletes.count, "athlète"))
                            DisplayTitle("Athlètes", size: 52)
                        }
                        Spacer()
                        if unread > 0 {
                            Button("Tout marquer lu") { for a in store.athletes { Coach.markSeen(a) } }.buttonStyle(SmallButton())
                        }
                    }
                    .padding(.top, 8)
                    if store.athletes.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            CardHeader("Ajoute ton premier athlète")
                            Text("Demande à ton athlète son code : Plus → Profil → Mon coach → Donner accès à un coach.").font(Typo.sans(14)).foregroundStyle(Palette.muted)
                            AddAthleteRow()
                        }
                        .card()
                    }
                    ForEach(store.athletes, id: \.self) { uid in
                        AthleteCard(uid: uid, unread: Coach.activity(uid).filter { $0.at > (seen[uid] ?? 0) }.count) { open(uid) } onDay: { openDay(uid, D.today) }
                    }
                    if !store.athletes.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            CardHeader("Ajouter un athlète")
                            AddAthleteRow()
                        }
                        .card()
                        FeedCard(feed: Array(feed), seen: seen, unread: unread) { a in
                            if a.kind == "planedit" { openPlan(a.uid) } else { openDay(a.uid, a.k ?? D.today) }
                        }
                    }
                }
                .padding(.horizontal, 16).padding(.bottom, 30)
            }
            .scrollIndicators(.hidden)
            .background(Palette.bg)
            .statusBarScrim()
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(item: $day) { r in DayDetail(k: r.k) }
        }
    }
    private func open(_ uid: String) {
        Haptics.tap()
        store.subject = uid; Coach.markSeen(uid)
        AppState.shared.tab = "today"
    }
    private func openDay(_ uid: String, _ k: String) {
        Haptics.tap()
        store.subject = uid; Coach.markSeen(uid)
        day = DayRef(k: k)
    }
    private func openPlan(_ uid: String) {
        store.subject = uid; Coach.markSeen(uid)
        UserDefaults.standard.set("prog", forKey: "plan-view")
        AppState.shared.tab = "plan"
    }
}

struct DayRef: Identifiable, Hashable { let k: String; var id: String { k } }

private struct AthleteCard: View {
    let uid: String
    let unread: Int
    let onOpen: () -> Void
    let onDay: () -> Void
    @State private var store = Store.shared
    var body: some View {
        let t = D.today, e = store.get("j:" + t, owner: uid) ?? .emptyObject
        let sc = Rules.score(e)
        let week = (0..<7).map { D.add(t, -6 + $0) }
        let done = week.filter { ["faite", "adaptee"].contains(store.get("j:" + $0, owner: uid)?["status"]?.string ?? "") }.count
        let planned = week.filter { Coach.dayName(uid, $0) != "Repos" }.count
        let scores = week.compactMap { Rules.score(store.get("j:" + $0, owner: uid) ?? .emptyObject) }
        let avg: Double? = scores.isEmpty ? nil : (Double(scores.reduce(0, +)) / Double(scores.count) * 10).rounded() / 10
        let nt = Core.shared.call("rules.nightTotal", e)?.int
        let flags = Core.shared.constant("rules.FLAGS").array.filter { e["flags"]?[$0[0]?.string ?? ""]?.truthy == true }
        VStack(alignment: .leading, spacing: 12) {
            Button(action: onOpen) {
                HStack(spacing: 12) {
                    Text(String(store.name(uid).prefix(1)).uppercased()).font(Typo.display(22)).foregroundStyle(Palette.accentInk)
                        .frame(width: 44, height: 44).background(Palette.accent, in: Circle())
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Text(store.name(uid)).font(Typo.sans(17, .semibold)).foregroundStyle(Palette.ink)
                            if store.locks[uid] ?? false { Image(systemName: "lock.fill").font(.system(size: 12)).foregroundStyle(Palette.muted) }
                        }
                        Text(todayLine(uid, e)).font(Typo.sans(13.5)).foregroundStyle(Palette.muted).lineLimit(1)
                    }
                    Spacer(minLength: 0)
                    if unread > 0 {
                        Text("\(unread)").font(Typo.mono(12, .bold)).foregroundStyle(.white).padding(.horizontal, 7).frame(minHeight: 22).background(Palette.crit, in: Capsule())
                    }
                    Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Palette.muted.opacity(0.6))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            HStack(spacing: 8) {
                metric("Forme", sc.map { "\($0)/25" } ?? "—", sc.map { Palette.level(Rules.verdict($0, store).cls) } ?? Palette.ink)
                metric("Nuit", nt.map { durShort($0) } ?? "—", Palette.ink)
                metric("7 jours", "\(done)/\(planned)", Palette.ink)
                metric("Forme 7 j", avg.map { Fmt.num($0) } ?? "—", Palette.ink)
            }
            if !flags.isEmpty {
                Text(flags.map { f in (f[1]?.string ?? "") + (e["gene"]?[f[0]?.string ?? ""]?.int.map { " \($0)/10" } ?? "") }.joined(separator: " · "))
                    .font(Typo.sans(13.5, .medium)).foregroundStyle(Palette.warn)
            }
            HStack(spacing: 10) {
                Button("Séance du jour", action: onDay).buttonStyle(BigButton(kind: .plain))
                Button("Ouvrir son carnet", action: onOpen).buttonStyle(BigButton(kind: .soft))
            }
        }
        .card()
    }
    private func todayLine(_ uid: String, _ e: JSON) -> String {
        var s = "Aujourd’hui : " + Coach.dayName(uid, D.today)
        if let st = e["status"]?.string, let l = STATUS_LBL[st] { s += " · " + l.lowercased() }
        return s
    }
    private func metric(_ l: String, _ v: String, _ c: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(l).font(Typo.sans(11.5)).foregroundStyle(Palette.muted)
            Text(v).font(Typo.mono(15, .semibold)).foregroundStyle(c).lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10).background(Palette.sunk.opacity(0.6), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

func durShort(_ min: Int) -> String {
    let h = min / 60, m = min % 60
    return h > 0 ? "\(h)h" + String(format: "%02d", m) : "\(m)min"
}

private struct FeedCard: View {
    let feed: [Coach.Act]
    let seen: [String: Double]
    let unread: Int
    let onOpen: (Coach.Act) -> Void
    @State private var store = Store.shared
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            CardHeader("Activité récente") {
                if unread > 0 { Text(Fmt.plural(unread, "non lu", "non lus")).font(Typo.sans(13)).foregroundStyle(Palette.accent) }
            }
            if feed.isEmpty { Text("Rien sur les 14 derniers jours.").font(Typo.sans(14)).foregroundStyle(Palette.muted) }
            ForEach(feed) { a in
                Button { onOpen(a) } label: { row(a) }.buttonStyle(.plain)
                Divider().overlay(Palette.rule.opacity(0.5))
            }
        }
        .card()
    }
    private func row(_ a: Coach.Act) -> some View {
        let isNew = a.at > (seen[a.uid] ?? 0)
        return HStack(alignment: .top, spacing: 10) {
            Circle().fill(isNew ? Palette.accent : .clear).frame(width: 8, height: 8).padding(.top, 6)
            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(store.name(a.uid) + " · " + what(a)).font(Typo.sans(14.5, isNew ? .semibold : .regular)).foregroundStyle(Palette.ink)
                    Spacer()
                    Text(a.k.map { D.short($0) } ?? D.day(D.key(Date(timeIntervalSince1970: a.at / 1000)))).font(Typo.mono(12)).foregroundStyle(Palette.muted)
                }
                if let m = metrics(a), !m.isEmpty { Text(m).font(Typo.sans(13)).foregroundStyle(Palette.muted) }
                if let n = a.kind == "msg" ? a.text : a.e?["note"]?.string, !n.isEmpty {
                    Text(n).font(Typo.sans(13.5)).foregroundStyle(Palette.ink.opacity(0.85)).lineLimit(3)
                }
            }
        }
        .padding(.vertical, 8).contentShape(Rectangle())
    }
    private func what(_ a: Coach.Act) -> String {
        switch a.kind {
        case "msg": return "message"
        case "edit": return "a modifié sa séance"
        case "planedit": return "a modifié son plan"
        default:
            if let st = a.e?["status"]?.string, let l = STATUS_LBL[st] { return "séance " + l.lowercased() }
            return "journal"
        }
    }
    private func metrics(_ a: Coach.Act) -> String? {
        guard a.kind == "session", let e = a.e else { return nil }
        var p: [String] = []
        if let sc = Rules.score(e) { p.append("Forme \(sc)") }
        if let r = e["rpe"]?.double { p.append("Ressenti " + Fmt.num(r)) }
        if let i = e["siv"]?["i"]?.double {
            let v: Double = e["siv"]?["v"]?.double ?? 0
            p.append("I " + Fmt.num(i) + " V " + Fmt.num(v))
        }
        if let l = Core.shared.call("activity.logSummary", e)?.string, !l.isEmpty { p.append(l) }
        if let d = e["duree"]?.double { p.append(Fmt.num(d) + " min") }
        return p.joined(separator: " · ")
    }
}
