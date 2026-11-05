import { createFetchWithTimeout } from './fetchWithTimeout';

/** A fetch that never answers unless aborted. */
function hangingFetch() {
  const calls: { url: string; signal?: AbortSignal | null }[] = [];
  const fn = ((input: any, init?: RequestInit) => {
    calls.push({ url: String(input), signal: init?.signal });
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe('createFetchWithTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('aborts a stalled database request after the deadline', async () => {
    const { fn } = hangingFetch();
    const p = createFetchWithTimeout(fn, 1000)('https://x.supabase.co/rest/v1/rpc/get_feed');
    jest.advanceTimersByTime(1000);
    await expect(p).rejects.toThrow('aborted');
  });

  it('aborts a stalled login renewal', async () => {
    const { fn } = hangingFetch();
    const p = createFetchWithTimeout(fn, 1000)('https://x.supabase.co/auth/v1/token?grant_type=refresh_token');
    jest.advanceTimersByTime(1000);
    await expect(p).rejects.toThrow('aborted');
  });

  it('leaves uploads and edge functions without a deadline', () => {
    const { fn, calls } = hangingFetch();
    const f = createFetchWithTimeout(fn, 1000);
    f('https://x.supabase.co/storage/v1/object/drink-media/a.mp4', { method: 'POST' });
    f('https://x.supabase.co/functions/v1/send-signup-email');
    expect(calls.map((c) => c.signal)).toEqual([undefined, undefined]);
  });

  it('still honours the caller cancelling', async () => {
    const { fn } = hangingFetch();
    const caller = new AbortController();
    const p = createFetchWithTimeout(fn, 60_000)('https://x.supabase.co/rest/v1/profiles', { signal: caller.signal });
    caller.abort();
    await expect(p).rejects.toThrow('aborted');
  });

  it('passes a fast answer straight through', async () => {
    const res = { ok: true } as Response;
    const f = createFetchWithTimeout((async () => res) as unknown as typeof fetch, 1000);
    await expect(f('https://x.supabase.co/rest/v1/profiles')).resolves.toBe(res);
  });
});
