import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { DRINK_TYPES } from '@/lib/constants';
import { DrinkType } from '@/types/models';

interface DrinkTypePickerProps {
  value: DrinkType;
  onChange: (type: DrinkType) => void;
}

export function DrinkTypePicker({ value, onChange }: DrinkTypePickerProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingHorizontal: 4 }}
    >
      {DRINK_TYPES.map((type) => {
        const isSelected = value === type.value;
        return (
          <Pressable
            key={type.value}
            onPress={() => onChange(type.value)}
            style={{
              borderColor: isSelected ? type.color : '#e5e7eb',
              backgroundColor: isSelected ? type.color + '15' : '#fff',
            }}
            className="items-center py-3 px-4 rounded-2xl border-2 min-w-[72px]"
          >
            <Text className="text-3xl mb-1">{type.emoji}</Text>
            <Text
              style={{ color: isSelected ? type.color : '#6b7280' }}
              className="text-xs font-semibold"
            >
              {type.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
