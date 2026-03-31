import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Profile, UserStats } from '@/types/models';

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          `*,
           followers_count:follows!following_id(count),
           following_count:follows!follower_id(count)`,
        )
        .eq('id', userId!)
        .single();
      if (error) throw error;

      return {
        ...(data as any),
        followers_count: (data as any)?.followers_count?.[0]?.count ?? 0,
        following_count: (data as any)?.following_count?.[0]?.count ?? 0,
      } as Profile;
    },
    enabled: !!userId,
  });
}

export function useUserStats(userId: string | undefined) {
  return useQuery({
    queryKey: ['userStats', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_stats', {
        p_user_id: userId!,
      } as any);
      if (error) throw error;
      return data as UserStats;
    },
    enabled: !!userId,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      updates,
    }: {
      userId: string;
      updates: Partial<Pick<Profile, 'display_name' | 'bio' | 'avatar_url' | 'username'>>;
    }) => {
      const { data, error } = await (supabase
        .from('profiles') as any)
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: (_: unknown, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });
}
