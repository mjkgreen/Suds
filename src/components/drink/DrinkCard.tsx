import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { Avatar } from '@/components/common/Avatar';
import { PressableCard } from '@/components/common/Card';
import { RemoteImage } from '@/components/common/RemoteImage';
import { DrinkBadge } from '@/components/drink/DrinkBadge';
import { DrinkIcon } from '@/components/icons/DrinkIcon';
import { DRINK_TYPE_MAP } from '@/lib/constants';
import { FeedItem } from '@/types/models';
import { relativeTime } from '@/utils/dateHelpers';
import { getDisplayName, getUsername } from '@/utils/profileHelpers';

interface DrinkCardProps {
  item: FeedItem;
  onQuickLog?: () => Promise<void>;
}

export function DrinkCard({ item, onQuickLog }: DrinkCardProps) {
  const router = useRouter();
  const drinkInfo = DRINK_TYPE_MAP[item.drink_type] ?? DRINK_TYPE_MAP['other'];
  const [isLogging, setIsLogging] = useState(false);
  const [didLog, setDidLog] = useState(false);

  async function handleQuickLog(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    if (!onQuickLog || isLogging) return;
    setIsLogging(true);
    try {
      await onQuickLog();
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setDidLog(true);
      setTimeout(() => setDidLog(false), 1500);
    } finally {
      setIsLogging(false);
    }
  }

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
            className="font-semibold text-foreground text-base"
            onPress={() => router.push(`/user/${item.profile.id}`)}
          >
            {getDisplayName(item.profile)}
          </Text>
          <Text className="text-muted-foreground text-xs">
            @{getUsername(item.profile)} · {relativeTime(item.logged_at)}
          </Text>
        </View>
        <DrinkBadge type={item.drink_type} size="sm" />
      </View>

      {/* Drink info */}
      <View className="flex-row items-center mb-2">
        <View
          style={{ backgroundColor: drinkInfo.color + '15' }}
          className="w-10 h-10 rounded-xl items-center justify-center mr-3"
        >
          <DrinkIcon type={item.drink_type} size={22} color={drinkInfo.color} />
        </View>
        <View className="flex-1">
          <Text className="text-foreground font-medium text-base">
            {item.drink_name || drinkInfo.label}
            {item.quantity !== 1 && (
              <Text className="text-muted-foreground font-normal"> × {item.quantity}</Text>
            )}
          </Text>
          {item.brand ? (
            <Text className="text-muted-foreground text-xs mt-0.5">{item.brand}</Text>
          ) : null}
          {item.location_name && (
            <View className="flex-row items-center mt-0.5 gap-1">
              <Ionicons name="location-outline" size={11} color="hsl(var(--muted-foreground))" />
              <Text className="text-muted-foreground text-xs">{item.location_name}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Notes */}
      {item.notes ? (
        <Text className="text-muted-foreground text-sm mt-1">{item.notes}</Text>
      ) : null}

      {/* Photo */}
      {item.photo_url ? (
        <RemoteImage
          uri={item.photo_url}
          height={180}
          borderRadius={12}
          style={{ marginTop: 10 }}
        />
      ) : null}

      {/* Quick log */}
      {onQuickLog && (
        <View className="flex-row justify-end mt-3 pt-2 border-t border-border/50">
          <Pressable
            onPress={handleQuickLog}
            disabled={isLogging}
            className="flex-row items-center gap-1.5 bg-primary/10 border border-primary/25 rounded-full px-3 py-1.5"
          >
            {isLogging ? (
              <ActivityIndicator size="small" color="#f59e0b" />
            ) : didLog ? (
              <Ionicons name="checkmark" size={14} color="#f59e0b" />
            ) : (
              <Ionicons name="add" size={14} color="#f59e0b" />
            )}
            <Text className="text-primary text-xs font-semibold">
              {didLog ? 'Added!' : '+1'}
            </Text>
          </Pressable>
        </View>
      )}
    </PressableCard>
  );
}
