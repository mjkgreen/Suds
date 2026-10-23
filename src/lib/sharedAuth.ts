/**
 * Reconciling the app's saved Supabase session with the +1 widget's copy.
 *
 * The widget runs in a separate iOS process and can renew the shared login on
 * its own. Supabase refresh tokens are single-use: if the widget renews while
 * the app is closed, the app's saved refresh token is already spent, and
 * using it makes Supabase revoke the whole login (signing the user out on the
 * phone and the widget). Both sides record every renewal in shared storage,
 * so on startup we adopt the shared copy when it's newer than ours.
 */

export interface SharedAuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds since epoch. */
  accessTokenExpiresAt: number;
}

/** Decodes a JWT's payload without verifying it (we only read `sub`). */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const json = decodeURIComponent(
      Array.from(atob(base64), (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Returns the saved session JSON with the widget's tokens swapped in, or null
 * to keep the saved session as is. Only adopts tokens for the same user that
 * expire later than the saved ones (i.e. were issued by a later renewal).
 */
export function adoptNewerSharedTokens(storedJson: string | null, shared: SharedAuthTokens | null): string | null {
  if (!storedJson || !shared?.accessToken || !shared.refreshToken) return null;

  let stored: any;
  try {
    stored = JSON.parse(storedJson);
  } catch {
    return null;
  }
  if (!stored?.refresh_token || !stored?.user?.id) return null;
  if (stored.refresh_token === shared.refreshToken) return null;

  // Same account only — shared storage could hold a previous user's tokens.
  if (decodeJwtPayload(shared.accessToken)?.sub !== stored.user.id) return null;

  // Each renewal issues a token that expires later than the one before, so a
  // later expiry means the widget renewed after the app last did.
  const storedExpiresAt = Number(stored.expires_at) || 0;
  const sharedExpiresAt = Number(shared.accessTokenExpiresAt) || 0;
  if (sharedExpiresAt <= storedExpiresAt) return null;

  return JSON.stringify({
    ...stored,
    access_token: shared.accessToken,
    refresh_token: shared.refreshToken,
    expires_at: Math.floor(sharedExpiresAt),
    expires_in: Math.max(0, Math.floor(sharedExpiresAt - Date.now() / 1000)),
  });
}
