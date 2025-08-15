
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { jsPDF } from "https://esm.sh/jspdf@2.5.1"
import { Resend } from "npm:resend@2.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const resendApiKey = Deno.env.get('RESEND_API_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { intakeFormId } = await req.json()
    console.log('Fetching intake form data for ID:', intakeFormId)

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Fetch intake form with patient data
    const { data: formData, error } = await supabase
      .from('intake_forms')
      .select(`
        *,
        patients (
          name,
          phone
        )
      `)
      .eq('id', intakeFormId)
      .single()

    if (error) {
      console.error('Error fetching intake form:', error)
      throw error
    }

    const form = formData.form_data
    const patient = formData.patients

// Generate PDF
const doc = new jsPDF()
let yPosition = 20

// Helper function to add signature image
const addSignatureImage = (x: number, y: number, width: number = 80, height: number = 25) => {
  if (form.signature) {
    try {
      doc.addImage(form.signature, 'PNG', x, y, width, height)
      return height + 5
    } catch (error) {
      console.log('Could not add signature image:', error)
      doc.setFontSize(8)
      doc.text('[Digital Signature]', x, y + 10)
      return 15
    }
  } else {
    doc.setFontSize(8)
    doc.text('[No Signature]', x, y + 10)
    return 15
  }
}

// Title
doc.setFontSize(16)
doc.setFont(undefined, 'bold')
doc.text('Patient Intake Forms - Health One Medical Center', 20, yPosition)
doc.setFont(undefined, 'normal')
yPosition += 20

// Patient Information
doc.setFontSize(14)
doc.setFont(undefined, 'bold')
doc.text('Patient Information:', 20, yPosition)
doc.setFont(undefined, 'normal')
yPosition += 10

doc.setFontSize(10)
doc.setFont(undefined, 'bold')
doc.text(`Name: ${patient?.name || 'N/A'}`, 20, yPosition)
doc.setFont(undefined, 'normal')
yPosition += 8
doc.text(`Phone: ${patient?.phone || 'N/A'}`, 20, yPosition)
yPosition += 8
doc.text(`Date of Birth: ${form.dateOfBirth || 'N/A'}`, 20, yPosition)
yPosition += 8

// Format address from separate fields
const fullAddress = [
  form.address,
  form.city,
  form.zipCode
].filter(Boolean).join(', ')

doc.text(`Address: ${fullAddress || 'N/A'}`, 20, yPosition)
yPosition += 8
doc.text(`Accident Date: ${form.accidentDate || 'N/A'}`, 20, yPosition)
yPosition += 15

// NEW PATIENT CONSENT SECTION
doc.setFontSize(12)
doc.setFont(undefined, 'bold')
doc.text('NEW PATIENT CONSENT TO THE USE AND DISCLOSE OF', 20, yPosition)
yPosition += 6
doc.text('HEALTHCARE INFORMATION FOR TREATMENT, PAYMENT, OR HEALTHCARE OPERATIONS', 20, yPosition)
doc.setFont(undefined, 'normal')
yPosition += 10

doc.setFontSize(9)
const patientNameBold = form.patientName || patient?.name || 'N/A'
const consentText1 = `I ${patientNameBold}, understand that as part of my healthcare. HEALTH ONE MEDICAL CENTER, originates and maintains paper and/or electronic records describing my health history, symptoms, examination and test results, diagnosis, treatment, and any plans for further care of treatment.

I understand that this information serves as:
• A basis for planning my care and treatment.
• A means for communication among the many health professionals who contribute to my care.
• A source of information for applying my diagnosis and surgical information to my bill.
• A means by which a third-party payer can verify that services billed were actually provided.
• A tool for routine healthcare operations such as assessing quality and reviewing the competence of healthcare professionals.

I understand and have been provided with a Notice of Information Practices that provides a more complete description of information uses and disclosures.

I understand that I have the following rights and privileges:
• The right to review the notice prior to signing this consent.
• The right to object to the use of my health information for directory purposes.
• The right to request restrictions as to how my health information may be used or disclosed or to carry out treatment, payment, or healthcare options.

I understand that HEALTH ONE MEDICAL CENTER, is not required to agree to the restrictions requested. I understand that I may revoke this consent in writing except to the extent that the organization has already taken action in reliance thereon. I also understand that by refusing to sign this consent or revoking this consent, this organization may refuse to treat me as permitted by Section 164.506 of the Code of Federal Regulations.

I further understand that HEALTH ONE MEDICAL CENTER, reserves the right to change their notice and practice and prior to implementation in accordance with Section 164.520 of the Code of Federal Regulations. HEALTH ONE MEDICAL CENTER, P.A., change their notice, they will send a copy of any revised notice to the address I have provided (whether U.S. mail or agreed e-mail).

I understand that as part of my organization's, treatment, payment, or healthcare operations, it may become necessary to disclose my protected health information to another entity. I consent to such disclosure for these permitted uses, including disclosures via fax.

I fully understand and accept these terms of consent.`

// Split text into lines and add to PDF with bold formatting for patient name and medical center
const lines1 = doc.splitTextToSize(consentText1, 170)
for (const line of lines1) {
  if (yPosition > 240) {
    doc.addPage()
    yPosition = 20
  }
  
  // Check if line contains patient name or medical center and make them bold
  if (line.includes(patientNameBold) || line.includes('HEALTH ONE MEDICAL CENTER')) {
    const pattern = new RegExp(`(HEALTH ONE MEDICAL CENTER|${patientNameBold.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g')
    const parts = line.split(pattern)
    let xPosition = 20
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (part === 'HEALTH ONE MEDICAL CENTER' || part === patientNameBold) {
        doc.setFont(undefined, 'bold')
        doc.text(part, xPosition, yPosition)
        doc.setFont(undefined, 'normal')
      } else if (part) {
        doc.text(part, xPosition, yPosition)
      }
      xPosition += doc.getTextWidth(part)
    }
  } else {
    doc.text(line, 20, yPosition)
  }
  yPosition += 4
}

doc.setFontSize(10)
yPosition += 5
doc.setFont(undefined, 'bold')
doc.text(`Patient Consent: ${form.newPatientConsent ? 'AGREED' : 'NOT AGREED'}`, 20, yPosition)
doc.setFont(undefined, 'normal')
yPosition += 8

// Add signature for consent 1
doc.setFontSize(9)
doc.text('Patient Signature:', 20, yPosition)
yPosition += 5
const signatureHeight1 = addSignatureImage(20, yPosition)
yPosition += signatureHeight1 + 10

// Add new page for insurance assignment
doc.addPage()
yPosition = 20

// ASSIGNMENT OF INSURANCE BENEFITS SECTION
doc.setFontSize(12)
doc.setFont(undefined, 'bold')
doc.text('ASSIGNMENT OF INSURANCE BENEFITS, RELEASE, & DEMAND', 20, yPosition)
doc.setFont(undefined, 'normal')
yPosition += 10

doc.setFontSize(9)
const consentText2 = `Insurer and Patient Please Read the Following in its Entirety Carefully!

I, ${patientNameBold}, the undersigned patient/insured knowingly, voluntarily and intentionally assign the rights and benefits of my automobile Insurance, a/k/a Personal Injury Protection (hereinafter PIP), Uninsured Motorist, and Medical Payments policy of insurance to the above health care provider. I understand it is the intention of the provider to accept this assignment of benefits in lieu of demanding payment at the time services are rendered. I understand this document will allow the provider to file suit against an insurer for payment of the insurance benefits or an explanation of benefits and to seek §627.428 damages from the insurer.

DISPUTES:
The insurer is directed by the provider and the undersigned to not issue any checks or drafts in partial settlement of a claim that contain or are accompanied by language releasing the insurer or its insured/patient from liability unless there has been a prior written settlement agreed to by the health provider (specifically the office manager) and the insurer as to the amount payable under the insurance policy.

EUOs and IMEs:
If the insurer schedules a defense examination or examination under oath (hereinafter "EUO") the insurer is hereby INSTRUCTED to send a copy of said notification to this provider. The provider or the provider's attorney is expressly authorized to appear at any EUO or IME set by the insurer.

RELEASE OF INFORMATION:
I authorize this provider to: furnish an insurer, an insurer's intermediary, the patient's other medical providers, and the patient's attorney via mail, fax, or email, with any and all information that may be contained in the medical records; to obtain insurance coverage information (declaration sheet & policy of insurance) in writing and telephonically from the insurer.

DEMAND:
Demand is hereby made for the insurer to pay all bills within 30 days without reductions and to mail the latest non-redacted PIP payout sheet and the insurance coverage declaration sheet to the above provider within 15 days.

CERTIFICATION:
I certify that: I have read and agree to the above; I have not been solicited or promised anything in exchange for receiving health care; I have not received any promises or guarantees from anyone as to the results that may be obtained by any treatment or service; and I agree the provider's prices for medical services, treatment and supplies are reasonable, usual and customary.`

// Split text into lines and add to PDF
const lines2 = doc.splitTextToSize(consentText2, 170)
for (const line of lines2) {
  if (yPosition > 240) {
    doc.addPage()
    yPosition = 20
  }
  
  // Bold patient name in insurance section
  if (line.includes(patientNameBold)) {
    const parts = line.split(patientNameBold)
    let xPosition = 20
    
    doc.text(parts[0], xPosition, yPosition)
    xPosition += doc.getTextWidth(parts[0])
    
    doc.setFont(undefined, 'bold')
    doc.text(patientNameBold, xPosition, yPosition)
    doc.setFont(undefined, 'normal')
    xPosition += doc.getTextWidth(patientNameBold)
    
    if (parts[1]) {
      doc.text(parts[1], xPosition, yPosition)
    }
  } else {
    doc.text(line, 20, yPosition)
  }
  yPosition += 4
}

doc.setFontSize(10)
yPosition += 5
doc.setFont(undefined, 'bold')
doc.text(`Insurance Assignment Consent: ${form.insuranceAssignmentConsent ? 'AGREED' : 'NOT AGREED'}`, 20, yPosition)
doc.setFont(undefined, 'normal')
yPosition += 8

// Add signature for consent 2
doc.setFontSize(9)
doc.text('Patient Signature:', 20, yPosition)
yPosition += 5
const signatureHeight2 = addSignatureImage(20, yPosition)
yPosition += signatureHeight2 + 10

// Add new page for emergency medical condition
doc.addPage()
yPosition = 20

// NOTICE OF EMERGENCY MEDICAL CONDITION SECTION
doc.setFontSize(12)
doc.setFont(undefined, 'bold')
doc.text('NOTICE OF EMERGENCY MEDICAL CONDITION', 20, yPosition)
doc.setFont(undefined, 'normal')
yPosition += 10

doc.setFontSize(9)
const consentText3 = `The undersigned licensed medical provider, hereby asserts:

1. The below patient, has in the opinion of this medical provider, suffered an Emergency Medical Condition, as a result of the patient's injuries sustained in an automobile accident that occurred on ${form.accidentDate || 'N/A'}.

2. The Basis of the opinion for finding an Emergency Medical Condition is that the patient has sustained acute symptoms of sufficient severity, which may include severe pain, such that the absence of immediate medical attention could reasonably be expected to result in any of the following: a) serious jeopardy to patient health; b) serious impairment to bodily functions; or c) serious dysfunction of a bodily organ or part.

The undersigned injured person or legal guardian of such person asserts:

1. The symptoms I reported to the medical provider are true and accurate.

2. I understand the medical provider has determined I sustained an Emergency Medical condition as a result of the injuries I suffered in the car accident.

3. The medical provider has explained to my satisfaction the need for future medical attention and the harmful consequences to my health which may occur if I do not receive future treatment.`

// Split text into lines and add to PDF
const lines3 = doc.splitTextToSize(consentText3, 170)
for (const line of lines3) {
  if (yPosition > 240) {
    doc.addPage()
    yPosition = 20
  }
  doc.text(line, 20, yPosition)
  yPosition += 4
}

doc.setFontSize(10)
yPosition += 5
doc.setFont(undefined, 'bold')
doc.text(`Emergency Medical Condition Acknowledgment: ${form.emergencyMedicalConsent ? 'AGREED' : 'NOT AGREED'}`, 20, yPosition)
doc.setFont(undefined, 'normal')
yPosition += 8

// Add signature for consent 3
doc.setFontSize(9)
doc.text('Patient Signature:', 20, yPosition)
yPosition += 5
const signatureHeight3 = addSignatureImage(20, yPosition)
yPosition += signatureHeight3 + 5

doc.setFontSize(8)
doc.text(`Date Signed: ${new Date().toLocaleDateString()}`, 20, yPosition)

console.log('Generated PDF')

    // Save PDF to storage
const pdfArrayBuffer = doc.output('arraybuffer') as ArrayBuffer
const pdfBytes = new Uint8Array(pdfArrayBuffer)
const pdfFileName = `${patient?.name?.replace(/\s+/g, '_') || 'Patient'}_${intakeFormId}_intake.pdf`

const { data: uploadData, error: uploadError } = await supabase.storage
  .from('intake-forms')
  .upload(`${intakeFormId}/${pdfFileName}`, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true
  })

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError)
      throw uploadError
    }

    console.log('PDF uploaded to storage:', uploadData.path)

// Create signed URL (30 days)
const { data: signedData, error: signedError } = await supabase.storage
  .from('intake-forms')
  .createSignedUrl(uploadData.path, 60 * 60 * 24 * 30)

if (signedError) {
  console.error('Error creating signed URL:', signedError)
  throw signedError
}

const signedUrl = signedData.signedUrl

console.log('PDF signed URL:', signedUrl)

    // Update intake form with PDF URL
const { error: updateError } = await supabase
  .from('intake_forms')
  .update({ 
    pdf_url: signedUrl,
    pdf_generated_at: new Date().toISOString()
  })
  .eq('id', intakeFormId)

    if (updateError) {
      console.error('Error updating intake form with PDF URL:', updateError)
      throw updateError
    }

    console.log('Successfully updated intake form with PDF URL')

// Send email
const resend = new Resend(resendApiKey)

const fromEmail = 'noreply@h1med.com'
const toEmail = 'intake@h1med.com'

console.log(`Preparing to send email from ${fromEmail} to ${toEmail}`)

// Prepare attachment (base64)
const base64Content = (() => {
  let binary = ''
  for (let i = 0; i < pdfBytes.byteLength; i++) binary += String.fromCharCode(pdfBytes[i])
  return btoa(binary)
})()

const emailResult = await resend.emails.send({
  from: fromEmail,
  to: toEmail,
  subject: `New Patient Intake Form - ${patient?.name || 'Unknown Patient'}`,
  html: `
    <h2>New Patient Intake Form Submitted</h2>
    <p><strong>Patient:</strong> ${patient?.name || 'N/A'}</p>
    <p><strong>Phone:</strong> ${patient?.phone || 'N/A'}</p>
    <p><strong>Date of Birth:</strong> ${form.dateOfBirth || 'N/A'}</p>
    <p><strong>Address:</strong> ${fullAddress || 'N/A'}</p>
    <p><strong>Accident Date:</strong> ${form.accidentDate || 'N/A'}</p>
    <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
    
    <h3>Consents Provided:</h3>
    <ul>
      <li>New Patient Consent: ${form.newPatientConsent ? 'Yes' : 'No'}</li>
      <li>Insurance Assignment Consent: ${form.insuranceAssignmentConsent ? 'Yes' : 'No'}</li>
      <li>Emergency Medical Consent: ${form.emergencyMedicalConsent ? 'Yes' : 'No'}</li>
    </ul>
    
    <p>The complete intake form PDF is attached.</p>
    <p><a href="${signedUrl}" target="_blank">Open PDF (signed link)</a></p>
  `,
  attachments: [
    {
      filename: pdfFileName,
      content: base64Content,
      contentType: 'application/pdf',
    },
  ],
})

    console.log('Resend email sent successfully:', emailResult.id)
    console.log('Email sent successfully')

    return new Response(
JSON.stringify({ 
        success: true, 
        pdfUrl: signedUrl,
        emailId: emailResult.id 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error in send-intake-email function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})
