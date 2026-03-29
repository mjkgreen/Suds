import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
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
import { DrinkBadge } from '@/components/drink/DrinkBadge';
import { PremiumGate } from '@/components/common/PremiumGate';
import { AdvancedStatsCard } from '@/components/profile/AdvancedStatsCard';
import { BACEstimator } from '@/components/profile/BACEstimator';
import { GoalCard } from '@/components/profile/GoalCard';
import { MilestoneBanner } from '@/components/profile/MilestoneBanner';
import { StreakCard } from '@/components/profile/StreakCard';
import { useAuth } from '@/hooks/useAuth';
import { useMyDrinkLogs } from '@/hooks/useDrinkLog';
import { useMilestones } from '@/hooks/useMilestones';
import { useProfile, useUserStats } from '@/hooks/useProfile';
import { useStreaks } from '@/hooks/useStreaks';
import { useAuthStore } from '@/stores/authStore';
import { DrinkLog, DrinkType } from '@/types/models';
import { formatDateTime } from '@/utils/dateHelpers';
import { getDisplayName, getUsername } from '@/utils/profileHelpers';
import { DRINK_TYPE_MAP } from '@/lib/constants';

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="flex-1 items-center">
      <Text className="text-2xl font-bold text-gray-900">{value}</Text>
      <Text className="text-xs text-gray-400 mt-0.5">{label}</Text>
    </View>
  );
}

function DrinkLogRow({ item }: { item: DrinkLog }) {
  const info = DRINK_TYPE_MAP[item.drink_type as DrinkType] ?? DRINK_TYPE_MAP['other'];
  return (
    <View className="flex-row items-center px-6 py-3 border-b border-gray-100">
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
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isPremium } = useAuthStore();
  const { signOut } = useAuth();

  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } =
    useProfile(user?.id);
  const { data: stats } = useUserStats(user?.id);
  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } =
    useMyDrinkLogs(user?.id);
  const { data: streaks } = useStreaks(user?.id);
  const { data: milestones } = useMilestones(user?.id);

  const isLoading = profileLoading || logsLoading;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-amber-50 items-center justify-center">
        <ActivityIndicator size="large" color="#f59e0b" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <FlatList
        data={logs ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <DrinkLogRow item={item} />}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => { refetchProfile(); refetchLogs(); }}
            tintColor="#f59e0b"
          />
        }
        ListHeaderComponent={
          <View>
            {/* Profile header */}
            <View className="bg-white px-6 pt-6 pb-5 border-b border-gray-100">
              <View className="flex-row items-start justify-between mb-4">
                <View className="flex-row items-center gap-2">
                  <Avatar
                    uri={profile?.avatar_url}
                    name={profile ? getDisplayName(profile) : 'User'}
                    size={72}
                  />
                  {isPremium && (
                    <View className="bg-amber-400 rounded-full px-2 py-0.5 self-start mt-1">
                      <Text className="text-white text-xs font-bold">Plus</Text>
                    </View>
                  )}
                </View>
                <View className="flex-row gap-2">
                  {!isPremium && (
                    <Pressable
                      className="bg-amber-400 rounded-xl px-4 py-2"
                      onPress={() => router.push('/paywall')}
                    >
                      <Text className="text-white font-bold text-sm">Upgrade</Text>
                    </Pressable>
                  )}
                  <Pressable
                    className="bg-gray-100 rounded-xl px-4 py-2"
                    onPress={() => router.push('/user/edit')}
                  >
                    <Text className="text-gray-700 font-medium text-sm">Edit</Text>
                  </Pressable>
                  <Pressable
                    className="bg-gray-100 rounded-xl p-2"
                    onPress={signOut}
                  >
                    <Ionicons name="log-out-outline" size={20} color="#6b7280" />
                  </Pressable>
                </View>
              </View>

              <Text className="text-xl font-bold text-gray-900">
                {profile ? getDisplayName(profile) : 'User'}
              </Text>
              <Text className="text-gray-400 text-sm">
                @{profile ? getUsername(profile) : 'unknown'}
              </Text>
              {profile?.bio && (
                <Text className="text-gray-600 text-sm mt-2">{profile.bio}</Text>
              )}

              {/* Follower counts */}
              <View className="flex-row gap-6 mt-3">
                <Text className="text-gray-700 text-sm">
                  <Text className="font-bold text-gray-900">
                    {profile?.followers_count ?? 0}
                  </Text>{' '}
                  Followers
                </Text>
                <Text className="text-gray-700 text-sm">
                  <Text className="font-bold text-gray-900">
                    {profile?.following_count ?? 0}
                  </Text>{' '}
                  Following
                </Text>
              </View>
            </View>

            {/* Milestone banner (free) */}
            {milestones && <MilestoneBanner milestones={milestones} />}

            {/* Streaks (free) */}
            {streaks && <StreakCard streaks={streaks} />}

            {/* Weekly goal / moderation (free) */}
            {stats && user?.id && (
              <GoalCard userId={user.id} stats={stats} />
            )}

            {/* Basic stats (free) */}
            {stats && (
              <View className="bg-white mx-4 mt-4 rounded-2xl border border-gray-100 p-4 gap-4">
                {/* Top numbers */}
                <View className="flex-row">
                  <StatBlock label="Total Drinks" value={stats.total_drinks} />
                  <View className="w-px bg-gray-100" />
                  <StatBlock label="This Week" value={stats.drinks_this_week} />
                  <View className="w-px bg-gray-100" />
                  <StatBlock label="This Month" value={stats.drinks_this_month} />
                </View>

                {/* Activity bar chart — last 14 days */}
                {stats.activity_by_day?.length > 0 && (() => {
                  const last14 = stats.activity_by_day.slice(-14);
                  const maxCount = Math.max(...last14.map((d) => d.count), 1);
                  return (
                    <View>
                      <Text className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
                        Last 14 Days
                      </Text>
                      <View className="flex-row items-end gap-1 h-12">
                        {last14.map((d) => (
                          <View key={d.date} className="flex-1 items-center">
                            <View
                              style={{
                                width: '100%',
                                height: `${Math.max((d.count / maxCount) * 100, d.count > 0 ? 10 : 0)}%`,
                                backgroundColor: d.count > 0 ? '#f59e0b' : '#f3f4f6',
                                borderRadius: 3,
                                minHeight: d.count > 0 ? 4 : 2,
                              }}
                            />
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })()}

                {/* Top drink types */}
                {stats.favorite_drink_types?.length > 0 && (
                  <View>
                    <Text className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
                      Top Drinks
                    </Text>
                    <View className="gap-2">
                      {stats.favorite_drink_types.slice(0, 3).map((d) => {
                        const info = DRINK_TYPE_MAP[d.drink_type as DrinkType] ?? DRINK_TYPE_MAP['other'];
                        const pct = stats.total_drinks > 0 ? (d.count / stats.total_drinks) * 100 : 0;
                        return (
                          <View key={d.drink_type} className="flex-row items-center gap-2">
                            <Text className="text-base w-6">{info.emoji}</Text>
                            <View className="flex-1">
                              <View className="flex-row items-center justify-between mb-0.5">
                                <Text className="text-xs text-gray-600 font-medium">{info.label}</Text>
                                <Text className="text-xs text-gray-400">{d.count}</Text>
                              </View>
                              <View className="bg-gray-100 rounded-full h-1.5">
                                <View
                                  style={{ width: `${pct}%`, backgroundColor: info.color }}
                                  className="h-1.5 rounded-full"
                                />
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Advanced stats (premium) */}
            {user?.id && (
              <PremiumGate featureName="Advanced Analytics">
                <AdvancedStatsCard userId={user.id} />
              </PremiumGate>
            )}

            {/* BAC estimator (premium) */}
            <PremiumGate featureName="BAC Estimator">
              <BACEstimator />
            </PremiumGate>

            {/* Section header */}
            <View className="px-6 pt-5 pb-2">
              <Text className="text-base font-bold text-gray-700">Drink History</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="px-6 py-10 items-center">
            <Text className="text-3xl mb-2">🍺</Text>
            <Text className="text-gray-500 text-center">
              No drinks logged yet. Crack one open!
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}
