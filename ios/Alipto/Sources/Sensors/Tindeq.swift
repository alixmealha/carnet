import CoreBluetooth
import Observation

/// Capteur de force Tindeq Progressor, en Bluetooth.
/// Protocole (client officiel de Tindeq) : commandes d'un octet écrites sur la caractéristique de contrôle,
/// mesures reçues sur la caractéristique de données : [0x01, taille, puis blocs de 8 octets] ; chaque bloc = force en kg (float32)
/// + temps de l'appareil en microsecondes (uint32), petit-boutiste.
@Observable
final class Tindeq: NSObject {
    static let shared = Tindeq()

    enum State: Equatable { case idle, scanning, connecting, ready, streaming, failed(String) }

    private(set) var state: State = .idle
    private(set) var deviceName = ""
    /// Dernière force reçue en kg (rafraîchie une vingtaine de fois par seconde pour l'affichage)
    private(set) var force: Double = 0

    @ObservationIgnored var onSample: ((_ t: Double, _ kg: Double) -> Void)?
    @ObservationIgnored private var central: CBCentralManager?
    @ObservationIgnored private var peripheral: CBPeripheral?
    @ObservationIgnored private var control: CBCharacteristic?
    @ObservationIgnored private var data: CBCharacteristic?
    @ObservationIgnored private var t0: UInt32?
    @ObservationIgnored private var lastPublish: Double = -1
    @ObservationIgnored private var wantConnect = false
    @ObservationIgnored private var scanTimeout: DispatchWorkItem?

    private static let service = CBUUID(string: "7E4E1701-1EA6-40C9-9DCC-13D34FFEAD57")
    private static let dataChar = CBUUID(string: "7E4E1702-1EA6-40C9-9DCC-13D34FFEAD57")
    private static let controlChar = CBUUID(string: "7E4E1703-1EA6-40C9-9DCC-13D34FFEAD57")
    private enum Cmd: UInt8 { case tare = 100, start = 101, stop = 102 }

    private override init() { super.init() }

    var isReady: Bool { state == .ready || state == .streaming }

    // MARK: connexion

    func connect() {
        wantConnect = true
        switch state {
        case .ready, .streaming, .scanning, .connecting: return
        default: break
        }
        state = .scanning
        if let central {
            if central.state == .poweredOn { startScan() }
        } else {
            central = CBCentralManager(delegate: self, queue: .main)
        }
    }

    func disconnect() {
        wantConnect = false
        scanTimeout?.cancel()
        if state == .streaming { send(.stop) }
        central?.stopScan()
        if let p = peripheral { central?.cancelPeripheralConnection(p) }
        peripheral = nil; control = nil; data = nil
        state = .idle
        onSample = nil
    }

    private func startScan() {
        guard let central else { return }
        state = .scanning
        central.scanForPeripherals(withServices: nil, options: nil)
        scanTimeout?.cancel()
        let w = DispatchWorkItem { [weak self] in
            guard let self, self.state == .scanning else { return }
            self.central?.stopScan()
            self.state = .failed("Tindeq introuvable. Réveille-le en appuyant sur son bouton, puis réessaie.")
        }
        scanTimeout = w
        DispatchQueue.main.asyncAfter(deadline: .now() + 20, execute: w)
    }

    // MARK: commandes

    func tare() { send(.tare) }

    func start() {
        guard isReady else { return }
        t0 = nil; lastPublish = -1
        send(.start)
        state = .streaming
    }

    func stop() {
        guard state == .streaming else { return }
        send(.stop)
        state = .ready
    }

    private func send(_ c: Cmd) {
        guard let p = peripheral, let ch = control else { return }
        p.writeValue(Data([c.rawValue]), for: ch, type: .withResponse)
    }
}

extension Tindeq: CBCentralManagerDelegate {
    func centralManagerDidUpdateState(_ c: CBCentralManager) {
        switch c.state {
        case .poweredOn:
            if wantConnect, state == .scanning { startScan() }
        case .unauthorized:
            state = .failed("Autorise le Bluetooth pour Alipto dans Réglages → Alipto.")
        case .poweredOff:
            state = .failed("Le Bluetooth est désactivé sur ce téléphone.")
        case .unsupported:
            state = .failed("Ce téléphone ne gère pas le Bluetooth.")
        default: break
        }
    }

    func centralManager(_ c: CBCentralManager, didDiscover p: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        let name = p.name ?? (advertisementData[CBAdvertisementDataLocalNameKey] as? String) ?? ""
        guard name.hasPrefix("Progressor") else { return }
        scanTimeout?.cancel()
        c.stopScan()
        peripheral = p
        p.delegate = self
        deviceName = name
        state = .connecting
        c.connect(p, options: nil)
    }

    func centralManager(_ c: CBCentralManager, didConnect p: CBPeripheral) {
        p.discoverServices([Tindeq.service])
    }

    func centralManager(_ c: CBCentralManager, didFailToConnect p: CBPeripheral, error: Error?) {
        state = .failed("Connexion impossible. Rapproche le Tindeq et réessaie.")
    }

    func centralManager(_ c: CBCentralManager, didDisconnectPeripheral p: CBPeripheral, error: Error?) {
        let lost = state == .streaming || state == .ready
        peripheral = nil; control = nil; data = nil
        state = lost && wantConnect ? .failed("Connexion perdue avec le Tindeq.") : .idle
    }
}

extension Tindeq: CBPeripheralDelegate {
    func peripheral(_ p: CBPeripheral, didDiscoverServices error: Error?) {
        for s in p.services ?? [] where s.uuid == Tindeq.service {
            p.discoverCharacteristics([Tindeq.dataChar, Tindeq.controlChar], for: s)
        }
    }

    func peripheral(_ p: CBPeripheral, didDiscoverCharacteristicsFor s: CBService, error: Error?) {
        for ch in s.characteristics ?? [] {
            if ch.uuid == Tindeq.dataChar { data = ch }
            if ch.uuid == Tindeq.controlChar { control = ch }
        }
        if let d = data, control != nil { p.setNotifyValue(true, for: d) }
    }

    func peripheral(_ p: CBPeripheral, didUpdateNotificationStateFor ch: CBCharacteristic, error: Error?) {
        if ch.uuid == Tindeq.dataChar, ch.isNotifying, state == .connecting { state = .ready }
    }

    func peripheral(_ p: CBPeripheral, didUpdateValueFor ch: CBCharacteristic, error: Error?) {
        guard ch.uuid == Tindeq.dataChar, let d = ch.value, d.count >= 10, d[d.startIndex] == 1, state == .streaming else { return }
        d.withUnsafeBytes { raw in
            var i = 2
            while i + 8 <= raw.count {
                let wBits = UInt32(littleEndian: raw.loadUnaligned(fromByteOffset: i, as: UInt32.self))
                let us = UInt32(littleEndian: raw.loadUnaligned(fromByteOffset: i + 4, as: UInt32.self))
                let kg = Double(Float(bitPattern: wBits))
                if t0 == nil { t0 = us }
                let t = Double(us &- (t0 ?? us)) / 1_000_000
                if t - lastPublish >= 0.05 || lastPublish < 0 { lastPublish = t; force = kg }
                onSample?(t, kg)
                i += 8
            }
        }
    }
}
