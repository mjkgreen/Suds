import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BarChart, formatDrinks } from "@/components/charts/BarChart";
import { buildTrend, TREND_RANGES, TrendRange } from "@/lib/trendBuckets";
import { ActivityDay } from "@/types/models";

/** Drinks over a chosen range (7D … All), with tappable bars. */
export function ProgressTrend({ activityByDay, isDark }: { activityByDay: ActivityDay[]; isDark: boolean }) {
  const [range, setRange] = useState<TrendRange>("1m");
  const trend = useMemo(() => buildTrend(activityByDay, range), [activityByDay, range]);
  const current = TREND_RANGES.find((r) => r.key === range)!;
  const per = trend.unit === "day" ? "Daily" : trend.unit === "week" ? "Weekly" : "Monthly";

  return (
    <View>
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{current.title}</Text>
          {current.plus && (
            <Text className="text-[10px] bg-amber-100 text-amber-600 font-bold px-2 py-0.5 rounded-full overflow-hidden">Plus</Text>
          )}
        </View>
        <Text className="text-[10px] text-muted-foreground">{per}</Text>
      </View>

      <View className="flex-row bg-accent rounded-full p-0.5 mb-3">
        {TREND_RANGES.map((r) => {
          const active = r.key === range;
          return (
            <Pressable
              key={r.key}
              onPress={() => setRange(r.key)}
              className={`flex-1 items-center justify-center rounded-full ${active ? "bg-primary" : ""}`}
              style={{ height: 34 }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={r.plus ? `${r.title}, Suds Plus` : r.title}
            >
              <Text className={`text-xs font-semibold ${active ? "text-primary-foreground" : "text-muted-foreground"}`}>
                {r.label}
              </Text>
              {r.plus && (
                <Text
                  style={{ fontSize: 7, letterSpacing: 0.5, lineHeight: 9 }}
                  className={`font-bold ${active ? "text-primary-foreground" : "text-amber-600"}`}
                >
                  PLUS
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      <BarChart bars={trend.buckets} isDark={isDark} summary={`${formatDrinks(trend.total)} total`} />
    </View>
  );
}
