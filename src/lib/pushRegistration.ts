/**
 * Push token registration, kept free of React Native imports so it can be
 * unit-tested.
 *
 * The loop this guards against: on iOS every native token fetch (which
 * getExpoPushTokenAsync() does internally) emits the device-push-token event
 * that addPushTokenListener receives. Re-registering from that listener
 * unconditionally fetched the token again, which emitted the event again —
 * forever, at whatever rate the network allowed. Builds up to 14 did exactly
 * that, sending ~140 upserts a second from one phone and stalling the
 * database for everyone. So:
 *   - the listener only re-registers when the device token actually changed;
 *   - overlapping triggers share one registration;
 *   - the database is only written when the token or its user changed.
 */

/** The parts of expo-notifications this uses. */
export interface PushNotificationsApi {
  getPermissionsAsync(): Promise<{ status: string }>;
  requestPermissionsAsync(): Promise<{ status: string }>;
  getDevicePushTokenAsync(): Promise<{ type: string; data: unknown }>;
  getExpoPushTokenAsync(options: {
    projectId: string;
    devicePushToken?: { type: any; data: any };
  }): Promise<{ data: string }>;
}

export interface PushRegistrationDeps {
  notifications: PushNotificationsApi;
  projectId: string;
  /** Platform-specific setup before asking for permission (Android channel). */
  prepare?: () => Promise<void>;
  /** Saves the token for the signed-in user. Returns an error message on failure. */
  saveToken: (token: string) => Promise<string | null>;
  log?: (message: string, err?: unknown) => void;
}

function deviceTokenKey(data: unknown): string {
  return typeof data === 'string' ? data : JSON.stringify(data);
}

export function createPushRegistration(deps: PushRegistrationDeps) {
  const log = deps.log ?? ((m, e) => console.error(m, e ?? ''));

  /** The Expo push token saved for `registeredForUser` on this device. */
  let registeredToken: string | null = null;
  let registeredForUser: string | null = null;
  /** Last native device token seen, from our own fetch or from an event. */
  let lastDeviceToken: string | null = null;
  let inFlight: Promise<void> | null = null;
  let inFlightUser: string | null = null;

  async function run(userId: string): Promise<void> {
    try {
      await deps.prepare?.();

      const { status: existing } = await deps.notifications.getPermissionsAsync();
      let status = existing;
      if (existing !== 'granted') {
        status = (await deps.notifications.requestPermissionsAsync()).status;
      }
      if (status !== 'granted') return;

      // Fetch the device token ourselves and hand it to getExpoPushTokenAsync
      // so it doesn't fetch (and emit) a second time. Remember it, so the
      // event this fetch emits is recognised as nothing new.
      const device = await deps.notifications.getDevicePushTokenAsync();
      lastDeviceToken = deviceTokenKey(device.data);

      const { data: token } = await deps.notifications.getExpoPushTokenAsync({
        projectId: deps.projectId,
        devicePushToken: device,
      });
      if (!token) return;
      if (token === registeredToken && registeredForUser === userId) return;

      const error = await deps.saveToken(token);
      if (error) {
        log('Failed to register push token:', error);
        return;
      }
      registeredToken = token;
      registeredForUser = userId;
    } catch (err) {
      log('Push notification registration failed:', err);
    }
  }

  /** Register this device for `userId`. Overlapping calls share one run. */
  function register(userId: string): Promise<void> {
    if (inFlight) {
      // Same user: share the run. Different user (quick account switch):
      // register them once the current run finishes.
      return inFlightUser === userId ? inFlight : inFlight.then(() => register(userId));
    }
    inFlightUser = userId;
    inFlight = run(userId).finally(() => {
      inFlight = null;
      inFlightUser = null;
    });
    return inFlight;
  }

  /**
   * For addPushTokenListener. Re-registers only when the OS handed us a
   * device token we haven't seen, i.e. a real rotation.
   */
  function onDevicePushToken(userId: string, event: { data: unknown }): Promise<void> | void {
    const key = deviceTokenKey(event.data);
    if (key === lastDeviceToken) return;
    // During our own fetch the event can arrive before the fetch resolves;
    // the in-flight run already covers it.
    if (inFlight) return inFlight;
    lastDeviceToken = key;
    return register(userId);
  }

  /** Forget the registration (on sign-out). Returns the token that was registered. */
  function reset(): string | null {
    const token = registeredToken;
    registeredToken = null;
    registeredForUser = null;
    return token;
  }

  return { register, onDevicePushToken, reset };
}
