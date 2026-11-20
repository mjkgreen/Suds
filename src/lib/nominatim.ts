import { NominatimAddress } from '@/utils/locationPrivacy';

/**
 * OpenStreetMap Nominatim client, for reverse geocoding only. Its usage policy
 * forbids as-you-type search, so place search lives in src/lib/placeSearch.ts
 * (Apple Maps / Photon). Per the policy the app must identify itself; React
 * Native's fetch may override User-Agent, so both headers are set.
 */
const NOMINATIM_HEADERS = {
  'Accept-Language': 'en',
  'User-Agent': 'Suds/1.0 (drink logging app)',
};

export interface NominatimReverseResult {
  display_name: string;
  name?: string;
  address?: NominatimAddress;
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
