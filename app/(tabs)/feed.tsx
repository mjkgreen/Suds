import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { DrinkCard } from '@/components/drink/DrinkCard';
import { useFeed } from '@/hooks/useFeed';
import { useAuthStore } from '@/stores/authStore';
import { FeedItem } from '@/types/models';

export default function FeedScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();

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

  const items: FeedItem[] = data?.pages.flatMap((p) => p) ?? [];

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <DrinkCard item={item} />}
        ListHeaderComponent={
          <View className="px-6 pt-6 pb-2">
            <Text className="text-2xl font-bold text-gray-900">🍺 Suds</Text>
            <Text className="text-gray-400 text-sm">What your crew is drinking</Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            emoji="👀"
            title="Your feed is empty"
            subtitle="Follow some friends or log your first drink."
            action={
              <View className="gap-3">
                <Button
                  label="Log a Drink"
                  onPress={() => router.push('/(tabs)/log')}
                />
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
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#f59e0b"
          />
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
}
