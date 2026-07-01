import { Platform } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { supabase } from '@/lib/supabase';
import * as LiveActivityBridge from 'suds-live-activity-bridge';
import { SessionMember } from '@/types/models';
import { formatMemberNames } from '@/utils/profileHelpers';

export interface SessionActivityState {
  sessionTitle: string;
  drinkCount: number;
  elapsedMinutes: number;
}

// Module-level — survive hook remounts across screen navigation.
// JS (Hermes) is single-threaded so these are safe without locks.
let _timer: ReturnType<typeof setInterval> | null = null;
let _sessionStartMs: number | null = null; // authoritative epoch: activeSession.started_at

export function weightToLbs(weight: number | null | undefined, unit: 'kg' | 'lb' | null | undefined): number {
  if (!weight || weight <= 0) return 0;
  return unit === 'kg' ? weight * 2.20462 : weight;
}

export function computeBAC(drinkCount: number, elapsedMinutes: number, weightLbs: number): number {
  if (weightLbs <= 0 || drinkCount === 0) return 0;
  // Widmark formula with neutral r=0.70 (midpoint of 0.66F/0.73M — no gender field in profile)
  const bac = (drinkCount * 0.6 * 5.14) / (weightLbs * 0.70) - (0.015 * elapsedMinutes / 60);
  return Math.max(0, Math.round(bac * 1000) / 1000);
}

export function useLiveActivity() {
  const { setLiveActivityId, setLiveActivityDrinkCount, setLiveActivityLastDrinkName,
          setLiveActivityMemberCount, setLiveActivityMemberNames } = useSessionStore();

  async function startActivity(state: SessionActivityState): Promise<void> {
    if (Platform.OS !== 'ios') return;

    const { session, profile } = useAuthStore.getState();
    const { activeSession } = useSessionStore.getState();
    const weightLbs = weightToLbs(profile?.weight, profile?.weight_unit);

    // Use the DB-authoritative session start time as the epoch for elapsed/BAC calculations
    _sessionStartMs = activeSession?.started_at
      ? new Date(activeSession.started_at).getTime()
      : Date.now();

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      console.warn('[LiveActivity] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY — QuickLog intent will not work');
    } else if (activeSession?.id && session?.user?.id && session.refresh_token) {
      LiveActivityBridge.writeSharedSession(
        activeSession.id,
        session.user.id,
        session.refresh_token,
        weightLbs,
        supabaseUrl,
        anonKey,
        _sessionStartMs,
        '',
        '',
      );
    } else {
      console.warn('[LiveActivity] writeSharedSession skipped — missing sessionId, userId, or refresh_token. +1 button will not log drinks.');
    }

    console.warn('[LiveActivity] isSupported:', LiveActivityBridge.isSupported());
    let id: string | null = null;
    try {
      id = await LiveActivityBridge.startActivity(state.sessionTitle, state.drinkCount, 1, '');
    } catch (e) {
      console.warn('[LiveActivity] startActivity threw:', e);
      return;
    }
    console.warn('[LiveActivity] startActivity id:', id);
    if (!id) return;

    setLiveActivityId(id);
    setLiveActivityDrinkCount(state.drinkCount);
    setLiveActivityLastDrinkName('');
    setLiveActivityMemberCount(1);
    setLiveActivityMemberNames('');

    _timer = setInterval(() => {
      void (async () => {
        try {
          const {
            liveActivityId,
            liveActivityLastDrinkName,
            activeSession: currentSession,
          } = useSessionStore.getState();
          if (!liveActivityId || !_sessionStartMs) return;

          const elapsed = Math.floor((Date.now() - _sessionStartMs) / 60_000);

          // Query ground-truth counts from DB — picks up drinks logged via the widget +1
          // intent, which bypass the JS mutation flow and never update the Zustand store.
          let drinkCount = useSessionStore.getState().liveActivityDrinkCount;
          let memberCount = 1;
          let memberNames = useSessionStore.getState().liveActivityMemberNames;

          if (currentSession?.id) {
            const currentUserId = useAuthStore.getState().session?.user?.id;
            const [drinkRes, membersRes] = await Promise.all([
              supabase.from('drink_logs').select('*', { count: 'exact', head: true }).eq('session_id', currentSession.id),
              supabase.rpc('get_session_members_with_profiles', { p_session_id: currentSession.id }),
            ]);
            if (drinkRes.count !== null) {
              drinkCount = drinkRes.count;
              useSessionStore.getState().setLiveActivityDrinkCount(drinkCount);
            }
            const coMembers = ((membersRes.data ?? []) as SessionMember[])
              .filter((m) => m.user_id !== currentUserId);
            memberCount = coMembers.length + 1;
            memberNames = formatMemberNames(coMembers);
            useSessionStore.getState().setLiveActivityMemberNames(memberNames);
          }
          setLiveActivityMemberCount(memberCount);

          const { profile: currentProfile } = useAuthStore.getState();
          const wLbs = weightToLbs(currentProfile?.weight, currentProfile?.weight_unit);
          const bac = computeBAC(drinkCount, elapsed, wLbs);

          await LiveActivityBridge.updateActivity(
            liveActivityId,
            drinkCount,
            elapsed,
            liveActivityLastDrinkName,
            memberCount,
            bac,
            memberNames,
          );
        } catch {
          // Silently ignore — timer will retry on the next tick
        }
      })();
    }, 60_000);
  }

  async function updateActivity(state: Partial<SessionActivityState>): Promise<void> {
    if (Platform.OS !== 'ios') return;
    const { liveActivityId, liveActivityDrinkCount, liveActivityLastDrinkName,
            liveActivityMemberCount, liveActivityMemberNames } = useSessionStore.getState();
    if (!liveActivityId) return;
    const elapsed = _sessionStartMs ? Math.floor((Date.now() - _sessionStartMs) / 60_000) : 0;
    const count = state.drinkCount ?? liveActivityDrinkCount;
    const { profile } = useAuthStore.getState();
    const wLbs = weightToLbs(profile?.weight, profile?.weight_unit);
    const bac = computeBAC(count, elapsed, wLbs);
    setLiveActivityDrinkCount(count);
    await LiveActivityBridge.updateActivity(
      liveActivityId,
      count,
      elapsed,
      liveActivityLastDrinkName,
      liveActivityMemberCount,
      bac,
      liveActivityMemberNames,
    );
  }

  async function endActivity(): Promise<void> {
    if (Platform.OS !== 'ios') return;
    if (_timer) { clearInterval(_timer); _timer = null; }
    _sessionStartMs = null;

    const { liveActivityId } = useSessionStore.getState();
    if (liveActivityId) {
      await LiveActivityBridge.endActivity(liveActivityId).catch(() => {});
    }
    // Clear shared session AFTER ending the activity so the intent can't fire
    // against missing data during the dismissal window
    LiveActivityBridge.clearSharedSession();

    setLiveActivityId(null);
    setLiveActivityDrinkCount(0);
    setLiveActivityLastDrinkName('');
    setLiveActivityMemberCount(1);
    setLiveActivityMemberNames('');
  }

  return { startActivity, updateActivity, endActivity };
}
