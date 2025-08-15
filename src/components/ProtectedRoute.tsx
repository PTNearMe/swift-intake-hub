import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { hasMedicalAccess, loading: roleLoading, error } = useUserRole();

  // Show loading while checking authentication and roles
  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verifying credentials...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  // Show access denied if user doesn't have medical access role
  if (!hasMedicalAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3 text-destructive mb-4">
              <AlertCircle className="h-6 w-6" />
              <div>
                <h3 className="font-semibold">Access Denied</h3>
                <p className="text-sm text-muted-foreground">
                  You do not have the required medical staff privileges to access this area.
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Please contact your system administrator to request appropriate access permissions.
            </p>
            <button
              onClick={() => window.location.href = '/admin/login'}
              className="w-full bg-destructive text-destructive-foreground py-2 px-4 rounded-md hover:bg-destructive/90 transition-colors"
            >
              Return to Login
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error if there was an issue loading roles
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3 text-destructive mb-4">
              <AlertCircle className="h-6 w-6" />
              <div>
                <h3 className="font-semibold">System Error</h3>
                <p className="text-sm text-muted-foreground">
                  Unable to verify your access permissions.
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 transition-colors"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};