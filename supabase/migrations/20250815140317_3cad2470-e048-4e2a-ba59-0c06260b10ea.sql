-- Create email_logs table for tracking email sending attempts
CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  intake_form_id UUID NOT NULL REFERENCES public.intake_forms(id) ON DELETE CASCADE,
  error_message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for email_logs
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for email_logs (only authenticated staff can access)
CREATE POLICY "Authenticated staff can view email logs" 
ON public.email_logs 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated staff can create email logs" 
ON public.email_logs 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Add index for faster lookups
CREATE INDEX idx_email_logs_intake_form_id ON public.email_logs(intake_form_id);
CREATE INDEX idx_email_logs_created_at ON public.email_logs(created_at);