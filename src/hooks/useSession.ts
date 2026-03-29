import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/sessionStore';
import { Session } from '@/types/models';

export function useActiveSession() {
  return useSessionStore((s) => s.activeSession);
}

export function useStartSession() {
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, title }: { userId: string; title?: string }) => {
      const { data, error } = await supabase
        .from('sessions')
        .insert({ user_id: userId, title: title ?? null })
        .select()
        .single();
      if (error) throw error;
      return data as Session;
    },
    onSuccess: (session) => {
      setActiveSession(session);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useEndSession() {
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const queryClient = useQueryClient();

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
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useMyOpenSession(userId: string | undefined) {
  const setActiveSession = useSessionStore((s) => s.setActiveSession);

  return useQuery({
    queryKey: ['openSession', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userId!)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      // Hydrate store on load
      setActiveSession(data as Session | null);
      return data as Session | null;
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
  });
}
