import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { DrinkMedia, LocalMedia } from './media';
import { supabase } from './supabase';

const DRINK_MEDIA_BUCKET = 'drink-photos';

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
};

const EXT_BY_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_BY_EXT).map(([ext, mime]) => [mime, ext]),
);

/**
 * Works out the file extension and MIME type for a local file, preferring the
 * picker-reported MIME type and falling back to the URI's extension.
 */
function resolveFileType(uri: string, mimeType?: string | null, fallback: 'image' | 'video' = 'image') {
  if (mimeType && EXT_BY_MIME[mimeType]) {
    return { ext: EXT_BY_MIME[mimeType], mimeType };
  }
  const raw = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? '';
  const ext = raw === 'jpeg' ? 'jpg' : raw;
  if (MIME_BY_EXT[ext]) return { ext, mimeType: MIME_BY_EXT[ext] };
  return fallback === 'video'
    ? { ext: 'mp4', mimeType: 'video/mp4' }
    : { ext: 'jpg', mimeType: 'image/jpeg' };
}

/**
 * Uploads a local file to Supabase Storage.
 *
 * On native the file is streamed straight from disk to a signed upload URL, so
 * large files (e.g. videos) are never loaded into JS memory. On web the
 * browser's blob is uploaded directly.
 */
async function uploadFile(
  bucket: string,
  path: string,
  localUri: string,
  mimeType: string,
  upsert: boolean,
): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(localUri)).blob();
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, blob, { contentType: mimeType, upsert });
    if (error) throw error;
    return;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path, { upsert });
  if (error) throw error;

  const result = await FileSystem.uploadAsync(data.signedUrl, localUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      'Content-Type': mimeType,
      'x-upsert': upsert ? 'true' : 'false',
    },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Upload failed (${result.status}): ${result.body}`);
  }
}

/**
 * Deletes a drink photo/video from storage given its public URL.
 * Silently succeeds if the URL is not from our bucket.
 */
export async function deleteDrinkMedia(publicUrl: string): Promise<void> {
  try {
    const marker = `/${DRINK_MEDIA_BUCKET}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return;
    const path = publicUrl.slice(idx + marker.length).split('?')[0];
    await supabase.storage.from(DRINK_MEDIA_BUCKET).remove([path]);
  } catch {
    // Best-effort — don't block the update if delete fails
  }
}

/**
 * Uploads a picked/cropped photo or video and returns its stored description.
 */
export async function uploadDrinkMedia(userId: string, media: LocalMedia): Promise<DrinkMedia> {
  const { ext, mimeType } = resolveFileType(media.uri, media.mimeType, media.type);
  const suffix = Math.random().toString(36).slice(2, 8);
  const path = `${userId}/${Date.now()}-${suffix}.${ext}`;

  await uploadFile(DRINK_MEDIA_BUCKET, path, media.uri, mimeType, false);

  const { data } = supabase.storage.from(DRINK_MEDIA_BUCKET).getPublicUrl(path);
  return {
    url: data.publicUrl,
    type: media.type,
    width: media.width,
    height: media.height,
  };
}

export async function uploadAvatarPhoto(
  userId: string,
  localUri: string,
  mimeType?: string | null,
): Promise<string> {
  const resolved = resolveFileType(localUri, mimeType);
  const path = `${userId}.${resolved.ext}`;

  await uploadFile('avatars', path, localUri, resolved.mimeType, true);

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
