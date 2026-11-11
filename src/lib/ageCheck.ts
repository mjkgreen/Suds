import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { getDeviceRegion, requestAgeRange } from 'suds-age-range';
import { AgeDecision, decideAge, Jurisdiction, legalDrinkingAge, placeName } from '@/lib/drinkingAge';

export interface LegalAgeCheck extends AgeDecision {
  minimumAge: number;
  /** "Ontario", "the United States"… for messages; null if we don't know. */
  place: string | null;
}

/** Last known GPS fix we'll accept for working out where someone is. */
const MAX_LOCATION_AGE_MS = 1000 * 60 * 60 * 24;

/**
 * Where the person is, for the drinking age. Uses GPS only if location
 * permission was already granted (never prompts), then the device's region
 * setting, then the browser/OS locale.
 */
async function detectJurisdiction(): Promise<Jurisdiction> {
  if (Platform.OS !== 'web') {
    try {
      const { granted } = await Location.getForegroundPermissionsAsync();
      if (granted) {
        const position = await Location.getLastKnownPositionAsync({ maxAge: MAX_LOCATION_AGE_MS });
        if (position) {
          const [place] = await Location.reverseGeocodeAsync({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          if (place?.isoCountryCode) {
            return { country: place.isoCountryCode.toUpperCase(), subdivision: place.region ?? null };
          }
        }
      }
    } catch {
      // Fall through to the device region.
    }
  }

  const deviceRegion = getDeviceRegion();
  if (deviceRegion) return { country: deviceRegion.toUpperCase(), subdivision: null };

  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const region = /[-_]([A-Z]{2})(?:[-_]|$)/.exec(locale)?.[1];
    if (region) return { country: region, subdivision: null };
  } catch {
    // No locale information.
  }
  return { country: null, subdivision: null };
}

/**
 * Checks that someone is of legal drinking age where they are, using the
 * birthdate they entered and, on iOS 26+, the age range Apple has on file
 * (which shows Apple's sharing sheet the first time).
 */
export async function checkLegalAge(birthdate?: string | null): Promise<LegalAgeCheck> {
  const jurisdiction = await detectJurisdiction();
  const minimumAge = legalDrinkingAge(jurisdiction);
  const declared = await requestAgeRange(minimumAge);
  return {
    ...decideAge({ minimumAge, birthdate, declared }),
    minimumAge,
    place: placeName(jurisdiction),
  };
}

/** "You need to be 19 or older to use Suds in Ontario." */
export function underageMessage({ minimumAge, place }: Pick<LegalAgeCheck, 'minimumAge' | 'place'>): string {
  return `You need to be ${minimumAge} or older to use Suds${place ? ` in ${place}` : ' where you are'}.`;
}
