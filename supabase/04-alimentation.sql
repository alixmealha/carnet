-- Alipto · étape 4 : alimentation privée par défaut.
-- Le coach lit le carnet de ses athlètes, sauf les repas (documents « n:AAAA-MM-JJ ») et les réglages
-- d'alimentation (« nutri ») : il ne les voit que si l'athlète a coché « Partager avec mon coach »
-- (Paramètres → Alimentation). Script idempotent : on peut le relancer sans risque.

-- Partage activé dans le profil de l'athlète ? (lecture sans passer par les règles d'accès, pour éviter une boucle)
create or replace function public.nutri_shared(a uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select (d.data -> 'nutri' ->> 'share')::boolean
    from public.docs d
    where d.user_id = a and d.id = 'profile' and not coalesce(d.deleted, false)
  ), false)
$$;
revoke all on function public.nutri_shared(uuid) from public;
grant execute on function public.nutri_shared(uuid) to authenticated;

-- Lecture par le coach : tout le carnet, sauf l'alimentation non partagée
drop policy if exists "coach select" on public.docs;
create policy "coach select" on public.docs for select to authenticated
  using (public.is_coach_of(user_id) and (not (id like 'n:%' or id = 'nutri') or public.nutri_shared(user_id)));

notify pgrst, 'reload schema';

-- Vérification : doit afficher une ligne « coach select » avec la condition sur l'alimentation
select policyname, qual from pg_policies where tablename = 'docs' and policyname = 'coach select';
