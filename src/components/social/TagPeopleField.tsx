import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/common/Avatar';
import { useUserSearch } from '@/hooks/useUserSearch';
import { TaggedUser } from '@/types/models';

export const MAX_TAGS = 10;

interface TagPeopleFieldProps {
  value: TaggedUser[];
  onChange: (users: TaggedUser[]) => void;
}

/** Form field for tagging the people you're drinking with. */
export function TagPeopleField({ value, onChange }: TagPeopleFieldProps) {
  const [open, setOpen] = useState(false);

  function remove(id: string) {
    onChange(value.filter((u) => u.id !== id));
  }

  return (
    <View>
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-foreground font-semibold">Tag People (optional)</Text>
        {value.length > 0 && (
          <Text className="text-muted-foreground text-xs">
            {value.length}/{MAX_TAGS}
          </Text>
        )}
      </View>
      <View className="flex-row flex-wrap gap-2">
        {value.map((u) => (
          <View key={u.id} className="flex-row items-center gap-1.5 bg-card border border-border rounded-full pl-1 pr-2 py-1">
            <Avatar uri={u.avatar_url} name={u.display_name ?? u.username} size={22} />
            <Text className="text-foreground text-sm">@{u.username}</Text>
            <Pressable onPress={() => remove(u.id)} hitSlop={8} accessibilityLabel={`Untag ${u.username}`}>
              <Ionicons name="close" size={14} color="gray" />
            </Pressable>
          </View>
        ))}
        {value.length < MAX_TAGS && (
          <Pressable
            onPress={() => setOpen(true)}
            className="flex-row items-center gap-1 bg-card border-2 border-dashed border-border rounded-full px-3 py-1.5 active:bg-accent"
          >
            <Ionicons name="person-add-outline" size={14} color="hsl(var(--muted-foreground))" />
            <Text className="text-muted-foreground text-sm">Tag people</Text>
          </Pressable>
        )}
      </View>
      <TagPeopleModal visible={open} selected={value} onChange={onChange} onClose={() => setOpen(false)} />
    </View>
  );
}

function TagPeopleModal({
  visible,
  selected,
  onChange,
  onClose,
}: {
  visible: boolean;
  selected: TaggedUser[];
  onChange: (users: TaggedUser[]) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const { users, isLoading } = useUserSearch(query, { enabled: visible, limit: 15 });
  const selectedIds = new Set(selected.map((u) => u.id));
  const full = selected.length >= MAX_TAGS;

  function toggle(user: TaggedUser) {
    if (selectedIds.has(user.id)) onChange(selected.filter((u) => u.id !== user.id));
    else if (!full) onChange([...selected, user]);
  }

  function close() {
    setQuery('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top ? 8 : 16, paddingBottom: insets.bottom }}>
        <View className="flex-row items-center justify-between px-4 pb-3 border-b border-border">
          <View className="w-12" />
          <Text className="text-foreground text-base font-semibold">Tag People</Text>
          <Pressable onPress={close} hitSlop={8}>
            <Text className="text-primary text-base font-bold">Done</Text>
          </Pressable>
        </View>

        <View className="px-4 pt-3">
          <View className="flex-row items-center bg-card border border-border rounded-xl px-3">
            <Ionicons name="search" size={16} color="gray" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search people"
              placeholderTextColor="gray"
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              className="flex-1 py-2.5 px-2 text-foreground text-base"
            />
          </View>
          {full && (
            <Text className="text-muted-foreground text-xs mt-2">You can tag up to {MAX_TAGS} people.</Text>
          )}
        </View>

        <ScrollView className="flex-1 mt-2" keyboardShouldPersistTaps="handled">
          {/* Already tagged, so they can be untagged without searching */}
          {query.trim() === '' &&
            selected.map((u) => <UserRow key={u.id} user={u} checked onPress={() => toggle(u)} />)}
          {users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              checked={selectedIds.has(u.id)}
              disabled={full && !selectedIds.has(u.id)}
              onPress={() => toggle(u)}
            />
          ))}
          {isLoading && <ActivityIndicator color="#f59e0b" style={{ marginTop: 16 }} />}
          {!isLoading && query.trim() !== '' && users.length === 0 && (
            <Text className="text-muted-foreground text-sm text-center mt-6">No one found</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function UserRow({
  user,
  checked,
  disabled,
  onPress,
}: {
  user: TaggedUser;
  checked: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="flex-row items-center gap-3 px-4 py-2.5 active:bg-accent"
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Avatar uri={user.avatar_url} name={user.display_name ?? user.username} size={36} />
      <View className="flex-1">
        {user.display_name ? <Text className="text-foreground font-medium">{user.display_name}</Text> : null}
        <Text className="text-muted-foreground text-sm">@{user.username}</Text>
      </View>
      <Ionicons
        name={checked ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={checked ? '#f59e0b' : 'gray'}
      />
    </Pressable>
  );
}
