import { useEffect } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { Profile } from '@/types/models';
import { sendSignupEmail } from '@/lib/email';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

export function useAuth() {
  const { session, user, profile, isLoading, setSession, setProfile, setLoading, signOut } =
    useAuthStore();

  useEffect(() => {
    // Safety timeout: if auth hasn't resolved in 8 seconds, unblock the app.
    // This handles stale/invalid sessions that cause Supabase's token-refresh
    // network call to hang (e.g. CORS issues, wrong URL, no network).
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 8000);

    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      },
    );

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      // PGRST116 = no rows found (expected for new OAuth users without a profile yet)
      if (error && error.code !== 'PGRST116') throw error;
      setProfile(data as Profile | null);
    } catch (err) {
      console.error('fetchProfile failed:', err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  async function signInWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUpWithEmail(email: string, password: string, username: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (error) throw error;

    // Send welcome email via Resend (non-blocking)
    if (data.user?.id) {
      sendSignupEmail({
        userId: data.user.id,
        email,
        username,
      });
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    signOut();
  }

  async function changePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  async function deleteAccount() {
    const { error } = await supabase.rpc('delete_account');
    if (error) throw error;
    signOut();
  }

  async function signInWithApple() {
    try {
      const rawNonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
          nonce: rawNonce,
        });

        if (error) {
          throw error;
        }
      } else {
        throw new Error('No identityToken.');
      }
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') {
        // User canceled the sign-in
        return;
      }
      throw e;
    }
  }

  async function signInWithGoogle() {
    // Web platform: use Supabase OAuth
    if (Platform.OS === 'web') {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/callback`,
          },
        });
        if (error) throw error;
      } catch (error: any) {
        console.error('Google OAuth error:', error);
        throw error;
      }
      return;
    }

    // Native platform only - this code never runs on web
    throw new Error('Google Sign-In on native is not yet configured');
  }

  return {
    session,
    user,
    profile,
    isLoading,
    signInWithEmail,
    signUpWithEmail,
    signInWithApple,
    signInWithGoogle,
    signOut: handleSignOut,
    changePassword,
    deleteAccount,
  };
}
