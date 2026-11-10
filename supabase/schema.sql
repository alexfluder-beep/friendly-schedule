-- Friendly Schedule: database, security rules and live updates.
-- Run once in Supabase: SQL Editor > New query > paste everything > Run.
-- Then set yourself as admin with the line at the very bottom.

create extension if not exists pgcrypto;

-- ---------- tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  role text not null default 'guide' check (role in ('admin','guide','driver')),
  lang text default 'en' check (lang in ('en','ru','ka')),
  color text default '#66737f',
  phone text,
  avatar text,
  work_days text,              -- weekdays the person works, 0 = Monday ... 6 = Sunday, e.g. "0,1,2,3,4"; empty = every day
  work_from text, work_to text, -- usual working hours
  languages text,              -- tour languages this guide can lead, e.g. "EN, RU"
  telegram text,               -- Telegram username without @, shown as a one-tap button to colleagues
  badges_seen text[],          -- badges already celebrated, so the welcome badge shows once per account
  active boolean not null default false,
  telegram_id bigint unique,   -- set by the crew bot when the person sends it /link with the code below
  link_code text,              -- one-time code the person creates in the app (Me > Telegram bot)
  work_week jsonb,             -- working hours per weekday: 7 entries, Monday first; null = day off, otherwise ["09:00","18:00"]
  vehicle text check (vehicle in ('own','delica')),   -- own car or the company Delica; used for driving statistics and badges
  email text,                  -- sign-in email, shown to admins in the team list
  skills text[] not null default '{}',   -- tours this guide leads (ids from the tour list); empty = all tours
  mute text[] not null default '{}',     -- notification groups the person switched off
  left_at timestamptz          -- set when the person is removed from the team; their private details are wiped then
);
create table if not exists public.tours (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  date_to date,                -- last day of a multi-day tour, empty for one-day tours
  start_time text, end_time text,
  title text not null,
  kind text not null default 'private' check (kind in ('private','group','custom','transfer')),
  capacity int not null default 0,
  pax int not null default 0,
  adults int not null default 0,
  children int not null default 0,
  guide_pay numeric, driver_pay numeric,   -- set only when this tour pays differently from the standard rate
  language text, pickup text, pickup_url text, notes text,
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  cancel_reason text, cancelled_at timestamptz,
  guide_id uuid references public.profiles(id) on delete set null,
  driver_id uuid references public.profiles(id) on delete set null,
  external_id text
);
create index if not exists tours_date_idx on public.tours(date);
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null, phone text, email text, notes text,
  anonymised_at timestamptz    -- set when the guest's contact details were removed (privacy clean-up)
);
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  guest text not null, adults int not null default 1, children int not null default 0, pax int not null default 1,
  phone text, ref text, notes text,
  attendance text check (attendance in ('arrived','noshow')),
  source text, payment text check (payment in ('prepaid','cash','unpaid')), amount_due numeric,
  pickup_addr text, pickup_url text,       -- this guest's own pick-up or drop-off address and its map link
  marks text[] not null default '{}',     -- wine, private_room, front_seat, bear_food, pickup, dropoff, stays (stays at the destination after the tour), or your own
  email text, lang text, currency text,   -- guest email, the language the guest asked for, currency of price and amount_due
  price numeric,                          -- what the booking brings in (platform price or net), for the week and month figures
  history jsonb not null default '[]',    -- booked, changed, moved, cancelled: time, who, what
  created_at timestamptz not null default now()
);
create index if not exists bookings_client_idx on public.bookings(client_id);
create index if not exists tours_guide_idx on public.tours(guide_id, date);
create index if not exists tours_driver_idx on public.tours(driver_id, date);
create table if not exists public.client_ratings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating text not null check (rating in ('good','fine','bad','trouble','like','dislike')),
  note text, created_at timestamptz not null default now()
);
create index if not exists bookings_tour_idx on public.bookings(tour_id);
create table if not exists public.time_off (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date_from date not null, date_to date not null,
  type text not null default 'dayoff' check (type in ('dayoff','half','sick')),
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  note text, created_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id) on delete set null,
  check (date_to >= date_from)
);
create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null, date_from date not null, date_to date not null,
  kind text not null default 'holiday' check (kind in ('holiday','event')),   -- event = team event, nobody is blocked
  notes text
);
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null, notes text, due_date date,
  kind text,                   -- 'week_check' = the Sunday evening "check next week's schedule" task
  assignees uuid[] not null default '{}',
  status text not null default 'open' check (status in ('open','done')),
  tour_id uuid references public.tours(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  done_by uuid references public.profiles(id) on delete set null,
  done_at timestamptz
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null, params jsonb not null default '{}',
  read boolean not null default false,
  tg_sent boolean not null default false,   -- the crew bot has forwarded this notice to Telegram
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists ratings_client_idx on public.client_ratings(client_id);
create table if not exists public.tour_ratings (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  score int not null check (score between 0 and 10), note text,
  created_at timestamptz not null default now(), unique (tour_id, user_id)
);
create table if not exists public.payout_details (   -- bank details: visible only to the person and to admins
  id uuid primary key references public.profiles(id) on delete cascade,
  bank_name text, holder text, account text
);
create table if not exists public.log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  user_id uuid references public.profiles(id) on delete set null,
  summary text not null
);
create table if not exists public.change_requests (   -- a guide or driver suggests a change; it applies only after an admin approves
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  patch jsonb not null default '{}', cant boolean not null default false, message text,
  swap_with uuid references public.profiles(id) on delete set null,   -- colleague asked to take the tour
  agreed boolean not null default false,                              -- that colleague said yes
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  created_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id) on delete set null
);
create table if not exists public.pay_adjustments (   -- corrections to a month's pay, added by the admin after the month ends
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  month text not null, amount numeric not null, note text,
  created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now()
);
create table if not exists public.pay_disputes (     -- a guide or driver says the pay counted for a tour is not right; the admin answers
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  counted numeric, expected numeric, message text not null,
  status text not null default 'open' check (status in ('open','accepted','declined')),
  reply text, created_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id) on delete set null
);
create table if not exists public.tour_costs (       -- what a tour cost the company (accommodation, food, tickets, fuel, other): admins only
  id uuid primary key references public.tours(id) on delete cascade,
  items jsonb not null default '{}', note text
);
create table if not exists public.personal_dates (    -- a person's own special dates (birthday, family day)
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, date date not null, yearly boolean not null default false
);
create table if not exists public.usage (             -- how often each feature is tapped, per person per day
  id uuid primary key default gen_random_uuid(),
  day date not null, user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null, n int not null default 1
);
create index if not exists usage_day_idx on public.usage(day);
create table if not exists public.offers (            -- a guide offered an upcoming tour to a guest
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tour_id uuid references public.tours(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  at timestamptz not null default now()
);
create table if not exists public.settings (id text primary key, value jsonb not null default '{}');
create table if not exists public.invites (            -- people the admin has added; they get access as soon as they create an account with this email
  id uuid primary key default gen_random_uuid(),
  email text not null unique, name text not null default '',
  role text not null default 'guide' check (role in ('admin','guide','driver')),
  phone text, languages text, telegram text, color text, vehicle text, work_week jsonb, work_days text, work_from text, work_to text, skills text[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now()
);
create table if not exists public.app_errors (          -- problem log: errors, failed saves and lost connections, sent by the phones
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  at timestamptz not null default now(), kind text, message text, detail text, page text, version text, device text
);
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique, p256dh text not null, auth text not null,
  created_at timestamptz not null default now()
);

-- ---------- helpers ----------
-- Role of the signed-in person, or null if they have no access yet.
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() = 'admin', false)
$$;
create or replace function public.on_tour(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.app_role() is not null and exists (select 1 from public.tours where id = t and (guide_id = auth.uid() or driver_id = auth.uid()))
$$;

-- Privacy: guides and drivers see guest names and phones only around the tour, not for years afterwards.
-- The number of days comes from Back office > Privacy (default 14 days after the tour ends).
create or replace function public.guest_days() returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select nullif(value->'privacy'->>'guideDays', '')::int from public.settings where id = 'rules'), 14)
$$;
create or replace function public.can_see_guests(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (public.app_role() is not null and exists (
    select 1 from public.tours where id = t and (guide_id = auth.uid() or driver_id = auth.uid())
      and coalesce(date_to, date) >= current_date - public.guest_days()))
$$;
create or replace function public.can_see_client(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (public.app_role() is not null and exists (
    select 1 from public.bookings b join public.tours t on t.id = b.tour_id
    where b.client_id = c and (t.guide_id = auth.uid() or t.driver_id = auth.uid())
      and coalesce(t.date_to, t.date) >= current_date - public.guest_days()))
$$;
-- New sign-ups: if the admin already added this email (Back office > Team > Add person), the person gets
-- their role and access at once. Anyone else gets a profile with no access until an admin gives it.
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
-- Admin removes a person: access is closed and private details are wiped. If the person never worked a tour,
-- the account is deleted completely; otherwise the name stays on past tours and pay reports.
create or replace function public.admin_remove_person(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only an admin can remove a person'; end if;
  if uid = auth.uid() then raise exception 'You cannot remove yourself'; end if;
  delete from public.payout_details where id = uid;
  delete from public.personal_dates where user_id = uid;
  delete from public.push_subscriptions where user_id = uid;
  delete from public.notifications where user_id = uid;
  delete from public.time_off where user_id = uid and date_from > current_date;
  if exists (select 1 from public.tours where guide_id = uid or driver_id = uid) then
    update public.profiles set active = false, left_at = now(), phone = null, email = null, avatar = null, work_days = null, work_from = null, work_to = null where id = uid;
    begin update auth.users set banned_until = 'infinity' where id = uid; exception when others then null; end;
  else
    delete from auth.users where id = uid;   -- the profile row goes with it
    delete from public.profiles where id = uid;
  end if;
end $$;
-- Returning guests: how many earlier tours a guest had, in total and with the signed-in guide or driver.
-- Only numbers are returned, so the time limit on guest details stays in force.
create or replace function public.guest_visits(ids uuid[])
returns table(client_id uuid, total int, mine int, years int, addons int, noshow int, good int, bad int)
language sql stable security definer set search_path = public as $$
  select b.client_id, count(*)::int,
    (count(*) filter (where t.guide_id = auth.uid() or t.driver_id = auth.uid()))::int,
    count(distinct extract(year from t.date))::int,
    (count(*) filter (where cardinality(b.marks) > 0))::int,
    (count(*) filter (where b.attendance = 'noshow'))::int,
    (select count(*) from public.client_ratings r where r.client_id = b.client_id and r.rating in ('good','like'))::int,
    (select count(*) from public.client_ratings r where r.client_id = b.client_id and r.rating in ('bad','trouble','dislike'))::int
  from public.bookings b join public.tours t on t.id = b.tour_id
  where b.client_id = any(ids) and public.can_see_client(b.client_id)
    and t.status = 'confirmed' and coalesce(t.date_to, t.date) < current_date
  group by b.client_id
$$;
create or replace function public.my_repeat_guests() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from (
    select b.client_id from public.bookings b join public.tours t on t.id = b.tour_id join public.clients c on c.id = b.client_id
    where public.app_role() is not null and (t.guide_id = auth.uid() or t.driver_id = auth.uid())
      and t.status = 'confirmed' and t.date <= current_date and c.anonymised_at is null
    group by b.client_id having count(distinct t.id) >= 2) x
$$;
-- Numbers for badges that depend on old bookings: no-shows reported and tours finished with a guest marked "trouble maker".
create or replace function public.my_counts() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.app_role() is null then '{}'::jsonb else jsonb_build_object(
    'noshow', (select count(*) from public.bookings b join public.tours t on t.id = b.tour_id
               where (t.guide_id = auth.uid() or t.driver_id = auth.uid()) and t.status = 'confirmed' and b.attendance = 'noshow'),
    'trouble', (select count(distinct t.id) from public.bookings b join public.tours t on t.id = b.tour_id
               where (t.guide_id = auth.uid() or t.driver_id = auth.uid()) and t.status = 'confirmed' and t.date <= current_date
                 and exists (select 1 from public.client_ratings r where r.client_id = b.client_id and r.rating = 'trouble'))) end
$$;
grant execute on function public.my_counts() to authenticated;
grant execute on function public.guest_visits(uuid[]) to authenticated;
grant execute on function public.my_repeat_guests() to authenticated;
-- Privacy clean-up: guests whose last tour ended more than N months ago lose their name, phone, email, notes and
-- booking reference. Tour numbers stay, so statistics and pay history are not affected. Cannot be undone.
create or replace function public.stale_guests(months int) returns setof uuid
language sql stable security definer set search_path = public as $$
  select c.id from public.clients c
  where public.is_admin() and c.anonymised_at is null
    and exists (select 1 from public.bookings b where b.client_id = c.id)
    and not exists (select 1 from public.bookings b join public.tours t on t.id = b.tour_id
                    where b.client_id = c.id and coalesce(t.date_to, t.date) >= (current_date - make_interval(months => months))::date)
$$;
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
create or replace function public.purge_old_guests(months int) returns int
language plpgsql security definer set search_path = public as $$
begin
  if months is null or months < 3 then raise exception 'Keep guest details for at least 3 months'; end if;
  return public.erase_guests(array(select public.stale_guests(months)));
end $$;
-- Admin joins duplicate guests: every booking and rating moves to one guest, the others are removed.
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
revoke all on function public.erase_guests(uuid[]) from public;
revoke all on function public.purge_old_guests(int) from public;
grant execute on function public.stale_guests(int) to authenticated;
grant execute on function public.erase_guests(uuid[]) to authenticated;
grant execute on function public.purge_old_guests(int) to authenticated;
revoke all on function public.admin_remove_person(uuid) from public;
grant execute on function public.admin_remove_person(uuid) to authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- People can edit their own profile but cannot change their own role or access.
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role; new.active := old.active; new.left_at := old.left_at; new.email := old.email; new.skills := old.skills; new.vehicle := old.vehicle; new.telegram_id := old.telegram_id;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles for each row execute function public.protect_profile();

-- Guides and drivers can only tick a task done, not rewrite it.
create or replace function public.protect_task() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.title := old.title; new.notes := old.notes; new.due_date := old.due_date;
    new.assignees := old.assignees; new.tour_id := old.tour_id; new.created_by := old.created_by; new.kind := old.kind;
  end if;
  return new;
end $$;
drop trigger if exists protect_task on public.tasks;
create trigger protect_task before update on public.tasks for each row execute function public.protect_task();

-- Guides and drivers can only mark a guest as arrived or no-show, nothing else on a booking.
create or replace function public.protect_booking() returns trigger
language plpgsql security definer set search_path = public as $$
declare keep text;
begin
  if auth.uid() is not null and not public.is_admin() then
    keep := new.attendance; new := old; new.attendance := keep;
  end if;
  return new;
end $$;
drop trigger if exists protect_booking on public.bookings;
create trigger protect_booking before update on public.bookings for each row execute function public.protect_booking();

-- The colleague asked to take a tour can only say yes (agreed) or no (declined).
create or replace function public.protect_creq() returns trigger
language plpgsql security definer set search_path = public as $$
declare a boolean; s text;
begin
  if auth.uid() is not null and not public.is_admin() then
    a := new.agreed; s := new.status; new := old; new.agreed := a;
    if s = 'declined' then new.status := 'declined'; end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_creq on public.change_requests;
create trigger protect_creq before update on public.change_requests for each row execute function public.protect_creq();

-- Evening reminder: one notification per person for each tour they have tomorrow (Tbilisi time).
-- It is sent once per tour; people who switched reminders off in "Me" are skipped.
-- To switch it on: Database > Extensions > enable pg_cron, then run the "cron.schedule" line at the bottom of this file.
create or replace function public.remind_tomorrow() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.notifications (user_id, kind, params)
  select p.id, 'tour_tomorrow', jsonb_build_object('title', t.title, 'date', t.date, 'time', coalesce(t.start_time, ''), 'tour', t.id)
  from public.tours t join public.profiles p on p.id in (t.guide_id, t.driver_id)
  where t.status = 'confirmed' and t.date = (now() at time zone 'Asia/Tbilisi')::date + 1
    and p.active and not ('reminder' = any(p.mute))
    and not exists (select 1 from public.notifications x where x.user_id = p.id and x.kind = 'tour_tomorrow' and x.params->>'tour' = t.id::text and x.params->>'date' = t.date::text);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.remind_tomorrow() from public, authenticated, anon;
-- Sunday evening: one "check your schedule for next week" task and one notification for every active guide and driver.
-- The app also creates the task itself when a person opens it on Sunday evening or Monday, so this is only needed
-- to remind people who have not opened the app.
create or replace function public.weekly_check() returns int
language plpgsql security definer set search_path = public as $$
declare n int; sun date := (now() at time zone 'Asia/Tbilisi')::date;
begin
  with ins as (
    insert into public.tasks (kind, title, due_date, assignees, status, created_by)
    select 'week_check', 'Check your schedule for next week', sun, array[p.id], 'open', p.id
    from public.profiles p
    where p.active and p.role in ('guide','driver')
      and not exists (select 1 from public.tasks k where k.kind = 'week_check' and k.due_date = sun and p.id = any(k.assignees))
    returning assignees[1] as uid)
  insert into public.notifications (user_id, kind, params) select uid, 'week_check', '{}'::jsonb from ins;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.weekly_check() from public, authenticated, anon;

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.app_errors enable row level security;
alter table public.tours enable row level security;
alter table public.bookings enable row level security;
alter table public.clients enable row level security;
alter table public.client_ratings enable row level security;
alter table public.time_off enable row level security;
alter table public.tour_ratings enable row level security;
alter table public.payout_details enable row level security;
alter table public.log enable row level security;
alter table public.change_requests enable row level security;
alter table public.pay_adjustments enable row level security;
alter table public.personal_dates enable row level security;
alter table public.usage enable row level security;
alter table public.offers enable row level security;
alter table public.holidays enable row level security;
alter table public.tasks enable row level security;
alter table public.notifications enable row level security;
alter table public.settings enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.invites enable row level security;
alter table public.pay_disputes enable row level security;
alter table public.tour_costs enable row level security;

-- profiles: everyone with access sees the team; you always see your own row
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.app_role() is not null);
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- tours: the whole team sees the calendar; only admins change it
create policy tours_read on public.tours for select to authenticated using (public.app_role() is not null);
create policy tours_admin on public.tours for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- bookings hold guest names and phones: admins, plus the guide and driver on that tour, and only around the tour dates
create policy bookings_read on public.bookings for select to authenticated using (public.can_see_guests(tour_id));
create policy bookings_attendance on public.bookings for update to authenticated using (public.on_tour(tour_id)) with check (public.on_tour(tour_id));
create policy bookings_admin on public.bookings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- clients: admins, plus guides and drivers who have this guest on a current or recent tour
create policy clients_read on public.clients for select to authenticated using (public.can_see_client(id));
create policy clients_admin on public.clients for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- guest ratings: a guide or driver rates guests from their own tours; ratings cannot be edited afterwards
create policy ratings_read on public.client_ratings for select to authenticated using (public.can_see_client(client_id));
create policy ratings_delete_own on public.client_ratings for delete to authenticated using (user_id = auth.uid() and rating in ('like','dislike'));
create policy ratings_insert on public.client_ratings for insert to authenticated with check (user_id = auth.uid() and public.can_see_client(client_id));
create policy ratings_admin on public.client_ratings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- tour scores 0-10: you score tours you worked on; only you and admins see your score
create policy scores_read on public.tour_ratings for select to authenticated using (public.is_admin() or user_id = auth.uid());
create policy scores_insert on public.tour_ratings for insert to authenticated with check (user_id = auth.uid() and public.on_tour(tour_id));
create policy scores_update on public.tour_ratings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy scores_admin on public.tour_ratings for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- bank details: own row and admins only
-- problem log: everyone signed in can add their own entries; only admins read and clear the list
create policy app_errors_add on public.app_errors for insert to authenticated with check (user_id = auth.uid());
create policy app_errors_admin_read on public.app_errors for select to authenticated using (public.is_admin());
create policy app_errors_admin_clear on public.app_errors for delete to authenticated using (public.is_admin());
create policy payout_own on public.payout_details for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy payout_admin on public.payout_details for select to authenticated using (public.is_admin());
-- change log: anyone with access adds entries, only admins read them, nobody edits them
create policy log_insert on public.log for insert to authenticated with check (public.app_role() is not null and user_id = auth.uid());
create policy log_read on public.log for select to authenticated using (public.is_admin());

-- change requests: you send them for your own tours and see your own; admins see and decide all
create policy creq_read on public.change_requests for select to authenticated using (public.is_admin() or user_id = auth.uid() or swap_with = auth.uid());
create policy creq_answer on public.change_requests for update to authenticated using (swap_with = auth.uid() and status = 'pending') with check (swap_with = auth.uid());
create policy creq_insert on public.change_requests for insert to authenticated with check (user_id = auth.uid() and status = 'pending' and public.on_tour(tour_id));
create policy creq_admin on public.change_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- pay corrections: the person sees their own, only admins write
create policy adj_read on public.pay_adjustments for select to authenticated using (public.is_admin() or user_id = auth.uid());
create policy adj_admin on public.pay_adjustments for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- pay disputes: you open them for your own tours and see your own; only admins answer
create policy disputes_read on public.pay_disputes for select to authenticated using (public.is_admin() or user_id = auth.uid());
create policy disputes_insert on public.pay_disputes for insert to authenticated with check (user_id = auth.uid() and status = 'open' and reply is null and public.on_tour(tour_id));
create policy disputes_admin on public.pay_disputes for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- tour costs: admins only, guides and drivers never see them
create policy costs_admin on public.tour_costs for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- personal dates: your own, readable by admins for planning
create policy pdates_own on public.personal_dates for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy pdates_admin on public.personal_dates for select to authenticated using (public.is_admin());

-- usage counts and tour offers: each person adds their own; admins read all, people read their own offers
create policy usage_insert on public.usage for insert to authenticated with check (user_id = auth.uid() and public.app_role() is not null);
create policy usage_read on public.usage for select to authenticated using (public.is_admin());
create policy offers_insert on public.offers for insert to authenticated with check (user_id = auth.uid() and public.app_role() is not null);
create policy offers_read on public.offers for select to authenticated using (public.is_admin() or user_id = auth.uid());

-- time off: team can see it; you ask for your own; sick days need no approval
create policy off_read on public.time_off for select to authenticated using (public.app_role() is not null);
create policy off_insert_own on public.time_off for insert to authenticated
  with check (public.app_role() is not null and user_id = auth.uid() and (status = 'pending' or type = 'sick'));
create policy off_delete_own on public.time_off for delete to authenticated using (user_id = auth.uid() and status = 'pending');
create policy off_admin on public.time_off for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy holidays_read on public.holidays for select to authenticated using (public.app_role() is not null);
create policy holidays_admin on public.holidays for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- tasks: you see the ones assigned to you and can tick them done
create policy tasks_read on public.tasks for select to authenticated using (public.is_admin() or auth.uid() = any(assignees));
create policy tasks_update_mine on public.tasks for update to authenticated using (auth.uid() = any(assignees)) with check (auth.uid() = any(assignees));
-- the Sunday week-check task is the only task a person may create, and only for themselves
create policy tasks_week_own on public.tasks for insert to authenticated
  with check (public.app_role() is not null and kind = 'week_check' and created_by = auth.uid() and assignees = array[auth.uid()] and tour_id is null and status = 'open');
create policy tasks_admin on public.tasks for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- notifications: anyone with access can send one; you only read and mark your own
create policy notes_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notes_insert on public.notifications for insert to authenticated with check (public.app_role() is not null);
create policy notes_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notes_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

create policy settings_read on public.settings for select to authenticated using (public.app_role() is not null);
create policy settings_admin on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- invitations: admins only
create policy invites_admin on public.invites for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy push_own on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- live updates ----------
alter publication supabase_realtime add table public.profiles, public.tours, public.bookings, public.clients, public.client_ratings, public.tour_ratings, public.payout_details, public.change_requests, public.pay_adjustments, public.personal_dates, public.time_off, public.holidays, public.tasks, public.notifications, public.settings, public.invites, public.pay_disputes, public.tour_costs;

-- ---------- optional: evening reminders at 19:00 Tbilisi time (15:00 UTC) ----------
-- Enable the pg_cron extension first, then run this one line.
-- select cron.schedule('tour-reminders', '0 15 * * *', 'select public.remind_tomorrow()');
-- Sunday 18:00 Tbilisi time (14:00 UTC): the weekly "check your schedule" task and notification.
-- select cron.schedule('week-check', '0 14 * * 0', 'select public.weekly_check()');

-- ---------- make yourself the admin ----------
-- 1) Open the app and create your account.  2) Put your email below and run this one line.
-- update public.profiles set role = 'admin', active = true where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
