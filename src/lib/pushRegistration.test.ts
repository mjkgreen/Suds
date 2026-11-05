import { createPushRegistration, PushNotificationsApi } from './pushRegistration';

type Listener = (event: { data: unknown }) => void;

/**
 * Fake expo-notifications that behaves like iOS: every native token fetch
 * emits the device-push-token event, which is what caused the loop.
 */
function fakeNotifications(deviceToken = 'device-abc') {
  const listeners: Listener[] = [];
  let current = deviceToken;
  const deviceFetch = (): Promise<{ type: string; data: unknown }> => api.getDevicePushTokenAsync();
  const api = {
    getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
    requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
    getDevicePushTokenAsync: jest.fn(async (): Promise<{ type: string; data: unknown }> => {
      const data = current;
      // Emitted asynchronously, like the native event.
      setTimeout(() => listeners.forEach((l) => l({ data })), 0);
      return { type: 'ios', data };
    }),
    getExpoPushTokenAsync: jest.fn(async (opts: { devicePushToken?: { data: any } }): Promise<{ data: string }> => {
      const device: { data: unknown } = opts.devicePushToken ?? (await deviceFetch());
      return { data: `ExponentPushToken[${device.data}]` };
    }),
  };
  return {
    api: api as unknown as PushNotificationsApi & typeof api,
    addListener: (l: Listener) => listeners.push(l),
    rotate: (next: string) => {
      current = next;
      listeners.forEach((l) => l({ data: next }));
    },
  };
}

const flush = async (rounds = 20) => {
  for (let i = 0; i < rounds; i++) await new Promise((r) => setTimeout(r, 0));
};

function setup(deviceToken?: string) {
  const fake = fakeNotifications(deviceToken);
  const saveToken = jest.fn(async (_token: string) => null as string | null);
  const reg = createPushRegistration({
    notifications: fake.api,
    projectId: 'proj',
    saveToken,
    log: () => {},
  });
  // Wired the way useNotifications wires it.
  fake.addListener((event) => {
    void reg.onDevicePushToken('user-1', event);
  });
  return { fake, saveToken, reg };
}

describe('push registration', () => {
  it("doesn't loop on the token event its own fetch emits", async () => {
    const { fake, saveToken, reg } = setup();
    await reg.register('user-1');
    await flush();

    expect(saveToken).toHaveBeenCalledTimes(1);
    expect(fake.api.getDevicePushTokenAsync).toHaveBeenCalledTimes(1);
    expect(fake.api.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
  });

  it('passes the device token through so Expo does not fetch it again', async () => {
    const { fake, reg } = setup();
    await reg.register('user-1');
    expect(fake.api.getExpoPushTokenAsync).toHaveBeenCalledWith(
      expect.objectContaining({ devicePushToken: { type: 'ios', data: 'device-abc' } }),
    );
  });

  it('shares one run between overlapping calls', async () => {
    const { saveToken, reg } = setup();
    await Promise.all([reg.register('user-1'), reg.register('user-1'), reg.register('user-1')]);
    await flush();
    expect(saveToken).toHaveBeenCalledTimes(1);
  });

  it('does not write again when the token is unchanged', async () => {
    const { saveToken, reg } = setup();
    await reg.register('user-1');
    await reg.register('user-1');
    await flush();
    expect(saveToken).toHaveBeenCalledTimes(1);
  });

  it('re-registers when the OS rotates the token', async () => {
    const { fake, saveToken, reg } = setup();
    await reg.register('user-1');
    await flush();
    fake.rotate('device-new');
    await flush();
    expect(saveToken).toHaveBeenCalledTimes(2);
    expect(saveToken).toHaveBeenLastCalledWith('ExponentPushToken[device-new]');
  });

  it('registers again for a different user', async () => {
    const { saveToken, reg } = setup();
    await reg.register('user-1');
    await reg.register('user-2');
    expect(saveToken).toHaveBeenCalledTimes(2);
  });

  it('registers the second user after a quick account switch mid-run', async () => {
    const { saveToken, reg } = setup();
    await Promise.all([reg.register('user-1'), reg.register('user-2')]);
    await flush();
    expect(saveToken).toHaveBeenCalledTimes(2);
  });

  it('retries the write next time if saving failed', async () => {
    const { saveToken, reg } = setup();
    saveToken.mockResolvedValueOnce('timeout');
    await reg.register('user-1');
    await reg.register('user-1');
    expect(saveToken).toHaveBeenCalledTimes(2);
  });

  it('does nothing without permission', async () => {
    const { fake, saveToken, reg } = setup();
    fake.api.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    fake.api.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    await reg.register('user-1');
    expect(saveToken).not.toHaveBeenCalled();
    expect(fake.api.getDevicePushTokenAsync).not.toHaveBeenCalled();
  });

  it('reset returns the registered token and forgets it', async () => {
    const { saveToken, reg } = setup();
    await reg.register('user-1');
    expect(reg.reset()).toBe('ExponentPushToken[device-abc]');
    expect(reg.reset()).toBeNull();
    await reg.register('user-1');
    expect(saveToken).toHaveBeenCalledTimes(2);
  });
});
