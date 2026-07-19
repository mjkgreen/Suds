import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { Avatar } from "@/components/common/Avatar";
import { useAuthStore } from "@/stores/authStore";
import { useActiveSession, useLeaveSession } from "@/hooks/useSession";
import { useOpenInvitePreview, useJoinByToken } from "@/hooks/useOpenInvite";
import { setPendingInviteToken } from "@/lib/pendingInvite";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/links";
import { AnalyticsEvents, track } from "@/lib/analytics";
import { formatDuration } from "@/utils/dateHelpers";
import { getDisplayName } from "@/utils/profileHelpers";

// Universal screen for open "night out" invite links.
// Same route serves three audiences:
//  - web visitors without the app → preview + store buttons (growth landing page)
//  - signed-out native users (fresh install from an invite) → park token, push sign-up
//  - signed-in members → one-tap join
export default function OpenInviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { session: authSession, user, profile } = useAuthStore();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const isWeb = Platform.OS === "web";

  const activeSession = useActiveSession();
  const { mutateAsync: leaveSession } = useLeaveSession();
  const { mutateAsync: joinByToken } = useJoinByToken();
  const { data, isLoading, error } = useOpenInvitePreview(token);
  const [joining, setJoining] = useState(false);

  const isAuthed = !!authSession && !!profile?.onboarded;

  useEffect(() => {
    if (token) {
      track(AnalyticsEvents.JoinPageViewed, { authed: isAuthed });
    }
  }, [token]);

  async function handleJoin() {
    if (!token) return;
    if (activeSession) {
      if (activeSession.my_role === "host") {
        Alert.alert(
          "Active Session",
          "You need to end your current session before joining another.",
          [{ text: "OK" }]
        );
        return;
      }
      if (user?.id) {
        await leaveSession({ sessionId: activeSession.id, userId: user.id });
      }
    }

    setJoining(true);
    try {
      const joined = await joinByToken(token);
      if (isWeb) {
        router.replace(`/session/${joined.id}` as never);
      } else {
        router.replace("/(tabs)/feed" as never);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to join session";
      Alert.alert("Could not join", msg);
    } finally {
      setJoining(false);
    }
  }

  async function handleSignUpToJoin(target: "sign-up" | "sign-in") {
    if (token) {
      await setPendingInviteToken(token);
      track(AnalyticsEvents.InvitePendingStored, {});
    }
    router.push(`/(auth)/${target}` as never);
  }

  if (isLoading) {
    return (
      <SafeAreaView className={`flex-1 items-center justify-center bg-background ${isDark ? "dark" : ""}`}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </SafeAreaView>
    );
  }

  if (error || !data || data.error) {
    const errKey = data?.error ?? "unknown";
    const messages: Record<string, string> = {
      not_found: "This invite link is invalid or has been revoked.",
      expired: "This invite link has expired.",
      session_ended: "This night out has already ended.",
      unknown: "Something went wrong.",
    };
    return (
      <SafeAreaView className={`flex-1 bg-background ${isDark ? "dark" : ""}`}>
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Ionicons name="alert-circle-outline" size={56} color={isDark ? "#9ca3af" : "#6b7280"} />
          <Text className="text-foreground text-xl font-bold text-center">Invite Unavailable</Text>
          <Text className="text-muted-foreground text-center text-base">
            {messages[errKey] ?? messages.unknown}
          </Text>
          <Pressable
            onPress={() => (isWeb ? router.replace("/" as never) : router.back())}
            className="mt-4 bg-primary rounded-full px-6 py-3"
          >
            <Text className="text-white font-bold">{isWeb ? "Learn about Suds" : "Go Back"}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { session, inviter, member_count } = data;
  const inviterName = getDisplayName(inviter);
  const elapsed = formatDuration(session.started_at, new Date().toISOString());

  return (
    <SafeAreaView className={`flex-1 bg-background ${isDark ? "dark" : ""}`}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6">
        <View style={{ width: "100%", maxWidth: 480, alignSelf: "center", flex: 1 }}>
          {/* Header */}
          <View className="items-center pt-10 pb-6 gap-3">
            <Avatar uri={inviter.avatar_url} name={inviterName} size={80} />
            <View className="items-center gap-1">
              <Text className="text-foreground text-2xl font-bold text-center">
                {inviterName} started a night out 🍻
              </Text>
              <Text className="text-muted-foreground text-base text-center">
                Join them on Suds
              </Text>
            </View>
          </View>

          {/* Session card */}
          <View className="bg-card border border-border rounded-2xl p-5 gap-3 mb-6">
            <View className="flex-row items-center gap-3">
              <View className="w-2 h-2 rounded-full bg-emerald-500" />
              <Text className="text-foreground text-lg font-bold flex-1" numberOfLines={1}>
                {session.title ?? "Night Out"}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Ionicons name="time-outline" size={16} color={isDark ? "#9ca3af" : "#6b7280"} />
              <Text className="text-muted-foreground text-sm">Started {elapsed} ago</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Ionicons name="people-outline" size={16} color={isDark ? "#9ca3af" : "#6b7280"} />
              <Text className="text-muted-foreground text-sm">
                {member_count} {member_count === 1 ? "person is" : "people are"} in
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View className="gap-3 pb-10">
            {isAuthed ? (
              <Pressable
                onPress={handleJoin}
                disabled={joining}
                className="bg-primary rounded-2xl py-4 items-center active:opacity-80"
              >
                {joining ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-base">Join the Night Out</Text>
                )}
              </Pressable>
            ) : isWeb ? (
              <>
                <Pressable
                  onPress={() => Linking.openURL(APP_STORE_URL)}
                  className="bg-primary rounded-2xl py-4 items-center active:opacity-80"
                >
                  <Text className="text-white font-bold text-base">Get Suds on the App Store</Text>
                </Pressable>
                <Pressable
                  onPress={() => Linking.openURL(PLAY_STORE_URL)}
                  className="bg-card border border-border rounded-2xl py-4 items-center active:opacity-80"
                >
                  <Text className="text-foreground font-semibold text-base">Get it on Google Play</Text>
                </Pressable>
                <Pressable
                  onPress={() => Linking.openURL(`suds://join/${token}`)}
                  className="py-3 items-center"
                >
                  <Text className="text-primary font-semibold text-sm">
                    Already have Suds? Open in the app
                  </Text>
                </Pressable>
                <Text className="text-muted-foreground text-xs text-center px-4">
                  After installing, tap this invite link again to land right in the session.
                </Text>
              </>
            ) : (
              <>
                <Pressable
                  onPress={() => handleSignUpToJoin("sign-up")}
                  className="bg-primary rounded-2xl py-4 items-center active:opacity-80"
                >
                  <Text className="text-white font-bold text-base">Sign up to join</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleSignUpToJoin("sign-in")}
                  className="bg-card border border-border rounded-2xl py-4 items-center active:opacity-80"
                >
                  <Text className="text-foreground font-semibold text-base">
                    I already have an account
                  </Text>
                </Pressable>
                <Text className="text-muted-foreground text-xs text-center px-4">
                  You'll land right in {inviterName}'s session after signing in.
                </Text>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
