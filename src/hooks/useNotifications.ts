import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';

// Register once at module scope so the handler is active before any notification arrives
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function useNotifications({ userId }: { userId: string | undefined }): void {
  const registered = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web' || !userId || registered.current) return;

    registerForPushNotificationsAsync(userId).then(() => {
      registered.current = true;
    });

    const subscription = Notifications.addNotificationReceivedListener(() => {
      // Future: update in-app badge / invalidate notification queries
    });

    return () => subscription.remove();
  }, [userId]);
}

async function registerForPushNotificationsAsync(userId: string): Promise<void> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return;
  }

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
}
