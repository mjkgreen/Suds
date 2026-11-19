import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { FeedEntry, FeedItem, Profile } from '@/types/models';

/** Shape of one cached page of useFeed / useMyFeed. */
interface FeedPage {
  entries: FeedEntry[];
  rawCount: number;
}

type FeedData = InfiniteData<FeedPage>;

/**
 * Puts a just-logged drink at the top of the cached feeds (home feed and the
 * user's own profile feed) so it shows straight away, before the insert and
 * refetch finish. A drink in a night out goes into that night out's card;
 * if the card isn't loaded yet, a new one is started.
 *
 * Returns a function that puts the caches back, for when the insert fails.
 */
export function addDrinkToFeedCaches(
  queryClient: QueryClient,
  userId: string,
  item: FeedItem,
  sessionTitle: string | null,
): () => void {
  const keys = [['feed', userId], ['my-feed', userId]];
  const snapshots = keys.map((key) => [key, queryClient.getQueryData<FeedData>(key)] as const);

  for (const key of keys) {
    // Don't let an in-flight refetch overwrite the optimistic entry with
    // older data; the mutation refetches once it lands.
    void queryClient.cancelQueries({ queryKey: key });
    queryClient.setQueryData<FeedData>(key, (data) =>
      data ? insertIntoFeed(data, item, sessionTitle) : data,
    );
  }

  return () => {
    for (const [key, data] of snapshots) queryClient.setQueryData(key, data);
  };
}

export function insertIntoFeed(data: FeedData, item: FeedItem, sessionTitle: string | null): FeedData {
  if (data.pages.length === 0) return data;

  if (item.session_id) {
    let found = false;
    const pages = data.pages.map((page) => ({
      ...page,
      entries: page.entries.map((entry) => {
        if (found || entry.type !== 'session' || entry.session_id !== item.session_id) return entry;
        found = true;
        return { ...entry, items: [item, ...entry.items.filter((i) => i.id !== item.id)] };
      }),
    }));
    if (found) return { ...data, pages };

    const group: FeedEntry = {
      type: 'session',
      session_id: item.session_id,
      session_title: sessionTitle,
      profile: item.profile,
      items: [item],
      started_at: item.logged_at,
      ended_at: null,
    };
    return prependToFirstPage(data, group);
  }

  return prependToFirstPage(data, { type: 'drink', item });
}

function prependToFirstPage(data: FeedData, entry: FeedEntry): FeedData {
  const [first, ...rest] = data.pages;
  return { ...data, pages: [{ ...first, entries: [entry, ...first.entries] }, ...rest] };
}

/** A FeedItem for a drink that hasn't been saved yet. */
export function buildOptimisticFeedItem(
  fields: Omit<FeedItem, 'profile' | 'like_count' | 'comment_count' | 'user_liked' | 'created_at'>,
  profile: Profile,
): FeedItem {
  return {
    ...fields,
    created_at: new Date().toISOString(),
    profile,
    like_count: 0,
    comment_count: 0,
    user_liked: false,
  };
}

/**
 * Takes a drink out of the cached feeds straight away (deleted, or removed from
 * its night out — the refetch puts it back where it now belongs). A night-out
 * card left with no drinks is dropped. Returns a rollback.
 */
export function removeDrinkFromFeedCaches(
  queryClient: QueryClient,
  userId: string,
  drinkId: string,
): () => void {
  const keys = [['feed', userId], ['my-feed', userId]];
  const snapshots = keys.map((key) => [key, queryClient.getQueryData<FeedData>(key)] as const);

  for (const key of keys) {
    void queryClient.cancelQueries({ queryKey: key });
    queryClient.setQueryData<FeedData>(key, (data) => (data ? removeFromFeed(data, drinkId) : data));
  }

  return () => {
    for (const [key, data] of snapshots) queryClient.setQueryData(key, data);
  };
}

export function removeFromFeed(data: FeedData, drinkId: string): FeedData {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      entries: page.entries.flatMap((entry): FeedEntry[] => {
        if (entry.type === 'drink') return entry.item.id === drinkId ? [] : [entry];
        if (!entry.items.some((i) => i.id === drinkId)) return [entry];
        const items = entry.items.filter((i) => i.id !== drinkId);
        return items.length ? [{ ...entry, items }] : [];
      }),
    })),
  };
}

/**
 * Applies `mapEntry` to every entry of every cached feed (anyone's home or
 * profile feed). Returns a rollback.
 */
export function patchFeedEntries(
  queryClient: QueryClient,
  mapEntry: (entry: FeedEntry) => FeedEntry,
): () => void {
  const snapshots: (readonly [readonly unknown[], FeedData | undefined])[] = [];
  for (const prefix of [['feed'], ['my-feed']]) {
    for (const [key, data] of queryClient.getQueriesData<FeedData>({ queryKey: prefix })) {
      if (!data?.pages) continue;
      snapshots.push([key, data] as const);
      queryClient.setQueryData<FeedData>(key, {
        ...data,
        pages: data.pages.map((page) => ({ ...page, entries: page.entries.map(mapEntry) })),
      });
    }
  }
  return () => {
    for (const [key, data] of snapshots) queryClient.setQueryData(key, data);
  };
}

/** Patches one drink wherever it appears (alone or inside a night-out card). */
export function patchFeedDrink(
  queryClient: QueryClient,
  drinkId: string,
  patch: (item: FeedItem) => FeedItem,
): () => void {
  return patchFeedEntries(queryClient, (entry) => {
    if (entry.type === 'drink') return entry.item.id === drinkId ? { ...entry, item: patch(entry.item) } : entry;
    if (!entry.items.some((i) => i.id === drinkId)) return entry;
    return { ...entry, items: entry.items.map((i) => (i.id === drinkId ? patch(i) : i)) };
  });
}
