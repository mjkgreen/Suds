import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Avatar } from '@/components/common/Avatar';
import { PressableCard } from '@/components/common/Card';
import { DrinkIcon } from '@/components/icons/DrinkIcon';
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
            className="font-semibold text-foreground text-base"
            onPress={() => router.push(`/user/${group.profile.id}`)}
          >
            {getDisplayName(group.profile)}
          </Text>
          <Text className="text-muted-foreground text-xs">
            @{getUsername(group.profile)} · {formatDateTime(group.started_at)}
          </Text>
        </View>
        {/* Night out badge */}
        <View className="bg-primary/10 rounded-full px-3 py-1 border border-primary/20 flex-row items-center gap-1">
          <Ionicons name="moon" size={12} color="#f59e0b" />
          <Text className="text-primary text-xs font-semibold">Night Out</Text>
        </View>
      </View>

      {/* Session title */}
      <Text className="text-foreground font-bold text-base mb-2">
        {group.session_title ?? 'Night Out'}
      </Text>

      {/* Stats row */}
      <View className="flex-row gap-4 mb-3">
        <View className="items-center">
          <Text className="text-xl font-bold text-primary">{totalQuantity}</Text>
          <Text className="text-xs text-muted-foreground">drinks</Text>
        </View>
        <View className="items-center">
          <Text className="text-xl font-bold text-primary">{group.items.length}</Text>
          <Text className="text-xs text-muted-foreground">rounds</Text>
        </View>
        <View className="items-center">
          <Text className="text-xl font-bold text-primary">{duration}</Text>
          <Text className="text-xs text-muted-foreground">duration</Text>
        </View>
        {locations.length > 0 && (
          <View className="items-center">
            <Text className="text-xl font-bold text-primary">{locations.length}</Text>
            <Text className="text-xs text-muted-foreground">
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
            <View key={type} className="flex-row items-center bg-accent rounded-full px-2 py-1 gap-1">
              <DrinkIcon type={type as DrinkType} size={16} color={info.color} />
              <Text className="text-xs text-muted-foreground font-medium">×{count}</Text>
            </View>
          );
        })}
      </View>

      {/* Locations */}
      {locations.length > 0 && (
        <View className="flex-row items-center gap-1">
          <Ionicons name="location-outline" size={12} color="hsl(var(--muted-foreground))" />
          <Text className="text-muted-foreground text-xs" numberOfLines={1}>
            {locations.join(' → ')}
          </Text>
        </View>
      )}

      {/* Expanded drink-by-drink list */}
      {expanded && (
        <View className="mt-3 border-t border-border pt-3 gap-2">
          {group.items.map((item) => {
            const info = DRINK_TYPE_MAP[item.drink_type as DrinkType] ?? DRINK_TYPE_MAP['other'];
            return (
              <Pressable
                key={item.id}
                className="flex-row items-center gap-2"
                onPress={() => router.push(`/drink/${item.id}`)}
              >
                <DrinkIcon type={item.drink_type as DrinkType} size={20} color={info.color} />
                <View className="flex-1">
                  <Text className="text-foreground text-sm font-medium">
                    {item.drink_name || info.label}
                    {item.quantity !== 1 && (
                      <Text className="text-muted-foreground font-normal"> ×{item.quantity}</Text>
                    )}
                  </Text>
                  {item.location_name && (
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="location-outline" size={11} color="hsl(var(--muted-foreground))" />
                      <Text className="text-muted-foreground text-xs">{item.location_name}</Text>
                    </View>
                  )}
                </View>
                <Text className="text-muted-foreground text-xs">{formatDateTime(item.logged_at)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Expand/collapse hint */}
      <View className="flex-row items-center justify-center gap-1 mt-2">
        <Ionicons 
          name={expanded ? 'chevron-up' : 'chevron-down'} 
          size={14} 
          color="hsl(var(--primary))" 
        />
        <Text className="text-primary text-xs font-medium">
          {expanded ? 'Show less' : `Show all ${group.items.length} drinks`}
        </Text>
      </View>
    </PressableCard>
  );
}
