import React from 'react';
import { Alert, Platform } from 'react-native';
import { Button } from '@/components/common/Button';
import { useFollow, useFollowStatus } from '@/hooks/useFollow';
import { Profile } from '@/types/models';
import { getUsername } from '@/utils/profileHelpers';

interface FollowButtonProps {
  targetProfile: Profile;
  currentUserId: string;
  size?: 'sm' | 'md';
}

/**
 * Tri-state follow control: Follow → (Requested, for private accounts) →
 * Following. Tapping "Requested" offers to withdraw the request; tapping
 * "Following" unfollows.
 */
export function FollowButton({ targetProfile, currentUserId, size = 'sm' }: FollowButtonProps) {
  const { data: status = 'none' } = useFollowStatus(currentUserId, targetProfile.id);
  const { follow, unfollow, cancelRequest } = useFollow(currentUserId);

  if (targetProfile.id === currentUserId) return null;

  const label = status === 'following' ? 'Following' : status === 'requested' ? 'Requested' : 'Follow';

  function handlePress(e: any) {
    // Rows wrap this button in a navigating Pressable on web
    e?.stopPropagation?.();
    if (status === 'following') {
      unfollow.mutate(targetProfile.id);
    } else if (status === 'requested') {
      if (Platform.OS === 'web') {
        cancelRequest.mutate(targetProfile.id);
        return;
      }
      Alert.alert(
        'Cancel follow request?',
        `Withdraw your request to follow @${getUsername(targetProfile)}?`,
        [
          { text: 'Keep Request', style: 'cancel' },
          {
            text: 'Cancel Request',
            style: 'destructive',
            onPress: () => cancelRequest.mutate(targetProfile.id),
          },
        ],
      );
    } else {
      follow.mutate({ targetId: targetProfile.id, isPrivate: !!targetProfile.is_private });
    }
  }

  return (
    <Button
      label={label}
      variant={status === 'none' ? 'primary' : 'secondary'}
      size={size}
      loading={follow.isPending || unfollow.isPending || cancelRequest.isPending}
      onPress={handlePress}
    />
  );
}
