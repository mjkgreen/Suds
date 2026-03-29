import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env and fill in your values.',
  );
}

// During SSR (Node.js), neither localStorage nor AsyncStorage are safe.
// Use a no-op storage so Supabase doesn't try to access browser/RN globals.
const storage =
  typeof window === 'undefined'
    ? { getItem: () => null, setItem: () => {}, removeItem: () => {} }
    : Platform.OS === 'web'
      ? localStorage
      : AsyncStorage;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
