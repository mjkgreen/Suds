import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/common/Avatar';
import { DrinkIcon } from '@/components/icons/DrinkIcon';
import { DRINK_TYPE_MAP } from '@/lib/constants';
import { DrinkLogWithSessionAndProfile, DrinkType, Session, Profile } from '@/types/models';
import { formatDateTime } from '@/utils/dateHelpers';
import { getDisplayName, getUsername } from '@/utils/profileHelpers';

interface MapLocationSheetProps {
  items: DrinkLogWithSessionAndProfile[];
  onClose: () => void;
  onViewSession: (sessionId: string) => void;
  onViewDrink: (drinkId: string) => void;
}

interface LocationGroup {
  sessionId: string | null;
  items: DrinkLogWithSessionAndProfile[];
  session: Session | null | undefined;
  profile: Profile | undefined;
}

export function MapLocationSheet({ items, onClose, onViewSession, onViewDrink }: MapLocationSheetProps) {
  const groups: LocationGroup[] = useMemo(() => {
    const sessionMap = new Map<string, DrinkLogWithSessionAndProfile[]>();
    const standaloneItems: DrinkLogWithSessionAndProfile[] = [];

    for (const item of items) {
      if (item.session_id) {
        const existing = sessionMap.get(item.session_id) ?? [];
        sessionMap.set(item.session_id, [...existing, item]);
      } else {
        standaloneItems.push(item);
      }
    }

    const sessionGroups: LocationGroup[] = Array.from(sessionMap.entries()).map(
      ([sessionId, groupItems]) => ({
        sessionId,
        items: groupItems,
        session: groupItems[0]?.session,
        profile: groupItems[0]?.profile,
      }),
    );

    // Each standalone drink gets its own card so it's always visible with its own CTA
    const standaloneGroups: LocationGroup[] = standaloneItems.map((item) => ({
      sessionId: null,
      items: [item],
      session: null,
      profile: item.profile,
    }));

    return [...sessionGroups, ...standaloneGroups];
  }, [items]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Transparent backdrop — sits behind the sheet, dismisses on tap */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {/* Sheet — plain View so ScrollView receives scroll gestures unobstructed */}
        <View style={styles.sheet} className="bg-card">
          {/* Drag handle */}
          <View className="items-center pt-3 pb-2">
            <View style={styles.handle} className="bg-muted-foreground/30" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between px-4 pb-3">
            <Text className="text-foreground font-bold text-base">
              {items.length > 1 ? `${items.length} drinks at this spot` : 'At this spot'}
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close-circle" size={24} color="#9ca3af" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {groups.map((group, index) => (
              <View key={group.sessionId ?? `standalone-${group.items[0]?.id ?? index}`}>
                {index > 0 && <View className="h-px bg-border mx-4 my-3" />}
                <LocationGroupCard
                  group={group}
                  onViewSession={onViewSession}
                  onViewDrink={onViewDrink}
                />
              </View>
            ))}
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function LocationGroupCard({
  group,
  onViewSession,
  onViewDrink,
}: {
  group: LocationGroup;
  onViewSession: (id: string) => void;
  onViewDrink: (id: string) => void;
}) {
  const { sessionId, items, session, profile } = group;
  const firstItem = items[0];

  const typeCounts = items.reduce(
    (acc, item) => ({ ...acc, [item.drink_type]: (acc[item.drink_type] ?? 0) + item.quantity }),
    {} as Record<string, number>,
  );

  const locationName = items.find((i) => i.location_name)?.location_name;

  return (
    <View className="px-4">
      {/* Profile row */}
      {profile && (
        <View className="flex-row items-center gap-3 mb-3">
          <Avatar uri={profile.avatar_url} name={getDisplayName(profile)} size={38} />
          <View className="flex-1">
            <Text className="text-foreground font-semibold text-sm" numberOfLines={1}>
              {getDisplayName(profile)}
            </Text>
            <Text className="text-muted-foreground text-xs">
              @{getUsername(profile)} · {formatDateTime(firstItem.logged_at)}
            </Text>
          </View>
        </View>
      )}

      {/* Title: session name for nights out, drink name for standalone drinks */}
      {session ? (
        <View className="flex-row items-center gap-1.5 mb-2.5">
          <Ionicons name="moon" size={14} color="#f59e0b" />
          <Text className="text-foreground font-bold text-base flex-1" numberOfLines={1}>
            {session.title ?? 'Night Out'}
          </Text>
        </View>
      ) : firstItem.drink_name ? (
        <Text className="text-foreground font-bold text-base mb-2.5" numberOfLines={1}>
          {firstItem.drink_name}
        </Text>
      ) : null}

      {/* Drink type pills */}
      <View className="flex-row flex-wrap gap-1.5 mb-2.5">
        {Object.entries(typeCounts).map(([type, count]) => {
          const info = DRINK_TYPE_MAP[type as DrinkType] ?? DRINK_TYPE_MAP['other'];
          return (
            <View
              key={type}
              className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
              style={{ backgroundColor: info.color + '22' }}
            >
              <DrinkIcon type={type as DrinkType} size={13} color={info.color} />
              <Text className="text-xs font-semibold" style={{ color: info.color }}>
                ×{count}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Location */}
      {locationName && (
        <View className="flex-row items-center gap-1.5 mb-3">
          <Ionicons name="location-sharp" size={13} color="#6b7280" />
          <Text className="text-muted-foreground text-xs flex-1" numberOfLines={1}>
            {locationName}
          </Text>
        </View>
      )}

      {/* CTA — always present: session drinks → View Session, standalone → View Drink */}
      {sessionId ? (
        <Pressable
          onPress={() => onViewSession(sessionId)}
          className="bg-primary rounded-xl py-3 items-center flex-row justify-center gap-2 mb-1"
        >
          <Text className="text-primary-foreground font-semibold text-sm">View Session</Text>
          <Ionicons name="arrow-forward" size={15} color="white" />
        </Pressable>
      ) : (
        <Pressable
          onPress={() => onViewDrink(firstItem.id)}
          className="bg-primary rounded-xl py-3 items-center flex-row justify-center gap-2 mb-1"
        >
          <Text className="text-primary-foreground font-semibold text-sm">View Drink</Text>
          <Ionicons name="arrow-forward" size={15} color="white" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
});
