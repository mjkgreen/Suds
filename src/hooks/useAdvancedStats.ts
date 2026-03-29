import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { AdvancedStats } from '@/types/models';

export function useAdvancedStats(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['advancedStats', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_advanced_stats', {
        p_user_id: userId!,
      });
      if (error) throw error;
      return data as AdvancedStats;
    },
    enabled: !!userId && enabled,
  });
}
