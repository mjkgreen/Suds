import React from 'react';
import { Pressable, PressableProps, View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
}

interface PressableCardProps extends PressableProps {
  children: React.ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <View
      className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${className ?? ''}`}
      {...props}
    >
      {children}
    </View>
  );
}

export function PressableCard({ children, className, style, ...props }: PressableCardProps) {
  return (
    <Pressable
      className={`bg-white rounded-2xl shadow-sm border border-gray-100 active:opacity-80 ${className ?? ''}`}
      style={[{ alignSelf: 'stretch' }, style as any]}
      {...props}
    >
      {children}
    </Pressable>
  );
}
