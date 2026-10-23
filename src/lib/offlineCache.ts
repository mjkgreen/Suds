import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { Platform } from 'react-native';
import { queryClient } from '@/lib/queryClient';
import { Profile } from '@/types/models';

/**
 * What the app keeps on the phone so it can open instantly and still show
 * recent content with no connection — the way Instagram shows your last feed
 * while it refreshes:
 *   • the signed-in user's profile (so the app can open without waiting on it)
 *   • recent query results: feed, your profile/stats, notifications, drinks
 *     you've opened, and so on
 * Photos and videos are cached separately by expo-image / expo-video.
 * Everything here is cleared on sign-out.
 */

const PROFILE_KEY = 'suds-cached-profile';
const QUERY_CACHE_KEY = 'suds-query-cache';

/**
 * Bump when the shape of cached data changes (e.g. a query starts returning
 * different fields) so old caches are discarded instead of misread.
 */
const CACHE_VERSION = '1';

/** Cached results older than this are dropped rather than shown. */
export const OFFLINE_CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days

/** Query keys worth having on the next launch or offline. */
const PERSISTED_QUERIES = new Set([
  'feed',
  'my-feed',
  'profile',
  'userStats',
  'streaks',
  'milestones',
  'advancedStats',
  'goal',
  'drinkLogs',
  'mapLogs',
  'drinkDetail',
  'drinkTags',
  'comments',
  'likers',
  'sessionDetail',
  'sessionDrinks',
  'sessionMembers',
  'inAppNotifications',
  'notification-preferences',
  'followers',
  'following',
  'blockedIds',
]);

/** Infinite lists only keep their first page — enough to fill the screen. */
const MAX_PERSISTED_PAGES = 1;

// ── Profile ──────────────────────────────────────────────────

export async function saveCachedProfile(profile: Profile | null): Promise<void> {
  try {
    if (profile) await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Cache is best-effort.
  }
}

/** The cached profile, only if it belongs to `userId`. */
export async function loadCachedProfile(userId: string): Promise<Profile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    const profile = raw ? (JSON.parse(raw) as Profile) : null;
    return profile?.id === userId ? profile : null;
  } catch {
    return null;
  }
}

// ── Query cache ──────────────────────────────────────────────

function trimInfinitePages(data: any) {
  if (data && Array.isArray(data.pages) && Array.isArray(data.pageParams)) {
    return {
      pages: data.pages.slice(0, MAX_PERSISTED_PAGES),
      pageParams: data.pageParams.slice(0, MAX_PERSISTED_PAGES),
    };
  }
  return data;
}

const persister = createAsyncStoragePersister({
  storage: Platform.OS === 'web' && typeof window === 'undefined' ? undefined : AsyncStorage,
  key: QUERY_CACHE_KEY,
  // Write at most once a second while data is changing.
  throttleTime: 1000,
});

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: OFFLINE_CACHE_MAX_AGE,
  buster: CACHE_VERSION,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success' && PERSISTED_QUERIES.has(String(query.queryKey[0])),
    // Shrink long lists before they're written.
    serializeData: trimInfinitePages,
  },
};

/** Forget everything cached for the signed-in user. Call on sign-out. */
export async function clearOfflineCache(): Promise<void> {
  queryClient.clear();
  try {
    await persister.removeClient();
    await AsyncStorage.removeItem(PROFILE_KEY);
  } catch {
    // Best-effort.
  }
}
