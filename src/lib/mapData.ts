import { supabase } from '@/lib/supabase';
import { Coordinate, DrinkLog, DrinkLogWithSessionAndProfile, SessionWithLogs } from '@/types/models';

/**
 * Data for the map screen (app/(tabs)/map.tsx and map.web.tsx).
 *
 * "My Drinks" covers my own drinks plus every night out I'm a member of,
 * hosted by me or by someone else: the route and everyone's drinks in it.
 * "Friends" covers drinks and night outs of people I follow.
 */

/**
 * A map pin's drink. in_my_night_out: it's in a night out I'm a member of.
 * via_night_out_only: it's from a member I don't follow, so it only shows
 * because we shared that night out.
 */
export type MapLog = DrinkLogWithSessionAndProfile & { in_my_night_out?: boolean; via_night_out_only?: boolean };

/** A night out's route, flagged when I'm a member of it. */
export type MapSession = SessionWithLogs & { is_member?: boolean };

const NIGHT_OUT_LIMIT = 200;
// .in() filters go in the URL, so ask for night outs in batches.
const ID_BATCH = 80;

function batches<T>(items: T[], size = ID_BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function followingIds(userId: string): Promise<string[]> {
  const { data } = await supabase.from('follows').select('following_id').eq('follower_id', userId);
  return ((data as { following_id: string }[] | null) ?? []).map((f) => f.following_id);
}

/** Night outs I'm a member of (as host or guest), most recent first. */
async function myNightOutIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('session_members')
    .select('session_id')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .limit(NIGHT_OUT_LIMIT);
  if (error) throw error;
  return ((data as { session_id: string }[] | null) ?? []).map((m) => m.session_id);
}

const LOG_SELECT =
  '*, profile:profiles!drink_logs_user_id_fkey(id, username, display_name, avatar_url), session:sessions(id, title, started_at, ended_at, created_at, user_id)';

export async function fetchMapLogs(userId: string): Promise<MapLog[]> {
  const [following, nightOutIds] = await Promise.all([followingIds(userId), myNightOutIds(userId)]);

  // My drinks and the drinks of people I follow…
  const ownAndFollowed = supabase
    .from('drink_logs')
    .select(LOG_SELECT)
    .not('location_lat', 'is', null)
    .not('location_lng', 'is', null)
    .in('user_id', [userId, ...following])
    .order('logged_at', { ascending: false })
    .limit(1000);

  // …plus everyone's drinks in night outs I'm in, including members I
  // don't follow.
  const inMyNightOuts = batches(nightOutIds).map((ids) =>
    supabase
      .from('drink_logs')
      .select(LOG_SELECT)
      .not('location_lat', 'is', null)
      .not('location_lng', 'is', null)
      .in('session_id', ids)
      .neq('user_id', userId)
      .limit(1000),
  );

  const [main, ...shared] = await Promise.all([ownAndFollowed, ...inMyNightOuts]);
  if (main.error) throw main.error;
  for (const r of shared) if (r.error) throw r.error;

  const mine = new Set(nightOutIds);
  const byId = new Map<string, MapLog>();
  for (const log of (main.data ?? []) as MapLog[]) {
    byId.set(log.id, { ...log, in_my_night_out: !!log.session_id && mine.has(log.session_id) });
  }
  for (const log of shared.flatMap((r) => r.data ?? []) as MapLog[]) {
    if (!byId.has(log.id)) byId.set(log.id, { ...log, in_my_night_out: true, via_night_out_only: true });
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime(),
  );
}

const SESSION_SELECT = '*, logs:drink_logs(id, location_lat, location_lng, location_name, logged_at)';

export async function fetchSessionRoutes(userId: string): Promise<MapSession[]> {
  const [following, nightOutIds] = await Promise.all([followingIds(userId), myNightOutIds(userId)]);

  // Night outs hosted by me or people I follow, plus every night out I'm a
  // member of (a guest's night out is hosted by someone else, often someone
  // they don't follow). Only what the route lines need, recent ones only.
  const hosted = supabase
    .from('sessions')
    .select(SESSION_SELECT)
    .in('user_id', [userId, ...following])
    .order('started_at', { ascending: false })
    .limit(NIGHT_OUT_LIMIT);
  const joined = batches(nightOutIds).map((ids) =>
    supabase.from('sessions').select(SESSION_SELECT).in('id', ids),
  );

  const [main, ...rest] = await Promise.all([hosted, ...joined]);
  if (main.error) throw main.error;
  for (const r of rest) if (r.error) throw r.error;

  const memberOf = new Set(nightOutIds);
  const byId = new Map<string, any>();
  for (const s of [...(main.data ?? []), ...rest.flatMap((r) => r.data ?? [])] as any[]) byId.set(s.id, s);

  return [...byId.values()]
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .map((session): MapSession => {
      // Drinks with coordinates, in the order they were logged
      const sessionLogs = ((session.logs as DrinkLog[]) ?? [])
        .filter((log) => log.location_lat !== null && log.location_lng !== null)
        .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());

      const route: Coordinate[] = sessionLogs.map((log, index) => ({
        latitude: log.location_lat!,
        longitude: log.location_lng!,
        timestamp: log.logged_at,
        sequence_order: index + 1,
        session_id: session.id,
        location_name: log.location_name,
        drink_log_id: log.id,
      }));

      return {
        id: session.id,
        user_id: session.user_id,
        title: session.title,
        started_at: session.started_at,
        ended_at: session.ended_at,
        created_at: session.created_at,
        logs: sessionLogs,
        route,
        is_member: memberOf.has(session.id) || session.user_id === userId,
      };
    });
}

/** Whether a night out's route shows under "My Drinks" (else under "Friends"). */
export function isMyNightOut(session: MapSession, userId: string | undefined): boolean {
  return !!session.is_member || session.user_id === userId;
}

export type MapCluster = { lat: number; lng: number; items: MapLog[]; isMine: boolean };

/**
 * Group nearby drinks into pins (~100m, by rounding to 3 decimals), split
 * into "My Drinks" and "Friends" pins. My own drinks and every drink in a
 * night out I'm in go under My Drinks. Drinks of people I follow go under
 * Friends too, so a followed friend's drink from a shared night out shows in
 * both.
 */
export function buildMapClusters(logs: MapLog[] | undefined, userId: string | undefined): MapCluster[] {
  const groups = new Map<string, MapCluster>();
  const add = (log: MapLog, isMine: boolean) => {
    const key = `${isMine ? 'mine' : 'friend'}-${log.location_lat!.toFixed(3)},${log.location_lng!.toFixed(3)}`;
    let group = groups.get(key);
    if (!group) {
      const [lat, lng] = [Number(log.location_lat!.toFixed(3)), Number(log.location_lng!.toFixed(3))];
      group = { lat, lng, items: [], isMine };
      groups.set(key, group);
    }
    group.items.push(log);
  };

  for (const log of logs ?? []) {
    if (!log.location_lat || !log.location_lng) continue;
    const own = log.user_id === userId;
    if (own || log.in_my_night_out) add(log, true);
    if (!own && !log.via_night_out_only) add(log, false);
  }
  return [...groups.values()];
}
