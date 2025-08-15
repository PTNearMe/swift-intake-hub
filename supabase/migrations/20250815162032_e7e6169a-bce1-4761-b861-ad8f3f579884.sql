-- Fix intake_forms RLS policy to allow anonymous users
-- Drop the current policy that targets the wrong role
DROP POLICY IF EXISTS "Allow intake creation" ON public.intake_forms;

-- Create new policy that allows anonymous users (anon role) to insert intake forms
CREATE POLICY "Allow anonymous intake creation" 
ON public.intake_forms 
FOR INSERT 
TO anon
WITH CHECK (true);

-- Also allow authenticated users to insert (for medical staff)
CREATE POLICY "Allow authenticated intake creation" 
ON public.intake_forms 
FOR INSERT 
TO authenticated  
WITH CHECK (true);