/**
 * Link previews for share links (/invite/<token>).
 *
 * iMessage, WhatsApp, Slack and friends read <meta> tags without running
 * JavaScript, so the static web export can only give them generic ones.
 * vercel.json sends those crawlers (matched by user agent) here; people get
 * the normal app page. This asks Supabase for the same public preview the
 * page shows (get_share_preview, migration 051: safe fields only) and
 * answers with just the tags.
 */
import { renderLinkPreviewHtml, safeHttpUrl } from '../src/lib/linkPreviewHtml';
import {
  INVITE_PATH_PREFIX,
  inviteUrl,
  isSharePreviewError,
  isValidShareToken,
  shareCopy,
  SharePreviewResult,
  WEB_ORIGIN,
} from '../src/lib/shareLinks';

export const config = { runtime: 'edge' };

// The public project URL and publishable key (also in eas.json); env vars win.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://gbenibgytweskljxneup.supabase.co';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_D8CpBizTY011eE0KYQkIig_wRSf4hDZ';

const FALLBACK = {
  title: "You're invited to Suds",
  description: 'Join your friends on Suds, the social drink tracker.',
};
const DEFAULT_IMAGE = `${WEB_ORIGIN}/link-preview.png`;

async function fetchPreview(token: string): Promise<SharePreviewResult | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_share_preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ p_token: token }),
    });
    if (!res.ok) return null;
    return (await res.json()) as SharePreviewResult;
  } catch {
    return null;
  }
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? url.pathname.slice(INVITE_PATH_PREFIX.length);
  const pageUrl = isValidShareToken(token) ? inviteUrl(token) : WEB_ORIGIN;

  let meta = { ...FALLBACK, image: DEFAULT_IMAGE, imageAlt: 'Suds' };
  if (isValidShareToken(token)) {
    const preview = await fetchPreview(token);
    if (preview && !isSharePreviewError(preview)) {
      const copy = shareCopy(preview);
      meta = {
        title: copy.title,
        description: copy.description,
        image: safeHttpUrl(preview.inviter.avatar_url, DEFAULT_IMAGE),
        imageAlt: preview.inviter.display_name || preview.inviter.username,
      };
    } else if (preview && isSharePreviewError(preview)) {
      meta = { ...meta, title: 'Suds', description: 'This invite link is no longer active. Suds is the social drink tracker.' };
    }
  }

  return new Response(renderLinkPreviewHtml({ ...meta, url: pageUrl }), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Short: the drink total changes during the night.
      'Cache-Control': 'public, max-age=60, s-maxage=60',
    },
  });
}
