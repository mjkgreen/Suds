import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Profile, UserStats } from '@/types/models';
import { ProfileUpdate, splitProfileUpdates } from '@/utils/profileFields';

/**
 * Badges live on user_badges (RLS gated by can_view_user), so a non-approved
 * viewer of a private account gets no row → undefined → badges hidden.
 */
async function fetchBadges(userId: string): Promise<string[] | undefined> {
  const { data } = await supabase
    .from('user_badges')
    .select('badge_ids')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as any)?.badge_ids ?? undefined;
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const [profileRes, badgeIds] = await Promise.all([
        supabase
          .from('profiles')
          .select(
            `*,
             followers_count:follows!following_id(count),
             following_count:follows!follower_id(count)`,
          )
          .eq('id', userId!)
          .single(),
        fetchBadges(userId!),
      ]);
      if (profileRes.error) throw profileRes.error;
      const data = profileRes.data as any;

      return {
        ...data,
        followers_count: data?.followers_count?.[0]?.count ?? 0,
        following_count: data?.following_count?.[0]?.count ?? 0,
        displayed_badges: badgeIds,
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
      });
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
      updates: ProfileUpdate;
    }) => {
      const { profile, metrics, badges } = splitProfileUpdates(updates);
      let profileRow: Record<string, unknown> = {};

      if (Object.keys(profile).length > 0) {
        const { data, error } = await (supabase.from('profiles') as any)
          .update(profile)
          .eq('id', userId)
          .select()
          .single();
        if (error) throw error;
        profileRow = data as Record<string, unknown>;
      }

      if (Object.keys(metrics).length > 0) {
        const { error } = await (supabase.from('user_private_metrics') as any).upsert(
          { user_id: userId, ...metrics, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
        if (error) throw error;
      }

      if (badges !== undefined) {
        const { error } = await (supabase.from('user_badges') as any).upsert(
          { user_id: userId, badge_ids: badges, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
        if (error) throw error;
      }

      // Echo the written companion fields back so callers that spread the
      // result onto their cached profile keep the values they just saved.
      return {
        ...profileRow,
        ...metrics,
        ...(badges !== undefined ? { displayed_badges: badges } : {}),
      } as Profile;
    },
    onSuccess: (_: unknown, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });
}
