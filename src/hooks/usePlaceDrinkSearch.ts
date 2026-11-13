import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { normalizeLabel } from '@/lib/drinkSearch';
import { parseFeedItem } from '@/hooks/useFeed';
import { DrinkType, FeedItem } from '@/types/models';

/**
 * Search for places and drinks (supabase/migrations/048). Every result only
 * counts drinks the viewer could already see on that person's profile.
 */

export interface PlaceResult {
  place_name: string;
  drink_count: number;
  people_count: number;
  last_logged_at: string;
}

export interface DrinkResult {
  kind: 'brand' | 'name';
  label: string;
  drink_type: DrinkType;
  drink_count: number;
  people_count: number;
  last_logged_at: string;
}

/** What a list of matching drinks is for: one place, or one brand / drink name. */
export type DrinkMatch = { place: string } | { label: string; kind: 'brand' | 'name' };

const RESULT_LIMIT = 5;
const MATCH_PAGE_SIZE = 20;

/** Queries shorter than this (after normalizing) don't search. Matches the RPCs. */
export const MIN_SEARCH_LENGTH = 2;

function toPlaces(data: any[] | null): PlaceResult[] {
  return (data ?? []).map((r) => ({
    place_name: r.place_name,
    drink_count: Number(r.drink_count),
    people_count: Number(r.people_count),
    last_logged_at: r.last_logged_at,
  }));
}

export function usePlaceSearch(query: string) {
  const normalized = normalizeLabel(query);
  return useQuery({
    queryKey: ['searchPlaces', normalized],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('search_places', {
        p_query: normalized,
        p_limit: RESULT_LIMIT,
      });
      if (error) throw error;
      return toPlaces(data);
    },
    enabled: normalized.length >= MIN_SEARCH_LENGTH,
    staleTime: 60 * 1000,
  });
}

export function useDrinkSearch(query: string) {
  const normalized = normalizeLabel(query);
  return useQuery({
    queryKey: ['searchDrinks', normalized],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('search_drinks', {
        p_query: normalized,
        p_limit: RESULT_LIMIT,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map(
        (r): DrinkResult => ({
          kind: r.kind,
          label: r.label,
          drink_type: r.drink_type,
          drink_count: Number(r.drink_count),
          people_count: Number(r.people_count),
          last_logged_at: r.last_logged_at,
        }),
      );
    },
    enabled: normalized.length >= MIN_SEARCH_LENGTH,
    staleTime: 60 * 1000,
  });
}

/** Where you and the people you follow have been in the last 30 days. */
export function usePopularPlaces(userId: string | undefined) {
  return useQuery({
    queryKey: ['popularPlaces', userId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('popular_places', {
        p_days: 30,
        p_limit: RESULT_LIMIT,
      });
      if (error) throw error;
      return toPlaces(data);
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
  });
}

/** The drinks behind a place or drink result, newest first. */
export function useMatchingDrinks(match: DrinkMatch | null) {
  const params =
    match && 'place' in match
      ? { p_place: match.place }
      : match
        ? { p_label: match.label, p_kind: match.kind }
        : null;

  return useInfiniteQuery({
    queryKey: ['matchingDrinks', params],
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await (supabase.rpc as any)('get_matching_drinks', {
        ...params,
        p_limit: MATCH_PAGE_SIZE,
        p_offset: pageParam,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map(parseFeedItem) as FeedItem[];
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === MATCH_PAGE_SIZE ? allPages.length * MATCH_PAGE_SIZE : undefined,
    initialPageParam: 0,
    enabled: !!params,
  });
}
