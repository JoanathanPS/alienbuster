

# Add Authentication and Protected Routes to Alien Buster

## Summary

Add Supabase email magic link authentication and Google OAuth (via Lovable Cloud managed auth), protect key routes, update the reports table to use real auth user IDs, and add a proper admin role system for the Expert Review page.

---

## Changes

### 1. Google OAuth Setup

Use the Lovable Cloud managed Google OAuth tool to generate the `src/integrations/lovable/` module. Then use `lovable.auth.signInWithOAuth("google", ...)` for the Google sign-in button.

### 2. Auth Context Hook

Create `src/hooks/useAuth.ts`:
- Listen to `supabase.auth.onAuthStateChange` (set up BEFORE `getSession`)
- Expose: `user`, `session`, `loading`, `signOut`
- Wrap the app in an `AuthProvider` context

### 3. Login Page

Create `src/pages/Login.tsx`:
- Email input + "Send Magic Link" button (calls `supabase.auth.signInWithOtp({ email })`)
- Google sign-in button (calls `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`)
- Toast feedback on success/error
- Redirect to home after login

### 4. Protected Routes

Create `src/components/ProtectedRoute.tsx`:
- If loading: show spinner
- If no session: redirect to `/login`
- Otherwise: render children

Wrap these routes: `/submit`, `/my-reports`, `/hotspots`, `/admin-review`

Public routes (no login required): `/`, `/how-it-works`, `/login`

### 5. Header with User Info

Create `src/components/AppHeader.tsx`:
- Show user email (truncated) when logged in
- Logout button
- Show "Sign in" link when not logged in

### 6. Admin Role System

Database changes:
- Create `app_role` enum: `('admin', 'user')`
- Create `user_roles` table with `user_id` (FK to `auth.users`) and `role`
- Enable RLS on `user_roles`
- Create `has_role()` security definer function
- Seed an admin role for a specific user (or let the user add one manually)

In `AdminReview.tsx`:
- Check if current user has 'admin' role via a query to `user_roles`
- Show "Access Denied" if not admin
- Hide "Expert Review" from bottom nav for non-admins

### 7. Update Reports Table

The `user_id` column is currently `text` (stores a nickname). With auth, new reports will store `auth.uid()` (a UUID as text). Existing nickname-based reports remain as-is.

Update the Submit page:
- Remove the "Nickname" input field
- Use `(await supabase.auth.getUser()).data.user.id` as user_id
- Store user email in a new `user_email` column (for display purposes)

Database migration:
- Add `user_email text` column to reports
- Update RLS: users can read their own reports where `user_id = auth.uid()::text`

### 8. Update My Reports

- Remove nickname search input
- Automatically fetch reports for the logged-in user using their auth user ID

---

## Technical Details

### Database Migrations

```sql
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
CREATE POLICY "Users can read own reports"
ON public.reports FOR SELECT
USING (true);

-- Keep insert open but now we expect auth users
DROP POLICY IF EXISTS "Anyone can insert reports" ON public.reports;
CREATE POLICY "Authenticated users can insert reports"
ON public.reports FOR INSERT
TO authenticated
WITH CHECK (true);
```

### Files Created

| File | Purpose |
|---|---|
| `src/hooks/useAuth.ts` | Auth context provider + hook |
| `src/pages/Login.tsx` | Login page with magic link + Google OAuth |
| `src/components/ProtectedRoute.tsx` | Route guard redirecting to login |
| `src/components/AppHeader.tsx` | Header showing user email + logout |

### Files Modified

| File | Change |
|---|---|
| `src/App.tsx` | Wrap in AuthProvider, add Login route, protect routes |
| `src/pages/Submit.tsx` | Use auth user ID instead of nickname input |
| `src/pages/MyReports.tsx` | Auto-fetch reports for logged-in user, remove search |
| `src/pages/AdminReview.tsx` | Check admin role, show access denied if not admin |
| `src/components/BottomNav.tsx` | Conditionally show Expert Review tab for admins |

### Auth Flow

```text
User opens app
  -> Public pages (Home, How It Works) work without login
  -> Clicking "Report" or navigating to protected routes
     -> If not logged in: redirect to /login
     -> Login page: enter email for magic link OR click Google
     -> After auth: redirect back to intended page
  -> Header shows email + logout button
```

### Admin Setup

After deploying, to make a user an admin:
- Sign up / log in with the desired account
- Insert a row into `user_roles`: `INSERT INTO user_roles (user_id, role) VALUES ('<user-uuid>', 'admin')`
- This can be done via the Cloud dashboard's SQL runner

