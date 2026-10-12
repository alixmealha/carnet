-- Carnet · étape 2 (version complète) : profils et rôles, coach ↔ athlètes par code, verrou du plan,
-- administration, notifications. À coller dans SQL Editor → New query → Run. Peut être relancé sans risque.
-- Avant de lancer : remplacer __ADMIN_EMAIL__, __ANON_KEY__ et __NOTIFY_SECRET__ (déjà fait dans la version envoyée en privé).

/* ---------- 1. Profils ---------- */
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  role text not null default 'athlete' check (role in ('athlete', 'coach', 'admin')),
  sex text check (sex in ('F', 'M', 'X')),
  birth_year int check (birth_year between 1900 and 2100),
  height_cm numeric check (height_cm between 50 and 260),
  weight_kg numeric check (weight_kg between 20 and 300),
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

/* ---------- 2. Liens coach → athlète ---------- */
create table if not exists public.coach_links (
  coach_id uuid not null references auth.users(id) on delete cascade,
  athlete_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (coach_id, athlete_id),
  check (coach_id <> athlete_id)
);
alter table public.coach_links add column if not exists plan_locked boolean not null default false;
alter table public.coach_links enable row level security;

/* ---------- 3. Fonctions de contrôle (exécutées avec les droits du propriétaire) ---------- */
create or replace function public.my_role() returns text language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid());
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;
create or replace function public.is_coach_of(a uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coach_links where coach_id = (select auth.uid()) and athlete_id = a);
$$;
create or replace function public.is_my_coach(c uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coach_links where coach_id = c and athlete_id = (select auth.uid()));
$$;
create or replace function public.plan_locked(a uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coach_links where athlete_id = a and plan_locked);
$$;
revoke all on function public.my_role(), public.is_admin(), public.is_coach_of(uuid), public.is_my_coach(uuid), public.plan_locked(uuid) from public, anon;
grant execute on function public.my_role(), public.is_admin(), public.is_coach_of(uuid), public.is_my_coach(uuid), public.plan_locked(uuid) to authenticated;

/* ---------- 4. Règles des profils : le rôle ne se choisit qu'une fois, seul l'admin le change ---------- */
drop policy if exists "profil lecture" on public.profiles;
drop policy if exists "profil creation" on public.profiles;
drop policy if exists "profil modification" on public.profiles;
create policy "profil lecture" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin() or public.is_coach_of(id) or public.is_my_coach(id));
create policy "profil creation" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()) and role in ('athlete', 'coach'));
create policy "profil modification" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke all on table public.profiles from anon, authenticated;
grant select, insert on table public.profiles to authenticated;
grant update (name, sex, birth_year, height_cm, weight_kg, onboarded, updated_at) on table public.profiles to authenticated;
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

/* ---------- 5. Règles des liens ---------- */
drop policy if exists "voir ses liens" on public.coach_links;
drop policy if exists "retirer un lien" on public.coach_links;
drop policy if exists "verrou du plan" on public.coach_links;
create policy "voir ses liens" on public.coach_links for select to authenticated
  using ((select auth.uid()) = coach_id or (select auth.uid()) = athlete_id);
create policy "retirer un lien" on public.coach_links for delete to authenticated
  using ((select auth.uid()) = coach_id or (select auth.uid()) = athlete_id);
create policy "verrou du plan" on public.coach_links for update to authenticated
  using ((select auth.uid()) = coach_id) with check ((select auth.uid()) = coach_id);
revoke all on table public.coach_links from anon, authenticated;
grant select, delete on table public.coach_links to authenticated;
grant update (plan_locked) on table public.coach_links to authenticated;

/* ---------- 6. Carnets : chacun le sien ; le coach lit ceux de ses athlètes et n'écrit que le plan, les séances,
   les échanges et les tests (le journal reste à l'athlète : le coach peut seulement importer un historique) ;
   l'athlète ne touche plus à son plan quand son coach l'a verrouillé ---------- */
drop policy if exists "own insert" on public.docs;
drop policy if exists "own update" on public.docs;
drop policy if exists "own delete" on public.docs;
create policy "own insert" on public.docs for insert to authenticated
  with check ((select auth.uid()) = user_id and (not (id = 'plan' or id like 'p:%') or not public.plan_locked(user_id)));
create policy "own update" on public.docs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (not (id = 'plan' or id like 'p:%') or not public.plan_locked(user_id)));
create policy "own delete" on public.docs for delete to authenticated
  using ((select auth.uid()) = user_id and (not (id = 'plan' or id like 'p:%') or not public.plan_locked(user_id)));
drop policy if exists "coach select" on public.docs;
drop policy if exists "coach insert" on public.docs;
drop policy if exists "coach update" on public.docs;
create policy "coach select" on public.docs for select to authenticated using (public.is_coach_of(user_id));
create policy "coach insert" on public.docs for insert to authenticated
  with check (public.is_coach_of(user_id) and (id in ('plan', 'tests') or id like 'p:%' or id like 'c:%' or id like 't:%' or id like 'j:%'));
create policy "coach update" on public.docs for update to authenticated
  using (public.is_coach_of(user_id) and (id in ('plan', 'tests') or id like 'p:%' or id like 'c:%' or id like 't:%'))
  with check (public.is_coach_of(user_id) and (id in ('plan', 'tests') or id like 'p:%' or id like 'c:%' or id like 't:%'));

/* ---------- 7. Codes de partage athlète → coach ---------- */
create table if not exists public.invite_codes (
  code text primary key,
  athlete_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
alter table public.invite_codes enable row level security;
drop policy if exists "mes codes" on public.invite_codes;
drop policy if exists "creer un code" on public.invite_codes;
drop policy if exists "supprimer un code" on public.invite_codes;
create policy "mes codes" on public.invite_codes for select to authenticated using (athlete_id = (select auth.uid()));
create policy "creer un code" on public.invite_codes for insert to authenticated
  with check (athlete_id = (select auth.uid()) and public.my_role() in ('athlete', 'admin') and length(code) >= 8);
create policy "supprimer un code" on public.invite_codes for delete to authenticated using (athlete_id = (select auth.uid()));
revoke all on table public.invite_codes from anon, authenticated;
grant select, insert, delete on table public.invite_codes to authenticated;

create or replace function public.redeem_code(c text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record; me uuid := auth.uid();
begin
  if coalesce(public.my_role(), '') not in ('coach', 'admin') then raise exception 'Seul un compte coach peut ajouter un athlète.'; end if;
  select * into r from public.invite_codes where code = regexp_replace(upper(coalesce(c, '')), '[^A-Z0-9]', '', 'g') and expires_at > now();
  if not found then raise exception 'Code invalide ou expiré.'; end if;
  if r.athlete_id = me then raise exception 'C’est ton propre code.'; end if;
  insert into public.coach_links (coach_id, athlete_id) values (me, r.athlete_id) on conflict do nothing;
  delete from public.invite_codes where code = r.code;
  return jsonb_build_object('athlete_id', r.athlete_id);
end $$;
revoke all on function public.redeem_code(text) from public, anon;
grant execute on function public.redeem_code(text) to authenticated;

/* ---------- 8. Administration (compte administrateur seulement) ---------- */
create or replace function public.admin_users() returns table (id uuid, email text, name text, role text, onboarded boolean, created_at timestamptz, last_sign_in_at timestamptz, athletes int, coaches int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l’administrateur.'; end if;
  return query select u.id, u.email::text, coalesce(p.name, ''), coalesce(p.role, 'athlete'), coalesce(p.onboarded, false), u.created_at, u.last_sign_in_at,
    (select count(*)::int from public.coach_links l where l.coach_id = u.id), (select count(*)::int from public.coach_links l where l.athlete_id = u.id)
  from auth.users u left join public.profiles p on p.id = u.id order by u.created_at;
end $$;
create or replace function public.admin_set_role(uid uuid, r text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l’administrateur.'; end if;
  if r not in ('athlete', 'coach', 'admin') then raise exception 'Rôle inconnu.'; end if;
  if uid = auth.uid() and r <> 'admin' then raise exception 'Tu ne peux pas retirer ton propre rôle d’administrateur.'; end if;
  insert into public.profiles (id, role) values (uid, r) on conflict (id) do update set role = excluded.role;
  -- soit coach, soit athlète : on retire les liens qui ne correspondent plus au rôle
  if r = 'athlete' then delete from public.coach_links where coach_id = uid; end if;
  if r = 'coach' then delete from public.coach_links where athlete_id = uid; delete from public.invite_codes where athlete_id = uid; end if;
end $$;
create or replace function public.admin_link(coach uuid, athlete uuid, linked boolean) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l’administrateur.'; end if;
  if linked then insert into public.coach_links (coach_id, athlete_id) values (coach, athlete) on conflict do nothing;
  else delete from public.coach_links where coach_id = coach and athlete_id = athlete; end if;
end $$;
revoke all on function public.admin_users(), public.admin_set_role(uuid, text), public.admin_link(uuid, uuid, boolean) from public, anon;
grant execute on function public.admin_users(), public.admin_set_role(uuid, text), public.admin_link(uuid, uuid, boolean) to authenticated;

-- Ton compte devient administrateur
insert into public.profiles (id, role)
select id, 'admin' from auth.users where email = '__ADMIN_EMAIL__'
on conflict (id) do update set role = 'admin';

/* ---------- 9. Abonnements aux notifications ---------- */
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

/* ---------- 10. Déclencheur des notifications ---------- */
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

-- Recharger le schéma de l'API
notify pgrst, 'reload schema';
