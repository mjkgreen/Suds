/**
 * RevenueCat integration
 *
 * Setup requirements (one-time):
 *  1. npm install react-native-purchases
 *  2. npx expo prebuild  (generates native iOS/Android projects)
 *  3. Add your RevenueCat API keys to app.json (see plugin config in app.json)
 *  4. Build with EAS or Xcode/Android Studio
 *
 * RevenueCat dashboard setup:
 *  - Create an "Entitlement" with identifier: "premium"
 *  - Create a Product (monthly/annual) and attach it to the entitlement
 *  - Note the "Offering" identifier (defaults to "default")
 */

import { Platform } from 'react-native';

// Lazily import so the module is tree-shaken on web and doesn't crash
// if the native module isn't linked yet during development.
let Purchases: typeof import('react-native-purchases').default | null = null;
let LOG_LEVEL: typeof import('react-native-purchases').LOG_LEVEL | null = null;

function getPurchases() {
  if (Platform.OS === 'web') return null;
  if (!Purchases) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('react-native-purchases');
      Purchases = mod.default;
      LOG_LEVEL = mod.LOG_LEVEL;
    } catch {
      console.warn('[RevenueCat] react-native-purchases not linked. Run `npx expo prebuild`.');
    }
  }
  return Purchases;
}

export const ENTITLEMENT_ID = 'premium';

export async function initRevenueCat(userId: string) {
  const rc = getPurchases();
  if (!rc) return;

  const apiKey =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_RC_IOS_KEY ?? ''
      : process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? '';

  if (!apiKey) {
    console.warn('[RevenueCat] No API key found. Set EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY.');
    return;
  }

  if (__DEV__ && LOG_LEVEL) {
    rc.setLogLevel(LOG_LEVEL.VERBOSE);
  }

  await rc.configure({ apiKey, appUserID: userId });
}

export async function getIsPremium(): Promise<boolean> {
  const rc = getPurchases();
  if (!rc) return false;
  try {
    const ci = await rc.getCustomerInfo();
    return ci.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch {
    return false;
  }
}

export async function getOfferings() {
  const rc = getPurchases();
  if (!rc) return null;
  try {
    return await rc.getOfferings();
  } catch {
    return null;
  }
}

export async function purchasePackage(pkg: import('react-native-purchases').PurchasesPackage) {
  const rc = getPurchases();
  if (!rc) throw new Error('RevenueCat not available');
  const { customerInfo } = await rc.purchasePackage(pkg);
  return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
}

export async function restorePurchases(): Promise<boolean> {
  const rc = getPurchases();
  if (!rc) return false;
  try {
    const ci = await rc.restorePurchases();
    return ci.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch {
    return false;
  }
}
