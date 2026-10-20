import { NominatimAddress } from '@/utils/locationPrivacy';

/**
 * OpenStreetMap Nominatim client. Per the usage policy the app must identify
 * itself; React Native's fetch may override User-Agent, so both headers are set.
 */
const NOMINATIM_HEADERS = {
  'Accept-Language': 'en',
  'User-Agent': 'Suds/1.0 (drink logging app)',
};

export interface NominatimSearchResult {
  place_id: number;
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
}

export interface NominatimReverseResult {
  display_name: string;
  name?: string;
  address?: NominatimAddress;
}

export async function searchPlaces(query: string): Promise<NominatimSearchResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) return [];
  return res.json();
}

/**
 * Reverse geocode to the nearest building/POI (zoom=18), so standing at a bar
 * resolves to the bar itself rather than a street address.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<NominatimReverseResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1&zoom=18`;
    const res = await fetch(url, { headers: NOMINATIM_HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.display_name) return null;
    return data;
  } catch {
    return null;
  }
}
