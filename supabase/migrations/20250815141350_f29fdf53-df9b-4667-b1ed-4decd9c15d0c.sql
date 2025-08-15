-- Add policy to allow anonymous users to read patients table
-- This is required for foreign key constraints to work when anonymous users insert into intake_forms
CREATE POLICY "Allow anonymous to read patients for foreign key validation" 
ON public.patients 
FOR SELECT 
USING (true);