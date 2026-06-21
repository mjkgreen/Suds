import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { Avatar } from "@/components/common/Avatar";
import { useAuthStore } from "@/stores/authStore";
import { useActiveSession, useEndSession, useLeaveSession } from "@/hooks/useSession";
import { useInviteByToken, useAcceptSessionInvite, useDeclineSessionInvite } from "@/hooks/useSessionInvite";
import { formatDuration } from "@/utils/dateHelpers";
import { getDisplayName } from "@/utils/profileHelpers";

export default function JoinSessionScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const activeSession = useActiveSession();
  const { mutateAsync: endSession, isPending: isEnding } = useEndSession();
  const { mutateAsync: leaveSession, isPending: isLeaving } = useLeaveSession();
  const { mutateAsync: acceptInvite, isPending: isAccepting } = useAcceptSessionInvite();
  const { mutateAsync: declineInvite, isPending: isDeclining } = useDeclineSessionInvite();

  const { data, isLoading, error } = useInviteByToken(token);
  const [joining, setJoining] = useState(false);

  async function handleJoin() {
    if (!token) return;

    // Host must end their own session first; guests can auto-leave
    if (activeSession) {
      if (activeSession.my_role === "host") {
        Alert.alert(
          "Active Session",
          "You need to end your current session before joining another.",
          [{ text: "OK" }]
        );
        return;
      }
      // Auto-leave guest session
      if (user?.id) {
        await leaveSession({ sessionId: activeSession.id, userId: user.id });
      }
    }

    setJoining(true);
    try {
      await acceptInvite(token);
      router.back();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to join session";
      Alert.alert("Could not join", msg);
    } finally {
      setJoining(false);
    }
  }

  async function handleDecline() {
    if (!data || "error" in data) return;
    await declineInvite(data.invite.id);
    router.back();
  }

  const isWorking = joining || isAccepting || isLeaving || isDeclining || isEnding;

  if (isLoading) {
    return (
      <SafeAreaView className={`flex-1 items-center justify-center bg-background ${isDark ? "dark" : ""}`}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </SafeAreaView>
    );
  }

  if (error || !data || (data as { error?: string }).error) {
    const errKey = (data as { error?: string })?.error ?? "unknown";
    const messages: Record<string, string> = {
      not_found: "This invite link is invalid or has already been used.",
      expired: "This invite has expired.",
      not_your_invite: "This invite was not sent to you.",
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
            onPress={() => router.back()}
            className="mt-4 bg-primary rounded-full px-6 py-3"
          >
            <Text className="text-white font-bold">Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { session, inviter } = data;
  const elapsed = formatDuration(session.started_at, new Date().toISOString());
  const inviterName = getDisplayName(inviter);

  return (
    <SafeAreaView className={`flex-1 bg-background ${isDark ? "dark" : ""}`}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6">
        {/* Header */}
        <View className="items-center pt-8 pb-6 gap-3">
          <Avatar
            uri={inviter.avatar_url}
            name={inviterName}
            size={72}
          />
          <View className="items-center gap-1">
            <Text className="text-foreground text-xl font-bold text-center">
              {inviterName} invited you
            </Text>
            <Text className="text-muted-foreground text-sm text-center">
              to join their session
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
            <Text className="text-muted-foreground text-sm">
              Started {elapsed} ago
            </Text>
          </View>
        </View>

        {/* Warning if user has an active session */}
        {activeSession && (
          <View className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 flex-row items-start gap-3">
            <Ionicons name="warning-outline" size={18} color="#f59e0b" />
            <Text className="text-amber-700 dark:text-amber-400 text-sm flex-1">
              {activeSession.my_role === "host"
                ? `You're hosting "${activeSession.title ?? "a session"}". End it before joining another.`
                : `You're in "${activeSession.title ?? "a session"}". You'll automatically leave it when you join.`}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View className="gap-3 pb-8">
          <Pressable
            onPress={handleJoin}
            disabled={isWorking}
            className="bg-primary rounded-2xl py-4 items-center active:opacity-80"
          >
            {isWorking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">Join Session</Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleDecline}
            disabled={isWorking}
            className="bg-card border border-border rounded-2xl py-4 items-center active:opacity-80"
          >
            <Text className="text-foreground font-semibold text-base">Decline</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
