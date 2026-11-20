import { DrinkType, isAlcoholicDrink } from '@/types/models';

/**
 * How many drinks a set of logs adds up to: alcoholic drinks only, counting
 * quantity (a pitcher logged as 3 is 3 drinks; water is none). The database
 * stats (migration 050), the BAC estimate and the Live Activity all use this
 * same rule, so every "drinks" number in the app agrees.
 */
export function drinkTotal(logs: { drink_type: DrinkType | string; quantity: number }[]): number {
  return logs.reduce(
    (sum, d) => (isAlcoholicDrink(d.drink_type as DrinkType) ? sum + Number(d.quantity) : sum),
    0,
  );
}

/** Live Activity counts: this user's and the group's (fractional, e.g. 2.5). */
export function sessionDrinkCounts(
  logs: { user_id: string; drink_type: DrinkType | string; quantity: number }[],
  userId: string | undefined,
): { mine: number; group: number } {
  const tidy = (n: number) => Math.round(n * 10) / 10; // drop float noise like 2.4999999
  return {
    mine: tidy(drinkTotal(logs.filter((d) => d.user_id === userId))),
    group: tidy(drinkTotal(logs)),
  };
}

/**
 * Label for the quick-log button that repeats a drink: "+1" for a single
 * drink, "+1.5" for a log of 1.5. The button copies the quantity, so the
 * label says what it will actually add. Matches formatCount in the Live
 * Activity widget (targets/suds-live-activity/SudsLiveActivityView.swift).
 */
export function quickLogLabel(quantity: number | null | undefined): string {
  const q = Number(quantity);
  const n = Number.isFinite(q) && q > 0 ? Math.round(q * 10) / 10 : 1;
  return `+${n}`;
}

/**
 * What the Live Activity's +1 repeats, from the user's latest drink in the
 * night out: its type, display name ("Wine" when unnamed) and quantity.
 */
export function lastDrinkForQuickLog(drink: {
  drink_type: DrinkType | string;
  drink_name?: string | null;
  quantity?: number | string | null;
}): { drinkType: string; drinkName: string; quantity: number } {
  const type = String(drink.drink_type);
  const q = Number(drink.quantity);
  return {
    drinkType: type,
    drinkName: drink.drink_name?.trim() || type.charAt(0).toUpperCase() + type.slice(1),
    quantity: Number.isFinite(q) && q > 0 ? q : 1,
  };
}
