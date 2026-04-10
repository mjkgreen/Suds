import * as Haptics from "expo-haptics";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { Avatar } from "@/components/common/Avatar";
import { PressableCard } from "@/components/common/Card";
import { ImageCarousel } from "@/components/common/ImageCarousel";
import { DrinkBadge } from "@/components/drink/DrinkBadge";
import { DrinkIcon } from "@/components/icons/DrinkIcon";
import { useLike } from "@/hooks/useLikes";
import { useLikers } from "@/hooks/useLikers";
import { AvatarStack } from "@/components/social/AvatarStack";
import { LikersModal } from "@/components/social/LikersModal";
import { DRINK_TYPE_MAP } from "@/lib/constants";
import { FeedItem } from "@/types/models";
import { relativeTime, formatTime } from "@/utils/dateHelpers";
import { getDisplayName, getUsername } from "@/utils/profileHelpers";
import { findBadgeById, TIER_COLORS } from "@/utils/badgeHelpers";

interface DrinkCardProps {
  item: FeedItem;
  currentUserId?: string;
  onQuickLog?: () => Promise<void>;
}

export function DrinkCard({ item, currentUserId, onQuickLog }: DrinkCardProps) {
  const router = useRouter();
  const drinkInfo = DRINK_TYPE_MAP[item.drink_type] ?? DRINK_TYPE_MAP["other"];
  const [isLogging, setIsLogging] = useState(false);
  const [didLog, setDidLog] = useState(false);
  // Optimistic like state
  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
  const [optimisticCount, setOptimisticCount] = useState<number | null>(null);
  const { like, unlike } = useLike(currentUserId);
  const [showLikers, setShowLikers] = useState(false);

  const userLiked = optimisticLiked ?? item.user_liked ?? false;
  const likeCount = optimisticCount ?? item.like_count ?? 0;
  const { data: likers } = useLikers(likeCount > 0 ? item.id : undefined);

  async function handleLike(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    if (!currentUserId) return;
    const nowLiked = !userLiked;
    setOptimisticLiked(nowLiked);
    setOptimisticCount(likeCount + (nowLiked ? 1 : -1));
    try {
      if (nowLiked) {
        await like.mutateAsync(item.id);
      } else {
        await unlike.mutateAsync(item.id);
      }
    } catch {
      // Revert on error
      setOptimisticLiked(!nowLiked);
      setOptimisticCount(likeCount);
    }
  }

  async function handleQuickLog(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    if (!onQuickLog || isLogging) return;
    setIsLogging(true);
    try {
      await onQuickLog();
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setDidLog(true);
      setTimeout(() => setDidLog(false), 1500);
    } finally {
      setIsLogging(false);
    }
  }

  let drinksPerHour: string | null = null;
  if (item.ended_at && item.quantity > 0) {
    const hoursElapsed = (new Date(item.ended_at).getTime() - new Date(item.logged_at).getTime()) / (1000 * 60 * 60);
    if (hoursElapsed >= 0.25) {
      drinksPerHour = (item.quantity / hoursElapsed).toFixed(1);
    }
  }

  return (
    <PressableCard
      className={`${Platform.OS === "web" ? "mx-4" : ""} my-2 p-4`}
      flush={Platform.OS !== "web"}
      onPress={() => router.push(`/drink/${item.id}`)}
    >
      {/* Header */}
      <View className="flex-row items-center mb-3">
        <Avatar uri={item.profile.avatar_url} name={getDisplayName(item.profile)} size={40} />
        <View className="ml-3 flex-1">
          <View className="flex-row items-center">
            <Text
              className="font-semibold text-foreground text-base"
              onPress={() => router.push(`/user/${item.profile.id}`)}
            >
              {getDisplayName(item.profile)}
            </Text>
            <View className="flex-row items-center ml-1.5 mt-0.5">
              {(item.profile.displayed_badges ?? []).map((id) => {
                const b = findBadgeById(id);
                if (!b) return null;
                return (
                  <View
                    key={id}
                    className="w-4 h-5 items-center justify-center border border-card -ml-1 first:ml-0 shadow-sm"
                    style={{
                      backgroundColor: TIER_COLORS[b.tier] + "40",
                      borderColor: TIER_COLORS[b.tier],
                      borderTopLeftRadius: 2,
                      borderTopRightRadius: 2,
                      borderBottomLeftRadius: 8,
                      borderBottomRightRadius: 8,
                    }}
                  >
                    <MaterialCommunityIcons name={b.icon as any} size={8} color={TIER_COLORS[b.tier]} />
                  </View>
                );
              })}
            </View>
          </View>
          <Text className="text-muted-foreground text-xs">
            @{getUsername(item.profile)} ·{" "}
            {item.ended_at
              ? `${formatTime(item.logged_at)} – ${formatTime(item.ended_at)}`
              : relativeTime(item.logged_at)}
          </Text>
        </View>
        <DrinkBadge type={item.drink_type} size="sm" />
      </View>

      {/* Drink info */}
      <View className="flex-row items-center mb-2">
        <View className="flex-1">
          <View className="flex-row items-center gap-1">
            <Text className="text-foreground  font-bold text-base mb-2">{item.event_name || drinkInfo.label}</Text>
          </View>
          {item.drink_name ? <Text className="text-foreground font-medium text-sm mb-1">{item.drink_name}</Text> : null}
          {item.brand && <Text className="text-muted-foreground font-bold text-base mb-2">{item.brand}</Text>}
          {/* Notes */}
          {item.notes ? <Text className="text-muted-foreground text-sm mt-1 mb-2">{item.notes}</Text> : null}

          <View className="flex-row gap-4">
            {item.quantity > 1 && (
              <View className="items-center mb-3">
                <Text className="text-xl font-bold text-primary">{item.quantity}</Text>
                <Text className="text-xs text-muted-foreground">drinks</Text>
              </View>
            )}
            {item.rating && (
              <View className="items-center mb-3">
                <Text className="text-xl font-bold text-primary">{item.rating}/10</Text>
                <Text className="text-xs text-muted-foreground">rating</Text>
              </View>
            )}
            {drinksPerHour && (
              <View className="items-center mb-3">
                <Text className="text-xl font-bold text-primary">{drinksPerHour}</Text>
                <Text className="text-xs text-muted-foreground">per hour</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Photo */}
      {item.photo_url ? <ImageCarousel images={[item.photo_url]} height={180} borderRadius={12} /> : null}
      <View className="flex-row items-center mt-2">
        {item.location_name && (
          <View className="flex-row items-center gap-1">
            <Ionicons name="location-outline" size={11} color="gray" />
            <Text className="text-muted-foreground text-xs">{item.location_name}</Text>
          </View>
        )}
      </View>
      {/* Social bar */}
      <View className="flex-row justify-evenly items-center gap-4 mt-3 pt-2 border-t border-border/50">
        <View className="flex-row items-center gap-1">
          <Pressable onPress={handleLike} className="flex-row items-center gap-1" hitSlop={8}>
            <Ionicons name={userLiked ? "heart" : "heart-outline"} size={30} color={userLiked ? "#ef4444" : "gray"} />
          </Pressable>
          {likeCount > 0 && likers && likers.length > 0 && (
            <AvatarStack
              profiles={likers}
              totalCount={likeCount}
              onPress={() => setShowLikers(true)}
              size={22}
              max={3}
            />
          )}
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            router.push(`/drink/${item.id}`);
          }}
          className="flex-row items-center gap-1"
          hitSlop={8}
        >
          <Ionicons name="chatbubble-outline" size={30} color="gray" />
          {(item.comment_count ?? 0) > 0 && <Text className="text-muted-foreground text-xs">{item.comment_count}</Text>}
        </Pressable>
      </View>
      <View className="flex-1">
        {onQuickLog && (
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
            <Text className="text-primary text-xs font-semibold">{didLog ? "Added!" : "+1"}</Text>
          </Pressable>
        )}
      </View>
      <LikersModal
        drinkLogId={item.id}
        visible={showLikers}
        onClose={() => setShowLikers(false)}
        currentUserId={currentUserId}
      />
    </PressableCard>
  );
}
