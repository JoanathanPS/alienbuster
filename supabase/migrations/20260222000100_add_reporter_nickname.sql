ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS reporter_nickname text;
