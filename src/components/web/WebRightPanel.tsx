import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { Avatar } from "@/components/common/Avatar";
import { FollowButton } from "@/components/social/FollowButton";
import { useAuthStore } from "@/stores/authStore";
import { useSuggestedUsers } from "@/hooks/useSuggestedUsers";
import { Profile } from "@/types/models";
import { getDisplayName, getUsername } from "@/utils/profileHelpers";

function SuggestedUserRow({ profile, currentUserId }: { profile: Profile; currentUserId: string }) {
  const router = useRouter();

  return (
    <Pressable
      style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 }}
      onPress={() => router.push(`/user/${profile.id}` as never)}
    >
      <Avatar uri={profile.avatar_url} name={getDisplayName(profile)} size={36} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ fontSize: 13, fontWeight: "600" }}
          className="text-foreground"
          numberOfLines={1}
        >
          {getDisplayName(profile)}
        </Text>
        <Text style={{ fontSize: 11 }} className="text-muted-foreground" numberOfLines={1}>
          @{getUsername(profile)}
        </Text>
      </View>
      <FollowButton targetProfile={profile} currentUserId={currentUserId} size="sm" />
    </Pressable>
  );
}

export function WebRightPanel() {
  const { user } = useAuthStore();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const router = useRouter();

  const { data: suggested, isLoading } = useSuggestedUsers(user?.id);

  const borderColor = isDark ? "#1f2937" : "#e5e7eb";
  const cardBg = isDark ? "#111827" : "#ffffff";
  const labelColor = isDark ? "#9ca3af" : "#6b7280";

  return (
    <ScrollView
      style={{ borderLeftWidth: 1, borderLeftColor: borderColor }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          backgroundColor: cardBg,
          borderRadius: 16,
          borderWidth: 1,
          borderColor,
          padding: 14,
        }}
      >
        <Text style={{ fontSize: 10, color: labelColor, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
          People to Follow
        </Text>

        {isLoading ? (
          <View style={{ paddingVertical: 20, alignItems: "center" }}>
            <ActivityIndicator color="#f59e0b" />
          </View>
        ) : !suggested || suggested.length === 0 ? (
          <Text style={{ fontSize: 12, color: labelColor }}>
            No suggestions right now. Invite your friends!
          </Text>
        ) : (
          <>
            {suggested.map((profile) => (
              <SuggestedUserRow key={profile.id} profile={profile} currentUserId={user?.id ?? ""} />
            ))}

            <Pressable
              onPress={() => router.push("/(tabs)/search" as never)}
              style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: borderColor }}
            >
              <Text style={{ fontSize: 12, color: "#f59e0b", fontWeight: "600", textAlign: "center" }}>
                Find more people →
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}
