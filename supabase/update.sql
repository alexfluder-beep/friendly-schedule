-- Friendly Schedule: ONE update with everything added since the first setup (versions 2.4 to 3.10).
-- Safe to run more than once. Paste all of it into Supabase > SQL Editor and press Run.

-- 2.4 Telegram username; 2.5 badges already celebrated (so the welcome badge shows once per account)
alter table public.profiles add column if not exists telegram text;
alter table public.profiles add column if not exists badges_seen text[];
alter table public.profiles add column if not exists display jsonb;   -- 3.3 text size, colours, contrast per person
alter table public.invites add column if not exists telegram text;

-- 2.6 bookings: guest email, language, currency, history, when it was made
alter table public.bookings add column if not exists email text;
alter table public.bookings add column if not exists lang text;
alter table public.bookings add column if not exists currency text;
alter table public.bookings add column if not exists price numeric;
alter table public.bookings add column if not exists history jsonb not null default '[]';
alter table public.bookings add column if not exists created_at timestamptz not null default now();

-- 2.5 problem log
create table if not exists public.app_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  at timestamptz not null default now(), kind text, message text, detail text, page text, version text, device text
);
alter table public.app_errors enable row level security;
drop policy if exists app_errors_add on public.app_errors;
drop policy if exists app_errors_admin_read on public.app_errors;
drop policy if exists app_errors_admin_clear on public.app_errors;
create policy app_errors_add on public.app_errors for insert to authenticated with check (user_id = auth.uid());
create policy app_errors_admin_read on public.app_errors for select to authenticated using (public.is_admin());
create policy app_errors_admin_clear on public.app_errors for delete to authenticated using (public.is_admin());

-- New people keep the Telegram username from the invitation.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv public.invites%rowtype;
begin
  select * into inv from public.invites where lower(email) = lower(new.email) limit 1;
  if found then
    insert into public.profiles (id, name, role, phone, languages, telegram, color, vehicle, work_week, work_days, work_from, work_to, skills, email, active)
    values (new.id, coalesce(nullif(inv.name, ''), new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), inv.role, inv.phone, inv.languages, inv.telegram, coalesce(inv.color, '#66737f'), inv.vehicle, inv.work_week, inv.work_days, inv.work_from, inv.work_to, inv.skills, new.email, true)
    on conflict (id) do nothing;
    delete from public.invites where id = inv.id;
  else
    insert into public.profiles (id, name, email) values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), new.email)
    on conflict (id) do nothing;
  end if;
  return new;
end $$;

-- Removing a guest's data also clears email and pick-up address.
create or replace function public.erase_guests(ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Only an admin can remove guest data'; end if;
  update public.bookings set guest = 'Guest', phone = null, email = null, notes = null, ref = null, pickup_addr = null, pickup_url = null where client_id = any(ids);
  update public.client_ratings set note = null where client_id = any(ids);
  update public.clients set name = 'Guest', phone = null, email = null, notes = null, anonymised_at = now() where id = any(ids) and anonymised_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- 2.6 Admin joins duplicate guests.
create or replace function public.merge_clients(target uuid, others uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only an admin can merge guests'; end if;
  update public.bookings set client_id = target where client_id = any(others);
  update public.client_ratings set client_id = target where client_id = any(others);
  delete from public.clients where id = any(others) and id <> target;
end $$;
revoke all on function public.merge_clients(uuid, uuid[]) from public;
grant execute on function public.merge_clients(uuid, uuid[]) to authenticated;

-- 3.4 Faster reads. Each access rule now runs once per request instead of once for every row,
-- so long guest lists no longer stop with "statement timeout".
create or replace function public.my_tour_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.tours
  where public.app_role() is not null and (guide_id = auth.uid() or driver_id = auth.uid())
    and coalesce(date_to, date) >= current_date - public.guest_days()
$$;
create or replace function public.my_client_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct b.client_id from public.bookings b
  where b.client_id is not null and b.tour_id in (select public.my_tour_ids())
$$;
grant execute on function public.my_tour_ids() to authenticated;
grant execute on function public.my_client_ids() to authenticated;
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (id = (select auth.uid()) or (select public.app_role()) is not null);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists profiles_admin on public.profiles;
create policy profiles_admin on public.profiles for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists tours_read on public.tours;
create policy tours_read on public.tours for select to authenticated using ((select public.app_role()) is not null);
drop policy if exists tours_admin on public.tours;
create policy tours_admin on public.tours for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists bookings_read on public.bookings;
create policy bookings_read on public.bookings for select to authenticated using ((select public.is_admin()) or tour_id in (select public.my_tour_ids()));
drop policy if exists bookings_attendance on public.bookings;
create policy bookings_attendance on public.bookings for update to authenticated using (public.on_tour(tour_id)) with check (public.on_tour(tour_id));
drop policy if exists bookings_admin on public.bookings;
create policy bookings_admin on public.bookings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists clients_read on public.clients;
create policy clients_read on public.clients for select to authenticated using ((select public.is_admin()) or id in (select public.my_client_ids()));
drop policy if exists clients_admin on public.clients;
create policy clients_admin on public.clients for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists ratings_read on public.client_ratings;
create policy ratings_read on public.client_ratings for select to authenticated using ((select public.is_admin()) or client_id in (select public.my_client_ids()));
drop policy if exists ratings_delete_own on public.client_ratings;
create policy ratings_delete_own on public.client_ratings for delete to authenticated using (user_id = (select auth.uid()) and rating in ('like','dislike'));
drop policy if exists ratings_insert on public.client_ratings;
create policy ratings_insert on public.client_ratings for insert to authenticated with check (user_id = (select auth.uid()) and client_id in (select public.my_client_ids()));
drop policy if exists ratings_admin on public.client_ratings;
create policy ratings_admin on public.client_ratings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists scores_read on public.tour_ratings;
create policy scores_read on public.tour_ratings for select to authenticated using ((select public.is_admin()) or user_id = (select auth.uid()));
drop policy if exists scores_insert on public.tour_ratings;
create policy scores_insert on public.tour_ratings for insert to authenticated with check (user_id = (select auth.uid()) and public.on_tour(tour_id));
drop policy if exists scores_update on public.tour_ratings;
create policy scores_update on public.tour_ratings for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists scores_admin on public.tour_ratings;
create policy scores_admin on public.tour_ratings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists app_errors_add on public.app_errors;
create policy app_errors_add on public.app_errors for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists app_errors_admin_read on public.app_errors;
create policy app_errors_admin_read on public.app_errors for select to authenticated using ((select public.is_admin()));
drop policy if exists app_errors_admin_clear on public.app_errors;
create policy app_errors_admin_clear on public.app_errors for delete to authenticated using ((select public.is_admin()));
drop policy if exists payout_own on public.payout_details;
create policy payout_own on public.payout_details for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists payout_admin on public.payout_details;
create policy payout_admin on public.payout_details for select to authenticated using ((select public.is_admin()));
drop policy if exists log_insert on public.log;
create policy log_insert on public.log for insert to authenticated with check ((select public.app_role()) is not null and user_id = (select auth.uid()));
drop policy if exists log_read on public.log;
create policy log_read on public.log for select to authenticated using ((select public.is_admin()));
drop policy if exists creq_read on public.change_requests;
create policy creq_read on public.change_requests for select to authenticated using ((select public.is_admin()) or user_id = (select auth.uid()) or swap_with = (select auth.uid()));
drop policy if exists creq_answer on public.change_requests;
create policy creq_answer on public.change_requests for update to authenticated using (swap_with = (select auth.uid()) and status = 'pending') with check (swap_with = (select auth.uid()));
drop policy if exists creq_insert on public.change_requests;
create policy creq_insert on public.change_requests for insert to authenticated with check (user_id = (select auth.uid()) and status = 'pending' and public.on_tour(tour_id));
drop policy if exists creq_admin on public.change_requests;
create policy creq_admin on public.change_requests for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists adj_read on public.pay_adjustments;
create policy adj_read on public.pay_adjustments for select to authenticated using ((select public.is_admin()) or user_id = (select auth.uid()));
drop policy if exists adj_admin on public.pay_adjustments;
create policy adj_admin on public.pay_adjustments for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists disputes_read on public.pay_disputes;
create policy disputes_read on public.pay_disputes for select to authenticated using ((select public.is_admin()) or user_id = (select auth.uid()));
drop policy if exists disputes_insert on public.pay_disputes;
create policy disputes_insert on public.pay_disputes for insert to authenticated with check (user_id = (select auth.uid()) and status = 'open' and reply is null and public.on_tour(tour_id));
drop policy if exists disputes_admin on public.pay_disputes;
create policy disputes_admin on public.pay_disputes for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists costs_admin on public.tour_costs;
create policy costs_admin on public.tour_costs for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists pdates_own on public.personal_dates;
create policy pdates_own on public.personal_dates for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists pdates_admin on public.personal_dates;
create policy pdates_admin on public.personal_dates for select to authenticated using ((select public.is_admin()));
drop policy if exists usage_insert on public.usage;
create policy usage_insert on public.usage for insert to authenticated with check (user_id = (select auth.uid()) and (select public.app_role()) is not null);
drop policy if exists usage_read on public.usage;
create policy usage_read on public.usage for select to authenticated using ((select public.is_admin()));
drop policy if exists offers_insert on public.offers;
create policy offers_insert on public.offers for insert to authenticated with check (user_id = (select auth.uid()) and (select public.app_role()) is not null);
drop policy if exists offers_read on public.offers;
create policy offers_read on public.offers for select to authenticated using ((select public.is_admin()) or user_id = (select auth.uid()));
drop policy if exists off_read on public.time_off;
create policy off_read on public.time_off for select to authenticated using ((select public.app_role()) is not null);
drop policy if exists off_insert_own on public.time_off;
create policy off_insert_own on public.time_off for insert to authenticated
  with check ((select public.app_role()) is not null and user_id = (select auth.uid()) and (status = 'pending' or type = 'sick'));
drop policy if exists off_delete_own on public.time_off;
create policy off_delete_own on public.time_off for delete to authenticated using (user_id = (select auth.uid()) and status = 'pending');
drop policy if exists off_admin on public.time_off;
create policy off_admin on public.time_off for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists holidays_read on public.holidays;
create policy holidays_read on public.holidays for select to authenticated using ((select public.app_role()) is not null);
drop policy if exists holidays_admin on public.holidays;
create policy holidays_admin on public.holidays for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks for select to authenticated using ((select public.is_admin()) or (select auth.uid()) = any(assignees));
drop policy if exists tasks_update_mine on public.tasks;
create policy tasks_update_mine on public.tasks for update to authenticated using ((select auth.uid()) = any(assignees)) with check ((select auth.uid()) = any(assignees));
drop policy if exists tasks_week_own on public.tasks;
create policy tasks_week_own on public.tasks for insert to authenticated
  with check ((select public.app_role()) is not null and kind = 'week_check' and created_by = (select auth.uid()) and assignees = array[(select auth.uid())] and tour_id is null and status = 'open');
drop policy if exists tasks_admin on public.tasks;
create policy tasks_admin on public.tasks for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists notes_read on public.notifications;
create policy notes_read on public.notifications for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists notes_insert on public.notifications;
create policy notes_insert on public.notifications for insert to authenticated with check ((select public.app_role()) is not null);
drop policy if exists notes_update on public.notifications;
create policy notes_update on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists notes_delete on public.notifications;
create policy notes_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select to authenticated using ((select public.app_role()) is not null);
drop policy if exists settings_admin on public.settings;
create policy settings_admin on public.settings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists invites_admin on public.invites;
create policy invites_admin on public.invites for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 3.8 Tour exchange: anyone in the team may offer to take a tour that still needs a guide or a driver,
-- and may take back their own request while it waits (pressed by mistake). The admin approves as before.
drop policy if exists creq_take on public.change_requests;
create policy creq_take on public.change_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and (select public.app_role()) is not null
    and exists (select 1 from public.tours t where t.id = tour_id and (t.guide_id is null or t.driver_id is null)));
drop policy if exists creq_withdraw on public.change_requests;
create policy creq_withdraw on public.change_requests for delete to authenticated using (user_id = (select auth.uid()) and status = 'pending');

-- 3.8 Personal expenses of guides and drivers (meal, fuel, car service, accommodation...). Each person sees their own; the admin sees all and marks what was paid back.
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tour_id uuid references public.tours(id) on delete set null,
  date date not null default current_date,
  kind text not null default 'other',
  amount numeric not null default 0,
  currency text not null default 'GEL',
  note text,
  paid_back boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists expenses_user_idx on public.expenses(user_id, date);
alter table public.expenses enable row level security;
drop policy if exists exp_read on public.expenses;
drop policy if exists exp_add on public.expenses;
drop policy if exists exp_edit on public.expenses;
drop policy if exists exp_remove on public.expenses;
drop policy if exists exp_admin on public.expenses;
create policy exp_read on public.expenses for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy exp_add on public.expenses for insert to authenticated with check (user_id = (select auth.uid()) and not paid_back and (select public.app_role()) is not null);
create policy exp_edit on public.expenses for update to authenticated using (user_id = (select auth.uid()) and not paid_back) with check (user_id = (select auth.uid()) and not paid_back);
create policy exp_remove on public.expenses for delete to authenticated using (user_id = (select auth.uid()) and not paid_back);
create policy exp_admin on public.expenses for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant select, insert, update, delete on public.expenses to authenticated;
do $$ begin alter publication supabase_realtime add table public.expenses; exception when duplicate_object then null; when undefined_object then null; end $$;

-- 3.9 Indexes on the columns the access rules and links use (Supabase Postgres best practices: RLS columns and foreign keys).
create index if not exists client_ratings_user_id_fk_idx on public.client_ratings(user_id);
create index if not exists time_off_user_id_fk_idx on public.time_off(user_id);
create index if not exists tasks_tour_id_fk_idx on public.tasks(tour_id);
create index if not exists tour_ratings_user_id_fk_idx on public.tour_ratings(user_id);
create index if not exists tour_ratings_tour_id_fk_idx on public.tour_ratings(tour_id);
create index if not exists log_user_id_fk_idx on public.log(user_id);
create index if not exists change_requests_user_id_fk_idx on public.change_requests(user_id);
create index if not exists change_requests_tour_id_fk_idx on public.change_requests(tour_id);
create index if not exists change_requests_swap_with_fk_idx on public.change_requests(swap_with);
create index if not exists pay_adjustments_user_id_fk_idx on public.pay_adjustments(user_id);
create index if not exists pay_disputes_user_id_fk_idx on public.pay_disputes(user_id);
create index if not exists pay_disputes_tour_id_fk_idx on public.pay_disputes(tour_id);
create index if not exists personal_dates_user_id_fk_idx on public.personal_dates(user_id);
create index if not exists offers_user_id_fk_idx on public.offers(user_id);
create index if not exists offers_tour_id_fk_idx on public.offers(tour_id);
create index if not exists app_errors_user_id_fk_idx on public.app_errors(user_id);
create index if not exists push_subscriptions_user_id_fk_idx on public.push_subscriptions(user_id);
create index if not exists expenses_tour_id_fk_idx on public.expenses(tour_id);
create index if not exists tasks_assignees_idx on public.tasks using gin (assignees);
revoke execute on function public.my_tour_ids() from anon;
revoke execute on function public.my_client_ids() from anon;

-- 3.10 Safety (Supabase security advisor): people who are not signed in cannot call any of the app's database functions,
-- and the functions that only run inside the database (on sign-up, before saving) cannot be called from outside at all.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('admin_remove_person','app_role','can_see_client','can_see_guests','erase_guests','guest_days','guest_visits',
      'handle_new_user','is_admin','merge_clients','my_client_ids','my_counts','my_repeat_guests','my_tour_ids','on_tour','protect_booking','protect_creq',
      'protect_profile','protect_task','purge_old_guests','stale_guests','weekly_check','send_push_for_notice')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.proname in ('handle_new_user','protect_booking','protect_creq','protect_profile','protect_task','weekly_check','send_push_for_notice') then
      execute format('revoke execute on function %s from authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;
-- Covering indexes for the remaining links the performance advisor listed.
create index if not exists change_requests_decided_by_idx on public.change_requests(decided_by);
create index if not exists invites_created_by_idx on public.invites(created_by);
create index if not exists offers_booking_id_idx on public.offers(booking_id);
create index if not exists pay_adjustments_created_by_idx on public.pay_adjustments(created_by);
create index if not exists pay_disputes_decided_by_idx on public.pay_disputes(decided_by);
create index if not exists tasks_created_by_idx on public.tasks(created_by);
create index if not exists tasks_done_by_idx on public.tasks(done_by);
create index if not exists time_off_decided_by_idx on public.time_off(decided_by);
create index if not exists usage_user_id_idx on public.usage(user_id);

-- 3.15 nightly copy to Google Drive (applied 11 Nov by Claude): settings table for the backup function and a 03:00 Tbilisi job
create extension if not exists pg_cron;
create table if not exists public.backup_config (id int primary key default 1 check (id = 1), drive_url text, last_at timestamptz, last_try timestamptz, last_result text);
alter table public.backup_config enable row level security;
revoke all on public.backup_config from anon, authenticated;
insert into public.backup_config (id) values (1) on conflict (id) do nothing;
select cron.unschedule(jobid) from cron.job where jobname = 'friendly-backup-daily';
select cron.schedule('friendly-backup-daily', '0 23 * * *', $$ select net.http_post(url := 'https://scqqmnwzglbgnvgzqifu.supabase.co/functions/v1/backup', headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb, timeout_milliseconds := 120000); $$);

-- 3.36 Photo of the day (team only), likes, and thank-you notes between teammates. Safe to run again.
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  caption text check (caption is null or char_length(caption) <= 140),
  tour_id uuid references public.tours(id) on delete set null,
  likes uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, day)
);
create index if not exists photos_day_idx on public.photos(day desc);
create index if not exists photos_tour_id_idx on public.photos(tour_id);
alter table public.photos enable row level security;
drop policy if exists photos_read on public.photos;
drop policy if exists photos_insert on public.photos;
drop policy if exists photos_update on public.photos;
drop policy if exists photos_delete on public.photos;
create policy photos_read on public.photos for select to authenticated using ((select public.app_role()) is not null);
create policy photos_insert on public.photos for insert to authenticated with check ((select public.app_role()) is not null and user_id = (select auth.uid()));
create policy photos_update on public.photos for update to authenticated using (user_id = (select auth.uid()) or (select public.is_admin())) with check (user_id = (select auth.uid()) or (select public.is_admin()));
create policy photos_delete on public.photos for delete to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
revoke all on public.photos from anon;

-- A like is a tap by anyone in the team: it adds or removes the person's own id, nothing else.
create or replace function public.photo_like(p uuid) returns uuid[]
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); out_likes uuid[];
begin
  if public.app_role() is null then raise exception 'No access'; end if;
  update public.photos set likes = case when me = any(likes) then array_remove(likes, me) else array_append(likes, me) end
   where id = p returning likes into out_likes;
  return out_likes;
end $$;
revoke execute on function public.photo_like(uuid) from public, anon;
grant execute on function public.photo_like(uuid) to authenticated;

create table if not exists public.thanks (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  tour_id uuid references public.tours(id) on delete set null,
  text text check (text is null or char_length(text) <= 200),
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);
create index if not exists thanks_to_idx on public.thanks(to_id, created_at desc);
create index if not exists thanks_from_idx on public.thanks(from_id);
create index if not exists thanks_tour_id_idx on public.thanks(tour_id);
alter table public.thanks enable row level security;
drop policy if exists thanks_read on public.thanks;
drop policy if exists thanks_insert on public.thanks;
drop policy if exists thanks_delete on public.thanks;
create policy thanks_read on public.thanks for select to authenticated using ((select public.app_role()) is not null);
create policy thanks_insert on public.thanks for insert to authenticated with check ((select public.app_role()) is not null and from_id = (select auth.uid()));
create policy thanks_delete on public.thanks for delete to authenticated using (from_id = (select auth.uid()) or (select public.is_admin()));
revoke all on public.thanks from anon;

do $$ begin alter publication supabase_realtime add table public.photos; exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.thanks; exception when duplicate_object then null; when undefined_object then null; end $$;

-- The pictures themselves live in a private storage folder: only signed-in team members can open them,
-- and each person can add or replace files only in their own folder (<their id>/...).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 1048576, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg'];
drop policy if exists team_photos_read on storage.objects;
drop policy if exists team_photos_insert on storage.objects;
drop policy if exists team_photos_update on storage.objects;
drop policy if exists team_photos_delete on storage.objects;
create policy team_photos_read on storage.objects for select to authenticated using (bucket_id = 'photos' and (select public.app_role()) is not null);
create policy team_photos_insert on storage.objects for insert to authenticated with check (bucket_id = 'photos' and (select public.app_role()) is not null and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy team_photos_update on storage.objects for update to authenticated using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy team_photos_delete on storage.objects for delete to authenticated using (bucket_id = 'photos' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));

-- 3.37 a badge as a sticker on the photo of the day
alter table public.photos add column if not exists sticker text check (sticker is null or char_length(sticker) <= 80);

-- 3.38 Ready-made read-only checks for the operations agents, one notice they may write, and a log of their runs. Safe to run again.
-- Only the database owner may run these (not the app, not signed-in users). They never return phones or emails.
create extension if not exists pg_trgm with schema extensions;
create index if not exists bookings_ref_trgm_idx on public.bookings using gin (ref extensions.gin_trgm_ops);

create or replace function public.agent_board(d_from int default 0, d_to int default 1)
returns table (date date, start_time text, title text, kind text, status text, language text, pax int, adults int, children int, capacity int,
  guide text, driver text, vehicle text, bookings int, booked_pax int, marks text[], sources text[], has_freetour boolean, pickup text, flags text[])
language sql stable security invoker set search_path = public as $$
  with r as (select coalesce((select nullif(value->>'carSeats','')::int from settings where id = 'rules'), 6) car,
                    coalesce((select nullif(value->>'sabaduriMax','')::int from settings where id = 'rules'), 15) sab,
                    coalesce((select nullif(value->>'walkMax','')::int from settings where id = 'rules'), 10) walk,
                    (now() at time zone 'Asia/Tbilisi')::date today),
  b as (select bk.tour_id, count(*)::int n, coalesce(sum(coalesce(bk.pax, coalesce(bk.adults,0) + coalesce(bk.children,0))),0)::int px,
               array(select distinct m from bookings x, unnest(coalesce(x.marks,'{}')) m where x.tour_id = bk.tour_id order by 1) marks,
               array(select distinct coalesce(nullif(x.source,''),'?') from bookings x where x.tour_id = bk.tour_id order by 1) sources,
               bool_or(coalesce(bk.source,'') ilike '%freetour%' or 'freetour' = any(coalesce(bk.marks,'{}'))) ft
        from bookings bk group by bk.tour_id)
  select t.date, t.start_time, t.title, t.kind, t.status, t.language, coalesce(t.pax,0), coalesce(t.adults,0), coalesce(t.children,0), coalesce(t.capacity,0),
         g.name, d.name, d.vehicle, coalesce(b.n,0), coalesce(b.px,0), coalesce(b.marks,'{}'), coalesce(b.sources,'{}'), coalesce(b.ft,false), t.pickup,
         array_remove(array[
           case when t.status = 'confirmed' and t.guide_id is null then 'NO_GUIDE' end,
           case when t.status = 'confirmed' and t.title ~* '4\s*[x×х]\s*4|4\s*wd|delica|tusheti' and coalesce(t.pax,0) > r.car then 'OVER_6_PER_CAR' end,
           case when t.status = 'confirmed' and t.kind = 'group' and t.title ~* 'sabaduri' and coalesce(t.pax,0) > r.sab then 'SABADURI_OVER_15' end,
           case when t.status = 'confirmed' and t.kind = 'group' and t.title ~* 'walking|brutal' and coalesce(t.pax,0) > r.walk then 'WALK_OVER_10' end,
           case when coalesce(b.n,0) > 0 and coalesce(b.px,0) <> coalesce(t.pax,0) then 'PAX_MISMATCH' end], null)
  from tours t cross join r left join profiles g on g.id = t.guide_id left join profiles d on d.id = t.driver_id left join b on b.tour_id = t.id
  where t.date <= r.today + d_to and coalesce(t.date_to, t.date) >= r.today + d_from
  order by t.date, t.start_time nulls last, t.title
$$;

create or replace function public.agent_find_refs(codes text[])
returns table (code text, found boolean, tour_date date, start_time text, title text, status text, pax int, adults int, children int, marks text[], source text)
language sql stable security invoker set search_path = public as $$
  select c.code, b.id is not null, t.date, t.start_time, t.title, t.status, b.pax, b.adults, b.children, coalesce(b.marks,'{}'), b.source
  from unnest(codes) c(code) left join bookings b on length(trim(c.code)) >= 4 and b.ref ilike '%' || trim(c.code) || '%' left join tours t on t.id = b.tour_id
  order by c.code, t.date
$$;

create or replace function public.agent_changes(since timestamptz)
returns table (src text, at timestamptz, who text, what text)
language sql stable security invoker set search_path = public as $$
  with today as (select (now() at time zone 'Asia/Tbilisi')::date d)
  select * from (
    select 'change'::text, l.at, p.name, l.summary from log l left join profiles p on p.id = l.user_id where l.at > since
    union all
    select 'new_bookings', max(b.created_at), null, count(*) || ' bookings, ' || coalesce(sum(coalesce(b.pax, coalesce(b.adults,0) + coalesce(b.children,0))),0) || ' guests, source ' || coalesce(nullif(b.source,''),'?')
      from bookings b join tours t on t.id = b.tour_id, today where b.created_at > since and t.date >= today.d group by coalesce(nullif(b.source,''),'?')
    union all
    select 'cancelled', t.cancelled_at, null, t.date || ' ' || coalesce(t.start_time,'') || ' ' || t.title || coalesce(': ' || nullif(t.cancel_reason,''), '') from tours t where t.cancelled_at > since
    union all
    select 'needs_admin', q.created_at, p.name, 'Change request: ' || coalesce(t.date::text,'?') || ' ' || coalesce(t.title,'?') from change_requests q left join profiles p on p.id = q.user_id left join tours t on t.id = q.tour_id where q.status = 'pending' and q.created_at > since
    union all
    select 'needs_admin', o.created_at, p.name, 'Time off request (' || o.type || '): ' || o.date_from || ' - ' || o.date_to from time_off o left join profiles p on p.id = o.user_id where o.status = 'pending' and o.created_at > since
    union all
    select 'app_error', max(e.at), null, count(*) || 'x ' || coalesce(e.kind,'?') || ' v' || coalesce(max(e.version),'?') || ': ' || left(e.message, 160) from app_errors e where e.at > since group by e.kind, left(e.message, 160)
  ) x(src, at, who, what) order by at desc nulls last
$$;

create or replace function public.agent_conflicts(days int default 7)
returns table (kind text, date date, person text, detail text)
language sql stable security invoker set search_path = public as $$
  with today as (select (now() at time zone 'Asia/Tbilisi')::date d),
  t as (select t.* from tours t, today where t.status = 'confirmed' and t.date between today.d and today.d + days),
  w as (select t.id, t.date, t.title, t.start_time, t.end_time, x.pid from t, lateral (values (t.guide_id), (t.driver_id)) x(pid) where x.pid is not null group by t.id, t.date, t.title, t.start_time, t.end_time, x.pid)
  select * from (
    select 'double'::text, a.date, p.name, coalesce(a.start_time,'?') || ' ' || a.title || '  +  ' || coalesce(b.start_time,'?') || ' ' || b.title
      from w a join w b on b.pid = a.pid and b.date = a.date and a.id < b.id and coalesce(a.start_time,'00:00') < coalesce(nullif(b.end_time,''),'23:59') and coalesce(b.start_time,'00:00') < coalesce(nullif(a.end_time,''),'23:59') join profiles p on p.id = a.pid
    union all
    select 'on_time_off', w.date, p.name, coalesce(w.start_time,'?') || ' ' || w.title || ' (' || o.type || ' ' || o.date_from || ' - ' || o.date_to || ')'
      from w join time_off o on o.user_id = w.pid and o.status = 'approved' and w.date between o.date_from and o.date_to join profiles p on p.id = w.pid
    union all
    select 'holiday', t.date, null, coalesce(t.start_time,'?') || ' ' || t.title || ' (' || h.name || ')' from t join holidays h on t.date between h.date_from and h.date_to and coalesce(h.kind,'') <> 'event'
    union all
    select 'delica_no_4x4', t.date, p.name, coalesce(t.start_time,'?') || ' ' || t.title from t join profiles p on p.id = t.driver_id where p.vehicle = 'delica' and t.title !~* '4\s*[x×х]\s*4|4\s*wd|delica'
  ) x(kind, date, person, detail) order by date, kind
$$;

-- The one thing the agents may write: a short notice to every admin (app bell, phone, Telegram). At most 10 an hour, 500 characters.
create or replace function public.agent_notify(msg text) returns int
language plpgsql security definer set search_path = public as $$
declare n int; same jsonb := coalesce((select value->'sameAs' from settings where id = 'rules'), '{}'::jsonb); body text := left(trim(coalesce(msg,'')), 500);
begin
  if body = '' then return 0; end if;
  if (select count(distinct params->>'text') from notifications where kind = 'agent' and created_at > now() - interval '1 hour') >= 10 then return 0; end if;
  insert into notifications (user_id, kind, params)
    select p.id, 'agent', jsonb_build_object('text', body) from profiles p where p.role = 'admin' and p.active and not (same ? p.id::text);
  get diagnostics n = row_count; return n;
end $$;

create table if not exists public.agent_runs (id bigserial primary key, at timestamptz not null default now(), run text, summary text);
alter table public.agent_runs enable row level security;
drop policy if exists agent_runs_read on public.agent_runs;
create policy agent_runs_read on public.agent_runs for select to authenticated using ((select public.is_admin()));
revoke all on public.agent_runs from anon;
revoke insert, update, delete on public.agent_runs from authenticated;
create or replace function public.agent_run_done(run text, summary text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare t timestamptz;
begin
  insert into agent_runs (run, summary) values (left(coalesce(run,''), 60), left(coalesce(summary,''), 1000)) returning at into t;
  delete from agent_runs where at < now() - interval '90 days';
  return t;
end $$;

revoke execute on function public.agent_board(int, int), public.agent_find_refs(text[]), public.agent_changes(timestamptz), public.agent_conflicts(int), public.agent_notify(text), public.agent_run_done(text, text) from public, anon, authenticated;

-- 3.69  Bank details typed by the office (the person confirms or edits) and likes on badges. Safe to run again.
alter table public.payout_details add column if not exists entered_by uuid references public.profiles(id) on delete set null;
alter table public.payout_details add column if not exists confirmed_at timestamptz;
drop policy if exists payout_admin on public.payout_details;
create policy payout_admin on public.payout_details for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create table if not exists public.badge_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge text not null, created_at timestamptz not null default now(),
  unique (user_id, badge)
);
create index if not exists badge_likes_badge_idx on public.badge_likes(badge);
alter table public.badge_likes enable row level security;
drop policy if exists badge_likes_read on public.badge_likes;
create policy badge_likes_read on public.badge_likes for select to authenticated using ((select public.app_role()) is not null);
drop policy if exists badge_likes_add on public.badge_likes;
create policy badge_likes_add on public.badge_likes for insert to authenticated with check (user_id = (select auth.uid()) and (select public.app_role()) is not null);
drop policy if exists badge_likes_del on public.badge_likes;
create policy badge_likes_del on public.badge_likes for delete to authenticated using (user_id = (select auth.uid()));

-- 3.72 problem reports (tickets): guides and drivers report a problem in the app or in Telegram; the admin sees them, sets a status and answers.
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null default 'app' check (source in ('app','telegram')),
  body text not null check (char_length(body) between 3 and 2000),
  shots text[] not null default '{}',                      -- small still pictures in the private "tickets" folder (never a video)
  status text not null default 'new' check (status in ('new','seen','planned','working','done','wontdo')),
  reply text check (reply is null or char_length(reply) <= 1000),        -- the answer the reporter gets
  summary text check (summary is null or char_length(summary) <= 2000),  -- plain-text description of the pictures or video, for planning
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
create index if not exists tickets_user_idx on public.tickets(user_id);
create index if not exists tickets_status_idx on public.tickets(status, created_at desc);
alter table public.tickets enable row level security;
drop policy if exists tickets_read on public.tickets;
drop policy if exists tickets_insert on public.tickets;
drop policy if exists tickets_admin_update on public.tickets;
drop policy if exists tickets_admin_delete on public.tickets;
create policy tickets_read on public.tickets for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy tickets_insert on public.tickets for insert to authenticated with check (user_id = (select auth.uid()) and status = 'new' and (select public.app_role()) is not null);
create policy tickets_admin_update on public.tickets for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy tickets_admin_delete on public.tickets for delete to authenticated using ((select public.is_admin()));
revoke all on public.tickets from anon;
do $$ begin alter publication supabase_realtime add table public.tickets; exception when duplicate_object then null; when undefined_object then null; end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tickets', 'tickets', false, 524288, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 524288, allowed_mime_types = array['image/jpeg'];
drop policy if exists tickets_files_read on storage.objects;
drop policy if exists tickets_files_insert on storage.objects;
drop policy if exists tickets_files_delete on storage.objects;
create policy tickets_files_read on storage.objects for select to authenticated using (bucket_id = 'tickets' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));
create policy tickets_files_insert on storage.objects for insert to authenticated with check (bucket_id = 'tickets' and (select public.app_role()) is not null and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy tickets_files_delete on storage.objects for delete to authenticated using (bucket_id = 'tickets' and (select public.is_admin()));

-- ===== 3.77 (applied 14 Nov 2026): "only the changes" loading =====
create table if not exists public.deleted_rows (id bigint generated always as identity primary key, tbl text not null, row_id text not null, at timestamptz not null default now());
create index if not exists deleted_rows_at_idx on public.deleted_rows(at);
alter table public.deleted_rows enable row level security;
drop policy if exists deleted_rows_read on public.deleted_rows;
create policy deleted_rows_read on public.deleted_rows for select to authenticated using (true);
create or replace function public.fs_touch() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at := now(); return new; end $$;
create or replace function public.fs_note_delete() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.deleted_rows(tbl, row_id) values (tg_table_name, old.id::text); return old; end $$;
do $$ declare t text; begin foreach t in array array['tours','bookings','clients'] loop
  execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()', t);
  execute format('create index if not exists %I on public.%I(updated_at)', t||'_updated_at_idx', t);
  execute format('drop trigger if exists fs_touch on public.%I', t);
  execute format('create trigger fs_touch before insert or update on public.%I for each row execute function public.fs_touch()', t);
  execute format('drop trigger if exists fs_note_delete on public.%I', t);
  execute format('create trigger fs_note_delete after delete on public.%I for each row execute function public.fs_note_delete()', t);
end loop; end $$;
revoke execute on function public.fs_note_delete() from public, anon, authenticated;
revoke execute on function public.fs_touch() from public, anon, authenticated;

-- ===== 3.77 (applied 14 Nov 2026): accounting tables, admin only =====
create table if not exists public.commission_rules (id uuid primary key default gen_random_uuid(), platform text not null, tour_key text, percent numeric not null check (percent >= 0 and percent <= 100), valid_from date not null default current_date, note text, created_by uuid, created_at timestamptz not null default now());
create table if not exists public.payments (id uuid primary key default gen_random_uuid(), booking_id uuid references public.bookings(id) on delete set null, tour_id uuid references public.tours(id) on delete set null, kind text not null default 'tour' check (kind in ('tour','addon','tip','refund')), amount numeric not null, currency text not null default 'GEL', gel_rate numeric, gel_amount numeric, method text not null default 'cash' check (method in ('cash','card','online','platform')), bank text, tx_code text, received_by uuid, paid_at date not null default current_date, note text, created_by uuid, created_at timestamptz not null default now());
create table if not exists public.staff_payments (id uuid primary key default gen_random_uuid(), user_id uuid not null, amount numeric not null, currency text not null default 'GEL', gel_rate numeric, gel_amount numeric, method text not null default 'cash' check (method in ('cash','card','bank')), bank text, tx_code text, paid_at date not null default current_date, for_month text, note text, created_by uuid, created_at timestamptz not null default now());
do $$ declare t text; begin foreach t in array array['commission_rules','payments','staff_payments'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('drop policy if exists %I on public.%I', t||'_admin', t);
  execute format('create policy %I on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t||'_admin', t);
end loop; end $$;

-- 3.78: payments to people outside the team (name only, no profile)
alter table public.staff_payments add column if not exists payee_name text;
alter table public.staff_payments alter column user_id drop not null;
alter table public.staff_payments drop constraint if exists staff_payments_payee_chk;
alter table public.staff_payments add constraint staff_payments_payee_chk check (user_id is not null or coalesce(btrim(payee_name),'') <> '');

-- 3.79: tips written down for free tours (information only)
create table if not exists public.tour_tips (id uuid primary key default gen_random_uuid(), tour_id uuid not null references public.tours(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, amount numeric not null default 0 check (amount >= 0), currency text not null default 'GEL', note text, created_at timestamptz not null default now());
create index if not exists tour_tips_tour_idx on public.tour_tips(tour_id);
create index if not exists tour_tips_user_idx on public.tour_tips(user_id);
alter table public.tour_tips enable row level security;
create policy tips_read on public.tour_tips for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy tips_add on public.tour_tips for insert to authenticated with check (user_id = (select auth.uid()) and public.on_tour(tour_id));
create policy tips_edit on public.tour_tips for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.on_tour(tour_id));
create policy tips_remove on public.tour_tips for delete to authenticated using (user_id = (select auth.uid()));
create policy tips_admin on public.tour_tips for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant select, insert, update, delete on public.tour_tips to authenticated;

-- 3.80 timed notices (applied 14 Nov by Claude): evening reminder 19:00 Tbilisi (15:00 UTC) and the Sunday 18:00 schedule check
select cron.unschedule(jobid) from cron.job where jobname in ('tour-reminders','week-check');
select cron.schedule('tour-reminders', '0 15 * * *', 'select public.remind_tomorrow()');
select cron.schedule('week-check', '0 14 * * 0', 'select public.weekly_check()');

-- 3.80 drivers read only the guests who need a pick-up or drop-off (applied 14 Nov by Claude with the owner's approval; backup table bookings_drvbak_20261114).
-- Guides and admins are unchanged. A transfer, and a tour with no guide, still show every guest to the driver.
-- Written as "in (select ...)" lists so the database works them out once, not once per booking (a per-row function timed out on 14,000 bookings).
create or replace function public.my_full_tour_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select t.id from public.tours t
  where t.id in (select public.my_tour_ids())
    and (t.guide_id = auth.uid() or t.guide_id is null or t.kind = 'transfer')
$$;
revoke execute on function public.my_full_tour_ids() from public, anon;
grant execute on function public.my_full_tour_ids() to authenticated;
drop policy if exists bookings_read on public.bookings;
create policy bookings_read on public.bookings for select to authenticated
  using ((select public.is_admin()) or (
    tour_id in (select public.my_tour_ids())
    and (tour_id in (select public.my_full_tour_ids()) or coalesce(pickup_addr, '') <> '' or coalesce(marks, '{}') && array['pickup','dropoff','stays'])));
create or replace function public.my_client_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct b.client_id from public.bookings b
  where b.client_id is not null and b.tour_id in (select public.my_tour_ids())
    and (b.tour_id in (select public.my_full_tour_ids()) or coalesce(b.pickup_addr, '') <> '' or coalesce(b.marks, '{}') && array['pickup','dropoff','stays'])
$$;
