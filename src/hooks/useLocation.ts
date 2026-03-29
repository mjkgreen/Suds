import { useState } from 'react';
import * as Location from 'expo-location';

interface LocationResult {
  lat: number;
  lng: number;
  name?: string;
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

      // Reverse geocode for a human-readable name
      const [address] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const name = address
        ? [address.name, address.street, address.city].filter(Boolean).join(', ')
        : undefined;

      return { lat, lng, name };
    } catch (err) {
      setError('Could not get location.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  return { getCurrentLocation, isLoading, error };
}
