import '../global.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View, useColorScheme as useReactNativeColorScheme } from 'react-native';
import * as Linking from 'expo-linking';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { useColorScheme } from 'nativewind';
import { useThemeStore } from '@/stores/themeStore';
import { useNotifications } from '@/hooks/useNotifications';
import { useNotificationRealtime } from '@/hooks/useInAppNotifications';
import { getPendingInviteToken, clearPendingInviteToken, setPendingInviteToken } from '@/lib/pendingInvite';
import { AnalyticsEvents, identify, track } from '@/lib/analytics';

// Module-level store for deep links that arrive before auth resolves
let pendingDeepLink: string | null = null;

// Extract an open-invite token from any supported link shape:
// https://drink-with-suds.com/join/{token} or suds://join/{token}
function parseJoinToken(parsed: ReturnType<typeof Linking.parse>): string | null {
  const path = parsed.path ?? '';
  if (parsed.hostname === 'join') {
    // suds://join/{token} → hostname "join", path "{token}"
    const token = path.replace(/^\/?/, '');
    return token || null;
  }
  const match = path.match(/^\/?join\/([^/?#]+)/);
  return match ? match[1] : null;
}

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

  useNotifications({ userId: user?.id });
  useNotificationRealtime();

  // Deep link handler: suds://session/join?token=xxx, suds://log,
  // suds://join/{token}, and universal links (https://drink-with-suds.com/join/{token})
  const url = Linking.useURL();
  const handledUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const target = url ?? pendingDeepLink;
    if (!target) return;

    if (!session) {
      const parsedUnauthed = Linking.parse(target);
      const joinToken = parseJoinToken(parsedUnauthed);
      if (joinToken && handledUrlRef.current !== target) {
        // Invite links are public: park the token for post-signup claim and
        // show the invite preview even before auth.
        handledUrlRef.current = target;
        pendingDeepLink = null;
        setPendingInviteToken(joinToken);
        track(AnalyticsEvents.InvitePendingStored, { source: 'deep_link' });
        router.push(`/join/${joinToken}` as never);
        return;
      }
      // Store other links so we can process them once auth resolves
      if (url) pendingDeepLink = url;
      return;
    }
    if (handledUrlRef.current === target) return;
    handledUrlRef.current = target;
    pendingDeepLink = null;

    const parsed = Linking.parse(target);
    const joinToken = parseJoinToken(parsed);
    if (joinToken) {
      router.push(`/join/${joinToken}` as never);
    } else if (parsed.hostname === 'session' && parsed.path === '/join') {
      const token = parsed.queryParams?.token as string | undefined;
      if (token) router.push(`/session/join/${token}` as never);
    } else if (parsed.hostname === 'log') {
      router.push('/(tabs)/log' as never);
    }
  }, [url, session]);

  // Deferred deep-link claim: a join token parked before sign-up is surfaced
  // once the user is fully onboarded, landing them in the inviter's session.
  const claimedInviteRef = useRef(false);
  useEffect(() => {
    if (!session || !profile?.onboarded || claimedInviteRef.current) return;
    claimedInviteRef.current = true;
    getPendingInviteToken().then((token) => {
      if (!token) return;
      clearPendingInviteToken();
      track(AnalyticsEvents.InviteClaimPrompted, {});
      router.push(`/join/${token}` as never);
    });
  }, [session, profile?.onboarded]);

  // Tie analytics events to the signed-in user
  useEffect(() => {
    identify(user?.id);
  }, [user?.id]);

  useEffect(() => {
    if (isLoading) return;

    const segs = segments as string[];
    const inAuthGroup = segs[0] === '(auth)';
    const isOnboarding = segs[0] === '(auth)' && segs[1] === 'onboarding';
    // Public routes: root index, terms, privacy, support, and open invite
    // landing pages (join links must work for people without accounts)
    const isPublicRoute = segs.length === 0 || ['terms', 'privacy', 'support', 'join'].includes(segs[0]);

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
        <Stack.Screen name="session/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="session/join/[token]" options={{ presentation: 'modal', title: 'Join Session' }} />
        <Stack.Screen name="join/[token]" options={{ title: 'Join the Night Out' }} />
        <Stack.Screen name="drink/edit/[id]" />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="user/edit" />
        <Stack.Screen name="notifications" />
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
