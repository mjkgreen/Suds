import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { DrinkCard } from "@/components/drink/DrinkCard";
import { SessionCard } from "@/components/session/SessionCard";
import { useFeed } from "@/hooks/useFeed";
import { useActiveSession, useEndSession, useStartSession } from "@/hooks/useSession";
import { useAuthStore } from "@/stores/authStore";
import { FeedEntry } from "@/types/models";

export default function FeedScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const activeSession = useActiveSession();

  const [showStartModal, setShowStartModal] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const { mutateAsync: startSession, isPending: isStarting } = useStartSession();
  const { mutateAsync: endSession, isPending: isEnding } = useEndSession();

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isRefetching } = useFeed(
    user?.id,
  );

  const entries: FeedEntry[] = data?.pages.flatMap((p) => p) ?? [];

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  async function handleStartSession() {
    if (!user) return;
    await startSession({ userId: user.id, title: sessionTitle.trim() || undefined });
    setSessionTitle("");
    setShowStartModal(false);
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#f59e0b" />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <EmptyState
          emoji="😬"
          title="Couldn't load feed"
          subtitle="Check your connection and try again."
          action={<Button label="Retry" onPress={() => refetch()} variant="secondary" />}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <FlatList
        data={entries}
        keyExtractor={(entry) => (entry.type === "session" ? `session-${entry.session_id}` : `drink-${entry.item.id}`)}
        renderItem={({ item: entry }) =>
          entry.type === "session" ? <SessionCard group={entry} /> : <DrinkCard item={entry.item} />
        }
        ListHeaderComponent={
          <View className="px-4 pt-6 pb-3 gap-3">
            <View>
              <Text className="text-2xl font-bold text-foreground"> Suds</Text>
              <Text className="text-muted-foreground text-sm">What your crew is drinking</Text>
            </View>

            {/* Night out CTA */}
            {activeSession ? (
              <View className="bg-primary/10 border border-primary/20 rounded-2xl px-4 py-4 gap-3">
                <View className="flex-row items-center gap-2">
                  <View className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <View className="flex-1">
                    <Text className="text-primary font-bold text-base">
                      {activeSession.title ?? "Night Out"} in progress
                    </Text>
                    <Text className="text-primary/70 text-xs">All drinks are being grouped together</Text>
                  </View>
                </View>
                <View className="flex-row gap-2">
                  <Pressable
                    className="flex-1 bg-primary rounded-xl py-2.5 items-center"
                    onPress={() => router.push("/(tabs)/log")}
                  >
                    <Text className="text-primary-foreground font-semibold text-sm">+ Log a Drink</Text>
                  </Pressable>
                  <Pressable
                    className="flex-1 bg-background border border-primary/30 rounded-xl py-2.5 items-center"
                    onPress={() => endSession(activeSession.id)}
                    disabled={isEnding}
                  >
                    <Text className="text-primary font-semibold text-sm">
                      {isEnding ? "Ending…" : "🏁 End Night Out"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                className="bg-primary rounded-2xl px-4 py-3 flex-row items-center justify-between"
                onPress={() => setShowStartModal(true)}
              >
                <View>
                  <Text className="text-primary-foreground font-bold text-sm">Start a Night Out</Text>
                  <Text className="text-primary-foreground/70 text-xs">Track all your drinks as one session</Text>
                </View>
                <Text className="text-2xl">🌙</Text>
              </Pressable>
            )}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            emoji="👀"
            title="Your feed is empty"
            subtitle="Follow some friends or log your first drink."
            action={
              <View className="gap-3">
                <Button label="Log a Drink" onPress={() => router.push("/(tabs)/log")} />
                <Button label="Find Friends" onPress={() => router.push("/(tabs)/search")} variant="secondary" />
              </View>
            }
          />
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="py-4 items-center">
              <ActivityIndicator color="#f59e0b" />
            </View>
          ) : null
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#f59e0b" />}
      />

      {/* Start session modal */}
      <Modal visible={showStartModal} transparent animationType="fade">
        <Pressable
          className="flex-1 bg-black/40 items-center justify-center px-6"
          onPress={() => setShowStartModal(false)}
        >
          <Pressable className="bg-card rounded-3xl p-6 w-full border border-border" onPress={(e) => e.stopPropagation()}>
            <Text className="text-xl font-bold text-foreground mb-1">Start a Night Out</Text>
            <Text className="text-muted-foreground text-sm mb-4">
              Give it a name, or leave blank. All drinks you log will be grouped together.
            </Text>
            <TextInput
              className="bg-input border border-border rounded-xl px-4 py-3 text-base text-foreground mb-6"
              placeholder='e.g. "Friday at The Crown"'
              placeholderTextColor="#9ca3af"
              value={sessionTitle}
              onChangeText={setSessionTitle}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleStartSession}
            />
            <View className="flex-row gap-3">
              <Button label="Cancel" variant="secondary" onPress={() => setShowStartModal(false)} className="flex-1" />
              <Button label="Let's go 🌙" loading={isStarting} onPress={handleStartSession} className="flex-1" />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
