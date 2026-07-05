import { AppState, Platform } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
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
let _channelSessionId: string | null = null;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
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
        (supabase.rpc as any)('get_session_members_with_profiles', { p_session_id: activeSession.id }),
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
    void queryClient.invalidateQueries({ queryKey: ['feed'] });
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
// Status callback detects CLOSED/CHANNEL_ERROR (e.g., WebSocket drop on iOS background)
// and schedules a reconnect so the channel doesn't silently die.
function _subscribeToSessionDrinks(sessionId: string): void {
  // If the session has already ended (endActivity cleared liveActivityId), a pending
  // reconnect timer may still fire this function. Abort so we don't create a ghost
  // channel that leaks a WebSocket subscription after the session is over.
  if (!useSessionStore.getState().liveActivityId) return;

  // Clear stale channel if it's for a different session (or was left over after a session end
  // that didn't reach endActivity). Without this, the `if (_channel) return` guard below
  // would permanently block subscriptions for the new session.
  if (_channel && _channelSessionId !== sessionId) {
    void supabase.removeChannel(_channel);
    _channel = null;
    _channelSessionId = null;
  }
  if (_channel) return; // already subscribed to this session

  _channelSessionId = sessionId;
  _channel = supabase
    .channel(`la-drinks-${sessionId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'drink_logs', filter: `session_id=eq.${sessionId}` },
      () => {
        void _refresh();
        void queryClient.invalidateQueries({ queryKey: ['feed'] });
      },
    )
    .subscribe((status) => {
      // WebSocket drops (common on iOS background/foreground) leave the channel in
      // CLOSED or CHANNEL_ERROR without triggering a reconnect by default. Detect it
      // and retry after 5s so the channel stays live for the duration of the session.
      // Cancel any pending timer first to prevent duplicate channels from multiple callbacks.
      if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        _channel = null;
        _channelSessionId = null;
        if (_reconnectTimer) clearTimeout(_reconnectTimer);
        _reconnectTimer = setTimeout(() => {
          _reconnectTimer = null;
          _subscribeToSessionDrinks(sessionId);
        }, 5_000);
      }
    });
}

function _unsubscribeFromSessionDrinks(): void {
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
  if (_channel) { void supabase.removeChannel(_channel); _channel = null; }
  _channelSessionId = null;
}

// The +1 widget intent runs in a separate OS process and self-refreshes the Supabase session
// independently when its cached access token expires, rotating the single-use refresh token.
// If this app doesn't pick up that rotation, its own next auto-refresh retries the now-stale
// token and Supabase force-signs the user out ("Invalid Refresh Token: Already Used"). Adopt
// the widget's copy whenever it's newer than what this app currently holds.
function _reconcileAuthFromSharedStorage(): void {
  const shared = LiveActivityBridge.readSharedAuthTokens();
  const { session } = useAuthStore.getState();
  if (!shared || !session || shared.refreshToken === session.refresh_token) return;
  void supabase.auth.setSession({
    access_token: shared.accessToken,
    refresh_token: shared.refreshToken,
  });
}

// Registered once at module load. When the app returns to the foreground, immediately sync
// drink count + members (picks up +1 intent drinks logged while backgrounded), restart
// the 60-second timer if it was cleared, and resubscribe the realtime channel if it died
// while the app was backgrounded (WebSocket drops are common on iOS).
const _appStateSub = Platform.OS === 'ios'
  ? AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        const { liveActivityId, activeSession } = useSessionStore.getState();
        if (liveActivityId && _sessionStartMs) {
          _reconcileAuthFromSharedStorage();
          void _refresh();
          _ensureTimerRunning();
          if (activeSession?.id) _subscribeToSessionDrinks(activeSession.id);
        }
      }
    })
  : null;

// Darwin cross-process signal from QuickLogDrinkIntent — fires after the widget's DB write
// completes, letting the main-app process call Activity.update() with the correct committed
// count (not throttled like widget-extension calls).
const _quickLogSub = Platform.OS === 'ios' && typeof (LiveActivityBridge as any).addListener === 'function'
  ? (LiveActivityBridge as any).addListener('onQuickLog', () => {
      const { liveActivityId } = useSessionStore.getState();
      if (liveActivityId && _sessionStartMs) {
        void _refresh();
        void queryClient.invalidateQueries({ queryKey: ['feed'] });
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

  // Re-populate shared UserDefaults so the widget intent guard never fails after
  // a force-kill + relaunch. startActivity() does this for new sessions; resumeActivity
  // must do it for existing ones.
  const { session: authSession, profile } = useAuthStore.getState();
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (session.id && authSession?.user?.id && authSession?.refresh_token && supabaseUrl && anonKey) {
    LiveActivityBridge.writeSharedSession(
      session.id, authSession.user.id, authSession.refresh_token,
      weightToLbs(profile?.weight, profile?.weight_unit),
      supabaseUrl, anonKey, _sessionStartMs, '', '',
    );
    LiveActivityBridge.updateSharedAuthTokens(
      authSession.access_token, authSession.refresh_token, authSession.expires_at ?? 0,
    );
  }

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
      LiveActivityBridge.updateSharedAuthTokens(
        session.access_token,
        session.refresh_token,
        session.expires_at ?? 0,
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
