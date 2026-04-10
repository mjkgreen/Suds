import React from 'react';
import { Platform, Pressable, PressableProps, View, ViewProps } from 'react-native';
import { useColorScheme } from 'nativewind';

interface CardProps extends ViewProps {
  children: React.ReactNode;
}

interface PressableCardProps extends PressableProps {
  children: React.ReactNode;
  flush?: boolean;
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

export function PressableCard({ children, className, style, flush, ...props }: PressableCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const flushOnMobile = flush && Platform.OS !== 'web';

  const shapeClass = flushOnMobile
    ? 'border-t border-b border-border'
    : 'rounded-2xl shadow-sm border border-border';

  return (
    <Pressable
      className={`bg-card active:opacity-80 ${shapeClass} ${isDark ? 'dark' : ''} ${className ?? ''}`}
      style={[{ alignSelf: 'stretch' }, style as any]}
      {...props}
    >
      {children}
    </Pressable>
  );
}
