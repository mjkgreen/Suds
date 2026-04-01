import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "@/components/common/Avatar";
import { DrinkBadge } from "@/components/drink/DrinkBadge";
import { PremiumGate } from "@/components/common/PremiumGate";
import { AdvancedStatsCard } from "@/components/profile/AdvancedStatsCard";
import { BACEstimator } from "@/components/profile/BACEstimator";
import { AdvancedStatsPreview, BACEstimatorPreview, TopDrinksPreview } from "@/components/profile/PremiumPreviews";
import { GoalCard } from "@/components/profile/GoalCard";
import { MilestoneBanner } from "@/components/profile/MilestoneBanner";
import { StreakCard } from "@/components/profile/StreakCard";
import { ActivityCalendar } from "@/components/profile/ActivityCalendar";
import { useAuth } from "@/hooks/useAuth";
import { useMyDrinkLogs } from "@/hooks/useDrinkLog";
import { useMilestones } from "@/hooks/useMilestones";
import { useProfile, useUserStats } from "@/hooks/useProfile";
import { useStreaks } from "@/hooks/useStreaks";
import { useAuthStore } from "@/stores/authStore";
import { useActiveSession } from "@/hooks/useSession";
import { DrinkLog, DrinkType } from "@/types/models";
import { formatDateTime } from "@/utils/dateHelpers";
import { getDisplayName, getUsername } from "@/utils/profileHelpers";
import { DrinkIcon } from "@/components/icons/DrinkIcon";
import { DRINK_TYPE_MAP } from "@/lib/constants";
import { useThemeStore } from "@/stores/themeStore";
import { usePrefsStore } from "@/stores/prefsStore";
import { useColorScheme } from "nativewind";

type Tab = "progress" | "activities";

const Y_LABEL_W = 22;
const CHART_H = 60;

function formatAxisDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function TrendLine({ data, isDark }: { data: Array<{ date: string; count: number }>; isDark: boolean }) {
  const [containerWidth, setContainerWidth] = useState(0);
  const chartWidth = Math.max(containerWidth - Y_LABEL_W, 0);
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const n = data.length;
  const mutedColor = isDark ? "#6b7280" : "#9ca3af";
  const baselineColor = isDark ? "#374151" : "#e5e7eb";

  const points = data.map((d, i) => ({
    x: n > 1 ? (i / (n - 1)) * chartWidth : chartWidth / 2,
    y: CHART_H - Math.max((d.count / maxCount) * CHART_H * 0.82, d.count > 0 ? 6 : 0) - 2,
    count: d.count,
  }));

  // X-axis: first, middle, last
  const xLabelIndices = Array.from(new Set([0, Math.floor((n - 1) / 2), n - 1]));

  return (
    <View onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      <View style={{ flexDirection: "row" }}>
        {/* Y-axis */}
        <View
          style={{
            width: Y_LABEL_W,
            height: CHART_H,
            justifyContent: "space-between",
            alignItems: "flex-end",
            paddingRight: 4,
            paddingBottom: 1,
          }}
        >
          <Text style={{ fontSize: 9, color: mutedColor, lineHeight: 12 }}>{maxCount}</Text>
          <Text style={{ fontSize: 9, color: mutedColor, lineHeight: 12 }}>0</Text>
        </View>

        {/* Chart area */}
        <View style={{ flex: 1, height: CHART_H }}>
          {/* Baseline */}
          <View
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, backgroundColor: baselineColor }}
          />

          {/* Line segments */}
          {chartWidth > 0 &&
            points.slice(0, -1).map((p, i) => {
              const next = points[i + 1];
              const dx = next.x - p.x;
              const dy = next.y - p.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              return (
                <View
                  key={`seg-${i}`}
                  style={{
                    position: "absolute",
                    left: (p.x + next.x) / 2 - length / 2,
                    top: (p.y + next.y) / 2 - 1.5,
                    width: length,
                    height: 3,
                    backgroundColor: "#f59e0b",
                    borderRadius: 2,
                    transform: [{ rotate: `${angle}deg` }],
                  }}
                />
              );
            })}

          {/* Dots */}
          {chartWidth > 0 &&
            points.map((p, i) => (
              <View
                key={`dot-${i}`}
                style={{
                  position: "absolute",
                  left: p.x - 4,
                  top: p.y - 4,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: data[i].count > 0 ? "#f59e0b" : isDark ? "#374151" : "#e5e7eb",
                  borderWidth: data[i].count > 0 ? 2 : 1,
                  borderColor: data[i].count > 0 ? (isDark ? "#92400e" : "#fcd34d") : baselineColor,
                }}
              />
            ))}
        </View>
      </View>

      {/* X-axis labels */}
      {chartWidth > 0 && (
        <View style={{ flexDirection: "row", marginLeft: Y_LABEL_W, height: 16 }}>
          {xLabelIndices.map((idx, pos) => (
            <Text
              key={idx}
              style={{
                position: "absolute",
                left: points[idx].x - (pos === 2 ? 32 : pos === 1 ? 16 : 0),
                fontSize: 9,
                color: mutedColor,
                textAlign: pos === 0 ? "left" : pos === 1 ? "center" : "right",
                width: 36,
              }}
            >
              {formatAxisDate(data[idx].date)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="flex-1 items-center">
      <Text className="text-2xl font-bold text-foreground">{value}</Text>
      <Text className="text-xs text-muted-foreground mt-0.5">{label}</Text>
    </View>
  );
}

function DrinkLogRow({ item }: { item: DrinkLog }) {
  const info = DRINK_TYPE_MAP[item.drink_type as DrinkType] ?? DRINK_TYPE_MAP["other"];
  return (
    <View className="flex-row items-center px-6 py-3 border-b border-border">
      <View
        style={{ backgroundColor: info.color + "15" }}
        className="w-9 h-9 rounded-xl items-center justify-center mr-3"
      >
        <DrinkIcon type={item.drink_type as DrinkType} size={18} color={info.color} />
      </View>
      <View className="flex-1">
        <Text className="text-foreground font-medium">
          {item.drink_name || info.label}
          {item.quantity !== 1 && <Text className="text-muted-foreground font-normal"> × {item.quantity}</Text>}
        </Text>
        {item.location_name && (
          <View className="flex-row items-center gap-1">
            <Ionicons name="location-outline" size={11} color="#9ca3af" />
            <Text className="text-muted-foreground text-xs">{item.location_name}</Text>
          </View>
        )}
      </View>
      <Text className="text-muted-foreground text-xs">{formatDateTime(item.logged_at)}</Text>
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
  const [activeTab, setActiveTab] = useState<Tab>("activities");

  const { themePreference, setThemePreference } = useThemeStore();
  const { locationEnabled, setLocationEnabled } = usePrefsStore();
  const { colorScheme } = useColorScheme();

  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useProfile(user?.id);
  const { data: stats, refetch: refetchStats } = useUserStats(user?.id);
  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = useMyDrinkLogs(user?.id);
  const { data: streaks } = useStreaks(user?.id);
  const { data: milestones } = useMilestones(user?.id);

  const isLoading = profileLoading || logsLoading;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#f59e0b" />
      </SafeAreaView>
    );
  }

  function ProfileHeader() {
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
            <Pressable className="bg-accent rounded-xl px-4 py-2" onPress={() => router.push("/user/edit")}>
              <Text className="text-accent-foreground font-medium text-sm">Edit</Text>
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
            <Text className="text-muted-foreground text-sm">
              <Text className="font-bold text-foreground">{profile?.followers_count ?? 0}</Text> Followers
            </Text>
            <Text className="text-muted-foreground text-sm">
              <Text className="font-bold text-foreground">{profile?.following_count ?? 0}</Text> Following
            </Text>
          </View>

          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setLocationEnabled(!locationEnabled)}
              className="flex-row items-center gap-1.5 bg-accent rounded-full px-3 py-1.5"
            >
              <Ionicons
                name={locationEnabled ? "location" : "location-outline"}
                size={14}
                color={locationEnabled ? "#f59e0b" : "hsl(var(--muted-foreground))"}
              />
              <Text className={`text-xs font-bold ${locationEnabled ? "text-primary" : "text-muted-foreground"}`}>
                Location
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                const options: ("light" | "dark" | "system")[] = ["light", "dark", "system"];
                const nextIndex = (options.indexOf(themePreference) + 1) % options.length;
                setThemePreference(options[nextIndex]);
              }}
              className="flex-row items-center gap-1.5 bg-accent rounded-full px-3 py-1.5"
            >
              <Ionicons
                name={themePreference === "light" ? "sunny" : themePreference === "dark" ? "moon" : "contrast"}
                size={14}
                color="hsl(var(--foreground))"
              />
              <Text className="text-foreground text-xs font-bold capitalize">
                {themePreference === "system" ? "System" : themePreference}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  function onRefresh() {
    refetchProfile();
    refetchLogs();
    refetchStats();
  }

  if (activeTab === "progress") {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={topEdges}>
        <ProfileHeader />
        <TabBar active={activeTab} onChange={setActiveTab} />
        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor="#f59e0b" />}
        >
          {milestones && <MilestoneBanner milestones={milestones} />}
          {streaks && <StreakCard streaks={streaks} />}
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
    <SafeAreaView className="flex-1 bg-background" edges={topEdges}>
      <FlatList
        data={logs ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <DrinkLogRow item={item} />}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor="#f59e0b" />}
        ListHeaderComponent={
          <View>
            <ProfileHeader />
            <TabBar active={activeTab} onChange={setActiveTab} />
            <View className="px-6 pt-5 pb-2">
              <Text className="text-base font-bold text-muted-foreground">Drink History</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="px-6 py-10 items-center">
            <Text className="text-3xl mb-2">🍺</Text>
            <Text className="text-muted-foreground text-center">No drinks logged yet. Crack one open!</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
}
