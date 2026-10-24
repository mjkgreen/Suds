import { useEffect, useRef } from 'react';
import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';

/** Roughly how long the keyboard takes to slide up. */
const KEYBOARD_SETTLE_MS = 300;

/**
 * Keeps the latest comments in view on a screen with a pinned CommentComposer:
 * scrolls to the bottom when the composer is focused (once the keyboard is
 * up) and when the comment you just sent shows up in the list.
 */
export function useCommentAutoScroll(commentCount: number) {
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const awaitingOwnComment = useRef(false);

  function scrollToEnd() {
    scrollRef.current?.scrollToEnd({ animated: true });
  }

  useEffect(() => {
    if (!awaitingOwnComment.current) return;
    awaitingOwnComment.current = false;
    // Let the new row lay out first.
    requestAnimationFrame(scrollToEnd);
  }, [commentCount]);

  return {
    scrollRef,
    /** Pass to the composer's onFocus. */
    onComposerFocus: () => setTimeout(scrollToEnd, KEYBOARD_SETTLE_MS),
    /** Call when sending, so the list scrolls once the comment appears. */
    onCommentSent: () => {
      awaitingOwnComment.current = true;
    },
  };
}
