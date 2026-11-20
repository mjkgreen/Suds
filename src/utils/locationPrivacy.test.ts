import type * as Location from 'expo-location';
import {
  extractGPSName,
  extractNominatimName,
  placeToLocation,
  resolveLocationName,
  sanitizeGPSResult,
  sanitizeNominatimResult,
  NominatimAddress,
} from './locationPrivacy';

const barAddress: NominatimAddress = {
  amenity: 'bar',
  house_number: '123',
  road: 'Danforth Avenue',
  city: 'Toronto',
};

const homeAddress: NominatimAddress = {
  house_number: '45',
  road: 'Maple Street',
  suburb: 'Riverdale',
  city: 'Toronto',
};

const barDisplayName = 'The Wren, 123, Danforth Avenue, Toronto, Ontario, Canada';
const homeDisplayName = '45, Maple Street, Riverdale, Toronto, Ontario, Canada';

describe('extractNominatimName', () => {
  it('returns the venue name for a POI', () => {
    expect(extractNominatimName(barDisplayName, barAddress)).toBe('The Wren');
  });

  it('prefers the canonical POI name when provided', () => {
    expect(extractNominatimName(barDisplayName, barAddress, 'The Wren Danforth')).toBe(
      'The Wren Danforth'
    );
  });

  it('skips a leading house number for a POI', () => {
    const displayName = '123, Danforth Avenue, Toronto, Ontario, Canada';
    expect(extractNominatimName(displayName, barAddress)).toBe('Danforth Avenue, Toronto');
  });

  it('returns the first two parts for a non-POI address', () => {
    expect(extractNominatimName(homeDisplayName, homeAddress)).toBe('45, Maple Street');
  });
});

describe('sanitizeNominatimResult', () => {
  it('keeps venue name and coords for a POI regardless of address detail', () => {
    const result = sanitizeNominatimResult(barDisplayName, 43.68, -79.32, barAddress);
    expect(result).toEqual({ name: 'The Wren', lat: 43.68, lng: -79.32 });
  });

  it('strips coords and house number for a residential address', () => {
    const result = sanitizeNominatimResult(homeDisplayName, 43.66, -79.35, homeAddress);
    expect(result.name).toBe('Maple Street, Riverdale');
    expect(result.lat).toBeUndefined();
    expect(result.lng).toBeUndefined();
  });
});

describe('GPS results', () => {
  const barGPS = { name: 'The Wren', street: 'Danforth Ave', city: 'Toronto' } as Location.LocationGeocodedAddress;
  const homeGPS = { name: '45 Maple St', street: 'Maple St', city: 'Toronto' } as Location.LocationGeocodedAddress;

  it('extractGPSName returns venue name + city for a venue', () => {
    expect(extractGPSName(barGPS)).toBe('The Wren, Toronto');
  });

  it('extractGPSName returns an address string for a residence', () => {
    expect(extractGPSName(homeGPS)).toBe('45 Maple St, Maple St, Toronto');
  });

  it('sanitizeGPSResult keeps coords for a venue', () => {
    expect(sanitizeGPSResult(43.68, -79.32, barGPS)).toEqual({
      name: 'The Wren, Toronto',
      lat: 43.68,
      lng: -79.32,
    });
  });

  it('sanitizeGPSResult strips coords for a residence', () => {
    const result = sanitizeGPSResult(43.66, -79.35, homeGPS);
    expect(result.lat).toBeUndefined();
    expect(result.lng).toBeUndefined();
  });
});

describe('resolveLocationName', () => {
  const gpsAtBar = {
    lat: 43.68,
    lng: -79.32,
    name: 'The Wren',
    nominatim: { display_name: barDisplayName, name: 'The Wren', address: barAddress },
  };

  const gpsAtHome = {
    lat: 43.66,
    lng: -79.35,
    name: '45, Maple Street',
    nominatim: { display_name: homeDisplayName, address: homeAddress },
  };

  it('keeps the venue name and coords with privacy off', () => {
    expect(resolveLocationName(gpsAtBar, false)).toEqual({
      name: 'The Wren',
      lat: 43.68,
      lng: -79.32,
    });
  });

  it('keeps the venue name and coords with privacy on', () => {
    expect(resolveLocationName(gpsAtBar, true)).toEqual({
      name: 'The Wren',
      lat: 43.68,
      lng: -79.32,
    });
  });

  it('keeps a residential address with coords when privacy is off', () => {
    expect(resolveLocationName(gpsAtHome, false)).toEqual({
      name: '45, Maple Street',
      lat: 43.66,
      lng: -79.35,
    });
  });

  it('strips coords and house number at a residence when privacy is on', () => {
    const result = resolveLocationName(gpsAtHome, true);
    expect(result.name).toBe('Maple Street, Riverdale');
    expect(result.lat).toBeUndefined();
    expect(result.lng).toBeUndefined();
  });

  it('falls back to raw coords when nothing resolved', () => {
    const result = resolveLocationName({ lat: 43.1234567, lng: -79.7654321 }, false);
    expect(result.name).toBe('43.1235, -79.7654');
  });
});

describe('placeToLocation', () => {
  const venue = { id: 'v', name: 'Fairmont San Francisco', subtitle: '', lat: 37.79, lng: -122.41, isVenue: true, street: 'Mason Street', city: 'San Francisco' };
  const home = { id: 'h', name: '45 Maple Street', subtitle: '', lat: 43.66, lng: -79.35, isVenue: false, street: 'Maple Street', neighbourhood: 'Riverdale', city: 'Toronto' };

  it('keeps a venue with its coords, privacy on or off', () => {
    expect(placeToLocation(venue, true)).toEqual({ name: 'Fairmont San Francisco', lat: 37.79, lng: -122.41 });
    expect(placeToLocation(venue, false)).toEqual({ name: 'Fairmont San Francisco', lat: 37.79, lng: -122.41 });
  });

  it('keeps a street address as is when privacy is off', () => {
    expect(placeToLocation(home, false)).toEqual({ name: '45 Maple Street', lat: 43.66, lng: -79.35 });
  });

  it('drops the house number and coords of a street address when privacy is on', () => {
    expect(placeToLocation(home, true)).toEqual({ name: 'Maple Street, Riverdale', lat: undefined, lng: undefined });
  });

  it('prefers a venue found at the GPS fix over reverse geocoding', () => {
    expect(resolveLocationName({ lat: 37.7925, lng: -122.4105, name: '950 Mason St', venue }, false)).toEqual({
      name: 'Fairmont San Francisco',
      lat: 37.79,
      lng: -122.41,
    });
  });
});
