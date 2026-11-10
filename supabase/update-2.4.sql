-- Friendly Schedule 2.4: Telegram username on profiles and invitations.
-- Safe to run more than once. Paste all of it into Supabase > SQL Editor and press Run.
alter table public.profiles add column if not exists telegram text;
alter table public.invites add column if not exists telegram text;

-- New people keep the Telegram username the admin typed in the invitation.
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
