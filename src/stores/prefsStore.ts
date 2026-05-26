import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PrefsState {
  locationEnabled: boolean;
  setLocationEnabled: (enabled: boolean) => void;
  hideAddresses: boolean;
  setHideAddresses: (hide: boolean) => void;
  // BAC preferences
  sex: 'male' | 'female';
  setSex: (sex: 'male' | 'female') => void;
  weight: number;
  setWeight: (weight: number) => void;
  weightUnit: 'kg' | 'lb';
  setWeightUnit: (unit: 'kg' | 'lb') => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      locationEnabled: true,
      setLocationEnabled: (enabled) => set({ locationEnabled: enabled }),
      hideAddresses: false,
      setHideAddresses: (hide) => set({ hideAddresses: hide }),
      // BAC preferences
      sex: 'male',
      setSex: (sex) => set({ sex }),
      weight: 150,
      setWeight: (weight) => set({ weight }),
      weightUnit: 'lb',
      setWeightUnit: (unit) => set({ weightUnit: unit }),
    }),
    {
      name: 'suds-prefs-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
