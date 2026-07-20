import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useCallback, useEffect, useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/common/Avatar";
import { useIncomingFollowRequests } from "@/hooks/useFollow";
import { useInAppNotifications, useMarkNotificationsRead } from "@/hooks/useInAppNotifications";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { InAppNotification } from "@/types/models";
import { relativeTime } from "@/utils/dateHelpers";

function notificationText(n: InAppNotification): string {
  const name = n.actor_name ?? "Someone";
  switch (n.type) {
    case "like":    return `${name} liked your drink`;
    case "comment": return n.context.comment_preview ? `${name}: ${n.context.comment_preview}` : `${name} commented on your drink`;
    case "follow":  return `${name} started following you`;
    case "follow_request": return `${name} requested to follow you`;
    case "follow_request_accepted": return `${name} accepted your follow request`;
    case "session_invite": return `${name} invited you to join their session`;
  }
}

interface ActorProfile {
  id: string;
  avatar_url: string | null;
  display_name: string | null;
  username: string;
}

function useActorProfiles(actorIds: string[]) {
  return useQuery({
    queryKey: ["actorProfiles", actorIds.slice().sort().join(",")],
    queryFn: async (): Promise<Record<string, ActorProfile>> => {
      if (actorIds.length === 0) return {};
      const { data, error } = await supabase
        .from("profiles")
        .select("id, avatar_url, display_name, username")
        .in("id", actorIds);
      if (error) throw new Error(error.message);
      return Object.fromEntries(((data as ActorProfile[] | null) ?? []).map((p) => [p.id, p]));
    },
    enabled: actorIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

const NotificationSeparator = () => <View className="h-px bg-border mx-4" />;

const NotificationRow = React.memo(function NotificationRow({
  notification,
  actorProfile,
}: {
  notification: InAppNotification;
  actorProfile?: ActorProfile;
}) {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const avatarName = actorProfile?.display_name ?? actorProfile?.username ?? notification.actor_name ?? "?";

  function handlePress() {
    switch (notification.type) {
      case "like":
      case "comment":
        if (notification.context.drink_log_id) router.push(`/drink/${notification.context.drink_log_id}` as never);
        break;
      case "follow":
      case "follow_request_accepted":
        if (notification.actor_id) router.push(`/user/${notification.actor_id}` as never);
        break;
      case "follow_request":
        router.push("/user/requests" as never);
        break;
      case "session_invite":
        if (notification.context.invite_token) router.push(`/session/join/${notification.context.invite_token}` as never);
        break;
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      className={`flex-row items-center px-4 py-3 gap-3 ${notification.read ? "" : isDark ? "bg-amber-950/30" : "bg-amber-50"}`}
    >
      <Avatar uri={actorProfile?.avatar_url ?? null} name={avatarName} size={44} />
      <View className="flex-1">
        <Text className="text-foreground text-sm" numberOfLines={2}>
          {notificationText(notification)}
        </Text>
        <Text className="text-muted-foreground text-xs mt-0.5">
          {relativeTime(notification.created_at)}
        </Text>
      </View>
      {!notification.read && (
        <View className="w-2 h-2 rounded-full bg-primary" />
      )}
    </Pressable>
  );
});

export default function NotificationsScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { user } = useAuthStore();
  const { data: notifications, isLoading, refetch, isRefetching } = useInAppNotifications();
  const { data: followRequests } = useIncomingFollowRequests(user?.id);
  const { mutate: markRead } = useMarkNotificationsRead();

  useEffect(() => {
    markRead();
  }, []);

  const actorIds = useMemo(
    () => [...new Set((notifications ?? []).map((n) => n.actor_id).filter(Boolean) as string[])],
    [notifications]
  );
  const { data: actorProfiles = {} } = useActorProfiles(actorIds);

  const renderItem = useCallback(({ item }: { item: InAppNotification }) => (
    <NotificationRow
      notification={item}
      actorProfile={item.actor_id ? actorProfiles[item.actor_id] : undefined}
    />
  ), [actorProfiles]);

  const header = (
    <View className={`flex-row items-center px-2 py-3 border-b ${isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"}`}>
      <Pressable onPress={() => router.back()} hitSlop={8} className="p-2">
        <Ionicons name="chevron-back" size={24} color={isDark ? "#f9fafb" : "#111827"} />
      </Pressable>
      <Text className={`text-base font-semibold flex-1 ${isDark ? "text-gray-100" : "text-gray-900"}`}>
        Notifications
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        {header}
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      </SafeAreaView>
    );
  }

  const requestCount = followRequests?.length ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {header}
      {requestCount > 0 && (
        <Pressable
          onPress={() => router.push("/user/requests" as never)}
          className="flex-row items-center px-4 py-3 gap-3 border-b border-border active:bg-accent"
        >
          <View className="w-11 h-11 rounded-full bg-primary/15 items-center justify-center">
            <Ionicons name="person-add" size={20} color="#f59e0b" />
          </View>
          <View className="flex-1">
            <Text className="text-foreground text-sm font-semibold">Follow Requests</Text>
            <Text className="text-muted-foreground text-xs mt-0.5">
              {requestCount} pending {requestCount === 1 ? "request" : "requests"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={isDark ? "#6b7280" : "#9ca3af"} />
        </Pressable>
      )}
      <FlatList
        data={notifications ?? []}
        keyExtractor={(n) => n.id}
        renderItem={renderItem}
        ItemSeparatorComponent={NotificationSeparator}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Ionicons name="notifications-outline" size={48} color={isDark ? "#4b5563" : "#9ca3af"} />
            <Text className="text-muted-foreground text-base mt-3">No notifications yet</Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#f59e0b" />}
      />
    </SafeAreaView>
  );
}
