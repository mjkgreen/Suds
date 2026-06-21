import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// expo-notifications requires a native dev-client or production build.
// We lazy-require inside effects so Expo Go doesn't crash at module load time.
type ExpoNotifications = typeof import('expo-notifications');

function getNotifications(): ExpoNotifications | null {
  try {
    return require('expo-notifications') as ExpoNotifications;
  } catch {
    return null;
  }
}

export function useNotifications({ userId }: { userId: string | undefined }): void {
  const registered = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web' || !userId || registered.current) return;

    const Notifications = getNotifications();
    if (!Notifications) return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    registerForPushNotificationsAsync(userId, Notifications).then(() => {
      registered.current = true;
    });

    const subscription = Notifications.addNotificationReceivedListener(() => {
      // Future: update in-app badge / invalidate notification queries
    });

    return () => subscription.remove();
  }, [userId]);
}

async function registerForPushNotificationsAsync(
  userId: string,
  Notifications: ExpoNotifications
): Promise<void> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    const result = await Notifications.getExpoPushTokenAsync({
      projectId: '12c7fee8-d880-4426-8732-0c6af1c9845a',
    });

    const token = result.data;
    if (!token) return;

    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform: Platform.OS as 'ios' | 'android',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'token' }
      );

    if (error) {
      console.error('Failed to register push token:', error.message);
    }
  } catch (err) {
    console.error('Push notification registration failed:', err);
  }
}
