import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import * as LiveActivityBridge from 'suds-live-activity-bridge';
import { adoptNewerSharedTokens } from '@/lib/sharedAuth';
import { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env and fill in your values.',
  );
}

/** Where supabase-js saves the session (its default key, so existing logins carry over). */
export const AUTH_STORAGE_KEY = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;

// During SSR (Node.js), neither localStorage nor AsyncStorage are safe.
// Use a no-op storage so Supabase doesn't try to access browser/RN globals.
const baseStorage =
  typeof window === 'undefined'
    ? { getItem: () => null, setItem: () => {}, removeItem: () => {} }
    : Platform.OS === 'web'
      ? localStorage
      : AsyncStorage;

// On iOS, adopt a login the +1 widget renewed while the app was closed before
// supabase-js reads (and would try to renew with) the app's spent copy.
const storage =
  Platform.OS === 'ios'
    ? {
        async getItem(key: string) {
          const value = await AsyncStorage.getItem(key);
          if (key !== AUTH_STORAGE_KEY) return value;
          const adopted = adoptNewerSharedTokens(value, LiveActivityBridge.readSharedAuthTokens());
          if (!adopted) return value;
          await AsyncStorage.setItem(key, adopted);
          return adopted;
        },
        setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
        removeItem: (key: string) => AsyncStorage.removeItem(key),
      }
    : baseStorage;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    storageKey: AUTH_STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Supabase's recommended React Native setup: only renew the login in the
// background while the app is in the foreground, and renew right away when
// it comes back. Without this, renewal timers fire unreliably on a suspended
// app and the first request after resuming can go out with an expired token.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/**
 * The saved login, read straight from storage — no network. Lets the app open
 * immediately for a signed-in user instead of waiting for supabase-js to
 * renew an expired token first. Returns null if there's no saved login.
 */
export async function readStoredSession(): Promise<{ user: { id: string } } & Record<string, any> | null> {
  if (typeof window === 'undefined') return null;
  try {
    const raw = await storage.getItem(AUTH_STORAGE_KEY);
    const session = raw ? JSON.parse(raw) : null;
    return session?.user?.id && session?.refresh_token ? session : null;
  } catch {
    return null;
  }
}
