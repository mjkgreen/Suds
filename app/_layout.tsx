import '../global.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { initRevenueCat } from '@/lib/revenuecat';
import { useAuthStore } from '@/stores/authStore';

function AuthGuard() {
  const { session, isLoading } = useAuth();
  const { user } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // Initialize RevenueCat whenever we have a logged-in user
  useEffect(() => {
    if (user?.id) {
      initRevenueCat(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)/feed');
    }
  }, [session, isLoading, segments]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-amber-50">
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="drink/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="drink/edit/[id]" />
      <Stack.Screen name="user/[id]" />
      <Stack.Screen name="user/edit" />
      <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthGuard />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
