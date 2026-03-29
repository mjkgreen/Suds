import { DrinkType } from '@/types/models';

export const DRINK_TYPES: {
  value: DrinkType;
  label: string;
  emoji: string;
  color: string;
}[] = [
  { value: 'beer', label: 'Beer', emoji: '🍺', color: '#F59E0B' },
  { value: 'wine', label: 'Wine', emoji: '🍷', color: '#7C3AED' },
  { value: 'cocktail', label: 'Cocktail', emoji: '🍸', color: '#EC4899' },
  { value: 'spirit', label: 'Spirit', emoji: '🥃', color: '#92400E' },
  { value: 'cider', label: 'Cider', emoji: '🍏', color: '#10B981' },
  { value: 'seltzer', label: 'Seltzer', emoji: '🥤', color: '#38BDF8' },
  { value: 'other', label: 'Other', emoji: '🥂', color: '#6B7280' },
];

export const DRINK_TYPE_MAP = Object.fromEntries(
  DRINK_TYPES.map((d) => [d.value, d]),
) as Record<DrinkType, (typeof DRINK_TYPES)[0]>;

export const FEED_PAGE_SIZE = 20;
export const SEARCH_DEBOUNCE_MS = 300;
