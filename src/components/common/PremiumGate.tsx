import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAuthStore } from '@/stores/authStore';

interface PremiumGateProps {
  children: React.ReactNode;
  /** Short label shown on the locked overlay, e.g. "Advanced Stats" */
  featureName: string;
}

/**
 * Wraps premium-only content.
 * Free users see a blurred placeholder with an upgrade prompt.
 * Premium users see the real content.
 */
export function PremiumGate({ children, featureName }: PremiumGateProps) {
  const { isPremium } = useAuthStore();
  const router = useRouter();

  if (isPremium) return <>{children}</>;

  return (
    <View className="relative overflow-hidden rounded-2xl">
      {/* Blurred background hint */}
      <View className="opacity-20 pointer-events-none" aria-hidden>
        {children}
      </View>

      {/* Lock overlay */}
      <View className="absolute inset-0 items-center justify-center bg-white/60 rounded-2xl px-6">
        <Text className="text-2xl mb-2">🔒</Text>
        <Text className="text-gray-900 font-bold text-base text-center mb-1">
          {featureName}
        </Text>
        <Text className="text-gray-500 text-xs text-center mb-4">
          Unlock with Suds Plus
        </Text>
        <Pressable
          className="bg-amber-400 rounded-xl px-6 py-2.5"
          onPress={() => router.push('/paywall')}
        >
          <Text className="text-white font-bold text-sm">Upgrade</Text>
        </Pressable>
      </View>
    </View>
  );
}
