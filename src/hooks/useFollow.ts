import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { FollowRequest, FollowStatus } from '@/types/models';
import {
  classifyFollowInsertError,
  FollowAction,
  getFollowActions,
  statusForAction,
} from '@/utils/followHelpers';

/** The viewer's relationship to a target account: none / requested / following. */
export function useFollowStatus(viewerId: string | undefined, targetId: string | undefined) {
  return useQuery({
    queryKey: ['followStatus', viewerId, targetId],
    queryFn: async (): Promise<FollowStatus> => {
      const [followRes, requestRes] = await Promise.all([
        supabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', viewerId!)
          .eq('following_id', targetId!)
          .maybeSingle(),
        supabase
          .from('follow_requests')
          .select('requester_id')
          .eq('requester_id', viewerId!)
          .eq('target_id', targetId!)
          .maybeSingle(),
      ]);
      if (followRes.data) return 'following';
      if (requestRes.data) return 'requested';
      return 'none';
    },
    enabled: !!viewerId && !!targetId,
  });
}

export function useFollow(currentUserId: string | undefined) {
  const queryClient = useQueryClient();

  function invalidate(targetUserId: string) {
    queryClient.invalidateQueries({ queryKey: ['followStatus', currentUserId, targetUserId] });
    queryClient.invalidateQueries({ queryKey: ['profile', currentUserId] });
    queryClient.invalidateQueries({ queryKey: ['profile', targetUserId] });
    queryClient.invalidateQueries({ queryKey: ['feed', currentUserId] });
    queryClient.invalidateQueries({ queryKey: ['my-feed', targetUserId] });
  }

  async function runAction(action: FollowAction, targetUserId: string) {
    if (action === 'follow') {
      return (supabase.from('follows') as any).insert({
        follower_id: currentUserId!,
        following_id: targetUserId,
      });
    }
    return (supabase.from('follow_requests') as any).insert({
      requester_id: currentUserId!,
      target_id: targetUserId,
    });
  }

  // Follows public accounts directly; sends a request to private ones.
  // Race-safe: if the target flips privacy between render and tap, the RLS
  // policies reject the wrong table and we retry with the other action.
  const followMutation = useMutation({
    mutationFn: async ({
      targetId,
      isPrivate,
    }: {
      targetId: string;
      isPrivate: boolean;
    }): Promise<FollowStatus> => {
      const { primary, fallback } = getFollowActions(isPrivate);

      const primaryRes = await runAction(primary, targetId);
      if (!primaryRes.error) return statusForAction(primary);

      const primaryOutcome = classifyFollowInsertError(primaryRes.error.code);
      if (primaryOutcome === 'already_done') return statusForAction(primary);
      if (primaryOutcome === 'fatal') throw primaryRes.error;

      const fallbackRes = await runAction(fallback, targetId);
      if (!fallbackRes.error) return statusForAction(fallback);
      if (classifyFollowInsertError(fallbackRes.error.code) === 'already_done') {
        return statusForAction(fallback);
      }
      throw fallbackRes.error;
    },
    onSuccess: (_status, { targetId }) => invalidate(targetId),
  });

  const unfollowMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId!)
        .eq('following_id', targetUserId);
      if (error) throw error;
    },
    onSuccess: (_data, targetUserId) => invalidate(targetUserId),
  });

  // Withdraw an outgoing pending request.
  const cancelRequestMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const { error } = await supabase
        .from('follow_requests')
        .delete()
        .eq('requester_id', currentUserId!)
        .eq('target_id', targetUserId);
      if (error) throw error;
    },
    onSuccess: (_data, targetUserId) => invalidate(targetUserId),
  });

  return { follow: followMutation, unfollow: unfollowMutation, cancelRequest: cancelRequestMutation };
}

/** Pending requests to follow the given user (their approval queue). */
export function useIncomingFollowRequests(userId: string | undefined) {
  return useQuery({
    queryKey: ['followRequests', userId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('follow_requests')
        .select('*, requester:profiles!requester_id(*)')
        .eq('target_id', userId!)
        .order('created_at', { ascending: false }) as any);
      if (error) throw error;
      return (data ?? []) as FollowRequest[];
    },
    enabled: !!userId,
  });
}

export function useAcceptFollowRequest(currentUserId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requesterId: string) => {
      const { error } = await (supabase.rpc as any)('accept_follow_request', {
        p_requester: requesterId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, requesterId) => {
      queryClient.invalidateQueries({ queryKey: ['followRequests', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['followers', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['profile', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['profile', requesterId] });
      queryClient.invalidateQueries({ queryKey: ['followStatus', requesterId, currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['inAppNotifications'] });
    },
  });
}

export function useDeclineFollowRequest(currentUserId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requesterId: string) => {
      const { error } = await supabase
        .from('follow_requests')
        .delete()
        .eq('requester_id', requesterId)
        .eq('target_id', currentUserId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followRequests', currentUserId] });
    },
  });
}

export function useFollowers(userId: string | undefined) {
  return useQuery({
    queryKey: ['followers', userId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('follows')
        .select(`
          follower_id,
          profile:profiles!follower_id(*)
        `)
        .eq('following_id', userId!) as any);
      if (error) throw error;
      // return an array of profiles
      // ignore rows where profile might be missing due to referential integrity issues though they shouldn't occur
      return data.map((row: any) => row.profile).filter(Boolean);
    },
    enabled: !!userId,
  });
}

export function useFollowing(userId: string | undefined) {
  return useQuery({
    queryKey: ['following', userId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('follows')
        .select(`
          following_id,
          profile:profiles!following_id(*)
        `)
        .eq('follower_id', userId!) as any);
      if (error) throw error;
      return data.map((row: any) => row.profile).filter(Boolean);
    },
    enabled: !!userId,
  });
}
