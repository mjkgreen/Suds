import {
  createPendingInviteStore,
  KeyValueStorage,
  parsePendingInvite,
  PENDING_INVITE_KEY,
  PENDING_INVITE_TTL_MS,
} from './pendingInvite';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
    removeItem: async (k) => {
      data.delete(k);
    },
  };
}

describe('parsePendingInvite', () => {
  const now = 1_000_000_000_000;

  it('reads a fresh invite', () => {
    expect(parsePendingInvite(JSON.stringify({ token: 'abcdefgh', label: 'Join', savedAt: now - 1000 }), now)).toEqual({
      token: 'abcdefgh',
      label: 'Join',
      savedAt: now - 1000,
    });
  });

  it('drops stale, malformed or unsafe values', () => {
    expect(parsePendingInvite(JSON.stringify({ token: 'abcdefgh', savedAt: now - PENDING_INVITE_TTL_MS - 1 }), now)).toBeNull();
    expect(parsePendingInvite(JSON.stringify({ token: '../../x', savedAt: now }), now)).toBeNull();
    expect(parsePendingInvite('{not json', now)).toBeNull();
    expect(parsePendingInvite(null, now)).toBeNull();
  });
});

describe('createPendingInviteStore', () => {
  it('survives a restart (new store, same storage) and is taken once', async () => {
    const storage = memoryStorage();
    let t = 5_000;
    const first = createPendingInviteStore(storage, () => t);
    await first.save('abcdefgh', "Join Sam's night out");
    expect(storage.data.has(PENDING_INVITE_KEY)).toBe(true);

    // e.g. the OAuth redirect reloads the page
    t += 60_000;
    const second = createPendingInviteStore(storage, () => t);
    expect(second.peek()).toBeNull();
    await second.load();
    expect(second.peek()?.token).toBe('abcdefgh');
    expect((await second.take())?.label).toBe("Join Sam's night out");
    expect(await second.take()).toBeNull();
    expect(storage.data.has(PENDING_INVITE_KEY)).toBe(false);
  });

  it('expires while the app stays open', async () => {
    let t = 0;
    const store = createPendingInviteStore(memoryStorage(), () => t);
    await store.save('abcdefgh');
    t = PENDING_INVITE_TTL_MS + 1;
    expect(store.peek()).toBeNull();
  });

  it('ignores invalid tokens and notifies subscribers', async () => {
    const store = createPendingInviteStore(memoryStorage());
    const seen: (string | undefined)[] = [];
    store.subscribe(() => seen.push(store.peek()?.token));
    await store.save('no');
    expect(store.peek()).toBeNull();
    await store.save('abcdefgh');
    await store.clear();
    expect(seen).toEqual(['abcdefgh', undefined]);
  });

  it('keeps working in memory when storage fails', async () => {
    const broken: KeyValueStorage = {
      getItem: async () => {
        throw new Error('nope');
      },
      setItem: async () => {
        throw new Error('nope');
      },
      removeItem: async () => {
        throw new Error('nope');
      },
    };
    const store = createPendingInviteStore(broken);
    expect(await store.load()).toBeNull();
    await store.save('abcdefgh');
    expect(store.peek()?.token).toBe('abcdefgh');
    expect((await store.take())?.token).toBe('abcdefgh');
  });
});
