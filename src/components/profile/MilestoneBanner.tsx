import React from 'react';
import { Text, View } from 'react-native';
import { MilestoneData } from '@/types/models';
import { MILESTONE_EMOJI } from '@/lib/constants';

interface MilestoneBannerProps {
  milestones: MilestoneData;
}

export function MilestoneBanner({ milestones }: MilestoneBannerProps) {
  if (!milestones.latest_milestone) return null;

  const emoji = MILESTONE_EMOJI[milestones.latest_milestone] ?? '🎉';
  const isNew = milestones.is_new;

  return (
    <View
      className={`mx-4 mt-4 rounded-2xl px-5 py-4 flex-row items-center gap-4 ${
        isNew ? 'bg-amber-400' : 'bg-gray-100'
      }`}
    >
      <Text className="text-4xl">{emoji}</Text>
      <View className="flex-1">
        {isNew && (
          <Text className={`text-xs font-bold uppercase tracking-widest mb-0.5 ${isNew ? 'text-white/80' : 'text-gray-400'}`}>
            New milestone!
          </Text>
        )}
        <Text className={`font-bold text-base ${isNew ? 'text-white' : 'text-gray-700'}`}>
          Drink #{milestones.latest_milestone}
        </Text>
        <Text className={`text-xs mt-0.5 ${isNew ? 'text-white/70' : 'text-gray-400'}`}>
          {milestones.total_drinks} total drinks logged
        </Text>
      </View>
    </View>
  );
}
