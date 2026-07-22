import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import {
  useAcceptFollowRequest,
  useDeclineFollowRequest,
  useIncomingFollowRequests,
} from '@/hooks/useFollow';
import { useAuthStore } from '@/stores/authStore';
import { useColorScheme } from 'nativewind';
import { FollowRequest } from '@/types/models';
import { getDisplayName, getUsername } from '@/utils/profileHelpers';

function RequestRow({ request, currentUserId }: { request: FollowRequest; currentUserId: string }) {
  const router = useRouter();
  const accept = useAcceptFollowRequest(currentUserId);
  const decline = useDeclineFollowRequest(currentUserId);
  const profile = request.requester;
  if (!profile) return null;

  const pending = accept.isPending || decline.isPending;

  return (
    <View className="flex-row items-center px-6 py-4 border-b border-border bg-background">
      <Pressable onPress={() => router.push(`/user/${profile.id}`)}>
        <Avatar uri={profile.avatar_url} name={getDisplayName(profile)} size={48} />
      </Pressable>
      <Pressable
        className="flex-1 ml-4 justify-center"
        onPress={() => router.push(`/user/${profile.id}`)}
      >
        <Text className="text-foreground font-bold text-base">{getDisplayName(profile)}</Text>
        <Text className="text-muted-foreground text-sm">@{getUsername(profile)}</Text>
      </Pressable>
      <View className="flex-row items-center gap-2">
        <Button
          label="Accept"
          variant="primary"
          size="sm"
          loading={accept.isPending}
          disabled={pending}
          onPress={() => accept.mutate(profile.id)}
        />
        <Button
          label="Decline"
          variant="secondary"
          size="sm"
          loading={decline.isPending}
          disabled={pending}
          onPress={() => decline.mutate(profile.id)}
        />
      </View>
    </View>
  );
}

export default function FollowRequestsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { data: requests, isLoading } = useIncomingFollowRequests(user?.id);

  const renderItem = useCallback(
    ({ item }: { item: FollowRequest }) =>
      user?.id ? <RequestRow request={item} currentUserId={user.id} /> : null,
    [user?.id],
  );

  if (isLoading) {
    return (
      <SafeAreaView className={`flex-1 bg-background items-center justify-center ${isDark ? 'dark' : ''}`}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className={`flex-1 bg-background ${isDark ? 'dark' : ''}`}>
      <View className="flex-row items-center px-4 py-3 bg-background border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2 mr-2">
          <Ionicons name="arrow-back" size={22} color="orange" />
        </Pressable>
        <Text className="font-bold text-foreground text-base flex-1">Follow Requests</Text>
      </View>
      <FlatList
        data={requests ?? []}
        keyExtractor={(item) => item.requester_id}
        renderItem={renderItem}
        ListEmptyComponent={
          <View className="py-16 items-center flex-1 justify-center px-8">
            <Text className="text-3xl mb-2">✅</Text>
            <Text className="text-muted-foreground text-base text-center">
              No pending follow requests.
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}
