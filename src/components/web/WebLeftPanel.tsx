import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useColorScheme } from "nativewind";
import { TrendLine } from "@/components/profile/TrendLine";
import { DrinkIcon } from "@/components/icons/DrinkIcon";
import { ActivityCalendar } from "@/components/profile/ActivityCalendar";
import { useUserStats } from "@/hooks/useProfile";
import { useGoal } from "@/hooks/useGoals";
import { useAuthStore } from "@/stores/authStore";
import { DRINK_TYPE_MAP } from "@/lib/constants";
import { DrinkType } from "@/types/models";

export function WebLeftPanel() {
  const { user } = useAuthStore();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const { data: stats } = useUserStats(user?.id);
  const { data: goal } = useGoal(user?.id);

  const borderColor = isDark ? "#1f2937" : "#e5e7eb";
  const cardBg = isDark ? "#111827" : "#ffffff";
  const mutedText = isDark ? "#6b7280" : "#9ca3af";
  const labelColor = isDark ? "#9ca3af" : "#6b7280";
  const foreground = isDark ? "#f9fafb" : "#111827";

  const weeklyCount = stats?.drinks_this_week ?? 0;
  const limit = goal?.weekly_limit ?? null;
  const pct = limit ? Math.min((weeklyCount / limit) * 100, 100) : 0;
  const overLimit = limit ? weeklyCount > limit : false;

  return (
    <ScrollView
      style={{ borderRightWidth: 1, borderRightColor: borderColor }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Weekly Limit */}
      <View
        style={{
          backgroundColor: cardBg,
          borderRadius: 16,
          borderWidth: 1,
          borderColor,
          padding: 14,
          marginBottom: 12,
        }}
      >
        <Text style={{ fontSize: 10, color: labelColor, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
          Weekly Limit
        </Text>
        {limit ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 22, fontWeight: "700", color: overLimit ? "#ef4444" : foreground }}>
                {weeklyCount}
                <Text style={{ fontSize: 14, fontWeight: "400", color: mutedText }}> / {limit}</Text>
              </Text>
              <Text style={{ fontSize: 10, color: mutedText }}>drinks</Text>
            </View>
            <View style={{ backgroundColor: isDark ? "#1f2937" : "#f3f4f6", borderRadius: 8, height: 8 }}>
              <View
                style={{
                  width: `${pct}%`,
                  height: 8,
                  borderRadius: 8,
                  backgroundColor: overLimit ? "#ef4444" : "#f59e0b",
                }}
              />
            </View>
            {overLimit && (
              <Text style={{ fontSize: 10, color: "#ef4444", marginTop: 6 }}>
                Over by {weeklyCount - limit} drink{weeklyCount - limit !== 1 ? "s" : ""}
              </Text>
            )}
          </>
        ) : (
          <Text style={{ fontSize: 12, color: mutedText }}>No limit set — go to your profile to add one.</Text>
        )}
      </View>

      {/* 14-Day Trend */}
      {stats?.activity_by_day && stats.activity_by_day.length > 0 && (
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor,
            padding: 14,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 10, color: labelColor, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            Last 14 Days
          </Text>
          <TrendLine data={stats.activity_by_day.slice(-14)} isDark={isDark} />
        </View>
      )}

      {/* Activity Calendar */}
      {stats?.activity_by_day && stats.activity_by_day.length > 0 && (
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor,
            padding: 14,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 10, color: labelColor, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            Activity
          </Text>
          <ActivityCalendar activityByDay={stats.activity_by_day} />
        </View>
      )}

      {/* Top Drinks */}
      {stats?.favorite_drink_types && stats.favorite_drink_types.length > 0 && (
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor,
            padding: 14,
          }}
        >
          <Text style={{ fontSize: 10, color: labelColor, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            Top Drinks
          </Text>
          <View style={{ gap: 8 }}>
            {stats.favorite_drink_types.slice(0, 5).map((d) => {
              const info = DRINK_TYPE_MAP[d.drink_type as DrinkType] ?? DRINK_TYPE_MAP["other"];
              const pct = stats.total_drinks > 0 ? (d.count / stats.total_drinks) * 100 : 0;
              return (
                <View key={d.drink_type} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <DrinkIcon type={d.drink_type as DrinkType} size={14} color={info.color} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                      <Text style={{ fontSize: 11, color: foreground, fontWeight: "500" }}>{info.label}</Text>
                      <Text style={{ fontSize: 10, color: mutedText }}>{d.count}</Text>
                    </View>
                    <View style={{ backgroundColor: isDark ? "#1f2937" : "#f3f4f6", borderRadius: 4, height: 4 }}>
                      <View
                        style={{ width: `${pct}%`, height: 4, borderRadius: 4, backgroundColor: info.color }}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
