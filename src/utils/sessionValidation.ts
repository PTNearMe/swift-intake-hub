
import { supabase } from "@/integrations/supabase/client";

export interface IntakeSession {
  id: string;
  session_token: string;
  patient_name: string;
  patient_phone: string | null;
  expires_at: string;
  created_at: string;
  completed: boolean;
}

export async function validateSession(sessionToken: string): Promise<IntakeSession | null> {
  try {
    const { data, error } = await supabase
      .from('intake_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .eq('completed', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.error('Error validating session:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Unexpected error validating session:', error);
    return null;
  }
}

export async function completeSession(sessionToken: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('intake_sessions')
      .update({ completed: true })
      .eq('session_token', sessionToken);

    if (error) {
      console.error('Error completing session:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Unexpected error completing session:', error);
    return false;
  }
}

export async function createPatientFromSession(sessionToken: string): Promise<string | null> {
  try {
    // First validate the session
    const session = await validateSession(sessionToken);
    if (!session) {
      return null;
    }

    // Create the patient record
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .insert([
        {
          name: session.patient_name,
          phone: session.patient_phone,
        }
      ])
      .select('id')
      .single();

    if (patientError) {
      console.error('Error creating patient:', patientError);
      return null;
    }

    // Mark session as completed
    await completeSession(sessionToken);

    return patient.id;
  } catch (error) {
    console.error('Unexpected error creating patient from session:', error);
    return null;
  }
}
