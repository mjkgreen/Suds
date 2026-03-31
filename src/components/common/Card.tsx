import React from 'react';
import { Pressable, PressableProps, View, ViewProps } from 'react-native';
import { useColorScheme } from 'nativewind';

interface CardProps extends ViewProps {
  children: React.ReactNode;
}

interface PressableCardProps extends PressableProps {
  children: React.ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      className={`bg-card rounded-2xl shadow-sm border border-border ${isDark ? 'dark' : ''} ${className ?? ''}`}
      {...props}
    >
      {children}
    </View>
  );
}

export function PressableCard({ children, className, style, ...props }: PressableCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Pressable
      className={`bg-card rounded-2xl shadow-sm border border-border active:opacity-80 ${isDark ? 'dark' : ''} ${className ?? ''}`}
      style={[{ alignSelf: 'stretch' }, style as any]}
      {...props}
    >
      {children}
    </Pressable>
  );
}
