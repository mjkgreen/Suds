import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { StreakData } from '@/types/models';

export function useStreaks(userId: string | undefined) {
  return useQuery({
    queryKey: ['streaks', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_streaks', {
        p_user_id: userId!,
      });
      if (error) throw error;
      return data as StreakData;
    },
    enabled: !!userId,
  });
}
