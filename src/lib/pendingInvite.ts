import { isValidShareToken } from './shareLinks';

/**
 * An invite link opened while signed out, held until the person has signed
 * up (or in) and finished onboarding, then opened for them.
 *
 * It's saved to storage, not just memory, because the trip from the link to
 * the feed can leave the app: OAuth on web is a full-page redirect, an email
 * confirmation opens a new tab, and the app may be killed while someone is
 * finding their password.
 */

export const PENDING_INVITE_KEY = 'suds.pendingInvite';

/** Long enough to install the app and sign up; short enough not to surprise. */
export const PENDING_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface PendingInvite {
  token: string;
  /** What it's for, shown on sign-up ("Join Sam's night out"). */
  label: string | null;
  savedAt: number;
}

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export function parsePendingInvite(raw: string | null, now: number): PendingInvite | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<PendingInvite>;
    if (!isValidShareToken(v.token) || typeof v.savedAt !== 'number') return null;
    if (now - v.savedAt > PENDING_INVITE_TTL_MS || v.savedAt > now + 60_000) return null;
    return { token: v.token, label: typeof v.label === 'string' ? v.label : null, savedAt: v.savedAt };
  } catch {
    return null;
  }
}

export function createPendingInviteStore(storage: KeyValueStorage, now: () => number = Date.now) {
  // Mirrors storage so screens can read it synchronously once loaded.
  let cached: PendingInvite | null = null;
  let loaded = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  return {
    async load(): Promise<PendingInvite | null> {
      try {
        cached = parsePendingInvite(await storage.getItem(PENDING_INVITE_KEY), now());
      } catch {
        cached = null;
      }
      loaded = true;
      emit();
      return cached;
    },

    /** The invite, if one is waiting (after load). */
    peek(): PendingInvite | null {
      if (cached && now() - cached.savedAt > PENDING_INVITE_TTL_MS) cached = null;
      return cached;
    },

    isLoaded(): boolean {
      return loaded;
    },

    async save(token: string, label: string | null = null): Promise<void> {
      if (!isValidShareToken(token)) return;
      cached = { token, label, savedAt: now() };
      loaded = true;
      emit();
      try {
        await storage.setItem(PENDING_INVITE_KEY, JSON.stringify(cached));
      } catch {
        // Memory copy still works for this run.
      }
    },

    async clear(): Promise<void> {
      cached = null;
      emit();
      try {
        await storage.removeItem(PENDING_INVITE_KEY);
      } catch {
        // Best-effort.
      }
    },

    /** Returns the waiting invite and forgets it. */
    async take(): Promise<PendingInvite | null> {
      const invite = this.peek();
      if (invite) await this.clear();
      return invite;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type PendingInviteStore = ReturnType<typeof createPendingInviteStore>;
