import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/common/Avatar';
import { DrinkBadge } from '@/components/drink/DrinkBadge';
import { Button } from '@/components/common/Button';
import { useFollow, useIsFollowing } from '@/hooks/useFollow';
import { supabase } from '@/lib/supabase';
import { DRINK_TYPE_MAP } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import { DrinkLog, DrinkType, Profile } from '@/types/models';
import { formatDateTime } from '@/utils/dateHelpers';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const isOwnProfile = id === currentUser?.id;

  const { data: profile, isLoading: profileLoading } = useQuery({
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
      return {
        ...data,
        followers_count: (data.followers_count as any)?.[0]?.count ?? 0,
        following_count: (data.following_count as any)?.[0]?.count ?? 0,
      } as Profile;
    },
    enabled: !!id,
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['userLogs', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drink_logs')
        .select('*')
        .eq('user_id', id!)
        .order('logged_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as DrinkLog[];
    },
    enabled: !!id,
  });

  const { data: isFollowing } = useIsFollowing(currentUser?.id, id);
  const { follow, unfollow } = useFollow(currentUser?.id);

  if (profileLoading || logsLoading) {
    return (
      <SafeAreaView className="flex-1 bg-amber-50 items-center justify-center">
        <ActivityIndicator size="large" color="#f59e0b" />
      </SafeAreaView>
    );
  }

  if (!profile) return null;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <FlatList
        data={logs ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const info = DRINK_TYPE_MAP[item.drink_type as DrinkType] ?? DRINK_TYPE_MAP['other'];
          return (
            <Pressable
              className="flex-row items-center px-6 py-3 border-b border-gray-100 bg-white active:bg-gray-50"
              onPress={() => router.push(`/drink/${item.id}`)}
            >
              <Text className="text-2xl mr-3">{info.emoji}</Text>
              <View className="flex-1">
                <Text className="text-gray-900 font-medium">
                  {item.drink_name || info.label}
                  {item.quantity !== 1 && (
                    <Text className="text-gray-500 font-normal"> × {item.quantity}</Text>
                  )}
                </Text>
                {item.location_name && (
                  <Text className="text-gray-400 text-xs">📍 {item.location_name}</Text>
                )}
              </View>
              <Text className="text-gray-400 text-xs">{formatDateTime(item.logged_at)}</Text>
            </Pressable>
          );
        }}
        ListHeaderComponent={
          <View>
            {/* Nav */}
            <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100">
              <Pressable onPress={() => router.back()} className="p-2 mr-2">
                <Ionicons name="arrow-back" size={22} color="#374151" />
              </Pressable>
              <Text className="font-bold text-gray-900 text-base flex-1">
                @{profile.username}
              </Text>
            </View>

            {/* Profile */}
            <View className="bg-white px-6 pt-5 pb-5 border-b border-gray-100">
              <View className="flex-row items-start justify-between mb-4">
                <Avatar
                  uri={profile.avatar_url}
                  name={profile.display_name ?? profile.username}
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
                        unfollow.mutate(profile.id);
                      } else {
                        follow.mutate(profile.id);
                      }
                    }}
                  />
                )}
              </View>

              <Text className="text-xl font-bold text-gray-900">
                {profile.display_name ?? profile.username}
              </Text>
              <Text className="text-gray-400 text-sm">@{profile.username}</Text>
              {profile.bio && (
                <Text className="text-gray-600 text-sm mt-2">{profile.bio}</Text>
              )}

              <View className="flex-row gap-6 mt-3">
                <Text className="text-gray-700 text-sm">
                  <Text className="font-bold text-gray-900">{logs?.length ?? 0}</Text> Drinks
                </Text>
                <Text className="text-gray-700 text-sm">
                  <Text className="font-bold text-gray-900">{profile.followers_count ?? 0}</Text>{' '}
                  Followers
                </Text>
                <Text className="text-gray-700 text-sm">
                  <Text className="font-bold text-gray-900">{profile.following_count ?? 0}</Text>{' '}
                  Following
                </Text>
              </View>
            </View>

            <View className="px-6 pt-4 pb-2 bg-gray-50">
              <Text className="text-base font-bold text-gray-700">Drinks</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="py-16 items-center">
            <Text className="text-gray-400 text-base">No drinks logged yet.</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}
