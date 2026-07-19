import { Platform } from 'react-native';

// Minimal PostHog capture over HTTP — no SDK dependency, works on native and
// web, silently no-ops until EXPO_PUBLIC_POSTHOG_KEY is configured. Enough to
// measure the invite funnel (and K-factor) from day one; swap for the full SDK
// if session replay/feature flags are ever needed.
const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let distinctId: string = `anon-${Math.random().toString(36).slice(2)}`;

export function identify(userId: string | null | undefined) {
  if (userId) distinctId = userId;
}

export function track(event: string, properties: Record<string, unknown> = {}) {
  if (!POSTHOG_KEY) return;
  fetch(`${POSTHOG_HOST}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: POSTHOG_KEY,
      event,
      distinct_id: distinctId,
      properties: {
        platform: Platform.OS,
        ...properties,
      },
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => {
    // Analytics must never break the product
  });
}

// Invite-funnel event names, centralized so the K-factor dashboard has a
// stable contract: created → shared → viewed → joined (or stored → claimed).
export const AnalyticsEvents = {
  InviteLinkCreated: 'invite_link_created',
  InviteShared: 'invite_shared',
  JoinPageViewed: 'join_page_viewed',
  InviteJoinSucceeded: 'invite_join_succeeded',
  InvitePendingStored: 'invite_pending_stored',
  InviteClaimPrompted: 'invite_claim_prompted',
  RecapOpened: 'recap_opened',
  RecapShared: 'recap_shared',
} as const;
