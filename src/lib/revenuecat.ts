/**
 * RevenueCat integration (Mocked to bypass real entitlement checks and billing operations)
 */

export const ENTITLEMENT_ID = 'premium';

export async function initRevenueCat(userId: string): Promise<void> {
  // Mock initialization: Do nothing and log
  console.log('[RevenueCat Mock] initRevenueCat called with userId:', userId);
}

export async function getIsPremium(): Promise<boolean> {
  // Always resolve to true to bypass real entitlement checks
  return true;
}

export async function getOfferings(): Promise<any> {
  // Mock offerings: return null or dummy object
  return null;
}

export async function purchasePackage(pkg: import('react-native-purchases').PurchasesPackage): Promise<boolean> {
  // Mock successful purchase and resolve without launching real RevenueCat paywalls or native SDK flows
  console.log('[RevenueCat Mock] purchasePackage called for package:', pkg);
  return true;
}

export async function restorePurchases(): Promise<boolean> {
  // Mock successful restore and resolve without launching native SDK flows
  console.log('[RevenueCat Mock] restorePurchases called');
  return true;
}
