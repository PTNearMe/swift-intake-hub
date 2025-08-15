import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, CheckCircle, Shield } from 'lucide-react';

const AdminSetup = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  const handleCreateAdmin = async () => {
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter an email address.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Call the bootstrap function
      const { error } = await supabase.rpc('create_admin_user', {
        user_email: email
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
      toast({
        title: "Admin Created Successfully",
        description: `Admin role has been granted to ${email}`,
      });
    } catch (error: any) {
      console.error('Error creating admin:', error);
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to create admin user",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full border-green-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Admin Setup Complete
              </h2>
              <p className="text-muted-foreground mb-6">
                The admin role has been successfully assigned. You can now access the admin dashboard.
              </p>
              <Button
                onClick={() => window.location.href = '/admin/login'}
                className="w-full"
              >
                Go to Admin Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Admin Setup</CardTitle>
          <p className="text-muted-foreground">
            Bootstrap the first admin user for your medical system
          </p>
        </CardHeader>
        <CardContent>
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Security Notice
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  This setup should only be used once to create the first admin user. 
                  The user must already exist in your authentication system.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Admin Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@yourdomain.com"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This user must already be registered in your system
              </p>
            </div>

            <Button
              onClick={handleCreateAdmin}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Creating Admin...' : 'Grant Admin Role'}
            </Button>
          </div>

          <div className="mt-6 text-center">
            <Button
              variant="outline"
              onClick={() => window.location.href = '/'}
              className="text-sm"
            >
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSetup;