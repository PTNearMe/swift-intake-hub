-- Create a SECURITY DEFINER function to insert/upsert an intake form and return its id
CREATE OR REPLACE FUNCTION public.create_intake_form(
  _patient_id uuid,
  _form_data jsonb,
  _signed_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO public.intake_forms (patient_id, form_data, signed_at, fax_sent, email_sent)
  VALUES (_patient_id, _form_data, COALESCE(_signed_at, now()), false, false)
  ON CONFLICT (patient_id) DO UPDATE
    SET form_data = EXCLUDED.form_data,
        signed_at = EXCLUDED.signed_at,
        fax_sent = false,
        email_sent = false
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- Restrict execution to anon and authenticated roles
REVOKE ALL ON FUNCTION public.create_intake_form(uuid, jsonb, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_intake_form(uuid, jsonb, timestamptz) TO anon, authenticated;