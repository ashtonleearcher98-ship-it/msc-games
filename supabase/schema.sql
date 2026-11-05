-- MSC Games — Micronation Sports Championships
-- Run once in the dedicated MSC Supabase project SQL Editor.
-- Admin login is handled by Supabase Auth, not by a hardcoded website password.
-- The admin account should be created with email already confirmed: no verification link required.

create extension if not exists pgcrypto;

create table if not exists public.msc_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.msc_delegation_applications (
  id uuid primary key default gen_random_uuid(),
  nation_name text not null check (length(trim(nation_name)) between 2 and 120),
  contact_name text not null check (length(trim(contact_name)) between 2 and 120),
  email text not null check (length(email) between 5 and 180 and position('@' in email) > 1),
  delegation_size text not null check (delegation_size in ('1','2-5','6-15','16+')),
  sports text not null check (length(trim(sports)) between 2 and 400),
  notes text not null default '' check (length(notes) <= 3000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.msc_host_applications (
  id uuid primary key default gen_random_uuid(),
  nation_name text not null check (length(trim(nation_name)) between 2 and 120),
  contact_name text not null check (length(trim(contact_name)) between 2 and 120),
  email text not null check (length(email) between 5 and 180 and position('@' in email) > 1),
  preferred_edition text not null check (preferred_edition in (
    'Future edition — flexible',
    '2033 (expression of interest)',
    '2036 (expression of interest)',
    '2039 (expression of interest)'
  )),
  hosting_format text not null check (hosting_format in ('Online / remote','Hybrid','In-person (proposal)')),
  proposal text not null check (length(trim(proposal)) between 20 and 5000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.msc_registry_entries (
  id uuid primary key default gen_random_uuid(),
  nation_name text not null check (length(trim(nation_name)) between 2 and 120),
  representative text not null default '' check (length(representative) <= 120),
  notes text not null default '' check (length(notes) <= 240),
  status text not null default 'pending' check (status in ('pending','active','inactive')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists msc_delegations_created_idx on public.msc_delegation_applications(created_at desc);
create index if not exists msc_delegations_status_idx on public.msc_delegation_applications(status);
create index if not exists msc_hosts_created_idx on public.msc_host_applications(created_at desc);
create index if not exists msc_hosts_status_idx on public.msc_host_applications(status);
create index if not exists msc_registry_created_idx on public.msc_registry_entries(created_at desc);

-- RLS is mandatory on all public Data API tables.
alter table public.msc_admins enable row level security;
alter table public.msc_delegation_applications enable row level security;
alter table public.msc_host_applications enable row level security;
alter table public.msc_registry_entries enable row level security;

revoke all on public.msc_admins from anon,authenticated;
revoke all on public.msc_delegation_applications from anon,authenticated;
revoke all on public.msc_host_applications from anon,authenticated;
revoke all on public.msc_registry_entries from anon,authenticated;

grant usage on schema public to anon,authenticated;
grant select on public.msc_admins to authenticated;
grant select on public.msc_delegation_applications,public.msc_host_applications,public.msc_registry_entries to authenticated;
grant insert (nation_name,contact_name,email,delegation_size,sports,notes) on public.msc_delegation_applications to anon,authenticated;
grant insert (nation_name,contact_name,email,preferred_edition,hosting_format,proposal) on public.msc_host_applications to anon,authenticated;
grant insert (nation_name,representative,notes,status) on public.msc_registry_entries to authenticated;
grant update (status,reviewed_at) on public.msc_delegation_applications,public.msc_host_applications,public.msc_registry_entries to authenticated;

drop policy if exists msc_admin_read_self on public.msc_admins;
create policy msc_admin_read_self on public.msc_admins for select to authenticated
using (user_id=(select auth.uid()));

drop policy if exists msc_delegation_public_submit on public.msc_delegation_applications;
create policy msc_delegation_public_submit on public.msc_delegation_applications for insert to anon,authenticated
with check (status='pending' and reviewed_at is null);

drop policy if exists msc_delegation_admin_read on public.msc_delegation_applications;
create policy msc_delegation_admin_read on public.msc_delegation_applications for select to authenticated
using (exists(select 1 from public.msc_admins a where a.user_id=(select auth.uid())));

drop policy if exists msc_delegation_admin_review on public.msc_delegation_applications;
create policy msc_delegation_admin_review on public.msc_delegation_applications for update to authenticated
using (exists(select 1 from public.msc_admins a where a.user_id=(select auth.uid())))
with check (exists(select 1 from public.msc_admins a where a.user_id=(select auth.uid())));

drop policy if exists msc_host_public_submit on public.msc_host_applications;
create policy msc_host_public_submit on public.msc_host_applications for insert to anon,authenticated
with check (status='pending' and reviewed_at is null);

drop policy if exists msc_host_admin_read on public.msc_host_applications;
create policy msc_host_admin_read on public.msc_host_applications for select to authenticated
using (exists(select 1 from public.msc_admins a where a.user_id=(select auth.uid())));

drop policy if exists msc_host_admin_review on public.msc_host_applications;
create policy msc_host_admin_review on public.msc_host_applications for update to authenticated
using (exists(select 1 from public.msc_admins a where a.user_id=(select auth.uid())))
with check (exists(select 1 from public.msc_admins a where a.user_id=(select auth.uid())));

drop policy if exists msc_registry_admin_read on public.msc_registry_entries;
create policy msc_registry_admin_read on public.msc_registry_entries for select to authenticated
using (exists(select 1 from public.msc_admins a where a.user_id=(select auth.uid())));

drop policy if exists msc_registry_admin_insert on public.msc_registry_entries;
create policy msc_registry_admin_insert on public.msc_registry_entries for insert to authenticated
with check (exists(select 1 from public.msc_admins a where a.user_id=(select auth.uid())));

drop policy if exists msc_registry_admin_update on public.msc_registry_entries;
create policy msc_registry_admin_update on public.msc_registry_entries for update to authenticated
using (exists(select 1 from public.msc_admins a where a.user_id=(select auth.uid())))
with check (exists(select 1 from public.msc_admins a where a.user_id=(select auth.uid())));

-- AFTER adding the administrator in Authentication > Users with EMAIL CONFIRMED,
-- execute to grant that Supabase Auth user administrator permissions.
-- This does not create the user and does not store the password in SQL.
--
-- insert into public.msc_admins(user_id)
-- select id from auth.users where lower(email)='admin@mscgames.cgw'
-- on conflict(user_id) do nothing;

-- Before extensive public use add CAPTCHA / IP-based throttling to the public form
-- submission path. Database CHECK constraints and RLS do not prevent spam.
