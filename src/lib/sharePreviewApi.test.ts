/**
 * api/share-preview.ts: what link-preview crawlers get for /invite/<token>.
 * (The test lives here, not in api/, so Vercel doesn't deploy it as a function.)
 */
import handler from '../../api/share-preview';

const preview = {
  kind: 'session',
  can_join: true,
  inviter: { id: 'h', username: 'ruby', display_name: 'Ruby <b>Chen</b>', avatar_url: 'https://cdn.example/a.png', is_private: false },
  session: {
    id: 's',
    title: "Ruby's birthday",
    started_at: '2026-11-19T19:00:00Z',
    ended_at: null,
    drink_total: 5,
    members: [
      { user_id: 'h', username: 'ruby', display_name: 'Ruby', avatar_url: null, role: 'host' },
      { user_id: 'a', username: 'sam', display_name: 'Sam', avatar_url: null, role: 'guest' },
    ],
  },
  viewer: null,
};

function mockFetch(body: unknown, ok = true) {
  const fn = jest.fn().mockResolvedValue({ ok, json: async () => body });
  (global as any).fetch = fn;
  return fn;
}

describe('share-preview function', () => {
  it('renders per-link tags from get_share_preview', async () => {
    const fetchMock = mockFetch(preview);
    const res = await handler(new Request('https://drink-with-suds.com/api/share-preview?token=wls1KuWqsB-Y'));
    const html = await res.text();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/rest\/v1\/rpc\/get_share_preview$/);
    expect(JSON.parse(init.body)).toEqual({ p_token: 'wls1KuWqsB-Y' });
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('<meta property="og:title" content="Join Ruby &lt;b&gt;Chen&lt;/b&gt;&#39;s night out: Ruby&#39;s birthday">');
    expect(html).toContain('Live now · with 1 friend · 5 drinks. Join them on Suds.');
    expect(html).toContain('<meta property="og:image" content="https://cdn.example/a.png">');
    expect(html).toContain('<meta property="og:url" content="https://drink-with-suds.com/invite/wls1KuWqsB-Y">');
  });

  it('falls back to generic tags for a dead link', async () => {
    mockFetch({ error: 'revoked' });
    const html = await (await handler(new Request('https://x/api/share-preview?token=wls1KuWqsB-Y'))).text();
    expect(html).toContain('This invite link is no longer active');
    expect(html).toContain('/link-preview.png');
  });

  it("doesn't call Supabase for a malformed token", async () => {
    const fetchMock = mockFetch(preview);
    const html = await (await handler(new Request('https://x/api/share-preview?token=../../etc'))).text();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(html).toContain("You&#39;re invited to Suds");
  });

  it('survives Supabase being down', async () => {
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('down'));
    const res = await handler(new Request('https://x/api/share-preview?token=wls1KuWqsB-Y'));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("You&#39;re invited to Suds");
  });
});
