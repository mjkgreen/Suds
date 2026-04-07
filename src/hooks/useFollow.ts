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
      const { error } = await (supabase.from('follows') as any).insert({
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

export function useFollowers(userId: string | undefined) {
  return useQuery({
    queryKey: ['followers', userId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('follows')
        .select(`
          follower_id,
          profile:profiles!follower_id(*)
        `)
        .eq('following_id', userId!) as any);
      if (error) throw error;
      // return an array of profiles
      // ignore rows where profile might be missing due to referential integrity issues though they shouldn't occur
      return data.map((row: any) => row.profile).filter(Boolean);
    },
    enabled: !!userId,
  });
}

export function useFollowing(userId: string | undefined) {
  return useQuery({
    queryKey: ['following', userId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('follows')
        .select(`
          following_id,
          profile:profiles!following_id(*)
        `)
        .eq('follower_id', userId!) as any);
      if (error) throw error;
      return data.map((row: any) => row.profile).filter(Boolean);
    },
    enabled: !!userId,
  });
}
