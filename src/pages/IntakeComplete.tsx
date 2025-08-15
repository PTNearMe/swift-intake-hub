
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CheckCircle, Home, ExternalLink, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const IntakeComplete = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionToken = searchParams.get("sessionToken");
  const patientId = searchParams.get("patientId");
  const [countdown, setCountdown] = useState(5);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const telemedicineUrl = "https://h1medical.doxy.me/intake1";

  const trackDoxyRedirect = async () => {
    if (patientId) {
      try {
        const { data, error } = await supabase.functions.invoke('track-doxy-redirect', {
          body: { patientId }
        });

        if (error) {
          console.error('Failed to track doxy redirect:', error);
        } else {
          console.log('Doxy redirect tracked successfully:', data);
        }
      } catch (error) {
        console.error('Error tracking doxy redirect:', error);
      }
    }
  };

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      handleAutoRedirect();
    }
  }, [countdown]);

  const handleAutoRedirect = async () => {
    setIsRedirecting(true);
    await trackDoxyRedirect();
    // Small delay to show the "Redirecting..." message
    setTimeout(() => {
      window.location.href = telemedicineUrl;
    }, 500);
  };

  const handleManualRedirect = async () => {
    await trackDoxyRedirect();
    window.open(telemedicineUrl, '_blank');
  };

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
              Thank you for completing your patient intake forms. Your information has been securely submitted and saved.
            </p>
            
            {(sessionToken || patientId) && (
              <div className="bg-muted rounded-lg p-4 mb-6">
                <p className="text-sm text-muted-foreground">
                  <strong>Session:</strong> {sessionToken || patientId}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Please keep this reference for your records
                </p>
              </div>
            )}

            {/* Countdown and Redirect Section */}
            <div className="bg-primary/10 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center mb-3">
                <Clock className="w-5 h-5 text-primary mr-2" />
                <span className="font-semibold text-primary">Next Step: Telemedicine Session</span>
              </div>
              
              {!isRedirecting ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Redirecting you to your telemedicine session in:
                  </p>
                  <div className="text-3xl font-bold text-primary mb-3">
                    {countdown}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Please ensure your camera and microphone are ready
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-primary font-medium">
                    Redirecting to telemedicine platform...
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleManualRedirect}
                className="w-full"
                variant="outline"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Telemedicine Session Manually
              </Button>
              
              <Button
                onClick={() => navigate("/")}
                variant="ghost"
                size="sm"
                className="w-full"
              >
                <Home className="w-4 h-4 mr-2" />
                Return to Home Instead
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground mt-6">
              If the automatic redirect doesn't work, please use the manual link above to join your telemedicine session.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default IntakeComplete;
