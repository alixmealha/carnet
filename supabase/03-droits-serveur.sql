-- Alipto · correctif : droits du serveur sur les tables (fonctions admin et notify).
-- À lancer une fois dans SQL Editor → New query → Run. Sans risque, relançable.
grant usage on schema public to service_role;
grant all on table public.docs, public.profiles, public.coach_links, public.invite_codes, public.push_subs to service_role;
notify pgrst, 'reload schema';
-- Vérification : doit afficher 5 lignes « true »
select t as "table", has_table_privilege('service_role', 'public.' || t, 'SELECT') as "lecture serveur"
from unnest(array['docs', 'profiles', 'coach_links', 'invite_codes', 'push_subs']) as t;
