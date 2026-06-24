import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/sessionStore';
import { Session, SessionWithRole } from '@/types/models';
import { useLiveActivity } from './useLiveActivity';
import * as LiveActivityBridge from 'suds-live-activity-bridge';

export function useActiveSession() {
  return useSessionStore((s) => s.activeSession);
}

export function useStartSession() {
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const queryClient = useQueryClient();
  const { startActivity } = useLiveActivity();

  return useMutation({
    mutationFn: async ({ userId, title }: { userId: string; title?: string }) => {
      const { data, error } = await supabase
        .from('sessions')
        .insert({ user_id: userId, title: title ?? null })
        .select()
        .single();
      if (error) throw error;
      return { ...data, my_role: 'host' } as SessionWithRole;
    },
    onSuccess: (session) => {
      setActiveSession(session);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      startActivity({ sessionTitle: session.title ?? 'Session', drinkCount: 0, elapsedMinutes: 0 });
    },
  });
}

export function useEndSession() {
  const { setActiveSession } = useSessionStore();
  const queryClient = useQueryClient();
  const { endActivity } = useLiveActivity();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      setActiveSession(null);
      endActivity();
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['sessionMembers'] });
    },
  });
}

export function useLeaveSession() {
  const { setActiveSession } = useSessionStore();
  const queryClient = useQueryClient();
  const { endActivity } = useLiveActivity();

  return useMutation({
    mutationFn: async ({ sessionId, userId }: { sessionId: string; userId: string }) => {
      const { error } = await supabase
        .from('session_members')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      setActiveSession(null);
      endActivity();
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useDeleteSession() {
  const { activeSession, setActiveSession } = useSessionStore();
  const queryClient = useQueryClient();
  const { endActivity } = useLiveActivity();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.rpc('delete_session_with_drinks', { p_session_id: sessionId } as any);
      if (error) throw error;
    },
    onSuccess: (_data, sessionId) => {
      if (activeSession?.id === sessionId) {
        setActiveSession(null);
        endActivity();
      }
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['openSession'] });
      queryClient.invalidateQueries({ queryKey: ['sessionDetail', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['drinkLogs'] });
      queryClient.invalidateQueries({ queryKey: ['userStats'] });
    },
  });
}

export function useMyOpenSession(userId: string | undefined) {
  const setActiveSession = useSessionStore((s) => s.setActiveSession);

  return useQuery({
    queryKey: ['openSession', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_my_active_session')
        .maybeSingle();
      if (error) throw error;
      const session = data as SessionWithRole | null;
      setActiveSession(session);
      // Clean up any orphaned Live Activities from a previous force-kill
      if (!session) {
        LiveActivityBridge.endAllActivities().catch(() => {});
      }
      return session;
    },
    enabled: !!userId,
  });
}

export function useSessionDrinks(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['sessionDrinks', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drink_logs')
        .select('*')
        .eq('session_id', sessionId!)
        .order('logged_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
    refetchInterval: 15_000,
  });
}
