import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

/**
 * Apple Maps place search (MapKit) on iOS. Elsewhere, or on builds without
 * the native module, `isAvailable` is false and callers use Photon instead.
 * Results are raw; src/lib/placeSearch.ts turns them into PlaceSuggestions.
 */
export type ApplePlace = {
  name: string;
  lat: number;
  lng: number;
  /** A named place (bar, hotel, …) rather than a street address. */
  isVenue: boolean;
  street?: string;
  road?: string;
  houseNumber?: string;
  neighbourhood?: string;
  city?: string;
  region?: string;
  country?: string;
  /** MKPointOfInterestCategory raw value, e.g. "MKPOICategoryNightlife". */
  category?: string;
  /** Metres from the point the search was centred on. */
  distance?: number;
};

type NativeModule = {
  search(query: string, lat: number | null, lng: number | null): Promise<ApplePlace[]>;
  nearby(lat: number, lng: number, radius: number): Promise<ApplePlace[]>;
};

const Native: NativeModule | null =
  Platform.OS === 'ios' ? requireOptionalNativeModule<NativeModule>('SudsPlaceSearch') : null;

export const isAvailable = !!Native;

export async function search(query: string, near?: { lat: number; lng: number } | null): Promise<ApplePlace[]> {
  if (!Native) return [];
  try {
    return await Native.search(query, near?.lat ?? null, near?.lng ?? null);
  } catch {
    return [];
  }
}

export async function nearby(lat: number, lng: number, radius = 150): Promise<ApplePlace[]> {
  if (!Native) return [];
  try {
    return await Native.nearby(lat, lng, radius);
  } catch {
    return [];
  }
}
