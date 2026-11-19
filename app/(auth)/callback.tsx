import { useEffect, useSyncExternalStore } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { homeRoute, pendingInvites } from '@/hooks/useShareLinks';

export default function AuthCallback() {
  const router = useRouter();
  const { session, isLoading } = useAuth();
  // An OAuth or email-confirmation redirect reloads the app; the invite link
  // the person signed up from is read back from storage first.
  const inviteLoaded = useSyncExternalStore(pendingInvites.subscribe, pendingInvites.isLoaded, () => true);

  useEffect(() => {
    // Wait for auth to settle
    if (isLoading || !inviteLoaded) return;

    // If we have a session, redirect to home (or the invite they came from).
    // Not onboarded yet? The root layout sends them to onboarding instead.
    if (session) {
      router.replace(homeRoute() as never);
      return;
    }

    // Otherwise go back to sign in
    router.replace('/(auth)/sign-in');
  }, [session, isLoading, inviteLoaded]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#f59e0b" />
    </View>
  );
}
