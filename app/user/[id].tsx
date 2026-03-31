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
import { DrinkIcon } from '@/components/icons/DrinkIcon';
import { useAuthStore } from '@/stores/authStore';
import { useColorScheme } from 'nativewind';
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
      const res = data as any;
      return {
        ...res,
        followers_count: res.followers_count?.[0]?.count ?? 0,
        following_count: res.following_count?.[0]?.count ?? 0,
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
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (profileLoading || logsLoading) {
    return (
      <SafeAreaView className={`flex-1 bg-background items-center justify-center ${isDark ? 'dark' : ''}`}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </SafeAreaView>
    );
  }

  if (!profile) return null;

  return (
    <SafeAreaView className={`flex-1 bg-background ${isDark ? 'dark' : ''}`}>
      <FlatList
        data={logs ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const info = DRINK_TYPE_MAP[item.drink_type as DrinkType] ?? DRINK_TYPE_MAP['other'];
          return (
            <Pressable
              className="flex-row items-center px-6 py-3 border-b border-border bg-background active:bg-accent"
              onPress={() => router.push(`/drink/${item.id}`)}
            >
              <DrinkIcon type={item.drink_type as DrinkType} size={24} color={info.color} />
              <View className="flex-1 ml-3">
                <Text className="text-foreground font-medium">
                  {item.drink_name || info.label}
                  {item.quantity !== 1 && (
                    <Text className="text-muted-foreground font-normal"> × {item.quantity}</Text>
                  )}
                </Text>
                {item.location_name && (
                  <View className="flex-row items-center mt-0.5 gap-1">
                    <Text className="text-muted-foreground text-xs">{item.location_name}</Text>
                  </View>
                )}
              </View>
              <Text className="text-muted-foreground text-xs">{formatDateTime(item.logged_at)}</Text>
            </Pressable>
          );
        }}
        ListHeaderComponent={
          <View>
            {/* Nav */}
            <View className="flex-row items-center px-4 py-3 bg-background border-b border-border">
              <Pressable onPress={() => router.back()} className="p-2 mr-2">
                <Ionicons name="arrow-back" size={22} color="orange" />
              </Pressable>
              <Text className="font-bold text-foreground text-base flex-1">
                @{profile.username}
              </Text>
            </View>

            {/* Profile */}
            <View className="bg-background px-6 pt-5 pb-5 border-b border-border">
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
 
              <Text className="text-xl font-bold text-foreground">
                {profile.display_name ?? profile.username}
              </Text>
              <Text className="text-muted-foreground text-sm">@{profile.username}</Text>
              {profile.bio && (
                <Text className="text-muted-foreground text-sm mt-2">{profile.bio}</Text>
              )}
 
              <View className="flex-row gap-6 mt-3">
                <Text className="text-muted-foreground text-sm">
                  <Text className="font-bold text-foreground">{logs?.length ?? 0}</Text> Drinks
                </Text>
                <Text className="text-muted-foreground text-sm">
                  <Text className="font-bold text-foreground">{profile.followers_count ?? 0}</Text>{' '}
                  Followers
                </Text>
                <Text className="text-muted-foreground text-sm">
                  <Text className="font-bold text-foreground">{profile.following_count ?? 0}</Text>{' '}
                  Following
                </Text>
              </View>
            </View>

            <View className="px-6 pt-4 pb-2 bg-muted/30">
              <Text className="text-base font-bold text-muted-foreground">Drinks</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="py-16 items-center">
            <Text className="text-muted-foreground text-base">No drinks logged yet.</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}
