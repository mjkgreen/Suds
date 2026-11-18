import { Link } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable } from 'react-native';

export const APP_STORE_URL = 'https://apps.apple.com/app/suds-alcohol-tracker/id6761397970';

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
