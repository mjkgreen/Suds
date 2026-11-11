import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Apple's Declared Age Range API (iOS 26+). Everywhere else (Android, web,
 * older iOS, Expo Go) requestAgeRange resolves to { status: 'unavailable' }.
 */
export type DeclaredAgeRangeResult =
  | {
      status: 'sharing';
      /** null: below the age gate. */
      lowerBound: number | null;
      /** null: at or above the highest age gate. */
      upperBound: number | null;
      declaration?: string;
    }
  | { status: 'declined' }
  | { status: 'unavailable'; reason?: string };

type NativeModule = {
  getDeviceRegion(): string | null;
  requestAgeRange(ageGate: number): Promise<Record<string, unknown>>;
};

const Native: NativeModule | null =
  Platform.OS === 'ios' ? requireOptionalNativeModule<NativeModule>('SudsAgeRange') : null;

export function getDeviceRegion(): string | null {
  try {
    return Native?.getDeviceRegion() ?? null;
  } catch {
    return null;
  }
}

export async function requestAgeRange(ageGate: number): Promise<DeclaredAgeRangeResult> {
  if (!Native) return { status: 'unavailable', reason: 'not_ios' };
  try {
    const r = await Native.requestAgeRange(ageGate);
    if (r.status === 'sharing') {
      return {
        status: 'sharing',
        lowerBound: typeof r.lowerBound === 'number' ? r.lowerBound : null,
        upperBound: typeof r.upperBound === 'number' ? r.upperBound : null,
        declaration: typeof r.declaration === 'string' ? r.declaration : undefined,
      };
    }
    if (r.status === 'declined') return { status: 'declined' };
    return { status: 'unavailable', reason: typeof r.reason === 'string' ? r.reason : undefined };
  } catch (e) {
    return { status: 'unavailable', reason: String(e) };
  }
}
