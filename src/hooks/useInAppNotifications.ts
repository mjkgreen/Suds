import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { InAppNotification } from '@/types/models';

const QUERY_KEY = ['inAppNotifications'] as const;

export function useInAppNotifications(): UseQueryResult<InAppNotification[]> {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<InAppNotification[]> => {
      const { data, error } = await supabase
        .from('in_app_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);

      // Hide notifications from users the current user has blocked
      // (RLS scopes user_blocks rows to the current user).
      const { data: blocks } = await supabase.from('user_blocks').select('blocked_id');
      const blockedIds = new Set((blocks ?? []).map((row: any) => row.blocked_id));

      return ((data ?? []) as InAppNotification[]).filter(
        (n) => !n.actor_id || !blockedIds.has(n.actor_id),
      );
    },
  });
}

export function useUnreadNotificationCount(): number {
  const { data } = useInAppNotifications();
  return (data ?? []).filter((n) => !n.read).length;
}

export function useNotificationRealtime(): void {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`in_app_notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'in_app_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);
}

export function useMarkNotificationsRead(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase
        .from('in_app_notifications')
        .update({ read: true })
        .eq('read', false);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
