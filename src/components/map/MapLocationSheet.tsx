import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/common/Avatar';
import { DrinkIcon } from '@/components/icons/DrinkIcon';
import { DRINK_TYPE_MAP } from '@/lib/constants';
import { DrinkLogWithSessionAndProfile, DrinkType } from '@/types/models';
import { groupMapLocation, MapLocationEntry } from '@/lib/mapData';
import { formatDateTime } from '@/utils/dateHelpers';
import { getDisplayName, getUsername } from '@/utils/profileHelpers';

interface MapLocationSheetProps {
  items: DrinkLogWithSessionAndProfile[];
  onClose: () => void;
  onViewSession: (sessionId: string) => void;
  onViewDrink: (drinkId: string) => void;
}

export function MapLocationSheet({ items, onClose, onViewSession, onViewDrink }: MapLocationSheetProps) {
  const groups = useMemo(
    () =>
      groupMapLocation(
        items,
        (type) => (DRINK_TYPE_MAP[type as DrinkType] ?? DRINK_TYPE_MAP['other']).label,
        getDisplayName,
        getUsername,
      ),
    [items],
  );

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
              {items.length > 1 ? `${Math.round(items.reduce((sum, i) => sum + Number(i.quantity), 0) * 10) / 10} drinks at this spot` : 'At this spot'}
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close-circle" size={24} color="#9ca3af" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {groups.map((group, index) => (
              <View key={group.sessionId ?? `standalone-${group.items[0]?.id ?? index}`} style={{ marginTop: index > 0 ? 8 : 0 }}>
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

/**
 * One entry in the sheet. The whole card is the button: a night out opens the
 * night out, a single drink opens the drink.
 */
function LocationGroupCard({
  group,
  onViewSession,
  onViewDrink,
}: {
  group: MapLocationEntry;
  onViewSession: (id: string) => void;
  onViewDrink: (id: string) => void;
}) {
  const { sessionId, items, title, who, drinkers, typeCounts, loggedAt, locationName } = group;
  const firstItem = items[0];
  const session = !!sessionId;

  return (
    <Pressable
      onPress={() => (sessionId ? onViewSession(sessionId) : onViewDrink(firstItem.id))}
      className="mx-4 flex-row items-center gap-3 rounded-2xl bg-accent/60 px-3 py-3 active:opacity-70"
      accessibilityRole="button"
      accessibilityLabel={sessionId ? `View night out ${title}` : `View drink ${title}`}
    >
      {/* Avatars: one for a drink, stacked for a shared night out */}
      <View className="flex-row" style={{ width: drinkers.length > 1 ? 50 : 38 }}>
        {drinkers.slice(0, 2).map((p, i) => (
          <View key={p.id} style={{ marginLeft: i > 0 ? -26 : 0, marginTop: i > 0 ? 10 : 0 }}>
            <Avatar uri={p.avatar_url} name={getDisplayName(p)} size={i > 0 ? 28 : 38} />
          </View>
        ))}
      </View>

      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-1.5">
          {session && <Ionicons name="moon" size={13} color="#f59e0b" />}
          <Text className="text-foreground font-bold text-sm flex-1" numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View className="flex-row flex-wrap items-center gap-1">
          {Object.entries(typeCounts).map(([type, count]) => {
            const info = DRINK_TYPE_MAP[type as DrinkType] ?? DRINK_TYPE_MAP['other'];
            return (
              <View
                key={type}
                className="flex-row items-center gap-0.5 rounded-full px-1.5 py-0.5"
                style={{ backgroundColor: info.color + '22' }}
              >
                <DrinkIcon type={type as DrinkType} size={11} color={info.color} />
                <Text className="text-[11px] font-semibold" style={{ color: info.color }}>
                  ×{count}
                </Text>
              </View>
            );
          })}
        </View>

        <Text className="text-muted-foreground text-xs" numberOfLines={1}>
          {[who, formatDateTime(loggedAt), locationName].filter(Boolean).join(' · ')}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
    </Pressable>
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
