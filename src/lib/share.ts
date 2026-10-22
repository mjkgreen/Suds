import { Platform, Share } from 'react-native';

/** Public web origin; matches the expo-router origin in app.json. */
export const WEB_ORIGIN = 'https://drink-with-suds.com';

/**
 * Opens the system share sheet for a link. On web it uses the Web Share API
 * where available and otherwise copies the link to the clipboard.
 */
export async function shareLink(path: string, message: string): Promise<void> {
  const url = `${WEB_ORIGIN}${path}`;

  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    try {
      if (nav?.share) {
        await nav.share({ title: 'Suds', text: message, url });
        return;
      }
      await nav?.clipboard?.writeText(url);
      window.alert('Link copied to clipboard');
    } catch {
      // User dismissed the share sheet.
    }
    return;
  }

  try {
    // iOS shows `url` as a rich link; Android only reads `message`.
    await Share.share(Platform.OS === 'ios' ? { message, url } : { message: `${message} ${url}` });
  } catch {
    // User dismissed the share sheet.
  }
}
