-- Friendly Schedule: ONE update with everything added since the first setup (versions 2.4 to 3.3).
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
