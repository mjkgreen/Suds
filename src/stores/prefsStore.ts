import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PrefsState {
  locationEnabled: boolean;
  setLocationEnabled: (enabled: boolean) => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      locationEnabled: true,
      setLocationEnabled: (enabled) => set({ locationEnabled: enabled }),
    }),
    {
      name: 'suds-prefs-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
