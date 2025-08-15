
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

    // Title
    doc.setFontSize(16)
    doc.text('Patient Intake Forms', 20, yPosition)
    yPosition += 20

    // Patient Information
    doc.setFontSize(12)
    doc.text('Patient Information:', 20, yPosition)
    yPosition += 10

    doc.setFontSize(10)
    doc.text(`Name: ${patient?.name || 'N/A'}`, 20, yPosition)
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
    yPosition += 15

    // Consent Information
    doc.setFontSize(12)
    doc.text('Consents:', 20, yPosition)
    yPosition += 10

    doc.setFontSize(10)
    doc.text(`Patient Name for Consent: ${form.patientName || 'N/A'}`, 20, yPosition)
    yPosition += 8
    doc.text(`New Patient Consent: ${form.newPatientConsent ? 'Yes' : 'No'}`, 20, yPosition)
    yPosition += 8
    doc.text(`Insurance Assignment Consent: ${form.insuranceAssignmentConsent ? 'Yes' : 'No'}`, 20, yPosition)
    yPosition += 8
    doc.text(`Emergency Medical Consent: ${form.emergencyMedicalConsent ? 'Yes' : 'No'}`, 20, yPosition)
    yPosition += 8
    doc.text(`Accident Date: ${form.accidentDate || 'N/A'}`, 20, yPosition)
    yPosition += 15

    // Signature
    doc.setFontSize(12)
    doc.text('Digital Signature:', 20, yPosition)
    yPosition += 10

    if (form.signature) {
      doc.text('Patient has provided digital signature', 20, yPosition)
    } else {
      doc.text('No signature provided', 20, yPosition)
    }

    console.log('Generated PDF')

    // Save PDF to storage
    const pdfBuffer = doc.output('arraybuffer')
    const pdfFileName = `${patient?.name?.replace(/\s+/g, '_') || 'Patient'}_${intakeFormId}_intake.pdf`
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('intake-forms')
      .upload(`${intakeFormId}/${pdfFileName}`, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError)
      throw uploadError
    }

    console.log('PDF uploaded to storage:', uploadData.path)

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('intake-forms')
      .getPublicUrl(uploadData.path)

    console.log('PDF public URL:', publicUrl)

    // Update intake form with PDF URL
    const { error: updateError } = await supabase
      .from('intake_forms')
      .update({ 
        pdf_url: publicUrl,
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
        
        <p>The complete intake form PDF is attached and available in the system.</p>
        <p><a href="${publicUrl}" target="_blank">View PDF</a></p>
      `,
    })

    console.log('Resend email sent successfully:', emailResult.id)
    console.log('Email sent successfully')

    return new Response(
      JSON.stringify({ 
        success: true, 
        pdfUrl: publicUrl,
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
