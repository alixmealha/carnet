# Notifications de l'appli iPhone (APNs)

Pour que le coach reçoive « Pierre a validé sa séance » (et l'athlète « ton coach a commenté ») **sur l'appli iPhone, même fermée**.
La version web a déjà ses propres notifications ; rien à changer pour elle.

## 1. Créer la clé chez Apple (une seule fois)
1. developer.apple.com → **Certificates, Identifiers & Profiles** → **Keys** → **+**.
2. Nom : `Alipto notifications`. Coche **Apple Push Notifications service (APNs)** → Continue → Register.
3. **Download** : tu obtiens un fichier `AuthKey_XXXXXXXXXX.p8`. Apple ne le propose **qu'une fois** : garde-le.
4. Note l'**identifiant de clé** (10 caractères, aussi dans le nom du fichier) et ton **Team ID** (developer.apple.com → Membership).

## 2. Côté Supabase
1. SQL Editor : exécute `supabase/08-apns.sql` (doit afficher `iphones_enregistres = 0`).
2. Edge Functions → **notify** : redéploie avec le contenu de `supabase/functions/notify/index.ts` (la case « Verify JWT » reste décochée, comme avant).
3. Edge Functions → Secrets, ajoute :
   - `APNS_KEY` : tout le contenu du fichier `.p8` (de `-----BEGIN PRIVATE KEY-----` à `-----END PRIVATE KEY-----`)
   - `APNS_KEY_ID` : l'identifiant de clé
   - `APNS_TEAM_ID` : ton Team ID

Ne partage jamais le `.p8` : il va seulement dans les secrets Supabase.

## 3. Tester
Installe la nouvelle version depuis TestFlight, accepte les notifications au premier lancement, puis valide une séance depuis un autre compte : le coach reçoit la notification.
Une appli lancée depuis Xcode utilise le serveur de test d'Apple, une appli TestFlight le vrai : les deux sont gérés automatiquement.
