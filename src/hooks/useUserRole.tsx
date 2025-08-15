import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type UserRole = 'admin' | 'medical_staff' | 'receptionist';

interface UserRoleData {
  role: UserRole;
  granted_at: string;
  granted_by: string | null;
}

export function useUserRole() {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<UserRoleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setUserRole(null);
      setLoading(false);
      return;
    }

    const fetchUserRole = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: roleError } = await supabase
          .from('user_roles')
          .select('role, granted_at, granted_by')
          .eq('user_id', user.id)
          .maybeSingle();

        if (roleError) {
          throw roleError;
        }

        setUserRole(data);
      } catch (err) {
        console.error('Error fetching user role:', err);
        setError('Failed to fetch user role');
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [user]);

  const hasMedicalAccess = userRole?.role === 'admin' || 
                          userRole?.role === 'medical_staff' || 
                          userRole?.role === 'receptionist';

  const isAdmin = userRole?.role === 'admin';

  return {
    userRole,
    loading,
    error,
    hasMedicalAccess,
    isAdmin,
  };
}