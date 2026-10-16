-- Alipto · étape 7 : connexion Whoop (récupération, sommeil, séances).
-- Deux tables que SEULE la fonction « whoop » peut lire (clé service) : l'appli, elle, n'y a aucun accès.
--   · whoop_tokens : les jetons Whoop de chaque personne qui a connecté son bracelet ;
--   · whoop_states : le code à usage unique qui relie le retour de Whoop à la bonne personne (15 minutes).
-- Script idempotent : on peut le relancer sans risque.

create table if not exists public.whoop_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  connected_at timestamptz not null default now(),
  last_sync timestamptz
);
create table if not exists public.whoop_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ret text not null default 'web',
  created_at timestamptz not null default now()
);

alter table public.whoop_tokens enable row level security;
alter table public.whoop_states enable row level security;
revoke all on table public.whoop_tokens from anon, authenticated;
revoke all on table public.whoop_states from anon, authenticated;
grant all on table public.whoop_tokens to service_role;
grant all on table public.whoop_states to service_role;

notify pgrst, 'reload schema';

-- Vérification : doit afficher les deux tables, avec 0 ligne
select 'whoop_tokens' as table_name, count(*) from public.whoop_tokens
union all select 'whoop_states', count(*) from public.whoop_states;
