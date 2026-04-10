import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { DrinkComment } from '@/types/models';

export function useComments(drinkLogId: string | undefined) {
  return useQuery({
    queryKey: ['comments', drinkLogId],
    queryFn: async (): Promise<DrinkComment[]> => {
      const { data, error } = await (supabase
        .from('drink_comments' as any)
        .select(`
          id,
          drink_log_id,
          user_id,
          content,
          created_at,
          profile:profiles!user_id(
            id, username, display_name, avatar_url, displayed_badges
          )
        `)
        .eq('drink_log_id', drinkLogId!)
        .order('created_at', { ascending: true }) as any);
      if (error) throw error;
      return (data ?? []) as DrinkComment[];
    },
    enabled: !!drinkLogId,
  });
}

export function useAddComment(currentUserId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ drinkLogId, content }: { drinkLogId: string; content: string }) => {
      const { error } = await supabase
        .from('drink_comments' as any)
        .insert({ drink_log_id: drinkLogId, user_id: currentUserId!, content });
      if (error) throw error;
    },
    onSuccess: (_data, { drinkLogId }) => {
      queryClient.invalidateQueries({ queryKey: ['comments', drinkLogId] });
      queryClient.invalidateQueries({ queryKey: ['feed', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['my-feed', currentUserId] });
    },
  });
}

export function useDeleteComment(currentUserId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, drinkLogId }: { commentId: string; drinkLogId: string }) => {
      const { error } = await supabase
        .from('drink_comments' as any)
        .delete()
        .eq('id', commentId)
        .eq('user_id', currentUserId!);
      if (error) throw error;
      return drinkLogId;
    },
    onSuccess: (_data, { drinkLogId }) => {
      queryClient.invalidateQueries({ queryKey: ['comments', drinkLogId] });
      queryClient.invalidateQueries({ queryKey: ['feed', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['my-feed', currentUserId] });
    },
  });
}
