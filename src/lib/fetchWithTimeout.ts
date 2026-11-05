/**
 * Supabase requests have no time limit of their own: when the database
 * stalls, a request (and every request queued behind a login renewal) just
 * waits, and screens sit on a spinner. This gives database and auth calls a
 * deadline so they fail like a dropped connection instead — TanStack Query
 * retries them, supabase-js keeps the saved login and retries the renewal,
 * and the feed falls back to saved posts.
 *
 * Uploads (storage) and edge functions are left alone: a large photo or video
 * on a slow connection can legitimately take longer.
 */

export const SUPABASE_REQUEST_TIMEOUT_MS = 20_000;

const TIMED_PATHS = ['/rest/v1/', '/auth/v1/'];

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url;
}

export function createFetchWithTimeout(
  baseFetch: typeof fetch,
  timeoutMs = SUPABASE_REQUEST_TIMEOUT_MS,
): typeof fetch {
  return (input, init) => {
    const url = requestUrl(input);
    if (!TIMED_PATHS.some((p) => url.includes(p))) return baseFetch(input, init);

    const controller = new AbortController();
    const callerSignal = init?.signal;
    const onCallerAbort = () => controller.abort((callerSignal as any)?.reason);
    if (callerSignal) {
      if (callerSignal.aborted) controller.abort((callerSignal as any).reason);
      else callerSignal.addEventListener('abort', onCallerAbort);
    }
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    return baseFetch(input, { ...init, signal: controller.signal }).finally(() => {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    });
  };
}
