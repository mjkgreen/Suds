import React from 'react';
import { Text, View } from 'react-native';

interface EmptyStateProps {
  emoji?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function EmptyState({ emoji = '🍺', title, subtitle, action }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <Text className="text-5xl mb-4">{emoji}</Text>
      <Text className="text-xl font-bold text-foreground text-center mb-2">{title}</Text>
      {subtitle && (
        <Text className="text-muted-foreground text-center mb-6">{subtitle}</Text>
      )}
      {action}
    </View>
  );
}
