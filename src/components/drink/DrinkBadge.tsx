import React from 'react';
import { Text, View } from 'react-native';
import { DrinkIcon } from '@/components/icons/DrinkIcon';
import { DRINK_TYPE_MAP } from '@/lib/constants';
import { DrinkType } from '@/types/models';

interface DrinkBadgeProps {
  type: DrinkType;
  size?: 'sm' | 'md';
}

export function DrinkBadge({ type, size = 'md' }: DrinkBadgeProps) {
  const info = DRINK_TYPE_MAP[type] ?? DRINK_TYPE_MAP['other'];
  const isSmall = size === 'sm';

  return (
    <View
      style={{ backgroundColor: info.color + '20', borderColor: info.color + '40' }}
      className={`flex-row items-center rounded-full border ${isSmall ? 'px-2 py-0.5' : 'px-3 py-1'}`}
    >
      <DrinkIcon type={type} size={isSmall ? 12 : 14} color={info.color} />
      <Text
        style={{ color: info.color }}
        className={`ml-1 font-medium ${isSmall ? 'text-xs' : 'text-sm'}`}
      >
        {info.label}
      </Text>
    </View>
  );
}
