import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
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
  const router = useRouter();
  const queryClient = useQueryClient();

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

    registerForPushNotificationsAsync(Notifications).then(() => {
      registered.current = true;
    });

    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: ['inAppNotifications'] });
    });

    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (!data?.type) return;

      switch (data.type) {
        case 'like':
        case 'comment':
          if (data.drink_log_id) router.push(`/drink/${data.drink_log_id}` as never);
          break;
        case 'follow':
          if (data.actor_id) router.push(`/user/${data.actor_id}` as never);
          break;
        case 'session_invite':
          if (data.invite_token) {
            // Go through the deep link handler so pendingDeepLink works if auth hasn't resolved
            Linking.openURL(`suds://session/join?token=${data.invite_token}`);
          }
          break;
      }
    });

    return () => {
      receivedSub.remove();
      tapSub.remove();
    };
  }, [userId]);
}

async function registerForPushNotificationsAsync(
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

    const { error } = await supabase.rpc('upsert_push_token', {
      p_token: token,
      p_platform: Platform.OS as 'ios' | 'android',
    });

    if (error) {
      console.error('Failed to register push token:', error.message);
    }
  } catch (err) {
    console.error('Push notification registration failed:', err);
  }
}
