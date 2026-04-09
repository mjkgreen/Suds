import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function AuthCallback() {
  const router = useRouter();
  const { session, isLoading } = useAuth();

  useEffect(() => {
    // Wait for auth to settle
    if (isLoading) return;

    // If we have a session, redirect to home
    if (session) {
      router.replace('/(tabs)/feed');
      return;
    }

    // Otherwise go back to sign in
    router.replace('/(auth)/sign-in');
  }, [session, isLoading]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#f59e0b" />
    </View>
  );
}
