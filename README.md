# Carnet

Carnet d’entraînement (escalade, muscu, renfo) en application web installable (PWA), pour un athlète seul ou un coach et ses athlètes.

- **Aujourd’hui** : forme du matin, sommeil (montre facultative), lecture du jour avec conseils sourcés, séance du jour, échanges avec le coach, ressenti.
- **Mode séance** : étapes, repos automatiques, minuteurs (intervalles, clusters, contrastes), sons et voix.
- **Suivi** : bilan de la semaine, charge, intensité, forme, sommeil, VFC, charges ; **Tests** avec catalogue, protocoles, historique et évolution.
- **Plan** modifiable ; **Athlètes** pour le coach ; notifications push.

## Données et sécurité

Ce dépôt ne contient aucune donnée personnelle. Le plan, le journal et les tests vivent dans Supabase, derrière une connexion, protégés par des règles par ligne (RLS) : chacun ne voit que son carnet, et un coach seulement les carnets des athlètes qui lui sont liés. Les inscriptions sont fermées.

- `supabase/01-docs.sql` : table des données.
- `supabase/02-coach.sql` : liens coach → athlètes, abonnements aux notifications, déclencheur (les valeurs secrètes sont à renseigner).
- `supabase/functions/notify` : fonction d’envoi des notifications (Web Push chiffré, sans dépendance).

```bash
npm install
npm run dev            # développement
VITE_MOCK=1 npm run build   # build de test avec un faux serveur
```
