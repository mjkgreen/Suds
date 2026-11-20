import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { SessionWithRole } from '@/types/models';
import { useSessionStore } from '@/stores/sessionStore';
import { useAuthStore } from '@/stores/authStore';
import { useActiveSession, useLeaveSession } from '@/hooks/useSession';

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

/**
 * accept_session_invite (029) returns the night out's id as `session_id`;
 * SessionWithRole (and everything that reads the active session) uses `id`.
 */
export function joinedSessionFromRpc(result: Record<string, unknown>): SessionWithRole {
  return { ...result, id: (result.id ?? result.session_id) as string } as unknown as SessionWithRole;
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
      return joinedSessionFromRpc(result);
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

/**
 * The rule for joining any night out, by invite or by link: a host must end
 * their own night out first; a guest is moved out of theirs automatically.
 * `prepare()` returns false (after telling the user why) when they can't join.
 */
export function useMakeRoomToJoin() {
  const activeSession = useActiveSession();
  const { user } = useAuthStore();
  const { mutateAsync: leaveSession, isPending: isLeaving } = useLeaveSession();

  async function prepare(): Promise<boolean> {
    if (!activeSession) return true;
    if (activeSession.my_role === 'host') {
      Alert.alert(
        'Active Session',
        'You need to end your current session before joining another.',
        [{ text: 'OK' }],
      );
      return false;
    }
    if (user?.id) {
      await leaveSession({ sessionId: activeSession.id, userId: user.id });
    }
    return true;
  }

  return { activeSession, prepare, isLeaving };
}
