-- Update intake_forms table RLS policies for consistent role-based access

-- Remove existing policies
DROP POLICY IF EXISTS "Only authenticated staff can read intake forms" ON public.intake_forms;
DROP POLICY IF EXISTS "Authenticated staff can update intake forms" ON public.intake_forms;
DROP POLICY IF EXISTS "Authenticated staff can delete intake forms" ON public.intake_forms;

-- Create secure role-based policies for intake_forms table
CREATE POLICY "Only medical staff can view intake forms"
ON public.intake_forms
FOR SELECT
TO authenticated
USING (public.has_medical_access());

CREATE POLICY "Only medical staff can update intake forms"
ON public.intake_forms
FOR UPDATE
TO authenticated
USING (public.has_medical_access())
WITH CHECK (public.has_medical_access());

CREATE POLICY "Only admins can delete intake forms"
ON public.intake_forms
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Create function to bootstrap first admin user (for initial setup)
CREATE OR REPLACE FUNCTION public.create_admin_user(user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_user_id uuid;
BEGIN
    -- Find user by email
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = user_email;
    
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % not found', user_email;
    END IF;
    
    -- Insert admin role (will fail if user already has a role due to unique constraint)
    INSERT INTO public.user_roles (user_id, role, granted_by)
    VALUES (target_user_id, 'admin', target_user_id)
    ON CONFLICT (user_id) DO NOTHING;
END;
$$;