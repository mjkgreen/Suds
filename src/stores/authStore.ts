import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { Profile } from '@/types/models';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  /** Profile couldn't be loaded and there's no cached copy to show. */
  profileError: boolean;
  isPremium: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  setProfileError: (profileError: boolean) => void;
  setIsPremium: (isPremium: boolean) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  profileError: false,
  isPremium: true,
  setSession: (session) =>
    set({ session, user: session?.user ?? null }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  setProfileError: (profileError) => set({ profileError }),
  setIsPremium: (_isPremium) => set({ isPremium: true }),
  signOut: () => set({ session: null, user: null, profile: null, profileError: false, isPremium: true }),
}));
