-- Ensure the intake-forms storage bucket exists and is properly configured
INSERT INTO storage.buckets (id, name, public)
VALUES ('intake-forms', 'intake-forms', false)
ON CONFLICT (id) DO NOTHING;

-- Create proper RLS policies for the intake-forms bucket
CREATE POLICY "Medical staff can view intake form PDFs" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'intake-forms' AND (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'medical_staff', 'receptionist')
  )
));

CREATE POLICY "System can upload intake form PDFs" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'intake-forms' AND auth.role() = 'service_role');

CREATE POLICY "System can update intake form PDFs" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'intake-forms' AND auth.role() = 'service_role');

CREATE POLICY "System can delete intake form PDFs" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'intake-forms' AND auth.role() = 'service_role');