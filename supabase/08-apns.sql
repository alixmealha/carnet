-- Alipto · étape 8 : notifications de l'appli iPhone (APNs) pour les échanges coach ↔ athlète.
-- Une ligne par iPhone : l'appli y enregistre son « jeton d'appareil » (fonction register_apns, qui ne laisse
-- enregistrer que pour le compte connecté). Seule la fonction « notify » (clé service) lit cette table.
-- Script idempotent : on peut le relancer sans risque.

create table if not exists public.apns_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  environment text not null default 'production' check (environment in ('sandbox', 'production')),
  updated_at timestamptz not null default now()
);
create index if not exists apns_tokens_user on public.apns_tokens (user_id);
alter table public.apns_tokens enable row level security;
revoke all on table public.apns_tokens from anon, authenticated;
grant all on table public.apns_tokens to service_role;

-- Enregistrer (ou reprendre, si quelqu'un d'autre se connecte sur le même iPhone) le jeton de l'appareil
create or replace function public.register_apns(tok text, environment text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  if tok !~ '^[0-9a-f]{32,200}$' then raise exception 'jeton invalide'; end if;
  insert into public.apns_tokens (token, user_id, environment, updated_at)
  values (tok, auth.uid(), case when environment = 'sandbox' then 'sandbox' else 'production' end, now())
  on conflict (token) do update set user_id = auth.uid(), environment = excluded.environment, updated_at = now();
end $$;

-- À la déconnexion : cet iPhone ne reçoit plus les notifications de ce compte
create or replace function public.unregister_apns(tok text) returns void
language sql security definer set search_path = '' as $$
  delete from public.apns_tokens where token = tok and user_id = auth.uid();
$$;

revoke all on function public.register_apns(text, text) from public, anon;
revoke all on function public.unregister_apns(text) from public, anon;
grant execute on function public.register_apns(text, text) to authenticated;
grant execute on function public.unregister_apns(text) to authenticated;

notify pgrst, 'reload schema';

-- Vérification : la table existe, avec 0 ligne tant qu'aucun iPhone ne s'est enregistré
select count(*) as iphones_enregistres from public.apns_tokens;
