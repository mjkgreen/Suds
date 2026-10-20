import { useState } from 'react';
import * as Location from 'expo-location';
import { NominatimReverseResult, reverseGeocode } from '@/lib/nominatim';
import { extractGPSName, extractNominatimName } from '@/utils/locationPrivacy';

interface LocationResult {
  lat: number;
  lng: number;
  name?: string;
  address?: Location.LocationGeocodedAddress;
  nominatim?: NominatimReverseResult | null;
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
      const [nominatim, address] = await Promise.all([
        reverseGeocode(lat, lng),
        Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
          .then((results) => results[0] as Location.LocationGeocodedAddress | undefined)
          .catch(() => undefined),
      ]);

      const name = nominatim
        ? extractNominatimName(nominatim.display_name, nominatim.address, nominatim.name)
        : address
          ? extractGPSName(address)
          : undefined;

      return { lat, lng, name, address, nominatim };
    } catch (err) {
      setError('Could not get location.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  return { getCurrentLocation, isLoading, error };
}
