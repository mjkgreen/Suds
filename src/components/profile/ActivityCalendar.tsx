import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDrinks } from '@/components/charts/BarChart';
import { ActivityDay } from '@/types/models';

const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Circle diameter for the lightest and the busiest day. */
const MIN_DOT = 14;
const MAX_DOT = 30;

interface ActivityCalendarProps {
  activityByDay: ActivityDay[];
}

function dateKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Month calendar shaded by drinks per day. Arrows move between months (back
 * to the first month with a drink); tapping a day shows its count.
 */
export function ActivityCalendar({ activityByDay }: ActivityCalendarProps) {
  const now = new Date();
  const [offset, setOffset] = useState(0); // 0 = this month, -1 = last month, …
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const { activityMap, earliestOffset, personalMax } = useMemo(() => {
    const map = new Map<string, number>();
    let earliest: string | null = null;
    let max = 0;
    let recentMax = 0;
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    const recentFrom = dateKey(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), sixMonthsAgo.getDate());
    for (const d of activityByDay) {
      const v = Number(d.count) || 0;
      if (!v) continue;
      map.set(d.date, v);
      max = Math.max(max, v);
      if (d.date >= recentFrom) recentMax = Math.max(recentMax, v);
      if (!earliest || d.date < earliest) earliest = d.date;
    }
    let minOffset = 0;
    if (earliest) {
      const [y, m] = earliest.split('-').map(Number);
      minOffset = (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth());
    }
    // Shading and size are relative to this person's busiest day in the last
    // 6 months (all time if they haven't drunk since), so a quiet month looks
    // quiet and one huge day years ago doesn't flatten the scale. Older days
    // above it just show at full size.
    return {
      activityMap: map,
      earliestOffset: Math.min(minOffset, 0),
      personalMax: Math.max(recentMax || max, 1),
    };
  }, [activityByDay]); // eslint-disable-line react-hooks/exhaustive-deps

  const firstDay = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = firstDay.getFullYear();
  const month = firstDay.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow = firstDay.getDay();
  const monthLabel = firstDay.toLocaleString('default', { month: 'long', year: 'numeric' });
  const isCurrentMonth = offset === 0;

  let monthTotal = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    monthTotal += activityMap.get(dateKey(year, month, d)) ?? 0;
  }

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function go(delta: number) {
    setOffset((o) => Math.min(0, Math.max(earliestOffset, o + delta)));
    setSelectedDay(null);
  }

  const selectedCount = selectedDay ? activityMap.get(dateKey(year, month, selectedDay)) ?? 0 : 0;
  const selectedLabel = selectedDay
    ? `${DAY_NAMES[new Date(year, month, selectedDay).getDay()]}, ${firstDay.toLocaleString('default', { month: 'short' })} ${selectedDay}`
    : null;

  return (
    <View>
      <View className="flex-row items-center justify-between mb-1">
        <Pressable
          onPress={() => go(-1)}
          disabled={offset <= earliestOffset}
          hitSlop={8}
          className="p-1"
          accessibilityLabel="Previous month"
        >
          <Ionicons name="chevron-back" size={16} color={offset <= earliestOffset ? '#d1d5db' : '#9ca3af'} />
        </Pressable>
        <Text className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{monthLabel}</Text>
        <Pressable
          onPress={() => go(1)}
          disabled={isCurrentMonth}
          hitSlop={8}
          className="p-1"
          accessibilityLabel="Next month"
        >
          <Ionicons name="chevron-forward" size={16} color={isCurrentMonth ? '#d1d5db' : '#9ca3af'} />
        </Pressable>
      </View>

      <Text className="text-center text-foreground text-sm font-semibold mb-2" style={{ minHeight: 20 }}>
        {selectedLabel ? `${selectedLabel} · ${formatDrinks(selectedCount)}` : `${formatDrinks(monthTotal)} this month`}
      </Text>

      <View className="flex-row mb-1">
        {DOW_LABELS.map((l, i) => (
          <View key={i} className="flex-1 items-center">
            <Text className="text-xs text-gray-400">{l}</Text>
          </View>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, week) => (
        <View key={week} className="flex-row mb-1">
          {cells.slice(week * 7, week * 7 + 7).map((day, idx) => {
            if (day === null) {
              return <View key={idx} className="flex-1" style={{ height: 34 }} />;
            }
            const count = activityMap.get(dateKey(year, month, day)) ?? 0;
            const isToday = isCurrentMonth && now.getDate() === day;
            const isFuture = isCurrentMonth && day > now.getDate();
            const isSelected = selectedDay === day;
            // 0..1 of their busiest day: deeper orange and a bigger circle.
            const ratio = count > 0 ? Math.min(count / personalMax, 1) : 0;
            const size = count > 0 ? MIN_DOT + (MAX_DOT - MIN_DOT) * ratio : 0;
            const alpha = 0.2 + 0.8 * ratio;
            return (
              <Pressable
                key={idx}
                className="flex-1 items-center justify-center"
                style={{ height: 34 }}
                disabled={isFuture}
                onPress={() => setSelectedDay(isSelected ? null : day)}
                accessibilityLabel={`${day}: ${formatDrinks(count)}`}
              >
                <View
                  style={{
                    width: MAX_DOT,
                    height: MAX_DOT,
                    borderRadius: MAX_DOT / 2,
                    borderWidth: isSelected ? 2 : isToday ? 1.5 : 0,
                    borderColor: isSelected ? '#b45309' : '#f59e0b',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {count > 0 && (
                    <View
                      style={{
                        position: 'absolute',
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: `rgba(245, 158, 11, ${alpha})`,
                      }}
                    />
                  )}
                  <Text
                    style={{
                      fontSize: 11,
                      color: ratio > 0.6 ? '#ffffff' : count > 0 ? '#92400e' : isFuture ? '#d1d5db' : '#6b7280',
                      fontWeight: isToday || isSelected || ratio > 0.6 ? '700' : '400',
                    }}
                  >
                    {day}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
