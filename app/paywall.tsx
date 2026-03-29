import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSubscription } from '@/hooks/useSubscription';

const PREMIUM_FEATURES = [
  {
    icon: '📈',
    title: 'Advanced Analytics',
    description: 'Week-over-week trends, monthly charts, day-of-week & time breakdowns',
  },
  {
    icon: '🩺',
    title: 'BAC Estimator',
    description: 'Real-time blood alcohol content estimates based on your session',
  },
  {
    icon: '📅',
    title: 'Full History',
    description: 'Unlock stats and trends across your complete drink history',
  },
  {
    icon: '📤',
    title: 'Data Export',
    description: 'Export your drink logs to CSV anytime',
  },
  {
    icon: '✨',
    title: 'Premium Badge',
    description: 'Stand out with a Suds Plus badge on your profile',
  },
];

const FREE_FEATURES = [
  { icon: '🔥', label: 'Drink & sober streaks' },
  { icon: '🏆', label: 'Milestone badges (400th beer, etc.)' },
  { icon: '🗺️', label: 'Drink location heatmap' },
  { icon: '🎯', label: 'Weekly drink goal' },
  { icon: '📊', label: 'Basic stats & top drinks' },
  { icon: '👥', label: 'Social feed & follows' },
];

export default function PaywallScreen() {
  const router = useRouter();
  const { isPremium, isLoading, offerings, purchase, restore } = useSubscription();
  const [purchasing, setPurchasing] = useState(false);

  // Close if already premium
  useEffect(() => {
    if (isPremium) router.back();
  }, [isPremium, router]);

  const defaultOffering = offerings?.current;
  const packages = defaultOffering?.availablePackages ?? [];

  async function handlePurchase(pkg: (typeof packages)[0]) {
    setPurchasing(true);
    try {
      const ok = await purchase(pkg);
      if (ok) {
        Alert.alert('Welcome to Suds Plus! 🎉', 'All premium features are now unlocked.');
        router.back();
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Purchase failed';
      // User cancelled — no need to show an error
      if (!message.includes('cancelled') && !message.includes('UserCancelled')) {
        Alert.alert('Purchase failed', message);
      }
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRestore() {
    setPurchasing(true);
    try {
      const ok = await restore();
      if (ok) {
        Alert.alert('Restored!', 'Your Suds Plus subscription has been restored.');
        router.back();
      } else {
        Alert.alert('No subscription found', 'No active Suds Plus subscription was found.');
      }
    } finally {
      setPurchasing(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </Pressable>
          <View />
        </View>

        {/* Hero */}
        <View className="items-center px-6 pt-4 pb-6">
          <Text className="text-5xl mb-3">🍺</Text>
          <Text className="text-3xl font-bold text-gray-900 text-center">Suds Plus</Text>
          <Text className="text-gray-500 text-base text-center mt-2">
            Deeper insights into your drinking.{'\n'}Still have fun — just know the numbers.
          </Text>
        </View>

        {/* Premium features */}
        <View className="mx-5 bg-amber-50 rounded-2xl p-5 mb-4">
          <Text className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-4">
            Plus features
          </Text>
          <View className="gap-4">
            {PREMIUM_FEATURES.map((f) => (
              <View key={f.title} className="flex-row gap-3">
                <Text className="text-2xl">{f.icon}</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-gray-900 text-sm">{f.title}</Text>
                  <Text className="text-gray-500 text-xs mt-0.5">{f.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Free features */}
        <View className="mx-5 mb-6">
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Always free
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {FREE_FEATURES.map((f) => (
              <View
                key={f.label}
                className="flex-row items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5"
              >
                <Text className="text-sm">{f.icon}</Text>
                <Text className="text-gray-600 text-xs font-medium">{f.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Purchase buttons */}
        <View className="mx-5 gap-3">
          {isLoading && !packages.length ? (
            <ActivityIndicator color="#f59e0b" />
          ) : packages.length > 0 ? (
            packages.map((pkg) => (
              <Pressable
                key={pkg.identifier}
                className="bg-amber-400 rounded-2xl py-4 items-center"
                onPress={() => handlePurchase(pkg)}
                disabled={purchasing}
              >
                {purchasing ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Text className="text-white font-bold text-base">
                      {pkg.product.title || 'Subscribe'}
                    </Text>
                    <Text className="text-white/80 text-xs mt-0.5">
                      {pkg.product.priceString} · {pkg.packageType}
                    </Text>
                  </>
                )}
              </Pressable>
            ))
          ) : (
            // Fallback when RevenueCat isn't configured yet
            <View className="bg-amber-400 rounded-2xl py-4 items-center opacity-60">
              <Text className="text-white font-bold text-base">Suds Plus — Coming Soon</Text>
              <Text className="text-white/80 text-xs mt-0.5">Payments not yet configured</Text>
            </View>
          )}

          <Pressable
            className="py-3 items-center"
            onPress={handleRestore}
            disabled={purchasing}
          >
            <Text className="text-gray-400 text-sm">Restore purchases</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
