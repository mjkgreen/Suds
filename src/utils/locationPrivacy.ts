import type * as Location from 'expo-location';

/**
 * Nominatim address object (subset of what's returned with addressdetails=1)
 */
export interface NominatimAddress {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  postcode?: string;
  country?: string;
  // POI / venue categories — presence of ANY of these means it's a named place, not a residence
  amenity?: string;
  shop?: string;
  tourism?: string;
  leisure?: string;
  historic?: string;
  building?: string;
  office?: string;
  craft?: string;
  man_made?: string;
}

export interface SanitizedLocation {
  name: string;
  lat: number | undefined;
  lng: number | undefined;
}

/**
 * Determines whether a Nominatim address is a specific residential/private address
 * (i.e. has a house number but is NOT a named POI/venue).
 */
function isResidentialNominatim(address: NominatimAddress): boolean {
  const poiKeys = [
    'amenity', 'shop', 'tourism', 'leisure', 'historic',
    'office', 'craft', 'man_made', 'club', 'healthcare'
  ];
  const isNamedPOI = poiKeys.some((key) => !!(address as any)[key]);
  if (isNamedPOI) return false;

  // No known POI? Default to private for anything with a house_number or road.
  return !!(address.house_number || address.road);
}

/**
 * Human-readable name for a Nominatim result, regardless of privacy settings.
 * - Named venue/POI: the venue name (canonical `name` when available, otherwise
 *   the first display_name part, skipping a leading house number).
 * - Anything else: the first two display_name parts (street-level address).
 */
export function extractNominatimName(
  displayName: string,
  address?: NominatimAddress,
  poiName?: string
): string {
  const parts = displayName.split(', ');
  const isPOI = address ? !isResidentialNominatim(address) : false;

  if (isPOI) {
    if (poiName) return poiName;
    return (address?.house_number && parts[0] === address.house_number)
      ? parts.slice(1, 3).join(', ')
      : parts[0];
  }

  return parts.slice(0, 2).join(', ');
}

/**
 * Given a Nominatim result, returns a sanitized location for privacy mode.
 * - If the result is a named venue/POI: keep name + coords. (Sanitize name to exclude street numbers)
 * - If it looks like a specific address: strip coords, show only street/neighbourhood.
 */
export function sanitizeNominatimResult(
  displayName: string,
  lat: number,
  lng: number,
  address?: NominatimAddress,
  poiName?: string
): SanitizedLocation {
  const isResidential = address ? isResidentialNominatim(address) : true;

  if (!isResidential) {
    return { name: extractNominatimName(displayName, address, poiName), lat, lng };
  }

  // It's a specific address or unknown area. Strip coords.
  const parts = displayName.split(', ');
  const partsToKeep = address
    ? [address.road, address.neighbourhood || address.suburb, address.city || address.town].filter(Boolean)
    : parts.slice(1, 3);

  const name = partsToKeep.length > 0 ? partsToKeep.slice(0, 2).join(', ') : parts[0];

  return { name, lat: undefined, lng: undefined };
}

/**
 * Determines whether a GPS reverse-geocode result is a specific residential address.
 * expo-location returns `name` as the house number when you're at a home.
 */
function isResidentialGPS(address: Location.LocationGeocodedAddress): boolean {
  if (!address.name) return true;
  // If name starts with a number, it's a home address / house number (e.g. "123 Main St").
  const startsWithNumber = /^\d+/.test(address.name.trim());
  // If name matches the street name exactly, it's just a street result.
  const nameIsStreet = address.name === address.street;

  return startsWithNumber || nameIsStreet;
}

/**
 * Human-readable name for an expo-location reverse-geocode result, regardless
 * of privacy settings. Venues get "Name, City"; addresses get the street form.
 */
export function extractGPSName(address: Location.LocationGeocodedAddress): string {
  if (!isResidentialGPS(address)) {
    return [address.name, address.city].filter(Boolean).join(', ');
  }
  const street = address.name === address.street ? undefined : address.street;
  return [address.name, street, address.city].filter(Boolean).join(', ');
}

/**
 * Given a GPS reverse-geocode result, returns a sanitized location for privacy mode.
 * - If it's a named venue: keep name + coords.
 * - If it appears residential: strip coords, show only street/city.
 */
export function sanitizeGPSResult(
  lat: number,
  lng: number,
  address?: Location.LocationGeocodedAddress
): SanitizedLocation {
  const isResidential = address ? isResidentialGPS(address) : true;

  if (!isResidential && address) {
    // Recognized POI or venue. Keep name + coords.
    return { name: extractGPSName(address), lat, lng };
  }

  // Residential or unknown area. Strip coords.
  const name = address
    ? [address.street, address.subregion || address.city].filter(Boolean).join(', ')
    : `${lat.toFixed(3)}, ${lng.toFixed(3)}`;

  return { name, lat: undefined, lng: undefined };
}

interface GPSResolveInput {
  lat: number;
  lng: number;
  name?: string;
  address?: Location.LocationGeocodedAddress;
  nominatim?: {
    display_name: string;
    name?: string;
    address?: NominatimAddress;
  } | null;
}

/**
 * Single entry point for turning a GPS capture into the stored location.
 * The name is always venue-aware; coords are only stripped for residential
 * results when the hide-addresses privacy preference is on.
 */
export function resolveLocationName(result: GPSResolveInput, hideAddresses: boolean): SanitizedLocation {
  if (hideAddresses) {
    if (result.nominatim) {
      return sanitizeNominatimResult(
        result.nominatim.display_name,
        result.lat,
        result.lng,
        result.nominatim.address,
        result.nominatim.name
      );
    }
    return sanitizeGPSResult(result.lat, result.lng, result.address);
  }

  return {
    name: result.name ?? `${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}`,
    lat: result.lat,
    lng: result.lng,
  };
}
