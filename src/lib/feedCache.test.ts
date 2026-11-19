import { insertIntoFeed, removeFromFeed } from './feedCache';
import type { FeedEntry, FeedItem } from '@/types/models';

const profile = { id: 'u1', username: 'me' } as FeedItem['profile'];

function drink(id: string, session_id: string | null = null): FeedItem {
  return { id, session_id, profile, logged_at: '2026-11-19T20:00:00Z' } as FeedItem;
}

function feed(...pages: FeedEntry[][]) {
  return { pages: pages.map((entries) => ({ entries, rawCount: entries.length })), pageParams: pages.map((_, i) => i) };
}

const sessionGroup = (id: string, items: FeedItem[]): FeedEntry => ({
  type: 'session', session_id: id, session_title: 'Night', profile, items, started_at: '', ended_at: null,
});

describe('insertIntoFeed', () => {
  it('adds a drink to the top of its night-out card, wherever the card is', () => {
    const data = feed([{ type: 'drink', item: drink('a') }], [sessionGroup('s1', [drink('b', 's1')])]);
    const out = insertIntoFeed(data, drink('new', 's1'), null);
    const group = out.pages[1].entries[0] as Extract<FeedEntry, { type: 'session' }>;
    expect(group.items.map((i) => i.id)).toEqual(['new', 'b']);
    expect(out.pages[0].entries).toHaveLength(1);
  });

  it('starts a night-out card when none is loaded', () => {
    const out = insertIntoFeed(feed([{ type: 'drink', item: drink('a') }]), drink('new', 's9'), 'Friday');
    expect(out.pages[0].entries[0]).toMatchObject({ type: 'session', session_id: 's9', session_title: 'Friday' });
  });

  it('puts a solo drink at the top of the feed', () => {
    const out = insertIntoFeed(feed([{ type: 'drink', item: drink('a') }]), drink('new'), null);
    expect(out.pages[0].entries.map((e) => (e.type === 'drink' ? e.item.id : e.session_id))).toEqual(['new', 'a']);
  });
});

describe('removeFromFeed', () => {
  it('removes a drink and drops a night-out card left empty', () => {
    const data = feed([
      { type: 'drink', item: drink('a') },
      sessionGroup('s1', [drink('b', 's1')]),
      sessionGroup('s2', [drink('c', 's2'), drink('d', 's2')]),
    ]);
    const out = removeFromFeed(removeFromFeed(removeFromFeed(data, 'a'), 'b'), 'c');
    expect(out.pages[0].entries).toHaveLength(1);
    expect((out.pages[0].entries[0] as Extract<FeedEntry, { type: 'session' }>).items.map((i) => i.id)).toEqual(['d']);
  });
});
