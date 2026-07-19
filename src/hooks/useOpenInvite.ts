import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { SessionWithRole } from '@/types/models';
import { useSessionStore } from '@/stores/sessionStore';
import { AnalyticsEvents, track } from '@/lib/analytics';

export interface OpenInvitePreview {
  session: {
    id: string;
    title: string | null;
    started_at: string;
  };
  inviter: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  member_count: number;
  error?: string;
}

interface ShareLink {
  token: string;
  expires_at: string;
  error?: string;
}

// Get-or-create the caller's shareable link for a session. Query (not
// mutation) so the modal can just render it; the RPC is idempotent.
export function useSessionShareLink(sessionId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['sessionShareLink', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_or_create_session_share_link', { p_session_id: sessionId! });
      if (error) throw error;
      const link = data as ShareLink;
      if (link.error) throw new Error(link.error);
      track(AnalyticsEvents.InviteLinkCreated, { session_id: sessionId });
      return link;
    },
    enabled: !!sessionId && enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

// Public preview — works signed out (web landing page) and signed in.
export function useOpenInvitePreview(token: string | undefined) {
  return useQuery({
    queryKey: ['openInvitePreview', token],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_open_invite_preview', { p_token: token! });
      if (error) throw error;
      return data as OpenInvitePreview;
    },
    enabled: !!token,
    retry: false,
  });
}

export function useJoinByToken() {
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase
        .rpc('join_session_by_token', { p_token: token });
      if (error) throw error;
      const result = data as Record<string, unknown>;
      if (result.error) throw new Error(result.error as string);
      return result as unknown as SessionWithRole;
    },
    onSuccess: (session) => {
      setActiveSession(session);
      track(AnalyticsEvents.InviteJoinSucceeded, { session_id: session.id });
      queryClient.invalidateQueries({ queryKey: ['openSession'] });
      queryClient.invalidateQueries({ queryKey: ['sessionMembers', session.id] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
      queryClient.invalidateQueries({ queryKey: ['followers'] });
    },
  });
}
