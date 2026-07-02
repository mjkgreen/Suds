import { AppState, Platform } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { supabase } from '@/lib/supabase';
import * as LiveActivityBridge from 'suds-live-activity-bridge';
import { SessionMember, SessionWithRole } from '@/types/models';
import { formatMemberNames } from '@/utils/profileHelpers';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface SessionActivityState {
  sessionTitle: string;
  drinkCount: number;
}

export function weightToLbs(weight: number | null | undefined, unit: 'kg' | 'lb' | null | undefined): number {
  if (!weight || weight <= 0) return 0;
  return unit === 'kg' ? weight * 2.20462 : weight;
}

// Module-level — survive hook remounts across screen navigation.
// JS (Hermes) is single-threaded so these are safe without locks.
let _timer: ReturnType<typeof setInterval> | null = null;
let _channel: RealtimeChannel | null = null;
let _sessionStartMs: number | null = null; // authoritative epoch: activeSession.started_at

// Pull fresh drink count + members from DB and push a ContentState update.
async function _refresh(): Promise<void> {
  try {
    const { liveActivityId, liveActivityLastDrinkName, activeSession } = useSessionStore.getState();
    if (!liveActivityId || !_sessionStartMs) return;

    let drinkCount = useSessionStore.getState().liveActivityDrinkCount;
    let memberCount = 1;
    let memberNames = useSessionStore.getState().liveActivityMemberNames;

    if (activeSession?.id) {
      const currentUserId = useAuthStore.getState().session?.user?.id;
      const [drinkRes, membersRes] = await Promise.all([
        supabase.from('drink_logs').select('*', { count: 'exact', head: true }).eq('session_id', activeSession.id),
        supabase.rpc('get_session_members_with_profiles', { p_session_id: activeSession.id }),
      ]);

      // Re-check after await — endActivity may have run while we were waiting
      if (!useSessionStore.getState().liveActivityId) return;

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
    useSessionStore.getState().setLiveActivityMemberCount(memberCount);

    await LiveActivityBridge.updateActivity(
      liveActivityId,
      drinkCount,
      liveActivityLastDrinkName,
      memberCount,
      memberNames,
    );
  } catch {
    // Silently ignore — timer will retry on the next tick
  }
}

function _ensureTimerRunning(): void {
  if (_timer) return;
  _timer = setInterval(() => { void _refresh(); }, 60_000);
}

// Realtime subscription — fires _refresh() the moment the intent's DB write lands,
// collapsing the 60-second wait to the intent's own JWT-refresh + network latency (~3-5s).
function _subscribeToSessionDrinks(sessionId: string): void {
  if (_channel) return;
  _channel = supabase
    .channel(`la-drinks-${sessionId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'drink_logs', filter: `session_id=eq.${sessionId}` },
      () => { void _refresh(); })
    .subscribe();
}

function _unsubscribeFromSessionDrinks(): void {
  if (_channel) { void supabase.removeChannel(_channel); _channel = null; }
}

// Registered once at module load. When the app returns to the foreground, immediately sync
// drink count + members (picks up +1 intent drinks logged while backgrounded) and restart
// the 60-second timer if it was cleared.
const _appStateSub = Platform.OS === 'ios'
  ? AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        const { liveActivityId } = useSessionStore.getState();
        if (liveActivityId && _sessionStartMs) {
          void _refresh();
          _ensureTimerRunning();
        }
      }
    })
  : null;

// Called by useMyOpenSession when the app opens and finds an existing active session.
// Restores the module-level timer state without touching the native activity, and
// recovers liveActivityId from the native ActivityKit state (wiped by a force-kill).
export function resumeActivity(session: SessionWithRole): void {
  if (Platform.OS !== 'ios') return;
  _sessionStartMs = session.started_at
    ? new Date(session.started_at).getTime()
    : Date.now();

  void (async () => {
    try {
      const activities = await LiveActivityBridge.getActivities();
      if (activities.length > 0) {
        // Restore the ID that was wiped from Zustand by the force-kill
        useSessionStore.getState().setLiveActivityId(activities[0].id);
      }
    } catch {
      // getActivities failed — _refresh will no-op until a drink log provides the ID
    }
    void _refresh();
    _ensureTimerRunning();
    if (session.id) { _subscribeToSessionDrinks(session.id); }
  })();
}

export function useLiveActivity() {
  const { setLiveActivityId, setLiveActivityDrinkCount, setLiveActivityLastDrinkName,
          setLiveActivityMemberCount, setLiveActivityMemberNames } = useSessionStore();

  async function startActivity(state: SessionActivityState): Promise<void> {
    if (Platform.OS !== 'ios') return;

    const { session, profile } = useAuthStore.getState();
    const { activeSession } = useSessionStore.getState();
    const weightLbs = weightToLbs(profile?.weight, profile?.weight_unit);

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

    let id: string | null = null;
    try {
      id = await LiveActivityBridge.startActivity(state.sessionTitle, state.drinkCount, 1, '', _sessionStartMs, weightLbs);
    } catch (e) {
      console.warn('[LiveActivity] startActivity threw:', e);
      return;
    }
    if (!id) return;

    setLiveActivityId(id);
    setLiveActivityDrinkCount(state.drinkCount);
    setLiveActivityLastDrinkName('');
    setLiveActivityMemberCount(1);
    setLiveActivityMemberNames('');

    _ensureTimerRunning();
    if (activeSession?.id) { _subscribeToSessionDrinks(activeSession.id); }
  }

  async function updateActivity(state: Partial<SessionActivityState>): Promise<void> {
    if (Platform.OS !== 'ios') return;
    const { liveActivityId, liveActivityDrinkCount, liveActivityLastDrinkName,
            liveActivityMemberCount, liveActivityMemberNames } = useSessionStore.getState();
    if (!liveActivityId) return;
    const count = state.drinkCount ?? liveActivityDrinkCount;
    setLiveActivityDrinkCount(count);
    await LiveActivityBridge.updateActivity(
      liveActivityId,
      count,
      liveActivityLastDrinkName,
      liveActivityMemberCount,
      liveActivityMemberNames,
    );
  }

  async function endActivity(): Promise<void> {
    if (Platform.OS !== 'ios') return;
    _unsubscribeFromSessionDrinks();
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
