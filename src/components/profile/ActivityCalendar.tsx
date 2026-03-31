import React from 'react';
import { Text, View } from 'react-native';
import { ActivityDay } from '@/types/models';

const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface ActivityCalendarProps {
  activityByDay: ActivityDay[];
}

export function ActivityCalendar({ activityByDay }: ActivityCalendarProps) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow = firstDay.getDay();

  const monthLabel = firstDay.toLocaleString('default', { month: 'long', year: 'numeric' });

  const activityMap = new Map<string, number>();
  for (const d of activityByDay) {
    activityMap.set(d.date, d.count);
  }

  const maxCount = Math.max(...activityByDay.map((d) => d.count), 1);

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View>
      <Text className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">
        {monthLabel}
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
              return <View key={idx} className="flex-1" style={{ height: 32 }} />;
            }
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const count = activityMap.get(dateStr) ?? 0;
            const isToday = now.getDate() === day;
            const alpha = count > 0 ? Math.max(count / maxCount, 0.25) : 0;
            return (
              <View key={idx} className="flex-1 items-center justify-center" style={{ height: 32 }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor:
                      count > 0 ? `rgba(245, 158, 11, ${alpha})` : 'transparent',
                    borderWidth: isToday ? 1.5 : 0,
                    borderColor: '#f59e0b',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      color: count > 0 ? '#92400e' : '#6b7280',
                      fontWeight: isToday ? '700' : '400',
                    }}
                  >
                    {day}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
