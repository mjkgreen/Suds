import Head from "expo-router/head";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "@/components/common/Avatar";
import { DrinkBadge } from "@/components/drink/DrinkBadge";
import { PremiumGate } from "@/components/common/PremiumGate";
import { AdvancedStatsCard } from "@/components/profile/AdvancedStatsCard";
import { BACEstimator } from "@/components/profile/BACEstimator";
import { AdvancedStatsPreview, BACEstimatorPreview, TopDrinksPreview } from "@/components/profile/PremiumPreviews";
import { GoalCard } from "@/components/profile/GoalCard";
import { MilestoneBanner } from "@/components/profile/MilestoneBanner";
import { BadgePicker } from "@/components/profile/BadgePicker";
import { ActivityCalendar } from "@/components/profile/ActivityCalendar";
import { useAuth } from "@/hooks/useAuth";
import { useMyFeed } from "@/hooks/useFeed";
import { useMilestones } from "@/hooks/useMilestones";
import { useProfile, useUserStats, useUpdateProfile } from "@/hooks/useProfile";
import { useStreaks } from "@/hooks/useStreaks";
import { useAuthStore } from "@/stores/authStore";
import { useActiveSession, useEndSession } from "@/hooks/useSession";
import { DrinkType, FeedEntry } from "@/types/models";
import { getDisplayName, getUsername } from "@/utils/profileHelpers";
import { getEarnedBadges, findBadgeById, UserBadge, TIER_COLORS } from "@/utils/badgeHelpers";
import { BadgeInfoModal } from "@/components/profile/BadgeInfoModal";
import { DrinkCard } from "@/components/drink/DrinkCard";
import { SessionCard } from "@/components/session/SessionCard";
import { DrinkIcon } from "@/components/icons/DrinkIcon";
import { TrendLine } from "@/components/profile/TrendLine";
import { DRINK_TYPE_MAP, MILESTONE_EMOJI } from "@/lib/constants";
import { useThemeStore } from "@/stores/themeStore";
import { usePrefsStore } from "@/stores/prefsStore";
import { useColorScheme } from "nativewind";

type Tab = "progress" | "activities";

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="flex-1 items-center">
      <Text className="text-2xl font-bold text-foreground">{value}</Text>
      <Text className="text-xs text-muted-foreground mt-0.5">{label}</Text>
    </View>
  );
}

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <View className="flex-row bg-card border-b border-border px-6">
      {(["progress", "activities"] as Tab[]).map((tab) => (
        <Pressable key={tab} onPress={() => onChange(tab)} className="mr-6 py-3">
          <Text
            className={active === tab ? "font-bold text-primary text-sm" : "font-medium text-muted-foreground text-sm"}
          >
            {tab === "progress" ? "Progress" : "Activities"}
          </Text>
          {active === tab && <View className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
        </Pressable>
      ))}
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isPremium } = useAuthStore();
  const activeSession = useActiveSession();
  const topEdges = activeSession ? [] : ["top" as const];
  const { signOut } = useAuth();
  const { mutateAsync: endSession, isPending: isEnding } = useEndSession();
  const [activeTab, setActiveTab] = useState<Tab>("progress");
  const [badgePickerVisible, setBadgePickerVisible] = useState(false);
  const [badgeInfoVisible, setBadgeInfoVisible] = useState(false);

  const { themePreference, setThemePreference } = useThemeStore();
  const { locationEnabled, setLocationEnabled } = usePrefsStore();
  const { colorScheme } = useColorScheme();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 1024;

  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useProfile(user?.id);
  const { data: stats, refetch: refetchStats } = useUserStats(user?.id);
  const { data: streaks } = useStreaks(user?.id);
  const { data: milestones } = useMilestones(user?.id);
  const { mutate: updateProfile } = useUpdateProfile();

  const {
    data: feedData,
    isLoading: feedLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchFeed,
  } = useMyFeed(user?.id);

  const myEntries = useMemo<FeedEntry[]>(
    () => feedData?.pages.flatMap((p) => p.entries) ?? [],
    [feedData],
  );

  const earnedBadges = getEarnedBadges(milestones, streaks, stats);
  const selectedBadgeIds =
    profile?.displayed_badges ?? (milestones?.latest_milestone ? [`milestone-${milestones.latest_milestone}`] : []);
  const selectedBadges = selectedBadgeIds.map(findBadgeById).filter(Boolean) as UserBadge[];

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderActivityItem = useCallback(({ item: entry }: { item: FeedEntry }) => {
    if (entry.type === "session") {
      const isActive = !!activeSession && entry.session_id === activeSession.id;
      return (
        <SessionCard
          group={entry}
          isActive={isActive}
          onEnd={isActive ? () => endSession(activeSession!.id) : undefined}
          isEnding={isActive ? isEnding : undefined}
        />
      );
    }
    return <DrinkCard item={entry.item} />;
  }, [activeSession, endSession, isEnding]);

  const onRefresh = useCallback(() => {
    refetchProfile();
    refetchFeed();
    refetchStats();
  }, [refetchProfile, refetchFeed, refetchStats]);

  const isLoading = profileLoading || feedLoading;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#f59e0b" />
      </SafeAreaView>
    );
  }

  const badgeNodes = (
    <Pressable style={{ flexDirection: "row", alignItems: "center", gap: 4 }} onPress={() => setBadgeInfoVisible(true)}>
      {selectedBadges.map((b) => (
        <View
          key={b.id}
          style={{
            width: 28, height: 36,
            alignItems: "center", justifyContent: "center",
            borderWidth: 2,
            backgroundColor: TIER_COLORS[b.tier] + "40",
            borderColor: TIER_COLORS[b.tier],
            borderTopLeftRadius: 4, borderTopRightRadius: 4,
            borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
          }}
        >
          <MaterialCommunityIcons name={b.icon as any} size={12} color={TIER_COLORS[b.tier]} />
        </View>
      ))}
      {selectedBadges.length === 0 && (
        <View
          style={{
            width: 28, height: 36,
            alignItems: "center", justifyContent: "center",
            borderWidth: 2, borderStyle: "dashed",
            borderColor: colorScheme === "dark" ? "#4b5563" : "#d1d5db",
            borderTopLeftRadius: 4, borderTopRightRadius: 4,
            borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
          }}
        >
          <Ionicons name="add" size={14} color="#6b7280" />
        </View>
      )}
    </Pressable>
  );

  const profileHeader = useMemo(() => {
    if (isDesktop) {
      return (
        <View className="bg-card border-b border-border" style={{ paddingHorizontal: 24, paddingVertical: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            {/* Avatar with Plus badge */}
            <View style={{ position: "relative" }}>
              <Avatar uri={profile?.avatar_url} name={profile ? getDisplayName(profile) : "User"} size={52} />
              {isPremium && (
                <View style={{
                  position: "absolute", bottom: -4, right: -4,
                  backgroundColor: "#f59e0b", borderRadius: 6,
                  paddingHorizontal: 4, paddingVertical: 1,
                }}>
                  <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}>Plus</Text>
                </View>
              )}
            </View>

            {/* Name + username + bio */}
            <View style={{ gap: 1 }}>
              <Text className="text-foreground font-bold text-base">{profile ? getDisplayName(profile) : "User"}</Text>
              <Text className="text-muted-foreground text-xs">@{profile ? getUsername(profile) : "unknown"}</Text>
              {profile?.bio && (
                <Text className="text-muted-foreground text-xs" numberOfLines={1}>{profile.bio}</Text>
              )}
            </View>

            <View style={{ flex: 1 }} />

            {/* Followers · Following */}
            <View style={{ flexDirection: "row", gap: 20 }}>
              <Pressable onPress={() => user?.id && router.push(`/user/${user.id}/followers`)}>
                <Text className="text-muted-foreground text-sm">
                  <Text className="font-bold text-foreground">{profile?.followers_count ?? 0}</Text> Followers
                </Text>
              </Pressable>
              <Pressable onPress={() => user?.id && router.push(`/user/${user.id}/following`)}>
                <Text className="text-muted-foreground text-sm">
                  <Text className="font-bold text-foreground">{profile?.following_count ?? 0}</Text> Following
                </Text>
              </Pressable>
            </View>

            {/* Sober streak */}
            {streaks && streaks.sober_streak > 0 && (
              <View
                style={{
                  flexDirection: "row", alignItems: "center", gap: 4,
                  borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3,
                  backgroundColor: colorScheme === "dark" ? "#1e3a5f" : "#eff6ff",
                  borderWidth: 1,
                  borderColor: colorScheme === "dark" ? "#2563eb" : "#bfdbfe",
                }}
              >
                <Text style={{ fontSize: 11 }}>💧</Text>
                <Text style={{ fontSize: 11, fontWeight: "600", color: colorScheme === "dark" ? "#93c5fd" : "#2563eb" }}>
                  {streaks.sober_streak}d sober
                </Text>
              </View>
            )}

            {/* Badges */}
            {badgeNodes}

            {/* Action buttons */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              {!isPremium && (
                <Pressable className="bg-primary rounded-xl px-3 py-1.5" onPress={() => router.push("/paywall")}>
                  <Text className="text-primary-foreground font-bold text-xs">Upgrade</Text>
                </Pressable>
              )}
              <Pressable className="bg-accent rounded-xl p-2" onPress={() => router.push("/user/edit")}>
                <Ionicons name="pencil-sharp" size={16} color="#6b7280" />
              </Pressable>
              <Pressable className="bg-accent rounded-xl p-2" onPress={() => router.push("/user/settings")}>
                <Ionicons name="settings-outline" size={16} color="#6b7280" />
              </Pressable>
              <Pressable className="bg-accent rounded-xl p-2" onPress={signOut}>
                <Ionicons name="log-out-outline" size={16} color="#6b7280" />
              </Pressable>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View className="bg-card px-6 pt-6 pb-5 border-b border-border">
        <View className="flex-row items-start justify-between mb-4">
          <View className="flex-row items-center gap-2">
            <Avatar uri={profile?.avatar_url} name={profile ? getDisplayName(profile) : "User"} size={72} />
            {isPremium && (
              <View className="bg-primary rounded-full px-2 py-0.5 self-start mt-1">
                <Text className="text-primary-foreground text-xs font-bold">Plus</Text>
              </View>
            )}
          </View>
          <View className="flex-row gap-2">
            {!isPremium && (
              <Pressable className="bg-primary rounded-xl px-4 py-2" onPress={() => router.push("/paywall")}>
                <Text className="text-primary-foreground font-bold text-sm">Upgrade</Text>
              </Pressable>
            )}
            <Pressable className="bg-accent rounded-xl p-2" onPress={() => router.push("/user/edit")}>
              <Ionicons name="pencil-sharp" size={20} color="#6b7280" />
            </Pressable>
            <Pressable className="bg-accent rounded-xl p-2" onPress={() => router.push("/user/settings")}>
              <Ionicons name="settings-outline" size={20} color="#6b7280" />
            </Pressable>
            <Pressable className="bg-accent rounded-xl p-2" onPress={signOut}>
              <Ionicons name="log-out-outline" size={20} color="#6b7280" />
            </Pressable>
          </View>
        </View>

        <Text className="text-xl font-bold text-foreground">{profile ? getDisplayName(profile) : "User"}</Text>
        <Text className="text-muted-foreground text-sm">@{profile ? getUsername(profile) : "unknown"}</Text>
        {profile?.bio && <Text className="text-muted-foreground text-sm mt-2">{profile.bio}</Text>}

        <View className="flex-row items-center justify-between mt-3">
          <View className="flex-row gap-6">
            <Pressable onPress={() => user?.id && router.push(`/user/${user.id}/followers`)}>
              <Text className="text-muted-foreground text-sm">
                <Text className="font-bold text-foreground">{profile?.followers_count ?? 0}</Text> Followers
              </Text>
            </Pressable>
            <Pressable onPress={() => user?.id && router.push(`/user/${user.id}/following`)}>
              <Text className="text-muted-foreground text-sm">
                <Text className="font-bold text-foreground">{profile?.following_count ?? 0}</Text> Following
              </Text>
            </Pressable>
          </View>

          <View className="gap-1.5">
            {streaks && streaks.sober_streak > 0 && (
              <View
                className="flex-row items-center gap-1 self-start rounded-full px-2 py-0.5"
                style={{
                  backgroundColor: colorScheme === "dark" ? "#1e3a5f" : "#eff6ff",
                  borderWidth: 1,
                  borderColor: colorScheme === "dark" ? "#2563eb" : "#bfdbfe",
                }}
              >
                <Text className="text-xs">💧</Text>
                <Text
                  className="text-xs font-semibold"
                  style={{ color: colorScheme === "dark" ? "#93c5fd" : "#2563eb" }}
                >
                  {streaks.sober_streak}d sober
                </Text>
              </View>
            )}
            {badgeNodes}
          </View>
        </View>
      </View>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, isPremium, streaks, badgeNodes, user?.id, colorScheme, signOut, isDesktop]);

  const badgePicker = (
    <>
      <BadgePicker
        isVisible={badgePickerVisible}
        onClose={() => setBadgePickerVisible(false)}
        earnedBadges={earnedBadges}
        selectedBadgeIds={selectedBadgeIds}
        onSelect={(ids) => user?.id && updateProfile({ userId: user.id, updates: { displayed_badges: ids } })}
      />
      <BadgeInfoModal
        badges={selectedBadges}
        isVisible={badgeInfoVisible}
        onClose={() => setBadgeInfoVisible(false)}
        onEdit={() => {
          setBadgeInfoVisible(false);
          setBadgePickerVisible(true);
        }}
      />
    </>
  );

  if (isDesktop) {
    const borderColor = colorScheme === "dark" ? "#1f2937" : "#e5e7eb";
    return (
      <>
        <Head>
          <title>Profile | Suds</title>
        </Head>
        <SafeAreaView className="flex-1 bg-background" edges={topEdges}>
          {profileHeader}
          {badgePicker}
          <View style={{ flex: 1, flexDirection: "row", maxWidth: 1400, width: "100%", alignSelf: "center", paddingHorizontal: 24 }}>
            {/* Left: Activities feed */}
            <View style={{ flex: 3 }}>
              <FlatList
                data={myEntries}
                keyExtractor={(entry) =>
                  entry.type === "session" ? `session-${entry.session_id}` : `drink-${entry.item.id}`
                }
                renderItem={renderActivityItem}
                refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor="#f59e0b" />}
                ListHeaderComponent={
                  <View className="px-4 pt-4 pb-2">
                    <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Activities</Text>
                  </View>
                }
                ListEmptyComponent={
                  <View className="px-6 py-10 items-center">
                    <Text className="text-3xl mb-2">🍺</Text>
                    <Text className="text-muted-foreground text-center">No drinks logged yet. Crack one open!</Text>
                  </View>
                }
                ListFooterComponent={
                  isFetchingNextPage ? (
                    <View className="py-4 items-center">
                      <ActivityIndicator color="#f59e0b" />
                    </View>
                  ) : null
                }
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.4}
                contentContainerStyle={{ paddingBottom: 24 }}
              />
            </View>

            {/* Right: Progress stats */}
            <View style={{ flex: 2, borderLeftWidth: 1, borderLeftColor: borderColor }}>
              <ScrollView
                contentContainerStyle={{ paddingBottom: 24 }}
                refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor="#f59e0b" />}
              >
                <View className="px-4 pt-4 pb-2">
                  <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Progress</Text>
                </View>

                {stats && user?.id && <GoalCard userId={user.id} stats={stats} />}

                {stats && (
                  <View className="bg-card mx-4 mt-4 rounded-2xl p-4 gap-4">
                    <View className="flex-row">
                      <StatBlock label="Total" value={stats.total_drinks} />
                      <View className="w-px bg-border" />
                      <StatBlock label="This Week" value={stats.drinks_this_week} />
                      <View className="w-px bg-border" />
                      <StatBlock label="This Month" value={stats.drinks_this_month} />
                    </View>

                    {stats.activity_by_day?.length > 0 && (
                      <View className="pt-2">
                        <Text className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
                          Last 14 Days
                        </Text>
                        <TrendLine data={stats.activity_by_day.slice(-14)} isDark={colorScheme === "dark"} />
                      </View>
                    )}

                    <View className="pt-2">
                      {stats.activity_by_day?.length > 0 && <ActivityCalendar activityByDay={stats.activity_by_day} />}
                    </View>
                  </View>
                )}

                <PremiumGate featureName="Top Drinks" preview={<TopDrinksPreview />}>
                  {stats?.favorite_drink_types &&
                    stats.favorite_drink_types.length > 0 &&
                    (() => {
                      const topDrinks = stats.favorite_drink_types;
                      const total = stats.total_drinks;
                      return (
                        <View className="bg-card mx-4 mt-4 rounded-2xl border border-gray-400 p-4 gap-4">
                          <View className="flex-row items-center justify-between">
                            <Text className="text-xs text-gray-400 font-medium uppercase tracking-wide">Top Drinks</Text>
                            <Text className="text-xs bg-amber-100 text-amber-600 font-bold px-2 py-0.5 rounded-full">
                              Plus
                            </Text>
                          </View>
                          <View className="gap-2">
                            {topDrinks.slice(0, 5).map((d) => {
                              const info = DRINK_TYPE_MAP[d.drink_type as DrinkType] ?? DRINK_TYPE_MAP["other"];
                              const pct = total > 0 ? (d.count / total) * 100 : 0;
                              return (
                                <View key={d.drink_type} className="flex-row items-center gap-2">
                                  <DrinkIcon type={d.drink_type as DrinkType} size={16} color={info.color} />
                                  <View className="flex-1">
                                    <View className="flex-row items-center justify-between mb-0.5">
                                      <Text className="text-xs text-gray-600 font-medium">{info.label}</Text>
                                      <Text className="text-xs text-gray-400">{d.count}</Text>
                                    </View>
                                    <View className="bg-gray-100 rounded-full h-1.5">
                                      <View
                                        style={{ width: `${pct}%`, backgroundColor: info.color }}
                                        className="h-1.5 rounded-full"
                                      />
                                    </View>
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })()}
                </PremiumGate>

                {user?.id && (
                  <PremiumGate featureName="Advanced Analytics" preview={<AdvancedStatsPreview />}>
                    <AdvancedStatsCard userId={user.id} />
                  </PremiumGate>
                )}

                <PremiumGate featureName="BAC Estimator" preview={<BACEstimatorPreview />}>
                  <BACEstimator />
                </PremiumGate>
              </ScrollView>
            </View>
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (activeTab === "progress") {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={topEdges}>
        {profileHeader}
        {badgePicker}
        <TabBar active={activeTab} onChange={setActiveTab} />
        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor="#f59e0b" />}
        >
          {stats && user?.id && <GoalCard userId={user.id} stats={stats} />}

          {stats && (
            <View className="bg-card mx-4 mt-4 rounded-2xl p-4 gap-4">
              <View className="flex-row">
                <StatBlock label="Total Drinks" value={stats.total_drinks} />
                <View className="w-px bg-border" />
                <StatBlock label="This Week" value={stats.drinks_this_week} />
                <View className="w-px bg-border" />
                <StatBlock label="This Month" value={stats.drinks_this_month} />
              </View>

              {stats.activity_by_day?.length > 0 && (
                <View className="pt-2">
                  <Text className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
                    Last 14 Days
                  </Text>
                  <TrendLine data={stats.activity_by_day.slice(-14)} isDark={colorScheme === "dark"} />
                </View>
              )}

              <View className="pt-2">
                {stats.activity_by_day?.length > 0 && <ActivityCalendar activityByDay={stats.activity_by_day} />}
              </View>
            </View>
          )}

          <PremiumGate featureName="Top Drinks" preview={<TopDrinksPreview />}>
            {stats?.favorite_drink_types &&
              stats.favorite_drink_types.length > 0 &&
              (() => {
                const topDrinks = stats.favorite_drink_types;
                const total = stats.total_drinks;
                return (
                  <View className="bg-card mx-4 mt-4 rounded-2xl border border-gray-400 p-4 gap-4">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs text-gray-400 font-medium uppercase tracking-wide">Top Drinks</Text>
                      <Text className="text-xs bg-amber-100 text-amber-600 font-bold px-2 py-0.5 rounded-full">
                        Plus
                      </Text>
                    </View>
                    <View className="gap-2">
                      {topDrinks.slice(0, 5).map((d) => {
                        const info = DRINK_TYPE_MAP[d.drink_type as DrinkType] ?? DRINK_TYPE_MAP["other"];
                        const pct = total > 0 ? (d.count / total) * 100 : 0;
                        return (
                          <View key={d.drink_type} className="flex-row items-center gap-2">
                            <DrinkIcon type={d.drink_type as DrinkType} size={16} color={info.color} />
                            <View className="flex-1">
                              <View className="flex-row items-center justify-between mb-0.5">
                                <Text className="text-xs text-gray-600 font-medium">{info.label}</Text>
                                <Text className="text-xs text-gray-400">{d.count}</Text>
                              </View>
                              <View className="bg-gray-100 rounded-full h-1.5">
                                <View
                                  style={{ width: `${pct}%`, backgroundColor: info.color }}
                                  className="h-1.5 rounded-full"
                                />
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })()}
          </PremiumGate>

          {user?.id && (
            <PremiumGate featureName="Advanced Analytics" preview={<AdvancedStatsPreview />}>
              <AdvancedStatsCard userId={user.id} />
            </PremiumGate>
          )}

          <PremiumGate featureName="BAC Estimator" preview={<BACEstimatorPreview />}>
            <BACEstimator />
          </PremiumGate>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Head>
        <title>Profile | Suds</title>
      </Head>
      <SafeAreaView className="flex-1 bg-background" edges={topEdges}>
        {profileHeader}
        {badgePicker}
        <TabBar active={activeTab} onChange={setActiveTab} />
        <FlatList
          data={myEntries}
          keyExtractor={(entry) =>
            entry.type === "session" ? `session-${entry.session_id}` : `drink-${entry.item.id}`
          }
          renderItem={renderActivityItem}
          refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor="#f59e0b" />}
          ListEmptyComponent={
            <View className="px-6 py-10 items-center">
              <Text className="text-3xl mb-2">🍺</Text>
              <Text className="text-muted-foreground text-center">No drinks logged yet. Crack one open!</Text>
            </View>
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-4 items-center">
                <ActivityIndicator color="#f59e0b" />
              </View>
            ) : null
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      </SafeAreaView>
    </>
  );
}
