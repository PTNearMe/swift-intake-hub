
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface AuditLogEntry {
  action: string;
  tableName: string;
  recordId?: string;
  oldValues?: any;
  newValues?: any;
}

export function useAuditLog() {
  const { user } = useAuth();

  const logAction = async (entry: AuditLogEntry) => {
    try {
      // Get client IP and user agent (limited in browser context)
      const userAgent = navigator.userAgent;
      
      const { error } = await supabase
        .from('audit_logs')
        .insert([
          {
            user_id: user?.id || null,
            action: entry.action,
            table_name: entry.tableName,
            record_id: entry.recordId,
            old_values: entry.oldValues,
            new_values: entry.newValues,
            user_agent: userAgent,
            // IP address will be null as we can't reliably get it from browser
            ip_address: null
          }
        ]);

      if (error) {
        console.error('Failed to log audit entry:', error);
      }
    } catch (error) {
      console.error('Error logging audit entry:', error);
    }
  };

  const logPatientAccess = async (patientId: string, action: 'VIEW' | 'UPDATE' | 'DELETE') => {
    await logAction({
      action: `PATIENT_${action}`,
      tableName: 'patients',
      recordId: patientId
    });
  };

  const logIntakeFormAccess = async (formId: string, action: 'VIEW' | 'UPDATE' | 'DELETE', oldData?: any, newData?: any) => {
    await logAction({
      action: `INTAKE_FORM_${action}`,
      tableName: 'intake_forms',
      recordId: formId,
      oldValues: oldData,
      newValues: newData
    });
  };

  return {
    logAction,
    logPatientAccess,
    logIntakeFormAccess
  };
}
