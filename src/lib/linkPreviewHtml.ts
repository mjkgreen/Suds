/**
 * The HTML that link-preview crawlers (iMessage, WhatsApp, Slack, …) get for
 * an invite link. They don't run JavaScript, so the static web export can't
 * give them per-link titles; api/share-preview.ts serves this instead.
 * Pure, so it's unit-tested and usable from the Vercel function.
 */

export interface LinkPreviewMeta {
  title: string;
  description: string;
  /** Canonical URL of the page. */
  url: string;
  /** Absolute image URL. */
  image: string;
  /** Alt text for the image. */
  imageAlt?: string;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only http(s) URLs end up in the page; anything else falls back. */
export function safeHttpUrl(url: string | null | undefined, fallback: string): string {
  if (!url) return fallback;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : fallback;
  } catch {
    return fallback;
  }
}

export function renderLinkPreviewHtml(meta: LinkPreviewMeta): string {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const u = escapeHtml(meta.url);
  const i = escapeHtml(meta.image);
  const alt = escapeHtml(meta.imageAlt ?? meta.title);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<meta name="robots" content="noindex">
<link rel="canonical" href="${u}">
<meta property="og:site_name" content="Suds">
<meta property="og:type" content="website">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
<meta property="og:image" content="${i}">
<meta property="og:image:alt" content="${alt}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${i}">
<meta name="apple-itunes-app" content="app-id=6761397970, app-argument=${u}">
</head>
<body>
<h1>${t}</h1>
<p>${d}</p>
<p><a href="${u}">Open in Suds</a></p>
</body>
</html>
`;
}
