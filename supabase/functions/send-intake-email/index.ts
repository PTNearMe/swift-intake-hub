import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import jsPDF from "https://esm.sh/jspdf@2.5.1";
import { Resend } from "npm:resend@2.0.0";

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
      await sendEmailWithResend(patient.name, pdfBuffer, generateEmailSummary(intakeForm.form_data));
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
  
  // Function to add header to each page
  const addHeader = () => {
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('HEALTH ONE MEDICAL CENTER', 105, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('ORLANDO – 1803 Park Center Drive, suite 110 - 32835', 105, 22, { align: 'center' });
    doc.text('GAINESVILLE – 7328 W. University Ave., suite E - 32607', 105, 27, { align: 'center' });
    
    // Add a line separator
    doc.setLineWidth(0.5);
    doc.line(20, 32, 190, 32);
    
    return 40; // Return the y position after header
  };
  
  // Add header to first page
  let yPosition = addHeader();
  
  // Title
  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.text('Patient Intake Form', 20, yPosition);
  
  // Patient header
  doc.setFontSize(14);
  doc.setFont(undefined, 'normal');
  doc.text(`Patient: ${patient.name}`, 20, yPosition + 15);
  doc.text(`Submitted: ${new Date(intakeForm.signed_at || intakeForm.created_at).toLocaleDateString()}`, 20, yPosition + 25);
  
  yPosition += 45;
  
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

  // Add new page for consent forms
  doc.addPage();
  yPosition = addHeader();
  
  // NEW PATIENT CONSENT TO THE USE AND DISCLOSURE OF HEALTHCARE INFORMATION
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  let title = doc.splitTextToSize('NEW PATIENT CONSENT TO THE USE AND DISCLOSURE OF HEALTHCARE INFORMATION FOR TREATMENT, PAYMENT, OR HEALTHCARE OPERATIONS', 170);
  doc.text(title, 20, yPosition);
  yPosition += title.length * 6 + 10;
  
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  
  // First paragraph
  let consentText = doc.splitTextToSize(`I ${formData.patientName || patient.name}, understand that as part of my healthcare. HEALTH ONE MEDICAL CENTER, originates and maintains paper and/or electronic records describing my health history, symptoms, examination and test results, diagnosis, treatment, and any plans for further care of treatment.`, 170);
  doc.text(consentText, 20, yPosition);
  yPosition += consentText.length * 4 + 5;
  
  consentText = doc.splitTextToSize('I understand that this information serves as:', 170);
  doc.text(consentText, 20, yPosition);
  yPosition += consentText.length * 4 + 3;
  
  const listItems1 = [
    'A basis for planning my care and treatment.',
    'A means for communication among the many health professionals who contribute to my care.',
    'A source of information for applying my diagnosis and surgical information to my bill.',
    'A means by which a third-party payer can verify that services billed were actually provided.',
    'A tool for routine healthcare operations such as assessing quality and reviewing the competence of healthcare professionals.'
  ];
  
  listItems1.forEach(item => {
    consentText = doc.splitTextToSize(`• ${item}`, 165);
    doc.text(consentText, 25, yPosition);
    yPosition += consentText.length * 4 + 2;
  });
  
  yPosition += 3;
  consentText = doc.splitTextToSize('I understand and have been provided with a Notice of Information Practices that provides a more complete description of information uses and disclosures.', 170);
  doc.text(consentText, 20, yPosition);
  yPosition += consentText.length * 4 + 5;
  
  consentText = doc.splitTextToSize('I understand that I have the following rights and privileges:', 170);
  doc.text(consentText, 20, yPosition);
  yPosition += consentText.length * 4 + 3;
  
  const listItems2 = [
    'The right to review the notice prior to signing this consent.',
    'The right to object to the use of my health information for directory purposes.',
    'The right to request restrictions as to how my health information may be used or disclosed or to carry out treatment, payment, or healthcare options.'
  ];
  
  listItems2.forEach(item => {
    consentText = doc.splitTextToSize(`• ${item}`, 165);
    doc.text(consentText, 25, yPosition);
    yPosition += consentText.length * 4 + 2;
  });
  
  yPosition += 3;
  consentText = doc.splitTextToSize('I understand that HEALTH ONE MEDICAL CENTER, is not required to agree to the restrictions requested. I understand that I may revoke this consent in writing except to the extent that the organization has already taken action in reliance thereon. I also understand that by refusing to sign this consent or revoking this consent, this organization may refuse to treat me as permitted by Section 164.506 of the Code of Federal Regulations.', 170);
  doc.text(consentText, 20, yPosition);
  yPosition += consentText.length * 4 + 5;
  
  consentText = doc.splitTextToSize('I further understand that HEALTH ONE MEDICAL CENTER, reserves the right to change their notice and practice and prior to implementation in accordance with Section 164.520 of the Code of Federal Regulations. HEALTH ONE MEDICAL CENTER, P.A., change their notice, they will send a copy of any revised notice to the address I have provided (whether U.S. mail or agreed e-mail).', 170);
  doc.text(consentText, 20, yPosition);
  yPosition += consentText.length * 4 + 5;
  
  consentText = doc.splitTextToSize('I understand that as part of my organization\'s, treatment, payment, or healthcare operations, it may become necessary to disclose my protected health information to another entity. I consent to such disclosure for these permitted uses, including disclosures via fax.', 170);
  doc.text(consentText, 20, yPosition);
  yPosition += consentText.length * 4 + 5;
  
  doc.setFont(undefined, 'bold');
  consentText = doc.splitTextToSize('I fully understand and accept these terms of consent.', 170);
  doc.text(consentText, 20, yPosition);
  yPosition += consentText.length * 4 + 8;
  doc.setFont(undefined, 'normal');
  
  if (formData.newPatientConsent) {
    doc.text('☑ Patient has agreed to this consent', 20, yPosition);
    yPosition += 8;
    
    // Add digital signature for this consent
    if (formData.signature) {
      try {
        doc.addImage(formData.signature, 'PNG', 20, yPosition, 60, 20);
        yPosition += 25;
      } catch (error) {
        console.log('Error adding signature image:', error);
        doc.text('Digital signature provided', 20, yPosition);
        yPosition += 8;
      }
    }
    doc.text(`Signed by: ${formData.patientName || patient.name}`, 20, yPosition);
    yPosition += 8;
    doc.text(`Date: ${new Date(intakeForm.signed_at || intakeForm.created_at).toLocaleDateString()}`, 20, yPosition);
  } else {
    doc.text('☐ Patient has NOT agreed to this consent', 20, yPosition);
  }
  yPosition += 15;
  
  // Check if we need a new page
  if (yPosition > 220) {
    doc.addPage();
    yPosition = addHeader();
  }
  
  // ASSIGNMENT OF INSURANCE BENEFITS, RELEASE, & DEMAND
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  title = doc.splitTextToSize('ASSIGNMENT OF INSURANCE BENEFITS, RELEASE, & DEMAND', 170);
  doc.text(title, 20, yPosition);
  yPosition += title.length * 6 + 10;
  
  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  
  doc.setFont(undefined, 'bold');
  consentText = doc.splitTextToSize('Insurer and Patient Please Read the Following in its Entirety Carefully!', 170);
  doc.text(consentText, 20, yPosition);
  yPosition += consentText.length * 4 + 8;
  doc.setFont(undefined, 'normal');
  
  // Main assignment text (this is very long, so split into smaller chunks)
  const mainText = `I, ${formData.patientName || patient.name}, the undersigned patient/insured knowingly, voluntarily and intentionally assign the rights and benefits of my automobile Insurance, a/k/a Personal Injury Protection (hereinafter PIP), Uninsured Motorist, and Medical Payments policy of insurance to the above health care provider. I understand it is the intention of the provider to accept this assignment of benefits in lieu of demanding payment at the time services are rendered. I understand this document will allow the provider to file suit against an insurer for payment of the insurance benefits or an explanation of benefits and to seek §627.428 damages from the insurer. If the provider's bills are applied to a deductible, I agree this will serve as a benefit to me.`;
  
  consentText = doc.splitTextToSize(mainText, 170);
  doc.text(consentText, 20, yPosition);
  yPosition += consentText.length * 4 + 6;
  
  const continueText = `This assignment of benefits includes the cost of transportation, medications, supplies, over due interest and any potential claim for common law or statutory bad faith/unfair claims handling. If the insurer disputes the validity of this assignment of benefits then the insurer is instructed to notify the provider in writing within five days of receipt of this document. Failure to inform the provider shall result in a waiver by the insurer to contest the validity of this document.`;
  
  consentText = doc.splitTextToSize(continueText, 170);
  doc.text(consentText, 20, yPosition);
  yPosition += consentText.length * 4 + 6;
  
  const finalText = `The undersigned directs the insurer to pay the health care provider the maximum amount directly without any reductions & without including the patient's name on the check. To the extent the PIP insurer contends there is a material misrepresentation on the application for insurance resulting in the policy of insurance is declared voided, rescinded, or canceled, I, as the named insured under said policy of insurance, hereby assign the right to receive the premiums paid for my PIP insurance to this provider and to file suit for recovery of the premiums.`;
  
  consentText = doc.splitTextToSize(finalText, 170);
  doc.text(consentText, 20, yPosition);
  yPosition += consentText.length * 4 + 8;
  
  // Check if we need a new page
  if (yPosition > 240) {
    doc.addPage();
    yPosition = addHeader();
  }
  
  // Add remaining sections
  const sections = [
    {
      title: 'Disputes:',
      text: 'The insurer is directed by the provider and the undersigned to not issue any checks or drafts in partial settlement of a claim that contain or are accompanied by language releasing the insurer or its insured/patient from liability unless there has been a prior written settlement agreed to by the health provider (specifically the office manager) and the insurer as to the amount payable under the insurance policy. The insured and the provider hereby contests and objects to any reductions or partial payments. Any partial or reduced payment, regardless of the accompanying language, issued by the insurer and deposited by the provider shall be done so under protest, at the risk of the insurer, and the deposit shall not be deemed a waiver, accord, satisfaction, discharge, settlement or agreement by the provider to accept a reduced amount as payment in full. The insurer is hereby placed on notice that this provider reserves the right to seek the full amount of the bills submitted. If the PIP insurer states it can pay claims at 200% of Medicare then the insurer is instructed & directed to provide this provider with a copy of the policy of insurance within 10 days. Any effort by the insurer to pay a disputed debt as full satisfaction must be mailed to the address above, after speaking with the office manager, and mailed to the specific attention of the Office Manager. See Fla. Stat. §673.3111.'
    },
    {
      title: 'EUOs and IMEs:',
      text: 'If the insurer schedules a defense examination or examination under oath (hereinafter "EUO") the insurer is hereby INSTRUCTED to send a copy of said notification to this provider. The provider or the provider\'s attorney is expressly authorized to appear at any EUO or IME set by the insurer. The health care provider is not the agent of the insurer or the patient for any purpose. This assignment applies to both past and future medical expenses and is valid even if undated. A photocopy of this assignment is to be considered as valid as the original. I agree to pay any applicable deductible, co-payments, for services rendered after the policy of insurance exhausts and for any other services unrelated to the automobile accident. The health care provider is given the power of attorney to: endorse my name on any check for services rendered by the above provider; and to request and obtain a copy of any statements or examinations under oath given by patient.'
    },
    {
      title: 'Release of information:',
      text: 'I authorize this provider to: furnish an insurer, an insurer\'s intermediary, the patient\'s other medical providers, and the patient\'s attorney via mail, fax, or email, with any and all information that may be contained in the medical records; to obtain insurance coverage information (declaration sheet & policy of insurance) in writing and telephonically from the insurer; request from any insurer all explanation of benefits (EOBs) for all providers and non-redacted PIP payout sheets; obtain any written and verbal statements the patient or anyone else provided to the insurer; obtain copies of the entire claim file, the property damage file, and all medical records, including but not limited to, documents, reports, scans, notes, bills, opinions, X-rays, IMEs, and MRIs, from any other medical provider or any insurer. The provider is permitted to produce my medical records to its attorney in connection with any pending lawsuits. The insurer is directed to keep the patient\'s medical records from this provider private and confidential. The insurer is not authorized to provide these medical records to anyone without the patient\'s and the provider\'s prior express written permission.'
    },
    {
      title: 'Demand:',
      text: 'Demand is hereby made for the insurer to pay all bills within 30 days without reductions and to mail the latest non-redacted PIP payout sheet and the insurance coverage declaration sheet to the above provider within 15 days. The insurer is directed to pay the bills in the order they are received. However, if a bill from this provider and a claim from anyone else is received by the insurer on the same day the insurer is directed to not apply this provider\'s bill to the deductible. If a bill from this provider and claim from anyone else is received by the insurer on the same day then the insurer is directed to pay this provider first before the policy is exhausted. In the event the provider\'s medical bills are disputed or reduced by the insurer for any reason, or amount, the insurer is to: set aside the entire amount disputed or reduced; escrow the full amount at issue; and not pay the disputed amount to anyone or any entity, including myself, until the dispute is resolved by a Court. Do not exhaust the policy. The insurer is instructed to inform, in writing, the provider of any dispute.'
    },
    {
      title: 'Certification:',
      text: 'I certify that: I have read and agree to the above; I have not been solicited or promised anything in exchange for receiving health care; I have not received any promises or guarantees from anyone as to the results that may be obtained by any treatment or service; and I agree the provider\'s prices for medical services, treatment and supplies are reasonable, usual and customary.'
    },
    {
      title: 'Caution:',
      text: 'Please read before signing. If you do not completely understand this document please ask us to explain it to you. If you sign below we will assume you understand and agree to the above.'
    }
  ];
  
  sections.forEach(section => {
    doc.setFont(undefined, 'bold');
    consentText = doc.splitTextToSize(section.title, 170);
    doc.text(consentText, 20, yPosition);
    yPosition += consentText.length * 4 + 3;
    
    doc.setFont(undefined, 'normal');
    consentText = doc.splitTextToSize(section.text, 170);
    doc.text(consentText, 20, yPosition);
    yPosition += consentText.length * 4 + 6;
    
    // Check if we need a new page
    if (yPosition > 230) {
      doc.addPage();
      yPosition = addHeader();
    }
  });
  
  if (formData.insuranceAssignmentConsent) {
    doc.text('☑ Patient has agreed to this assignment', 20, yPosition);
    yPosition += 8;
    
    // Add digital signature for this consent
    if (formData.signature) {
      try {
        doc.addImage(formData.signature, 'PNG', 20, yPosition, 60, 20);
        yPosition += 25;
      } catch (error) {
        console.log('Error adding signature image:', error);
        doc.text('Digital signature provided', 20, yPosition);
        yPosition += 8;
      }
    }
    doc.text(`Signed by: ${formData.patientName || patient.name}`, 20, yPosition);
    yPosition += 8;
    doc.text(`Date: ${new Date(intakeForm.signed_at || intakeForm.created_at).toLocaleDateString()}`, 20, yPosition);
  } else {
    doc.text('☐ Patient has NOT agreed to this assignment', 20, yPosition);
  }
  yPosition += 15;
  
  // Check if we need a new page
  if (yPosition > 230) {
    doc.addPage();
    yPosition = addHeader();
  }
  
  // NOTICE OF EMERGENCY MEDICAL CONDITION
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  title = doc.splitTextToSize('NOTICE OF EMERGENCY MEDICAL CONDITION', 170);
  doc.text(title, 20, yPosition);
  yPosition += title.length * 6 + 10;
  
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  
  consentText = doc.splitTextToSize('The undersigned licensed medical provider, hereby asserts:', 170);
  doc.text(consentText, 20, yPosition);
  yPosition += consentText.length * 4 + 5;
  
  consentText = doc.splitTextToSize(`1. The below patient, has in the opinion of this medical provider, suffered an Emergency Medical Condition, as a result of the patient's injuries sustained in an automobile accident that occurred on ${formData.accidentDate || "________________________"}.`, 170);
  doc.text(consentText, 20, yPosition);
  yPosition += consentText.length * 4 + 5;
  
  consentText = doc.splitTextToSize('2. The Basis of the opinion for finding an Emergency Medical Condition is that the patient has sustained acute symptoms of sufficient severity, which may include severe pain, such that the absence of immediate medical attention could reasonably be expected to result in any of the following: a) serious jeopardy to patient health; b) serious impairment to bodily functions; or c) serious dysfunction of a bodily organ or part.', 170);
  doc.text(consentText, 20, yPosition);
  yPosition += consentText.length * 4 + 8;
  
  consentText = doc.splitTextToSize('The undersigned injured person or legal guardian of such person asserts:', 170);
  doc.text(consentText, 20, yPosition);
  yPosition += consentText.length * 4 + 5;
  
  const patientAssertions = [
    '1. The symptoms I reported to the medical provider are true and accurate.',
    '2. I understand the medical provider has determined I sustained an Emergency Medical condition as a result of the injuries I suffered in the car accident.',
    '3. The medical provider has explained to my satisfaction the need for future medical attention and the harmful consequences to my health which may occur if I do not receive future treatment.'
  ];
  
  patientAssertions.forEach(assertion => {
    consentText = doc.splitTextToSize(assertion, 170);
    doc.text(consentText, 20, yPosition);
    yPosition += consentText.length * 4 + 4;
  });
  
  yPosition += 8;
  if (formData.emergencyMedicalConsent) {
    doc.text('☑ Patient has acknowledged this notice', 20, yPosition);
    yPosition += 8;
    
    // Add digital signature for this consent
    if (formData.signature) {
      try {
        doc.addImage(formData.signature, 'PNG', 20, yPosition, 60, 20);
        yPosition += 25;
      } catch (error) {
        console.log('Error adding signature image:', error);
        doc.text('Digital signature provided', 20, yPosition);
        yPosition += 8;
      }
    }
    doc.text(`Signed by: ${formData.patientName || patient.name}`, 20, yPosition);
    yPosition += 8;
    doc.text(`Date: ${new Date(intakeForm.signed_at || intakeForm.created_at).toLocaleDateString()}`, 20, yPosition);
  } else {
    doc.text('☐ Patient has NOT acknowledged this notice', 20, yPosition);
  }
  yPosition += 20;
  
  // Digital Signature Section
  if (yPosition > 220) {
    doc.addPage();
    yPosition = addHeader();
  }
  
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('DIGITAL SIGNATURE', 20, yPosition);
  yPosition += 15;
  
  doc.setFont(undefined, 'normal');
  doc.setFontSize(12);
  
  // Add signature image if available
  if (formData.signature) {
    try {
      // Add signature image to PDF
      doc.addImage(formData.signature, 'PNG', 20, yPosition, 80, 30);
      yPosition += 35;
    } catch (error) {
      console.log('Error adding signature image:', error);
      // Fallback to text representation
      doc.text('Digital signature provided', 20, yPosition);
      yPosition += 8;
    }
  } else {
    doc.text('No digital signature provided', 20, yPosition);
    yPosition += 8;
  }
  
  doc.text(`Electronically signed by: ${formData.patientName || patient.name}`, 20, yPosition);
  yPosition += 8;
  doc.text(`Date signed: ${new Date(intakeForm.signed_at || intakeForm.created_at).toLocaleDateString()}`, 20, yPosition);
  yPosition += 8;
  doc.text(`Time signed: ${new Date(intakeForm.signed_at || intakeForm.created_at).toLocaleTimeString()}`, 20, yPosition);
  
  // Add verification footer
  yPosition += 20;
  doc.setFontSize(10);
  doc.text('This document was electronically signed and is legally binding.', 20, yPosition);
  yPosition += 5;
  doc.text('Digital signature verification available upon request.', 20, yPosition);
  
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

async function sendEmailWithResend(patientName: string, pdfBuffer: Uint8Array, summary: string): Promise<void> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY not configured');
  }

  const resend = new Resend(resendApiKey);

  console.log('Preparing to send email from noreply@h1med.com to intake@h1med.com');

  try {
    const emailResponse = await resend.emails.send({
      from: 'noreply@h1med.com',
      to: ['intake@h1med.com'],
      subject: `New Patient Intake Form - ${patientName}`,
      text: `New patient intake form has been submitted.\n\n${summary}\n\nPlease see attached form data.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #0066cc; padding-bottom: 10px;">
            New Patient Intake Form Submission
          </h2>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #0066cc; margin-top: 0;">Patient: ${patientName}</h3>
            <p><strong>Submission Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          <div style="background-color: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px; line-height: 1.4;">${summary}</pre>
          </div>
          <div style="background-color: #f0f8ff; padding: 10px; border-radius: 5px; border-left: 4px solid #0066cc;">
            <p style="margin: 0; font-size: 12px; color: #666;">
              This is an automated message from the Health One Medical Center intake system.
              Please see the attached PDF for the complete intake form.
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `intake-form-${patientName.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`,
          content: Array.from(pdfBuffer),
        },
      ],
    });

    console.log('Resend email sent successfully:', emailResponse.id);
  } catch (error: any) {
    console.error('Resend API error:', error);
    throw new Error(`Failed to send email via Resend: ${error.message}`);
  }
}

serve(handler);