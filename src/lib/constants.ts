import { DrinkType } from '@/types/models';

export const DRINK_TYPES: {
  value: DrinkType;
  label: string;
  color: string;
}[] = [
  { value: 'beer', label: 'Beer', color: '#F59E0B' },
  { value: 'wine', label: 'Wine', color: '#7C3AED' },
  { value: 'cocktail', label: 'Cocktail', color: '#EC4899' },
  { value: 'spirit', label: 'Spirit', color: '#92400E' },
  { value: 'cider', label: 'Cider', color: '#10B981' },
  { value: 'seltzer', label: 'Seltzer', color: '#38BDF8' },
  { value: 'other', label: 'Other', color: '#6B7280' },
];

export const DRINK_TYPE_MAP = Object.fromEntries(
  DRINK_TYPES.map((d) => [d.value, d]),
) as Record<DrinkType, (typeof DRINK_TYPES)[0]>;

export const FEED_PAGE_SIZE = 20;
export const SEARCH_DEBOUNCE_MS = 300;
