-- Fix RLS policies on intake_forms table
-- Drop existing restrictive INSERT policies that are causing conflicts
DROP POLICY IF EXISTS "Allow public to create intake forms" ON public.intake_forms;
DROP POLICY IF EXISTS "Authenticated staff can create intake forms" ON public.intake_forms;

-- Recreate policies as PERMISSIVE so either condition can allow access
CREATE POLICY "Allow public to create intake forms" 
ON public.intake_forms 
FOR INSERT 
AS PERMISSIVE
WITH CHECK (true);

CREATE POLICY "Authenticated staff can create intake forms" 
ON public.intake_forms 
FOR INSERT 
AS PERMISSIVE
WITH CHECK (auth.role() = 'authenticated');

-- Also make the SELECT policies permissive for consistency
DROP POLICY IF EXISTS "Authenticated staff can view all intake forms" ON public.intake_forms;
CREATE POLICY "Authenticated staff can view all intake forms" 
ON public.intake_forms 
FOR SELECT 
AS PERMISSIVE
USING (auth.role() = 'authenticated');