import SwiftUI

struct RootView: View {
    var body: some View {
        ZStack {
            Palette.bg.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 16) {
                Text("JEUDI 15 OCTOBRE").font(Typo.mono(13)).foregroundStyle(Palette.muted).tracking(1.5)
                Text("AUJOURD’HUI").font(Typo.display(52)).foregroundStyle(Palette.ink)
                VStack(alignment: .leading, spacing: 8) {
                    Text("Séance du jour").font(Typo.mono(12, .medium)).foregroundStyle(Palette.muted).textCase(.uppercase)
                    Text("Muscu A · vertical").font(Typo.sans(20, .semibold)).foregroundStyle(Palette.ink)
                    Text("Tractions lestées 7 × 5 · +17,5 kg").font(Typo.sans(15)).foregroundStyle(Palette.muted)
                }
                .padding(18)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Palette.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                Spacer()
            }
            .padding(20)
        }
    }
}
