import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// expo-notifications requires a native dev-client or production build.
// We lazy-require inside effects so Expo Go doesn't crash at module load time.
type ExpoNotifications = typeof import('expo-notifications');
type NotificationResponse = import('expo-notifications').NotificationResponse;

const EAS_PROJECT_ID = '12c7fee8-d880-4426-8732-0c6af1c9845a';

function getNotifications(): ExpoNotifications | null {
  if (Platform.OS === 'web') return null;
  try {
    return require('expo-notifications') as ExpoNotifications;
  } catch {
    return null;
  }
}

/** The Expo push token registered for the signed-in user on this device. */
let registeredToken: string | null = null;
/** Which user `registeredToken` was registered for. */
let registeredForUser: string | null = null;
/** Registration already running, so overlapping triggers share one call. */
let registrationInFlight: Promise<void> | null = null;

/** Notification taps already routed, so a cold-start tap isn't handled twice. */
const handledResponses = new Set<string>();

export function useNotifications({ userId }: { userId: string | undefined }): void {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const Notifications = getNotifications();
    if (!Notifications) return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Runs for every sign-in (including switching accounts), so the token
    // always belongs to whoever is signed in now.
    registerForPushNotificationsAsync(Notifications, userId);

    function handleResponse(response: NotificationResponse) {
      const id = response.notification.request.identifier;
      if (handledResponses.has(id)) return;
      handledResponses.add(id);

      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (!data?.type) return;

      switch (data.type) {
        case 'like':
        case 'comment':
        case 'mention':
        case 'tag':
          if (data.drink_log_id) router.push(`/drink/${data.drink_log_id}` as never);
          break;
        case 'follow':
        case 'follow_request_accepted':
          if (data.actor_id) router.push(`/user/${data.actor_id}` as never);
          break;
        case 'follow_request':
          router.push('/user/requests' as never);
          break;
        case 'session_invite':
          if (data.invite_token) {
            // Go through the deep link handler so pendingDeepLink works if auth hasn't resolved
            Linking.openURL(`suds://session/join?token=${data.invite_token}`);
          }
          break;
      }
    }

    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: ['inAppNotifications'] });
    });
    const tapSub = Notifications.addNotificationResponseReceivedListener(handleResponse);

    // A tap that launched the app from a killed state fires before this
    // listener exists — pick it up here.
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handleResponse(response);
      })
      .catch(() => {});

    // Expo/APNs/FCM can rotate the token while the app is running.
    // getExpoPushTokenAsync() itself fires this listener, so without the
    // same-token check in registerForPushNotificationsAsync this would loop:
    // register → listener → register … each one an upsert on the database.
    const tokenSub = Notifications.addPushTokenListener(() => {
      registerForPushNotificationsAsync(Notifications, userId);
    });

    return () => {
      receivedSub.remove();
      tapSub.remove();
      tokenSub.remove();
    };
  }, [userId]);
}

function registerForPushNotificationsAsync(Notifications: ExpoNotifications, userId: string): Promise<void> {
  if (!registrationInFlight) {
    registrationInFlight = doRegister(Notifications, userId).finally(() => {
      registrationInFlight = null;
    });
  }
  return registrationInFlight;
}

async function doRegister(Notifications: ExpoNotifications, userId: string): Promise<void> {
  try {
    // Android 13+ won't show the permission prompt (or deliver anything)
    // until a channel exists.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    const result = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });

    const token = result.data;
    if (!token) return;
    // Already registered for this user — nothing to write.
    if (token === registeredToken && registeredForUser === userId) return;

    const { error } = await supabase.rpc('upsert_push_token', {
      p_token: token,
      p_platform: Platform.OS as 'ios' | 'android',
    });

    if (error) {
      console.error('Failed to register push token:', error.message);
      return;
    }
    registeredToken = token;
    registeredForUser = userId;
  } catch (err) {
    console.error('Push notification registration failed:', err);
  }
}

/**
 * Detaches this device from the signed-in account so it stops receiving that
 * account's pushes. Call before signing out, while the session is still valid.
 */
export async function unregisterPushToken(): Promise<void> {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  registeredForUser = null;
  try {
    await supabase.from('push_tokens').delete().eq('token', token);
  } catch {
    // Best-effort — sign-out must not fail because of this.
  }
}
