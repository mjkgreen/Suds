import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types/models';

export function useLikers(drinkLogId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['likers', drinkLogId],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await (supabase
        .from('drink_likes' as any)
        .select(`
          user_id,
          profile:profiles!user_id(
            id, username, display_name, avatar_url
          )
        `)
        .eq('drink_log_id', drinkLogId!)
        .order('created_at', { ascending: false }) as any);
      if (error) throw error;
      return (data ?? []).map((row: any) => row.profile).filter(Boolean) as Profile[];
    },
    enabled: !!drinkLogId && enabled,
  });
}
