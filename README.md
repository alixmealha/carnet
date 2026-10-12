# Carnet

Carnet d’entraînement personnel (escalade, muscu) en application web installable (PWA).

- Interface : Preact + Vite, fonctionne hors ligne.
- Données : enregistrées sur l’appareil, synchronisées avec Supabase derrière une connexion. Ce dépôt ne contient aucune donnée personnelle : le plan et le journal vivent uniquement dans la base, protégés par des règles de sécurité par ligne (RLS), et les inscriptions sont fermées.
- Déploiement : GitHub Pages, à chaque push sur `main`.

```bash
npm install
npm run dev
```
