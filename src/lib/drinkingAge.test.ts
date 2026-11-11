import {
  ageFromBirthdate,
  decideAge,
  DEFAULT_DRINKING_AGE,
  legalDrinkingAge,
  placeName,
  UNKNOWN_LOCATION_DRINKING_AGE,
} from './drinkingAge';

describe('legalDrinkingAge', () => {
  it('depends on the country', () => {
    expect(legalDrinkingAge({ country: 'US', subdivision: null })).toBe(21);
    expect(legalDrinkingAge({ country: 'JP', subdivision: null })).toBe(20);
    expect(legalDrinkingAge({ country: 'GB', subdivision: null })).toBe(18);
  });

  it('depends on the province where the country varies', () => {
    expect(legalDrinkingAge({ country: 'CA', subdivision: 'ON' })).toBe(19);
    expect(legalDrinkingAge({ country: 'CA', subdivision: 'Ontario' })).toBe(19);
    expect(legalDrinkingAge({ country: 'CA', subdivision: 'QC' })).toBe(18);
    expect(legalDrinkingAge({ country: 'CA', subdivision: 'Québec' })).toBe(18);
    expect(legalDrinkingAge({ country: 'CA', subdivision: 'alberta' })).toBe(18);
    // Province unknown: the country's (higher) age
    expect(legalDrinkingAge({ country: 'CA', subdivision: null })).toBe(19);
  });

  it('accepts lowercase country codes', () => {
    expect(legalDrinkingAge({ country: 'us', subdivision: null })).toBe(21);
  });

  it('never goes below 18, and is conservative when the location is unknown', () => {
    expect(legalDrinkingAge({ country: 'DE', subdivision: null })).toBe(DEFAULT_DRINKING_AGE);
    expect(legalDrinkingAge({ country: null, subdivision: null })).toBe(UNKNOWN_LOCATION_DRINKING_AGE);
  });
});

describe('placeName', () => {
  it('names provinces and countries it knows', () => {
    expect(placeName({ country: 'CA', subdivision: 'Ontario' })).toBe('Ontario');
    expect(placeName({ country: 'US', subdivision: 'NY' })).toBe('the United States');
    expect(placeName({ country: 'FR', subdivision: null })).toBeNull();
  });
});

describe('ageFromBirthdate', () => {
  const today = new Date(2026, 10, 11); // Nov 11, 2026

  it('counts whole years, turning a year older on the birthday', () => {
    expect(ageFromBirthdate('2005-11-11', today)).toBe(21);
    expect(ageFromBirthdate('2005-11-12', today)).toBe(20);
    expect(ageFromBirthdate('2005-12-01', today)).toBe(20);
    expect(ageFromBirthdate('2005-01-01', today)).toBe(21);
  });

  it('returns null for unparseable dates', () => {
    expect(ageFromBirthdate('not a date', today)).toBeNull();
  });
});

describe('decideAge', () => {
  const today = new Date(2026, 10, 11);
  const unavailable = { status: 'unavailable' } as const;

  it('allows people at or above the legal age by birthdate', () => {
    expect(decideAge({ minimumAge: 21, birthdate: '2005-11-11', declared: unavailable, today }).allowed).toBe(true);
  });

  it('blocks people under the legal age by birthdate', () => {
    expect(decideAge({ minimumAge: 21, birthdate: '2005-11-12', declared: unavailable, today })).toEqual({
      allowed: false,
      reason: 'birthdate',
    });
    // Same person is fine where the age is 19
    expect(decideAge({ minimumAge: 19, birthdate: '2005-11-12', declared: unavailable, today }).allowed).toBe(true);
  });

  it("blocks when Apple's range is entirely under the legal age, whatever the birthdate says", () => {
    const declared = { status: 'sharing', lowerBound: null, upperBound: 20 } as const;
    expect(decideAge({ minimumAge: 21, birthdate: '1990-01-01', declared, today })).toEqual({
      allowed: false,
      reason: 'declared_age_range',
    });
  });

  it("doesn't let Apple's range lift a birthdate block", () => {
    const declared = { status: 'sharing', lowerBound: 21, upperBound: null } as const;
    expect(decideAge({ minimumAge: 21, birthdate: '2010-01-01', declared, today }).allowed).toBe(false);
  });

  it('falls back to the birthdate when Apple’s range straddles the legal age', () => {
    // e.g. a region that forces an 18+ gate when the legal age is 21
    const declared = { status: 'sharing', lowerBound: 18, upperBound: null } as const;
    expect(decideAge({ minimumAge: 21, birthdate: '2007-01-01', declared, today }).allowed).toBe(false);
    expect(decideAge({ minimumAge: 21, birthdate: '1999-01-01', declared, today }).allowed).toBe(true);
  });

  it('falls back to the birthdate when sharing is declined or unavailable', () => {
    expect(decideAge({ minimumAge: 19, birthdate: '2000-01-01', declared: { status: 'declined' }, today }).allowed).toBe(true);
    expect(decideAge({ minimumAge: 19, birthdate: '2010-01-01', declared: { status: 'declined' }, today }).allowed).toBe(false);
  });
});
