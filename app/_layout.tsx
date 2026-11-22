import '../global.css';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, useColorScheme as useReactNativeColorScheme } from 'react-native';
import * as Linking from 'expo-linking';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/lib/queryClient';
import { persistOptions } from '@/lib/offlineCache';
import { retryProfileLoad, useAuth, useAuthBootstrap } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { useColorScheme } from 'nativewind';
import { useThemeStore } from '@/stores/themeStore';
import { useNotifications } from '@/hooks/useNotifications';
import { useNotificationRealtime } from '@/hooks/useInAppNotifications';
import { useSessionRealtime } from '@/hooks/useSessionRealtime';
import { useLegalAgeGate } from '@/hooks/useLegalAgeGate';
import { AgeRestrictedScreen } from '@/components/common/AgeRestrictedScreen';
import { homeRoute, pendingInvites } from '@/hooks/useShareLinks';
import { inviteTokenFromUrl } from '@/lib/shareLinks';
import { GetAppBar } from '@/components/web/GetAppBar';

// Pages anyone can read without an account. On web these also render while
// auth is still loading, so the static export holds their real content for
// search engines and AI crawlers (which mostly don't run JavaScript).
// `invite` is a share link (/invite/<token>): it previews the night out or
// invite to people without an account, in the app as well as on the web.
const PUBLIC_PAGES = ['terms', 'privacy', 'support', 'about', 'invite'];

function isPublicRoute(segs: string[]) {
  // The root is the marketing page on web; on native it's just a launch spinner.
  return (segs.length === 0 && Platform.OS === 'web') || PUBLIC_PAGES.includes(segs[0]);
}

// Module-level store for deep links that arrive before auth resolves
let pendingDeepLink: string | null = null;

// An invite link opened while signed out survives sign-up, onboarding and
// OAuth redirects in storage (src/lib/pendingInvite.ts); read it at launch.
void pendingInvites.load();

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
  useAuthBootstrap();
  const { session, isLoading, signOut } = useAuth();
  const { user, profile, profileError } = useAuthStore();
  // People who aren't of legal drinking age where they are can't use the app.
  const ageGate = useLegalAgeGate(user?.id, profile?.birthdate, !!session && !!profile?.onboarded);
  const segments = useSegments();
  const router = useRouter();
  const pendingInviteLoaded = useSyncExternalStore(pendingInvites.subscribe, pendingInvites.isLoaded, () => true);

  // Notification taps can navigate once a signed-in screen is showing (not
  // the launch spinner at the root, which is about to be replaced by the feed).
  const segs = segments as string[];
  const canNavigate =
    !!session && !!profile?.onboarded && segs.length > 0 && segs[0] !== '(auth)';
  useNotifications({ userId: user?.id, ready: canNavigate });
  useNotificationRealtime();
  useSessionRealtime(user?.id);

  // Deep link handler: suds://session/join?token=xxx and suds://log
  const url = Linking.useURL();
  const handledUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const target = url ?? pendingDeepLink;
    if (!target || !session) {
      // Store link so we can process it once auth resolves
      if (url && !session) pendingDeepLink = url;
      return;
    }
    if (handledUrlRef.current === target) return;
    handledUrlRef.current = target;
    pendingDeepLink = null;

    const parsed = Linking.parse(target);
    if (inviteTokenFromUrl(target)) {
      // Share links (https://drink-with-suds.com/invite/<t> or suds://invite/<t>)
      // map straight to the /invite/[token] route; expo-router opens it.
    } else if (parsed.hostname === 'session' && parsed.path === '/join') {
      const token = parsed.queryParams?.token as string | undefined;
      if (token) router.push(`/session/join/${token}` as never);
    } else if (parsed.hostname === 'log') {
      router.push('/(tabs)/log' as never);
    }
  }, [url, session]);

  useEffect(() => {
    // Wait for a saved invite too, so a fresh sign-in goes to it, not the feed.
    if (isLoading || !pendingInviteLoaded) return;

    const segs = segments as string[];
    const inAuthGroup = segs[0] === '(auth)';
    const isOnboarding = segs[0] === '(auth)' && segs[1] === 'onboarding';
    if (!session && !inAuthGroup && !isPublicRoute(segs)) {
      router.replace('/(auth)/sign-in');
    } else if (session) {
      if (profile && !profile.onboarded) {
        if (!isOnboarding) {
          // Signed up from an invite link: come back to it after onboarding.
          if (segs[0] === 'invite' && segs[1]) void pendingInvites.save(segs[1]);
          // @ts-ignore
          router.replace('/(auth)/onboarding');
        }
      } else if (profile && profile.onboarded && (inAuthGroup || segs.length === 0)) {
        // Signed-in users on the auth screens or the root go to the feed, or
        // to the invite link they opened before signing up.
        router.replace(homeRoute() as never);
      }
      // If we have a session but no profile yet, wait for profile to fetch
    }
  }, [session, profile, isLoading, segments, pendingInviteLoaded]);

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Public web pages don't need auth to render, so don't hide them behind the
  // spinner. Signed-in visitors to the root are still sent to the feed once
  // auth resolves.
  const showPublicPageWhileLoading = Platform.OS === 'web' && isPublicRoute(segments as string[]);

  if (isLoading && !showPublicPageWhileLoading) {
    return (
      <View className={`flex-1 items-center justify-center bg-background ${isDark ? 'dark' : ''}`}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  // Signed in, but the profile couldn't load and nothing is cached (e.g. first
  // launch after updating, with no signal). Offer a retry — not the sign-in screen.
  if (session && !profile && profileError) {
    return (
      <View className={`flex-1 items-center justify-center bg-background px-8 ${isDark ? 'dark' : ''}`}>
        <Text className="text-foreground text-lg font-semibold text-center">Couldn't load your account</Text>
        <Text className="text-muted-foreground text-sm text-center mt-2">
          Check your connection and try again. You're still signed in.
        </Text>
        <Pressable onPress={retryProfileLoad} className="mt-6 bg-primary rounded-xl px-6 py-3 active:opacity-90">
          <Text className="text-primary-foreground font-semibold">Try again</Text>
        </Pressable>
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
        <Stack.Screen name="invite/[token]" />
        <Stack.Screen name="drink/edit/[id]" />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="user/edit" />
        <Stack.Screen name="user/requests" />
        <Stack.Screen name="browse" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="support" />
        <Stack.Screen name="about" />
      </Stack>
      {Platform.OS === 'web' && !session && <GetAppBar />}
      {/* Covers the app (rather than replacing the navigator, which would
          make the redirects above loop) for people under the legal age. */}
      {ageGate.blocked && !showPublicPageWhileLoading && (
        <View style={StyleSheet.absoluteFill}>
          <AgeRestrictedScreen
            minimumAge={ageGate.blocked.minimumAge}
            place={ageGate.blocked.place}
            checking={ageGate.checking}
            onCheckAgain={ageGate.recheck}
            onSignOut={signOut}
          />
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
            <ThemeSync />
            <AuthGuard />
          </PersistQueryClientProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
