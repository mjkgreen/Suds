import { drinkTotal, quickLogLabel, sessionDrinkCounts } from './drinkCounts';

describe('drink counts', () => {
  const logs = [
    { user_id: 'a', drink_type: 'beer', quantity: 1 },
    { user_id: 'a', drink_type: 'beer', quantity: 3 },
    { user_id: 'a', drink_type: 'water', quantity: 2 },
    { user_id: 'b', drink_type: 'wine', quantity: 2 },
    { user_id: 'b', drink_type: 'mocktail', quantity: 1 },
  ];

  it('counts alcoholic drinks by quantity', () => {
    expect(drinkTotal(logs)).toBe(6);
  });

  it('splits mine and the group for the Live Activity', () => {
    expect(sessionDrinkCounts(logs, 'a')).toEqual({ mine: 4, group: 6 });
  });

  it('keeps fractional amounts for the Live Activity', () => {
    const half = [
      { user_id: 'a', drink_type: 'beer', quantity: 2.5 },
      { user_id: 'a', drink_type: 'beer', quantity: 0.1 },
      { user_id: 'a', drink_type: 'beer', quantity: 0.2 },
    ];
    expect(sessionDrinkCounts(half, 'a')).toEqual({ mine: 2.8, group: 2.8 });
  });

  it('handles quantities that arrive as strings from numeric columns', () => {
    expect(drinkTotal([{ drink_type: 'beer', quantity: '1.5' as unknown as number }])).toBe(1.5);
  });
});

describe('quickLogLabel', () => {
  it('shows the quantity the button will log', () => {
    expect(quickLogLabel(1)).toBe('+1');
    expect(quickLogLabel(1.5)).toBe('+1.5');
    expect(quickLogLabel(3)).toBe('+3');
    expect(quickLogLabel(0.5)).toBe('+0.5');
  });

  it('rounds float noise and falls back to +1', () => {
    expect(quickLogLabel(1.4999999)).toBe('+1.5');
    expect(quickLogLabel(null)).toBe('+1');
    expect(quickLogLabel(0)).toBe('+1');
  });
});
