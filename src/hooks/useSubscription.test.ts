import { useSubscription } from './useSubscription';

describe('useSubscription', () => {
  it('should always return isPremium as true', () => {
    const { isPremium } = useSubscription();
    expect(isPremium).toBe(true);
  });

  it('should return isLoading as false', () => {
    const { isLoading } = useSubscription();
    expect(isLoading).toBe(false);
  });

  it('should resolve purchase, restore, and refresh to true', async () => {
    const { purchase, restore, refresh } = useSubscription();
    await expect(purchase({} as any)).resolves.toBe(true);
    await expect(restore()).resolves.toBe(true);
    await expect(refresh()).resolves.toBe(true);
  });
});
