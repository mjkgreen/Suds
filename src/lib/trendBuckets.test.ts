import { buildTrend } from './trendBuckets';

const today = new Date(2026, 10, 19, 15); // Thu Nov 19 2026
const activity = [
  { date: '2026-11-19', count: 2 },
  { date: '2026-11-13', count: 1 },
  { date: '2026-11-12', count: 4 }, // outside 7D
  { date: '2026-08-02', count: 3 },
  { date: '2025-03-10', count: 5 },
  { date: '2026-11-18', count: 0 }, // water-only day
];

describe('buildTrend', () => {
  it('7D: seven daily bars ending today', () => {
    const t = buildTrend(activity, '7d', today);
    expect(t.unit).toBe('day');
    expect(t.buckets).toHaveLength(7);
    expect(t.buckets[6]).toMatchObject({ key: '2026-11-19', value: 2, label: 'Thu, Nov 19' });
    expect(t.total).toBe(3);
  });

  it('3M: weekly bars starting on Mondays', () => {
    const t = buildTrend(activity, '3m', today);
    expect(t.unit).toBe('week');
    expect(t.buckets.every((b) => b.start.getDay() === 1)).toBe(true);
    const nov9 = t.buckets.find((b) => b.key === '2026-11-09');
    expect(nov9?.value).toBe(5); // Nov 12 + Nov 13
  });

  it('1Y: monthly bars, month names only on the axis', () => {
    const t = buildTrend(activity, '1y', today);
    expect(t.unit).toBe('month');
    expect(t.buckets).toHaveLength(13); // Nov 20 2025 .. Nov 19 2026 touches 13 months
    expect(t.buckets.find((b) => b.key === '2026-08')?.value).toBe(3);
    const labels = t.buckets.map((b) => b.axisLabel).filter(Boolean);
    expect(labels.length).toBeLessThanOrEqual(6);
    expect(labels.every((l) => /^[A-Z][a-z]{2}( '\d\d)?$/.test(l!))).toBe(true);
  });

  it('All: starts at the first drink and marks years', () => {
    const t = buildTrend(activity, 'all', today);
    expect(t.buckets[0].key).toBe('2025-03');
    expect(t.buckets[0].axisLabel).toBe("Mar '25");
    expect(t.total).toBe(15);
  });

  it('YTD starts on Jan 1', () => {
    const t = buildTrend(activity, 'ytd', today);
    expect(t.buckets[0].key).toBe('2026-01');
    expect(t.total).toBe(10);
  });
});
