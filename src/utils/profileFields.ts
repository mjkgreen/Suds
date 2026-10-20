import { Profile } from '@/types/models';

/**
 * Fields that live on companion tables rather than `profiles`, because the
 * profiles row is publicly readable (RLS `USING (true)`):
 *   - body metrics → user_private_metrics (owner-only)
 *   - displayed_badges → user_badges (self + approved viewers)
 * See migration 038.
 */
export const METRIC_FIELDS = ['height', 'height_unit', 'weight', 'weight_unit', 'birthdate'] as const;

export type ProfileUpdate = Partial<
  Pick<
    Profile,
    | 'display_name'
    | 'bio'
    | 'avatar_url'
    | 'username'
    | 'onboarded'
    | 'height'
    | 'height_unit'
    | 'weight'
    | 'weight_unit'
    | 'birthdate'
    | 'displayed_badges'
    | 'is_private'
  >
>;

export interface SplitProfileUpdate {
  /** Columns that remain on the `profiles` table. */
  profile: Record<string, unknown>;
  /** Columns destined for `user_private_metrics`. */
  metrics: Record<string, unknown>;
  /** `user_badges.badge_ids`, present only when the caller set displayed_badges. */
  badges?: string[];
}

/**
 * Partitions a profile update across the three tables the fields now live in,
 * so a single `useUpdateProfile` call still works from every existing caller.
 */
export function splitProfileUpdates(updates: ProfileUpdate): SplitProfileUpdate {
  const profile: Record<string, unknown> = {};
  const metrics: Record<string, unknown> = {};
  let badges: string[] | undefined;

  for (const [key, value] of Object.entries(updates)) {
    if (key === 'displayed_badges') {
      badges = (value as string[] | undefined) ?? [];
    } else if ((METRIC_FIELDS as readonly string[]).includes(key)) {
      metrics[key] = value;
    } else {
      profile[key] = value;
    }
  }

  return { profile, metrics, badges };
}
