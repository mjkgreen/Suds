import { Platform } from 'react-native';
import { useSessionStore } from '@/stores/sessionStore';

export interface SessionActivityState {
  sessionTitle: string;
  drinkCount: number;
  elapsedMinutes: number;
}

// Live Activity JS bridge is a stub pending a custom Expo Module.
// The Swift target (targets/suds-live-activity/) defines ActivityAttributes
// and the SwiftUI view. Once a native module exposes ActivityKit's
// request/update/end to JS, replace these no-ops.
export function useLiveActivity() {
  const { setLiveActivityId } = useSessionStore();

  async function startActivity(_state: SessionActivityState): Promise<void> {
    if (Platform.OS !== 'ios') return;
    // TODO: call native module — AppleTargets.startActivity('SudsSession', state)
    // const id = await NativeModules.SudsLiveActivity.start(state);
    // setLiveActivityId(id);
    setLiveActivityId(null);
  }

  async function updateActivity(_state: Partial<SessionActivityState>): Promise<void> {
    if (Platform.OS !== 'ios') return;
    // TODO: call native module — AppleTargets.updateActivity(liveActivityId, state)
  }

  async function endActivity(): Promise<void> {
    if (Platform.OS !== 'ios') return;
    // TODO: call native module — AppleTargets.endActivity(liveActivityId)
    setLiveActivityId(null);
  }

  return { startActivity, updateActivity, endActivity };
}
