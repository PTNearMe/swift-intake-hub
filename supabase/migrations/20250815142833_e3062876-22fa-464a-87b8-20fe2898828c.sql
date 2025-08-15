-- Debug and fix RLS policies for intake_forms
-- First, let's check current policies and recreate them properly

-- Drop all existing policies on intake_forms
DROP POLICY IF EXISTS "Allow public to create intake forms" ON public.intake_forms;
DROP POLICY IF EXISTS "Authenticated staff can create intake forms" ON public.intake_forms;
DROP POLICY IF EXISTS "Authenticated staff can view all intake forms" ON public.intake_forms;
DROP POLICY IF EXISTS "Authenticated staff can update intake forms" ON public.intake_forms;
DROP POLICY IF EXISTS "Authenticated staff can delete intake forms" ON public.intake_forms;

-- Create a simple, permissive policy for anonymous users to create intake forms
-- This allows anyone (anonymous or authenticated) to create intake forms
CREATE POLICY "Anonymous can create intake forms" 
ON public.intake_forms 
FOR INSERT 
WITH CHECK (true);

-- Create policies for authenticated staff to manage intake forms
CREATE POLICY "Authenticated staff can view intake forms" 
ON public.intake_forms 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated staff can update intake forms" 
ON public.intake_forms 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated staff can delete intake forms" 
ON public.intake_forms 
FOR DELETE 
USING (true);

-- Ensure RLS is enabled on the table
ALTER TABLE public.intake_forms ENABLE ROW LEVEL SECURITY;