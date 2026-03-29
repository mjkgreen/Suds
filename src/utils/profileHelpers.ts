import { Profile } from '@/types/models';

function isEmail(value: string | null | undefined): boolean {
  return !!value && value.includes('@') && value.includes('.');
}

/**
 * Returns the best display name for a profile, never an email address.
 * Falls back chain: display_name (if not email) → username (if not email) → 'User'
 */
export function getDisplayName(profile: Pick<Profile, 'display_name' | 'username'>): string {
  if (profile.display_name && !isEmail(profile.display_name)) {
    return profile.display_name;
  }
  if (profile.username && !isEmail(profile.username)) {
    return profile.username;
  }
  return 'User';
}

/**
 * Returns the username handle. If the stored username looks like an email, returns 'unknown'.
 */
export function getUsername(profile: Pick<Profile, 'username'>): string {
  if (profile.username && !isEmail(profile.username)) {
    return profile.username;
  }
  return 'unknown';
}
