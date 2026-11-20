import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { createPendingInviteStore } from '@/lib/pendingInvite';
import { shareLink } from '@/lib/share';
import {
  invitePath,
  ShareLinkKind,
  shareMessage,
  SharePreviewResult,
} from '@/lib/shareLinks';
import { useSessionStore } from '@/stores/sessionStore';
import type { SessionWithRole } from '@/types/models';

// The share-link RPCs (migration 051) aren't in the generated Database types yet.
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase.rpc as any)(fn, args);

/** The invite link opened while signed out, waiting for sign-up to finish. */
export const pendingInvites = createPendingInviteStore({
  getItem: (k) => AsyncStorage.getItem(k),
  setItem: (k, v) => AsyncStorage.setItem(k, v),
  removeItem: (k) => AsyncStorage.removeItem(k),
});

/**
 * Where a signed-in, onboarded user should land: the invite they opened
 * before signing up, or the feed. Doesn't clear the invite (the invite page
 * does, once it's showing), so it's safe to call from more than one place.
 */
export function homeRoute(): string {
  const pending = pendingInvites.peek();
  return pending ? invitePath(pending.token) : '/(tabs)/feed';
}

export function usePendingInvite() {
  return useSyncExternalStore(pendingInvites.subscribe, pendingInvites.peek, () => null);
}

interface ShareLinkInfo {
  token: string;
  kind: ShareLinkKind;
  session_id: string | null;
  expires_at: string | null;
}

export function shareLinkQueryKey(kind: ShareLinkKind, sessionId?: string) {
  return ['shareLink', kind, sessionId ?? null] as const;
}

/**
 * The caller's live link of a kind (creating one on first share). Only runs
 * when `enabled` — making a night-out link public is opt-in, so it's fetched
 * when the host asks to share, not on render.
 */
async function fetchShareLink(kind: ShareLinkKind, sessionId?: string): Promise<ShareLinkInfo> {
  const { data, error } = await rpc('get_or_create_share_link', {
    p_kind: kind,
    p_session_id: sessionId ?? null,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as ShareLinkInfo;
}

/** The caller's existing live link, without creating one. */
export function useExistingShareLink(kind: ShareLinkKind, sessionId?: string, enabled = true) {
  return useQuery({
    queryKey: [...shareLinkQueryKey(kind, sessionId), 'existing'],
    queryFn: async (): Promise<ShareLinkInfo | null> => {
      let q = (supabase.from as any)('share_links')
        .select('token, kind, session_id, expires_at')
        .eq('kind', kind)
        .is('revoked_at', null);
      q = sessionId ? q.eq('session_id', sessionId) : q;
      const { data, error } = await q.limit(1).maybeSingle();
      if (error) throw error;
      if (data?.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return null;
      return (data as ShareLinkInfo | null) ?? null;
    },
    enabled: enabled && (kind === 'profile' || !!sessionId),
  });
}

/** Creates (or reuses) the link and opens the share sheet. */
export function useShareInviteLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, sessionId, sessionTitle }: { kind: ShareLinkKind; sessionId?: string; sessionTitle?: string | null }) => {
      const link = await fetchShareLink(kind, sessionId);
      queryClient.setQueryData([...shareLinkQueryKey(kind, sessionId), 'existing'], link);
      await shareLink(invitePath(link.token), shareMessage(kind, sessionTitle));
      return link;
    },
  });
}

/** Turns a link off; anyone opening it after sees "This link was turned off". */
export function useRevokeShareLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ token }: { token: string; kind: ShareLinkKind; sessionId?: string }) => {
      const { error } = await rpc('revoke_share_link', { p_token: token });
      if (error) throw error;
    },
    onMutate: ({ kind, sessionId }) => {
      // Optimistic: the link disappears from the sheet at once.
      const key = [...shareLinkQueryKey(kind, sessionId), 'existing'];
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, null);
      return { key, previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) queryClient.setQueryData(ctx.key, ctx.previous);
    },
    onSettled: (_d, _e, { token }) => {
      queryClient.invalidateQueries({ queryKey: ['sharePreview', token] });
    },
  });
}

/** Public preview of a link; works signed out. */
export function useSharePreview(token: string | undefined, userId: string | undefined) {
  return useQuery({
    // Keyed by viewer: what's visible depends on who's asking.
    queryKey: ['sharePreview', token, userId ?? null],
    queryFn: async () => {
      const { data, error } = await rpc('get_share_preview', { p_token: token });
      if (error) throw error;
      return data as SharePreviewResult;
    },
    enabled: !!token,
    retry: false,
    // Live drink total on an open page.
    refetchInterval: 60_000,
  });
}

type FollowStatus = 'following' | 'requested';

function invalidateFollow(queryClient: ReturnType<typeof useQueryClient>, me: string | undefined, inviterId: string) {
  queryClient.invalidateQueries({ queryKey: ['followStatus', me, inviterId] });
  queryClient.invalidateQueries({ queryKey: ['profile', me] });
  queryClient.invalidateQueries({ queryKey: ['profile', inviterId] });
  queryClient.invalidateQueries({ queryKey: ['following', me] });
  queryClient.invalidateQueries({ queryKey: ['feed', me] });
}

/** Joins a night out through its link; also follows (or requests) the host. */
export function useJoinViaShareLink(userId: string | undefined) {
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ token }: { token: string; inviterId: string }) => {
      const { data, error } = await rpc('join_session_via_link', { p_token: token });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // Same shape as accept_session_invite, which useAcceptSessionInvite returns as-is.
      return data as SessionWithRole & { follow_status: FollowStatus };
    },
    onSuccess: (session, { token, inviterId }) => {
      setActiveSession(session);
      // Same invalidations as accepting a direct invite (useAcceptSessionInvite).
      queryClient.invalidateQueries({ queryKey: ['openSession'] });
      queryClient.invalidateQueries({ queryKey: ['sessionMembers', session.id] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['sharePreview', token] });
      queryClient.setQueryData(['followStatus', userId, inviterId], session.follow_status);
      invalidateFollow(queryClient, userId, inviterId);
    },
  });
}

/** Accepts a personal invite (or a night out that's over): follows the sharer. */
export function useAcceptShareInvite(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ token }: { token: string }) => {
      const { data, error } = await rpc('accept_share_invite', { p_token: token });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { inviter_id: string; follow_status: FollowStatus };
    },
    onSuccess: (result, { token }) => {
      queryClient.setQueryData(['followStatus', userId, result.inviter_id], result.follow_status);
      queryClient.invalidateQueries({ queryKey: ['sharePreview', token] });
      invalidateFollow(queryClient, userId, result.inviter_id);
    },
  });
}
