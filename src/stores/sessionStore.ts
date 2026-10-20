import { create } from 'zustand';
import { SessionWithRole } from '@/types/models';

interface SessionState {
  activeSession: SessionWithRole | null;
  setActiveSession: (session: SessionWithRole | null) => void;
  liveActivityId: string | null;
  setLiveActivityId: (id: string | null) => void;
  /** The user's own drinks — drives BAC and pace on the Live Activity */
  liveActivityDrinkCount: number;
  setLiveActivityDrinkCount: (count: number) => void;
  /** All drinks in the session across members */
  liveActivityGroupDrinkCount: number;
  setLiveActivityGroupDrinkCount: (count: number) => void;
  liveActivityLastDrinkName: string;
  setLiveActivityLastDrinkName: (name: string) => void;
  liveActivityMemberCount: number;
  setLiveActivityMemberCount: (count: number) => void;
  liveActivityMemberNames: string;
  setLiveActivityMemberNames: (names: string) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeSession: null,
  setActiveSession: (activeSession) => set({ activeSession }),
  liveActivityId: null,
  setLiveActivityId: (liveActivityId) => set({ liveActivityId }),
  liveActivityDrinkCount: 0,
  setLiveActivityDrinkCount: (liveActivityDrinkCount) => set({ liveActivityDrinkCount }),
  liveActivityGroupDrinkCount: 0,
  setLiveActivityGroupDrinkCount: (liveActivityGroupDrinkCount) => set({ liveActivityGroupDrinkCount }),
  liveActivityLastDrinkName: '',
  setLiveActivityLastDrinkName: (liveActivityLastDrinkName) => set({ liveActivityLastDrinkName }),
  liveActivityMemberCount: 1,
  setLiveActivityMemberCount: (liveActivityMemberCount) => set({ liveActivityMemberCount }),
  liveActivityMemberNames: '',
  setLiveActivityMemberNames: (liveActivityMemberNames) => set({ liveActivityMemberNames }),
}));
