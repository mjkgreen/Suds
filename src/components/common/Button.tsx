import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  Text,
  View,
} from 'react-native';
import { useColorScheme } from 'nativewind';

interface ButtonProps extends PressableProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles = {
  primary:   'bg-primary active:opacity-90',
  secondary: 'bg-background dark:bg-card border border-primary active:bg-accent dark:active:bg-accent',
  ghost:     'bg-transparent active:bg-accent dark:active:bg-accent',
  danger:    'bg-destructive active:opacity-90',
};

const labelStyles = {
  primary:   'text-primary-foreground font-semibold',
  secondary: 'text-primary font-semibold',
  ghost:     'text-foreground dark:text-foreground font-medium',
  danger:    'text-destructive-foreground font-semibold',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 rounded-lg',
  md: 'px-5 py-3 rounded-xl',
  lg: 'px-6 py-4 rounded-2xl',
};

const labelSizes = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  ...props
}: ButtonProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isDisabled = disabled || loading;

  let indicatorColor = '#f59e0b';
  if (variant === 'primary' || variant === 'danger') {
    indicatorColor = '#fff';
  } else if (isDark) {
    indicatorColor = '#f59e0b';
  }

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      className={`flex-row items-center justify-center ${variantStyles[variant]} ${sizeStyles[size]} ${isDisabled ? 'opacity-50' : ''} ${isDark ? 'dark' : ''}`}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={indicatorColor}
        />
      ) : (
        <>
          {icon && <View className="mr-2">{icon}</View>}
          <Text className={`${labelStyles[variant]} ${labelSizes[size]}`}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
