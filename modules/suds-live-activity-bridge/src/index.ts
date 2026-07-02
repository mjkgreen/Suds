import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

export type LiveActivityInfo = {
  id: string;
  sessionTitle: string;
  drinkCount: number;
  elapsedMinutes: number;
  lastDrinkName: string;
  memberCount: number;
  memberNames: string;
};

type LiveActivityBridge = {
  isSupported(): boolean;
  getActivities(): Promise<LiveActivityInfo[]>;
  startActivity(
    sessionTitle: string,
    drinkCount: number,
    memberCount: number,
    memberNames: string,
    sessionStartMs: number,
    weightLbs: number,
  ): Promise<string | null>;
  updateActivity(
    activityId: string,
    drinkCount: number,
    lastDrinkName: string,
    memberCount: number,
    memberNames: string,
  ): Promise<void>;
  endActivity(activityId: string): Promise<void>;
  endAllActivities(): Promise<void>;
  writeSharedSession(
    sessionId: string,
    userId: string,
    refreshToken: string,
    weightLbs: number,
    supabaseUrl: string,
    anonKey: string,
    sessionStartMs: number,
    lastDrinkType: string,
    lastDrinkName: string,
    accessToken: string,
    accessTokenExpiresAt: number,
  ): void;
  updateSharedLastDrink(drinkType: string, drinkName: string): void;
  updateSharedAuthTokens(accessToken: string, refreshToken: string, accessTokenExpiresAt: number): void;
  readSharedAuthTokens(): SharedAuthTokens | null;
  clearSharedSession(): void;
};

export type SharedAuthTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
};

let Bridge: LiveActivityBridge | null = null;

try {
  if (Platform.OS === 'ios') {
    Bridge = requireNativeModule<LiveActivityBridge>('SudsLiveActivityBridge');
  }
} catch (e) {
  console.warn('[LiveActivity] Failed to load native module:', e);
}

export function isSupported(): boolean {
  return Bridge?.isSupported() ?? false;
}

export async function getActivities(): Promise<LiveActivityInfo[]> {
  return Bridge?.getActivities() ?? [];
}

export async function startActivity(
  sessionTitle: string,
  drinkCount: number,
  memberCount: number,
  memberNames: string,
  sessionStartMs: number,
  weightLbs: number,
): Promise<string | null> {
  return Bridge?.startActivity(sessionTitle, drinkCount, memberCount, memberNames, sessionStartMs, weightLbs) ?? null;
}

export async function updateActivity(
  activityId: string,
  drinkCount: number,
  lastDrinkName: string,
  memberCount: number,
  memberNames: string,
): Promise<void> {
  await Bridge?.updateActivity(activityId, drinkCount, lastDrinkName, memberCount, memberNames);
}

export async function endActivity(activityId: string): Promise<void> {
  await Bridge?.endActivity(activityId);
}

export async function endAllActivities(): Promise<void> {
  await Bridge?.endAllActivities();
}

export function writeSharedSession(
  sessionId: string,
  userId: string,
  refreshToken: string,
  weightLbs: number,
  supabaseUrl: string,
  anonKey: string,
  sessionStartMs: number,
  lastDrinkType: string,
  lastDrinkName: string,
  accessToken: string,
  accessTokenExpiresAt: number,
): void {
  Bridge?.writeSharedSession(sessionId, userId, refreshToken, weightLbs, supabaseUrl, anonKey, sessionStartMs, lastDrinkType, lastDrinkName, accessToken, accessTokenExpiresAt);
}

export function updateSharedLastDrink(drinkType: string, drinkName: string): void {
  Bridge?.updateSharedLastDrink(drinkType, drinkName);
}

// Push the app's freshly-rotated refresh token to the widget extension's shared storage.
// Supabase refresh tokens are single-use; without this the widget (a separate OS process)
// can retry a token this app already consumed, or vice versa.
export function updateSharedAuthTokens(accessToken: string, refreshToken: string, accessTokenExpiresAt: number): void {
  Bridge?.updateSharedAuthTokens(accessToken, refreshToken, accessTokenExpiresAt);
}

export function readSharedAuthTokens(): SharedAuthTokens | null {
  return Bridge?.readSharedAuthTokens() ?? null;
}

export function clearSharedSession(): void {
  Bridge?.clearSharedSession();
}
