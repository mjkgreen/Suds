import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { FollowButton } from '@/components/social/FollowButton';
import { useFollowStatus } from '@/hooks/useFollow';
import { useBlocks, useIsBlocked } from '@/hooks/useBlocks';
import { useReportContent } from '@/hooks/useReports';
import { useMyFeed } from '@/hooks/useFeed';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useColorScheme } from 'nativewind';
import { FeedEntry, Profile } from '@/types/models';
import { findBadgeById, TIER_COLORS, UserBadge } from '@/utils/badgeHelpers';
import { BadgeInfoModal } from '@/components/profile/BadgeInfoModal';
import { useState } from 'react';

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
          `*, displayed_badges, followers_count:follows!following_id(count), following_count:follows!follower_id(count)`,
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

  const { data: followStatus = 'none' } = useFollowStatus(currentUser?.id, id);

  // Private accounts show only name/bio/avatar/counts until the viewer's
  // request is accepted. Server-side guards return empty data regardless;
  // this flag just skips the fetch and drives the locked UI.
  const canViewContent =
    isOwnProfile || (!!profile && (!profile.is_private || followStatus === 'following'));

  const {
    data: feedData,
    isLoading: feedLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchFeed,
  } = useMyFeed(id, canViewContent);

  const entries = useMemo<FeedEntry[]>(
    () => feedData?.pages.flatMap((p) => p.entries) ?? [],
    [feedData],
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(({ item: entry }: { item: FeedEntry }) => {
    if (entry.type === 'session') {
      return <SessionCard group={entry} />;
    }
    return <DrinkCard item={entry.item} />;
  }, []);

  const isBlocked = useIsBlocked(currentUser?.id, id);
  const { block, unblock } = useBlocks(currentUser?.id);
  const reportContent = useReportContent(currentUser?.id);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [badgeInfoVisible, setBadgeInfoVisible] = useState(false);

  const isLoading = profileLoading || feedLoading;

  const handleReportUser = useCallback(() => {
    if (!profile) return;
    Alert.alert(`Report @${profile.username}?`, 'Why are you reporting this user?', [
      { text: 'Cancel', style: 'cancel' },
      ...['Spam', 'Inappropriate content', 'Harassment'].map((reason) => ({
        text: reason,
        onPress: () =>
          reportContent.mutate({ targetType: 'user' as const, targetId: profile.id, reason }),
      })),
    ]);
  }, [profile, reportContent]);

  const handleBlockUser = useCallback(() => {
    if (!profile) return;
    Alert.alert(
      `Block @${profile.username}?`,
      "You won't see each other's drinks, comments, or likes, and you'll stop following each other.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => block.mutate(profile.id) },
      ],
    );
  }, [profile, block]);

  const handleMoreOptions = useCallback(() => {
    if (!profile) return;
    Alert.alert(`@${profile.username}`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report User', onPress: handleReportUser },
      isBlocked
        ? { text: 'Unblock User', onPress: () => unblock.mutate(profile.id) }
        : { text: 'Block User', style: 'destructive' as const, onPress: handleBlockUser },
    ]);
  }, [profile, isBlocked, unblock, handleReportUser, handleBlockUser]);

  const selectedBadgeIds = profile?.displayed_badges ?? [];
  const selectedBadges = useMemo(
    () => selectedBadgeIds.map(findBadgeById).filter(Boolean) as UserBadge[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile],
  );

  const listHeader = useMemo(() => (
    profile ? (
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
            <View className="flex-row items-center gap-2">
              {isBlocked ? (
                <Button
                  label="Unblock"
                  variant="secondary"
                  size="md"
                  loading={unblock.isPending}
                  onPress={() => unblock.mutate(profile!.id)}
                />
              ) : (
                currentUser?.id && (
                  <FollowButton
                    targetProfile={profile!}
                    currentUserId={currentUser.id}
                    size="md"
                  />
                )
              )}
              <Pressable onPress={handleMoreOptions} hitSlop={8} className="p-2">
                <Ionicons
                  name="ellipsis-horizontal"
                  size={20}
                  color="hsl(var(--muted-foreground))"
                />
              </Pressable>
            </View>
          )}
        </View>

        <Text className="text-xl font-bold text-foreground">
          {profile!.display_name ?? profile!.username}
        </Text>
        <Text className="text-muted-foreground text-sm">@{profile!.username}</Text>
        {profile!.bio && (
          <Text className="text-muted-foreground text-sm mt-2">{profile!.bio}</Text>
        )}

        <View className="flex-row items-center justify-between mt-3">
          <View className="flex-row gap-6">
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

          <View className="flex-row items-center gap-1.5">
            {canViewContent && selectedBadges.map((b) => (
              <Pressable
                key={b.id}
                className="w-8 h-10 items-center justify-center border-2 border-card shadow-sm -ml-2 first:ml-0"
                onPress={() => setBadgeInfoVisible(true)}
                style={{
                    backgroundColor: TIER_COLORS[b.tier] + '40',
                    borderColor: TIER_COLORS[b.tier],
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                    borderBottomLeftRadius: 16,
                    borderBottomRightRadius: 16,
                }}
              >
                <Ionicons name={b.icon as any} size={16} color={TIER_COLORS[b.tier]} />
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </View>
    ) : null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [profile, isOwnProfile, currentUser?.id, canViewContent, isBlocked, unblock.isPending, handleMoreOptions, selectedBadges]);

  if (isLoading) {
    return (
      <SafeAreaView className={`flex-1 bg-background items-center justify-center ${isDark ? 'dark' : ''}`}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </SafeAreaView>
    );
  }

  if (!profile) return null;

  return (
    <SafeAreaView className={`flex-1 bg-background ${isDark ? 'dark' : ''}`}>
      <BadgeInfoModal
        badges={selectedBadges}
        isVisible={badgeInfoVisible}
        onClose={() => setBadgeInfoVisible(false)}
      />
      <FlatList
        data={entries}
        keyExtractor={(entry) =>
          entry.type === 'session' ? `session-${entry.session_id}` : `drink-${entry.item.id}`
        }
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          !canViewContent && !isBlocked ? (
            <View className="py-16 items-center px-8">
              <Text className="text-3xl mb-2">🔒</Text>
              <Text className="text-foreground text-base font-semibold">
                This account is private
              </Text>
              <Text className="text-muted-foreground text-sm mt-1 text-center">
                {followStatus === 'requested'
                  ? 'Your follow request is pending approval.'
                  : 'Follow this account to see their drinks and stats.'}
              </Text>
            </View>
          ) : (
            <View className="py-16 items-center">
              <Text className="text-3xl mb-2">{isBlocked ? '🚫' : '🍺'}</Text>
              <Text className="text-muted-foreground text-base">
                {isBlocked ? "You've blocked this user." : 'No drinks logged yet.'}
              </Text>
            </View>
          )
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
