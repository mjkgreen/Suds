import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { SessionWithRole } from '@/types/models';
import { useSessionStore } from '@/stores/sessionStore';

interface InvitePreviewData {
  invite: {
    id: string;
    session_id: string;
    inviter_id: string;
    invitee_id: string;
    status: string;
    token: string;
    expires_at: string;
  };
  session: {
    id: string;
    user_id: string;
    title: string | null;
    started_at: string;
    ended_at: string | null;
    created_at: string;
  };
  inviter: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  error?: string;
}

export function useInviteByToken(token: string | undefined) {
  return useQuery({
    queryKey: ['invitePreview', token],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_invite_preview', { p_token: token! });
      if (error) throw error;
      return data as InvitePreviewData;
    },
    enabled: !!token,
    retry: false,
  });
}

export function useAcceptSessionInvite() {
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase
        .rpc('accept_session_invite', { p_token: token });
      if (error) throw error;
      const result = data as Record<string, unknown>;
      if (result.error) throw new Error(result.error as string);
      return result as unknown as SessionWithRole;
    },
    onSuccess: (session) => {
      setActiveSession(session);
      queryClient.invalidateQueries({ queryKey: ['openSession'] });
      queryClient.invalidateQueries({ queryKey: ['sessionMembers', session.id] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useDeclineSessionInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from('session_invites')
        .update({ status: 'declined' })
        .eq('id', inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitePreview'] });
    },
  });
}
