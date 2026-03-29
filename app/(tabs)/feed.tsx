import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { DrinkCard } from '@/components/drink/DrinkCard';
import { SessionCard } from '@/components/session/SessionCard';
import { useFeed } from '@/hooks/useFeed';
import { useActiveSession, useEndSession, useStartSession } from '@/hooks/useSession';
import { useAuthStore } from '@/stores/authStore';
import { FeedEntry } from '@/types/models';

export default function FeedScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const activeSession = useActiveSession();

  const [showStartModal, setShowStartModal] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const { mutateAsync: startSession, isPending: isStarting } = useStartSession();
  const { mutateAsync: endSession, isPending: isEnding } = useEndSession();

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useFeed(user?.id);

  const entries: FeedEntry[] = data?.pages.flatMap((p) => p) ?? [];

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  async function handleStartSession() {
    if (!user) return;
    await startSession({ userId: user.id, title: sessionTitle.trim() || undefined });
    setSessionTitle('');
    setShowStartModal(false);
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-amber-50 items-center justify-center">
        <ActivityIndicator size="large" color="#f59e0b" />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-amber-50">
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
    <SafeAreaView className="flex-1 bg-gray-50">
      <FlatList
        data={entries}
        keyExtractor={(entry) =>
          entry.type === 'session' ? `session-${entry.session_id}` : `drink-${entry.item.id}`
        }
        renderItem={({ item: entry }) =>
          entry.type === 'session' ? (
            <SessionCard group={entry} />
          ) : (
            <DrinkCard item={entry.item} />
          )
        }
        ListHeaderComponent={
          <View className="px-4 pt-6 pb-3 gap-3">
            <View>
              <Text className="text-2xl font-bold text-gray-900">🍺 Suds</Text>
              <Text className="text-gray-400 text-sm">What your crew is drinking</Text>
            </View>

            {/* Night out CTA */}
            {activeSession ? (
              <View className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 gap-3">
                <View className="flex-row items-center gap-2">
                  <View className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <View className="flex-1">
                    <Text className="text-amber-800 font-bold text-base">
                      {activeSession.title ?? 'Night Out'} in progress
                    </Text>
                    <Text className="text-amber-600 text-xs">All drinks are being grouped together</Text>
                  </View>
                </View>
                <View className="flex-row gap-2">
                  <Pressable
                    className="flex-1 bg-amber-500 rounded-xl py-2.5 items-center"
                    onPress={() => router.push('/(tabs)/log')}
                  >
                    <Text className="text-white font-semibold text-sm">+ Log a Drink</Text>
                  </Pressable>
                  <Pressable
                    className="flex-1 bg-white border border-amber-300 rounded-xl py-2.5 items-center"
                    onPress={() => endSession(activeSession.id)}
                    disabled={isEnding}
                  >
                    <Text className="text-amber-700 font-semibold text-sm">
                      {isEnding ? 'Ending…' : '🏁 End Night Out'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                className="bg-amber-500 rounded-2xl px-4 py-3 flex-row items-center justify-between"
                onPress={() => setShowStartModal(true)}
              >
                <View>
                  <Text className="text-white font-bold text-sm">Start a Night Out</Text>
                  <Text className="text-amber-100 text-xs">Track all your drinks as one session</Text>
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
                <Button label="Log a Drink" onPress={() => router.push('/(tabs)/log')} />
                <Button
                  label="Find Friends"
                  onPress={() => router.push('/(tabs)/search')}
                  variant="secondary"
                />
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
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#f59e0b" />
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />

      {/* Start session modal */}
      <Modal visible={showStartModal} transparent animationType="fade">
        <Pressable
          className="flex-1 bg-black/40 items-center justify-center px-6"
          onPress={() => setShowStartModal(false)}
        >
          <Pressable
            className="bg-white rounded-2xl p-6 w-full"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-xl font-bold text-gray-900 mb-1">Start a Night Out</Text>
            <Text className="text-gray-500 text-sm mb-4">
              Give it a name, or leave blank. All drinks you log will be grouped together.
            </Text>
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 mb-4"
              placeholder='e.g. "Friday at The Crown"'
              placeholderTextColor="#9ca3af"
              value={sessionTitle}
              onChangeText={setSessionTitle}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleStartSession}
            />
            <View className="flex-row gap-3">
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => setShowStartModal(false)}
                className="flex-1"
              />
              <Button
                label="Let's go 🌙"
                loading={isStarting}
                onPress={handleStartSession}
                className="flex-1"
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
