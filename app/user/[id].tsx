import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { DrinkCard } from '@/components/drink/DrinkCard';
import { SessionCard } from '@/components/session/SessionCard';
import { useFollow, useIsFollowing } from '@/hooks/useFollow';
import { useMyFeed } from '@/hooks/useFeed';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useColorScheme } from 'nativewind';
import { FeedEntry, Profile } from '@/types/models';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const isOwnProfile = id === currentUser?.id;

  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useQuery({
    queryKey: ['profile', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          `*, followers_count:follows!following_id(count), following_count:follows!follower_id(count)`,
        )
        .eq('id', id!)
        .single();
      if (error) throw error;
      const res = data as any;
      return {
        ...res,
        followers_count: res.followers_count?.[0]?.count ?? 0,
        following_count: res.following_count?.[0]?.count ?? 0,
      } as Profile;
    },
    enabled: !!id,
  });

  const {
    data: feedData,
    isLoading: feedLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchFeed,
  } = useMyFeed(id);

  const entries: FeedEntry[] = feedData?.pages.flatMap((p) => p.entries) ?? [];

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const { data: isFollowing } = useIsFollowing(currentUser?.id, id);
  const { follow, unfollow } = useFollow(currentUser?.id);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const isLoading = profileLoading || feedLoading;

  if (isLoading) {
    return (
      <SafeAreaView className={`flex-1 bg-background items-center justify-center ${isDark ? 'dark' : ''}`}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </SafeAreaView>
    );
  }

  if (!profile) return null;

  function ProfileHeader() {
    return (
      <View>
        {/* Nav */}
        <View className="flex-row items-center px-4 py-3 bg-background border-b border-border">
          <Pressable onPress={() => router.back()} className="p-2 mr-2">
            <Ionicons name="arrow-back" size={22} color="orange" />
          </Pressable>
          <Text className="font-bold text-foreground text-base flex-1">
            @{profile!.username}
          </Text>
        </View>

        {/* Profile card */}
        <View className="bg-background px-6 pt-5 pb-5 border-b border-border">
          <View className="flex-row items-start justify-between mb-4">
            <Avatar
              uri={profile!.avatar_url}
              name={profile!.display_name ?? profile!.username}
              size={72}
            />
            {!isOwnProfile && (
              <Button
                label={isFollowing ? 'Following' : 'Follow'}
                variant={isFollowing ? 'secondary' : 'primary'}
                size="md"
                loading={follow.isPending || unfollow.isPending}
                onPress={() => {
                  if (isFollowing) {
                    unfollow.mutate(profile!.id);
                  } else {
                    follow.mutate(profile!.id);
                  }
                }}
              />
            )}
          </View>

          <Text className="text-xl font-bold text-foreground">
            {profile!.display_name ?? profile!.username}
          </Text>
          <Text className="text-muted-foreground text-sm">@{profile!.username}</Text>
          {profile!.bio && (
            <Text className="text-muted-foreground text-sm mt-2">{profile!.bio}</Text>
          )}

          <View className="flex-row gap-6 mt-3">
            <Pressable onPress={() => router.push(`/user/${profile!.id}/followers`)}>
              <Text className="text-muted-foreground text-sm">
                <Text className="font-bold text-foreground">{profile!.followers_count ?? 0}</Text>{' '}
                Followers
              </Text>
            </Pressable>
            <Pressable onPress={() => router.push(`/user/${profile!.id}/following`)}>
              <Text className="text-muted-foreground text-sm">
                <Text className="font-bold text-foreground">{profile!.following_count ?? 0}</Text>{' '}
                Following
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView className={`flex-1 bg-background ${isDark ? 'dark' : ''}`}>
      <FlatList
        data={entries}
        keyExtractor={(entry) =>
          entry.type === 'session' ? `session-${entry.session_id}` : `drink-${entry.item.id}`
        }
        renderItem={({ item: entry }) => {
          if (entry.type === 'session') {
            return <SessionCard group={entry} />;
          }
          return <DrinkCard item={entry.item} />;
        }}
        ListHeaderComponent={<ProfileHeader />}
        ListEmptyComponent={
          <View className="py-16 items-center">
            <Text className="text-3xl mb-2">🍺</Text>
            <Text className="text-muted-foreground text-base">No drinks logged yet.</Text>
          </View>
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
            refreshing={false}
            onRefresh={() => { refetchProfile(); refetchFeed(); }}
            tintColor="#f59e0b"
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}
