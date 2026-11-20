import {
  formatDrinkTotal,
  inviteTokenFromUrl,
  inviteUrl,
  isSharePreviewError,
  isValidShareToken,
  shareCopy,
  SharePreview,
  shareMessage,
} from './shareLinks';
import { escapeHtml, renderLinkPreviewHtml, safeHttpUrl } from './linkPreviewHtml';

const host = { id: 'h', username: 'sam', display_name: 'Sam', avatar_url: null, is_private: false };

function nightOut(overrides: Partial<NonNullable<SharePreview['session']>> = {}, canJoin = true): SharePreview {
  return {
    kind: 'session',
    can_join: canJoin,
    inviter: host,
    session: {
      id: 's',
      title: 'Friday drinks',
      started_at: '2026-11-20T20:00:00Z',
      ended_at: null,
      drink_total: 7,
      members: [
        { user_id: 'h', username: 'sam', display_name: 'Sam', avatar_url: null, role: 'host' },
        { user_id: 'a', username: 'alex', display_name: null, avatar_url: null, role: 'guest' },
        { user_id: 'b', username: 'bo', display_name: 'Bo', avatar_url: null, role: 'guest' },
      ],
      ...overrides,
    },
    viewer: null,
  };
}

describe('inviteTokenFromUrl', () => {
  it.each([
    ['https://drink-with-suds.com/invite/Abc123_-xyz', 'Abc123_-xyz'],
    ['https://www.drink-with-suds.com/invite/Abc123_-xyz/', 'Abc123_-xyz'],
    ['https://drink-with-suds.com/invite/Abc123xyz?utm=x#y', 'Abc123xyz'],
    ['suds://invite/Abc123xyz', 'Abc123xyz'],
    ['/invite/Abc123xyz', 'Abc123xyz'],
  ])('reads %s', (url, token) => {
    expect(inviteTokenFromUrl(url)).toBe(token);
  });

  it.each([
    null,
    '',
    'https://evil.example/invite/Abc123xyz',
    'https://drink-with-suds.com/session/abc',
    'https://drink-with-suds.com/invite/',
    'https://drink-with-suds.com/invite/a b',
    'https://drink-with-suds.com/invite/short',
    'suds://session/join?token=abc',
    '/invite/Abc123xyz/extra',
  ])('ignores %s', (url) => {
    expect(inviteTokenFromUrl(url)).toBeNull();
  });

  it('round-trips inviteUrl', () => {
    expect(inviteTokenFromUrl(inviteUrl('Tok_en-123'))).toBe('Tok_en-123');
  });
});

describe('isValidShareToken', () => {
  it('accepts URL-safe tokens of a sane length', () => {
    expect(isValidShareToken('abcdefABCDEF')).toBe(true);
    expect(isValidShareToken('abc')).toBe(false);
    expect(isValidShareToken('a'.repeat(65))).toBe(false);
    expect(isValidShareToken('abc/def/ghi')).toBe(false);
    expect(isValidShareToken(undefined)).toBe(false);
  });
});

describe('isSharePreviewError', () => {
  it('tells errors from previews', () => {
    expect(isSharePreviewError({ error: 'revoked' })).toBe(true);
    expect(isSharePreviewError(nightOut())).toBe(false);
    expect(isSharePreviewError(null)).toBe(false);
  });
});

describe('formatDrinkTotal', () => {
  it('pluralises and keeps halves', () => {
    expect(formatDrinkTotal(1)).toBe('1 drink');
    expect(formatDrinkTotal(0)).toBe('0 drinks');
    expect(formatDrinkTotal(2.5)).toBe('2.5 drinks');
    expect(formatDrinkTotal(3.04)).toBe('3 drinks');
  });
});

describe('shareCopy', () => {
  it('describes a live night out', () => {
    expect(shareCopy(nightOut())).toEqual({
      title: "Join Sam's night out: Friday drinks",
      description: 'Live now · with 2 friends · 7 drinks. Join them on Suds.',
      cta: "Join Sam's night out",
    });
  });

  it('describes an ended night out as a follow invite', () => {
    const copy = shareCopy(nightOut({ ended_at: '2026-11-21T02:00:00Z', members: [], drink_total: 0, title: null }, false));
    expect(copy.title).toBe("Sam's night out: Night out");
    expect(copy.description).toBe('Ended. Follow Sam on Suds.');
    expect(copy.cta).toBe('Follow Sam on Suds');
  });

  it('describes a personal invite', () => {
    const copy = shareCopy({ kind: 'profile', can_join: false, inviter: { ...host, display_name: null }, session: null, viewer: null });
    expect(copy.title).toBe('sam invited you to Suds');
    expect(copy.cta).toBe('Follow sam on Suds');
  });
});

describe('shareMessage', () => {
  it('names the night out when it has a title', () => {
    expect(shareMessage('session', ' Friday ')).toBe('Join my night out (Friday) on Suds');
    expect(shareMessage('session', null)).toBe('Join my night out on Suds');
    expect(shareMessage('profile')).toBe('Join me on Suds, the social drink tracker');
  });
});

describe('renderLinkPreviewHtml', () => {
  it('escapes everything it interpolates', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    const html = renderLinkPreviewHtml({
      title: `Sam's <script>alert(1)</script>`,
      description: 'Live "now"',
      url: 'https://drink-with-suds.com/invite/abcdefgh',
      image: 'https://drink-with-suds.com/icon.png',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('<meta property="og:title" content="Sam&#39;s &lt;script&gt;alert(1)&lt;/script&gt;">');
    expect(html).toContain('<meta property="og:description" content="Live &quot;now&quot;">');
    expect(html).toContain('<meta name="twitter:card" content="summary">');
  });

  it('only allows http(s) image URLs', () => {
    expect(safeHttpUrl('javascript:alert(1)', 'https://x/fallback.png')).toBe('https://x/fallback.png');
    expect(safeHttpUrl(null, 'https://x/f.png')).toBe('https://x/f.png');
    expect(safeHttpUrl('https://cdn.example/a.png', 'f')).toBe('https://cdn.example/a.png');
  });
});
