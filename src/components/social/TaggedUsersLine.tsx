import { useRouter } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
import { TaggedUser } from '@/types/models';

/** "with @alice, @bob" — each name opens that profile. */
export function TaggedUsersLine({ users, className = '' }: { users: TaggedUser[]; className?: string }) {
  const router = useRouter();
  if (users.length === 0) return null;
  return (
    <Text className={`text-muted-foreground text-sm ${className}`}>
      with{' '}
      {users.map((u, i) => (
        <React.Fragment key={u.id}>
          {i > 0 ? ', ' : ''}
          <Text
            className="text-foreground font-semibold"
            onPress={(e) => {
              e.stopPropagation();
              router.push(`/user/${u.id}` as never);
            }}
          >
            @{u.username}
          </Text>
        </React.Fragment>
      ))}
    </Text>
  );
}
