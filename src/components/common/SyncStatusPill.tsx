import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleProp, Text, View, ViewStyle } from 'react-native';

interface SyncStatusPillProps {
  /** A background fetch is in flight. */
  isFetching: boolean;
  /** The latest refresh failed but saved data is on screen. */
  isRefetchError: boolean;
  /** The user pulled to refresh — the RefreshControl spinner already shows that. */
  isPullRefreshing?: boolean;
  /** Spacing around the pill; only applied while it's showing. */
  style?: StyleProp<ViewStyle>;
}

/** After this long without an answer, say so instead of "Updating…" forever. */
const SLOW_AFTER_MS = 6000;

/**
 * Small status line for screens that open with saved content: "Updating…"
 * while fresh data loads, or a note that what's shown is saved when offline.
 */
export function SyncStatusPill({ isFetching, isRefetchError, isPullRefreshing = false, style }: SyncStatusPillProps) {
  const [slow, setSlow] = useState(false);

  // With no signal, a refresh can hang ~30s while the login renewal retries
  // before anything actually fails.
  useEffect(() => {
    if (!isFetching) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [isFetching]);

  if (isRefetchError || (isFetching && slow)) {
    return (
      <View style={style} className="self-center flex-row items-center gap-1.5 bg-card border border-border rounded-full px-3 py-1">
        <Ionicons name="cloud-offline-outline" size={14} color="gray" />
        <Text className="text-muted-foreground text-xs font-medium">
          {isRefetchError ? 'Offline' : "Can't connect"} · showing saved posts
        </Text>
      </View>
    );
  }
  if (isFetching && !isPullRefreshing) {
    return (
      <View style={style} className="self-center flex-row items-center gap-1.5 bg-card border border-border rounded-full px-3 py-1">
        <ActivityIndicator size="small" color="#f59e0b" />
        <Text className="text-muted-foreground text-xs font-medium">Updating…</Text>
      </View>
    );
  }
  return null;
}
