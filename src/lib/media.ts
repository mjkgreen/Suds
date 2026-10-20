/**
 * Shared media model for drink logs. Every attachment is stored as a file in
 * Supabase Storage; the drink row keeps a `media` array describing each one so
 * the UI can render it at the exact frame the user chose.
 */

export type MediaType = 'image' | 'video';
export type MediaOrientation = 'landscape' | 'portrait';

/** Fixed frames users crop into. width / height. */
export const MEDIA_ASPECT: Record<MediaOrientation, number> = {
  landscape: 4 / 3,
  portrait: 4 / 5,
};

/** Longest edge we keep after cropping, in pixels. */
export const MAX_IMAGE_EDGE = 1440;

export const MAX_MEDIA = 3;

/** Longest video we accept, in seconds. */
export const MAX_VIDEO_SECONDS = 30;

/** Matches the drink-photos bucket's file_size_limit. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Cap for media frames in feed cards so portrait shots don't dominate. */
export const FEED_MEDIA_MAX_HEIGHT = 420;

/** A stored attachment as persisted in `drink_logs.media`. */
export interface DrinkMedia {
  url: string;
  type: MediaType;
  /** Missing on photos uploaded before cropping existed. */
  width?: number | null;
  height?: number | null;
  /** Videos only: still frame shown before playback. */
  poster_url?: string | null;
  /** Videos only: length in seconds. */
  duration?: number | null;
}

/** A local file picked/cropped on this device, not yet uploaded. */
export interface LocalMedia {
  uri: string;
  type: MediaType;
  width: number;
  height: number;
  mimeType?: string | null;
  /** Videos only: local still frame, uploaded alongside the video. */
  posterUri?: string | null;
  /** Videos only: length in seconds. */
  duration?: number | null;
}

export function orientationOf(width: number, height: number): MediaOrientation {
  return width >= height ? 'landscape' : 'portrait';
}

/** Aspect ratio to render an item at. Legacy items fall back to landscape. */
export function mediaAspect(item: { width?: number | null; height?: number | null }): number {
  if (item.width && item.height) return item.width / item.height;
  return MEDIA_ASPECT.landscape;
}

/**
 * Returns a drink's media, falling back to the older photo_urls / photo_url
 * columns for rows written before `media` existed.
 */
export function getDrinkMedia(drink: {
  media?: DrinkMedia[] | null;
  photo_urls?: string[] | null;
  photo_url?: string | null;
}): DrinkMedia[] {
  if (drink.media?.length) return drink.media;
  const urls = drink.photo_urls?.length ? drink.photo_urls : drink.photo_url ? [drink.photo_url] : [];
  return urls.map((url) => ({ url, type: 'image' as const }));
}

export function formatClipLength(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
