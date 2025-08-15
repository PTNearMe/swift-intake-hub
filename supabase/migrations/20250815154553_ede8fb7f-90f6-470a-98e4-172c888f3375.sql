-- Remove the dangerous anonymous read policy that exposes patient data
DROP POLICY IF EXISTS "Allow anonymous to read patients for foreign key validation" ON public.patients;

-- Verify that the remaining policies are secure:
-- "Allow public to create patients" - This is needed for intake workflow
-- "Authenticated staff can *" policies - These are secure and necessary

-- The foreign key constraint will still work without the anonymous read policy
-- because PostgreSQL handles foreign key validation internally