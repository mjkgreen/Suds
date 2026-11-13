/**
 * Legal drinking age by place, and the decision whether someone may use Suds.
 *
 * Suds requires people to be of legal drinking age where they are. Ages below
 * are the minimum to buy or drink any alcohol (Suds logs spirits too), with a
 * floor of 18 everywhere: places that allow beer or wine at 16 still get 18.
 *
 * Keep this table reviewed: laws change, and it's the source of truth for who
 * gets blocked.
 */

/** Used wherever there's no specific entry. */
export const DEFAULT_DRINKING_AGE = 18;

/**
 * Used when we can't tell where the person is at all. The highest common
 * drinking age, so an unknown location never lets someone through early.
 */
export const UNKNOWN_LOCATION_DRINKING_AGE = 21;

/** ISO 3166-1 country code → minimum age, where it differs from the default. */
const COUNTRY_DRINKING_AGE: Record<string, number> = {
  US: 21,
  CA: 19, // provinces at 18 below
  JP: 20,
  KR: 19,
  TH: 20,
  IS: 20,
  PY: 20,
  LK: 21,
  ID: 21,
  IN: 21, // varies by state (18–25); 21 is the most common
  AE: 21,
  QA: 21,
  OM: 21,
};

/** Country → subdivision code → minimum age, where it differs from the country. */
const SUBDIVISION_DRINKING_AGE: Record<string, Record<string, number>> = {
  CA: { AB: 18, MB: 18, QC: 18 },
};

/** Full subdivision names (as reverse geocoding returns them) → codes. */
const SUBDIVISION_NAMES: Record<string, Record<string, string>> = {
  CA: {
    alberta: 'AB',
    'british columbia': 'BC',
    manitoba: 'MB',
    'new brunswick': 'NB',
    'newfoundland and labrador': 'NL',
    'nova scotia': 'NS',
    ontario: 'ON',
    'prince edward island': 'PE',
    quebec: 'QC',
    québec: 'QC',
    saskatchewan: 'SK',
    'northwest territories': 'NT',
    nunavut: 'NU',
    yukon: 'YT',
  },
};

/** Readable names for messages. */
const PLACE_NAMES: Record<string, string> = {
  US: 'the United States',
  CA: 'Canada',
  'CA-AB': 'Alberta',
  'CA-BC': 'British Columbia',
  'CA-MB': 'Manitoba',
  'CA-NB': 'New Brunswick',
  'CA-NL': 'Newfoundland and Labrador',
  'CA-NS': 'Nova Scotia',
  'CA-ON': 'Ontario',
  'CA-PE': 'Prince Edward Island',
  'CA-QC': 'Quebec',
  'CA-SK': 'Saskatchewan',
  'CA-NT': 'the Northwest Territories',
  'CA-NU': 'Nunavut',
  'CA-YT': 'Yukon',
};

export interface Jurisdiction {
  /** ISO 3166-1 alpha-2, uppercase, or null if unknown. */
  country: string | null;
  /** Subdivision code (e.g. "ON") or name as geocoded, or null. */
  subdivision: string | null;
}

function subdivisionCode(country: string, subdivision: string | null): string | null {
  if (!subdivision) return null;
  const trimmed = subdivision.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return SUBDIVISION_NAMES[country]?.[trimmed.toLowerCase()] ?? null;
}

/** The legal drinking age for a place, never below 18. */
export function legalDrinkingAge({ country, subdivision }: Jurisdiction): number {
  if (!country) return UNKNOWN_LOCATION_DRINKING_AGE;
  const c = country.toUpperCase();
  const sub = subdivisionCode(c, subdivision);
  const subdivisionAge = sub ? SUBDIVISION_DRINKING_AGE[c]?.[sub] : undefined;
  const age = subdivisionAge ?? COUNTRY_DRINKING_AGE[c] ?? DEFAULT_DRINKING_AGE;
  return Math.max(age, DEFAULT_DRINKING_AGE);
}

/** "Ontario", "the United States", or null when we don't have a nice name. */
export function placeName({ country, subdivision }: Jurisdiction): string | null {
  if (!country) return null;
  const c = country.toUpperCase();
  const sub = subdivisionCode(c, subdivision);
  return (sub && PLACE_NAMES[`${c}-${sub}`]) || PLACE_NAMES[c] || null;
}

/** Whole years old on `today`, from a "YYYY-MM-DD" birthdate. null if unparseable. */
export function ageFromBirthdate(birthdate: string, today: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthdate);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = today.getFullYear() - y;
  const beforeBirthday =
    today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

/** Apple's declared age range, as returned by the suds-age-range module. */
export type DeclaredRange =
  | { status: 'sharing'; lowerBound: number | null; upperBound: number | null }
  | { status: 'declined' }
  | { status: 'unavailable' };

export interface AgeDecision {
  allowed: boolean;
  /** What blocked them, when not allowed. */
  reason: 'declared_age_range' | 'birthdate' | null;
}

/**
 * Whether someone may use Suds. Apple's declared age range can only add a
 * block, never lift one: both the birthdate they entered and (when shared)
 * the age range Apple has on file must be at or above the legal age.
 *
 * Apple's range is "definitely under" only when its upper bound is below the
 * legal age. A range that straddles it (e.g. a region that forces 18+ gates
 * when the legal age is 21) doesn't block on its own; the birthdate decides.
 */
export function decideAge({
  minimumAge,
  birthdate,
  declared,
  today = new Date(),
}: {
  minimumAge: number;
  birthdate?: string | null;
  declared: DeclaredRange;
  today?: Date;
}): AgeDecision {
  if (declared.status === 'sharing' && declared.upperBound !== null && declared.upperBound < minimumAge) {
    return { allowed: false, reason: 'declared_age_range' };
  }
  if (birthdate) {
    const age = ageFromBirthdate(birthdate, today);
    if (age !== null && age < minimumAge) return { allowed: false, reason: 'birthdate' };
  }
  return { allowed: true, reason: null };
}
