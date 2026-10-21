/**
 * @username mentions. Must match extract_mentions() in
 * supabase/migrations/042_mentions_and_tags.sql: "@" starts the text or
 * follows a non-username character (so emails like a@b.com don't count).
 */

export type MentionSegment = { text: string; username?: string };

const MENTION_PATTERN = /(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]+)/g;

/** Splits text into plain and @mention segments, in order. */
export function splitMentions(text: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const start = match.index! + match[1].length;
    if (start > last) segments.push({ text: text.slice(last, start) });
    segments.push({ text: `@${match[2]}`, username: match[2].toLowerCase() });
    last = start + 1 + match[2].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
}

/**
 * The partial @mention being typed at the cursor, if any — e.g. "@ca" in
 * "hi @ca|". `start` is the index of the "@".
 */
export function activeMentionQuery(text: string, cursor: number): { query: string; start: number } | null {
  const before = text.slice(0, cursor);
  const match = /(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]*)$/.exec(before);
  if (!match) return null;
  return { query: match[2], start: before.length - match[2].length - 1 };
}

/** Replaces the mention being typed (from `start` to `cursor`) with a full one. */
export function insertMention(text: string, start: number, cursor: number, username: string): string {
  const after = text.slice(cursor).replace(/^[a-zA-Z0-9_]*/, '');
  return `${text.slice(0, start)}@${username}${after.startsWith(' ') ? '' : ' '}${after}`;
}
