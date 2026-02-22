-- Fix reports RLS after tightening security.
-- Removes insecure public UPDATE policy and replaces it with an expert-email allowlist.
-- NOTE: This is a pragmatic hackathon-friendly approach. Prefer roles (user_roles + has_role) long-term.

-- Step 1: Delete bad / legacy update policies
DROP POLICY IF EXISTS "Anyone can update report status" ON public.reports;
DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;

-- Step 2: Add secure expert-only update policy
-- We use auth.jwt() to read the email from the JWT claims.
-- (This is more portable than relying on auth.email(), which may not exist in all projects.)
CREATE POLICY "Experts can update report status"
ON public.reports
FOR UPDATE
TO authenticated
USING (
  (auth.jwt() ->> 'email') = ANY (
    ARRAY['expert@alienbuster.test', 'joanathanps2006@gmail.com', 'mrmousingh1@gmail.com']
  )
)
WITH CHECK (
  (auth.jwt() ->> 'email') = ANY (
    ARRAY['expert@alienbuster.test', 'joanathanps2006@gmail.com', 'mrmousingh1@gmail.com']
  )
);

-- Step 3: Ensure insert is authenticated-only
DROP POLICY IF EXISTS "Anyone can insert reports" ON public.reports;
DROP POLICY IF EXISTS "Authenticated users can insert reports" ON public.reports;

CREATE POLICY "Authenticated users can insert reports"
ON public.reports
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Step 4: Keep public read (for hotspots)
DROP POLICY IF EXISTS "Users can read own reports" ON public.reports;
DROP POLICY IF EXISTS "Anyone can read reports" ON public.reports;

CREATE POLICY "Anyone can read reports"
ON public.reports
FOR SELECT
USING (true);
