import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { Avatar } from "@/components/common/Avatar";
import { SessionWithRole } from "@/types/models";
import { formatDuration } from "@/utils/dateHelpers";

interface MemberPreview {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface JoinSessionViewProps {
  inviterName: string;
  inviterAvatarUrl: string | null;
  /** Under the "<name> invited you" heading. */
  subtitle?: string;
  sessionTitle: string | null;
  startedAt: string;
  /** Others already there (shown as avatars). */
  members?: MemberPreview[];
  /** The night out the viewer is in now, if any (shows the host/guest warning). */
  activeSession: SessionWithRole | null;
  /** e.g. "Joining also sends Sam a follow request." */
  note?: string;
  primaryLabel?: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  isWorking: boolean;
}

/**
 * The "join this night out" screen, shared by direct invites
 * (/session/join/[token]) and share links (/invite/[token]).
 */
export function JoinSessionView({
  inviterName,
  inviterAvatarUrl,
  subtitle = "to join their session",
  sessionTitle,
  startedAt,
  members,
  activeSession,
  note,
  primaryLabel = "Join Session",
  onPrimary,
  secondaryLabel,
  onSecondary,
  isWorking,
}: JoinSessionViewProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const elapsed = formatDuration(startedAt, new Date().toISOString());

  return (
    <SafeAreaView className={`flex-1 bg-background ${isDark ? "dark" : ""}`}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6">
        {/* Header */}
        <View className="items-center pt-8 pb-6 gap-3">
          <Avatar uri={inviterAvatarUrl} name={inviterName} size={72} />
          <View className="items-center gap-1">
            <Text className="text-foreground text-xl font-bold text-center">
              {inviterName} invited you
            </Text>
            <Text className="text-muted-foreground text-sm text-center">{subtitle}</Text>
          </View>
        </View>

        {/* Session card */}
        <View className="bg-card border border-border rounded-2xl p-5 gap-3 mb-6">
          <View className="flex-row items-center gap-3">
            <View className="w-2 h-2 rounded-full bg-emerald-500" />
            <Text className="text-foreground text-lg font-bold flex-1" numberOfLines={1}>
              {sessionTitle ?? "Night Out"}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Ionicons name="time-outline" size={16} color={isDark ? "#9ca3af" : "#6b7280"} />
            <Text className="text-muted-foreground text-sm">Started {elapsed} ago</Text>
          </View>
          {!!members?.length && (
            <View className="flex-row items-center gap-2">
              <View className="flex-row">
                {members.slice(0, 5).map((m, i) => (
                  <View key={m.user_id} style={{ marginLeft: i > 0 ? -8 : 0 }} className="border-2 border-card rounded-full">
                    <Avatar uri={m.avatar_url} name={m.display_name ?? m.username} size={26} />
                  </View>
                ))}
              </View>
              <Text className="text-muted-foreground text-sm flex-1" numberOfLines={1}>
                {members.length === 1 ? "1 person here" : `${members.length} people here`}
              </Text>
            </View>
          )}
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

        {!!note && <Text className="text-muted-foreground text-xs text-center mb-4">{note}</Text>}

        {/* Actions */}
        <View className="gap-3 pb-8">
          <Pressable
            onPress={onPrimary}
            disabled={isWorking}
            className="bg-primary rounded-2xl py-4 items-center active:opacity-80"
          >
            {isWorking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">{primaryLabel}</Text>
            )}
          </Pressable>

          {!!secondaryLabel && onSecondary && (
            <Pressable
              onPress={onSecondary}
              disabled={isWorking}
              className="bg-card border border-border rounded-2xl py-4 items-center active:opacity-80"
            >
              <Text className="text-foreground font-semibold text-base">{secondaryLabel}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
