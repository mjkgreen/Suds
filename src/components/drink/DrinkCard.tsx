import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { Avatar } from '@/components/common/Avatar';
import { PressableCard } from '@/components/common/Card';
import { DrinkBadge } from '@/components/drink/DrinkBadge';
import { DRINK_TYPE_MAP } from '@/lib/constants';
import { FeedItem } from '@/types/models';
import { relativeTime } from '@/utils/dateHelpers';
import { getDisplayName, getUsername } from '@/utils/profileHelpers';

interface DrinkCardProps {
  item: FeedItem;
}

export function DrinkCard({ item }: DrinkCardProps) {
  const router = useRouter();
  const drinkInfo = DRINK_TYPE_MAP[item.drink_type] ?? DRINK_TYPE_MAP['other'];

  return (
    <PressableCard
      className="mx-4 my-2 p-4"
      onPress={() => router.push(`/drink/${item.id}`)}
    >
      {/* Header */}
      <View className="flex-row items-center mb-3">
        <Avatar
          uri={item.profile.avatar_url}
          name={getDisplayName(item.profile)}
          size={40}
        />
        <View className="ml-3 flex-1">
          <Text
            className="font-semibold text-gray-900 text-base"
            onPress={() => router.push(`/user/${item.profile.id}`)}
          >
            {getDisplayName(item.profile)}
          </Text>
          <Text className="text-gray-400 text-xs">
            @{getUsername(item.profile)} · {relativeTime(item.logged_at)}
          </Text>
        </View>
        <DrinkBadge type={item.drink_type} size="sm" />
      </View>

      {/* Drink info */}
      <View className="flex-row items-center mb-2">
        <Text className="text-2xl mr-2">{drinkInfo.emoji}</Text>
        <View className="flex-1">
          <Text className="text-gray-900 font-medium text-base">
            {item.drink_name || drinkInfo.label}
            {item.quantity !== 1 && (
              <Text className="text-gray-500 font-normal"> × {item.quantity}</Text>
            )}
          </Text>
          {item.location_name && (
            <View className="flex-row items-center mt-0.5">
              <Text className="text-gray-400 text-xs">📍 {item.location_name}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Notes */}
      {item.notes ? (
        <Text className="text-gray-600 text-sm mt-1">{item.notes}</Text>
      ) : null}

      {/* Photo */}
      {item.photo_url ? (
        <Image
          source={{ uri: item.photo_url }}
          style={{ height: 180, borderRadius: 12, marginTop: 10 }}
          contentFit="cover"
        />
      ) : null}
    </PressableCard>
  );
}
