import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { patientId } = await req.json();

    if (!patientId) {
      return new Response(
        JSON.stringify({ error: 'Patient ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role key for database updates
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Tracking doxy redirect for patient:', patientId);

    // Find the most recent intake form for this patient
    const { data: intakeForm, error: findError } = await supabase
      .from('intake_forms')
      .select('id')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) {
      console.error('Error finding intake form:', findError);
      throw new Error(`Failed to find intake form: ${findError.message}`);
    }

    if (!intakeForm) {
      console.error('No intake form found for patient:', patientId);
      throw new Error('No intake form found for this patient');
    }

    // Update the intake form with doxy redirect timestamp
    const { error: updateError } = await supabase
      .from('intake_forms')
      .update({ 
        doxy_redirect_at: new Date().toISOString()
      })
      .eq('id', intakeForm.id);

    if (updateError) {
      console.error('Error updating doxy redirect timestamp:', updateError);
      throw new Error(`Failed to update redirect tracking: ${updateError.message}`);
    }

    console.log('Successfully tracked doxy redirect for intake form:', intakeForm.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Doxy redirect tracked successfully',
        intakeFormId: intakeForm.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in track-doxy-redirect function:', error);
    
    return new Response(
      JSON.stringify({ error: `Failed to track redirect: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);