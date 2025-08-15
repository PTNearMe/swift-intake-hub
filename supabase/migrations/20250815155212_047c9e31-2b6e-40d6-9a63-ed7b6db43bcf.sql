-- Update patients table RLS policies for strict medical staff access

-- Remove the overly permissive policy
DROP POLICY IF EXISTS "Authenticated staff can view all patients" ON public.patients;
DROP POLICY IF EXISTS "Authenticated staff can create patients" ON public.patients;
DROP POLICY IF EXISTS "Authenticated staff can update patients" ON public.patients; 
DROP POLICY IF EXISTS "Authenticated staff can delete patients" ON public.patients;

-- Create secure role-based policies for patients table
CREATE POLICY "Only medical staff can view patients"
ON public.patients
FOR SELECT
TO authenticated
USING (public.has_medical_access());

CREATE POLICY "Only medical staff can create patients"
ON public.patients
FOR INSERT
TO authenticated
WITH CHECK (public.has_medical_access());

CREATE POLICY "Only medical staff can update patients"
ON public.patients
FOR UPDATE
TO authenticated
USING (public.has_medical_access())
WITH CHECK (public.has_medical_access());

CREATE POLICY "Only admins can delete patients"
ON public.patients
FOR DELETE
TO authenticated
USING (public.is_admin());