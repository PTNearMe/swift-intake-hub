-- Add policy to allow public (unauthenticated) users to create patient records
-- This is needed for the intake form where patients enter their information
-- before any authentication takes place
CREATE POLICY "Allow public to create patients" 
ON public.patients 
FOR INSERT 
TO anon 
WITH CHECK (true);

-- Also update the intake_forms table to allow public inserts
-- since patients need to submit their completed forms
CREATE POLICY "Allow public to create intake forms" 
ON public.intake_forms 
FOR INSERT 
TO anon 
WITH CHECK (true);