import { create } from 'zustand';
import { SessionWithRole } from '@/types/models';

interface SessionState {
  activeSession: SessionWithRole | null;
  setActiveSession: (session: SessionWithRole | null) => void;
  liveActivityId: string | null;
  setLiveActivityId: (id: string | null) => void;
  liveActivityDrinkCount: number;
  setLiveActivityDrinkCount: (count: number) => void;
  liveActivityLastDrinkName: string;
  setLiveActivityLastDrinkName: (name: string) => void;
  liveActivityMemberCount: number;
  setLiveActivityMemberCount: (count: number) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeSession: null,
  setActiveSession: (activeSession) => set({ activeSession }),
  liveActivityId: null,
  setLiveActivityId: (liveActivityId) => set({ liveActivityId }),
  liveActivityDrinkCount: 0,
  setLiveActivityDrinkCount: (liveActivityDrinkCount) => set({ liveActivityDrinkCount }),
  liveActivityLastDrinkName: '',
  setLiveActivityLastDrinkName: (liveActivityLastDrinkName) => set({ liveActivityLastDrinkName }),
  liveActivityMemberCount: 1,
  setLiveActivityMemberCount: (liveActivityMemberCount) => set({ liveActivityMemberCount }),
}));
