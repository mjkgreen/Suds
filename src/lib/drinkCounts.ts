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
