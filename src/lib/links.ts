// Canonical URLs for shareable surfaces. These ride universal links:
// installed apps open them natively, everyone else lands on the web page.
export const WEB_BASE_URL = 'https://drink-with-suds.com';

// TODO: replace with the real App Store URL once the listing is live.
export const APP_STORE_URL = 'https://apps.apple.com/app/id0000000000';
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.sudssocial.app';

export function buildJoinUrl(token: string): string {
  return `${WEB_BASE_URL}/join/${token}`;
}

export function buildProfileUrl(username: string): string {
  return `${WEB_BASE_URL}/u/${encodeURIComponent(username)}`;
}

export function buildInviteMessage(inviterName: string, joinUrl: string): string {
  return `${inviterName} started a night out on Suds — tap to join: ${joinUrl}`;
}
