import { splitProfileUpdates } from './profileFields';

describe('splitProfileUpdates', () => {
  it('routes public fields to the profiles table only', () => {
    const result = splitProfileUpdates({ display_name: 'Ada', bio: 'hi', is_private: true });
    expect(result.profile).toEqual({ display_name: 'Ada', bio: 'hi', is_private: true });
    expect(result.metrics).toEqual({});
    expect(result.badges).toBeUndefined();
  });

  it('routes body metrics to the metrics bucket', () => {
    const result = splitProfileUpdates({
      weight: 180,
      weight_unit: 'lb',
      height: 70,
      height_unit: 'in',
      birthdate: '1990-01-01',
    });
    expect(result.metrics).toEqual({
      weight: 180,
      weight_unit: 'lb',
      height: 70,
      height_unit: 'in',
      birthdate: '1990-01-01',
    });
    expect(result.profile).toEqual({});
  });

  it('routes displayed_badges to the badges bucket', () => {
    const result = splitProfileUpdates({ displayed_badges: ['milestone-100', 'sober-7'] });
    expect(result.badges).toEqual(['milestone-100', 'sober-7']);
    expect(result.profile).toEqual({});
    expect(result.metrics).toEqual({});
  });

  it('normalizes a cleared badge list to an empty array (not undefined)', () => {
    const result = splitProfileUpdates({ displayed_badges: undefined });
    expect(result.badges).toEqual([]);
  });

  it('splits a mixed update across all three buckets', () => {
    const result = splitProfileUpdates({
      username: 'ada',
      weight: 150,
      displayed_badges: ['x'],
    });
    expect(result.profile).toEqual({ username: 'ada' });
    expect(result.metrics).toEqual({ weight: 150 });
    expect(result.badges).toEqual(['x']);
  });
});
