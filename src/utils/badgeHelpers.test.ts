import { localDateKey, weekKeyOf, weekStart } from './badgeHelpers';

describe('badge week helpers', () => {
  it('starts weeks on Monday, keeping Saturday and Sunday together', () => {
    // 2026-11-21 is a Saturday, 2026-11-22 a Sunday, 2026-11-23 a Monday.
    expect(weekKeyOf(new Date(2026, 10, 21, 22))).toBe('2026-11-16');
    expect(weekKeyOf(new Date(2026, 10, 22, 1))).toBe('2026-11-16');
    expect(weekKeyOf(new Date(2026, 10, 23, 9))).toBe('2026-11-23');
  });

  it('uses the local date late in the evening, not the UTC one', () => {
    expect(localDateKey(new Date(2026, 10, 19, 23, 30))).toBe('2026-11-19');
  });

  it('returns midday so day arithmetic is safe across DST', () => {
    expect(weekStart(new Date(2026, 10, 19)).getHours()).toBe(12);
  });
});
