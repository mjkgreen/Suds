import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/** IDs of users the current user has blocked. */
export function useBlockedIds(userId: string | undefined) {
  return useQuery({
    queryKey: ['blockedIds', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('blocked_id')
        .eq('blocker_id', userId!);
      if (error) throw error;
      return (data ?? []).map((row: any) => row.blocked_id as string);
    },
    enabled: !!userId,
  });
}

export function useIsBlocked(userId: string | undefined, targetUserId: string | undefined) {
  const { data: blockedIds } = useBlockedIds(userId);
  return !!targetUserId && (blockedIds ?? []).includes(targetUserId);
}

export function useBlocks(currentUserId: string | undefined) {
  const queryClient = useQueryClient();

  const invalidateSocialQueries = (targetUserId: string) => {
    queryClient.invalidateQueries({ queryKey: ['blockedIds', currentUserId] });
    queryClient.invalidateQueries({ queryKey: ['feed', currentUserId] });
    queryClient.invalidateQueries({ queryKey: ['my-feed'] });
    queryClient.invalidateQueries({ queryKey: ['comments'] });
    queryClient.invalidateQueries({ queryKey: ['isFollowing', currentUserId, targetUserId] });
    queryClient.invalidateQueries({ queryKey: ['searchUsers'] });
    queryClient.invalidateQueries({ queryKey: ['suggestedUsers', currentUserId] });
    queryClient.invalidateQueries({ queryKey: ['inAppNotifications'] });
    queryClient.invalidateQueries({ queryKey: ['profile', currentUserId] });
    queryClient.invalidateQueries({ queryKey: ['profile', targetUserId] });
  };

  const block = useMutation({
    mutationFn: async (targetUserId: string) => {
      const { error } = await (supabase.rpc as any)('block_user', { p_blocked: targetUserId });
      if (error) throw error;
    },
    onSuccess: (_data, targetUserId) => invalidateSocialQueries(targetUserId),
  });

  const unblock = useMutation({
    mutationFn: async (targetUserId: string) => {
      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', currentUserId!)
        .eq('blocked_id', targetUserId);
      if (error) throw error;
    },
    onSuccess: (_data, targetUserId) => invalidateSocialQueries(targetUserId),
  });

  return { block, unblock };
}
