import AsyncStorage from '@react-native-async-storage/async-storage';

// Deferred deep-link claim: when someone taps a join link before they have an
// account (or before auth resolves), the token is parked here and claimed once
// they're signed in and onboarded. AsyncStorage so it survives app restarts
// during the install → sign-up flow.
const KEY = 'suds.pendingInviteToken';

export async function setPendingInviteToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, token);
  } catch {
    // Non-fatal: worst case the user re-taps the link
  }
}

export async function getPendingInviteToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function clearPendingInviteToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
