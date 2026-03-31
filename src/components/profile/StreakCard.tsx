import React from 'react';
import { Text, View } from 'react-native';
import { StreakData } from '@/types/models';

interface StreakCardProps {
  streaks: StreakData;
}

export function StreakCard({ streaks }: StreakCardProps) {
  if (streaks.sober_streak === 0) return null;

  return (
    <View className="bg-white mx-4 mt-4 rounded-2xl border border-gray-100 p-4">
      <Text className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">
        Sober Streak
      </Text>
      <View className="flex-row items-center gap-3">
        <Text className="text-3xl">💧</Text>
        <View>
          <Text className="text-3xl font-bold text-gray-900">{streaks.sober_streak}</Text>
          <Text className="text-sm text-gray-400">
            day{streaks.sober_streak === 1 ? '' : 's'} sober
          </Text>
        </View>
      </View>
    </View>
  );
}
