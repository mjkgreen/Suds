import React, { createContext, useContext, useRef, useState } from 'react';
import { ViewabilityConfig, ViewToken } from 'react-native';

/**
 * Keys of the list rows currently on screen. Null outside a tracked list
 * (e.g. detail pages), where everything counts as visible.
 */
const VisibleItemsContext = createContext<Set<string> | null>(null);

export const VisibleItemsProvider = VisibleItemsContext.Provider;

/** Whether the list row with this key is on screen. */
export function useIsItemVisible(key?: string): boolean {
  const visible = useContext(VisibleItemsContext);
  return !visible || !key || visible.has(key);
}

const VIEWABILITY_CONFIG: ViewabilityConfig = {
  itemVisiblePercentThreshold: 60,
  minimumViewTime: 150,
};

/**
 * Tracks which rows of a FlatList are on screen. Spread `viewabilityProps`
 * onto the list and pass `visibleKeys` to a VisibleItemsProvider around it.
 */
export function useVisibleItems() {
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(() => new Set());
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    setVisibleKeys(new Set(viewableItems.filter((v) => v.isViewable).map((v) => v.key)));
  }).current;

  return {
    visibleKeys,
    viewabilityProps: { onViewableItemsChanged, viewabilityConfig: VIEWABILITY_CONFIG },
  };
}
