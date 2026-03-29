import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAdvancedStats } from '@/hooks/useAdvancedStats';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface AdvancedStatsCardProps {
  userId: string;
}

export function AdvancedStatsCard({ userId }: AdvancedStatsCardProps) {
  const { data: stats, isLoading } = useAdvancedStats(userId, true);

  if (isLoading) {
    return (
      <View className="bg-white mx-4 mt-4 rounded-2xl border border-gray-100 p-6 items-center">
        <ActivityIndicator color="#f59e0b" />
      </View>
    );
  }

  if (!stats) return null;

  // Week-over-week chart
  const weeklyTrend = stats.weekly_trend ?? [];
  const maxWeekly = Math.max(...weeklyTrend.map((w) => w.count), 1);

  // Day of week distribution
  const byDay = stats.by_day_of_week ?? [];
  const maxDay = Math.max(...byDay.map((d) => d.count), 1);

  // YoY comparison
  const yoyChange = stats.last_year_count > 0
    ? Math.round(((stats.this_year_count - stats.last_year_count) / stats.last_year_count) * 100)
    : null;

  return (
    <View className="bg-white mx-4 mt-4 rounded-2xl border border-gray-100 p-4 gap-5">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-gray-400 font-medium uppercase tracking-wide">
          Advanced Analytics
        </Text>
        <Text className="text-xs bg-amber-100 text-amber-600 font-bold px-2 py-0.5 rounded-full">
          Plus
        </Text>
      </View>

      {/* At-a-glance numbers */}
      <View className="flex-row gap-3">
        <View className="flex-1 bg-gray-50 rounded-xl p-3">
          <Text className="text-xl font-bold text-gray-900">{stats.avg_per_week ?? 0}</Text>
          <Text className="text-xs text-gray-400 mt-0.5">avg / week</Text>
        </View>
        {stats.best_session_count != null && (
          <View className="flex-1 bg-gray-50 rounded-xl p-3">
            <Text className="text-xl font-bold text-gray-900">{stats.best_session_count}</Text>
            <Text className="text-xs text-gray-400 mt-0.5">best night out</Text>
          </View>
        )}
        {yoyChange !== null && (
          <View className="flex-1 bg-gray-50 rounded-xl p-3">
            <Text
              className={`text-xl font-bold ${
                yoyChange > 0 ? 'text-red-500' : yoyChange < 0 ? 'text-green-500' : 'text-gray-900'
              }`}
            >
              {yoyChange > 0 ? '+' : ''}{yoyChange}%
            </Text>
            <Text className="text-xs text-gray-400 mt-0.5">vs last year</Text>
          </View>
        )}
      </View>

      {/* Weekly trend — last 12 weeks */}
      {weeklyTrend.length > 0 && (
        <View>
          <Text className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">
            Last 12 Weeks
          </Text>
          <View className="flex-row items-end gap-0.5 h-16">
            {weeklyTrend.map((w) => (
              <View key={w.week_start} className="flex-1 items-center justify-end h-full">
                <View
                  style={{
                    width: '100%',
                    height: `${Math.max((w.count / maxWeekly) * 100, w.count > 0 ? 8 : 0)}%`,
                    backgroundColor: '#F59E0B',
                    borderRadius: 3,
                    minHeight: w.count > 0 ? 4 : 2,
                  }}
                />
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Day-of-week distribution */}
      {byDay.length > 0 && (
        <View>
          <Text className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">
            By Day of Week
          </Text>
          <View className="flex-row items-end gap-1 h-12">
            {DAYS.map((label, dow) => {
              const entry = byDay.find((d) => d.day_of_week === dow);
              const count = entry?.count ?? 0;
              return (
                <View key={label} className="flex-1 items-center gap-1">
                  <View className="w-full items-center justify-end" style={{ height: 40 }}>
                    <View
                      style={{
                        width: '80%',
                        height: count > 0 ? Math.max((count / maxDay) * 36, 4) : 2,
                        backgroundColor: count > 0 ? '#F59E0B' : '#F3F4F6',
                        borderRadius: 3,
                      }}
                    />
                  </View>
                  <Text className="text-gray-400 text-xs">{label[0]}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}
