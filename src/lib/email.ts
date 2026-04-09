import { supabase } from './supabase';

interface SendSignupEmailOptions {
  email: string;
  username: string;
  userId: string;
}

export async function sendSignupEmail({
  email,
  username,
  userId,
}: SendSignupEmailOptions): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('send-signup-email', {
      body: {
        record: {
          id: userId,
          email,
          raw_user_meta_data: {
            username,
          },
        },
      },
    });

    if (error) {
      console.error('Failed to send signup email:', error);
      throw error;
    }

    console.log('Signup email sent successfully:', data);
  } catch (err: any) {
    console.error('Error sending signup email:', err);
    // Don't throw - signup should succeed even if email fails
    // Just log the error for monitoring
  }
}
