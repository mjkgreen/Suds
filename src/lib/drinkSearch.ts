import { DrinkType } from '@/types/models';
import { DRINK_NAMES, DRINK_BRANDS } from './drinkData';

export interface DrinkSearchResult {
  name: string;
  brand: string;
  type: DrinkType;
  label: string; // "Name, Brand" or just one
}

export function searchDrinks(query: string): DrinkSearchResult[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return [];

  const results: DrinkSearchResult[] = [];
  const seenLabels = new Set<string>();

  // Check all types
  (Object.keys(DRINK_NAMES) as DrinkType[]).forEach((type) => {
    // Names
    DRINK_NAMES[type].forEach((name) => {
      if (name.toLowerCase().includes(normalizedQuery)) {
        const label = name;
        if (!seenLabels.has(`${label}:${type}`)) {
          results.push({ name, brand: '', type, label });
          seenLabels.add(`${label}:${type}`);
        }
      }
    });

    // Brands
    DRINK_BRANDS[type].forEach((brand) => {
      if (brand.toLowerCase().includes(normalizedQuery)) {
        const label = brand;
        if (!seenLabels.has(`${label}:${type}`)) {
          results.push({ name: '', brand, type, label });
          seenLabels.add(`${label}:${type}`);
        }
      }
    });
  });

  return results.slice(0, 10);
}
