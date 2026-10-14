-- Alipto · étape 5 : notification de fin de repos quand l'appli est en arrière-plan.
-- Quand tu quittes l'appli pendant un repos (30 s ou plus), elle demande à la fonction « minuteur »
-- de t'envoyer une notification à la fin du repos. En revenant dans l'appli, la demande est annulée.
-- Script idempotent : on peut le relancer sans risque.

create table if not exists public.rest_timers (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  fire_at timestamptz not null,
  msg jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists rest_timers_user on public.rest_timers (user_id);
alter table public.rest_timers enable row level security;

-- Chacun voit et annule ses propres minuteurs ; la création passe par la fonction (clé service)
drop policy if exists "ses minuteurs" on public.rest_timers;
create policy "ses minuteurs" on public.rest_timers for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "annuler ses minuteurs" on public.rest_timers;
create policy "annuler ses minuteurs" on public.rest_timers for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on table public.rest_timers from anon, authenticated;
grant select, delete on table public.rest_timers to authenticated;
grant all on table public.rest_timers to service_role;

notify pgrst, 'reload schema';

-- Vérification : doit afficher la table et ses deux règles d'accès
select tablename, policyname from pg_policies where tablename = 'rest_timers';
