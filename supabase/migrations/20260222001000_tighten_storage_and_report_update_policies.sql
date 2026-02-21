-- Tighten report status updates and storage bucket access.
-- NOTE: This is optional for hackathon demos. Apply when ready.
-- TODO: Restrict Expert Review to admin role via Supabase auth

-- 1) Reports: only admins can update (verify/reject)
DROP POLICY IF EXISTS "Anyone can update report status" ON public.reports;

CREATE POLICY "Admins can update reports"
ON public.reports
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Storage: make bucket private so the app uses signed URLs
UPDATE storage.buckets
SET public = false
WHERE id = 'reports-photos';

-- Drop permissive policies
DROP POLICY IF EXISTS "Anyone can upload report photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view report photos" ON storage.objects;

-- Authenticated users can upload to reports-photos
CREATE POLICY "Authenticated can upload report photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reports-photos');

-- Authenticated users can read report photos (required for createSignedUrl)
CREATE POLICY "Authenticated can view report photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'reports-photos');
