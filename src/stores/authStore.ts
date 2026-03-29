import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { Profile } from '@/types/models';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isPremium: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  setIsPremium: (isPremium: boolean) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isPremium: false,
  setSession: (session) =>
    set({ session, user: session?.user ?? null }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  setIsPremium: (isPremium) => set({ isPremium }),
  signOut: () => set({ session: null, user: null, profile: null, isPremium: false }),
}));
