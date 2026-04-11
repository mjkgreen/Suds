import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { Avatar } from "@/components/common/Avatar";
import { PressableCard } from "@/components/common/Card";
import { ImageCarousel } from "@/components/common/ImageCarousel";
import { DrinkIcon } from "@/components/icons/DrinkIcon";
import { useLike } from "@/hooks/useLikes";
import { useLikers } from "@/hooks/useLikers";
import { AvatarStack } from "@/components/social/AvatarStack";
import { LikersModal } from "@/components/social/LikersModal";
import { DRINK_TYPE_MAP } from "@/lib/constants";
import { DrinkType, FeedItem, SessionFeedGroup } from "@/types/models";
import { formatDateTime, formatDuration } from "@/utils/dateHelpers";
import { getDisplayName, getUsername } from "@/utils/profileHelpers";
import { findBadgeById, TIER_COLORS } from "@/utils/badgeHelpers";

interface SessionCardProps {
  group: SessionFeedGroup;
  currentUserId?: string;
  isActive?: boolean;
  onEnd?: () => void;
  isEnding?: boolean;
  onQuickLog?: (item: FeedItem) => Promise<void>;
}

export function SessionCard({ group, currentUserId, isActive, onEnd, isEnding, onQuickLog }: SessionCardProps) {
  const router = useRouter();
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [loggedId, setLoggedId] = useState<string | null>(null);
  // Use the oldest drink log as the representative for social interactions —
  // matches the session detail page which orders drinks ascending and reads drinks[0].
  const representativeItem = group.items[group.items.length - 1];
  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
  const [optimisticCount, setOptimisticCount] = useState<number | null>(null);
  const { like, unlike } = useLike(currentUserId);
  const [showLikers, setShowLikers] = useState(false);

  const userLiked = optimisticLiked ?? representativeItem?.user_liked ?? false;
  const likeCount = optimisticCount ?? representativeItem?.like_count ?? 0;
  const commentCount = representativeItem?.comment_count ?? 0;
  const { data: likers } = useLikers(likeCount > 0 ? representativeItem?.id : undefined);

  async function handleLike(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    if (!currentUserId || !representativeItem) return;
    const nowLiked = !userLiked;
    setOptimisticLiked(nowLiked);
    setOptimisticCount(likeCount + (nowLiked ? 1 : -1));
    try {
      if (nowLiked) {
        await like.mutateAsync(representativeItem.id);
      } else {
        await unlike.mutateAsync(representativeItem.id);
      }
    } catch {
      setOptimisticLiked(!nowLiked);
      setOptimisticCount(likeCount);
    }
  }

  async function handleQuickLog(e: { stopPropagation: () => void }, item: FeedItem) {
    e.stopPropagation();
    if (!onQuickLog || loggingId) return;
    setLoggingId(item.id);
    try {
      await onQuickLog(item);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setLoggedId(item.id);
      setTimeout(() => setLoggedId(null), 1500);
    } finally {
      setLoggingId(null);
    }
  }

  const totalQuantity = group.items.reduce((s, i) => s + i.quantity, 0);
  const locations = [...new Set(group.items.map((i) => i.location_name).filter(Boolean))];
  const drinkTypes = [...new Set(group.items.map((i) => i.drink_type))];
  const duration = formatDuration(group.started_at, group.ended_at ?? undefined);
  const hoursElapsed =
    ((group.ended_at ? new Date(group.ended_at) : new Date()).getTime() - new Date(group.started_at).getTime()) /
    (1000 * 60 * 60);
  const drinksPerHour = hoursElapsed >= 0.25 && totalQuantity > 0 ? (totalQuantity / hoursElapsed).toFixed(1) : "—";

  const photos = group.items.map((i) => i.photo_url).filter(Boolean) as string[];

  return (
    <PressableCard
      className={`${Platform.OS === "web" ? "mx-4" : ""} my-2 p-4`}
      flush={Platform.OS !== "web"}
      onPress={isActive ? undefined : () => router.push(`/session/${group.session_id}`)}
    >
      {/* Active in-progress banner */}
      {isActive && (
        <View className="flex-row items-center gap-2 mb-3">
          <View className="w-2 h-2 rounded-full bg-primary" />
          <Text className="text-primary text-xs font-semibold flex-1">Night out in progress</Text>
        </View>
      )}

      {/* Header */}
      <View className="flex-row items-center mb-3">
        <Avatar uri={group.profile.avatar_url} name={getDisplayName(group.profile)} size={40} />
        <View className="ml-3 flex-1">
          <View className="flex-row items-center">
            <Text
              className="font-semibold text-foreground text-base"
              onPress={() => router.push(`/user/${group.profile.id}`)}
            >
              {getDisplayName(group.profile)}
            </Text>
            <View className="flex-row items-center ml-1.5 mt-0.5">
              {(group.profile.displayed_badges ?? []).map((id) => {
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
                    <Ionicons name={b.icon as any} size={10} color={TIER_COLORS[b.tier]} />
                  </View>
                );
              })}
            </View>
          </View>
          <Text className="text-muted-foreground text-xs">
            @{getUsername(group.profile)} · {formatDateTime(group.started_at)}
          </Text>
        </View>
        {!isActive && (
          <View className="bg-primary/10 rounded-full px-3 py-1 border border-primary/20 flex-row items-center gap-1">
            <Ionicons name="moon" size={12} color="#f59e0b" />
            <Text className="text-primary text-xs font-semibold">Night Out</Text>
          </View>
        )}
      </View>

      {/* Session title */}
      <Text className="text-foreground font-bold text-base mb-2">{group.session_title ?? "Night Out"}</Text>

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
        <View className="items-center">
          <Text className="text-xl font-bold text-primary">{drinksPerHour}</Text>
          <Text className="text-xs text-muted-foreground">per hour</Text>
        </View>
        {locations.length > 0 && (
          <View className="items-center">
            <Text className="text-xl font-bold text-primary">{locations.length}</Text>
            <Text className="text-xs text-muted-foreground">{locations.length === 1 ? "spot" : "spots"}</Text>
          </View>
        )}
      </View>

      {/* Drink type emojis */}
      <View className="flex-row gap-1 mb-2">
        {drinkTypes.map((type) => {
          const info = DRINK_TYPE_MAP[type as DrinkType] ?? DRINK_TYPE_MAP["other"];
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
          <Ionicons name="location-outline" size={12} color="gray" />
          <Text className="text-muted-foreground text-xs" numberOfLines={1}>
            {locations.join(" → ")}
          </Text>
        </View>
      )}

      {/* Photos from drinks */}
      {photos.length > 0 && <ImageCarousel images={photos} height={180} borderRadius={10} style={{ marginTop: 8 }} />}

      {/* Expanded drink-by-drink list — active sessions only */}
      {isActive && (
        <View className="mt-3 border-t border-border pt-3 gap-2">
          {group.items.map((item) => {
            const info = DRINK_TYPE_MAP[item.drink_type as DrinkType] ?? DRINK_TYPE_MAP["other"];
            const isLogging = loggingId === item.id;
            const didLog = loggedId === item.id;
            return (
              <Pressable
                key={item.id}
                className="flex-row items-center gap-2"
                onPress={() => router.push(`/drink/${item.id}`)}
              >
                <DrinkIcon type={item.drink_type as DrinkType} size={20} color={info.color} />
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 flex-wrap">
                    <Text className="text-foreground text-sm font-medium">
                      {item.drink_name || info.label}
                      {item.quantity !== 1 && (
                        <Text className="text-muted-foreground font-normal"> ×{item.quantity}</Text>
                      )}
                    </Text>
                    {onQuickLog && (
                      <Pressable
                        onPress={(e) => handleQuickLog(e, item)}
                        disabled={!!loggingId}
                        className="flex-row items-center gap-1 bg-primary/10 border border-primary/25 rounded-full px-2 py-0.5"
                      >
                        {isLogging ? (
                          <ActivityIndicator size="small" color="#f59e0b" />
                        ) : didLog ? (
                          <Ionicons name="checkmark" size={11} color="#f59e0b" />
                        ) : (
                          <Ionicons name="add" size={11} color="#f59e0b" />
                        )}
                        <Text className="text-primary text-xs font-semibold">{didLog ? "Added!" : "+1"}</Text>
                      </Pressable>
                    )}
                  </View>
                  {item.location_name && (
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="location-outline" size={11} color="hsl(var(--muted-foreground))" />
                      <Text className="text-muted-foreground text-xs">{item.location_name}</Text>
                    </View>
                  )}
                  <Text className="text-muted-foreground text-xs mt-0.5">{formatDateTime(item.logged_at)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* View details hint — past sessions */}
      {!isActive && (
        <View className="flex-row items-center justify-center gap-1 mt-2">
          <Ionicons name="chevron-forward" size={14} color="hsl(var(--primary))" />
          <Text className="text-primary text-xs font-medium">View details</Text>
        </View>
      )}

      {/* Active session actions */}
      {isActive && (
        <View className="flex-row gap-2 mt-3 pt-3 border-t border-border/50">
          <Pressable
            className="flex-1 bg-primary rounded-xl py-2.5 items-center"
            onPress={() => router.push("/(tabs)/log")}
          >
            <Text className="text-primary-foreground font-semibold text-sm">+ Log a Drink</Text>
          </Pressable>
          <Pressable
            className="flex-1 bg-card border border-primary/30 rounded-xl py-2.5 items-center"
            onPress={onEnd}
            disabled={isEnding}
          >
            <Text className="text-primary font-semibold text-sm">{isEnding ? "Ending…" : "End Night Out"}</Text>
          </Pressable>
        </View>
      )}

      {/* Social bar */}
      {representativeItem && (
        <>
          <View className="flex-row justify-evenly items-center gap-4 mt-3 pt-2 border-t border-border/50">
            <View className="flex-row items-center gap-1">
              <Pressable onPress={handleLike} className="flex-row items-center gap-1" hitSlop={8}>
                <Ionicons
                  name={userLiked ? "heart" : "heart-outline"}
                  size={30}
                  color={userLiked ? "#ef4444" : "gray"}
                />
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
                router.push(`/session/${group.session_id}`);
              }}
              className="flex-row items-center gap-1"
              hitSlop={8}
            >
              <Ionicons name="chatbubble-outline" size={30} color="gray" />
              {commentCount > 0 && <Text className="text-muted-foreground text-xs">{commentCount}</Text>}
            </Pressable>
          </View>
          <LikersModal
            drinkLogId={representativeItem.id}
            visible={showLikers}
            onClose={() => setShowLikers(false)}
            currentUserId={currentUserId}
          />
        </>
      )}
    </PressableCard>
  );
}
