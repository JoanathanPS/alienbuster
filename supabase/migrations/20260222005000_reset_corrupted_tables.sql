-- Alien Buster: RESET corrupted Supabase schema
-- WARNING: This DROPS public.reports + public.user_roles (data loss).
-- Apply only if your tables/policies are corrupted and you want a clean rebuild.

-- Needed for gen_random_uuid()
create extension if not exists "pgcrypto";

-- -----------------------------
-- Drop existing policies (safe)
-- -----------------------------
drop policy if exists "Anyone can read reports" on public.reports;
drop policy if exists "Authenticated users can read reports" on public.reports;
drop policy if exists "Users can read own reports" on public.reports;

drop policy if exists "Anyone can insert reports" on public.reports;
drop policy if exists "Authenticated users can insert reports" on public.reports;

drop policy if exists "Anyone can update report status" on public.reports;
drop policy if exists "Experts can update report status" on public.reports;
drop policy if exists "Admins can update reports" on public.reports;

drop policy if exists "Users can read own roles" on public.user_roles;

drop policy if exists "Anyone can upload report photos" on storage.objects;
drop policy if exists "Anyone can view report photos" on storage.objects;
drop policy if exists "Authenticated can upload report photos" on storage.objects;
drop policy if exists "Authenticated can view report photos" on storage.objects;

drop policy if exists "Authenticated can upload report photos" on storage.objects;
drop policy if exists "Authenticated can view report photos" on storage.objects;

-- -----------------------------
-- Drop corrupted tables
-- -----------------------------
drop table if exists public.reports cascade;
drop table if exists public.user_roles cascade;

-- -----------------------------
-- Roles type (create if missing)
-- -----------------------------
do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'app_role'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.app_role as enum ('admin', 'user');
  end if;
end$$;

-- -----------------------------
-- Recreate reports table
-- -----------------------------
create table public.reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),

  -- Supabase auth user id
  user_id uuid not null,

  reporter_nickname text null,
  user_email text null,

  latitude double precision null,
  longitude double precision null,

  -- Storage object path in bucket `reports-photos`
  photo_url text null,

  -- optional citizen description
  notes text null,

  status text not null default 'pending',

  -- ML outputs (backend later; frontend does NOT implement ML)
  species text null,
  confidence double precision null,
  is_invasive boolean null,

  constraint reports_status_check check (status in ('pending', 'verified', 'rejected'))
);

create index if not exists reports_status_idx on public.reports (status);
create index if not exists reports_created_at_idx on public.reports (created_at desc);
create index if not exists reports_user_id_idx on public.reports (user_id);

-- -----------------------------
-- Recreate user_roles + helper
-- -----------------------------
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create policy "Users can read own roles"
on public.user_roles
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- -----------------------------
-- Reports RLS
-- -----------------------------
alter table public.reports enable row level security;

-- Hotspots needs to read all reports. Routes are protected in the app.
create policy "Authenticated users can read reports"
on public.reports
for select
to authenticated
using (true);

-- Submit must be authenticated and can only insert their own user_id
create policy "Authenticated users can insert reports"
on public.reports
for insert
to authenticated
with check (auth.uid() = user_id);

-- Expert Review: allowlist emails can update (verify/reject)
-- IMPORTANT: Edit this list to your real expert accounts.
create policy "Experts can update report status"
on public.reports
for update
to authenticated
using (
  (auth.jwt() ->> 'email') = any (
    array[
      'expert@alienbuster.test',
      'joanathanps2006@gmail.com',
      'mrmousingh1@gmail.com'
    ]
  )
)
with check (
  (auth.jwt() ->> 'email') = any (
    array[
      'expert@alienbuster.test',
      'joanathanps2006@gmail.com',
      'mrmousingh1@gmail.com'
    ]
  )
);

-- -----------------------------
-- Storage bucket + policies
-- -----------------------------
-- Private bucket; app uses createSignedUrl() for display.
insert into storage.buckets (id, name, public)
values ('reports-photos', 'reports-photos', false)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

-- Allow authenticated upload
create policy "Authenticated can upload report photos"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'reports-photos');

-- Allow authenticated read (required for signed URLs)
create policy "Authenticated can view report photos"
on storage.objects
for select
to authenticated
using (bucket_id = 'reports-photos');
