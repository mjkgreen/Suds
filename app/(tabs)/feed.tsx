import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { DrinkCard } from "@/components/drink/DrinkCard";
import { SessionCard } from "@/components/session/SessionCard";
import { useFeed } from "@/hooks/useFeed";
import { useQuickLogDrink } from "@/hooks/useDrinkLog";
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
  const { mutateAsync: quickLogDrink } = useQuickLogDrink();

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isRefetching } = useFeed(
    user?.id,
  );

  const entries: FeedEntry[] = data?.pages.flatMap((p) => p.entries) ?? [];

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  async function handleStartSession() {
    if (!user) return;
    await startSession({ userId: user.id, title: sessionTitle.trim() || undefined });
    setSessionTitle("");
    setShowStartModal(false);
    router.push("/(tabs)/log");
  }

  const topEdges = activeSession ? [] : ["top" as const];

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={topEdges}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={topEdges}>
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
    <SafeAreaView className="flex-1 bg-background" edges={topEdges}>
      <FlatList
        data={entries}
        keyExtractor={(entry) => (entry.type === "session" ? `session-${entry.session_id}` : `drink-${entry.item.id}`)}
        renderItem={({ item: entry }) => {
          if (entry.type === "session") {
            const isActive = !!activeSession && entry.session_id === activeSession.id;
            return (
              <SessionCard
                group={entry}
                isActive={isActive}
                onEnd={isActive ? () => endSession(activeSession!.id) : undefined}
                isEnding={isActive ? isEnding : undefined}
                onQuickLog={
                  isActive && user
                    ? (item) => quickLogDrink({ userId: user.id, item, sessionId: activeSession!.id })
                    : undefined
                }
              />
            );
          }
          return <DrinkCard item={entry.item} />;
        }}
        ListHeaderComponent={
          <View className="px-4 pt-0 mt-0 pb-3 gap-3">
            <View>
              <Text className="text-2xl font-bold text-foreground"> Suds</Text>
              <Text className="text-muted-foreground text-sm">What your crew is drinking</Text>
            </View>

            {/* Night out CTA */}
            {!activeSession && (
              <Pressable
                className="bg-primary rounded-2xl px-4 py-3 flex-row items-center justify-between"
                onPress={() => setShowStartModal(true)}
              >
                <View>
                  <Text className="text-primary-foreground font-bold text-sm">Start a Night Out</Text>
                  <Text className="text-primary-foreground/70 text-xs">Track all your drinks as one session</Text>
                </View>
                <Ionicons name="moon" size={24} color="#f59e0b" />
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
          <Pressable
            className="bg-card rounded-3xl p-6 w-full border border-border"
            onPress={(e) => e.stopPropagation()}
          >
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
