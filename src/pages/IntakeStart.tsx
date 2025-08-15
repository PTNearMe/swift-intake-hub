import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

// US phone number validation regex (matches formats like: (123) 456-7890, 123-456-7890, 123.456.7890, 1234567890)
const phoneRegex = /^(\+1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/;

const formSchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  phone: z.string().regex(phoneRegex, "Please enter a valid US phone number"),
});

type FormData = z.infer<typeof formSchema>;

const IntakeStart = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    
    try {
      // Generate UUID client-side so we don't need to SELECT it back
      const patientId = uuidv4();
      
      const { error } = await supabase
        .from("patients")
        .insert([
          {
            id: patientId,
            name: data.name,
            phone: data.phone,
          },
        ]);

      if (error) {
        console.error("Error creating patient:", error);
        toast({
          title: "Error",
          description: "Failed to create patient record. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Navigate to forms page with patient ID
      navigate(`/intake/forms?patientId=${patientId}`);
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

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl md:text-3xl font-bold text-foreground">
              Patient Information
            </CardTitle>
            <p className="text-muted-foreground">
              Let's start by collecting your basic information
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-foreground">
                  Full Name *
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  {...register("name")}
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Phone Field */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium text-foreground">
                  Phone Number *
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  {...register("phone")}
                  className={errors.phone ? "border-destructive" : ""}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.phone.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Please enter a US phone number
                </p>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full py-6 text-lg font-semibold"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating Record..." : "Continue to Forms"}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        {/* Back to Home Link */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate("/")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntakeStart;