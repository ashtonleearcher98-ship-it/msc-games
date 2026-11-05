-- MSC Games: verified historical editions and published-results storage
-- Run AFTER schema.sql on a new project. Already applied on the live MSC Supabase project.
-- Do not publish results, medals, dates or host awards that have not been independently confirmed.

create table if not exists public.msc_editions (
  slug text primary key,
  title text not null,
  period_label text not null,
  host_nation text,
  status text not null check(status in ('announced','postponed','host_search','scheduled','completed','cancelled')),
  summary text not null,
  source_url text,
  updated_at timestamptz not null default now()
);
create table if not exists public.msc_disciplines (
  slug text primary key,
  name text not null,
  edition_slug text not null references public.msc_editions(slug),
  programme_status text not null check(programme_status in ('historical_proposal','confirmed','withdrawn')),
  source_url text
);
create table if not exists public.msc_results (
  id uuid primary key default gen_random_uuid(),
  edition_slug text not null references public.msc_editions(slug),
  discipline_slug text references public.msc_disciplines(slug),
  nation_name text not null,
  result_label text not null,
  medal text check(medal in ('gold','silver','bronze') or medal is null),
  status text not null default 'draft' check(status in ('draft','published')),
  source_url text,
  created_at timestamptz not null default now()
);
alter table public.msc_editions enable row level security;
alter table public.msc_disciplines enable row level security;
alter table public.msc_results enable row level security;
revoke all on public.msc_editions,public.msc_disciplines,public.msc_results from anon,authenticated;
grant select on public.msc_editions,public.msc_disciplines,public.msc_results to anon,authenticated;
grant insert,update,delete on public.msc_editions,public.msc_disciplines,public.msc_results to authenticated;

create policy msc_editions_public_read on public.msc_editions for select to anon,authenticated using (true);
create policy msc_disciplines_public_read on public.msc_disciplines for select to anon,authenticated using (true);
create policy msc_results_published_read on public.msc_results for select to anon,authenticated
using (status='published' or exists(select 1 from public.msc_admins where user_id=(select auth.uid())));
create policy msc_editions_admin_insert on public.msc_editions for insert to authenticated with check (exists(select 1 from public.msc_admins where user_id=(select auth.uid())));
create policy msc_editions_admin_update on public.msc_editions for update to authenticated using (exists(select 1 from public.msc_admins where user_id=(select auth.uid()))) with check (exists(select 1 from public.msc_admins where user_id=(select auth.uid())));
create policy msc_editions_admin_delete on public.msc_editions for delete to authenticated using (exists(select 1 from public.msc_admins where user_id=(select auth.uid())));
create policy msc_disciplines_admin_insert on public.msc_disciplines for insert to authenticated with check (exists(select 1 from public.msc_admins where user_id=(select auth.uid())));
create policy msc_disciplines_admin_update on public.msc_disciplines for update to authenticated using (exists(select 1 from public.msc_admins where user_id=(select auth.uid()))) with check (exists(select 1 from public.msc_admins where user_id=(select auth.uid())));
create policy msc_disciplines_admin_delete on public.msc_disciplines for delete to authenticated using (exists(select 1 from public.msc_admins where user_id=(select auth.uid())));
create policy msc_results_admin_insert on public.msc_results for insert to authenticated with check (exists(select 1 from public.msc_admins where user_id=(select auth.uid())));
create policy msc_results_admin_update on public.msc_results for update to authenticated using (exists(select 1 from public.msc_admins where user_id=(select auth.uid()))) with check (exists(select 1 from public.msc_admins where user_id=(select auth.uid())));
create policy msc_results_admin_delete on public.msc_results for delete to authenticated using (exists(select 1 from public.msc_admins where user_id=(select auth.uid())));

insert into public.msc_editions(slug,title,period_label,host_nation,status,summary,source_url) values
('greenwick-2025','Greenwick 2025','November 2025','Commonwealth of Greenwick','postponed','Originally announced for November 2025; postponed to January 2026 following participation issues. No completed-results claim.','https://en.micronations.wiki/wiki/2020_Micronational_Olympic_Games'),
('winter-2026','MSC Winter Games 2026','2026',null,'host_search','Rondland withdrew from hosting. MSC organisers announced a 100% virtual format and invited replacement-host interest in June 2026. No revised confirmed timetable.','https://www.reddit.com/r/micronations/comments/1twafi7/msc_games_2026_update_and_host_nations_seeking/')
on conflict(slug) do nothing;
insert into public.msc_disciplines(slug,name,edition_slug,programme_status,source_url) values
('athletics','Athletics','greenwick-2025','historical_proposal','https://en.everybodywiki.com/Commonwealth_of_Greenwick_-_Micronation'),
('rugby','Rugby','greenwick-2025','historical_proposal','https://en.everybodywiki.com/Commonwealth_of_Greenwick_-_Micronation'),
('football','Football','greenwick-2025','historical_proposal','https://en.everybodywiki.com/Commonwealth_of_Greenwick_-_Micronation'),
('volleyball','Volleyball','greenwick-2025','historical_proposal','https://en.everybodywiki.com/Commonwealth_of_Greenwick_-_Micronation'),
('cycling','Cycling','greenwick-2025','historical_proposal','https://en.everybodywiki.com/Commonwealth_of_Greenwick_-_Micronation'),
('gymnastics','Gymnastics','greenwick-2025','historical_proposal','https://en.everybodywiki.com/Commonwealth_of_Greenwick_-_Micronation')
on conflict(slug) do nothing;
