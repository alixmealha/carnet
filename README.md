# Carnet

Carnet d’entraînement (escalade, muscu, renfo) en application web installable (PWA), pour un athlète seul ou un coach et ses athlètes.

- **Aujourd’hui** : forme du matin, sommeil (montre facultative), lecture du jour avec conseils sourcés, séance du jour, échanges avec le coach, ressenti.
- **Mode séance** : étapes, repos automatiques, minuteurs (intervalles, clusters, contrastes), sons et voix.
- **Suivi** : bilan de la semaine, charge, intensité, forme, sommeil, VFC, charges ; **Tests** avec catalogue, protocoles, historique et évolution.
- **Plan** modifiable (verrouillable par le coach) ; **Athlètes** pour le coach ; notifications push.
- **Notation selon l’activité** : profil spécificité / intensité / volume pour l’escalade ; exercices réalisés (séries × répétitions × charge) pour la muscu, le renfo et la kiné, avec la douleur en kiné ; distance et fréquence cardiaque pour le cardio ; ressenti × durée pour toutes.
- **Comptes** : profil rempli à la première connexion ; rôle athlète, coach ou administrateur ; un athlète ouvre son carnet à un coach avec un code ; **Paramètres** (apparence claire / sombre, séance, suivi, notifications, coach et athlètes, compte, données) ; **Administration** pour créer les comptes.

## Rôles

| | Athlète | Coach | Administrateur |
|---|---|---|---|
| Son propre carnet | oui | non | oui |
| Carnet d’un athlète lié | — | lecture, échanges, plan, séances, tests | idem coach |
| Journal de l’athlète | le sien | lecture seule | lecture seule |
| Verrouiller le plan d’un athlète | — | oui | oui |
| Créer / supprimer des comptes, changer un rôle | — | — | oui |

Le rôle est choisi une seule fois (à la première connexion) ou fixé par l’administrateur ; la base refuse tout autre changement. L’administrateur ne lit pas les carnets des autres, sauf ceux dont il est le coach.

## Données et sécurité

Ce dépôt ne contient aucune donnée personnelle. Le plan, le journal et les tests vivent dans Supabase, derrière une connexion, protégés par des règles par ligne (RLS). Les inscriptions sont fermées : les comptes se créent depuis l’écran Administration.

- `supabase/01-docs.sql` : table des données.
- `supabase/02-comptes.sql` : profils et rôles, liens coach → athlètes par code, verrou du plan, droits du coach, fonctions d’administration, abonnements et déclencheur des notifications. Relançable sans risque. Les valeurs entre `__…__` sont à renseigner.
- `supabase/functions/notify` : envoi des notifications (Web Push chiffré, sans dépendance).
- `supabase/functions/admin` : création (invitation par e-mail ou mot de passe provisoire), e-mail de réinitialisation, mot de passe provisoire et suppression de comptes, réservés à l’administrateur (clé service côté serveur uniquement). À déployer sans « Verify JWT » : la fonction vérifie elle-même la session et le rôle.

Les e-mails (invitation, mot de passe oublié) passent par l’envoi d’e-mails de Supabase : un SMTP personnalisé est nécessaire pour écrire à d’autres adresses que celles de l’équipe du projet.

```bash
npm install
npm run dev                 # développement
VITE_MOCK=1 npm run build   # build de test avec un faux serveur (comptes alix@, athlete@, coach@, autre@test.fr / test)
VITE_LOCAL=1 npm run build  # sans compte : tout reste sur l’appareil
```
