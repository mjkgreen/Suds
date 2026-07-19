import { DrinkType } from '@/types/models';
import { DRINK_NAMES, DRINK_BRANDS } from './drinkData';

export interface DrinkSuggestion {
  label: string;
  type: DrinkType;
}

const MAX_RESULTS = 6;

/**
 * Searches a Record<DrinkType, string[]> catalog. Matches in the selected type
 * rank first, then other types; prefix matches rank before substring matches.
 * Not hard-filtered by type — picking an out-of-type entry is how type
 * auto-set works.
 */
function searchCatalog(
  catalog: Record<DrinkType, string[]>,
  query: string,
  selectedType?: DrinkType
): DrinkSuggestion[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return [];

  const scored: { suggestion: DrinkSuggestion; score: number }[] = [];
  const seen = new Set<string>();

  (Object.keys(catalog) as DrinkType[]).forEach((type) => {
    catalog[type].forEach((label) => {
      const normalized = label.toLowerCase();
      if (!normalized.includes(normalizedQuery)) return;
      const key = `${normalized}:${type}`;
      if (seen.has(key)) return;
      seen.add(key);

      const isPrefix = normalized.startsWith(normalizedQuery);
      const inSelectedType = type === selectedType;
      const score = (inSelectedType ? 0 : 2) + (isPrefix ? 0 : 1);
      scored.push({ suggestion: { label, type }, score });
    });
  });

  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_RESULTS)
    .map((s) => s.suggestion);
}

export function searchBrands(query: string, selectedType?: DrinkType): DrinkSuggestion[] {
  return searchCatalog(DRINK_BRANDS, query, selectedType);
}

export function searchDrinkNames(query: string, selectedType?: DrinkType): DrinkSuggestion[] {
  return searchCatalog(DRINK_NAMES, query, selectedType);
}

function buildTypeIndex(catalog: Record<DrinkType, string[]>): Map<string, DrinkType[]> {
  const index = new Map<string, DrinkType[]>();
  (Object.keys(catalog) as DrinkType[]).forEach((type) => {
    catalog[type].forEach((label) => {
      const key = label.toLowerCase();
      const types = index.get(key);
      if (types) {
        if (!types.includes(type)) types.push(type);
      } else {
        index.set(key, [type]);
      }
    });
  });
  return index;
}

let brandTypeIndex: Map<string, DrinkType[]> | null = null;
let nameTypeIndex: Map<string, DrinkType[]> | null = null;

/** All drink types a brand appears under (e.g. "Jack Daniel's" → cocktail + spirit). */
export function getTypesForBrand(brand: string): DrinkType[] {
  brandTypeIndex ??= buildTypeIndex(DRINK_BRANDS);
  return brandTypeIndex.get(brand.toLowerCase().trim()) ?? [];
}

/** All drink types a drink name appears under. */
export function getTypesForName(name: string): DrinkType[] {
  nameTypeIndex ??= buildTypeIndex(DRINK_NAMES);
  return nameTypeIndex.get(name.toLowerCase().trim()) ?? [];
}
