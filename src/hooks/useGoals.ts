import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Goal } from '@/types/models';

export function useGoal(userId: string | undefined) {
  return useQuery({
    queryKey: ['goal', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return data as Goal | null;
    },
    enabled: !!userId,
  });
}

export function useUpsertGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, weeklyLimit }: { userId: string; weeklyLimit: number }) => {
      const { data, error } = await supabase
        .from('goals')
        .upsert({ user_id: userId, weekly_limit: weeklyLimit }, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;
      return data as Goal;
    },
    onSuccess: (_: unknown, { userId }: { userId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['goal', userId] });
    },
  });
}
