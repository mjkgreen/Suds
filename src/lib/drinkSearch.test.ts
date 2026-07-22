import { DRINK_BRANDS, DRINK_NAMES } from './drinkData';
import {
  getTypesForBrand,
  getTypesForName,
  searchBrands,
  searchDrinkNames,
} from './drinkSearch';
import { DrinkType } from '@/types/models';

describe('searchBrands', () => {
  it('returns empty for blank queries', () => {
    expect(searchBrands('')).toEqual([]);
    expect(searchBrands('   ')).toEqual([]);
  });

  it('matches case-insensitively', () => {
    const results = searchBrands('moosehead');
    expect(results.some((r) => r.label === 'Moosehead' && r.type === 'beer')).toBe(true);
  });

  it('caps results at 6', () => {
    expect(searchBrands('a').length).toBeLessThanOrEqual(6);
  });

  it('ranks matches in the selected type first', () => {
    // "Corona" exists in beer and seltzer/non_alcoholic
    const results = searchBrands('corona', 'seltzer');
    expect(results[0].type).toBe('seltzer');
  });

  it('ranks prefix matches before substring matches within a type', () => {
    const results = searchBrands('crown', 'spirit');
    expect(results[0].label).toBe('Crown Royal');
  });
});

describe('searchDrinkNames', () => {
  it('finds style names', () => {
    const results = searchDrinkNames('ipa', 'beer');
    expect(results[0].type).toBe('beer');
    expect(results.some((r) => r.label === 'IPA')).toBe(true);
  });
});

describe('getTypesForBrand', () => {
  it('returns a single type for unambiguous brands', () => {
    expect(getTypesForBrand('Moosehead')).toEqual(['beer']);
    expect(getTypesForBrand('moosehead')).toEqual(['beer']);
  });

  it('returns multiple types for ambiguous brands', () => {
    const types = getTypesForBrand("Jack Daniel's");
    expect(types).toContain('cocktail');
    expect(types).toContain('spirit');
    expect(types.length).toBeGreaterThan(1);

    const crTypes = getTypesForBrand('Crown Royal');
    expect(crTypes).toContain('cocktail');
    expect(crTypes).toContain('spirit');
  });

  it('returns empty for unknown brands', () => {
    expect(getTypesForBrand('Not A Real Brand')).toEqual([]);
  });
});

describe('getTypesForName', () => {
  it('returns beer for IPA', () => {
    expect(getTypesForName('IPA')).toEqual(['beer']);
  });
});

describe('drink data integrity', () => {
  it.each(Object.keys(DRINK_BRANDS) as DrinkType[])(
    'DRINK_BRANDS.%s has no case-insensitive duplicates',
    (type) => {
      const lowered = DRINK_BRANDS[type].map((b) => b.toLowerCase());
      expect(new Set(lowered).size).toBe(lowered.length);
    }
  );

  it.each(Object.keys(DRINK_NAMES) as DrinkType[])(
    'DRINK_NAMES.%s has no case-insensitive duplicates',
    (type) => {
      const lowered = DRINK_NAMES[type].map((n) => n.toLowerCase());
      expect(new Set(lowered).size).toBe(lowered.length);
    }
  );

  it('includes key Canadian brands', () => {
    expect(getTypesForBrand('Molson Canadian')).toEqual(['beer']);
    expect(getTypesForBrand('Nutrl')).toEqual(['seltzer']);
    expect(getTypesForBrand('Growers')).toEqual(['cider']);
    expect(getTypesForBrand('Jackson-Triggs')).toEqual(['wine']);
    expect(getTypesForBrand('Twisted Tea')).toEqual(['other']);
  });
});
