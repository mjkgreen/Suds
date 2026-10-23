import { useEffect } from 'react';
import { Platform } from 'react-native';
import { readStoredSession, supabase } from '@/lib/supabase';
import { clearOfflineCache, loadCachedProfile, saveCachedProfile } from '@/lib/offlineCache';
import { unregisterPushToken } from '@/hooks/useNotifications';
import { useAuthStore } from '@/stores/authStore';
import { Session } from '@supabase/supabase-js';
import { Profile } from '@/types/models';
import { sendSignupEmail } from '@/lib/email';
import * as LiveActivityBridge from 'suds-live-activity-bridge';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Initialize Google Sign-in for native platforms
if (Platform.OS !== 'web') {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (webClientId || iosClientId) {
    GoogleSignin.configure({
      webClientId,
      iosClientId,
      scopes: ['profile', 'email'],
    });
  }
}

// ── Startup ──────────────────────────────────────────────────
// Runs once per app launch (from the root layout), not once per screen.
//
// 1. Instantly, with no network: read the saved login and the cached profile.
//    A signed-in user goes straight into the app, showing cached content.
// 2. In the background: supabase-js renews the login if it has expired and we
//    refresh the profile. The 1-hour access token is renewed silently; the
//    long-lived refresh token keeps the user signed in indefinitely.
// 3. Only an explicit sign-out, or Supabase rejecting the saved login, sends
//    the user to the sign-in screen — never a slow or missing connection.

let bootstrapped = false;
let profileUserId: string | null = null;

async function fetchProfile(userId: string) {
  const { setProfile, setProfileError, setLoading } = useAuthStore.getState();
  try {
    // Body metrics and badges moved to companion tables (migration 038);
    // hydrate them back onto the own-profile object so every consumer
    // (BAC math, live activity, edit screen, badge display) is unchanged.
    const [profileRes, metricsRes, badgesRes] = await Promise.all([
      (supabase.from('profiles') as any).select('*').eq('id', userId).single(),
      (supabase.from('user_private_metrics') as any)
        .select('height, height_unit, weight, weight_unit, birthdate')
        .eq('user_id', userId)
        .maybeSingle(),
      (supabase.from('user_badges') as any).select('badge_ids').eq('user_id', userId).maybeSingle(),
    ]);
    // PGRST116 = no rows found (expected for new OAuth users without a profile yet)
    if (profileRes.error && profileRes.error.code !== 'PGRST116') throw profileRes.error;
    if (useAuthStore.getState().user?.id !== userId) return; // signed out / switched meanwhile
    if (!profileRes.data) {
      setProfile(null);
      setProfileError(false);
      return;
    }
    const profile = {
      ...(profileRes.data as any),
      ...((metricsRes.data as any) ?? {}),
      displayed_badges: (badgesRes.data as any)?.badge_ids ?? [],
    } as Profile;
    setProfile(profile);
    setProfileError(false);
    saveCachedProfile(profile);
  } catch (err) {
    console.error('fetchProfile failed:', err);
    // Keep showing the cached profile if we have one; only surface an error
    // when there's nothing to show.
    if (!useAuthStore.getState().profile) setProfileError(true);
  } finally {
    setLoading(false);
  }
}

/** Retry loading the profile (from the "couldn't load" screen). */
export function retryProfileLoad() {
  const { user, setProfileError } = useAuthStore.getState();
  if (!user) return;
  setProfileError(false);
  fetchProfile(user.id);
}

async function bootstrapAuth() {
  const { setSession, setProfile, setLoading } = useAuthStore.getState();

  // Safety net: never sit on the launch spinner forever.
  const timeout = setTimeout(() => setLoading(false), 8000);

  // 1. Saved login + cached profile, straight from the phone.
  const stored = await readStoredSession();
  if (stored) {
    setSession(stored as unknown as Session);
    const cached = await loadCachedProfile(stored.user.id);
    if (cached) {
      setProfile(cached);
      setLoading(false);
    }
  }

  // 2. Keep in sync with supabase-js from here on.
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      clearTimeout(timeout);
      setSession(session);
      // The profile doesn't change when the token is renewed — only refetch
      // for a new sign-in, a different user, or the launch refresh.
      if (event !== 'TOKEN_REFRESHED' || profileUserId !== session.user.id) {
        profileUserId = session.user.id;
        // Deferred: supabase-js warns against calling Supabase from inside
        // this callback (it holds the auth lock).
        const userId = session.user.id;
        setTimeout(() => fetchProfile(userId), 0);
      }
      // Keep the +1 widget's shared storage in sync with every token rotation this app
      // performs, so it never retries a refresh token that's already been consumed.
      if (Platform.OS === 'ios' && session.access_token && session.refresh_token) {
        LiveActivityBridge.updateSharedAuthTokens(session.access_token, session.refresh_token, session.expires_at ?? 0);
      }
      return;
    }

    // No session. A deliberate sign-out is final; otherwise (e.g. the launch
    // refresh failed because there's no connection) stay signed in as long as
    // supabase-js still has the login saved.
    void (async () => {
      if (event !== 'SIGNED_OUT' && (await readStoredSession())) {
        setLoading(false);
        return;
      }
      clearTimeout(timeout);
      profileUserId = null;
      useAuthStore.getState().signOut();
      setLoading(false);
    })();
  });
}

/** Starts auth once for the whole app. Call from the root layout only. */
export function useAuthBootstrap() {
  useEffect(() => {
    if (bootstrapped) return;
    bootstrapped = true;
    bootstrapAuth();
  }, []);
}

/** Clears everything this device kept for the signed-in user. */
async function forgetLocalData() {
  await clearOfflineCache();
  if (Platform.OS === 'ios') LiveActivityBridge.clearSharedSession();
}

export function useAuth() {
  const { session, user, profile, isLoading, signOut } = useAuthStore();

  async function signInWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUpWithEmail(email: string, password: string, username: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: `${process.env.EXPO_PUBLIC_AUTH_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')}/callback`,
      },
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
    await unregisterPushToken();
    await supabase.auth.signOut();
    await forgetLocalData();
    signOut();
  }

  async function changePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  async function deleteAccount() {
    const { error } = await supabase.rpc('delete_account');
    if (error) throw error;
    await supabase.auth.signOut({ scope: 'local' });
    await forgetLocalData();
    signOut();
  }

  async function signInWithApple() {
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${process.env.EXPO_PUBLIC_AUTH_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')}/callback`,
        },
      });
      if (error) throw error;
      return;
    }

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
            redirectTo: `${process.env.EXPO_PUBLIC_AUTH_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')}/callback`,
          },
        });
        if (error) throw error;
      } catch (error: any) {
        console.error('Google OAuth error:', error);
        throw error;
      }
      return;
    }

    // Native platform: use @react-native-google-signin/google-signin
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;

      if (!idToken) {
        throw new Error('No ID token present!');
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) throw error;
    } catch (error: any) {
      if (error.code === 'SIGN_IN_CANCELLED') {
        return;
      }
      throw error;
    }
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
