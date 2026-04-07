import { DrinkType } from '@/types/models';

export const DRINK_TYPES: {
  value: DrinkType;
  label: string;
  color: string;
  emoji: string;
}[] = [
  { value: 'beer', label: 'Beer', color: '#F59E0B', emoji: '🍺' },
  { value: 'wine', label: 'Wine', color: '#7C3AED', emoji: '🍷' },
  { value: 'cocktail', label: 'Cocktail', color: '#EC4899', emoji: '🍸' },
  { value: 'spirit', label: 'Spirit', color: '#92400E', emoji: '🥃' },
  { value: 'cider', label: 'Cider', color: '#10B981', emoji: '🍏' },
  { value: 'seltzer', label: 'Seltzer', color: '#38BDF8', emoji: '🥤' },
  { value: 'other', label: 'Other', color: '#6B7280', emoji: '❔' },
];

export const DRINK_TYPE_MAP = Object.fromEntries(
  DRINK_TYPES.map((d) => [d.value, d]),
) as Record<DrinkType, (typeof DRINK_TYPES)[0]>;

export const FEED_PAGE_SIZE = 20;
export const SEARCH_DEBOUNCE_MS = 300;

export const MILESTONE_EMOJI: Record<number, string> = {
  1: '🎉',
  10: '🍺',
  25: '🥂',
  50: '🏅',
  100: '💯',
  200: '🌟',
  300: '🏆',
  400: '🔥',
  500: '💎',
  750: '👑',
  1000: '🫡',
};
