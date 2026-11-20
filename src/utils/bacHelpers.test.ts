import {
  getWeightInKg,
  getWidmarkR,
  getMetabolismRateGramsPerHour,
  gramsToBAC,
  calculateBAC,
  getSoberTime,
  ProfileInput,
  DrinkInput,
} from './bacHelpers';

describe('BAC Helpers', () => {
  const maleProfile: ProfileInput = {
    weight: 180,
    weightUnit: 'lb',
    sex: 'male',
  };

  const femaleProfile: ProfileInput = {
    weight: 60,
    weightUnit: 'kg',
    sex: 'female',
  };

  describe('getWeightInKg', () => {
    it('should correctly convert lbs to kg', () => {
      expect(getWeightInKg(180, 'lb')).toBeCloseTo(81.6466, 4);
    });

    it('should keep kg as kg', () => {
      expect(getWeightInKg(70, 'kg')).toBe(70);
    });
  });

  describe('getWidmarkR', () => {
    it('should return 0.68 for male and 0.55 for female', () => {
      expect(getWidmarkR('male')).toBe(0.68);
      expect(getWidmarkR('female')).toBe(0.55);
    });
  });

  describe('gramsToBAC', () => {
    it('should return 0 if weight is 0 or negative', () => {
      const invalidProfile: ProfileInput = { ...maleProfile, weight: 0 };
      expect(gramsToBAC(14, invalidProfile)).toBe(0);
    });

    it('should correctly compute BAC from alcohol in grams', () => {
      // For male of 80kg, r = 0.68
      // grams = 14g
      // BAC = (14 / (80 * 0.68 * 1000)) * 100
      const profile: ProfileInput = { weight: 80, weightUnit: 'kg', sex: 'male' };
      const expectedBAC = (14 / (80 * 0.68 * 1000)) * 100;
      expect(gramsToBAC(14, profile)).toBeCloseTo(expectedBAC, 6);
    });
  });

  describe('getMetabolismRateGramsPerHour', () => {
    it('should calculate metabolism rate correctly based on default BAC drop rate', () => {
      // default BAC drop is 0.015/hour
      // rateGramsPerHour = 0.015 * weightKg * r * 10
      const weightKg = getWeightInKg(maleProfile.weight, maleProfile.weightUnit);
      const r = getWidmarkR(maleProfile.sex);
      const expectedGrams = 0.015 * weightKg * r * 10;
      expect(getMetabolismRateGramsPerHour(maleProfile)).toBeCloseTo(expectedGrams, 4);
    });
  });

  describe('calculateBAC', () => {
    it('should return 0 when there are no drinks', () => {
      expect(calculateBAC(maleProfile, [], new Date())).toBe(0);
    });

    it('should compute initial BAC correctly for instant drink', () => {
      const drinks: DrinkInput[] = [
        {
          quantity: 1, // 1 standard drink (14g)
          loggedAt: '2023-10-01T12:00:00Z',
        },
      ];
      const target = '2023-10-01T12:00:00Z';
      const expectedBAC = gramsToBAC(14, maleProfile);
      expect(calculateBAC(maleProfile, drinks, target)).toBeCloseTo(expectedBAC, 5);
    });

    it('should account for metabolism over time', () => {
      const drinks: DrinkInput[] = [
        {
          quantity: 2, // 28g
          loggedAt: '2023-10-01T12:00:00Z',
        },
      ];
      // 1 hour later
      const target = '2023-10-01T13:00:00Z';
      const initialGrams = 28;
      const metabolismRateGrams = getMetabolismRateGramsPerHour(maleProfile);
      const remainingGrams = Math.max(0, initialGrams - metabolismRateGrams);
      const expectedBAC = gramsToBAC(remainingGrams, maleProfile);
      expect(calculateBAC(maleProfile, drinks, target)).toBeCloseTo(expectedBAC, 5);
    });

    it('should handle zero or negative quantities safely', () => {
      const drinks: DrinkInput[] = [
        {
          quantity: 0,
          loggedAt: '2023-10-01T12:00:00Z',
        },
      ];
      expect(calculateBAC(maleProfile, drinks, '2023-10-01T12:00:00Z')).toBe(0);
    });
  });

  describe('getSoberTime', () => {
    it('should return null when there are no drinks', () => {
      expect(getSoberTime(maleProfile, [])).toBeNull();
    });

    it('should return correct sober time for instant drinks', () => {
      const startTime = '2023-10-01T12:00:00Z';
      const drinks: DrinkInput[] = [
        {
          quantity: 1, // 14g
          loggedAt: startTime,
        },
      ];
      const startMs = new Date(startTime).getTime();
      const metabolismRateGrams = getMetabolismRateGramsPerHour(maleProfile);
      const hoursToSober = 14 / metabolismRateGrams;
      const expectedSoberTime = new Date(startMs + hoursToSober * 60 * 60 * 1000);

      const soberTime = getSoberTime(maleProfile, drinks);
      expect(soberTime).not.toBeNull();
      expect(soberTime?.getTime()).toBeCloseTo(expectedSoberTime.getTime(), -2); // within 100ms
    });
  });
});

describe('personalBACDrinks', () => {
  const { personalBACDrinks } = require('./bacHelpers');
  const isAlcoholic = (t: string) => t !== 'water';
  const drinks = [
    { user_id: 'me', drink_type: 'beer', quantity: 2, logged_at: '2026-11-19T20:00:00Z', ended_at: null },
    { user_id: 'me', drink_type: 'water', quantity: 1, logged_at: '2026-11-19T20:10:00Z', ended_at: null },
    { user_id: 'friend', drink_type: 'spirit', quantity: 4, logged_at: '2026-11-19T20:20:00Z', ended_at: null },
  ];

  it("uses only the person's own alcoholic drinks, not the whole night out", () => {
    expect(personalBACDrinks(drinks, 'me', isAlcoholic)).toEqual([
      { quantity: 2, loggedAt: '2026-11-19T20:00:00Z', endedAt: null },
    ]);
  });

  it('is empty without a user', () => {
    expect(personalBACDrinks(drinks, undefined, isAlcoholic)).toEqual([]);
  });
});

describe('buildWidgetBACPayload (Live Activity BAC)', () => {
  const { buildWidgetBACPayload, calculateBAC } = require('./bacHelpers');
  const profile = { weight: 180, weightUnit: 'lb', sex: 'male' };

  // Line-for-line JS copy of BACState.bac(at:) in SudsSessionAttributes.swift,
  // so the Swift port is checked against the app's own calculateBAC.
  function swiftBAC(p: any, atSeconds: number): number {
    const instant = new Map<number, number>();
    const rateChange = new Map<number, number>();
    for (const d of p.drinks) {
      if (d.grams <= 0) continue;
      if (d.end !== null && d.end > d.start) {
        const rate = d.grams / ((d.end - d.start) / 3600);
        rateChange.set(d.start, (rateChange.get(d.start) ?? 0) + rate);
        rateChange.set(d.end, (rateChange.get(d.end) ?? 0) - rate);
      } else {
        instant.set(d.start, (instant.get(d.start) ?? 0) + d.grams);
      }
    }
    const times = [...new Set([...instant.keys(), ...rateChange.keys()])].filter((t) => t <= atSeconds).sort((a, b) => a - b);
    if (!times.length) return 0;
    if (atSeconds > times[times.length - 1]) times.push(atSeconds);
    let grams = 0;
    let rate = 0;
    for (let i = 0; i < times.length; i++) {
      grams += instant.get(times[i]) ?? 0;
      rate += rateChange.get(times[i]) ?? 0;
      if (Math.abs(rate) < 1e-9) rate = 0;
      if (i < times.length - 1) {
        const hours = (times[i + 1] - times[i]) / 3600;
        grams = Math.max(0, grams + (rate - p.eliminationGramsPerHour) * hours);
      }
    }
    return Math.max(0, grams * p.bacPerGram);
  }

  const t0 = new Date('2026-11-20T20:00:00Z').getTime();
  const at = (min: number) => new Date(t0 + min * 60_000).toISOString();
  const drinks = [
    { quantity: 2.5, loggedAt: at(0), endedAt: at(90) }, // spread over 90 min
    { quantity: 1, loggedAt: at(30), endedAt: null },     // instant
    { quantity: 0.5, loggedAt: at(120), endedAt: null },
  ];

  it.each([10, 45, 89, 91, 121, 180, 360, 600])('matches calculateBAC %i minutes in', (min) => {
    const now = new Date(t0 + min * 60_000);
    const payload = buildWidgetBACPayload(profile, drinks, now);
    const expected = calculateBAC(profile, drinks, now);
    expect(swiftBAC(payload, now.getTime() / 1000)).toBeCloseTo(expected, 4);
  });

  it('spreads a drink with an end time instead of counting it all at the start', () => {
    const spread = [{ quantity: 3, loggedAt: at(0), endedAt: at(120) }];
    const instant = [{ quantity: 3, loggedAt: at(0), endedAt: null }];
    const now = new Date(t0 + 30 * 60_000);
    const p1 = buildWidgetBACPayload(profile, spread, now);
    const p2 = buildWidgetBACPayload(profile, instant, now);
    expect(swiftBAC(p1, now.getTime() / 1000)).toBeLessThan(swiftBAC(p2, now.getTime() / 1000));
    expect(p1.drinks[0]).toMatchObject({ grams: 42, end: Math.round((t0 + 120 * 60_000) / 1000) });
  });

  it('drops drinks from over a day ago and keeps the payload small', () => {
    const old = [{ quantity: 1, loggedAt: at(-60 * 30), endedAt: null }];
    const many = Array.from({ length: 60 }, (_, i) => ({ quantity: 1, loggedAt: at(i), endedAt: null }));
    expect(buildWidgetBACPayload(profile, old, new Date(t0)).drinks).toHaveLength(0);
    const payload = buildWidgetBACPayload(profile, many, new Date(t0 + 60 * 60_000));
    expect(payload.drinks).toHaveLength(40);
    expect(JSON.stringify(payload).length).toBeLessThan(3000);
  });
});
