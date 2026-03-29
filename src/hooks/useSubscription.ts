import { useCallback, useEffect, useState } from 'react';
import { getIsPremium, getOfferings, purchasePackage, restorePurchases } from '@/lib/revenuecat';
import { useAuthStore } from '@/stores/authStore';

export function useSubscription() {
  const { isPremium, setIsPremium } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [offerings, setOfferings] = useState<Awaited<ReturnType<typeof getOfferings>>>(null);

  const refresh = useCallback(async () => {
    const premium = await getIsPremium();
    setIsPremium(premium);
    return premium;
  }, [setIsPremium]);

  useEffect(() => {
    refresh();
    getOfferings().then(setOfferings);
  }, [refresh]);

  const purchase = useCallback(async (pkg: import('react-native-purchases').PurchasesPackage) => {
    setIsLoading(true);
    try {
      const ok = await purchasePackage(pkg);
      setIsPremium(ok);
      return ok;
    } finally {
      setIsLoading(false);
    }
  }, [setIsPremium]);

  const restore = useCallback(async () => {
    setIsLoading(true);
    try {
      const ok = await restorePurchases();
      setIsPremium(ok);
      return ok;
    } finally {
      setIsLoading(false);
    }
  }, [setIsPremium]);

  return { isPremium, isLoading, offerings, purchase, restore, refresh };
}
