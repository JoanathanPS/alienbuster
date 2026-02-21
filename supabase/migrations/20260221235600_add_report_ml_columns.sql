-- Add ML output columns so we don't have to parse from notes
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS species text,
  ADD COLUMN IF NOT EXISTS confidence float8,
  ADD COLUMN IF NOT EXISTS is_invasive boolean;

-- Optional index for filtering hotspots later
CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports (status);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON public.reports (created_at DESC);
