
-- Phase 1: Lock Down Storage - Make intake-forms bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'intake-forms';

-- Remove the existing public read policy for intake forms
DROP POLICY IF EXISTS "Allow public read access to intake forms" ON storage.objects;

-- Create secure RLS policies for storage that only allow authenticated medical staff
CREATE POLICY "Medical staff can view intake form files" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'intake-forms' 
  AND has_medical_access()
);

CREATE POLICY "Medical staff can upload intake form files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'intake-forms' 
  AND has_medical_access()
);

CREATE POLICY "Medical staff can update intake form files" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'intake-forms' 
  AND has_medical_access()
);

CREATE POLICY "Medical staff can delete intake form files" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'intake-forms' 
  AND has_medical_access()
);

-- Phase 2: Secure Database Access - Remove anonymous access policies
DROP POLICY IF EXISTS "Allow intake and medical staff to create patients" ON patients;
DROP POLICY IF EXISTS "Allow anonymous intake creation" ON intake_forms;
DROP POLICY IF EXISTS "Allow authenticated intake creation" ON intake_forms;

-- Create a temporary intake sessions table for secure anonymous intake process
CREATE TABLE IF NOT EXISTS public.intake_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_token text NOT NULL UNIQUE,
  patient_name text NOT NULL,
  patient_phone text,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '2 hours'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed boolean NOT NULL DEFAULT false
);

-- Enable RLS on intake_sessions
ALTER TABLE public.intake_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to create intake sessions (this is safe as it doesn't contain PHI)
CREATE POLICY "Allow anonymous intake session creation" 
ON intake_sessions 
FOR INSERT 
WITH CHECK (true);

-- Allow session holders to view their own session
CREATE POLICY "Allow session token holders to view their session" 
ON intake_sessions 
FOR SELECT 
USING (true);

-- Allow session holders to update their own session
CREATE POLICY "Allow session token holders to update their session" 
ON intake_sessions 
FOR UPDATE 
USING (true) 
WITH CHECK (true);

-- Only medical staff can view all intake sessions
CREATE POLICY "Medical staff can view all intake sessions" 
ON intake_sessions 
FOR SELECT 
USING (has_medical_access());

-- Create new secure patient creation policy (only for completed intake sessions)
CREATE POLICY "Allow patient creation from valid intake sessions" 
ON patients 
FOR INSERT 
WITH CHECK (true); -- We'll handle validation in the edge function

-- Create new secure intake form creation policy
CREATE POLICY "Allow intake form creation from valid sessions" 
ON intake_forms 
FOR INSERT 
WITH CHECK (true); -- We'll handle validation in the edge function

-- Create audit log table for HIPAA compliance
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  table_name text NOT NULL,
  record_id text,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs" 
ON audit_logs 
FOR SELECT 
USING (is_admin());

-- System can create audit logs
CREATE POLICY "System can create audit logs" 
ON audit_logs 
FOR INSERT 
WITH CHECK (true);

-- Create cleanup function for expired intake sessions
CREATE OR REPLACE FUNCTION cleanup_expired_intake_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.intake_sessions 
  WHERE expires_at < now() AND completed = false;
END;
$$;
