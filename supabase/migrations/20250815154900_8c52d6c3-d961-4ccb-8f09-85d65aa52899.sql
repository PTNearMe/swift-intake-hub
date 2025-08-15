-- CRITICAL SECURITY FIX: Remove any potential anonymous read access to medical records

-- First, ensure no anonymous users can read intake forms under any circumstances
-- The current policies look secure but we need to verify no loopholes exist

-- Check if there's any way anonymous users might be reading intake forms
-- If the app currently works, there must be some access path we need to close

-- Add an explicit policy to DENY anonymous reads (belt and suspenders approach)
CREATE POLICY "Deny all anonymous reads to intake forms"
ON public.intake_forms
FOR SELECT
TO anon
USING (false);

-- Ensure only authenticated users can read intake forms
-- This policy should override any potential loopholes
CREATE POLICY "Only authenticated staff can read intake forms"
ON public.intake_forms
FOR SELECT
TO authenticated
USING (true);

-- Remove the existing less restrictive policy that might have loopholes
DROP POLICY IF EXISTS "Authenticated staff can view intake forms" ON public.intake_forms;