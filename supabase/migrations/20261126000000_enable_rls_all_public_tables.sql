-- Fix Supabase security advisor "rls_disabled_in_public" (Table publicly accessible).
--
-- 0001_init.sql created several tables without enabling RLS
-- (validations, experts, reporters, species_verifications, confusion_cases,
--  feedback, outbreaks, tasks). Any table in `public` without RLS is fully
-- readable/writable/deletable by anyone holding the public anon key.
--
-- Strategy: deny-by-default.
--   * Enable RLS on EVERY table in `public` (idempotent, covers tables that
--     only exist in some environments).
--   * The FastAPI backend uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS,
--     so backend reads/writes keep working with zero policies.
--   * Add only the policies the browser client actually needs.

do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')       -- ordinary + partitioned tables
      and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', t.relname);
    raise notice 'Enabled RLS on public.%', t.relname;
  end loop;
end$$;

-- Frontend (src/pages/Index.tsx) counts outbreaks directly via supabase-js.
-- Allow signed-in users to read outbreaks; writes stay backend-only.
do $$
begin
  if to_regclass('public.outbreaks') is not null
     and not exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'outbreaks'
         and policyname = 'Authenticated users can read outbreaks'
     ) then
    create policy "Authenticated users can read outbreaks"
      on public.outbreaks
      for select
      to authenticated
      using (true);
  end if;
end$$;
