-- Alipto · étape 6 : rappel du matin et bilan de la semaine (notifications planifiées).
-- La base appelle la fonction « rappels » toutes les 15 minutes (pg_cron + pg_net). La fonction envoie :
--   · le rappel de la forme du matin, à l'heure choisie dans Paramètres → Notifications, si elle n'est pas remplie ;
--   · le dimanche à 19 h, le bilan de la semaine (à l'athlète, et au coach pour ses athlètes).
-- Avant : déployer la fonction « rappels » avec « Verify JWT » désactivé.
-- Remplacer __NOTIFY_SECRET__ par le secret NOTIFY_SECRET (le même que pour « notify »).
-- Script idempotent : on peut le relancer sans risque.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Chaque rappel n'est envoyé qu'une fois (utilisateur, type, jour)
create table if not exists public.reminders_sent (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  day date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, day)
);
alter table public.reminders_sent enable row level security;
revoke all on table public.reminders_sent from anon, authenticated;
grant all on table public.reminders_sent to service_role;

-- Ménage : on ne garde que 60 jours de traces
create or replace function public.reminders_cleanup() returns void language sql security definer set search_path = '' as $$
  delete from public.reminders_sent where day < current_date - 60;
$$;
revoke all on function public.reminders_cleanup() from public, anon, authenticated;

-- Appel toutes les 15 minutes
do $$ begin perform cron.unschedule('alipto-rappels'); exception when others then null; end $$;
select cron.schedule('alipto-rappels', '*/15 * * * *', $job$
  select net.http_post(
    url := 'https://remthpcuidagjaxxkohc.supabase.co/functions/v1/rappels',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', '__NOTIFY_SECRET__')
  );
$job$);
do $$ begin perform cron.unschedule('alipto-rappels-menage'); exception when others then null; end $$;
select cron.schedule('alipto-rappels-menage', '17 3 * * *', $job$ select public.reminders_cleanup(); $job$);

notify pgrst, 'reload schema';

-- Vérification : doit afficher les deux tâches planifiées
select jobname, schedule, active from cron.job where jobname like 'alipto-rappels%';
