import { DrinkType } from '@/types/models';

export const DRINK_TYPES: {
  value: DrinkType;
  label: string;
  color: string;
  icon: string;
}[] = [
  { value: 'water', label: 'Water', color: '#0EA5E9', icon: 'cup-water' },
  { value: 'beer', label: 'Beer', color: '#F59E0B', icon: 'beer' },
  { value: 'wine', label: 'Wine', color: '#7C3AED', icon: 'glass-wine' },
  { value: 'cocktail', label: 'Cocktail', color: '#EC4899', icon: 'glass-cocktail' },
  { value: 'spirit', label: 'Spirit', color: '#92400E', icon: 'liquor' },
  { value: 'cider', label: 'Cider', color: '#10B981', icon: 'bottle-wine' },
  { value: 'seltzer', label: 'Seltzer', color: '#38BDF8', icon: 'bottle-soda-outline' },
  { value: 'soft_drink', label: 'Soft Drink', color: '#F87171', icon: 'cup' },
  { value: 'mocktail', label: 'Mocktail', color: '#A78BFA', icon: 'glass-cocktail' },
  { value: 'non_alcoholic', label: 'Non-Alcoholic', color: '#34D399', icon: 'cancel' },
  { value: 'other', label: 'Other', color: '#6B7280', icon: 'help-circle-outline' },
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
