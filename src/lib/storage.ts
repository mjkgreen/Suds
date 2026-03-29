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
 * Uploads a photo from a local URI (native) or blob URI (web) to Supabase Storage.
 * Returns the public URL, or throws on failure.
 */
export async function uploadDrinkPhoto(userId: string, localUri: string): Promise<string> {
  const ext = localUri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const fileName = `${userId}/${Date.now()}.${ext}`;

  // Fetch the local file as a blob — works on both web and React Native
  const response = await fetch(localUri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from('drink-photos')
    .upload(fileName, blob, { contentType: mimeType, upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from('drink-photos').getPublicUrl(fileName);
  return data.publicUrl;
}
