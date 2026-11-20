import React, { useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useColorScheme } from "nativewind";
import { Bar, BarChart, formatDrinks } from "@/components/charts/BarChart";
import { useAdvancedStats } from "@/hooks/useAdvancedStats";
import { localDateKey, weekStart } from "@/utils/badgeHelpers";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKS = 12;
const CHART_H = 150;

interface AdvancedStatsCardProps {
  userId: string;
}

export function AdvancedStatsCard({ userId }: AdvancedStatsCardProps) {
  const { data: stats, isLoading } = useAdvancedStats(userId, true);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // Last 12 weeks (Monday starts, like the stats), including weeks with no
  // drinks — the server only returns weeks that had some.
  const weeklyBars = useMemo<Bar[]>(() => {
    const counts = new Map((stats?.weekly_trend ?? []).map((w) => [w.week_start, Number(w.count) || 0]));
    const thisWeek = weekStart(new Date());
    const bars: Bar[] = [];
    for (let i = WEEKS - 1; i >= 0; i--) {
      const start = new Date(thisWeek);
      start.setDate(start.getDate() - i * 7);
      const key = localDateKey(start);
      const prev = bars[bars.length - 1];
      const newMonth = !prev || new Date(prev.key + "T12:00:00").getMonth() !== start.getMonth();
      bars.push({
        key,
        value: counts.get(key) ?? 0,
        label: `Week of ${MONTHS[start.getMonth()]} ${start.getDate()}`,
        axisLabel: newMonth ? MONTHS[start.getMonth()] : null,
      });
    }
    return bars;
  }, [stats?.weekly_trend]);

  const dayBars = useMemo<Bar[]>(
    () =>
      DAYS.map((label, dow) => ({
        key: label,
        value: Number(stats?.by_day_of_week?.find((d) => d.day_of_week === dow)?.count) || 0,
        label: `All ${DAY_NAMES[dow]}s`,
        axisLabel: label,
      })),
    [stats?.by_day_of_week],
  );

  if (isLoading) {
    return (
      <View className="bg-card mx-4 mt-4 rounded-2xl border border-border p-6 items-center">
        <ActivityIndicator color="#f59e0b" />
      </View>
    );
  }

  if (!stats) return null;

  const weeklyTotal = weeklyBars.reduce((s, b) => s + b.value, 0);
  const dayTotal = dayBars.reduce((s, b) => s + b.value, 0);
  const busiest = dayBars.reduce((a, b) => (b.value > a.value ? b : a), dayBars[0]);

  const yoyChange =
    stats.last_year_count > 0
      ? Math.round(((stats.this_year_count - stats.last_year_count) / stats.last_year_count) * 100)
      : null;

  return (
    <View className="bg-card mx-4 mt-4 rounded-2xl border border-border p-4 gap-6">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Advanced Analytics</Text>
        <Text className="text-xs bg-amber-100 text-amber-600 font-bold px-2 py-0.5 rounded-full overflow-hidden">Plus</Text>
      </View>

      {/* At-a-glance numbers */}
      <View className="flex-row gap-3">
        <View className="flex-1 bg-accent rounded-xl p-3">
          <Text className="text-xl font-bold text-foreground">{stats.avg_per_week ?? 0}</Text>
          <Text className="text-xs text-muted-foreground mt-0.5">avg / week</Text>
        </View>
        {stats.best_session_count != null && (
          <View className="flex-1 bg-accent rounded-xl p-3">
            <Text className="text-xl font-bold text-foreground">{Number(stats.best_session_count)}</Text>
            <Text className="text-xs text-muted-foreground mt-0.5">best night out</Text>
          </View>
        )}
        {yoyChange !== null && (
          <View className="flex-1 bg-accent rounded-xl p-3">
            <Text
              className={`text-xl font-bold ${
                yoyChange > 0 ? "text-red-500" : yoyChange < 0 ? "text-green-500" : "text-foreground"
              }`}
            >
              {yoyChange > 0 ? "+" : ""}
              {yoyChange}%
            </Text>
            <Text className="text-xs text-muted-foreground mt-0.5">vs last year</Text>
          </View>
        )}
      </View>

      {/* Weekly trend — last 12 weeks */}
      <View>
        <Text className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Last 12 Weeks</Text>
        <BarChart
          bars={weeklyBars}
          isDark={isDark}
          height={CHART_H}
          summary={`${formatDrinks(weeklyTotal)} · ${formatDrinks(Math.round((weeklyTotal / WEEKS) * 10) / 10)} a week`}
        />
      </View>

      {/* Day-of-week distribution */}
      {dayTotal > 0 && (
        <View>
          <Text className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">By Day of Week</Text>
          <BarChart
            bars={dayBars}
            isDark={isDark}
            height={CHART_H}
            summary={`Busiest: ${busiest.key}`}
          />
        </View>
      )}
    </View>
  );
}
