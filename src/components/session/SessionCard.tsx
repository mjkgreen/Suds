import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Avatar } from '@/components/common/Avatar';
import { PressableCard } from '@/components/common/Card';
import { DRINK_TYPE_MAP } from '@/lib/constants';
import { DrinkType, SessionFeedGroup } from '@/types/models';
import { formatDateTime, formatDuration } from '@/utils/dateHelpers';
import { getDisplayName, getUsername } from '@/utils/profileHelpers';

interface SessionCardProps {
  group: SessionFeedGroup;
}

export function SessionCard({ group }: SessionCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const totalQuantity = group.items.reduce((s, i) => s + i.quantity, 0);
  const locations = [...new Set(group.items.map((i) => i.location_name).filter(Boolean))];
  const drinkTypes = [...new Set(group.items.map((i) => i.drink_type))];
  const duration = formatDuration(group.started_at, group.ended_at ?? undefined);

  return (
    <PressableCard className="mx-4 my-2 p-4" onPress={() => setExpanded((v) => !v)}>
      {/* Header */}
      <View className="flex-row items-center mb-3">
        <Avatar
          uri={group.profile.avatar_url}
          name={getDisplayName(group.profile)}
          size={40}
        />
        <View className="ml-3 flex-1">
          <Text
            className="font-semibold text-gray-900 text-base"
            onPress={() => router.push(`/user/${group.profile.id}`)}
          >
            {getDisplayName(group.profile)}
          </Text>
          <Text className="text-gray-400 text-xs">
            @{getUsername(group.profile)} · {formatDateTime(group.started_at)}
          </Text>
        </View>
        {/* Night out badge */}
        <View className="bg-amber-100 rounded-full px-3 py-1">
          <Text className="text-amber-700 text-xs font-semibold">🌙 Night Out</Text>
        </View>
      </View>

      {/* Session title */}
      <Text className="text-gray-900 font-bold text-base mb-2">
        {group.session_title ?? 'Night Out'}
      </Text>

      {/* Stats row */}
      <View className="flex-row gap-4 mb-3">
        <View className="items-center">
          <Text className="text-xl font-bold text-amber-500">{totalQuantity}</Text>
          <Text className="text-xs text-gray-400">drinks</Text>
        </View>
        <View className="items-center">
          <Text className="text-xl font-bold text-amber-500">{group.items.length}</Text>
          <Text className="text-xs text-gray-400">rounds</Text>
        </View>
        <View className="items-center">
          <Text className="text-xl font-bold text-amber-500">{duration}</Text>
          <Text className="text-xs text-gray-400">duration</Text>
        </View>
        {locations.length > 0 && (
          <View className="items-center">
            <Text className="text-xl font-bold text-amber-500">{locations.length}</Text>
            <Text className="text-xs text-gray-400">
              {locations.length === 1 ? 'spot' : 'spots'}
            </Text>
          </View>
        )}
      </View>

      {/* Drink type emojis */}
      <View className="flex-row gap-1 mb-2">
        {drinkTypes.map((type) => {
          const info = DRINK_TYPE_MAP[type as DrinkType] ?? DRINK_TYPE_MAP['other'];
          const count = group.items.filter((i) => i.drink_type === type).length;
          return (
            <View key={type} className="flex-row items-center bg-gray-100 rounded-full px-2 py-1 gap-1">
              <Text className="text-sm">{info.emoji}</Text>
              <Text className="text-xs text-gray-600 font-medium">×{count}</Text>
            </View>
          );
        })}
      </View>

      {/* Locations */}
      {locations.length > 0 && (
        <Text className="text-gray-400 text-xs" numberOfLines={1}>
          📍 {locations.join(' → ')}
        </Text>
      )}

      {/* Expanded drink-by-drink list */}
      {expanded && (
        <View className="mt-3 border-t border-gray-100 pt-3 gap-2">
          {group.items.map((item) => {
            const info = DRINK_TYPE_MAP[item.drink_type as DrinkType] ?? DRINK_TYPE_MAP['other'];
            return (
              <Pressable
                key={item.id}
                className="flex-row items-center gap-2"
                onPress={() => router.push(`/drink/${item.id}`)}
              >
                <Text className="text-lg">{info.emoji}</Text>
                <View className="flex-1">
                  <Text className="text-gray-800 text-sm font-medium">
                    {item.drink_name || info.label}
                    {item.quantity !== 1 && (
                      <Text className="text-gray-400 font-normal"> ×{item.quantity}</Text>
                    )}
                  </Text>
                  {item.location_name && (
                    <Text className="text-gray-400 text-xs">📍 {item.location_name}</Text>
                  )}
                </View>
                <Text className="text-gray-400 text-xs">{formatDateTime(item.logged_at)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Expand/collapse hint */}
      <Text className="text-amber-500 text-xs mt-2 text-center">
        {expanded ? '▲ Show less' : `▼ Show all ${group.items.length} drinks`}
      </Text>
    </PressableCard>
  );
}
