import React from 'react';
import { Text, View } from 'react-native';
import { StreakData } from '@/types/models';

interface StreakCardProps {
  streaks: StreakData;
}

function StreakPill({
  emoji,
  count,
  label,
  color,
}: {
  emoji: string;
  count: number;
  label: string;
  color: string;
}) {
  return (
    <View className="flex-1 items-center rounded-2xl py-3 px-2" style={{ backgroundColor: color }}>
      <Text className="text-2xl">{emoji}</Text>
      <Text className="text-2xl font-bold text-gray-900 mt-1">{count}</Text>
      <Text className="text-xs text-gray-500 mt-0.5 text-center">{label}</Text>
    </View>
  );
}

export function StreakCard({ streaks }: StreakCardProps) {
  if (streaks.drink_streak === 0 && streaks.sober_streak === 0) return null;

  return (
    <View className="bg-white mx-4 mt-4 rounded-2xl border border-gray-100 p-4">
      <Text className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">
        Streaks
      </Text>
      <View className="flex-row gap-3">
        {streaks.drink_streak > 0 && (
          <StreakPill
            emoji="🔥"
            count={streaks.drink_streak}
            label={`day${streaks.drink_streak === 1 ? '' : 's'} drinking`}
            color="#FEF9C3"
          />
        )}
        {streaks.sober_streak > 0 && (
          <StreakPill
            emoji="💧"
            count={streaks.sober_streak}
            label={`day${streaks.sober_streak === 1 ? '' : 's'} sober`}
            color="#ECFDF5"
          />
        )}
      </View>
    </View>
  );
}
