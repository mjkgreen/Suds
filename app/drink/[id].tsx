import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/common/Avatar';
import { DrinkBadge } from '@/components/drink/DrinkBadge';
import { useDeleteDrinkLog } from '@/hooks/useDrinkLog';
import { supabase } from '@/lib/supabase';
import { DRINK_TYPE_MAP } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import { DrinkLog, DrinkType, Profile } from '@/types/models';
import { formatDateTime } from '@/utils/dateHelpers';

export default function DrinkDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { mutateAsync: deleteDrink } = useDeleteDrinkLog();

  const { data, isLoading } = useQuery({
    queryKey: ['drinkDetail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drink_logs')
        .select('*, profile:profiles(*)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as DrinkLog & { profile: Profile };
    },
    enabled: !!id,
  });

  async function handleDelete() {
    if (!data || !user) return;
    Alert.alert('Delete Drink?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDrink({ id: data.id, userId: user.id });
          router.back();
        },
      },
    ]);
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-amber-50 items-center justify-center">
        <ActivityIndicator size="large" color="#f59e0b" />
      </SafeAreaView>
    );
  }

  if (!data) return null;

  const info = DRINK_TYPE_MAP[data.drink_type as DrinkType] ?? DRINK_TYPE_MAP['other'];
  const isOwner = user?.id === data.user_id;

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Nav bar */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
        <Pressable onPress={() => router.back()} className="p-2">
          <Ionicons name="close" size={24} color="#374151" />
        </Pressable>
        <Text className="font-bold text-gray-900 text-base">Drink</Text>
        {isOwner ? (
          <View className="flex-row gap-1">
            <Pressable onPress={() => router.push(`/drink/edit/${data?.id}`)} className="p-2">
              <Ionicons name="pencil-outline" size={22} color="#374151" />
            </Pressable>
            <Pressable onPress={handleDelete} className="p-2">
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
            </Pressable>
          </View>
        ) : (
          <View className="w-10" />
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 24 }}>
        {/* Photo */}
        {data.photo_url && (
          <Image
            source={{ uri: data.photo_url }}
            style={{ height: 220, borderRadius: 16, marginBottom: 20 }}
            contentFit="cover"
          />
        )}

        {/* Drink */}
        <View className="flex-row items-center mb-4">
          <Text className="text-5xl mr-4">{info.emoji}</Text>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-gray-900">
              {data.drink_name || info.label}
            </Text>
            <DrinkBadge type={data.drink_type as DrinkType} />
          </View>
        </View>

        {/* Meta */}
        <View className="bg-gray-50 rounded-2xl p-4 gap-3 mb-4">
          <View className="flex-row items-center">
            <Ionicons name="beaker-outline" size={18} color="#6b7280" />
            <Text className="text-gray-600 ml-2">
              <Text className="font-semibold text-gray-900">{data.quantity}</Text> standard drink
              {data.quantity !== 1 ? 's' : ''}
            </Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="time-outline" size={18} color="#6b7280" />
            <Text className="text-gray-600 ml-2">{formatDateTime(data.logged_at)}</Text>
          </View>
          {data.location_name && (
            <View className="flex-row items-center">
              <Ionicons name="location-outline" size={18} color="#6b7280" />
              <Text className="text-gray-600 ml-2">{data.location_name}</Text>
            </View>
          )}
        </View>

        {/* Notes */}
        {data.notes && (
          <View className="mb-4">
            <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1">
              Notes
            </Text>
            <Text className="text-gray-700 text-base">{data.notes}</Text>
          </View>
        )}

        {/* Author */}
        <Pressable
          className="flex-row items-center mt-2 p-3 bg-gray-50 rounded-2xl"
          onPress={() => router.push(`/user/${data.profile.id}`)}
        >
          <Avatar
            uri={data.profile.avatar_url}
            name={data.profile.display_name ?? data.profile.username}
            size={38}
          />
          <View className="ml-3">
            <Text className="font-semibold text-gray-800">
              {data.profile.display_name ?? data.profile.username}
            </Text>
            <Text className="text-gray-400 text-xs">@{data.profile.username}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{ marginLeft: 'auto' }} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
