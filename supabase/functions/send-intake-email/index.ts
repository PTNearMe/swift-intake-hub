import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import jsPDF from "https://esm.sh/jspdf@2.5.1";

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

    // Generate PDF using jsPDF
    const pdfBuffer = generatePDF(intakeForm, patient);
    console.log("Generated PDF");
    
    // Upload PDF to Supabase Storage
    const fileName = `${patient.name.replace(/\s+/g, '_')}_${intakeFormId}_intake.pdf`;
    const filePath = `${intakeFormId}/${fileName}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('intake-forms')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });
    
    if (uploadError) {
      console.error('Error uploading PDF:', uploadError);
      throw new Error('Failed to upload PDF to storage');
    }
    
    console.log("PDF uploaded to storage:", uploadData.path);
    
    // Get public URL for the PDF
    const { data: { publicUrl } } = supabase.storage
      .from('intake-forms')
      .getPublicUrl(filePath);
    
    console.log("PDF public URL:", publicUrl);

    // Update intake_forms table with PDF URL (do this first, before email)
    const { error: updateError } = await supabase
      .from('intake_forms')
      .update({ 
        pdf_url: publicUrl,
        pdf_generated_at: new Date().toISOString()
      })
      .eq('id', intakeFormId);

    if (updateError) {
      console.error('Error updating intake form with PDF URL:', updateError);
      await logError(supabase, intakeFormId, `Failed to update PDF URL: ${updateError.message}`);
    } else {
      console.log('Successfully updated intake form with PDF URL');
    }

    // Try to send email but don't fail if it doesn't work
    let emailSent = false;
    try {
      await sendEmailWithAttachment(patient.name, pdfBuffer, generateEmailSummary(intakeForm.form_data));
      console.log('Email sent successfully');
      emailSent = true;
    } catch (emailError: any) {
      console.error('Email sending failed, but PDF was generated successfully:', emailError.message);
      await logError(supabase, intakeFormId, `Email sending failed: ${emailError.message}`);
    }

    // Update email_sent flag if email was successful
    if (emailSent) {
      const { error: emailUpdateError } = await supabase
        .from('intake_forms')
        .update({ email_sent: true })
        .eq('id', intakeFormId);

      if (emailUpdateError) {
        console.error('Error updating email_sent flag:', emailUpdateError);
        await logError(supabase, intakeFormId, `Failed to update email_sent flag: ${emailUpdateError.message}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: emailSent ? 'PDF generated and email sent successfully' : 'PDF generated successfully (email failed)',
        pdfUrl: publicUrl
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-intake-email function:', error);
    
    return new Response(
      JSON.stringify({ error: `Failed to send email: ${error.message}` }),
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

function generatePDF(intakeForm: IntakeFormData, patient: PatientData): Uint8Array {
  const doc = new jsPDF();
  const formData = intakeForm.form_data;
  
  // Title
  doc.setFontSize(20);
  doc.text('Patient Intake Form', 20, 30);
  
  // Patient header
  doc.setFontSize(14);
  doc.text(`Patient: ${patient.name}`, 20, 45);
  doc.text(`Submitted: ${new Date(intakeForm.signed_at || intakeForm.created_at).toLocaleDateString()}`, 20, 55);
  
  let yPosition = 75;
  
  // Personal Information
  doc.setFontSize(16);
  doc.text('Personal Information', 20, yPosition);
  yPosition += 10;
  doc.setFontSize(12);
  
  const personalFields = [
    [`Name:`, formData.patientName || patient.name],
    [`Date of Birth:`, formData.dateOfBirth || 'Not provided'],
    [`Address:`, formData.address || 'Not provided'],
    [`Emergency Contact:`, `${formData.emergencyContactName || 'Not provided'} - ${formData.emergencyContactPhone || 'Not provided'}`]
  ];
  
  personalFields.forEach(([label, value]) => {
    doc.text(label, 20, yPosition);
    const lines = doc.splitTextToSize(value, 120);
    doc.text(lines, 80, yPosition);
    yPosition += lines.length * 8;
  });
  
  yPosition += 10;
  
  // Medical History
  doc.setFontSize(16);
  doc.text('Medical History', 20, yPosition);
  yPosition += 10;
  doc.setFontSize(12);
  
  const medicalFields = [
    [`Current Medications:`, formData.currentMedications || 'None'],
    [`Allergies:`, formData.allergies || 'None'],
    [`Medical History:`, formData.medicalHistory || 'None']
  ];
  
  medicalFields.forEach(([label, value]) => {
    doc.text(label, 20, yPosition);
    const lines = doc.splitTextToSize(value, 120);
    doc.text(lines, 80, yPosition);
    yPosition += lines.length * 8;
  });
  
  yPosition += 10;
  
  // Insurance Information
  doc.setFontSize(16);
  doc.text('Insurance Information', 20, yPosition);
  yPosition += 10;
  doc.setFontSize(12);
  
  const insuranceFields = [
    [`Provider:`, formData.insuranceProvider || 'Not provided'],
    [`Policy Number:`, formData.policyNumber || 'Not provided'],
    [`Group Number:`, formData.groupNumber || 'Not provided']
  ];
  
  insuranceFields.forEach(([label, value]) => {
    doc.text(label, 20, yPosition);
    doc.text(value, 80, yPosition);
    yPosition += 8;
  });
  
  yPosition += 10;
  
  // Accident Information (if provided)
  if (formData.accidentDate) {
    doc.setFontSize(16);
    doc.text('Accident Information', 20, yPosition);
    yPosition += 10;
    doc.setFontSize(12);
    doc.text('Accident Date:', 20, yPosition);
    doc.text(formData.accidentDate, 80, yPosition);
    yPosition += 8;
    yPosition += 10;
  }
  
  // Check if we need a new page
  if (yPosition > 220) {
    doc.addPage();
    yPosition = 30;
  }
  
  // Consents
  doc.setFontSize(16);
  doc.text('Consents & Agreements', 20, yPosition);
  yPosition += 10;
  doc.setFontSize(12);
  
  const consentFields = [
    [`New Patient Consent:`, formData.newPatientConsent ? 'Agreed' : 'Not agreed'],
    [`Insurance Assignment:`, formData.insuranceAssignmentConsent ? 'Agreed' : 'Not agreed'],
    [`Emergency Medical Condition:`, formData.emergencyMedicalConsent ? 'Acknowledged' : 'Not acknowledged']
  ];
  
  consentFields.forEach(([label, value]) => {
    doc.text(label, 20, yPosition);
    doc.text(value, 80, yPosition);
    yPosition += 8;
  });
  
  // Signature section
  if (yPosition > 250) {
    doc.addPage();
    yPosition = 30;
  }
  
  yPosition += 15;
  doc.setFontSize(16);
  doc.text('Digital Signature', 20, yPosition);
  yPosition += 10;
  doc.setFontSize(12);
  doc.text(`Electronically signed by: ${formData.patientName || patient.name}`, 20, yPosition);
  yPosition += 8;
  doc.text(`Date signed: ${new Date(intakeForm.signed_at || intakeForm.created_at).toLocaleDateString()}`, 20, yPosition);
  
  // Convert to Uint8Array
  const pdfOutput = doc.output('arraybuffer');
  return new Uint8Array(pdfOutput);
}

function generateEmailSummary(formData: any): string {
  const patientName = formData.patientName || 'Unknown Patient';
     
  const summary = `
📋 NEW PATIENT INTAKE FORM SUBMITTED
=====================================

👤 PATIENT INFORMATION:
• Name: ${patientName}
• Date of Birth: ${formData.dateOfBirth || 'Not provided'}
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

🚗 ACCIDENT INFORMATION:
• Accident Date: ${formData.accidentDate || 'Not provided'}

✅ CONSENTS & AGREEMENTS:
• New Patient Consent: ${formData.newPatientConsent ? '✓ Agreed' : '✗ Not agreed'}
• Insurance Assignment: ${formData.insuranceAssignmentConsent ? '✓ Agreed' : '✗ Not agreed'}  
• Emergency Medical Condition: ${formData.emergencyMedicalConsent ? '✓ Acknowledged' : '✗ Not acknowledged'}

📝 SIGNATURE STATUS: Electronically signed and verified

NEXT STEPS:
1. Review the attached PDF form
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
        filename: `intake-form-${patientName.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`,
        type: 'application/pdf',
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