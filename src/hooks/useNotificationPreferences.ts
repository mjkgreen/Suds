import { useMutation, useQuery, useQueryClient, UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface NotificationPreferences {
  notify_likes: boolean;
  notify_comments: boolean;
  notify_follows: boolean;
}

const DEFAULTS: NotificationPreferences = {
  notify_likes: true,
  notify_comments: true,
  notify_follows: true,
};

export function useNotificationPreferences(
  userId: string | undefined
): UseQueryResult<NotificationPreferences> {
  return useQuery({
    queryKey: ['notification-preferences', userId],
    queryFn: async (): Promise<NotificationPreferences> => {
      // Ensure a row exists with defaults; ignore conflict if it already does
      await supabase
        .from('notification_preferences')
        .insert({ user_id: userId! })
        .select()
        .maybeSingle();

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('notify_likes, notify_comments, notify_follows')
        .eq('user_id', userId!)
        .single();

      if (error) throw error;
      return (data as NotificationPreferences) ?? DEFAULTS;
    },
    enabled: !!userId,
  });
}

export function useUpdateNotificationPreference(
  userId: string | undefined
): UseMutationResult<void, Error, Partial<NotificationPreferences>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>): Promise<void> => {
      const { error } = await supabase
        .from('notification_preferences')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('user_id', userId!);
      if (error) throw new Error(error.message);
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['notification-preferences', userId] });
      const previous = queryClient.getQueryData<NotificationPreferences>([
        'notification-preferences',
        userId,
      ]);
      queryClient.setQueryData<NotificationPreferences>(
        ['notification-preferences', userId],
        (old) => ({ ...(old ?? DEFAULTS), ...updates })
      );
      return { previous };
    },
    onError: (_err, _updates, context) => {
      const ctx = context as { previous?: NotificationPreferences } | undefined;
      if (ctx?.previous) {
        queryClient.setQueryData(['notification-preferences', userId], ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences', userId] });
    },
  });
}
