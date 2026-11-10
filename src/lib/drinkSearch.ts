import { DrinkType } from '@/types/models';
import { DRINK_NAMES, DRINK_BRANDS } from './drinkData';

export interface DrinkSuggestion {
  label: string;
  type: DrinkType;
}

/** A catalog of labels by drink type, e.g. DRINK_BRANDS. */
export type DrinkCatalog = Record<DrinkType, string[]>;

/** A suggestion row from the drink_catalog table. */
export interface CatalogEntry {
  label: string;
  drink_type: DrinkType;
}

const MAX_RESULTS = 6;

/**
 * Lowercase, "&" → "and", drop apostrophes and periods, collapse whitespace,
 * so "Joe's  IPA" and "joes ipa" count as the same drink. Mirrors
 * normalize_drink_label() in supabase/migrations/047_drink_catalog.sql.
 */
export function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’‘`.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Adds entries from the drink_catalog table to a built-in catalog. Entries
 * the built-in list already has (under the same type, ignoring spelling
 * differences) are skipped, so nothing shows up twice.
 */
export function mergeCatalog(base: DrinkCatalog, entries: CatalogEntry[]): DrinkCatalog {
  if (entries.length === 0) return base;
  const merged = Object.fromEntries(
    (Object.keys(base) as DrinkType[]).map((type) => [type, [...base[type]]]),
  ) as DrinkCatalog;
  const seen = new Set<string>();
  (Object.keys(merged) as DrinkType[]).forEach((type) =>
    merged[type].forEach((label) => seen.add(`${normalizeLabel(label)}:${type}`)),
  );
  entries.forEach(({ label, drink_type }) => {
    const key = `${normalizeLabel(label)}:${drink_type}`;
    if (seen.has(key)) return;
    seen.add(key);
    (merged[drink_type] ??= []).push(label);
  });
  return merged;
}

/**
 * Searches a Record<DrinkType, string[]> catalog. Matches in the selected type
 * rank first, then other types; prefix matches rank before substring matches.
 * Not hard-filtered by type — picking an out-of-type entry is how type
 * auto-set works.
 */
interface IndexedLabel {
  label: string;
  type: DrinkType;
  normalized: string;
}

const searchIndexes = new WeakMap<DrinkCatalog, IndexedLabel[]>();

/** Every label in a catalog with its normalized form, built once per catalog. */
function searchIndexFor(catalog: DrinkCatalog): IndexedLabel[] {
  let index = searchIndexes.get(catalog);
  if (!index) {
    index = (Object.keys(catalog) as DrinkType[]).flatMap((type) =>
      catalog[type].map((label) => ({ label, type, normalized: normalizeLabel(label) })),
    );
    searchIndexes.set(catalog, index);
  }
  return index;
}

function searchCatalog(
  catalog: DrinkCatalog,
  query: string,
  selectedType?: DrinkType
): DrinkSuggestion[] {
  const normalizedQuery = normalizeLabel(query);
  if (!normalizedQuery) return [];

  const scored: { suggestion: DrinkSuggestion; score: number }[] = [];
  const seen = new Set<string>();

  searchIndexFor(catalog).forEach(({ label, type, normalized }) => {
    if (!normalized.includes(normalizedQuery)) return;
    const key = `${normalized}:${type}`;
    if (seen.has(key)) return;
    seen.add(key);

    const isPrefix = normalized.startsWith(normalizedQuery);
    const inSelectedType = type === selectedType;
    const score = (inSelectedType ? 0 : 2) + (isPrefix ? 0 : 1);
    scored.push({ suggestion: { label, type }, score });
  });

  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_RESULTS)
    .map((s) => s.suggestion);
}

export function searchBrands(
  query: string,
  selectedType?: DrinkType,
  catalog: DrinkCatalog = DRINK_BRANDS,
): DrinkSuggestion[] {
  return searchCatalog(catalog, query, selectedType);
}

export function searchDrinkNames(
  query: string,
  selectedType?: DrinkType,
  catalog: DrinkCatalog = DRINK_NAMES,
): DrinkSuggestion[] {
  return searchCatalog(catalog, query, selectedType);
}

function buildTypeIndex(catalog: DrinkCatalog): Map<string, DrinkType[]> {
  const index = new Map<string, DrinkType[]>();
  (Object.keys(catalog) as DrinkType[]).forEach((type) => {
    catalog[type].forEach((label) => {
      const key = normalizeLabel(label);
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

const typeIndexes = new WeakMap<DrinkCatalog, Map<string, DrinkType[]>>();

function typesFor(catalog: DrinkCatalog, label: string): DrinkType[] {
  let index = typeIndexes.get(catalog);
  if (!index) {
    index = buildTypeIndex(catalog);
    typeIndexes.set(catalog, index);
  }
  return index.get(normalizeLabel(label)) ?? [];
}

/** All drink types a brand appears under (e.g. "Jack Daniel's" → cocktail + spirit). */
export function getTypesForBrand(brand: string, catalog: DrinkCatalog = DRINK_BRANDS): DrinkType[] {
  return typesFor(catalog, brand);
}

/** All drink types a drink name appears under. */
export function getTypesForName(name: string, catalog: DrinkCatalog = DRINK_NAMES): DrinkType[] {
  return typesFor(catalog, name);
}
