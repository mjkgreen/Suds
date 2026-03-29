import { Image } from 'expo-image';
import React from 'react';
import { Text, View } from 'react-native';

interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number;
}

export function Avatar({ uri, name, size = 40 }: AvatarProps) {
  const initials = name
    ? name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  const fontSize = Math.round(size * 0.38);

  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="bg-amber-200 items-center justify-center overflow-hidden"
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          contentFit="cover"
        />
      ) : (
        <Text
          style={{ fontSize }}
          className="text-amber-800 font-bold"
        >
          {initials}
        </Text>
      )}
    </View>
  );
}
