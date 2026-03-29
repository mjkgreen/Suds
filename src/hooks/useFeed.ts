import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { FeedEntry, FeedItem } from '@/types/models';
import { FEED_PAGE_SIZE } from '@/lib/constants';

async function fetchFeedPage(userId: string, offset: number): Promise<FeedEntry[]> {
  const { data, error } = await supabase.rpc('get_feed', {
    p_user_id: userId,
    p_limit: FEED_PAGE_SIZE,
    p_offset: offset,
  });
  if (error) throw error;

  const rows: FeedItem[] = (data ?? []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    drink_type: row.drink_type,
    drink_name: row.drink_name,
    quantity: row.quantity,
    location_name: row.location_name,
    location_lat: row.location_lat,
    location_lng: row.location_lng,
    notes: row.notes,
    photo_url: row.photo_url,
    logged_at: row.logged_at,
    created_at: row.created_at,
    session_id: row.session_id ?? null,
    session_title: row.session_title ?? null,
    profile: {
      id: row.user_id,
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      bio: null,
      created_at: '',
      updated_at: '',
    },
  }));

  // Group consecutive rows that share a session_id into SessionFeedGroups
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

export function useFeed(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['feed', userId],
    queryFn: ({ pageParam = 0 }) => fetchFeedPage(userId!, pageParam),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === FEED_PAGE_SIZE
        ? allPages.length * FEED_PAGE_SIZE
        : undefined,
    initialPageParam: 0,
    enabled: !!userId,
  });
}
