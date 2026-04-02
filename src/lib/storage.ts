import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Deletes a drink photo from storage given its public URL.
 * Silently succeeds if the URL is not from our bucket.
 */
export async function deleteDrinkPhoto(publicUrl: string): Promise<void> {
  try {
    const marker = '/drink-photos/';
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return;
    const path = publicUrl.slice(idx + marker.length);
    await supabase.storage.from('drink-photos').remove([path]);
  } catch {
    // Best-effort — don't block the update if delete fails
  }
}

/**
 * Decodes a base64 string into an ArrayBuffer.
 * Robust fallback for React Native where atob() might be missing.
 */
function decodeBase64(base64: string): ArrayBuffer {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  const len = base64.length;
  let bufferLength = len * 0.75;
  if (base64[len - 1] === '=') {
    bufferLength--;
    if (base64[len - 2] === '=') {
      bufferLength--;
    }
  }

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arrayBuffer);

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const encoded1 = lookup[base64.charCodeAt(i)];
    const encoded2 = lookup[base64.charCodeAt(i + 1)];
    const encoded3 = lookup[base64.charCodeAt(i + 2)];
    const encoded4 = lookup[base64.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
  }

  return arrayBuffer;
}

/**
 * Uploads a photo from a local URI (native) or blob URI (web) to Supabase Storage.
 * Returns the public URL, or throws on failure.
 */
export async function uploadDrinkPhoto(
  userId: string, 
  localUri: string, 
  base64?: string | null
): Promise<string> {
  // Determine extension and MIME type
  let ext = 'jpg';
  let mimeType = 'image/jpeg';

  const uriExt = localUri.split('.').pop()?.split('?')[0]?.toLowerCase();
  if (uriExt) {
    ext = ['jpeg', 'jpg'].includes(uriExt) ? 'jpg' : uriExt;
    const map: Record<string, string> = {
      jpg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      heic: 'image/heic',
      heif: 'image/heif'
    };
    mimeType = map[ext] || 'image/jpeg';
  }

  const fileName = `${userId}/${Date.now()}.${ext}`;

  let uploadPayload: any;
  if (Platform.OS === 'web') {
    // For web, fetch-to-blob remains the best strategy
    const response = await fetch(localUri);
    uploadPayload = await response.blob();
  } else if (base64) {
    // For native, if we have base64, decoding it to an ArrayBuffer is the most reliable way
    // to avoid 0-byte file issues from fetch-to-blob conversion on some iPhones.
    uploadPayload = decodeBase64(base64);
  } else {
    // Fallback if base64 is missing
    uploadPayload = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        resolve(xhr.response);
      };
      xhr.onerror = function () {
        reject(new Error('Failed to convert local file to blob'));
      };
      xhr.responseType = 'blob';
      xhr.open('GET', localUri, true);
      xhr.send(null);
    });
  }

  const { error } = await supabase.storage
    .from('drink-photos')
    .upload(fileName, uploadPayload, { 
      contentType: mimeType, 
      upsert: false 
    });

  if (error) throw error;

  const { data } = supabase.storage.from('drink-photos').getPublicUrl(fileName);
  return data.publicUrl;
}

export async function uploadAvatarPhoto(
  userId: string,
  localUri: string,
  base64?: string | null
): Promise<string> {
  let ext = 'jpg';
  let mimeType = 'image/jpeg';

  const uriExt = localUri.split('.').pop()?.split('?')[0]?.toLowerCase();
  if (uriExt) {
    ext = ['jpeg', 'jpg'].includes(uriExt) ? 'jpg' : uriExt;
    const map: Record<string, string> = {
      jpg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      heic: 'image/heic',
      heif: 'image/heif',
    };
    mimeType = map[ext] || 'image/jpeg';
  }

  const fileName = `${userId}.${ext}`;

  let uploadPayload: any;
  if (Platform.OS === 'web') {
    const response = await fetch(localUri);
    uploadPayload = await response.blob();
  } else if (base64) {
    uploadPayload = decodeBase64(base64);
  } else {
    uploadPayload = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () { resolve(xhr.response); };
      xhr.onerror = function () { reject(new Error('Failed to convert local file to blob')); };
      xhr.responseType = 'blob';
      xhr.open('GET', localUri, true);
      xhr.send(null);
    });
  }

  const { error } = await supabase.storage
    .from('avatars')
    .upload(fileName, uploadPayload, { contentType: mimeType, upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
  return `${data.publicUrl}?v=${Date.now()}`;
}
