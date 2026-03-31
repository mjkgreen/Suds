import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { DrinkType } from '@/types/models';

interface DrinkIconProps {
  type: DrinkType;
  size: number;
  color: string;
}

const MCIIcons: Partial<Record<DrinkType, string>> = {
  beer: 'beer',
  wine: 'glass-wine',
  cocktail: 'glass-cocktail',
  spirit: 'liquor',
  cider: 'bottle-wine',
  seltzer: 'bottle-soda',
};

export function DrinkIcon({ type, size, color }: DrinkIconProps) {
  if (type === 'other') {
    return <Ionicons name="help-circle-outline" size={size} color={color} />;
  }

  const iconName = MCIIcons[type];
  if (!iconName) {
    return <Ionicons name="help-circle-outline" size={size} color={color} />;
  }

  return <MaterialCommunityIcons name={iconName as any} size={size} color={color} />;
}
