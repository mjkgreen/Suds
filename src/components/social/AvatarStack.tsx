import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Avatar } from '@/components/common/Avatar';
import { Profile } from '@/types/models';
import { getDisplayName } from '@/utils/profileHelpers';

interface AvatarStackProps {
  profiles: Profile[];
  totalCount: number;
  onPress: () => void;
  size?: number;
  max?: number;
}

export function AvatarStack({ profiles, totalCount, onPress, size = 24, max = 3 }: AvatarStackProps) {
  if (totalCount === 0) return null;

  const visible = profiles.slice(0, max);
  const overflow = totalCount - visible.length;

  return (
    <Pressable onPress={(e) => { e.stopPropagation(); onPress(); }} className="flex-row items-center" hitSlop={8}>
      <View className="flex-row">
        {visible.map((profile, i) => (
          <View
            key={profile.id}
            style={{
              marginLeft: i === 0 ? 0 : -(size * 0.35),
              zIndex: visible.length - i,
              borderRadius: size / 2,
              borderWidth: 1.5,
              borderColor: 'transparent',
            }}
          >
            <Avatar uri={profile.avatar_url} name={getDisplayName(profile)} size={size} />
          </View>
        ))}
        {overflow > 0 && (
          <View
            style={{
              marginLeft: -(size * 0.35),
              width: size,
              height: size,
              borderRadius: size / 2,
              zIndex: 0,
            }}
            className="bg-muted items-center justify-center"
          >
            <Text style={{ fontSize: size * 0.32 }} className="text-muted-foreground font-semibold">
              +{overflow}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
