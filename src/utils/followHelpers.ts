import { FollowStatus } from '@/types/models';

export type FollowAction = 'follow' | 'request';

/**
 * A tap on "Follow" inserts into `follows` for public accounts and into
 * `follow_requests` for private ones. Each insert can fail if the target
 * flipped privacy mid-flight (the RLS policies reject the now-wrong table),
 * in which case the other action is the correct one.
 */
export function getFollowActions(targetIsPrivate: boolean): {
  primary: FollowAction;
  fallback: FollowAction;
} {
  return targetIsPrivate
    ? { primary: 'request', fallback: 'follow' }
    : { primary: 'follow', fallback: 'request' };
}

export function statusForAction(action: FollowAction): FollowStatus {
  return action === 'follow' ? 'following' : 'requested';
}

/**
 * Classifies a PostgREST error code from a follow/request insert:
 * - 23505 (unique violation): the row already exists — a double-tap; the
 *   desired state is already in place, treat as success.
 * - 42501 (insufficient privilege / RLS): the target's privacy flag changed
 *   between render and tap — retry with the other action.
 * - anything else is a real error.
 */
export function classifyFollowInsertError(
  code: string | null | undefined
): 'already_done' | 'privacy_flipped' | 'fatal' {
  if (code === '23505') return 'already_done';
  if (code === '42501') return 'privacy_flipped';
  return 'fatal';
}
