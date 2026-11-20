import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { createPushRegistration } from '@/lib/pushRegistration';
import { useSessionStore } from '@/stores/sessionStore';
import { joinedSessionFromRpc } from '@/hooks/useSessionInvite';

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

let pushRegistration: ReturnType<typeof createPushRegistration> | null = null;

function getPushRegistration(Notifications: ExpoNotifications) {
  if (!pushRegistration) {
    pushRegistration = createPushRegistration({
      notifications: Notifications,
      projectId: EAS_PROJECT_ID,
      // Android 13+ won't show the permission prompt (or deliver anything)
      // until a channel exists.
      prepare: Platform.OS === 'android'
        ? async () => {
            await Notifications.setNotificationChannelAsync('default', {
              name: 'Default',
              importance: Notifications.AndroidImportance.HIGH,
              sound: 'default',
            });
          }
        : undefined,
      saveToken: async (token) => {
        const { error } = await supabase.rpc('upsert_push_token', {
          p_token: token,
          p_platform: Platform.OS as 'ios' | 'android',
        });
        return error ? error.message : null;
      },
    });
  }
  return pushRegistration;
}

/**
 * Category for session invite pushes: adds Join / Decline buttons to the
 * notification. The push must carry the same categoryId (see the
 * send-push-notification edge function).
 */
export const SESSION_INVITE_CATEGORY = 'session_invite';
const ACTION_JOIN = 'JOIN_SESSION';
const ACTION_DECLINE = 'DECLINE_SESSION';

let categoriesRegistered = false;

async function registerCategories(Notifications: ExpoNotifications) {
  if (categoriesRegistered) return;
  categoriesRegistered = true;
  try {
    await Notifications.setNotificationCategoryAsync(SESSION_INVITE_CATEGORY, [
      {
        identifier: ACTION_JOIN,
        buttonTitle: 'Join',
        options: { opensAppToForeground: true },
      },
      {
        identifier: ACTION_DECLINE,
        buttonTitle: 'Decline',
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ]);
  } catch (err) {
    categoriesRegistered = false;
    console.error('Failed to register notification categories:', err);
  }
}

/** Notification taps already routed, so a cold-start tap isn't handled twice. */
const handledResponses = new Set<string>();

/**
 * Where a tapped notification wants to go. Held until the navigator is mounted
 * and the user is past the launch/sign-in screens: a cold-start tap arrives
 * before then, and pushing at that point was dropped (or undone by the
 * redirect to the feed).
 */
let pendingRoute: string | null = null;

export function useNotifications({
  userId,
  ready,
}: {
  userId: string | undefined;
  /** True once the app is showing a signed-in screen and can be navigated. */
  ready: boolean;
}): void {
  const router = useRouter();
  const queryClient = useQueryClient();
  const readyRef = useRef(ready);
  readyRef.current = ready;

  function navigate(route: string) {
    if (readyRef.current) {
      router.push(route as never);
    } else {
      pendingRoute = route;
    }
  }

  // Flush a route that arrived before the app could navigate.
  useEffect(() => {
    if (!ready || !pendingRoute) return;
    const route = pendingRoute;
    pendingRoute = null;
    router.push(route as never);
  }, [ready]);

  useEffect(() => {
    if (!userId) return;
    const Notifications = getNotifications();
    if (!Notifications) return;

    void registerCategories(Notifications);

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
    const registration = getPushRegistration(Notifications);
    void registration.register(userId);

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
          if (data.drink_log_id) navigate(`/drink/${data.drink_log_id}`);
          break;
        case 'follow':
        case 'follow_request_accepted':
          if (data.actor_id) navigate(`/user/${data.actor_id}`);
          break;
        case 'follow_request':
          navigate('/user/requests');
          break;
        case 'share_link_join':
          // Someone joined your night out through its link.
          if (data.session_id) navigate(`/session/${data.session_id}`);
          break;
        case 'invite_accepted':
          // Requests wait in the approval queue; follows go to their profile.
          if (data.follow_status === 'requested') navigate('/user/requests');
          else if (data.actor_id) navigate(`/user/${data.actor_id}`);
          break;
        case 'session_invite': {
          const token = data.invite_token;
          if (!token) break;
          if (response.actionIdentifier === ACTION_JOIN) {
            void joinFromNotification(token);
          } else if (response.actionIdentifier === ACTION_DECLINE) {
            void declineFromNotification(token);
          } else {
            // Plain tap: open the invite so they can accept or decline.
            navigate(`/session/join/${token}`);
          }
          break;
        }
      }
    }

    /**
     * "Join" pressed on the notification. Accepts straight away when that's
     * safe; otherwise (already in a session, invite expired, …) opens the
     * invite screen, which explains what's going on and offers the choice.
     */
    async function joinFromNotification(token: string) {
      const inviteRoute = `/session/join/${token}`;
      if (useSessionStore.getState().activeSession) {
        navigate(inviteRoute);
        return;
      }
      try {
        const { data, error } = await supabase.rpc('accept_session_invite', { p_token: token });
        if (error) throw error;
        const result = data as Record<string, unknown> | null;
        if (!result || result.error) throw new Error(String(result?.error ?? 'unknown'));
        const session = joinedSessionFromRpc(result);
        useSessionStore.getState().setActiveSession(session);
        queryClient.invalidateQueries({ queryKey: ['openSession'] });
        queryClient.invalidateQueries({ queryKey: ['sessionMembers', session.id] });
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        queryClient.invalidateQueries({ queryKey: ['invitePreview'] });
        navigate(`/session/${session.id}`);
      } catch (err) {
        console.error('Accepting session invite from notification failed:', err);
        navigate(inviteRoute);
      }
    }

    async function declineFromNotification(token: string) {
      try {
        const { error } = await supabase
          .from('session_invites')
          .update({ status: 'declined' })
          .eq('token', token)
          .eq('invitee_id', userId!)
          .eq('status', 'pending');
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['invitePreview'] });
      } catch (err) {
        console.error('Declining session invite from notification failed:', err);
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

    // Expo/APNs/FCM can rotate the token while the app is running. Our own
    // token fetch fires this listener too; onDevicePushToken ignores those
    // (see pushRegistration.ts for the loop this used to cause).
    const tokenSub = Notifications.addPushTokenListener((event) => {
      void registration.onDevicePushToken(userId, event);
    });

    return () => {
      receivedSub.remove();
      tapSub.remove();
      tokenSub.remove();
    };
  }, [userId]);
}

/**
 * Detaches this device from the signed-in account so it stops receiving that
 * account's pushes. Call before signing out, while the session is still valid.
 */
export async function unregisterPushToken(): Promise<void> {
  const token = pushRegistration?.reset() ?? null;
  if (!token) return;
  try {
    await supabase.from('push_tokens').delete().eq('token', token);
  } catch {
    // Best-effort — sign-out must not fail because of this.
  }
}
