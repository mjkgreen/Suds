import * as Haptics from "expo-haptics";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { Avatar } from "@/components/common/Avatar";
import { PressableCard } from "@/components/common/Card";
import { MediaCarousel } from "@/components/common/MediaCarousel";
import { FEED_MEDIA_MAX_HEIGHT, getDrinkMedia } from "@/lib/media";
import { DrinkIcon } from "@/components/icons/DrinkIcon";
import { useLike } from "@/hooks/useLikes";
import { useLikers } from "@/hooks/useLikers";
import { useSessionMembers } from "@/hooks/useSessionMembers";
import { AvatarStack } from "@/components/social/AvatarStack";
import { LikersModal } from "@/components/social/LikersModal";
import { DRINK_TYPE_MAP } from "@/lib/constants";
import { groupDrinks } from "@/lib/drinkGroups";
import { drinkTotal } from "@/lib/drinkCounts";
import { shareLink } from "@/lib/share";
import { DrinkType, FeedItem, SessionFeedGroup } from "@/types/models";
import { formatDateTime, formatDuration } from "@/utils/dateHelpers";
import { formatMemberNames, getDisplayName, getUsername } from "@/utils/profileHelpers";
import { findBadgeById, TIER_COLORS } from "@/utils/badgeHelpers";

interface SessionCardProps {
  group: SessionFeedGroup;
  currentUserId?: string;
  isActive?: boolean;
  onEnd?: () => void;
  isEnding?: boolean;
  onQuickLog?: (item: FeedItem) => Promise<void>;
}

export const SessionCard = React.memo(function SessionCard({ group, currentUserId, isActive, onEnd, isEnding, onQuickLog }: SessionCardProps) {
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

  async function handleQuickLog(e: { stopPropagation: () => void }, groupKey: string, item: FeedItem) {
    e.stopPropagation();
    if (!onQuickLog || loggingId) return;
    setLoggingId(groupKey);
    try {
      await onQuickLog(item);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setLoggedId(groupKey);
      setTimeout(() => setLoggedId(null), 1500);
    } finally {
      setLoggingId(null);
    }
  }

  const hasCoMemberDrinks = group.items.some((i) => i.user_id !== group.profile.id);
  const { data: members } = useSessionMembers(
    hasCoMemberDrinks ? group.session_id : undefined,
    { staleTime: 5 * 60 * 1000 }
  );
  const coMembers = (members ?? []).filter((m) => m.user_id !== group.profile.id);

  // Alcoholic drinks by quantity — the same count as the profile and BAC.
  const totalQuantity = drinkTotal(group.items);
  // Same drink logged more than once (by anyone) shows as one line with a count.
  const drinkGroups = useMemo(() => (isActive ? groupDrinks(group.items) : []), [group.items, isActive]);
  const locations = [...new Set(group.items.map((i) => i.location_name).filter(Boolean))];
  const drinkTypes = [...new Set(group.items.map((i) => i.drink_type))];

  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    if (!isActive) return;
    setCurrentTime(new Date());
    const interval = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, [isActive]);

  // items are ordered newest-first; fall back to last drink time if session ended_at is missing
  const lastDrinkTime = group.items[0]?.logged_at;
  const endTime = isActive
    ? currentTime.toISOString()
    : (group.ended_at ?? lastDrinkTime ?? undefined);
  const duration = formatDuration(group.started_at, endTime);
  const hoursElapsed =
    (new Date(endTime ?? (isActive ? currentTime.toISOString() : lastDrinkTime ?? new Date())).getTime() -
      new Date(group.started_at).getTime()) /
    (1000 * 60 * 60);
  const drinksPerHour = hoursElapsed >= 0.25 && totalQuantity > 0 ? (totalQuantity / hoursElapsed).toFixed(1) : "—";

  const media = group.items.flatMap((i) => getDrinkMedia(i).slice(0, 1));

  return (
    <PressableCard
      className={`${Platform.OS === "web" ? "mx-4" : ""} my-2 p-4`}
      flush={Platform.OS !== "web"}
      onPress={() => router.push(`/session/${group.session_id}`)}
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
                    <MaterialCommunityIcons name={b.icon as any} size={10} color={TIER_COLORS[b.tier]} />
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

      {/* Co-members row */}
      {coMembers.length > 0 && (
        <View className="flex-row items-center gap-1.5 mb-2">
          <Ionicons name="people-outline" size={13} color="gray" />
          {coMembers.slice(0, 4).map((m, i) => (
            <View key={m.user_id} style={{ marginLeft: i > 0 ? -6 : 0 }}>
              <Avatar uri={m.avatar_url} name={m.display_name ?? m.username} size={22} />
            </View>
          ))}
          {coMembers.length > 4 && (
            <Text className="text-muted-foreground text-xs">+{coMembers.length - 4}</Text>
          )}
          <Text className="text-muted-foreground text-xs" numberOfLines={1}>
            {formatMemberNames(coMembers)}
          </Text>
        </View>
      )}

      {/* Stats row */}
      <View className="flex-row gap-4 mb-3">
        <View className="items-center">
          <Text className="text-xl font-bold text-primary">{totalQuantity}</Text>
          <Text className="text-xs text-muted-foreground">drinks</Text>
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
          // Sum quantities: one log of 2 beers is 2 beers, not 1.
          const count = group.items
            .filter((i) => i.drink_type === type)
            .reduce((sum, i) => sum + Number(i.quantity), 0);
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
      {media.length > 0 && (
        <MediaCarousel
          media={media}
          maxHeight={FEED_MEDIA_MAX_HEIGHT}
          borderRadius={10}
          style={{ marginTop: 8 }}
          visibilityKey={`session-${group.session_id}`}
        />
      )}

      {/* Expanded drink-by-drink list — active sessions only */}
      {isActive && (
        <View className="mt-3 border-t border-border pt-3 gap-2">
          {drinkGroups.map((dg) => {
            const item = dg.latest;
            const info = DRINK_TYPE_MAP[item.drink_type as DrinkType] ?? DRINK_TYPE_MAP["other"];
            const isLogging = loggingId === dg.key;
            const didLog = loggedId === dg.key;
            const sharedByOthers = dg.drinkers.some((p) => p.id !== currentUserId);
            return (
              <Pressable
                key={dg.key}
                className="flex-row items-center gap-2"
                onPress={(e) => {
                  e.stopPropagation();
                  // One log: open it. Several: the night out lists each one.
                  router.push(dg.items.length === 1 ? `/drink/${item.id}` : `/session/${group.session_id}`);
                }}
              >
                <DrinkIcon type={item.drink_type as DrinkType} size={20} color={info.color} />
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 flex-wrap">
                    <Text className="text-foreground text-sm font-medium">
                      {item.drink_name || info.label}
                      {dg.total !== 1 && (
                        <Text className="text-muted-foreground font-normal"> ×{dg.total}</Text>
                      )}
                    </Text>
                    {onQuickLog && (
                      <Pressable
                        onPress={(e) => handleQuickLog(e, dg.key, item)}
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
                  {sharedByOthers && (
                    <View className="flex-row items-center gap-1 mt-0.5">
                      {dg.drinkers.slice(0, 4).map((p, i) => (
                        <View key={p.id} style={{ marginLeft: i > 0 ? -4 : 0 }}>
                          <Avatar uri={p.avatar_url} name={getDisplayName(p)} size={14} />
                        </View>
                      ))}
                      <Text className="text-muted-foreground text-[11px]" numberOfLines={1}>
                        {dg.drinkers
                          .map((p) => (p.id === currentUserId ? "You" : getDisplayName(p)))
                          .join(", ")}
                      </Text>
                    </View>
                  )}
                  {item.location_name && (
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="location-outline" size={11} color="hsl(var(--muted-foreground))" />
                      <Text className="text-muted-foreground text-xs">{item.location_name}</Text>
                    </View>
                  )}
                  <Text className="text-muted-foreground text-xs mt-0.5">
                    {dg.items.length > 1 ? "Last " : ""}
                    {formatDateTime(item.logged_at)}
                  </Text>
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
            onPress={(e) => { e.stopPropagation(); router.push("/(tabs)/log"); }}
          >
            <Text className="text-primary-foreground font-semibold text-sm">+ Log a Drink</Text>
          </Pressable>
          <Pressable
            className="flex-1 bg-card border border-primary/30 rounded-xl py-2.5 items-center"
            onPress={(e) => { e.stopPropagation(); onEnd?.(); }}
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
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                shareLink(
                  `/session/${group.session_id}`,
                  `Check out ${getDisplayName(group.profile)}'s ${group.session_title ?? "night out"} on Suds`,
                );
              }}
              hitSlop={8}
              accessibilityLabel="Share"
            >
              <Ionicons name="paper-plane-outline" size={28} color="gray" />
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
});
