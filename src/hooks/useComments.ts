import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { patchFeedDrink } from '@/lib/feedCache';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { DrinkComment } from '@/types/models';

/** Bumps a drink's comment count on the feed cards. Returns a rollback. */
function bumpCommentCount(queryClient: ReturnType<typeof useQueryClient>, drinkLogId: string, by: number) {
  return patchFeedDrink(queryClient, drinkLogId, (item) => ({
    ...item,
    comment_count: Math.max(0, (item.comment_count ?? 0) + by),
  }));
}

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
            id, username, display_name, avatar_url
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

  type AddVars = { drinkLogId: string; content: string; id?: string };

  return useMutation({
    // Show the comment straight away; the refetch afterwards swaps in the
    // saved one (same id, chosen here).
    onMutate: async (vars: AddVars) => {
      vars.id ??= Crypto.randomUUID();
      const key = ['comments', vars.drinkLogId];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<DrinkComment[]>(key);
      const profile = useAuthStore.getState().profile;
      if (profile) {
        const optimistic: DrinkComment = {
          id: vars.id,
          drink_log_id: vars.drinkLogId,
          user_id: currentUserId!,
          content: vars.content,
          created_at: new Date().toISOString(),
          profile,
        };
        queryClient.setQueryData<DrinkComment[]>(key, [...(previous ?? []), optimistic]);
      }
      const rollbackCount = bumpCommentCount(queryClient, vars.drinkLogId, 1);
      return {
        rollback: () => {
          queryClient.setQueryData(key, previous);
          rollbackCount();
        },
      };
    },
    mutationFn: async ({ drinkLogId, content, id }: AddVars) => {
      const { error } = await supabase
        .from('drink_comments')
        .insert({ id, drink_log_id: drinkLogId, user_id: currentUserId!, content });
      if (error) throw error;
    },
    onError: (_err, _vars, context) => {
      context?.rollback();
    },
    onSettled: (_data, _err, { drinkLogId }) => {
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
        .from('drink_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', currentUserId!);
      if (error) throw error;
      return drinkLogId;
    },
    onMutate: async ({ commentId, drinkLogId }) => {
      const key = ['comments', drinkLogId];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<DrinkComment[]>(key);
      queryClient.setQueryData<DrinkComment[]>(key, previous?.filter((c) => c.id !== commentId));
      const rollbackCount = bumpCommentCount(queryClient, drinkLogId, -1);
      return {
        rollback: () => {
          queryClient.setQueryData(key, previous);
          rollbackCount();
        },
      };
    },
    onError: (_err, _vars, context) => {
      context?.rollback();
    },
    onSettled: (_data, _err, { drinkLogId }) => {
      queryClient.invalidateQueries({ queryKey: ['comments', drinkLogId] });
      queryClient.invalidateQueries({ queryKey: ['feed', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['my-feed', currentUserId] });
    },
  });
}
