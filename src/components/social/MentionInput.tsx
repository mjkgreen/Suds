import React, { forwardRef, useState } from 'react';
import { NativeSyntheticEvent, Pressable, StyleProp, Text, TextInput, TextInputProps, TextInputSelectionChangeEventData, View, ViewStyle } from 'react-native';
import { Avatar } from '@/components/common/Avatar';
import { useUserSearch } from '@/hooks/useUserSearch';
import { activeMentionQuery, insertMention } from '@/lib/mentions';

interface MentionInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string;
  onChangeText: (text: string) => void;
  /** Where the @suggestions list appears relative to the input. */
  suggestionsPosition?: 'above' | 'below';
  containerStyle?: StyleProp<ViewStyle>;
  containerClassName?: string;
}

/**
 * TextInput with @mention autocomplete: typing "@" plus a letter or two shows
 * matching users; picking one completes "@username ".
 */
export const MentionInput = forwardRef<TextInput, MentionInputProps>(function MentionInput(
  { value, onChangeText, suggestionsPosition = 'below', containerStyle, containerClassName, onSelectionChange, ...inputProps },
  ref,
) {
  const [cursor, setCursor] = useState(value.length);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  const mention = activeMentionQuery(value, cursor);
  const showing = !!mention && mention.query.length > 0 && dismissedAt !== mention.start;
  const { users } = useUserSearch(mention?.query ?? '', { enabled: showing, limit: 5 });

  function handleSelectionChange(e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) {
    setCursor(e.nativeEvent.selection.end);
    onSelectionChange?.(e);
  }

  function handleChangeText(text: string) {
    // Typing moves the cursor before onSelectionChange fires on some
    // platforms; assume it's at the end of what changed.
    setCursor(Math.max(0, cursor + (text.length - value.length)));
    setDismissedAt(null);
    onChangeText(text);
  }

  function pick(username: string) {
    if (!mention) return;
    const next = insertMention(value, mention.start, cursor, username);
    onChangeText(next);
    setCursor(mention.start + username.length + 2);
    setDismissedAt(mention.start);
  }

  const suggestions =
    showing && users.length > 0 ? (
      <View className="bg-card border border-border rounded-xl overflow-hidden my-1">
        {users.map((u, i) => (
          <Pressable
            key={u.id}
            onPress={() => pick(u.username)}
            className={`flex-row items-center gap-2 px-3 py-2 active:bg-accent ${i > 0 ? 'border-t border-border' : ''}`}
          >
            <Avatar uri={u.avatar_url} name={u.display_name ?? u.username} size={26} />
            <View className="flex-1">
              {u.display_name ? <Text className="text-foreground text-sm font-medium">{u.display_name}</Text> : null}
              <Text className="text-muted-foreground text-xs">@{u.username}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    ) : null;

  return (
    <View style={containerStyle} className={containerClassName}>
      {suggestionsPosition === 'above' && suggestions}
      <TextInput
        ref={ref}
        {...inputProps}
        value={value}
        onChangeText={handleChangeText}
        onSelectionChange={handleSelectionChange}
        autoCorrect={showing ? false : inputProps.autoCorrect}
      />
      {suggestionsPosition === 'below' && suggestions}
    </View>
  );
});
