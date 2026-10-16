import SwiftUI

/// Fiche complète d'un jour (forme, séance, après la séance), ouverte depuis le calendrier ; balayer pour changer de jour
struct DayDetail: View {
    let k: String
    @State private var sel: String
    @State private var dir: Edge = .trailing
    @State private var edit = false
    @State private var store = Store.shared
    init(k: String) { self.k = k; _sel = State(initialValue: k) }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                Eyebrow(sel == D.today ? "Aujourd’hui" : D.long(sel))
                    .padding(.top, 4)
                DayContent(k: sel, hero: false)
            }
            .id(sel)
            .transition(.asymmetric(insertion: .move(edge: dir).combined(with: .opacity), removal: .opacity))
            .padding(.horizontal, 16).padding(.bottom, 40)
        }
        .background(Palette.bg)
        .navigationTitle(D.short(sel))
        .navigationBarTitleDisplayMode(.inline)
        .gesture(DragGesture(minimumDistance: 30).onEnded { v in
            guard abs(v.translation.width) > 80, abs(v.translation.width) > abs(v.translation.height) * 1.6 else { return }
            go(v.translation.width < 0 ? 1 : -1)
        })
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                if store.canEditPlan {
                    Button { Haptics.tap(); edit = true } label: { Image(systemName: "square.and.pencil") }.accessibilityLabel("Modifier la séance")
                }
                Button { go(-1) } label: { Image(systemName: "chevron.left") }.accessibilityLabel("Jour précédent")
                Button { go(1) } label: { Image(systemName: "chevron.right") }.accessibilityLabel("Jour suivant")
            }
        }
        .sheet(isPresented: $edit) { NavigationStack { DayEditorView(k: sel) } }
    }
    private func go(_ n: Int) {
        Haptics.select()
        dir = n > 0 ? .trailing : .leading
        withAnimation(.spring(response: 0.38, dampingFraction: 0.88)) { sel = D.add(sel, n) }
    }
}
