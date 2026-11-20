jest.mock('@/lib/supabase', () => ({ supabase: {} }));

import { buildMapClusters, groupMapLocation, isMyNightOut, MapLog, MapSession } from './mapData';

const ME = 'me';

function log(id: string, user_id: string, extra: Partial<MapLog> = {}): MapLog {
  return {
    id,
    user_id,
    location_lat: 40.7128,
    location_lng: -74.006,
    logged_at: '2026-11-20T20:00:00Z',
    session_id: null,
    ...extra,
  } as MapLog;
}

function pins(logs: MapLog[]) {
  const clusters = buildMapClusters(logs, ME);
  const ids = (isMine: boolean) =>
    clusters.filter((c) => c.isMine === isMine).flatMap((c) => c.items.map((i) => i.id)).sort();
  return { mine: ids(true), friends: ids(false) };
}

describe('map pins', () => {
  it('puts my own drinks under My Drinks only', () => {
    expect(pins([log('a', ME)])).toEqual({ mine: ['a'], friends: [] });
  });

  it("puts a followed friend's drink outside my night outs under Friends only", () => {
    expect(pins([log('b', 'friend')])).toEqual({ mine: [], friends: ['b'] });
  });

  it("shows a followed friend's drink from a night out we shared in both", () => {
    expect(pins([log('c', 'friend', { session_id: 's1', in_my_night_out: true })])).toEqual({
      mine: ['c'],
      friends: ['c'],
    });
  });

  it("shows a drink from a night out member I don't follow under My Drinks only", () => {
    const shared = log('d', 'stranger', { session_id: 's1', in_my_night_out: true, via_night_out_only: true });
    expect(pins([shared])).toEqual({ mine: ['d'], friends: [] });
  });

  it('skips drinks without a location', () => {
    expect(pins([log('e', ME, { location_lat: null, location_lng: null } as Partial<MapLog>)])).toEqual({
      mine: [],
      friends: [],
    });
  });

  it('groups drinks within ~100m into one pin', () => {
    const clusters = buildMapClusters([log('f', ME), log('g', ME, { location_lat: 40.71281 })], ME);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].items).toHaveLength(2);
  });
});

describe('isMyNightOut', () => {
  const session = (user_id: string, is_member?: boolean) => ({ id: 's', user_id, is_member }) as MapSession;

  it('counts night outs I host or joined as mine', () => {
    expect(isMyNightOut(session(ME), ME)).toBe(true);
    expect(isMyNightOut(session('host', true), ME)).toBe(true);
  });

  it("counts a friend's night out I'm not in as theirs", () => {
    expect(isMyNightOut(session('host', false), ME)).toBe(false);
  });
});

describe('groupMapLocation', () => {
  const label = (t: string) => t.toUpperCase();
  const name = (p: { display_name?: string | null }) => p.display_name ?? '';
  const username = (p: { username?: string | null }) => p.username ?? '';
  const sam = { id: 'sam', display_name: 'Sam', username: 'sam' } as any;
  const alex = { id: 'alex', display_name: 'Alex', username: 'alex' } as any;

  it('lists a night out once, with everyone in it, then each lone drink', () => {
    const entries = groupMapLocation(
      [
        log('a', 'sam', { session_id: 's1', session: { title: 'Pub crawl' } as any, profile: sam, drink_type: 'beer', quantity: 1.5 } as any),
        log('b', 'alex', { session_id: 's1', session: { title: 'Pub crawl' } as any, profile: alex, drink_type: 'beer', quantity: 1 } as any),
        log('c', 'sam', { profile: sam, drink_type: 'wine', drink_name: null, quantity: 1 } as any),
      ],
      label,
      name,
      username,
    );
    expect(entries.map((e) => [e.sessionId, e.title, e.who])).toEqual([
      ['s1', 'Pub crawl', 'Sam +1'],
      [null, 'WINE', '@sam'],
    ]);
    expect(entries[0].typeCounts).toEqual({ beer: 2.5 });
  });
});
