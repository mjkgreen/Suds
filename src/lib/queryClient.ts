import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      // Keep results around long enough to be saved for the next launch /
      // offline use (see offlineCache.ts). Must be at least its maxAge.
      gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
      retry: 2,
    },
  },
});

// TanStack's React Native setup: treat "app came back to the foreground" like
// a browser tab regaining focus, so stale screens refresh when you reopen.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    focusManager.setFocused(state === 'active');
  });
}
