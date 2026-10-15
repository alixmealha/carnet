import SwiftUI

/// Connexion avec le compte Alipto (le même que sur la version web). Les inscriptions se font sur invitation.
struct LoginView: View {
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?
    @State private var appear = false
    @FocusState private var focus: Field?
    enum Field { case email, password }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Spacer(minLength: 60)
                LogoMark()
                    .frame(width: 64, height: 64)
                    .scaleEffect(appear ? 1 : 0.6).opacity(appear ? 1 : 0)
                Text("ALIPTO").font(Typo.display(64)).foregroundStyle(Palette.ink)
                    .padding(.top, 18)
                    .offset(y: appear ? 0 : 14).opacity(appear ? 1 : 0)
                Text("Ton carnet d’entraînement : la séance du jour, ta forme, tes séries.")
                    .font(Typo.sans(17)).foregroundStyle(Palette.muted)
                    .padding(.top, 4)
                    .offset(y: appear ? 0 : 14).opacity(appear ? 1 : 0)

                VStack(spacing: 14) {
                    FieldBox(label: "E-mail") {
                        TextField("", text: $email)
                            .textContentType(.username).keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never).autocorrectionDisabled()
                            .focused($focus, equals: .email).submitLabel(.next)
                            .onSubmit { focus = .password }
                    }
                    FieldBox(label: "Mot de passe") {
                        SecureField("", text: $password)
                            .textContentType(.password)
                            .focused($focus, equals: .password).submitLabel(.go)
                            .onSubmit { Task { await signIn() } }
                    }
                    if let error {
                        Text(error).font(Typo.sans(14.5, .medium)).foregroundStyle(Palette.crit)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .transition(.opacity)
                    }
                    Button { Task { await signIn() } } label: {
                        HStack(spacing: 10) {
                            if busy { ProgressView().tint(Palette.accentInk) }
                            Text(busy ? "Connexion…" : "Se connecter")
                        }
                    }
                    .buttonStyle(BigButton())
                    .disabled(busy || email.isEmpty || password.isEmpty)
                    .padding(.top, 6)
                    Text("Même compte que sur la version web. Pas de compte ? Demande une invitation à ton coach.")
                        .font(Typo.sans(13.5)).foregroundStyle(Palette.muted)
                }
                .padding(.top, 34)
                .offset(y: appear ? 0 : 24).opacity(appear ? 1 : 0)
            }
            .padding(.horizontal, 24)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .onAppear { withAnimation(.spring(response: 0.8, dampingFraction: 0.8).delay(0.05)) { appear = true } }
    }

    private func signIn() async {
        guard !busy, !email.isEmpty, !password.isEmpty else { return }
        busy = true; error = nil; focus = nil
        defer { busy = false }
        do {
            try await Backend.shared.signIn(email: email.trimmingCharacters(in: .whitespaces), password: password)
            Store.shared.wipe()
            await Store.shared.syncNow()
            password = ""
            Haptics.success()
            AppState.shared.signedIn = true
        } catch {
            Haptics.warning()
            withAnimation { self.error = error.localizedDescription }
        }
    }
}

/// Le « A » d'Alipto avec sa goutte d'huile (comme l'icône)
struct LogoMark: View {
    var body: some View {
        GeometryReader { g in
            let s = min(g.size.width, g.size.height)
            ZStack {
                RoundedRectangle(cornerRadius: s * 0.24, style: .continuous).fill(Color(hex: 0x15191e))
                Text("A").font(Typo.display(s * 0.78)).foregroundStyle(Color(hex: 0x6f8cf0)).offset(y: s * 0.03)
                Circle().fill(Color(hex: 0xf2a93b)).frame(width: s * 0.16, height: s * 0.16).offset(x: s * 0.24, y: -s * 0.22)
            }
            .frame(width: s, height: s)
        }
    }
}
