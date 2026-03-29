import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  Text,
  View,
} from 'react-native';

interface ButtonProps extends PressableProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles = {
  primary:   'bg-amber-500 active:bg-amber-600',
  secondary: 'bg-white border border-amber-500 active:bg-amber-50',
  ghost:     'bg-transparent active:bg-gray-100',
  danger:    'bg-red-500 active:bg-red-600',
};

const labelStyles = {
  primary:   'text-white font-semibold',
  secondary: 'text-amber-600 font-semibold',
  ghost:     'text-gray-700 font-medium',
  danger:    'text-white font-semibold',
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
  const isDisabled = disabled || loading;

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      className={`flex-row items-center justify-center ${variantStyles[variant]} ${sizeStyles[size]} ${isDisabled ? 'opacity-50' : ''}`}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? '#fff' : '#d97706'}
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
