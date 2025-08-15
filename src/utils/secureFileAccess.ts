
import { supabase } from "@/integrations/supabase/client";

export interface SecureFileAccess {
  getSignedUrl: (path: string, expiresIn?: number) => Promise<string | null>;
  uploadFile: (file: File, path: string) => Promise<string | null>;
}

export const secureFileAccess: SecureFileAccess = {
  async getSignedUrl(path: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from('intake-forms')
        .createSignedUrl(path, expiresIn);

      if (error) {
        console.error('Error creating signed URL:', error);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Unexpected error creating signed URL:', error);
      return null;
    }
  },

  async uploadFile(file: File, path: string): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from('intake-forms')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Error uploading file:', error);
        return null;
      }

      return data.path;
    } catch (error) {
      console.error('Unexpected error uploading file:', error);
      return null;
    }
  }
};
