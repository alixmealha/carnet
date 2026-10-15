import Foundation
import ActivityKit
import WidgetKit
import HealthKit

// Fonctions propres à l'iPhone : minuteur de repos sur l'écran verrouillé (Live Activity), widgets, Apple Santé.

/// Minuteur de repos en Live Activity (écran verrouillé, Dynamic Island)
enum LiveRest {
    private static var current: Activity<RestAttributes>?

    static var enabled: Bool { ActivityAuthorizationInfo().areActivitiesEnabled && !Launch.demo }

    /// Affiche (ou met à jour) le décompte jusqu'à « until »
    static func show(title: String, until: Date, label: String, next: String? = nil, phase: String = "rest", paused: Bool = false) {
        guard enabled else { return }
        let st = RestAttributes.ContentState(until: until, start: Date(), label: label, next: next, phase: phase, paused: paused)
        let content = ActivityContent(state: st, staleDate: until.addingTimeInterval(120))
        if let a = current, a.activityState == .active {
            Task { await a.update(content) }
        } else {
            current = try? Activity.request(attributes: RestAttributes(title: title), content: content, pushType: nil)
        }
    }
    /// Fin du repos : l'activité affiche « Go » quelques secondes puis disparaît
    static func finish(label: String = "C’est reparti") {
        guard let a = current else { return }
        current = nil
        let st = RestAttributes.ContentState(until: Date(), start: Date(), label: label, next: nil, phase: "done", paused: false)
        Task { await a.end(ActivityContent(state: st, staleDate: nil), dismissalPolicy: .after(Date().addingTimeInterval(8))) }
    }
    static func stop() {
        for a in Activity<RestAttributes>.activities { Task { await a.end(nil, dismissalPolicy: .immediate) } }
        current = nil
    }
}

/// Photo de la journée pour les widgets (forme, séance, échéance), mise à jour quand les données changent
enum WidgetSync {
    private static var task: Task<Void, Never>?
    private static var last: WidgetSnapshot?
    static func schedule() {
        task?.cancel()
        task = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            if Task.isCancelled { return }
            write()
        }
    }
    @MainActor static func write() {
        let s = Store.shared
        guard s.isSelf, !s.demo else { return }
        let k = D.today, pr = PlanReader(s), e = s.journal(k)
        var w = WidgetSnapshot()
        w.day = k
        if let sc = Rules.score(e) { let v = Rules.verdict(sc, s); w.score = sc; w.verdict = v.label; w.level = v.cls }
        w.session = plain(pr.hasSession(k) ? pr.sessionName(k) : "Repos")
        w.kinds = pr.kinds(k)
        let p = pr.progress(k); w.done = p.done; w.total = p.total
        w.status = e["status"]?.string
        if w.score != nil { w.reading = DayReading.of(k, s)?.head }
        if let ev = pr.nextEvent(from: k) { w.event = ev.label; w.eventDays = D.diff(k, ev.date) }
        let mon = D.monday(k)
        for i in 0..<7 {
            let d = D.add(mon, i)
            if pr.hasSession(d) { w.weekPlanned += 1; if ["faite", "adaptee"].contains(s.journal(d)["status"]?.string ?? "") { w.weekDone += 1 } }
        }
        w.tomorrow = pr.hasSession(D.add(k, 1)) ? plain(pr.sessionName(D.add(k, 1))) : nil
        var cmp = w; cmp.updated = last?.updated ?? cmp.updated
        if cmp == last { return }
        last = w
        w.write()
        WidgetCenter.shared.reloadAllTimelines()
    }
}

/// Apple Santé : la nuit (durée et phases), la VFC et la FC de repos remplissent la carte Sommeil
@Observable
final class Health {
    static let shared = Health()
    private let store = HKHealthStore()
    var available: Bool { HKHealthStore.isHealthDataAvailable() }
    var asked: Bool { UserDefaults.standard.bool(forKey: "health-asked") }
    var auto: Bool {
        get { UserDefaults.standard.bool(forKey: "health-auto") }
        set { UserDefaults.standard.set(newValue, forKey: "health-auto") }
    }
    var busy = false

    private var types: Set<HKObjectType> {
        var t = Set<HKObjectType>()
        if let s = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { t.insert(s) }
        if let h = HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN) { t.insert(h) }
        if let r = HKObjectType.quantityType(forIdentifier: .restingHeartRate) { t.insert(r) }
        return t
    }

    func requestAccess() async -> Bool {
        guard available else { return false }
        do {
            try await store.requestAuthorization(toShare: [], read: types)
            UserDefaults.standard.set(true, forKey: "health-asked")
            return true
        } catch { return false }
    }

    struct Night { var total: Int?; var deep: Int?; var core: Int?; var rem: Int?; var awake: Int?; var hrv: Int?; var rhr: Int? }

    /// La nuit qui se termine le matin du jour k (de 18 h la veille à 14 h)
    func night(for k: String) async -> Night? {
        guard available else { return nil }
        let cal = Calendar.current
        let day = cal.date(from: DateComponents(year: Int(k.prefix(4)), month: Int(k.dropFirst(5).prefix(2)), day: Int(k.suffix(2)))) ?? Date()
        let start = day.addingTimeInterval(-6 * 3600), end = day.addingTimeInterval(14 * 3600)
        var n = Night()
        if let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            let samples: [HKCategorySample] = await withCheckedContinuation { cont in
                let q = HKSampleQuery(sampleType: type, predicate: HKQuery.predicateForSamples(withStart: start, end: end), limit: HKObjectQueryNoLimit, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]) { _, s, _ in
                    cont.resume(returning: (s as? [HKCategorySample]) ?? [])
                }
                store.execute(q)
            }
            // une seule source (la plus détaillée), pour ne pas compter deux fois la même nuit (montre + téléphone)
            let bySource = Dictionary(grouping: samples) { $0.sourceRevision.source.bundleIdentifier }
            let best = bySource.values.max { a, b in Set(a.map(\.value)).count < Set(b.map(\.value)).count } ?? []
            var deep = 0.0, core = 0.0, rem = 0.0, awake = 0.0, asleep = 0.0
            for s in best {
                let d = s.endDate.timeIntervalSince(s.startDate) / 60
                switch HKCategoryValueSleepAnalysis(rawValue: s.value) {
                case .asleepDeep: deep += d
                case .asleepCore: core += d
                case .asleepREM: rem += d
                case .awake: awake += d
                case .asleepUnspecified, .asleep: asleep += d
                default: break
                }
            }
            if deep + core + rem > 0 {
                n.deep = Int(deep.rounded()); n.core = Int(core.rounded()); n.rem = Int(rem.rounded()); n.awake = Int(awake.rounded())
                n.total = Int((deep + core + rem).rounded())
            } else if asleep > 0 { n.total = Int(asleep.rounded()) }
        }
        n.hrv = await average(.heartRateVariabilitySDNN, HKUnit.secondUnit(with: .milli), start, end).map { Int($0.rounded()) }
        n.rhr = await average(.restingHeartRate, HKUnit.count().unitDivided(by: .minute()), day, day.addingTimeInterval(86400)).map { Int($0.rounded()) }
        return n.total == nil && n.hrv == nil && n.rhr == nil ? nil : n
    }
    private func average(_ id: HKQuantityTypeIdentifier, _ unit: HKUnit, _ start: Date, _ end: Date) async -> Double? {
        guard let type = HKObjectType.quantityType(forIdentifier: id) else { return nil }
        return await withCheckedContinuation { cont in
            let q = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: HKQuery.predicateForSamples(withStart: start, end: end), options: .discreteAverage) { _, st, _ in
                cont.resume(returning: st?.averageQuantity()?.doubleValue(for: unit))
            }
            store.execute(q)
        }
    }

    /// Remplit la nuit du jour k dans le journal (sans écraser ce qui a été noté à la main)
    @MainActor
    func importNight(_ k: String, overwrite: Bool = false) async -> Bool {
        guard available else { return false }
        if !asked { _ = await requestAccess() }
        busy = true; defer { busy = false }
        guard let n = await night(for: k) else { return false }
        let s = Store.shared
        var cur = s.journal(k)["nuit"]?.object ?? [:]
        func set(_ key: String, _ v: Int?) { if let v, overwrite || cur[key] == nil { cur[key] = .num(Double(v)) } }
        if n.deep != nil {
            set("profond", n.deep); set("leger", n.core); set("rem", n.rem); set("eveil", n.awake)
        } else { set("total", n.total) }
        set("vfc", n.hrv); set("fcr", n.rhr)
        cur["src"] = "sante"
        s.jset(k, ["nuit": .obj(cur)])
        return true
    }
}
