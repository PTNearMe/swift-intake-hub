-- Create patients table
CREATE TABLE public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create intake_forms table
CREATE TABLE public.intake_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    form_data JSONB,
    signed_at TIMESTAMP WITH TIME ZONE,
    fax_sent BOOLEAN DEFAULT false,
    email_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_forms ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for authenticated staff access
-- Patients policies
CREATE POLICY "Authenticated staff can view all patients"
ON public.patients FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated staff can create patients"
ON public.patients FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated staff can update patients"
ON public.patients FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated staff can delete patients"
ON public.patients FOR DELETE
TO authenticated
USING (true);

-- Intake forms policies
CREATE POLICY "Authenticated staff can view all intake forms"
ON public.intake_forms FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated staff can create intake forms"
ON public.intake_forms FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated staff can update intake forms"
ON public.intake_forms FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated staff can delete intake forms"
ON public.intake_forms FOR DELETE
TO authenticated
USING (true);

-- Add index for better foreign key performance
CREATE INDEX idx_intake_forms_patient_id ON public.intake_forms(patient_id);