-- Carnet · étape 2 : coach, athlètes et notifications.
-- À coller dans SQL Editor → New query → Run (une seule fois).
-- Remplacer __ANON_KEY__ et __NOTIFY_SECRET__ avant de lancer (déjà fait dans la version envoyée dans la conversation).

-- 1. Liens coach → athlète. Ils se créent uniquement ici, dans le SQL Editor.
create table if not exists public.coach_links (
  coach_id uuid not null references auth.users(id) on delete cascade,
  athlete_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (coach_id, athlete_id),
  check (coach_id <> athlete_id)
);
alter table public.coach_links enable row level security;
drop policy if exists "voir ses liens" on public.coach_links;
create policy "voir ses liens" on public.coach_links for select to authenticated
  using ((select auth.uid()) = coach_id or (select auth.uid()) = athlete_id);
revoke all on table public.coach_links from anon, authenticated;
grant select on table public.coach_links to authenticated;

create or replace function public.is_coach_of(a uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coach_links where coach_id = (select auth.uid()) and athlete_id = a);
$$;
revoke all on function public.is_coach_of(uuid) from public, anon;
grant execute on function public.is_coach_of(uuid) to authenticated;

-- 2. Le coach lit et modifie les carnets de ses athlètes (jamais ceux des autres).
drop policy if exists "coach select" on public.docs;
drop policy if exists "coach insert" on public.docs;
drop policy if exists "coach update" on public.docs;
create policy "coach select" on public.docs for select to authenticated using (public.is_coach_of(user_id));
create policy "coach insert" on public.docs for insert to authenticated with check (public.is_coach_of(user_id));
create policy "coach update" on public.docs for update to authenticated using (public.is_coach_of(user_id)) with check (public.is_coach_of(user_id));

-- 3. Abonnements aux notifications (un par appareil).
create table if not exists public.push_subs (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sub jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
drop policy if exists "ses abonnements" on public.push_subs;
create policy "ses abonnements" on public.push_subs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on table public.push_subs from anon, authenticated;
grant select, insert, update, delete on table public.push_subs to authenticated;

-- 4. Déclencheur : séance validée par un athlète, ou nouveau message sur une séance.
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  kind text;
  d date;
begin
  if new.deleted then return new; end if;
  begin d := substr(new.id, 3)::date; exception when others then return new; end;
  if new.id like 'j:%' then
    -- seulement les jours récents : un import de vieux journal ne doit pas sonner
    if d < current_date - 2 or d > current_date + 1 then return new; end if;
    if coalesce(new.data->>'status', '') <> '' and (
         tg_op = 'INSERT'
         or (old.data->>'status') is distinct from (new.data->>'status')
         or ((new.data->>'endedAt') is not null and (old.data->>'endedAt') is distinct from (new.data->>'endedAt'))
       ) then
      kind := 'session';
    end if;
    if kind is not null and not exists (select 1 from public.coach_links where athlete_id = new.user_id) then return new; end if;
  elsif new.id like 'c:%' then
    if jsonb_array_length(coalesce(new.data->'msgs', '[]'::jsonb)) > 0
       and (tg_op = 'INSERT' or jsonb_array_length(coalesce(old.data->'msgs', '[]'::jsonb)) < jsonb_array_length(new.data->'msgs')) then
      kind := 'comment';
    end if;
  end if;
  if kind is null then return new; end if;
  perform net.http_post(
    url := 'https://remthpcuidagjaxxkohc.supabase.co/functions/v1/notify',
    body := jsonb_build_object('kind', kind, 'user_id', new.user_id, 'id', new.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer __ANON_KEY__',
      'x-notify-secret', '__NOTIFY_SECRET__'
    )
  );
  return new;
end $$;
revoke all on function public.notify_change() from public, anon, authenticated;

drop trigger if exists docs_notify on public.docs;
create trigger docs_notify after insert or update on public.docs
  for each row execute function public.notify_change();
