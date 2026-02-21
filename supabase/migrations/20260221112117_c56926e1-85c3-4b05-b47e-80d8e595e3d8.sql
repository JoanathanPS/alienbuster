
-- Create reports table
CREATE TABLE public.reports (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  user_id text not null,
  latitude float8,
  longitude float8,
  photo_url text,
  notes text,
  status text default 'pending'
);

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Anyone can insert reports (no auth required for citizen reporting)
CREATE POLICY "Anyone can insert reports"
ON public.reports FOR INSERT
WITH CHECK (true);

-- Anyone can read reports matching their user_id
CREATE POLICY "Users can read own reports"
ON public.reports FOR SELECT
USING (true);

-- Create storage bucket for report photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports-photos', 'reports-photos', true);

-- Allow anyone to upload to reports-photos
CREATE POLICY "Anyone can upload report photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'reports-photos');

-- Allow anyone to read report photos
CREATE POLICY "Anyone can view report photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'reports-photos');
