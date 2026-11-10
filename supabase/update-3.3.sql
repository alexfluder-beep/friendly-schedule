-- Friendly Schedule 3.3 (after 3.0/3.1): text size, colours and contrast saved on each person's account.
-- Safe to run more than once. Paste into Supabase > SQL Editor and press Run.
alter table public.profiles add column if not exists display jsonb;
