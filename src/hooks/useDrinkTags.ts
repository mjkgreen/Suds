import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TaggedUser } from '@/types/models';

export function useDrinkTags(drinkLogId: string | undefined) {
  return useQuery({
    queryKey: ['drinkTags', drinkLogId],
    queryFn: async (): Promise<TaggedUser[]> => {
      const { data, error } = await supabase
        .from('drink_tags' as any)
        .select('created_at, profiles(id, username, display_name, avatar_url)')
        .eq('drink_log_id', drinkLogId!)
        .order('created_at');
      if (error) throw error;
      return ((data ?? []) as any[]).map((row) => row.profiles).filter(Boolean) as TaggedUser[];
    },
    enabled: !!drinkLogId,
  });
}

/**
 * Makes a drink's tags match `userIds`. Tags are best-effort: a user who
 * can't be tagged (e.g. they've blocked you) is skipped rather than failing
 * the whole save.
 */
export async function syncDrinkTags(drinkLogId: string, userIds: string[]): Promise<void> {
  const { data: existing } = await supabase
    .from('drink_tags' as any)
    .select('user_id')
    .eq('drink_log_id', drinkLogId);
  const current = new Set(((existing ?? []) as any[]).map((r) => r.user_id as string));
  const wanted = new Set(userIds);

  const toRemove = [...current].filter((id) => !wanted.has(id));
  if (toRemove.length > 0) {
    await supabase.from('drink_tags' as any).delete().eq('drink_log_id', drinkLogId).in('user_id', toRemove);
  }

  for (const userId of userIds.filter((id) => !current.has(id))) {
    await supabase.from('drink_tags' as any).insert({ drink_log_id: drinkLogId, user_id: userId } as any);
  }
}

/** Lets a tagged user remove themselves from a drink. */
export function useRemoveMyTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ drinkLogId, userId }: { drinkLogId: string; userId: string }) => {
      const { error } = await supabase
        .from('drink_tags' as any)
        .delete()
        .eq('drink_log_id', drinkLogId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: (_data, { drinkLogId }) => {
      queryClient.invalidateQueries({ queryKey: ['drinkTags', drinkLogId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}
