-- Orbit — reminders backend setup
-- Run this in the Supabase SQL editor once. Replace the two placeholders at the
-- bottom (project URL + service-role key) before running the cron section.

-- 1) extensions ------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) push subscriptions (one row per device) -------------------------------
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references auth.users on delete cascade,
  p256dh     text not null,
  auth       text not null,
  tz         text,
  updated_at timestamptz default now()
);
alter table public.push_subscriptions enable row level security;
create policy "own subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) dedupe log (only the Edge Function, via service role, touches this) ----
create table if not exists public.reminders_sent (
  user_id uuid not null,
  key     text not null,
  sent_at timestamptz default now(),
  primary key (user_id, key)
);
alter table public.reminders_sent enable row level security;  -- no policy: service role only

-- 4) schedule the sender every minute --------------------------------------
--    >>> replace YOUR-PROJECT and YOUR-SERVICE-ROLE-KEY <<<
select cron.schedule(
  'orbit-send-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://YOUR-PROJECT.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR-SERVICE-ROLE-KEY'
    )
  );
  $$
);

-- 5) tidy old dedupe rows once a day ---------------------------------------
select cron.schedule(
  'orbit-reminders-cleanup',
  '17 3 * * *',
  $$ delete from public.reminders_sent where sent_at < now() - interval '40 days'; $$
);

-- To remove later:  select cron.unschedule('orbit-send-reminders');
