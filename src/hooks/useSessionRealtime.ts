import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/sessionStore';

/** Collapse a burst of drinks (e.g. a round) into one refetch. */
const REFRESH_DEBOUNCE_MS = 750;

/**
 * While the user is in a night out, refresh the feed and the night out's
 * drink list whenever someone else in it logs, edits or moves a drink, so
 * nobody has to pull to refresh to see the group's drinks. (The user's own
 * drinks already show instantly via the optimistic update in useDrinkLog.)
 *
 * The iOS Live Activity has its own channel for its counts; this one runs on
 * every platform, with or without a Live Activity.
 */
export function useSessionRealtime(userId: string | undefined): void {
  const queryClient = useQueryClient();
  const sessionId = useSessionStore((s) => s.activeSession?.id);

  useEffect(() => {
    if (!userId || !sessionId) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void queryClient.invalidateQueries({ queryKey: ['feed'] });
        void queryClient.invalidateQueries({ queryKey: ['sessionDrinks', sessionId] });
      }, REFRESH_DEBOUNCE_MS);
    };

    const onDrinkChange = (payload: { new?: Record<string, unknown> }) => {
      // Our own changes are already handled by the mutation that made them.
      if (payload.new?.user_id === userId) return;
      refresh();
    };

    const filter = `session_id=eq.${sessionId}`;
    const channel = supabase
      .channel(`session-feed-${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'drink_logs', filter }, onDrinkChange)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'drink_logs', filter }, onDrinkChange)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [userId, sessionId, queryClient]);
}
