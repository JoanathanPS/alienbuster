
-- 1. Add user_email column to reports
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS user_email text;

-- 2. Create role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own roles
CREATE POLICY "Users can read own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3. Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. Update reports RLS policies for authenticated users
DROP POLICY IF EXISTS "Users can read own reports" ON public.reports;
DROP POLICY IF EXISTS "Anyone can read reports" ON public.reports;
CREATE POLICY "Anyone can read reports"
ON public.reports FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Anyone can insert reports" ON public.reports;
CREATE POLICY "Authenticated users can insert reports"
ON public.reports FOR INSERT
TO authenticated
WITH CHECK (true);
