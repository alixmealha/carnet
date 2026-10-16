# Connecter Whoop à Alipto (pas à pas)

Whoop n'est actif que lorsque trois choses existent : une appli Whoop (identifiant + secret), la fonction `whoop` et les tables `whoop_*`.
Rien n'est envoyé à Whoop tant que tu n'as pas touché au bouton « Connecter Whoop » dans Paramètres.

## 1. Créer l'appli chez Whoop (5 minutes, en anglais)

1. Va sur **developer-dashboard.whoop.com** et connecte-toi avec ton compte WHOOP.
2. Au premier passage : **Get Started** → donne un nom à l'équipe (« Alipto ») → **Create Team**.
3. **Create App** :
   - **App name** : Alipto
   - **Redirect URLs** : colle exactement `https://remthpcuidagjaxxkohc.supabase.co/functions/v1/whoop`
   - **Scopes** : coche `read:recovery`, `read:sleep`, `read:workout` (rien d'autre ; `offline` est demandé par l'appli pour garder la connexion)
   - Clique **Create**.
4. Note le **Client ID** et le **Client Secret** (visibles dans Apps). Le secret ne se donne à personne, ni dans une conversation, ni dans le code.

Limite chez Whoop : 10 personnes connectées en tout tant que l'appli n'est pas approuvée (Open Request → Request higher limits).

## 2. Côté Supabase

1. **SQL Editor** : lance `supabase/07-whoop.sql` (tables des jetons, fermées à l'appli).
2. **Edge Functions** : crée une fonction nommée exactement **whoop**, colle `supabase/functions/whoop/index.ts`, **désactive « Verify JWT »**, déploie.
3. **Edge Functions → Secrets** : ajoute `WHOOP_CLIENT_ID` et `WHOOP_CLIENT_SECRET`.

## 3. Dans l'appli

Paramètres → **Connexions** (web) ou Paramètres → **Whoop** (iPhone) → **Connecter Whoop** → autoriser chez Whoop.
Les 14 derniers jours arrivent tout de suite, puis les 3 derniers jours à chaque ouverture.

## Règles de fusion

- Ce que tu as noté à la main n'est jamais écrasé : seules les cases vides sont remplies.
- Pour la nuit, Whoop passe avant Apple Santé (la source est gardée dans `nuit.src`). La VFC de Whoop (RMSSD) et celle d'Apple (SDNN) ne se comparent pas : une nuit vient d'une seule source.
- Séances : durée, distance et FC moyenne dans « Après la séance », si ces cases sont vides.
