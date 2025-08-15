import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CheckCircle, Home } from "lucide-react";

const IntakeComplete = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const patientId = searchParams.get("patientId");

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-md mx-auto text-center">
        <Card>
          <CardContent className="pt-8 pb-6">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Intake Complete!
            </h1>
            
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Thank you for completing your patient intake forms. Your information has been securely submitted and will be reviewed by our medical staff.
            </p>
            
            <div className="bg-muted rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground">
                <strong>Patient ID:</strong> {patientId}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Please keep this ID for your records
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => navigate("/")}
                className="w-full"
              >
                <Home className="w-4 h-4 mr-2" />
                Return to Home
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground mt-6">
              You will receive a confirmation email shortly with next steps for your appointment.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default IntakeComplete;