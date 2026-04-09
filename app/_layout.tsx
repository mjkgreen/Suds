import '../global.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View, useColorScheme as useReactNativeColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { initRevenueCat } from '@/lib/revenuecat';
import { useAuthStore } from '@/stores/authStore';
import { useColorScheme } from 'nativewind';
import { useThemeStore } from '@/stores/themeStore';

function ThemeSync() {
  const { themePreference } = useThemeStore();
  const { setColorScheme } = useColorScheme();
  const systemColorScheme = useReactNativeColorScheme();

  useEffect(() => {
    if (themePreference === 'system') {
      setColorScheme(systemColorScheme ?? 'light');
    } else {
      setColorScheme(themePreference);
    }
  }, [themePreference, systemColorScheme, setColorScheme]);

  return null;
}

function AuthGuard() {
  const { session, isLoading } = useAuth();
  const { user, profile } = useAuthStore();
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

    const segs = segments as string[];
    const inAuthGroup = segs[0] === '(auth)';
    const isOnboarding = segs[0] === '(auth)' && segs[1] === 'onboarding';
    // Public web routes: root index, terms, privacy, support
    const isPublicRoute = segs.length === 0 || ['terms', 'privacy', 'support'].includes(segs[0]);

    if (!session && !inAuthGroup && !isPublicRoute) {
      router.replace('/(auth)/sign-in');
    } else if (session) {
      if (profile && !profile.onboarded) {
        if (!isOnboarding) {
          // @ts-ignore
          router.replace('/(auth)/onboarding');
        }
      } else if (profile && profile.onboarded && inAuthGroup) {
        // @ts-ignore
        router.replace('/(tabs)/feed');
      } else if (profile && profile.onboarded && segs.length === 0) {
        // Authenticated users visiting root get sent to the feed
        // @ts-ignore
        router.replace('/(tabs)/feed');
      }
      // If we have a session but no profile yet, wait for profile to fetch
    }
  }, [session, profile, isLoading, segments]);

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (isLoading) {
    return (
      <View className={`flex-1 items-center justify-center bg-background ${isDark ? 'dark' : ''}`}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  return (
    <View className={`flex-1 bg-background ${isDark ? 'dark' : ''}`}>
      <Stack screenOptions={{ 
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' }
      }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="drink/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="drink/edit/[id]" />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="user/edit" />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        <Stack.Screen name="terms" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="support" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeSync />
          <AuthGuard />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
