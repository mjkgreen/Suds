import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDrinks } from '@/components/charts/BarChart';
import { ActivityDay } from '@/types/models';

const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

  const { activityMap, earliestOffset } = useMemo(() => {
    const map = new Map<string, number>();
    let earliest: string | null = null;
    for (const d of activityByDay) {
      const v = Number(d.count) || 0;
      if (!v) continue;
      map.set(d.date, v);
      if (!earliest || d.date < earliest) earliest = d.date;
    }
    let minOffset = 0;
    if (earliest) {
      const [y, m] = earliest.split('-').map(Number);
      minOffset = (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth());
    }
    return { activityMap: map, earliestOffset: Math.min(minOffset, 0) };
  }, [activityByDay]); // eslint-disable-line react-hooks/exhaustive-deps

  const firstDay = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = firstDay.getFullYear();
  const month = firstDay.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow = firstDay.getDay();
  const monthLabel = firstDay.toLocaleString('default', { month: 'long', year: 'numeric' });
  const isCurrentMonth = offset === 0;

  let monthTotal = 0;
  let maxCount = 1;
  for (let d = 1; d <= daysInMonth; d++) {
    const c = activityMap.get(dateKey(year, month, d)) ?? 0;
    monthTotal += c;
    maxCount = Math.max(maxCount, c);
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
            const alpha = count > 0 ? Math.max(count / maxCount, 0.25) : 0;
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
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: count > 0 ? `rgba(245, 158, 11, ${alpha})` : 'transparent',
                    borderWidth: isSelected ? 2 : isToday ? 1.5 : 0,
                    borderColor: isSelected ? '#b45309' : '#f59e0b',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      color: count > 0 ? '#92400e' : isFuture ? '#d1d5db' : '#6b7280',
                      fontWeight: isToday || isSelected ? '700' : '400',
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
