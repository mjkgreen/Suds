import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { FeedEntry, FeedItem } from '@/types/models';
import { FEED_PAGE_SIZE } from '@/lib/constants';

function parseFeedRows(data: any[]): FeedEntry[] {

  const rows: FeedItem[] = (data ?? []).map((row: any) => {
return {
    id: row.id,
    user_id: row.user_id,
    drink_type: row.drink_type,
    drink_name: row.drink_name,
    brand: row.brand ?? null,
    quantity: row.quantity,
    location_name: row.location_name,
    location_lat: row.location_lat,
    location_lng: row.location_lng,
    notes: row.notes,
    photo_url: row.photo_url,
    photo_urls: row.photo_urls ?? [],
    rating: row.rating ?? null,
    event_name: row.event_name ?? null,
    logged_at: row.logged_at,
    ended_at: row.ended_at ?? null,
    created_at: row.created_at,
    session_id: row.session_id ?? null,
    session_title: row.session_title ?? null,
    like_count: row.like_count ? Number(row.like_count) : 0,
    comment_count: row.comment_count ? Number(row.comment_count) : 0,
    user_liked: row.user_liked ?? false,
    profile: {
      id: row.user_id,
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      bio: null,
      height: null,
      height_unit: null,
      weight: null,
      weight_unit: null,
      birthdate: null,
      onboarded: true,
      subscription_tier: 'free' as const,
      displayed_badges: row.displayed_badges,
      created_at: '',
      updated_at: '',
    },
    };
  });

  // Group rows that share a session_id into SessionFeedGroups
  const entries: FeedEntry[] = [];
  const seenSessions = new Set<string>();

  for (const row of rows) {
    if (row.session_id && !seenSessions.has(row.session_id)) {
      seenSessions.add(row.session_id);
      const sessionItems = rows.filter((r) => r.session_id === row.session_id);
      entries.push({
        type: 'session',
        session_id: row.session_id,
        session_title: row.session_title ?? null,
        profile: row.profile,
        items: sessionItems,
        started_at: sessionItems[sessionItems.length - 1].logged_at,
        ended_at: sessionItems[0].logged_at,
      });
    } else if (!row.session_id) {
      entries.push({ type: 'drink', item: row });
    }
  }

  return entries;
}

async function fetchFeedPage(userId: string, offset: number): Promise<{ entries: FeedEntry[], rawCount: number }> {
  const { data, error } = await (supabase.rpc as any)('get_feed', {
    p_user_id: userId,
    p_limit: FEED_PAGE_SIZE,
    p_offset: offset,
  });
  if (error) throw error;
  const rawData = data ?? [];
  return {
    entries: parseFeedRows(rawData),
    rawCount: rawData.length
  };
}

export function useFeed(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['feed', userId],
    queryFn: ({ pageParam = 0 }) => fetchFeedPage(userId!, pageParam),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.rawCount === FEED_PAGE_SIZE
        ? allPages.length * FEED_PAGE_SIZE
        : undefined,
    initialPageParam: 0,
    enabled: !!userId,
  });
}

/**
 * Fetches ALL of the current user's own drink/session history as feed cards.
 * Uses a direct table query for efficiency instead of filtering the global feed.
 */
export function useMyFeed(userId: string | undefined) {
  const PAGE_SIZE = 100;

  return useInfiniteQuery({
    queryKey: ['my-feed', userId],
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await (supabase.rpc as any)('get_feed', {
        p_user_id: userId!,
        p_limit: PAGE_SIZE,
        p_offset: pageParam,
      });

      if (error) throw error;

      const rawData = data ?? [];
      const own = rawData.filter((row: any) => row.user_id === userId);

      return {
        entries: parseFeedRows(own),
        rawCount: rawData.length
      };
    },
    getNextPageParam: (lastPage: any, allPages: any) =>
      lastPage.rawCount === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    initialPageParam: 0,
    enabled: !!userId,
  });
}
