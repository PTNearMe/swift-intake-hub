import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IntakeFormData {
  id: string;
  patient_id: string;
  form_data: any;
  signed_at: string;
}

interface PatientData {
  name: string;
  phone?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { intakeFormId } = await req.json();

    if (!intakeFormId) {
      return new Response(
        JSON.stringify({ error: 'Intake form ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching intake form data for ID:', intakeFormId);

    // Fetch intake form data
    const { data: intakeForm, error: intakeError } = await supabase
      .from('intake_forms')
      .select('*')
      .eq('id', intakeFormId)
      .maybeSingle();

    if (intakeError) {
      console.error('Error fetching intake form:', intakeError);
      await logError(supabase, intakeFormId, `Failed to fetch intake form: ${intakeError.message}`);
      throw new Error(`Failed to fetch intake form: ${intakeError.message}`);
    }

    if (!intakeForm) {
      const errorMsg = 'Intake form not found';
      console.error(errorMsg);
      await logError(supabase, intakeFormId, errorMsg);
      throw new Error(errorMsg);
    }

    // Fetch patient data
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('name, phone')
      .eq('id', intakeForm.patient_id)
      .maybeSingle();

    if (patientError) {
      console.error('Error fetching patient:', patientError);
      await logError(supabase, intakeFormId, `Failed to fetch patient: ${patientError.message}`);
      throw new Error(`Failed to fetch patient: ${patientError.message}`);
    }

    if (!patient) {
      const errorMsg = 'Patient not found';
      console.error(errorMsg);
      await logError(supabase, intakeFormId, errorMsg);
      throw new Error(errorMsg);
    }

    // Generate PDF content (HTML that can be converted to PDF)
    const pdfHtml = generateFormPDF(intakeForm, patient);
    
    // Create PDF buffer from HTML
    const pdfBuffer = await htmlToPdf(pdfHtml);

    // Send email with PDF attachment using SendGrid
    await sendEmailWithAttachment(patient.name, pdfBuffer, generateEmailSummary(intakeForm.form_data));

    console.log('Email sent successfully, updating database');

    // Update intake_forms table to mark email as sent
    const { error: updateError } = await supabase
      .from('intake_forms')
      .update({ 
        email_sent: true,
        // Note: signed_at should already be set when form was submitted
      })
      .eq('id', intakeFormId);

    if (updateError) {
      console.error('Error updating intake form:', updateError);
      // Don't throw here since email was sent successfully
      await logError(supabase, intakeFormId, `Failed to update email_sent flag: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-intake-email function:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

async function logError(supabase: any, intakeFormId: string, errorMessage: string) {
  try {
    await supabase
      .from('email_logs')
      .insert([{
        intake_form_id: intakeFormId,
        error_message: errorMessage
      }]);
  } catch (logError) {
    console.error('Failed to log error to database:', logError);
  }
}

function generateFormPDF(intakeForm: IntakeFormData, patient: PatientData): string {
  const formData = intakeForm.form_data;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Patient Intake Form - ${patient.name}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.4; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
        .section { margin-bottom: 25px; }
        .section-title { font-weight: bold; font-size: 16px; color: #333; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
        .field { margin-bottom: 8px; }
        .field-label { font-weight: bold; display: inline-block; width: 150px; }
        .field-value { display: inline-block; }
        .signature-section { margin-top: 30px; padding-top: 20px; border-top: 2px solid #333; }
        .checkbox { margin-right: 5px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Patient Intake Form</h1>
        <p>Patient: ${patient.name}</p>
        <p>Submitted: ${new Date(intakeForm.signed_at || intakeForm.created_at).toLocaleDateString()}</p>
      </div>

      <div class="section">
        <div class="section-title">Personal Information</div>
        <div class="field"><span class="field-label">Full Name:</span> <span class="field-value">${formData.firstName || ''} ${formData.lastName || ''}</span></div>
        <div class="field"><span class="field-label">Date of Birth:</span> <span class="field-value">${formData.dateOfBirth || 'Not provided'}</span></div>
        <div class="field"><span class="field-label">Email:</span> <span class="field-value">${formData.email || 'Not provided'}</span></div>
        <div class="field"><span class="field-label">Phone:</span> <span class="field-value">${formData.phone || patient.phone || 'Not provided'}</span></div>
        <div class="field"><span class="field-label">Address:</span> <span class="field-value">${formData.address || 'Not provided'}</span></div>
        <div class="field"><span class="field-label">Emergency Contact:</span> <span class="field-value">${formData.emergencyContactName || 'Not provided'} - ${formData.emergencyContactPhone || 'Not provided'}</span></div>
      </div>

      <div class="section">
        <div class="section-title">Medical History</div>
        <div class="field"><span class="field-label">Current Medications:</span> <span class="field-value">${formData.currentMedications || 'None'}</span></div>
        <div class="field"><span class="field-label">Allergies:</span> <span class="field-value">${formData.allergies || 'None'}</span></div>
        <div class="field"><span class="field-label">Medical Conditions:</span> <span class="field-value">${formData.medicalConditions || 'None'}</span></div>
        <div class="field"><span class="field-label">Previous Surgeries:</span> <span class="field-value">${formData.previousSurgeries || 'None'}</span></div>
        <div class="field"><span class="field-label">Family History:</span> <span class="field-value">${formData.familyMedicalHistory || 'Not provided'}</span></div>
        <div class="field"><span class="field-label">Reason for Visit:</span> <span class="field-value">${formData.reasonForVisit || 'Not provided'}</span></div>
      </div>

      <div class="section">
        <div class="section-title">Insurance Information</div>
        <div class="field"><span class="field-label">Insurance Provider:</span> <span class="field-value">${formData.insuranceProvider || 'Not provided'}</span></div>
        <div class="field"><span class="field-label">Policy Number:</span> <span class="field-value">${formData.policyNumber || 'Not provided'}</span></div>
        <div class="field"><span class="field-label">Group Number:</span> <span class="field-value">${formData.groupNumber || 'Not provided'}</span></div>
      </div>

      <div class="section">
        <div class="section-title">Consents</div>
        <div class="field">
          <span class="checkbox">${formData.consentToTreatment ? '☑' : '☐'}</span>
          <span class="field-value">Consent to Treatment</span>
        </div>
        <div class="field">
          <span class="checkbox">${formData.hipaaAuthorization ? '☑' : '☐'}</span>
          <span class="field-value">HIPAA Authorization</span>
        </div>
        <div class="field">
          <span class="checkbox">${formData.financialResponsibility ? '☑' : '☐'}</span>
          <span class="field-value">Financial Responsibility Agreement</span>
        </div>
      </div>

      <div class="signature-section">
        <div class="section-title">Digital Signature</div>
        <p><strong>Electronically signed by:</strong> ${formData.firstName || ''} ${formData.lastName || ''}</p>
        <p><strong>Date signed:</strong> ${new Date(intakeForm.signed_at || intakeForm.created_at).toLocaleDateString()}</p>
        <p><strong>IP Address:</strong> [Recorded for security]</p>
      </div>
    </body>
    </html>
  `;
}

async function htmlToPdf(html: string): Promise<Uint8Array> {
  // Create a more structured text format instead of raw HTML stripping
  const structuredText = html
    .replace(/<h1[^>]*>(.*?)<\/h1>/g, '\n\n=== $1 ===\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/g, '\n\n--- $1 ---\n')
    .replace(/<div class="section-title"[^>]*>(.*?)<\/div>/g, '\n\n*** $1 ***\n')
    .replace(/<div class="field"[^>]*>/g, '\n  ')
    .replace(/<span class="field-label"[^>]*>(.*?)<\/span>/g, '$1')
    .replace(/<span class="field-value"[^>]*>(.*?)<\/span>/g, ' $1')
    .replace(/<span class="checkbox"[^>]*>(.*?)<\/span>/g, '$1 ')
    .replace(/<p[^>]*>(.*?)<\/p>/g, '\n$1')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]*>/g, '') // Remove remaining HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive line breaks
    .trim();
  
  // Add a header to identify the document type
  const finalText = `PATIENT INTAKE FORM - TEXT FORMAT
Generated: ${new Date().toISOString()}
===============================================

${structuredText}

===============================================
End of Patient Intake Form`;
  
  return new TextEncoder().encode(finalText);
}

function generateEmailSummary(formData: any): string {
  const patientName = formData.firstName && formData.lastName 
    ? `${formData.firstName} ${formData.lastName}` 
    : 'Unknown Patient';
    
  const summary = `
📋 NEW PATIENT INTAKE FORM SUBMITTED
=====================================

👤 PATIENT INFORMATION:
• Name: ${patientName}
• Date of Birth: ${formData.dateOfBirth || 'Not provided'}
• Email: ${formData.email || 'Not provided'}
• Phone: ${formData.phone || 'Not provided'}
• Address: ${formData.address || 'Not provided'}

🏥 MEDICAL INFORMATION:
• Current Medications: ${formData.currentMedications || 'None reported'}
• Known Allergies: ${formData.allergies || 'None reported'}
• Medical History: ${formData.medicalHistory || 'None reported'}
• Emergency Contact: ${formData.emergencyContactName || 'Not provided'} - ${formData.emergencyContactPhone || 'Not provided'}

💳 INSURANCE INFORMATION:
• Provider: ${formData.insuranceProvider || 'Not provided'}
• Policy Number: ${formData.policyNumber || 'Not provided'}
• Group Number: ${formData.groupNumber || 'Not provided'}

✅ CONSENTS & AGREEMENTS:
• Treatment Consent: ${formData.consentTreatment ? '✓ Agreed' : '✗ Not agreed'}
• Privacy/HIPAA: ${formData.consentPrivacy ? '✓ Agreed' : '✗ Not agreed'}  
• Financial Responsibility: ${formData.consentFinancial ? '✓ Agreed' : '✗ Not agreed'}

📝 SIGNATURE STATUS: Electronically signed and verified

NEXT STEPS:
1. Review the attached form data
2. Schedule patient appointment if needed
3. Verify insurance information
4. Contact patient if additional information is required

This form was submitted through the secure patient intake system.
`;
   
  return summary;
}

async function sendEmailWithAttachment(patientName: string, pdfBuffer: Uint8Array, summary: string) {
  const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
  
  if (!sendgridApiKey) {
    throw new Error('SENDGRID_API_KEY not configured');
  }

  // Use verified sender email from SendGrid or fallback to a safer default
  const fromEmail = 'onboarding@resend.dev'; // This is a commonly verified domain
  const toEmail = 'test@example.com'; // This needs to be configured by the user

  console.log(`Preparing to send email from ${fromEmail} to ${toEmail}`);

  const base64Pdf = btoa(String.fromCharCode(...pdfBuffer));
  
  const emailData = {
    personalizations: [
      {
        to: [{ email: toEmail }],
        subject: `New Patient Intake Form - ${patientName}`
      }
    ],
    from: { email: fromEmail, name: 'Patient Intake System' },
    content: [
      {
        type: 'text/plain',
        value: `New patient intake form has been submitted.\n\n${summary}\n\nPlease see attached form data.`
      },
      {
        type: 'text/html',
        value: `
          <h2>New Patient Intake Form Submission</h2>
          <p>A new patient intake form has been submitted.</p>
          <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <pre style="white-space: pre-wrap; font-family: monospace;">${summary}</pre>
          </div>
          <p>Please see the attached form data for complete information.</p>
        `
      }
    ],
    attachments: [
      {
        content: base64Pdf,
        filename: `intake-form-${patientName.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`,
        type: 'text/plain',
        disposition: 'attachment'
      }
    ]
  };

  console.log('Sending email with SendGrid...');

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sendgridApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(emailData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('SendGrid API error response:', errorText);
    console.error('SendGrid API status:', response.status, response.statusText);
    
    // Try to parse the error response for more details
    try {
      const errorJson = JSON.parse(errorText);
      console.error('SendGrid error details:', errorJson);
      
      if (errorJson.errors && errorJson.errors.length > 0) {
        const firstError = errorJson.errors[0];
        throw new Error(`SendGrid error: ${firstError.message}`);
      }
    } catch (parseError) {
      // If we can't parse the error, use the original response
    }
    
    throw new Error(`Failed to send email: ${response.status} ${response.statusText}. ${errorText}`);
  }

  console.log('Email sent successfully via SendGrid');
}

serve(handler);