import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { DrinkType } from '@/types/models';
import { DRINK_TYPE_MAP } from '@/lib/constants';

interface DrinkIconProps {
  type: DrinkType;
  size: number;
  color: string;
}

export function DrinkIcon({ type, size, color }: DrinkIconProps) {
  const info = DRINK_TYPE_MAP[type] || DRINK_TYPE_MAP['other'];
  const iconName = info.icon;

  if (type === 'other' || !iconName) {
    return <Ionicons name="help-circle-outline" size={size} color={color} />;
  }

  return <MaterialCommunityIcons name={iconName as any} size={size} color={color} />;
}
