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
 * Given a Nominatim result, returns a sanitized location for privacy mode.
 * - If the result is a named venue/POI: keep name + coords. (Sanitize name to exclude street numbers)
 * - If it looks like a specific address: strip coords, show only street/neighbourhood.
 */
export function sanitizeNominatimResult(
  displayName: string,
  lat: number,
  lng: number,
  address?: NominatimAddress
): SanitizedLocation {
  const isResidential = address ? isResidentialNominatim(address) : true;
  const parts = displayName.split(', ');

  if (!isResidential) {
    // It's a POI. Keep coords, but sanitize name to first part (the POI name) 
    // unless the first part IS a house number.
    const name = (address?.house_number && parts[0] === address.house_number)
      ? parts.slice(1, 3).join(', ')
      : parts[0];
    return { name, lat, lng };
  }

  // It's a specific address or unknown area. Strip coords.
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
    const name = [address.name, address.city].filter(Boolean).join(', ');
    return { name, lat, lng };
  }

  // Residential or unknown area. Strip coords.
  const name = address
    ? [address.street, address.subregion || address.city].filter(Boolean).join(', ')
    : `${lat.toFixed(3)}, ${lng.toFixed(3)}`;

  return { name, lat: undefined, lng: undefined };
}
