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
  
  // Medical History
  currentMedications: z.string(),
  allergies: z.string(),
  medicalHistory: z.string(),
  
  // Insurance Information
  insuranceProvider: z.string().min(1, "Insurance provider is required"),
  policyNumber: z.string().min(1, "Policy number is required"),
  groupNumber: z.string(),
  
  // Consents
  consentTreatment: z.boolean().refine(val => val === true, "Treatment consent is required"),
  consentPrivacy: z.boolean().refine(val => val === true, "Privacy consent is required"),
  consentFinancial: z.boolean().refine(val => val === true, "Financial consent is required"),
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
  const totalSteps = 4;

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
    if (!patientId) return;

    try {
      const { data, error } = await supabase
        .from("intake_forms")
        .select("*")
        .eq("patient_id", patientId)
        .maybeSingle();

      if (error) {
        console.error("Error checking existing forms:", error);
        return;
      }

      if (data) {
        setExistingForm(data);
        setIsLocked(!!data.signed_at);
        setPdfUrl(data.pdf_url || null);
        
        // Populate form with existing data
        if (data.form_data) {
          Object.entries(data.form_data).forEach(([key, value]) => {
            if (key === 'signature') {
              setSignature(value as string);
            } else {
              setValue(key as keyof FormData, value as any);
            }
          });
        }
      }
    } catch (error) {
      console.error("Error fetching existing forms:", error);
    }
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

      const { data: insertedForm, error } = await supabase
        .from("intake_forms")
        .insert([
          {
            patient_id: patientId,
            form_data: formData,
            signed_at: new Date().toISOString(),
            fax_sent: false,
            email_sent: false,
          },
        ])
        .select()
        .single();

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

      console.log("Form saved successfully:", insertedForm);

      setIsLocked(true);

      // Send email notification with form data
      try {
        console.log("Sending email notification for form:", insertedForm.id);
        const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-intake-email', {
          body: { intakeFormId: insertedForm.id }
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

          {/* Medical History */}
          {currentStep >= 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  <span>Medical History</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentMedications">Current Medications</Label>
                  <Textarea
                    id="currentMedications"
                    placeholder="List all medications you are currently taking"
                    {...register("currentMedications")}
                    disabled={isLocked}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="allergies">Allergies</Label>
                  <Textarea
                    id="allergies"
                    placeholder="List any known allergies"
                    {...register("allergies")}
                    disabled={isLocked}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="medicalHistory">Previous Medical History</Label>
                  <Textarea
                    id="medicalHistory"
                    placeholder="Describe any previous medical conditions or surgeries"
                    {...register("medicalHistory")}
                    disabled={isLocked}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Insurance Information */}
          {currentStep >= 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <span>Insurance Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="insuranceProvider">Insurance Provider *</Label>
                  <Input
                    id="insuranceProvider"
                    placeholder="e.g., Blue Cross Blue Shield"
                    {...register("insuranceProvider")}
                    disabled={isLocked}
                    className={errors.insuranceProvider ? "border-destructive" : ""}
                  />
                  {errors.insuranceProvider && (
                    <p className="text-sm text-destructive">{errors.insuranceProvider.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="policyNumber">Policy Number *</Label>
                    <Input
                      id="policyNumber"
                      {...register("policyNumber")}
                      disabled={isLocked}
                      className={errors.policyNumber ? "border-destructive" : ""}
                    />
                    {errors.policyNumber && (
                      <p className="text-sm text-destructive">{errors.policyNumber.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="groupNumber">Group Number</Label>
                    <Input
                      id="groupNumber"
                      {...register("groupNumber")}
                      disabled={isLocked}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Consents and Signature */}
          {currentStep >= 4 && (
            <Card>
              <CardHeader>
                <CardTitle>Consents & Signature</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="consentTreatment"
                      checked={watch("consentTreatment") || false}
                      onCheckedChange={(checked) => setValue("consentTreatment", !!checked)}
                      disabled={isLocked}
                    />
                    <Label htmlFor="consentTreatment" className="text-sm leading-5">
                      I consent to treatment and authorize the healthcare provider to perform necessary medical procedures.
                    </Label>
                  </div>
                  {errors.consentTreatment && (
                    <p className="text-sm text-destructive ml-6">{errors.consentTreatment.message}</p>
                  )}

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="consentPrivacy"
                      checked={watch("consentPrivacy") || false}
                      onCheckedChange={(checked) => setValue("consentPrivacy", !!checked)}
                      disabled={isLocked}
                    />
                    <Label htmlFor="consentPrivacy" className="text-sm leading-5">
                      I acknowledge that I have received and understand the Notice of Privacy Practices.
                    </Label>
                  </div>
                  {errors.consentPrivacy && (
                    <p className="text-sm text-destructive ml-6">{errors.consentPrivacy.message}</p>
                  )}

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="consentFinancial"
                      checked={watch("consentFinancial") || false}
                      onCheckedChange={(checked) => setValue("consentFinancial", !!checked)}
                      disabled={isLocked}
                    />
                    <Label htmlFor="consentFinancial" className="text-sm leading-5">
                      I understand and agree to the financial responsibilities and payment policies.
                    </Label>
                  </div>
                  {errors.consentFinancial && (
                    <p className="text-sm text-destructive ml-6">{errors.consentFinancial.message}</p>
                  )}
                </div>

                <SignaturePad
                  onSignatureChange={setSignature}
                  disabled={isLocked}
                  existingSignature={signature}
                />
              </CardContent>
            </Card>
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