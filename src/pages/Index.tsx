import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { User, Edit3, Video, Clock, Shield, Smartphone } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section - Full Width, Mobile-First */}
      <section className="w-full bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="container mx-auto px-4 py-12 md:py-20">
          <div className="max-w-4xl mx-auto text-center">
            {/* Main Heading */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
              Doctor in <span className="text-primary">2 Minutes</span>
            </h1>
            
            {/* Subheading */}
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
              Start your intake now. A licensed provider will join you for a same-day telemedicine consult—typically within 2 minutes.
            </p>
            
            {/* Primary CTA Button */}
            <div className="mb-3">
              <Button 
                onClick={() => navigate("/intake/start")}
                size="lg"
                className="px-12 py-6 text-xl font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 min-h-[60px]"
                aria-label="Start medical intake process"
              >
                Start Intake Now
              </Button>
            </div>
            
            {/* Tiny Caption */}
            <p className="text-sm text-muted-foreground/80">
              No app needed. Works on any phone.
            </p>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <section className="w-full bg-muted/30 border-y">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-center">
            <p className="text-sm text-muted-foreground text-center">
              Private & secure <span className="mx-2">•</span> Licensed U.S. clinicians <span className="mx-2">•</span> Mobile friendly
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="w-full py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-12">
              How It Works
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Card 1: Enter Info */}
              <Card className="text-center border-2 hover:border-primary/50 transition-colors duration-200">
                <CardContent className="pt-8 pb-6">
                  <div className="w-16 h-16 bg-primary/10 rounded-full mx-auto mb-6 flex items-center justify-center">
                    <User className="w-8 h-8 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">
                    Enter your info
                  </h3>
                  <p className="text-muted-foreground">
                    name & phone (≈1 minute)
                  </p>
                </CardContent>
              </Card>

              {/* Card 2: Sign Intake */}
              <Card className="text-center border-2 hover:border-primary/50 transition-colors duration-200">
                <CardContent className="pt-8 pb-6">
                  <div className="w-16 h-16 bg-primary/10 rounded-full mx-auto mb-6 flex items-center justify-center">
                    <Edit3 className="w-8 h-8 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">
                    Sign intake
                  </h3>
                  <p className="text-muted-foreground">
                    mobile e-signature (≈1 minute)
                  </p>
                </CardContent>
              </Card>

              {/* Card 3: See Doctor */}
              <Card className="text-center border-2 hover:border-primary/50 transition-colors duration-200">
                <CardContent className="pt-8 pb-6">
                  <div className="w-16 h-16 bg-primary/10 rounded-full mx-auto mb-6 flex items-center justify-center">
                    <Video className="w-8 h-8 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">
                    See the doctor
                  </h3>
                  <p className="text-muted-foreground">
                    we connect you immediately
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Reassurance Section */}
      <section className="w-full py-12 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-8">
              What to Expect
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-primary mt-1 flex-shrink-0" aria-hidden="true" />
                <p className="text-muted-foreground">
                  <strong className="text-foreground">What to expect:</strong> A brief video consult to review symptoms and next steps.
                </p>
              </div>
              
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-primary mt-1 flex-shrink-0" aria-hidden="true" />
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Time to complete:</strong> Most patients are seeing a provider in about 2 minutes after starting intake.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Compact FAQ Section */}
      <section className="w-full py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-8">
              Frequently Asked Questions
            </h2>
            
            <Accordion type="single" collapsible className="space-y-2">
              <AccordionItem value="account" className="border rounded-lg px-4">
                <AccordionTrigger className="text-left hover:no-underline py-4">
                  <span className="font-medium">Do I need an account?</span>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  No—just complete intake and join the visit.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="secure" className="border rounded-lg px-4">
                <AccordionTrigger className="text-left hover:no-underline py-4">
                  <span className="font-medium">Is this secure?</span>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  Encrypted transmission and strict access controls.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="mobile" className="border rounded-lg px-4">
                <AccordionTrigger className="text-left hover:no-underline py-4">
                  <span className="font-medium">Phone compatible?</span>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  Yes—optimized for iPhone and Android.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="w-full py-16 bg-gradient-to-r from-primary/10 to-accent/10">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Ready to See a Doctor?
            </h2>
            <p className="text-muted-foreground mb-8">
              Get started now—most patients connect with a provider within 2 minutes.
            </p>
            <Button 
              onClick={() => navigate("/intake/start")}
              size="lg"
              className="px-10 py-5 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              aria-label="Start medical intake process now"
            >
              Start Intake Now
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
