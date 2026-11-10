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
