-- Add unique constraint on patient_id to prevent duplicate intake forms
-- This ensures each patient can only have one intake form for security and data integrity
ALTER TABLE public.intake_forms 
ADD CONSTRAINT unique_patient_intake_form 
UNIQUE (patient_id);