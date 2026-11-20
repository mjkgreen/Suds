import { localDateKey, weekStart } from '@/utils/badgeHelpers';

export type TrendRange = '7d' | '1m' | '3m' | '6m' | 'ytd' | '1y' | 'all';

/** `plus`: ranges longer than a month are labelled as Suds Plus features. */
export const TREND_RANGES: { key: TrendRange; label: string; title: string; plus: boolean }[] = [
  { key: '7d', label: '7D', title: 'Last 7 days', plus: false },
  { key: '1m', label: '1M', title: 'Last month', plus: false },
  { key: '3m', label: '3M', title: 'Last 3 months', plus: true },
  { key: '6m', label: '6M', title: 'Last 6 months', plus: true },
  { key: 'ytd', label: 'YTD', title: 'Year to date', plus: true },
  { key: '1y', label: '1Y', title: 'Last 12 months', plus: true },
  { key: 'all', label: 'All', title: 'All time', plus: true },
];

export type BucketUnit = 'day' | 'week' | 'month';

export interface TrendBucket {
  key: string;
  start: Date;
  value: number;
  /** Shown when the bar is tapped, e.g. "Week of Nov 17". */
  label: string;
  /** Month name under this bar, or null (x-axis shows months only). */
  axisLabel: string | null;
}

export interface Trend {
  unit: BucketUnit;
  buckets: TrendBucket[];
  total: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Most month names that fit under a phone-width chart. */
const MAX_AXIS_LABELS = 6;

function parseDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 12);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** First day (midday, local) included in the range. */
export function rangeStart(range: TrendRange, today: Date, firstActivity: Date | null): Date {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  switch (range) {
    case '7d': return addDays(t, -6);
    case '1m': { const x = new Date(t); x.setMonth(x.getMonth() - 1); return addDays(x, 1); }
    case '3m': { const x = new Date(t); x.setMonth(x.getMonth() - 3); return addDays(x, 1); }
    case '6m': { const x = new Date(t); x.setMonth(x.getMonth() - 6); return addDays(x, 1); }
    case 'ytd': return new Date(t.getFullYear(), 0, 1, 12);
    case '1y': { const x = new Date(t); x.setFullYear(x.getFullYear() - 1); return addDays(x, 1); }
    case 'all': return firstActivity && firstActivity < t ? firstActivity : addDays(t, -6);
  }
}

/** Daily bars up to a month, weekly up to ~6 months, monthly beyond. */
export function unitFor(days: number): BucketUnit {
  if (days <= 31) return 'day';
  if (days <= 190) return 'week';
  return 'month';
}

/**
 * Turns per-day drink counts into the bars for one range. Days with no
 * drinks become zero-height bars, so gaps show as gaps.
 */
export function buildTrend(
  activity: { date: string; count: number }[],
  range: TrendRange,
  today: Date = new Date(),
): Trend {
  const byDay = new Map<string, number>();
  let first: Date | null = null;
  for (const a of activity) {
    const v = Number(a.count) || 0;
    if (!v) continue;
    byDay.set(a.date, (byDay.get(a.date) ?? 0) + v);
    const d = parseDay(a.date);
    if (!first || d < first) first = d;
  }

  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  const start = rangeStart(range, end, first);
  const spanDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const unit = unitFor(spanDays);

  const buckets: TrendBucket[] = [];
  const index = new Map<string, TrendBucket>();
  const bucketFor = (d: Date): { key: string; start: Date } => {
    if (unit === 'day') return { key: localDateKey(d), start: d };
    if (unit === 'week') { const w = weekStart(d); return { key: localDateKey(w), start: w }; }
    const m = monthStart(d);
    return { key: monthKey(m), start: m };
  };

  let total = 0;
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const b = bucketFor(d);
    let bucket = index.get(b.key);
    if (!bucket) {
      bucket = { key: b.key, start: b.start, value: 0, label: '', axisLabel: null };
      index.set(b.key, bucket);
      buckets.push(bucket);
    }
    const v = byDay.get(localDateKey(d)) ?? 0;
    bucket.value += v;
    total += v;
  }

  const multiYear = buckets.length > 0 && buckets[0].start.getFullYear() !== end.getFullYear();
  for (const b of buckets) {
    const s = b.start;
    b.label =
      unit === 'day' ? `${DAYS[s.getDay()]}, ${MONTHS[s.getMonth()]} ${s.getDate()}`
      : unit === 'week' ? `Week of ${MONTHS[s.getMonth()]} ${s.getDate()}`
      : `${MONTHS[s.getMonth()]} ${s.getFullYear()}`;
  }

  // X-axis: month names only, at the first bar of each month.
  const monthStarts: number[] = [];
  buckets.forEach((b, i) => {
    if (i === 0 || b.start.getMonth() !== buckets[i - 1].start.getMonth()) monthStarts.push(i);
  });
  const step = Math.ceil(monthStarts.length / MAX_AXIS_LABELS);
  monthStarts.forEach((i, n) => {
    if (n % step !== 0) return;
    const s = buckets[i].start;
    const showYear = multiYear && (n === 0 || s.getMonth() === 0);
    buckets[i].axisLabel = showYear ? `${MONTHS[s.getMonth()]} '${String(s.getFullYear()).slice(2)}` : MONTHS[s.getMonth()];
  });

  return { unit, buckets, total };
}
