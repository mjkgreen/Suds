import { create } from 'zustand';
import { SessionWithRole } from '@/types/models';

interface SessionState {
  activeSession: SessionWithRole | null;
  setActiveSession: (session: SessionWithRole | null) => void;
  liveActivityId: string | null;
  setLiveActivityId: (id: string | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeSession: null,
  setActiveSession: (activeSession) => set({ activeSession }),
  liveActivityId: null,
  setLiveActivityId: (liveActivityId) => set({ liveActivityId }),
}));
