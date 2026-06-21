import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { SessionMember, SessionInvite } from '@/types/models';

export function useSessionMembers(
  sessionId: string | undefined,
  options?: { staleTime?: number }
) {
  return useQuery({
    queryKey: ['sessionMembers', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_session_members_with_profiles', { p_session_id: sessionId! });
      if (error) throw error;
      return (data ?? []) as SessionMember[];
    },
    enabled: !!sessionId,
    staleTime: options?.staleTime ?? 30_000,
  });
}

export function useInviteToSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, inviteeId }: { sessionId: string; inviteeId: string }) => {
      // If a prior declined invite exists, remove it before re-inviting
      await supabase
        .from('session_invites')
        .delete()
        .eq('session_id', sessionId)
        .eq('invitee_id', inviteeId)
        .eq('status', 'declined');

      const { error } = await supabase
        .from('session_invites')
        .insert({ session_id: sessionId, inviter_id: (await supabase.auth.getUser()).data.user!.id, invitee_id: inviteeId });
      if (error) throw error;
    },
    onSuccess: (_data, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: ['sessionInvites', sessionId] });
    },
  });
}

export function useSessionInvites(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['sessionInvites', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('session_invites')
        .select('*')
        .eq('session_id', sessionId!);
      if (error) throw error;
      return (data ?? []) as SessionInvite[];
    },
    enabled: !!sessionId,
  });
}
