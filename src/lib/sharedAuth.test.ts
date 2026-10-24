import { adoptNewerSharedTokens, decodeJwtPayload } from './sharedAuth';

function jwt(payload: object): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.sig`;
}

const USER = 'aaaaaaaa-0000-0000-0000-000000000001';
const stored = JSON.stringify({
  access_token: jwt({ sub: USER }),
  refresh_token: 'old-refresh',
  expires_at: 1000,
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: USER, email: 'a@b.c' },
});

describe('decodeJwtPayload', () => {
  it('reads the payload', () => {
    expect(decodeJwtPayload(jwt({ sub: USER, n: 'é' }))).toEqual({ sub: USER, n: 'é' });
  });
  it('returns null for garbage', () => {
    expect(decodeJwtPayload('nope')).toBeNull();
    expect(decodeJwtPayload('a.!!!.c')).toBeNull();
  });
});

describe('adoptNewerSharedTokens', () => {
  const newer = { accessToken: jwt({ sub: USER }), refreshToken: 'widget-refresh', accessTokenExpiresAt: 5000 };

  it('adopts a newer token for the same user and keeps the rest of the session', () => {
    const out = JSON.parse(adoptNewerSharedTokens(stored, newer)!);
    expect(out.refresh_token).toBe('widget-refresh');
    expect(out.access_token).toBe(newer.accessToken);
    expect(out.expires_at).toBe(5000);
    expect(out.user).toEqual({ id: USER, email: 'a@b.c' });
    expect(out.token_type).toBe('bearer');
  });

  it('keeps the saved session when the shared copy is older or the same age', () => {
    expect(adoptNewerSharedTokens(stored, { ...newer, accessTokenExpiresAt: 999 })).toBeNull();
    expect(adoptNewerSharedTokens(stored, { ...newer, accessTokenExpiresAt: 1000 })).toBeNull();
  });

  it('keeps the saved session when tokens already match', () => {
    expect(adoptNewerSharedTokens(stored, { ...newer, refreshToken: 'old-refresh' })).toBeNull();
  });

  it('never adopts another user\'s tokens', () => {
    expect(adoptNewerSharedTokens(stored, { ...newer, accessToken: jwt({ sub: 'someone-else' }) })).toBeNull();
  });

  it('ignores missing or malformed input', () => {
    expect(adoptNewerSharedTokens(null, newer)).toBeNull();
    expect(adoptNewerSharedTokens(stored, null)).toBeNull();
    expect(adoptNewerSharedTokens('not json', newer)).toBeNull();
    expect(adoptNewerSharedTokens(JSON.stringify({ refresh_token: 'x' }), newer)).toBeNull();
  });
});
