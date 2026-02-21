CREATE POLICY "Anyone can update report status"
ON public.reports
FOR UPDATE
USING (true)
WITH CHECK (true);