import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { MilestoneData } from '@/types/models';

export function useMilestones(userId: string | undefined) {
  return useQuery({
    queryKey: ['milestones', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_milestones', {
        p_user_id: userId!,
      });
      if (error) throw error;
      return data as MilestoneData;
    },
    enabled: !!userId,
  });
}
