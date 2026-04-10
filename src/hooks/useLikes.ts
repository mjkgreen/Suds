import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useLike(currentUserId: string | undefined) {
  const queryClient = useQueryClient();

  const likeMutation = useMutation({
    mutationFn: async (drinkLogId: string) => {
      const { error } = await supabase
        .from('drink_likes' as any)
        .insert({ drink_log_id: drinkLogId, user_id: currentUserId! });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['my-feed', currentUserId] });
    },
  });

  const unlikeMutation = useMutation({
    mutationFn: async (drinkLogId: string) => {
      const { error } = await supabase
        .from('drink_likes' as any)
        .delete()
        .eq('drink_log_id', drinkLogId)
        .eq('user_id', currentUserId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['my-feed', currentUserId] });
    },
  });

  return { like: likeMutation, unlike: unlikeMutation };
}
