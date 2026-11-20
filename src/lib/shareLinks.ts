/**
 * Share links: reusable links that let anyone, including people without an
 * account, open a night out or a personal "join me on Suds" invite
 * (migration 051). Both open at https://drink-with-suds.com/invite/<token>.
 *
 * Pure helpers only — no React Native imports — so the Vercel link-preview
 * function (api/share-preview.ts) can use them too.
 */

/** Public web origin; matches the expo-router origin in app.json. */
export const WEB_ORIGIN = 'https://drink-with-suds.com';

export const INVITE_PATH_PREFIX = '/invite/';

export const APP_STORE_URL = 'https://apps.apple.com/app/suds-alcohol-tracker/id6761397970';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.sudssocial.app';

export type ShareLinkKind = 'session' | 'profile';

export interface SharePreviewPerson {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface SharePreviewMember {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: 'host' | 'guest';
}

export interface SharePreview {
  kind: ShareLinkKind;
  /** A night-out link that still lets people join. */
  can_join: boolean;
  inviter: SharePreviewPerson & { is_private: boolean };
  session: {
    id: string;
    title: string | null;
    started_at: string;
    ended_at: string | null;
    /** Alcoholic drinks from members the viewer may see. */
    drink_total: number;
    members: SharePreviewMember[];
  } | null;
  /** Only when signed in. */
  viewer: {
    is_inviter: boolean;
    is_member: boolean;
    follow_status: 'self' | 'following' | 'requested' | 'none';
  } | null;
}

export type SharePreviewError = 'not_found' | 'revoked' | 'expired';

export type SharePreviewResult = SharePreview | { error: SharePreviewError };

export function isSharePreviewError(r: SharePreviewResult | null | undefined): r is { error: SharePreviewError } {
  return !!r && 'error' in r && typeof r.error === 'string';
}

const TOKEN_RE = /^[A-Za-z0-9_-]{6,64}$/;

export function isValidShareToken(token: string | null | undefined): token is string {
  return !!token && TOKEN_RE.test(token);
}

export function invitePath(token: string): string {
  return `${INVITE_PATH_PREFIX}${token}`;
}

export function inviteUrl(token: string): string {
  return `${WEB_ORIGIN}${invitePath(token)}`;
}

/**
 * The invite token in a link, from any of the forms it reaches the app in:
 * https://drink-with-suds.com/invite/<t> (universal / app link or web),
 * suds://invite/<t> ("Open the app" from the web page), or a bare
 * /invite/<t> path. Null for anything else.
 */
export function inviteTokenFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let path: string;
  const scheme = url.match(/^([a-z][a-z0-9+.-]*):\/\/(.*)$/i);
  if (scheme) {
    const rest = scheme[2];
    if (/^https?$/i.test(scheme[1])) {
      const slash = rest.indexOf('/');
      const host = (slash === -1 ? rest : rest.slice(0, slash)).toLowerCase();
      if (host !== 'drink-with-suds.com' && host !== 'www.drink-with-suds.com') return null;
      path = slash === -1 ? '/' : rest.slice(slash);
    } else {
      // Custom scheme: the "host" is the first path segment (suds://invite/x).
      path = `/${rest}`;
    }
  } else {
    path = url;
  }
  path = path.split(/[?#]/)[0];
  const m = path.match(/^\/+invite\/([^/]+)\/?$/);
  if (!m) return null;
  const token = decodeURIComponent(m[1]);
  return isValidShareToken(token) ? token : null;
}

export function personName(p: { display_name: string | null; username: string } | null | undefined): string {
  return p?.display_name?.trim() || p?.username || 'Someone';
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Whole drinks for display (a half pint shows as 0.5, a pitcher of 3 as 3). */
export function formatDrinkTotal(total: number): string {
  const rounded = Math.round(total * 10) / 10;
  return plural(rounded, 'drink', 'drinks');
}

export interface ShareCopy {
  /** Page and link-preview title. */
  title: string;
  /** Link-preview description. */
  description: string;
  /** Short line shown on sign-up while the invite waits ("Join Sam's night out"). */
  cta: string;
}

/** The words for a share link, used by the page, the link preview and sign-up. */
export function shareCopy(preview: SharePreview): ShareCopy {
  const name = personName(preview.inviter);
  if (preview.kind === 'profile' || !preview.session) {
    return {
      title: `${name} invited you to Suds`,
      description: `Join ${name} on Suds, the social drink tracker: log drinks, follow friends and share your nights out.`,
      cta: `Follow ${name} on Suds`,
    };
  }
  const s = preview.session;
  const what = s.title?.trim() || 'Night out';
  const others = s.members.filter((m) => m.role !== 'host').length;
  const bits: string[] = [];
  if (s.ended_at) bits.push('Ended');
  else bits.push('Live now');
  if (others > 0) bits.push(`with ${plural(others, 'friend', 'friends')}`);
  if (s.drink_total > 0) bits.push(formatDrinkTotal(s.drink_total));
  return {
    title: preview.can_join ? `Join ${name}'s night out: ${what}` : `${name}'s night out: ${what}`,
    description: `${bits.join(' · ')}. ${preview.can_join ? 'Join them on Suds.' : `Follow ${name} on Suds.`}`,
    cta: preview.can_join ? `Join ${name}'s night out` : `Follow ${name} on Suds`,
  };
}

/** Text that goes with the link in the share sheet. */
export function shareMessage(kind: ShareLinkKind, sessionTitle?: string | null): string {
  if (kind === 'profile') return 'Join me on Suds, the social drink tracker';
  return `Join my night out${sessionTitle?.trim() ? ` (${sessionTitle.trim()})` : ''} on Suds`;
}
