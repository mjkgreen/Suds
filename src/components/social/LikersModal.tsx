import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { Avatar } from '@/components/common/Avatar';
import { useLikers } from '@/hooks/useLikers';
import { useFollow, useIsFollowing } from '@/hooks/useFollow';
import { Profile } from '@/types/models';
import { getDisplayName, getUsername } from '@/utils/profileHelpers';

interface LikersModalProps {
  drinkLogId: string;
  visible: boolean;
  onClose: () => void;
  currentUserId: string | undefined;
}

export function LikersModal({ drinkLogId, visible, onClose, currentUserId }: LikersModalProps) {
  const { data: likers, isLoading } = useLikers(visible ? drinkLogId : undefined);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Text className="text-foreground font-semibold text-base">
            Liked by {likers ? likers.length : '…'}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color="gray" />
          </Pressable>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#f59e0b" />
          </View>
        ) : (
          <FlatList
            data={likers ?? []}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={
              <Text className="text-muted-foreground text-sm text-center mt-8">No likes yet.</Text>
            }
            renderItem={({ item }) => (
              <LikerRow profile={item} currentUserId={currentUserId} onClose={onClose} />
            )}
            ItemSeparatorComponent={() => <View className="h-4" />}
          />
        )}
      </View>
    </Modal>
  );
}

interface LikerRowProps {
  profile: Profile;
  currentUserId: string | undefined;
  onClose: () => void;
}

function LikerRow({ profile, currentUserId, onClose }: LikerRowProps) {
  const router = useRouter();
  const isOwn = profile.id === currentUserId;
  const { data: isFollowing } = useIsFollowing(currentUserId, profile.id);
  const { follow, unfollow } = useFollow(currentUserId);

  function handlePress() {
    onClose();
    router.push(`/user/${profile.id}`);
  }

  return (
    <View className="flex-row items-center gap-3">
      <Pressable onPress={handlePress}>
        <Avatar uri={profile.avatar_url} name={getDisplayName(profile)} size={44} />
      </Pressable>
      <Pressable className="flex-1" onPress={handlePress}>
        <Text className="text-foreground font-semibold text-sm">{getDisplayName(profile)}</Text>
        <Text className="text-muted-foreground text-xs">@{getUsername(profile)}</Text>
      </Pressable>
      {!isOwn && (
        <Pressable
          onPress={() => isFollowing ? unfollow.mutate(profile.id) : follow.mutate(profile.id)}
          disabled={follow.isPending || unfollow.isPending}
          className={`px-4 py-1.5 rounded-full border ${
            isFollowing
              ? 'border-border bg-transparent'
              : 'border-primary bg-primary'
          }`}
        >
          <Text
            className={`text-xs font-semibold ${isFollowing ? 'text-foreground' : 'text-primary-foreground'}`}
          >
            {follow.isPending || unfollow.isPending ? '…' : isFollowing ? 'Following' : 'Follow'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
