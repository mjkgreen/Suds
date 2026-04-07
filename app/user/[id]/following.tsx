import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/common/Avatar';
import { useFollowing } from '@/hooks/useFollow';
import { useColorScheme } from 'nativewind';
import { Profile } from '@/types/models';
import { getDisplayName, getUsername } from '@/utils/profileHelpers';

export default function FollowingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { data: following, isLoading } = useFollowing(id);

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
        <Text className="font-bold text-foreground text-base flex-1">Following</Text>
      </View>
      <FlatList
        data={following as Profile[] ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            className="flex-row items-center px-6 py-4 border-b border-border bg-background active:bg-accent"
            onPress={() => router.push(`/user/${item.id}`)}
          >
            <Avatar uri={item.avatar_url} name={getDisplayName(item)} size={48} />
            <View className="flex-1 ml-4 justify-center">
              <Text className="text-foreground font-bold text-base">{getDisplayName(item)}</Text>
              <Text className="text-muted-foreground text-sm">@{getUsername(item)}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="py-16 items-center flex-1 justify-center">
            <Text className="text-muted-foreground text-base">Not following anyone yet.</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}
