import { create } from 'zustand';
import { Session } from '@/types/models';

interface SessionState {
  activeSession: Session | null;
  setActiveSession: (session: Session | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeSession: null,
  setActiveSession: (activeSession) => set({ activeSession }),
}));
