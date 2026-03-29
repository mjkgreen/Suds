import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useIsFollowing(followerId: string | undefined, followingId: string | undefined) {
  return useQuery({
    queryKey: ['isFollowing', followerId, followingId],
    queryFn: async () => {
      const { data } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', followerId!)
        .eq('following_id', followingId!)
        .maybeSingle();
      return !!data;
    },
    enabled: !!followerId && !!followingId,
  });
}

export function useFollow(currentUserId: string | undefined) {
  const queryClient = useQueryClient();

  const followMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const { error } = await supabase.from('follows').insert({
        follower_id: currentUserId!,
        following_id: targetUserId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, targetUserId) => {
      queryClient.invalidateQueries({ queryKey: ['isFollowing', currentUserId, targetUserId] });
      queryClient.invalidateQueries({ queryKey: ['profile', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['profile', targetUserId] });
      queryClient.invalidateQueries({ queryKey: ['feed', currentUserId] });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId!)
        .eq('following_id', targetUserId);
      if (error) throw error;
    },
    onSuccess: (_data, targetUserId) => {
      queryClient.invalidateQueries({ queryKey: ['isFollowing', currentUserId, targetUserId] });
      queryClient.invalidateQueries({ queryKey: ['profile', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['profile', targetUserId] });
      queryClient.invalidateQueries({ queryKey: ['feed', currentUserId] });
    },
  });

  return { follow: followMutation, unfollow: unfollowMutation };
}
