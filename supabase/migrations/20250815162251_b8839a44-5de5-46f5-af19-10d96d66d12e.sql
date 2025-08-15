-- Ensure INSERT policies on intake_forms allow RETURNING without broad SELECT
DROP POLICY IF EXISTS "Allow anonymous intake creation" ON public.intake_forms;
DROP POLICY IF EXISTS "Allow authenticated intake creation" ON public.intake_forms;

CREATE POLICY "Allow anonymous intake creation"
ON public.intake_forms
FOR INSERT
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated intake creation"
ON public.intake_forms
FOR INSERT
TO authenticated
USING (true)
WITH CHECK (true);
