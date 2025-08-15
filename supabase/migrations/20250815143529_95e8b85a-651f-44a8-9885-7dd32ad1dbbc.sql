-- Create intake-forms storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('intake-forms', 'intake-forms', true);

-- Create storage policies for intake forms
CREATE POLICY "Allow public read access to intake forms" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'intake-forms');

CREATE POLICY "Allow authenticated users to upload intake forms" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'intake-forms');

CREATE POLICY "Allow authenticated users to update intake forms" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'intake-forms');

CREATE POLICY "Allow authenticated users to delete intake forms" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'intake-forms');

-- Add PDF-related fields to intake_forms table
ALTER TABLE public.intake_forms 
ADD COLUMN pdf_url TEXT,
ADD COLUMN pdf_generated_at TIMESTAMP WITH TIME ZONE;