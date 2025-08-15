-- Add column to track doxy redirect success
ALTER TABLE public.intake_forms 
ADD COLUMN doxy_redirect_at timestamp with time zone;