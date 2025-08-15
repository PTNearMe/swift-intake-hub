import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { SignaturePad } from "@/components/SignaturePad";
import { CalendarDays, User, Phone, MapPin, AlertCircle, FileText } from "lucide-react";

const formSchema = z.object({
  // Personal Information
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  address: z.string().min(1, "Address is required"),
  emergencyContactName: z.string().min(1, "Emergency contact name is required"),
  emergencyContactPhone: z.string().min(1, "Emergency contact phone is required"),
  
  // New Patient Consents
  newPatientConsent: z.boolean().refine(val => val === true, "New Patient Consent is required"),
  patientName: z.string().min(1, "Patient name is required for consent"),
  insuranceAssignmentConsent: z.boolean().refine(val => val === true, "Assignment of Insurance Benefits consent is required"),
  emergencyMedicalConsent: z.boolean().refine(val => val === true, "Notice of Emergency Medical Condition acknowledgment is required"),
  accidentDate: z.string().min(1, "Accident date is required for emergency medical condition"),
});

type FormData = z.infer<typeof formSchema>;

const IntakeForms = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const patientId = searchParams.get("patientId");
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [existingForm, setExistingForm] = useState<any>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const totalSteps = 2;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  // Redirect if no patient ID
  useEffect(() => {
    if (!patientId) {
      navigate("/intake/start");
      return;
    }
    
    // Check if forms already exist for this patient
    checkExistingForms();
  }, [patientId]);

  const checkExistingForms = async () => {
    // SECURITY FIX: Anonymous users cannot read medical records
    // This prevents HIPAA violations by ensuring patients cannot access
    // existing intake forms, which contain sensitive medical information
    
    if (!patientId) return;

    // For security compliance, we no longer allow anonymous users to read
    // existing intake forms. Each visit starts fresh.
    // This prevents exposure of sensitive medical data via URL manipulation
    
    console.log("Starting fresh intake form for patient:", patientId);
    
    // Reset to initial state - no pre-filling for security
    setExistingForm(null);
    setIsLocked(false);
    setPdfUrl(null);
    setSignature(null);
  };

  const onSubmit = async (data: FormData) => {
    if (!patientId) return;
    
    if (!signature) {
      toast({
        title: "Signature Required",
        description: "Please provide your digital signature to complete the forms.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    console.log("Starting form submission for patient:", patientId);
    
    try {
      const formData = {
        ...data,
        signature,
      };

      console.log("Attempting to save intake form with data:", formData);

      // Use a SECURITY DEFINER function to bypass RLS issues with anonymous users
      const { data: insertedFormId, error } = await supabase
        .rpc('create_intake_form', {
          _patient_id: patientId,
          _form_data: formData,
          _signed_at: new Date().toISOString()
        });

      if (error) {
        console.error("Database error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        toast({
          title: "Error Saving Form",
          description: `Failed to save forms: ${error.message}. Please try again.`,
          variant: "destructive",
        });
        return;
      }

      console.log("Form saved successfully with ID:", insertedFormId);

      setIsLocked(true);

      // Send email notification with form data
      try {
        console.log("Sending email notification for form:", insertedFormId);
        const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-intake-email', {
          body: { intakeFormId: insertedFormId }
        });

        if (emailError) {
          console.error("Email sending failed:", {
            message: emailError.message,
            details: emailError.details,
            context: emailError.context
          });
          
          // Check if it's a SendGrid configuration issue
          if (emailError.message?.includes('SENDGRID_API_KEY') || 
              emailError.message?.includes('sender') || 
              emailError.message?.includes('verified')) {
            toast({
              title: "Forms Submitted Successfully",
              description: "Your forms were submitted successfully. Email notification may require configuration by staff.",
            });
          } else {
            toast({
              title: "Forms Submitted",
              description: "Your forms were submitted successfully. Staff will be notified manually.",
            });
          }
        } else {
          console.log("Email sent successfully:", emailResult);
          toast({
            title: "Forms Completed",
            description: "Your intake forms have been submitted and staff have been notified by email.",
          });
        }
      } catch (emailError: any) {
        console.error("Email function error:", emailError);
        
        // Provide user-friendly error messages based on the type of error
        let errorMessage = "Your intake forms have been successfully submitted.";
        
        if (emailError.message?.includes('SENDGRID_API_KEY')) {
          errorMessage += " Email notifications require configuration by staff.";
        } else if (emailError.message?.includes('sender') || emailError.message?.includes('verified')) {
          errorMessage += " Email notification may require domain verification.";
        } else {
          errorMessage += " Staff will be notified manually.";
        }
        
        toast({
          title: "Forms Submitted Successfully",
          description: errorMessage,
        });
      }

      // Navigate to completion page after a delay
      setTimeout(() => {
        navigate(`/intake/complete?patientId=${patientId}`);
      }, 2000);

    } catch (error) {
      console.error("Unexpected error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = (currentStep / totalSteps) * 100;

  if (!patientId) return null;

  return (
    <div className="min-h-screen bg-background py-4 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Patient Intake Forms
          </h1>
          <Progress value={progress} className="w-full max-w-md mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">
            Step {currentStep} of {totalSteps}
          </p>
        </div>

        {isLocked && (
          <Card className="mb-6 border-green-200 bg-green-50 dark:bg-green-900/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-green-700 dark:text-green-400">
                  <AlertCircle className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Forms Completed</p>
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      Your intake forms have been submitted and locked for editing.
                    </p>
                  </div>
                </div>
                {pdfUrl && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(pdfUrl, '_blank')}
                    className="text-green-700 border-green-300 hover:bg-green-100 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-800"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Personal Information */}
          {currentStep >= 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-primary" />
                  <span>Personal Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      {...register("dateOfBirth")}
                      disabled={isLocked}
                      className={errors.dateOfBirth ? "border-destructive" : ""}
                    />
                    {errors.dateOfBirth && (
                      <p className="text-sm text-destructive">{errors.dateOfBirth.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address *</Label>
                  <Textarea
                    id="address"
                    placeholder="Street address, city, state, zip code"
                    {...register("address")}
                    disabled={isLocked}
                    className={errors.address ? "border-destructive" : ""}
                  />
                  {errors.address && (
                    <p className="text-sm text-destructive">{errors.address.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContactName">Emergency Contact Name *</Label>
                    <Input
                      id="emergencyContactName"
                      {...register("emergencyContactName")}
                      disabled={isLocked}
                      className={errors.emergencyContactName ? "border-destructive" : ""}
                    />
                    {errors.emergencyContactName && (
                      <p className="text-sm text-destructive">{errors.emergencyContactName.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emergencyContactPhone">Emergency Contact Phone *</Label>
                    <Input
                      id="emergencyContactPhone"
                      type="tel"
                      {...register("emergencyContactPhone")}
                      disabled={isLocked}
                      className={errors.emergencyContactPhone ? "border-destructive" : ""}
                    />
                    {errors.emergencyContactPhone && (
                      <p className="text-sm text-destructive">{errors.emergencyContactPhone.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Consents and Signature */}
          {currentStep >= 2 && (
            <div className="space-y-6">
              {/* Patient Name */}
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <Label htmlFor="patientName">Patient Full Name *</Label>
                    <Input
                      id="patientName"
                      placeholder="Enter your full legal name"
                      {...register("patientName")}
                      disabled={isLocked}
                      className={errors.patientName ? "border-destructive" : ""}
                    />
                    {errors.patientName && (
                      <p className="text-sm text-destructive">{errors.patientName.message}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* New Patient Consent */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">NEW PATIENT CONSENT TO THE USE AND DISCLOSE OF HEALTHCARE INFORMATION FOR TREATMENT, PAYMENT, OR HEALTHCARE OPERATIONS</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm leading-relaxed space-y-3 p-4 bg-muted/50 rounded-lg max-h-80 overflow-y-auto">
                    <p>I <strong>{watch("patientName") || "_______________________________________________"}</strong>, understand that as part of my healthcare. HEALTH ONE MEDICAL CENTER, originates and maintains paper and/or electronic records describing my health history, symptoms, examination and test results, diagnosis, treatment, and any plans for further care of treatment.</p>
                    
                    <p>I understand that this information serves as:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>A basis for planning my care and treatment.</li>
                      <li>A means for communication among the many health professionals who contribute to my care.</li>
                      <li>A source of information for applying my diagnosis and surgical information to my bill.</li>
                      <li>A means by which a third-party payer can verify that services billed were actually provided.</li>
                      <li>A tool for routine healthcare operations such as assessing quality and reviewing the competence of healthcare professionals.</li>
                    </ul>
                    
                    <p>I understand and have been provided with a Notice of Information Practices that provides a more complete description of information uses and disclosures.</p>
                    
                    <p>I understand that I have the following rights and privileges:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>The right to review the notice prior to signing this consent.</li>
                      <li>The right to object to the use of my health information for directory purposes.</li>
                      <li>The right to request restrictions as to how my health information may be used or disclosed or to carry out treatment, payment, or healthcare options.</li>
                    </ul>
                    
                    <p>I understand that HEALTH ONE MEDICAL CENTER, is not required to agree to the restrictions requested. I understand that I may revoke this consent in writing except to the extent that the organization has already taken action in reliance thereon. I also understand that by refusing to sign this consent or revoking this consent, this organization may refuse to treat me as permitted by Section 164.506 of the Code of Federal Regulations.</p>
                    
                    <p>I further understand that HEALTH ONE MEDICAL CENTER, reserves the right to change their notice and practice and prior to implementation in accordance with Section 164.520 of the Code of Federal Regulations. HEALTH ONE MEDICAL CENTER, P.A., change their notice, they will send a copy of any revised notice to the address I have provided (whether U.S. mail or agreed e-mail).</p>
                    
                    <p>I understand that as part of my organization's, treatment, payment, or healthcare operations, it may become necessary to disclose my protected health information to another entity. I consent to such disclosure for these permitted uses, including disclosures via fax.</p>
                    
                    <p className="font-semibold">I fully understand and accept these terms of consent.</p>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="newPatientConsent"
                      checked={watch("newPatientConsent") || false}
                      onCheckedChange={(checked) => setValue("newPatientConsent", !!checked)}
                      disabled={isLocked}
                    />
                    <Label htmlFor="newPatientConsent" className="text-sm leading-5 font-medium">
                      I have read and agree to the New Patient Consent terms above *
                    </Label>
                  </div>
                  {errors.newPatientConsent && (
                    <p className="text-sm text-destructive ml-6">{errors.newPatientConsent.message}</p>
                  )}
                </CardContent>
              </Card>

              {/* Assignment of Insurance Benefits */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">ASSIGNMENT OF INSURANCE BENEFITS, RELEASE, & DEMAND</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-xs leading-relaxed space-y-2 p-4 bg-muted/50 rounded-lg max-h-80 overflow-y-auto">
                    <p className="font-semibold">Insurer and Patient Please Read the Following in its Entirety Carefully!</p>
                    <p>I, <strong>{watch("patientName") || "_______________________________________________"}</strong>, the undersigned patient/insured knowingly, voluntarily and intentionally assign the rights and benefits of my automobile Insurance, a/k/a Personal Injury Protection (hereinafter PIP), Uninsured Motorist, and Medical Payments policy of insurance to the above health care provider. I understand it is the intention of the provider to accept this assignment of benefits in lieu of demanding payment at the time services are rendered. I understand this document will allow the provider to file suit against an insurer for payment of the insurance benefits or an explanation of benefits and to seek §627.428 damages from the insurer. If the provider's bills are applied to a deductible, I agree this will serve as a benefit to me. This assignment of benefits includes the cost of transportation, medications, supplies, over due interest and any potential claim for common law or statutory bad faith/unfair claims handling. If the insurer disputes the validity of this assignment of benefits then the insurer is instructed to notify the provider in writing within five days of receipt of this document. Failure to inform the provider shall result in a waiver by the insurer to contest the validity of this document. The undersigned directs the insurer to pay the health care provider the maximum amount directly without any reductions & without including the patient's name on the check. To the extent the PIP insurer contends there is a material misrepresentation on the application for insurance resulting in the policy of insurance is declared voided, rescinded, or canceled, I, as the named insured under said policy of insurance, hereby assign the right to receive the premiums paid for my PIP insurance to this provider and to file suit for recovery of the premiums. The insurer is directed to issue such a refund check payable to this provider only. Should the medical bills not exceed the premium refunded, then the provider is directed to mail the patient/named insured a check which represents the difference between the medical bills and the premiums paid.</p>
                    
                    <p className="font-semibold">Disputes:</p>
                    <p>The insurer is directed by the provider and the undersigned to not issue any checks or drafts in partial settlement of a claim that contain or are accompanied by language releasing the insurer or its insured/patient from liability unless there has been a prior written settlement agreed to by the health provider (specifically the office manager) and the insurer as to the amount payable under the insurance policy. The insured and the provider hereby contests and objects to any reductions or partial payments. Any partial or reduced payment, regardless of the accompanying language, issued by the insurer and deposited by the provider shall be done so under protest, at the risk of the insurer, and the deposit shall not be deemed a waiver, accord, satisfaction, discharge, settlement or agreement by the provider to accept a reduced amount as payment in full. The insurer is hereby placed on notice that this provider reserves the right to seek the full amount of the bills submitted. If the PIP insurer states it can pay claims at 200% of Medicare then the insurer is instructed & directed to provide this provider with a copy of the policy of insurance within 10 days. Any effort by the insurer to pay a disputed debt as full satisfaction must be mailed to the address above, after speaking with the office manager, and mailed to the specific attention of the Office Manager. See Fla. Stat. §673.3111.</p>
                    
                    <p className="font-semibold">EUOs and IMEs:</p>
                    <p>If the insurer schedules a defense examination or examination under oath (hereinafter "EUO") the insurer is hereby INSTRUCTED to send a copy of said notification to this provider. The provider or the provider's attorney is expressly authorized to appear at any EUO or IME set by the insurer. The health care provider is not the agent of the insurer or the patient for any purpose. This assignment applies to both past and future medical expenses and is valid even if undated. A photocopy of this assignment is to be considered as valid as the original. I agree to pay any applicable deductible, co-payments, for services rendered after the policy of insurance exhausts and for any other services unrelated to the automobile accident. The health care provider is given the power of attorney to: endorse my name on any check for services rendered by the above provider; and to request and obtain a copy of any statements or examinations under oath given by patient.</p>
                    
                    <p className="font-semibold">Release of information:</p>
                    <p>I authorize this provider to: furnish an insurer, an insurer's intermediary, the patient's other medical providers, and the patient's attorney via mail, fax, or email, with any and all information that may be contained in the medical records; to obtain insurance coverage information (declaration sheet & policy of insurance) in writing and telephonically from the insurer; request from any insurer all explanation of benefits (EOBs) for all providers and non-redacted PIP payout sheets; obtain any written and verbal statements the patient or anyone else provided to the insurer; obtain copies of the entire claim file, the property damage file, and all medical records, including but not limited to, documents, reports, scans, notes, bills, opinions, X-rays, IMEs, and MRIs, from any other medical provider or any insurer. The provider is permitted to produce my medical records to its attorney in connection with any pending lawsuits. The insurer is directed to keep the patient's medical records from this provider private and confidential. The insurer is not authorized to provide these medical records to anyone without the patient's and the provider's prior express written permission.</p>
                    
                    <p className="font-semibold">Demand:</p>
                    <p>Demand is hereby made for the insurer to pay all bills within 30 days without reductions and to mail the latest non-redacted PIP payout sheet and the insurance coverage declaration sheet to the above provider within 15 days. The insurer is directed to pay the bills in the order they are received. However, if a bill from this provider and a claim from anyone else is received by the insurer on the same day the insurer is directed to not apply this provider's bill to the deductible. If a bill from this provider and claim from anyone else is received by the insurer on the same day then the insurer is directed to pay this provider first before the policy is exhausted. In the event the provider's medical bills are disputed or reduced by the insurer for any reason, or amount, the insurer is to: set aside the entire amount disputed or reduced; escrow the full amount at issue; and not pay the disputed amount to anyone or any entity, including myself, until the dispute is resolved by a Court. Do not exhaust the policy. The insurer is instructed to inform, in writing, the provider of any dispute.</p>
                    
                    <p className="font-semibold">Certification:</p>
                    <p>I certify that: I have read and agree to the above; I have not been solicited or promised anything in exchange for receiving health care; I have not received any promises or guarantees from anyone as to the results that may be obtained by any treatment or service; and I agree the provider's prices for medical services, treatment and supplies are reasonable, usual and customary.</p>
                    
                    <p className="font-semibold">Caution:</p>
                    <p>Please read before signing. If you do not completely understand this document please ask us to explain it to you. If you sign below we will assume you understand and agree to the above.</p>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="insuranceAssignmentConsent"
                      checked={watch("insuranceAssignmentConsent") || false}
                      onCheckedChange={(checked) => setValue("insuranceAssignmentConsent", !!checked)}
                      disabled={isLocked}
                    />
                    <Label htmlFor="insuranceAssignmentConsent" className="text-sm leading-5 font-medium">
                      I have read and agree to the Assignment of Insurance Benefits, Release, & Demand terms above *
                    </Label>
                  </div>
                  {errors.insuranceAssignmentConsent && (
                    <p className="text-sm text-destructive ml-6">{errors.insuranceAssignmentConsent.message}</p>
                  )}
                </CardContent>
              </Card>

              {/* Notice of Emergency Medical Condition */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">NOTICE OF EMERGENCY MEDICAL CONDITION</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm leading-relaxed space-y-3 p-4 bg-muted/50 rounded-lg">
                    <p>The undersigned licensed medical provider, hereby asserts:</p>
                    <p>1. The below patient, has in the opinion of this medical provider, suffered an Emergency Medical Condition, as a result of the patient's injuries sustained in an automobile accident that occurred on <strong>{watch("accidentDate") || "________________________"}</strong>.</p>
                    <p>2. The Basis of the opinion for finding an Emergency Medical Condition is that the patient has sustained acute symptoms of sufficient severity, which may include severe pain, such that the absence of immediate medical attention could reasonably be expected to result in any of the following: a) serious jeopardy to patient health; b) serious impairment to bodily functions; or c) serious dysfunction of a bodily organ or part.</p>
                    
                    <p>The undersigned injured person or legal guardian of such person asserts:</p>
                    <p>1. The symptoms I reported to the medical provider are true and accurate.</p>
                    <p>2. I understand the medical provider has determined I sustained an Emergency Medical condition as a result of the injuries I suffered in the car accident.</p>
                    <p>3. The medical provider has explained to my satisfaction the need for future medical attention and the harmful consequences to my health which may occur if I do not receive future treatment.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="accidentDate">Date of Accident *</Label>
                      <Input
                        id="accidentDate"
                        type="date"
                        {...register("accidentDate")}
                        disabled={isLocked}
                        className={errors.accidentDate ? "border-destructive" : ""}
                      />
                      {errors.accidentDate && (
                        <p className="text-sm text-destructive">{errors.accidentDate.message}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="emergencyMedicalConsent"
                      checked={watch("emergencyMedicalConsent") || false}
                      onCheckedChange={(checked) => setValue("emergencyMedicalConsent", !!checked)}
                      disabled={isLocked}
                    />
                    <Label htmlFor="emergencyMedicalConsent" className="text-sm leading-5 font-medium">
                      I acknowledge and agree to the Notice of Emergency Medical Condition terms above *
                    </Label>
                  </div>
                  {errors.emergencyMedicalConsent && (
                    <p className="text-sm text-destructive ml-6">{errors.emergencyMedicalConsent.message}</p>
                  )}
                </CardContent>
              </Card>

              {/* Signature */}
              <Card>
                <CardHeader>
                  <CardTitle>Digital Signature</CardTitle>
                </CardHeader>
                <CardContent>
                  <SignaturePad
                    onSignatureChange={setSignature}
                    disabled={isLocked}
                    existingSignature={signature}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Navigation */}
          <div className="flex flex-col sm:flex-row gap-4">
            {currentStep > 1 && !isLocked && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                className="flex-1"
              >
                Previous
              </Button>
            )}
            
            {currentStep < totalSteps && !isLocked ? (
              <Button
                type="button"
                onClick={() => setCurrentStep(prev => Math.min(totalSteps, prev + 1))}
                className="flex-1"
              >
                Next
              </Button>
            ) : !isLocked ? (
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? "Submitting..." : "Complete & Submit"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => navigate(`/intake/complete?patientId=${patientId}`)}
                className="flex-1"
              >
                Continue
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default IntakeForms;