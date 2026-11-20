import { Platform } from 'react-native';
import * as ApplePlaces from 'suds-place-search';
import type { ApplePlace } from 'suds-place-search';

/**
 * Place search for the location picker.
 *
 *   • iOS: Apple Maps (MapKit, the suds-place-search module). Free, no key,
 *     and the same venues people see in Apple Maps.
 *   • Web, Android, and iOS builds without the module: Photon
 *     (photon.komoot.io), an OpenStreetMap search built for as-you-type
 *     suggestions. Nominatim's usage policy forbids that, so it is only used
 *     for reverse geocoding now (src/lib/nominatim.ts).
 *
 * Both are biased to where the person is, so local venues come first.
 */
export interface PlaceSuggestion {
  id: string;
  /** Venue name, or the street address for an address result. */
  name: string;
  /** Second line in the list, e.g. "Nob Hill, San Francisco". */
  subtitle: string;
  lat: number;
  lng: number;
  /** A named place (bar, hotel, …) rather than someone's street address. */
  isVenue: boolean;
  street?: string;
  neighbourhood?: string;
  city?: string;
  /** Metres from the person, when known. */
  distance?: number;
}

export type LatLng = { lat: number; lng: number };

const SEARCH_LIMIT = 10;

// ── Apple ───────────────────────────────────────────────────

export function fromApple(p: ApplePlace, index: number): PlaceSuggestion | null {
  if (!p.name || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return null;
  const area = p.neighbourhood && p.neighbourhood !== p.city ? `${p.neighbourhood}, ${p.city ?? ''}` : p.city;
  const subtitleParts = p.isVenue
    ? [p.street, area ?? p.region]
    : [p.street && p.street !== p.name ? p.street : undefined, area ?? p.region];
  return {
    id: `apple:${p.lat.toFixed(6)},${p.lng.toFixed(6)}:${index}`,
    name: p.name,
    subtitle: subtitleParts.filter(Boolean).join(', ').replace(/, $/, ''),
    lat: p.lat,
    lng: p.lng,
    isVenue: p.isVenue,
    street: p.road,
    neighbourhood: p.neighbourhood,
    city: p.city,
    distance: p.distance,
  };
}

// ── Photon ──────────────────────────────────────────────────

const PHOTON_URL = 'https://photon.komoot.io';

/** OSM keys whose features are named places rather than addresses or areas. */
const VENUE_KEYS = new Set(['amenity', 'tourism', 'shop', 'leisure', 'historic', 'craft', 'office', 'club']);

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    osm_key?: string;
    osm_value?: string;
    type?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    district?: string;
    locality?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

export function fromPhoton(f: PhotonFeature, near?: LatLng | null): PlaceSuggestion | null {
  const p = f.properties;
  const [lng, lat] = f.geometry?.coordinates ?? [];
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const street = [p.housenumber, p.street].filter(Boolean).join(' ') || undefined;
  const isVenue = !!p.name && !!p.osm_key && VENUE_KEYS.has(p.osm_key);
  const name = p.name || street;
  if (!name) return null;
  const neighbourhood = p.district || p.locality;
  const area = [neighbourhood, p.city].filter(Boolean).join(', ') || p.state;
  const subtitle = [name === street ? undefined : street, area, p.city ? undefined : p.country]
    .filter(Boolean)
    .join(', ');

  return {
    id: `photon:${p.osm_type ?? ''}${p.osm_id ?? `${lat},${lng}`}`,
    name,
    subtitle,
    lat,
    lng,
    isVenue,
    street: p.street,
    neighbourhood,
    city: p.city,
    distance: near ? distanceMetres(near, { lat, lng }) : undefined,
  };
}

async function fetchJson(url: string, timeoutMs = 8000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    return res.ok ? await res.json() : null;
  } finally {
    clearTimeout(timer);
  }
}

async function photon(path: string, params: Record<string, string | number>, near?: LatLng | null) {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  try {
    const data = (await fetchJson(`${PHOTON_URL}${path}?${qs}`)) as { features?: PhotonFeature[] } | null;
    return (data?.features ?? []).map((f) => fromPhoton(f, near)).filter((p): p is PlaceSuggestion => !!p);
  } catch {
    return [];
  }
}

// ── Public API ──────────────────────────────────────────────

/** Venues and addresses matching `query`, nearest-relevant first. */
export async function searchPlaces(query: string, near?: LatLng | null): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  if (Platform.OS === 'ios' && ApplePlaces.isAvailable) {
    const results = (await ApplePlaces.search(q, near))
      .map(fromApple)
      .filter((p): p is PlaceSuggestion => !!p);
    if (results.length > 0) return dedupe(results).slice(0, SEARCH_LIMIT);
  }

  const params: Record<string, string | number> = { q, limit: SEARCH_LIMIT, lang: 'en' };
  if (near) {
    params.lat = near.lat;
    params.lon = near.lng;
  }
  return dedupe(await photon('/api/', params, near)).slice(0, SEARCH_LIMIT);
}

/** Venues around a point, nearest first: "where are you?" after a GPS fix. */
export async function nearbyPlaces(at: LatLng, radiusMetres = 150): Promise<PlaceSuggestion[]> {
  if (Platform.OS === 'ios' && ApplePlaces.isAvailable) {
    const results = (await ApplePlaces.nearby(at.lat, at.lng, radiusMetres))
      .map(fromApple)
      .filter((p): p is PlaceSuggestion => !!p && p.isVenue);
    if (results.length > 0) return results;
  }

  // Photon's reverse lookup returns the closest features; keep named venues.
  const results = await photon(
    '/reverse',
    { lat: at.lat, lon: at.lng, limit: 15, radius: radiusMetres / 1000, lang: 'en' },
    at,
  );
  return dedupe(results.filter((p) => p.isVenue)).sort(
    (a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity),
  );
}

/** Same name at (nearly) the same spot: keep the first. */
export function dedupe(places: PlaceSuggestion[]): PlaceSuggestion[] {
  const seen = new Set<string>();
  return places.filter((p) => {
    const key = `${p.name.toLowerCase()}|${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function distanceMetres(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
