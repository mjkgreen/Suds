import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { JoinSessionView } from "@/components/session/JoinSessionView";
import {
  useAcceptSessionInvite,
  useDeclineSessionInvite,
  useInviteByToken,
  useMakeRoomToJoin,
} from "@/hooks/useSessionInvite";
import { getDisplayName } from "@/utils/profileHelpers";

export default function JoinSessionScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const { activeSession, prepare, isLeaving } = useMakeRoomToJoin();
  const { mutateAsync: acceptInvite, isPending: isAccepting } = useAcceptSessionInvite();
  const { mutateAsync: declineInvite, isPending: isDeclining } = useDeclineSessionInvite();

  const { data, isLoading, error } = useInviteByToken(token);
  const [joining, setJoining] = useState(false);

  async function handleJoin() {
    if (!token) return;
    // Host must end their own session first; guests auto-leave.
    if (!(await prepare())) return;

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

  const isWorking = joining || isAccepting || isLeaving || isDeclining;

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

  return (
    <JoinSessionView
      inviterName={getDisplayName(inviter)}
      inviterAvatarUrl={inviter.avatar_url}
      sessionTitle={session.title}
      startedAt={session.started_at}
      activeSession={activeSession}
      onPrimary={handleJoin}
      secondaryLabel="Decline"
      onSecondary={handleDecline}
      isWorking={isWorking}
    />
  );
}
