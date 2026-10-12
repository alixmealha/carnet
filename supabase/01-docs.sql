-- Carnet · étape 1 : la table des données (déjà faite si l'appli marche).
create table public.docs (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null,
  synced_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);
alter table public.docs enable row level security;
create policy "own select" on public.docs for select to authenticated using ((select auth.uid()) = user_id);
create policy "own insert" on public.docs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own update" on public.docs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own delete" on public.docs for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on table public.docs from anon;
grant select, insert, update, delete on table public.docs to authenticated;
create or replace function public.touch_synced_at() returns trigger language plpgsql set search_path = '' as $$ begin new.synced_at = now(); return new; end $$;
create trigger docs_touch before insert or update on public.docs for each row execute function public.touch_synced_at();
create index docs_user_synced on public.docs (user_id, synced_at);
