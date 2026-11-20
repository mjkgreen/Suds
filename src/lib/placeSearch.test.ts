jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('suds-place-search', () => ({ isAvailable: false, search: jest.fn(), nearby: jest.fn() }));

import { dedupe, distanceMetres, fromApple, fromPhoton, nearbyPlaces, searchPlaces } from './placeSearch';

const fairmontPhoton = {
  geometry: { coordinates: [-122.4103, 37.7924] as [number, number] },
  properties: {
    osm_id: 1, osm_type: 'W', osm_key: 'tourism', osm_value: 'hotel', name: 'Fairmont San Francisco',
    housenumber: '950', street: 'Mason Street', district: 'Nob Hill', city: 'San Francisco', country: 'United States',
  },
};

describe('fromPhoton', () => {
  it('reads a hotel as a venue with its street and area', () => {
    const p = fromPhoton(fairmontPhoton, { lat: 37.7925, lng: -122.4105 })!;
    expect(p.name).toBe('Fairmont San Francisco');
    expect(p.isVenue).toBe(true);
    expect(p.subtitle).toBe('950 Mason Street, Nob Hill, San Francisco');
    expect(p.lat).toBeCloseTo(37.7924);
    expect(p.distance).toBeLessThan(50);
  });

  it('reads a house as an address, named by its street', () => {
    const p = fromPhoton({
      geometry: { coordinates: [-79.35, 43.66] },
      properties: { osm_key: 'building', housenumber: '45', street: 'Maple Street', city: 'Toronto' },
    })!;
    expect(p.isVenue).toBe(false);
    expect(p.name).toBe('45 Maple Street');
    expect(p.subtitle).toBe('Toronto');
  });

  it('skips features without a name or street', () => {
    expect(fromPhoton({ geometry: { coordinates: [0, 0] }, properties: { osm_key: 'place' } })).toBeNull();
  });
});

describe('fromApple', () => {
  it('maps a MapKit venue', () => {
    const p = fromApple(
      { name: 'Fairmont San Francisco', lat: 37.79, lng: -122.41, isVenue: true, street: '950 Mason St', road: 'Mason St', neighbourhood: 'Nob Hill', city: 'San Francisco', distance: 20 },
      0,
    )!;
    expect(p).toMatchObject({ name: 'Fairmont San Francisco', isVenue: true, street: 'Mason St', distance: 20 });
    expect(p.subtitle).toBe('950 Mason St, Nob Hill, San Francisco');
  });
});

describe('dedupe', () => {
  it('drops the same place listed twice', () => {
    const a = fromPhoton(fairmontPhoton)!;
    expect(dedupe([a, { ...a, id: 'other' }])).toHaveLength(1);
  });
});

describe('distanceMetres', () => {
  it('is about 111 km per degree of latitude', () => {
    expect(distanceMetres({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111195, -2);
  });
});

describe('Photon requests', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
  });

  it('biases search to the person and asks for 10 results', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ features: [fairmontPhoton] }) });
    const results = await searchPlaces('Fairmont', { lat: 37.79, lng: -122.41 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('photon.komoot.io/api/?q=Fairmont');
    expect(url).toContain('lat=37.79');
    expect(url).toContain('lon=-122.41');
    expect(url).toContain('limit=10');
    expect(results.map((r) => r.name)).toEqual(['Fairmont San Francisco']);
  });

  it('does not search for a single character', async () => {
    expect(await searchPlaces('F')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns nearby venues only, nearest first', async () => {
    const far = { ...fairmontPhoton, geometry: { coordinates: [-122.412, 37.7924] as [number, number] }, properties: { ...fairmontPhoton.properties, osm_id: 2, name: 'Tonga Room', osm_key: 'amenity' } };
    const road = { geometry: { coordinates: [-122.4103, 37.7924] as [number, number] }, properties: { osm_key: 'highway', name: 'Mason Street' } };
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ features: [far, road, fairmontPhoton] }) });
    const results = await nearbyPlaces({ lat: 37.7924, lng: -122.4103 });
    expect(fetchMock.mock.calls[0][0]).toContain('/reverse?');
    expect(results.map((r) => r.name)).toEqual(['Fairmont San Francisco', 'Tonga Room']);
  });

  it('returns nothing when Photon is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await searchPlaces('Fairmont')).toEqual([]);
  });
});
