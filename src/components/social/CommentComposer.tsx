import { Ionicons } from '@expo/vector-icons';
import React, { forwardRef } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MentionInput } from '@/components/social/MentionInput';

interface CommentComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  isSending: boolean;
}

/**
 * Comment box pinned to the bottom of the screen that rides on top of the
 * keyboard, with @mention suggestions directly above it — so what you're
 * typing and who you're tagging stay visible.
 *
 * Render it after the screen's ScrollView, inside a bottom-edge SafeAreaView.
 */
export const CommentComposer = forwardRef<TextInput, CommentComposerProps>(function CommentComposer(
  { value, onChangeText, onSend, isSending },
  ref,
) {
  const insets = useSafeAreaInsets();

  return (
    // The SafeAreaView already lifts this above the home indicator; with the
    // keyboard up that inset isn't needed, so drop it to sit flush on the keyboard.
    <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
      <View className="flex-row items-end gap-2 px-4 pt-2 pb-2 bg-background border-t border-border">
        <MentionInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          suggestionsPosition="above"
          containerClassName="flex-1"
          placeholder="Add a comment… @mention someone"
          placeholderTextColor="gray"
          multiline
          maxLength={500}
          className="bg-card border border-border rounded-2xl px-4 py-2.5 text-foreground text-sm"
          style={{ lineHeight: 20, maxHeight: 120 }}
        />
        <Pressable
          onPress={onSend}
          disabled={!value.trim() || isSending}
          className="w-10 h-10 mb-0.5 items-center justify-center rounded-full bg-primary disabled:opacity-40"
          accessibilityLabel="Send comment"
        >
          {isSending ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="send" size={16} color="white" />}
        </Pressable>
      </View>
    </KeyboardStickyView>
  );
});
