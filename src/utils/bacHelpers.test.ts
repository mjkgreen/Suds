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
