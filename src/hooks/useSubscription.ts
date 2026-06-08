import { getOfferings } from "@/lib/revenuecat";

export function useSubscription() {
  const isPremium = true;
  const isLoading = false;
  const offerings = null as unknown as Awaited<ReturnType<typeof getOfferings>>;

  const refresh = async () => {
    return true;
  };

  const purchase = async (_pkg: import("react-native-purchases").PurchasesPackage) => {
    return true;
  };

  const restore = async () => {
    return true;
  };

  return {
    isPremium,
    isLoading,
    offerings,
    purchase,
    restore,
    refresh,
  };
}
