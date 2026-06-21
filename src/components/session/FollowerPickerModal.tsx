import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useColorScheme } from "nativewind";
import { Avatar } from "@/components/common/Avatar";
import { useFollowing } from "@/hooks/useFollow";
import { useInviteToSession } from "@/hooks/useSessionMembers";
import { useAuthStore } from "@/stores/authStore";
import { Profile, SessionInvite, SessionMember } from "@/types/models";
import { getDisplayName, getUsername } from "@/utils/profileHelpers";

interface FollowerPickerModalProps {
  visible: boolean;
  onClose: () => void;
  sessionId: string;
  currentInvites: SessionInvite[];
  currentMembers: SessionMember[];
}

export function FollowerPickerModal({
  visible,
  onClose,
  sessionId,
  currentInvites,
  currentMembers,
}: FollowerPickerModalProps) {
  const { user } = useAuthStore();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [search, setSearch] = useState("");

  const { data: following, isLoading } = useFollowing(visible ? user?.id : undefined);
  const { mutate: sendInvite, isPending: isSending } = useInviteToSession();

  // Track which invitee IDs are currently in-flight so button updates immediately
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const memberIds = useMemo(() => new Set(currentMembers.map((m) => m.user_id)), [currentMembers]);
  const invitedIds = useMemo(
    () =>
      new Set(
        currentInvites
          .filter((i) => i.status === "pending" || i.status === "accepted")
          .map((i) => i.invitee_id)
      ),
    [currentInvites]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return (following ?? []) as Profile[];
    return ((following ?? []) as Profile[]).filter((p) => {
      const name = getDisplayName(p)?.toLowerCase() ?? "";
      const uname = (p.username ?? "").toLowerCase();
      return name.includes(q) || uname.includes(q);
    });
  }, [following, search]);

  function handleInvite(profile: Profile) {
    setPendingIds((prev) => new Set(prev).add(profile.id));
    sendInvite(
      { sessionId, inviteeId: profile.id },
      {
        onSettled: () =>
          setPendingIds((prev) => {
            const next = new Set(prev);
            next.delete(profile.id);
            return next;
          }),
      }
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className={`flex-1 bg-background ${isDark ? "dark" : ""}`}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Text className="text-foreground font-semibold text-base">Invite to Session</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={isDark ? "#9ca3af" : "#6b7280"} />
          </Pressable>
        </View>

        {/* Search */}
        <View className="px-4 py-3 border-b border-border">
          <View className="flex-row items-center bg-muted rounded-xl px-3 gap-2">
            <Ionicons name="search-outline" size={16} color={isDark ? "#9ca3af" : "#6b7280"} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search following…"
              placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
              className="flex-1 text-foreground text-sm py-2"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={isDark ? "#9ca3af" : "#6b7280"} />
              </Pressable>
            )}
          </View>
        </View>

        {/* List */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#f59e0b" />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={
              <Text className="text-muted-foreground text-sm text-center mt-12">
                {search ? "No results." : "You're not following anyone yet."}
              </Text>
            }
            ItemSeparatorComponent={() => <View className="h-3" />}
            renderItem={({ item }) => {
              const isMember = memberIds.has(item.id);
              const isInvited = invitedIds.has(item.id);
              const isInFlight = pendingIds.has(item.id);

              return (
                <View className="flex-row items-center gap-3">
                  <Avatar
                    uri={item.avatar_url}
                    name={getDisplayName(item)}
                    size={44}
                  />
                  <View className="flex-1">
                    <Text className="text-foreground font-semibold text-sm">
                      {getDisplayName(item)}
                    </Text>
                    <Text className="text-muted-foreground text-xs">
                      @{getUsername(item)}
                    </Text>
                  </View>

                  {isMember ? (
                    <View className="px-3 py-1.5 rounded-full bg-muted">
                      <Text className="text-muted-foreground text-xs font-semibold">In session</Text>
                    </View>
                  ) : isInvited ? (
                    <View className="px-3 py-1.5 rounded-full border border-border">
                      <Text className="text-muted-foreground text-xs font-semibold">Invited</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => handleInvite(item)}
                      disabled={isInFlight || isSending}
                      className="flex-row items-center gap-1 bg-primary rounded-full px-3 py-1.5 active:opacity-70"
                    >
                      {isInFlight ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="paper-plane-outline" size={12} color="#fff" />
                          <Text className="text-white text-xs font-semibold">Invite</Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}
