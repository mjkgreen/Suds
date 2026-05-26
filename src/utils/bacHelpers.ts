export interface ProfileInput {
  weight: number;
  weightUnit: 'kg' | 'lb';
  sex: 'male' | 'female';
}

export interface DrinkInput {
  quantity: number; // number of standard drinks
  loggedAt: Date | string; // start of consumption
  endedAt?: Date | string | null; // end of consumption, or null/undefined if instant
}

export interface BACCalculationOptions {
  metabolismRate?: number; // BAC drop per hour, defaults to 0.015
  standardDrinkGrams?: number; // grams of pure alcohol per standard drink, defaults to 14.0
}

interface TimelineEvent {
  timestamp: number;
  instantGrams: number;
  rateChange: number;
}

/**
 * Normalizes body weight to kilograms.
 */
export function getWeightInKg(weight: number, unit: 'kg' | 'lb'): number {
  if (unit === 'lb') {
    return weight * 0.45359237;
  }
  return weight;
}

/**
 * Returns the Widmark r factor based on biological sex.
 */
export function getWidmarkR(sex: 'male' | 'female'): number {
  return sex === 'male' ? 0.68 : 0.55;
}

/**
 * Returns the metabolism rate in grams of alcohol per hour for the given profile and options.
 */
export function getMetabolismRateGramsPerHour(
  profile: ProfileInput,
  options?: BACCalculationOptions
): number {
  const weightKg = getWeightInKg(profile.weight, profile.weightUnit);
  const r = getWidmarkR(profile.sex);
  const rateBAC = options?.metabolismRate ?? 0.015;
  // Convert BAC drop rate per hour to grams of alcohol metabolized per hour
  // BAC = (grams / (weightKg * r * 1000)) * 100
  // grams = (BAC * weightKg * r * 1000) / 100 = BAC * weightKg * r * 10
  return rateBAC * weightKg * r * 10;
}

/**
 * Helper to convert body alcohol in grams to BAC percentage points.
 */
export function gramsToBAC(
  grams: number,
  profile: ProfileInput
): number {
  const weightKg = getWeightInKg(profile.weight, profile.weightUnit);
  const r = getWidmarkR(profile.sex);
  if (weightKg <= 0) return 0;
  return (grams / (weightKg * r * 1000)) * 100;
}

/**
 * Generates the sorted chronological timeline of events from the given list of drinks.
 */
function buildTimeline(
  drinks: DrinkInput[],
  options?: BACCalculationOptions
): { eventMap: Map<number, TimelineEvent>; timestamps: number[] } {
  const standardDrinkGrams = options?.standardDrinkGrams ?? 14.0;
  const eventMap = new Map<number, TimelineEvent>();

  const getOrCreateEvent = (ts: number): TimelineEvent => {
    let ev = eventMap.get(ts);
    if (!ev) {
      ev = { timestamp: ts, instantGrams: 0, rateChange: 0 };
      eventMap.set(ts, ev);
    }
    return ev;
  };

  for (const drink of drinks) {
    if (drink.quantity <= 0) continue;

    const tStart = new Date(drink.loggedAt).getTime();
    if (isNaN(tStart)) continue;

    const grams = drink.quantity * standardDrinkGrams;

    const tEnd = drink.endedAt ? new Date(drink.endedAt).getTime() : null;
    const isOverTime = tEnd !== null && !isNaN(tEnd) && tEnd > tStart;

    if (isOverTime) {
      const durationHours = (tEnd - tStart) / (1000 * 60 * 60);
      const rate = grams / durationHours;

      const startEvent = getOrCreateEvent(tStart);
      startEvent.rateChange += rate;

      const endEvent = getOrCreateEvent(tEnd);
      endEvent.rateChange -= rate;
    } else {
      const startEvent = getOrCreateEvent(tStart);
      startEvent.instantGrams += grams;
    }
  }

  const timestamps = Array.from(eventMap.keys()).sort((a, b) => a - b);
  return { eventMap, timestamps };
}

/**
 * Runs the chronological Widmark simulation from the first event up to a given limitTimestamp.
 * Returns the final simulated body alcohol in grams and the timeline state.
 */
function runSimulation(
  profile: ProfileInput,
  drinks: DrinkInput[],
  limitTimestamp: number,
  options?: BACCalculationOptions
): {
  currentGrams: number;
  currentRate: number;
  lastActiveAlcoholTime: number | null;
} {
  const { eventMap, timestamps } = buildTimeline(drinks, options);
  if (timestamps.length === 0) {
    return { currentGrams: 0, currentRate: 0, lastActiveAlcoholTime: null };
  }

  const metabolismGramsPerHour = getMetabolismRateGramsPerHour(profile, options);

  let currentGrams = 0;
  let currentRate = 0; // grams per hour continuous ingestion
  let lastActiveAlcoholTime: number | null = null;

  // We filter timestamps to only those <= limitTimestamp.
  // We must also include the limitTimestamp itself as the final point of simulation if it's within/after the timeline.
  const simTimestamps = timestamps.filter(ts => ts <= limitTimestamp);
  if (simTimestamps.length === 0) {
    return { currentGrams: 0, currentRate: 0, lastActiveAlcoholTime: null };
  }

  // If the limitTimestamp is not already in the timeline and is greater than the earliest timestamp,
  // we add it at the end of the simulation timestamps.
  if (limitTimestamp > simTimestamps[simTimestamps.length - 1]) {
    simTimestamps.push(limitTimestamp);
  }

  for (let i = 0; i < simTimestamps.length; i++) {
    const tCurr = simTimestamps[i];
    const event = eventMap.get(tCurr);

    // 1. Apply any instant changes at the current timestamp
    if (event) {
      currentGrams += event.instantGrams;
      currentRate += event.rateChange;
      // Handle floating-point inaccuracies
      if (Math.abs(currentRate) < 1e-9) {
        currentRate = 0;
      }
    }

    // 2. Transition from tCurr to tNext (unless this is the final timestamp)
    if (i < simTimestamps.length - 1) {
      const tNext = simTimestamps[i + 1];
      const deltaHours = (tNext - tCurr) / (1000 * 60 * 60);

      const R = currentRate;
      const M = metabolismGramsPerHour;
      const AStart = currentGrams;

      if (R > M) {
        // Alcohol increases
        currentGrams = AStart + (R - M) * deltaHours;
        lastActiveAlcoholTime = tNext;
      } else {
        // R <= M: alcohol decreases or stays 0
        const potentialEndGrams = AStart + (R - M) * deltaHours;
        if (potentialEndGrams >= 0) {
          currentGrams = potentialEndGrams;
          if (currentGrams > 0 || AStart > 0) {
            lastActiveAlcoholTime = tNext;
          }
        } else {
          // Hits 0 somewhere during this interval
          currentGrams = 0;
          if (AStart > 0 && M > R) {
            const timeToSoberHours = AStart / (M - R);
            const soberTs = tCurr + timeToSoberHours * (1000 * 60 * 60);
            lastActiveAlcoholTime = soberTs;
          }
        }
      }
    }
  }

  return { currentGrams, currentRate, lastActiveAlcoholTime };
}

/**
 * Calculates the BAC (Blood Alcohol Concentration) at a specific targetDate.
 */
export function calculateBAC(
  profile: ProfileInput,
  drinks: DrinkInput[],
  targetDate: Date | string,
  options?: BACCalculationOptions
): number {
  const targetTs = new Date(targetDate).getTime();
  if (isNaN(targetTs)) return 0;

  const { currentGrams } = runSimulation(profile, drinks, targetTs, options);
  const rawBac = gramsToBAC(currentGrams, profile);
  return Math.max(rawBac, 0);
}

/**
 * Calculates the exact sober-up timestamp when the BAC drops back to 0 and stays at 0.
 * Returns null if no drinks are active/ever logged or if the user is already sober.
 */
export function getSoberTime(
  profile: ProfileInput,
  drinks: DrinkInput[],
  options?: BACCalculationOptions
): Date | null {
  const { eventMap, timestamps } = buildTimeline(drinks, options);
  if (timestamps.length === 0) {
    return null;
  }

  // Run simulation through ALL events up to the very last event in the timeline.
  const lastEventTs = timestamps[timestamps.length - 1];
  const { currentGrams, currentRate, lastActiveAlcoholTime } = runSimulation(
    profile,
    drinks,
    lastEventTs,
    options
  );

  // If there's still alcohol in the body at the last event, since currentRate is 0 after the last event,
  // we calculate the extra time needed to metabolize the remaining alcohol.
  if (currentGrams > 0) {
    const metabolismGramsPerHour = getMetabolismRateGramsPerHour(profile, options);
    const extraHours = currentGrams / metabolismGramsPerHour;
    const finalSoberTs = lastEventTs + extraHours * (1000 * 60 * 60);
    return new Date(finalSoberTs);
  }

  return lastActiveAlcoholTime ? new Date(lastActiveAlcoholTime) : null;
}
