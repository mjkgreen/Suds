import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { checkLegalAge, LegalAgeCheck } from '@/lib/ageCheck';

const storageKey = (userId: string) => `suds-age-check:${userId}`;

/** Records a check so the launch gate doesn't immediately repeat it. */
export function rememberAgeCheck(userId: string, allowed: boolean): void {
  AsyncStorage.setItem(storageKey(userId), JSON.stringify({ allowed, checkedAt: Date.now() })).catch(() => {});
}

/** Whether this person already passed on this device. A pass is final. */
async function alreadyPassed(userId: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    return !!raw && JSON.parse(raw).allowed === true;
  } catch {
    return false;
  }
}

/**
 * Keeps signed-in people who aren't of legal drinking age where they are out
 * of the app. Checks once: after someone passes (here or at onboarding) they're
 * never checked again on this device. While blocked they're checked on every
 * launch, so they get in once they're of age. The app stays usable while a
 * check runs.
 */
export function useLegalAgeGate(
  userId: string | undefined,
  birthdate: string | null | undefined,
  enabled: boolean,
): { blocked: LegalAgeCheck | null; recheck: () => Promise<void>; checking: boolean } {
  const [blocked, setBlocked] = useState<LegalAgeCheck | null>(null);
  const [checking, setChecking] = useState(false);

  const run = useCallback(
    async (force: boolean) => {
      if (!userId) return;
      if (!force && (await alreadyPassed(userId))) {
        setBlocked(null);
        return;
      }
      setChecking(true);
      try {
        const result = await checkLegalAge(birthdate);
        rememberAgeCheck(userId, result.allowed);
        setBlocked(result.allowed ? null : result);
      } finally {
        setChecking(false);
      }
    },
    [userId, birthdate],
  );

  useEffect(() => {
    if (!enabled || !userId) {
      setBlocked(null);
      return;
    }
    run(false);
  }, [enabled, userId, run]);

  return { blocked, recheck: () => run(true), checking };
}
