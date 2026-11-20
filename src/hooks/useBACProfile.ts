import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usePrefsStore } from '@/stores/prefsStore';
import { ProfileInput } from '@/utils/bacHelpers';

/** Used until the user has entered a weight. */
const DEFAULT_WEIGHT_LB = 150;

function toBACProfile(
  profile: { weight?: number | null; weight_unit?: string | null } | null | undefined,
  sex: 'male' | 'female',
): ProfileInput {
  return {
    weight: profile?.weight ?? DEFAULT_WEIGHT_LB,
    weightUnit: profile?.weight ? ((profile.weight_unit ?? 'lb') as 'kg' | 'lb') : 'lb',
    sex,
  };
}

/**
 * The body inputs for every BAC estimate: weight from the user's profile, sex
 * from their BAC setting. The banner, night-out page, profile estimator and
 * Live Activity all use this so they show the same number.
 */
export function useBACProfile(): ProfileInput {
  const profile = useAuthStore((s) => s.profile);
  const sex = usePrefsStore((s) => s.sex);
  return useMemo(() => toBACProfile(profile, sex), [profile?.weight, profile?.weight_unit, sex]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Same as useBACProfile, outside React (Live Activity refresh). */
export function currentBACProfile(): ProfileInput {
  return toBACProfile(useAuthStore.getState().profile, usePrefsStore.getState().sex);
}
