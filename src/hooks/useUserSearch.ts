import { useQuery } from '@tanstack/react-query';
import { useBlockedIds } from '@/hooks/useBlocks';
import { useDebounce } from '@/hooks/useDebounce';
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { TaggedUser } from '@/types/models';

/**
 * Finds users by username or display-name prefix, for @mention autocomplete
 * and tagging. Excludes the current user and anyone they've blocked.
 */
export function useUserSearch(query: string, { enabled = true, limit = 8 } = {}) {
  const { user } = useAuthStore();
  const debounced = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS);
  const { data: blockedIds } = useBlockedIds(user?.id);

  const result = useQuery({
    queryKey: ['userSearch', debounced, limit],
    queryFn: async (): Promise<TaggedUser[]> => {
      // Usernames are [a-z0-9_]; strip anything else so the filter can't be broken.
      const term = debounced.replace(/[^a-zA-Z0-9_ ]/g, '');
      if (!term) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .or(`username.ilike.${term}%,display_name.ilike.${term}%`)
        .order('username')
        .limit(limit + 1);
      if (error) throw error;
      return (data ?? []) as TaggedUser[];
    },
    enabled: enabled && debounced.length > 0,
    staleTime: 60 * 1000,
  });

  const users = (result.data ?? [])
    .filter((p) => p.id !== user?.id && !(blockedIds ?? []).includes(p.id))
    .slice(0, limit);

  return { users, isLoading: result.isLoading && enabled && debounced.length > 0 };
}
