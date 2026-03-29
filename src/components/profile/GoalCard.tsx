import React, { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useGoal, useUpsertGoal } from '@/hooks/useGoals';
import { UserStats } from '@/types/models';

interface GoalCardProps {
  userId: string;
  stats: UserStats;
}

export function GoalCard({ userId, stats }: GoalCardProps) {
  const { data: goal } = useGoal(userId);
  const upsert = useUpsertGoal();
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const weeklyCount = stats.drinks_this_week;
  const limit = goal?.weekly_limit ?? null;

  function startEdit() {
    setInputValue(limit ? String(limit) : '');
    setEditing(true);
  }

  function save() {
    const n = parseInt(inputValue, 10);
    if (!n || n <= 0) {
      Alert.alert('Invalid goal', 'Enter a number greater than 0.');
      return;
    }
    upsert.mutate({ userId, weeklyLimit: n });
    setEditing(false);
  }

  const pct = limit ? Math.min((weeklyCount / limit) * 100, 100) : 0;
  const overLimit = limit ? weeklyCount > limit : false;

  return (
    <View className="bg-white mx-4 mt-4 rounded-2xl border border-gray-100 p-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-xs text-gray-400 font-medium uppercase tracking-wide">
          Weekly Goal
        </Text>
        {!editing && (
          <Pressable onPress={startEdit}>
            <Text className="text-xs text-amber-500 font-semibold">
              {limit ? 'Edit' : 'Set goal'}
            </Text>
          </Pressable>
        )}
      </View>

      {editing ? (
        <View className="flex-row items-center gap-3">
          <TextInput
            className="flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-gray-900 text-base"
            keyboardType="number-pad"
            placeholder="e.g. 14"
            value={inputValue}
            onChangeText={setInputValue}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={save}
          />
          <Pressable
            className="bg-amber-400 rounded-xl px-4 py-2.5"
            onPress={save}
          >
            <Text className="text-white font-bold text-sm">Save</Text>
          </Pressable>
          <Pressable onPress={() => setEditing(false)}>
            <Text className="text-gray-400 text-sm">Cancel</Text>
          </Pressable>
        </View>
      ) : limit ? (
        <View>
          <View className="flex-row items-end justify-between mb-2">
            <Text className={`text-2xl font-bold ${overLimit ? 'text-red-500' : 'text-gray-900'}`}>
              {weeklyCount}
              <Text className="text-base font-normal text-gray-400"> / {limit}</Text>
            </Text>
            <Text className="text-xs text-gray-400">drinks this week</Text>
          </View>
          <View className="bg-gray-100 rounded-full h-2">
            <View
              style={{
                width: `${pct}%`,
                backgroundColor: overLimit ? '#EF4444' : '#F59E0B',
              }}
              className="h-2 rounded-full"
            />
          </View>
          {overLimit && (
            <Text className="text-xs text-red-500 mt-1.5">
              Over your weekly goal by {weeklyCount - limit} drink{weeklyCount - limit !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      ) : (
        <Text className="text-gray-400 text-sm">
          Set a weekly drink limit to track your moderation.
        </Text>
      )}
    </View>
  );
}
