import { Link } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text } from 'react-native';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/shareLinks';

export { APP_STORE_URL };

// Official Apple badge artwork is 119.66 x 40.
const BADGE_ASPECT = 119.66407 / 40;

interface AppStoreBadgeProps {
  /** "black" is Apple's preferred badge; use "white" on dark backgrounds if preferred. */
  variant?: 'black' | 'white';
  height?: number;
}

export function AppStoreBadge({ variant = 'black', height = 48 }: AppStoreBadgeProps) {
  const source =
    variant === 'white'
      ? require('../../../assets/app-store-badge-white.svg')
      : require('../../../assets/app-store-badge-black.svg');

  return (
    <Link href={APP_STORE_URL as never} target="_blank" rel="noopener noreferrer" asChild>
      <Pressable accessibilityRole="link" accessibilityLabel="Download Suds on the App Store">
        <Image
          source={source}
          style={{ height, width: height * BADGE_ASPECT }}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      </Pressable>
    </Link>
  );
}

/**
 * Google Play link styled to sit next to the App Store badge (same height and
 * shape). Text rather than Google's badge artwork, which isn't in the repo.
 */
export function GooglePlayButton({ variant = 'black', height = 48 }: AppStoreBadgeProps) {
  const dark = variant === 'black';
  return (
    <Link href={PLAY_STORE_URL as never} target="_blank" rel="noopener noreferrer" asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Get Suds on Google Play"
        style={{
          height,
          width: height * BADGE_ASPECT,
          borderRadius: height * 0.18,
          backgroundColor: dark ? '#000' : '#fff',
          borderWidth: 1,
          borderColor: dark ? '#a6a6a6' : '#000',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <Ionicons name="logo-google-playstore" size={height * 0.45} color={dark ? '#fff' : '#000'} />
        <Text style={{ color: dark ? '#fff' : '#000', fontSize: height * 0.3, fontWeight: '600' }}>Google Play</Text>
      </Pressable>
    </Link>
  );
}
