import { useState } from 'react';
import * as Location from 'expo-location';
import { NominatimReverseResult, reverseGeocode } from '@/lib/nominatim';
import { nearbyPlaces, PlaceSuggestion } from '@/lib/placeSearch';
import { extractGPSName, extractNominatimName } from '@/utils/locationPrivacy';

/**
 * A venue this close to the GPS fix is taken as where the person is. Indoors
 * GPS is often 20–50 m off, so this stays small; anything further is offered
 * in the "Nearby" list instead of being picked automatically.
 */
const AUTO_VENUE_METRES = 35;

interface LocationResult {
  lat: number;
  lng: number;
  name?: string;
  address?: Location.LocationGeocodedAddress;
  nominatim?: NominatimReverseResult | null;
  /** The venue the person is at, when one is very close (see AUTO_VENUE_METRES). */
  venue?: PlaceSuggestion | null;
  /** Venues around the fix, nearest first, to pick from when the guess is wrong. */
  nearby: PlaceSuggestion[];
}

export function useLocation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function getCurrentLocation(): Promise<LocationResult | null> {
    setIsLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied.');
        return null;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude: lat, longitude: lng } = location.coords;

      // Nominatim resolves the nearest building/POI, so a bar comes back as the
      // bar's name; expo-location's reverse geocode (mostly address-only) is the
      // offline/rate-limited fallback.
      const [nominatim, address, nearby] = await Promise.all([
        reverseGeocode(lat, lng),
        Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
          .then((results) => results[0] as Location.LocationGeocodedAddress | undefined)
          .catch(() => undefined),
        nearbyPlaces({ lat, lng }).catch(() => [] as PlaceSuggestion[]),
      ]);

      // Apple Maps / Photon know venues (hotels, bars) better than the
      // nearest-building reverse geocode, so a venue right here wins.
      const closest = nearby[0];
      const venue = closest && (closest.distance ?? Infinity) <= AUTO_VENUE_METRES ? closest : null;

      const name = venue
        ? venue.name
        : nominatim
        ? extractNominatimName(nominatim.display_name, nominatim.address, nominatim.name)
        : address
          ? extractGPSName(address)
          : undefined;

      return { lat, lng, name, address, nominatim, venue, nearby };
    } catch (err) {
      setError('Could not get location.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  return { getCurrentLocation, isLoading, error };
}
