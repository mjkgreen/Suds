import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PrefsState {
  locationEnabled: boolean;
  setLocationEnabled: (enabled: boolean) => void;
  hideAddresses: boolean;
  setHideAddresses: (hide: boolean) => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      locationEnabled: true,
      setLocationEnabled: (enabled) => set({ locationEnabled: enabled }),
      hideAddresses: false,
      setHideAddresses: (hide) => set({ hideAddresses: hide }),
    }),
    {
      name: 'suds-prefs-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
