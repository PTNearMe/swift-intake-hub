-- Fix conflicting INSERT policies on patients table
-- Drop existing conflicting INSERT policies
DROP POLICY IF EXISTS "Allow public to create patients" ON public.patients;
DROP POLICY IF EXISTS "Only medical staff can create patients" ON public.patients;

-- Create a single permissive INSERT policy that allows both anonymous and medical staff
CREATE POLICY "Allow intake and medical staff to create patients" 
ON public.patients 
FOR INSERT 
WITH CHECK (true);

-- Also fix intake_forms policies to ensure the flow works end-to-end
-- The current "Anonymous can create intake forms" policy should work, but let's verify
-- by recreating it cleanly
DROP POLICY IF EXISTS "Anonymous can create intake forms" ON public.intake_forms;

CREATE POLICY "Allow intake creation" 
ON public.intake_forms 
FOR INSERT 
WITH CHECK (true);