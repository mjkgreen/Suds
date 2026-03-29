import { Image, ImageStyle } from 'expo-image';
import React, { useState } from 'react';
import { Platform, StyleProp } from 'react-native';

interface RemoteImageProps {
  uri: string;
  style?: StyleProp<any>;
  height: number;
  borderRadius?: number;
}

/**
 * Cross-platform remote image component.
 * On web, renders a plain <img> tag to avoid OpaqueResponseBlocking / CORS issues.
 * On native, uses expo-image for optimal caching and performance.
 * Hides itself gracefully if the image fails to load (e.g. 404).
 */
export function RemoteImage({ uri, height, borderRadius = 0, style }: RemoteImageProps) {
  const [failed, setFailed] = useState(false);

  // Reset failed state if the URI changes (e.g. user updated the photo)
  React.useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (failed) return null;

  if (Platform.OS === 'web') {
    return (
      <img
        src={uri}
        style={{
          width: '100%',
          height,
          borderRadius,
          objectFit: 'cover',
          display: 'block',
          ...(style && typeof style === 'object' ? (style as any) : {}),
        }}
        alt=""
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <Image
      source={{ uri }}
      style={[{ width: '100%', height, borderRadius } as ImageStyle, style as ImageStyle]}
      contentFit="cover"
      onError={() => setFailed(true)}
    />
  );
}
