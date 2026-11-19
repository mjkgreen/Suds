import { groupDrinks } from './drinkGroups';
import type { FeedItem } from '@/types/models';

let n = 0;
function d(fields: Partial<FeedItem> & { user_id: string; logged_at: string }): FeedItem {
  return {
    id: `d${++n}`,
    drink_type: 'beer',
    drink_name: 'Coors Light',
    brand: null,
    quantity: 1,
    profile: { id: fields.user_id } as FeedItem['profile'],
    ...fields,
  } as FeedItem;
}

describe('groupDrinks', () => {
  it('merges the same drink across people, case- and space-insensitively', () => {
    const groups = groupDrinks([
      d({ user_id: 'a', logged_at: '2026-11-19T21:00:00Z' }),
      d({ user_id: 'b', logged_at: '2026-11-19T22:00:00Z', drink_name: ' coors light ', quantity: 2 }),
      d({ user_id: 'a', logged_at: '2026-11-19T21:30:00Z', drink_type: 'spirit', drink_name: 'Tequila' }),
    ]);
    expect(groups.map((g) => [g.latest.drink_name, g.total])).toEqual([
      [' coors light ', 3],
      ['Tequila', 1],
    ]);
    expect(groups[0].drinkers.map((p) => p.id)).toEqual(['b', 'a']);
    expect(groups[0].items).toHaveLength(2);
  });

  it('keeps different brands or types apart', () => {
    const groups = groupDrinks([
      d({ user_id: 'a', logged_at: '2026-11-19T21:00:00Z', drink_name: 'IPA', brand: 'X' }),
      d({ user_id: 'a', logged_at: '2026-11-19T21:01:00Z', drink_name: 'IPA', brand: 'Y' }),
      d({ user_id: 'a', logged_at: '2026-11-19T21:02:00Z', drink_name: 'IPA', drink_type: 'cocktail' }),
    ]);
    expect(groups).toHaveLength(3);
  });
});
