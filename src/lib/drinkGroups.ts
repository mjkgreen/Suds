import type { FeedItem } from '@/types/models';

/**
 * Same drink, logged one or more times (by anyone in the night out). Each log
 * stays its own row — the BAC estimate and per-person totals need each drink's
 * own time — but the night-out card shows them as one line with a count.
 */
export interface DrinkGroup {
  key: string;
  /** Newest first. */
  items: FeedItem[];
  /** The most recent log; +1 copies it. */
  latest: FeedItem;
  /** Sum of quantities. */
  total: number;
  /** Everyone who had it, most recent first. */
  drinkers: FeedItem['profile'][];
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

export function drinkGroupKey(item: Pick<FeedItem, 'drink_type' | 'drink_name' | 'brand'>): string {
  return `${item.drink_type}|${norm(item.drink_name)}|${norm(item.brand)}`;
}

/** Groups items (newest first) by drink; groups are ordered by their latest log. */
export function groupDrinks(items: FeedItem[]): DrinkGroup[] {
  const groups = new Map<string, DrinkGroup>();
  const sorted = [...items].sort((a, b) => b.logged_at.localeCompare(a.logged_at));
  for (const item of sorted) {
    const key = drinkGroupKey(item);
    let group = groups.get(key);
    if (!group) {
      group = { key, items: [], latest: item, total: 0, drinkers: [] };
      groups.set(key, group);
    }
    group.items.push(item);
    group.total += item.quantity;
    if (!group.drinkers.some((p) => p.id === item.user_id)) group.drinkers.push(item.profile);
  }
  return [...groups.values()];
}
