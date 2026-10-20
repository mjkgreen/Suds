import { useRouter } from "expo-router";
import Head from "expo-router/head";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/common/Avatar";
import { FollowButton } from "@/components/social/FollowButton";
import { useBlockedIds } from "@/hooks/useBlocks";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useActiveSession } from "@/hooks/useSession";
import { Profile } from "@/types/models";
import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";
import { useDebounce } from "@/hooks/useDebounce";

const UserRow = React.memo(function UserRow({ profile, currentUserId }: { profile: Profile; currentUserId: string }) {
  const router = useRouter();

  return (
    <Pressable
      className="flex-row items-center px-6 py-4 border-b border-border active:bg-accent"
      onPress={() => router.push(`/user/${profile.id}`)}
    >
      <Avatar uri={profile.avatar_url} name={profile.display_name ?? profile.username} size={46} />
      <View className="flex-1 ml-3">
        <Text className="font-semibold text-foreground">{profile.display_name ?? profile.username}</Text>
        <Text className="text-muted-foreground text-sm">@{profile.username}</Text>
      </View>
      <FollowButton targetProfile={profile} currentUserId={currentUserId} size="sm" />
    </Pressable>
  );
});

export default function SearchScreen() {
  const { user } = useAuthStore();
  const activeSession = useActiveSession();
  const topEdges = activeSession ? [] : ["top" as const];
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);

  const renderItem = useCallback(
    ({ item }: { item: Profile }) => <UserRow profile={item} currentUserId={user?.id ?? ""} />,
    [user?.id]
  );

  const { data: results, isLoading } = useQuery({
    queryKey: ["searchUsers", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .or(`username.ilike.%${debouncedQuery}%,display_name.ilike.%${debouncedQuery}%`)
        .limit(20);
      if (error) throw error;
      return data as Profile[];
    },
    enabled: debouncedQuery.length > 1,
  });

  const { data: blockedIds } = useBlockedIds(user?.id);
  const visibleResults = (results ?? []).filter((p) => !(blockedIds ?? []).includes(p.id));

  return (
    <>
      <Head>
        <title>Search | Suds</title>
      </Head>
      <SafeAreaView className="flex-1 bg-background" edges={topEdges}>
        {/* Search bar */}
        <View className="px-4 pt-6 pb-3 bg-card border-b border-border">
          <Text className="text-2xl font-bold text-foreground mb-3">Find Friends</Text>
          <View className="flex-row items-center bg-accent rounded-xl px-4 py-2.5">
            <Text className="text-muted-foreground mr-2">🔍</Text>
            <TextInput
              className="flex-1 text-base text-foreground"
              placeholder="Search by name or username"
              placeholderTextColor="#9ca3af"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#f59e0b" />
          </View>
        ) : (
          <FlatList
            data={visibleResults}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListEmptyComponent={
              query.length > 1 ? (
                <View className="py-16 items-center">
                  <Text className="text-muted-foreground text-base">No users found for "{query}"</Text>
                </View>
              ) : (
                <View className="py-16 items-center px-8">
                  <Text className="text-muted-foreground font-semibold text-lg text-center">
                    Find your drinking crew
                  </Text>
                  <Text className="text-muted-foreground/60 text-sm text-center mt-2">
                    Search for friends by name or username to see their drinks in your feed.
                  </Text>
                </View>
              )
            }
          />
        )}
      </SafeAreaView>
    </>
  );
}
